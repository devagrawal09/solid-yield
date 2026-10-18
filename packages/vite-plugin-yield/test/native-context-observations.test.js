import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

const root = resolve(import.meta.dirname, "fixtures");
const check = sources => {
  const files = new Map(
    Object.entries(sources).map(([name, source]) => [
      resolve(root, name),
      /export function App/.test(source)
        ? `import { render } from "@solidjs/web"; ${source}
         render(() => <App/>, document.body);
         ${/export function Other/.test(source) ? "render(() => <Other/>, document.body);" : ""}`
        : source
    ])
  );
  const originalOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "@solidjs/web",
    types: []
  };
  const originalHost = ts.createCompilerHost(originalOptions),
    originalRead = originalHost.readFile,
    originalExists = originalHost.fileExists;
  originalHost.readFile = file => files.get(file) ?? originalRead(file);
  originalHost.fileExists = file => files.has(file) || originalExists(file);
  const ordinary = ts
    .getPreEmitDiagnostics(ts.createProgram([...files.keys()], originalOptions, originalHost))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  expect(ordinary, ordinary.join("\n")).toEqual([]);
  const result = lowerNativeProject(files);
  const lowered = result.files;
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "solid-yield",
    types: []
  };
  const host = ts.createCompilerHost(options),
    read = host.readFile;
  host.readFile = file => lowered.get(file) ?? read(file);
  const exists = host.fileExists;
  host.fileExists = file => lowered.has(file) || exists(file);
  const diagnostics = ts
    .getPreEmitDiagnostics(ts.createProgram([...files.keys()], options, host))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  return {
    typeDiagnostics: diagnostics,
    inferenceDiagnostics: result.inference.diagnostics,
    diagnostics: [
      ...diagnostics,
      ...result.inference.diagnostics.map(d => `[${d.code}] ${d.message}`)
    ],
    lowered
  };
};

describe("observing an immutable provider bag", { timeout: 60_000 }, () => {
  const prelude =
    'import {createContext,createSignal,createMemo,useContext,Errored,Loading} from "solid-js";import type {Accessor} from "solid-js";interface Service{readonly count:Accessor<number>;readonly reload:()=>void}const Ctx=createContext<Service>();';
  const factory =
    "function makeService():Service{const [count,setCount]=createSignal(0);const reload=()=>{setCount(count()+1)};return {count,reload}}";
  const child = "function Child(){const service=useContext(Ctx);return <p>{service.count()}</p>}";
  const app = (setup, view) =>
    "export function App(){const service=makeService();" +
    setup +
    "return <Ctx value={service}>" +
    view +
    "</Ctx>}";
  const source = (setup = "", view = "") =>
    prelude + factory + child + app(setup, view + "<Child/>");
  for (const [label, setup, view] of [
    ["provider only", "", ""],
    ["direct accessor read", "", "<p>{service.count()}</p>"],
    ["aliased accessor read", "const read=service.count;const alias=read;", "<p>{alias()}</p>"],
    ["bag alias accessor read", "const bag=service;const read=bag.count;", "<p>{read()}</p>"],
    [
      "extracted reload callback",
      "const reload=service.reload;",
      "<button onClick={reload}>Reload</button>"
    ],
    ["receiver-safe call", "", "<button onClick={()=>service.reload()}>Reload</button>"]
  ])
    it("accepts " + label, () => {
      const result = check({
        ["observe-" + label.replaceAll(" ", "-") + ".tsx"]: source(setup, view)
      });
      expect(result.diagnostics, result.diagnostics.join("\n")).toEqual([]);
    });
  for (const setup of [
    "const value=service.count();",
    "const read=service.count;const value=read();"
  ])
    it("retains a real setup snapshot: " + setup, () => {
      const result = check({ "observation-setup-read.tsx": source(setup) });
      // The CLI classifies this modeled Read-versus-SetupOp error as READ_IN_SETUP.
      expect(result.typeDiagnostics.join("\n")).toContain("Read<");
      expect(result.typeDiagnostics.join("\n")).toContain("SetupOp");
    });
  const refuses = text =>
    expect(() => check({ "observation-refused.tsx": text })).toThrow(/^\[NATIVE_CONTEXT\]/);
  for (const [label, setup] of [
    ["direct write", "const mutable=service as {count:()=>number};mutable.count=()=>9;"],
    ["delete", "delete (service as {count?:Accessor<number>}).count;"],
    ["defineProperty", 'Object.defineProperty(service,"count",{value:()=>9});'],
    ["bag storage", "const stored=[service];"],
    ["member storage", "const stored=[service.count];"],
    ["member alias storage", "const read=service.count;const stored={read};"],
    [
      "member alias mutation",
      "const read=service.count;Object.defineProperty(read,Symbol.iterator,{value:()=>9});"
    ],
    ["unknown member consumer", "try{consume(service.count)}catch{return <p>failed</p>}"]
  ])
    it("refuses " + label, () =>
      refuses(
        source(setup, "<p>{service.count()}</p>") + "declare function consume(value:unknown):void;"
      )
    );
  it("does not read a getter as if it were an immutable data member", () => {
    refuses(
      source("", "<p>{service.count()}</p>").replace(
        "return {count,reload}",
        "return {get count(){return count},reload}"
      )
    );
  });
  it("does not ignore a computed-key overwrite of the observed slot", () => {
    refuses(
      source("", "<p>{service.count()}</p>").replace(
        "return {count,reload}",
        'const key:string="count";return {count,reload,[key]:()=>9}'
      )
    );
  });
  it("does not ignore a computed getter collision", () => {
    refuses(
      source("", "<p>{service.count()}</p>").replace(
        "return {count,reload}",
        'const key:string="count";return {count,reload,get [key](){return ()=>9}}'
      )
    );
  });
  it("does not call an unknown receiver implementation", () => {
    refuses(
      source("", "<button onClick={()=>service.reload()}>Reload</button>").replace(
        "const reload=()=>{setCount(count()+1)}",
        "const reload=unknownReload"
      ) + "declare function unknownReload():void;"
    );
  });
  it("does not expose the bag as a method receiver", () => {
    refuses(
      source("", "<button onClick={()=>service.reload()}>Reload</button>").replace(
        "const reload=()=>{setCount(count()+1)}",
        'const reload=function(this:Service){Object.defineProperty(this,"count",{value:()=>9})}'
      )
    );
  });
  it("does not expose this from a default argument initializer", () => {
    refuses(
      source("", "<button onClick={()=>service.reload()}>Reload</button>").replace(
        "const reload=()=>{setCount(count()+1)}",
        "const reload=function(this:Service,x=Object.assign(this,{count:foreign})){}"
      ) + "declare function foreign():number;"
    );
  });
  it("allows an unused explicit this annotation without a receiver escape", () => {
    const text = source("", "<button onClick={()=>service.reload()}>Reload</button>").replace(
      "const reload=()=>{setCount(count()+1)}",
      "const reload=function(this:Service){setCount(count()+1)}"
    );
    expect(check({ "unused-this.tsx": text }).diagnostics).toEqual([]);
  });
  it("keeps a mixed unknown provider conservative", () => {
    refuses(
      source("", "<p>{service.count()}</p>") +
        "declare function opaque():Service;export function Other(){return <Ctx value={opaque()}><Child/></Ctx>}"
    );
  });
  it("retains a genuine failure from an extracted callback", () => {
    const text = source(
      "const reload=service.reload;",
      "<button onClick={reload}>Reload</button>"
    ).replace(
      "const reload=()=>{setCount(count()+1)}",
      'const reload=()=>{throw new RangeError("reload")}'
    );
    const result = check({ "observed-callback-failure.tsx": text });
    expect(
      result.inferenceDiagnostics.some(
        d => d.code === "EVENT_REJECTS" && /RangeError/.test(d.message)
      )
    ).toBe(true);
  });
  it("does not trust a void return annotation to hide an unknown failure", () => {
    const text =
      source("const reload=service.reload;", "<button onClick={reload}>Reload</button>").replace(
        "const reload=()=>{setCount(count()+1)}",
        "const reload=()=>externalWork()"
      ) + "declare function externalWork():void;";
    const result = check({ "observed-callback-unknown.tsx": text });
    expect(
      result.inferenceDiagnostics.some(d => d.code === "EVENT_REJECTS" && /unknown/.test(d.message))
    ).toBe(true);
  });
  it("keeps an unknown context default conservative", () => {
    refuses(
      source("", "<p>{service.count()}</p>").replace(
        "createContext<Service>()",
        "createContext<Service>(opaque())"
      ) + "declare function opaque():Service;"
    );
  });
  for (const [label, declarations, initial] of [
    ["direct", "", '{read:async()=>"ready"}'],
    ["immutable local", 'const defaults={read:async()=>"ready"};', "defaults"],
    ["factory", 'function makeDefault():Defaults{return {read:async()=>"ready"}}', "makeDefault()"]
  ])
    it("keeps a known " + label + " default contract", () => {
      const text =
        'import {createContext,createMemo,useContext,Loading} from "solid-js";interface Defaults{read():Promise<string>}' +
        declarations +
        "const Ctx=createContext<Defaults>(" +
        initial +
        ");function Child(){const service=useContext(Ctx);const value=createMemo(async()=>await service.read());return <p>{value()}</p>}export function App(){return <Loading fallback={<p>loading</p>}><Child/></Loading>}";
      expect(
        check({ ["known-default-" + label.replaceAll(" ", "-") + ".tsx"]: text }).diagnostics
      ).toEqual([]);
    });
  for (const [kind, compute, boundary, marker] of [
    ["failure", '()=>{throw new RangeError("read")}', "Errored", /FOREIGN_HANDOFF/],
    ["pending", "async()=>1", "Loading", /PENDING_ROOT/]
  ]) {
    const model =
      prelude +
      "function makeService():Service{const count=createMemo(" +
      compute +
      ");return {count,reload:()=>{}}}" +
      child;
    it("admits observed " + kind + " under " + boundary, () => {
      const fallback = boundary === "Loading" ? "<p>fallback</p>" : "()=> <p>fallback</p>";
      const view =
        "<" +
        boundary +
        " fallback={" +
        fallback +
        "}><p>{service.count()}</p><Child/></" +
        boundary +
        ">";
      expect(
        check({ ["observed-" + kind + "-handled.tsx"]: model + app("", view) }).diagnostics
      ).toEqual([]);
    });
    it("retains observed " + kind + " without " + boundary, () => {
      const result = check({
        ["observed-" + kind + "-unhandled.tsx"]: model + app("", "<p>{service.count()}</p>")
      });
      expect(result.typeDiagnostics.join("\n")).toMatch(marker);
      if (kind === "failure") expect(result.typeDiagnostics.join("\n")).toMatch(/RangeError/);
    });
  }
});
