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

describe("method-shaped native context contracts", { timeout: 60_000 }, () => {
  const returnedBag = "{count,bump:()=>commit(async()=>{})}";
  const returnedService = [
    'import {createContext,createSignal,useContext} from "solid-js";import type {Accessor} from "solid-js";',
    "interface Service{count:Accessor<number>;bump():Promise<boolean>}const Ctx=createContext<Service>();",
    "function make():Service{const [count,setCount]=createSignal(0);",
    "async function commit(run:()=>Promise<void>):Promise<boolean>{try{await run();setCount(count()+1);return true}catch{setCount(-1);return false}}",
    "return " + returnedBag + "}",
    "function Child(){const service=useContext(Ctx);const [busy,setBusy]=createSignal(false);const submit=async()=>{setBusy(true);try{await service.bump()}finally{setBusy(false)}};return <button disabled={busy()} onClick={submit}>{service.count()}</button>}",
    "export function App(){return <Ctx value={make()}><Child/></Ctx>}"
  ].join("\n");
  for (const expression of [
    returnedBag,
    "(" + returnedBag + " as unknown as Service)",
    "(" + returnedBag + " satisfies Service)",
    "((" + returnedBag + " as Service)!)"
  ]) {
    it("keeps a returned handled-Promise reader through " + expression, () => {
      const source = returnedService.replace("return " + returnedBag, "return " + expression);
      expect(check({ "returned-handled-service.tsx": source }).diagnostics).toEqual([]);
    });
  }
  it("keeps the proof for an immutable returned bag through type wrappers", () => {
    const source = returnedService.replace(
      "return " + returnedBag,
      "const bag=(" + returnedBag + " satisfies Service);return (bag as Service)!"
    );
    expect(check({ "returned-typed-bag.tsx": source }).diagnostics).toEqual([]);
  });
  it("keeps a failing callback handled by the returned service commit", () => {
    const source = returnedService.replace(
      "async()=>{}",
      'async()=>{throw new RangeError("handled")}'
    );
    expect(check({ "returned-handled-callback.tsx": source }).diagnostics).toEqual([]);
  });
  it("keeps a failing callback visible when the returned service does not catch it", () => {
    const source = returnedService
      .replace("async()=>{}", 'async()=>{throw new RangeError("unhandled")}')
      .replace(
        "try{await run();setCount(count()+1);return true}catch{setCount(-1);return false}",
        "await run();setCount(count()+1);return true"
      );
    const result = check({ "returned-unhandled-callback.tsx": source });
    expect(
      result.inferenceDiagnostics.some(
        d => d.code === "EVENT_REJECTS" && /RangeError/.test(d.message)
      )
    ).toBe(true);
    // The Promise callback slot stays unknown in the model; original
    // inference above must still retain the concrete rejected kind.
    expect(result.typeDiagnostics.join("\n")).toMatch(/FOREIGN_HANDOFF/);
  });
  for (const escape of [
    "try{consume(bag as Service)}catch{return bag}",
    "const escaped=[bag];",
    "const escaped={bag};"
  ]) {
    it("does not prove a returned typed bag that also escapes: " + escape, () => {
      const source =
        returnedService.replace(
          "return " + returnedBag,
          "const bag=(" + returnedBag + " as Service);" + escape + "return (bag as Service)!"
        ) + "declare function consume(value:Service):void;";
      expect(() => check({ "returned-escaped-bag.tsx": source })).toThrow(
        /NATIVE_CONTEXT|SUGAR_CALLBACK/
      );
    });
  }
  for (const [shape, contract] of [
    ["method", "save(title:string):Promise<boolean>"],
    ["property", "save:(title:string)=>Promise<boolean>"]
  ]) {
    const service = [
      'import {createContext,createSignal,useContext} from "solid-js";',
      'import type {Accessor} from "solid-js";',
      "interface Service {value:Accessor<string>; " + contract + "}",
      "const Ctx=createContext<Service>();",
      'function createService():Service{const [value,setValue]=createSignal("");return {value,save:async(title:string)=>{setValue(title);return true}}}',
      'function Form(){const service=useContext(Ctx);const [draft,setDraft]=createSignal("");const [busy,setBusy]=createSignal(false);',
      'const submit=async()=>{setBusy(true);try{if(await service.save(draft()))setDraft("")}finally{setBusy(false)}};',
      "return <><input value={draft()} onInput={event=>setDraft(event.currentTarget.value)}/><button disabled={busy()} onClick={submit}>Save</button><p>{service.value()}</p></>}",
      "export function App(){return <Ctx value={createService()}><Form/></Ctx>}"
    ].join("\n");
    it("checks the explicit Promise service " + shape + " and local form state", () => {
      expect(check({ [shape + "-safe.tsx"]: service }).diagnostics).toEqual([]);
      expect(
        check({
          [shape + "-contextual.tsx"]: service.replace("async(title:string)", "async title")
        }).diagnostics
      ).toEqual([]);
    });
    it("preserves authored " + shape + " argument and return values", () => {
      const wrong = service
        .replace("service.save(draft())", "service.save(123)")
        .replace("if(await service.save(123))", "if((await service.save(123)).toUpperCase())");
      const result = check({ [shape + "-wrong.tsx"]: wrong });
      expect(result.typeDiagnostics.join("\n")).toMatch(/number.*string/);
      expect(result.typeDiagnostics.join("\n")).toMatch(/toUpperCase.*boolean/);
    });
    it("keeps the failing " + shape + " method visible at a real event root", () => {
      const result = check({
        [shape + "-failure.tsx"]: service.replace("return true", 'throw new RangeError("save")')
      });
      expect(
        result.inferenceDiagnostics.some(
          d => d.code === "EVENT_REJECTS" && /RangeError/.test(d.message)
        )
      ).toBe(true);
      expect(result.typeDiagnostics.join("\n")).toMatch(/RangeError/);
    });
    it("keeps every settled provider of the " + shape + " method", () => {
      const failing =
        service +
        'function failing():Service{const [value]=createSignal("");return {value,save:async(title:string)=>{throw new RangeError(title)}}}export function Other(){return <Ctx value={failing()}><Form/></Ctx>}';
      const result = check({ [shape + "-multiple.tsx"]: failing });
      expect(
        result.inferenceDiagnostics.some(
          d => d.code === "EVENT_REJECTS" && /RangeError/.test(d.message)
        )
      ).toBe(true);
      expect(result.typeDiagnostics.join("\n")).toMatch(/RangeError/);
    });
    it("handles the failing " + shape + " method in the caller catch", () => {
      const caught = service
        .replace("return true", 'throw new RangeError("save")')
        .replace("}finally{setBusy(false)}", '}catch{setDraft("failed")}finally{setBusy(false)}');
      expect(check({ [shape + "-caught.tsx"]: caught }).diagnostics).toEqual([]);
    });
    it("keeps an opaque provider conservative alongside the known " + shape, () => {
      const opaque =
        service +
        " declare function opaque():Service;export function Other(){return <Ctx value={opaque()}><Form/></Ctx>}";
      let refused = false;
      try {
        refused = check({ [shape + "-opaque.tsx"]: opaque }).diagnostics.length > 0;
      } catch (error) {
        if (!/NATIVE_CONTEXT|SUGAR/.test(error.message)) throw error;
        refused = true;
      }
      expect(refused).toBe(true);
    });
  }
  it("preserves an explicit method receiver with a reactive argument", () => {
    const source = [
      'import {createContext,createSignal,useContext} from "solid-js";import type {Accessor} from "solid-js";',
      "interface Service{prefix:string;format(this:Service,title:string):string}const Ctx=createContext<Service>();",
      'function createService():Service{return {prefix:"hello:",format:function(this:Service,title:string){return this.prefix+title}}}',
      'function Child(){const service=useContext(Ctx);const [draft]=createSignal("draft");return <p>{service.format(draft())}</p>}',
      "export function App(){return <Ctx value={createService()}><Child/></Ctx>}"
    ].join("\n");
    const result = check({ "service-receiver.tsx": source });
    expect(result.diagnostics, result.diagnostics.join("\n")).toEqual([]);
    expect([...result.lowered.values()].join("\n")).toMatch(/this: Service/);
  });
  it("keeps unsupported colored this-member facades conservative", () => {
    const source =
      'import {createContext,createSignal,useContext} from "solid-js";import type {Accessor} from "solid-js";interface Service{prefix:Accessor<string>;format(this:Service,title:string):string}const Ctx=createContext<Service>();function createService():Service{const [prefix]=createSignal("hello:");return {prefix,format:function(this:Service,title:string){return this.prefix()+title}}}function Child(){const service=useContext(Ctx);return <p>{service.format("draft")}</p>}export function App(){return <Ctx value={createService()}><Child/></Ctx>}';
    expect(check({ "service-reactive-receiver.tsx": source }).diagnostics).toEqual([]);
    for (const [init, color] of [
      [`createMemo(() => { throw new RangeError("prefix"); })`, /RangeError/],
      [`createMemo(async () => "hello:")`, /true/]
    ]) {
      const colored = source
        .replace(`const [prefix]=createSignal("hello:");`, `const prefix=${init};`)
        .replace(
          "createContext,createSignal,useContext",
          "createContext,createSignal,useContext,createMemo,Errored,Loading"
        );
      // These receiver-sensitive facades are not fully modeled. Retain their
      // actual type error rather than accepting a color-free declaration.
      expect(check({ "service-this-colored.tsx": colored }).typeDiagnostics.join(" ")).toMatch(
        color
      );
    }
  });
  it.each([
    ["a method signature", "inc(): void"],
    ["a function property", "inc: () => void"]
  ])("provides a literal with a getter and a method beside %s", (_, contract) => {
    const source = `import {createContext, createSignal, useContext} from "solid-js";
      const Ctx = createContext<{ count: number; ${contract} }>();
      function Child() { const c = useContext(Ctx)!; return <button onClick={() => c.inc()}>{c.count}</button>; }
      export function App() { const [count, setCount] = createSignal(0);
        return <Ctx value={{ get count() { return count(); }, inc() { setCount(count() + 1); } }}><Child/></Ctx>; }`;
    const result = check({ "provider-method.tsx": source });
    expect(result.diagnostics, result.diagnostics.join("\n")).toEqual([]);
    expect([...result.lowered.values()].join("\n")).toMatch(/\*inc\(\) \{/);
  });
  it("keeps a method signature's parameters bivariant, as TypeScript checks a method", () => {
    const source = `import {createContext, useContext} from "solid-js";
      interface Animal { name: string } interface Dog extends Animal { bark(): void }
      interface Ctx { pick(a: Animal): void }
      const C = createContext<Ctx>();
      const dogPicker = { pick(d: Dog) { d.bark(); } };
      function Child() { const c = useContext(C)!; return <button onClick={() => c.pick({ name: "x" })}>go</button>; }
      export function App() { return <C value={dogPicker}><Child/></C>; }`;
    // The provider type-checks as plain TypeScript checks it (the plain
    // callback's unknown failures are reported at the handler as before).
    const result = check({ "method-bivariance.tsx": source });
    expect(result.typeDiagnostics.join("\n")).not.toMatch(
      /'bark' is missing|not assignable to type 'Ctx'/
    );
    // A function-typed property refuses it under strictFunctionTypes, as TypeScript does.
    const property = check({
      "property-contravariance.tsx": source.replace(
        "pick(a: Animal): void",
        "pick: (a: Animal) => void"
      )
    });
    expect(property.typeDiagnostics.join("\n")).toMatch(/'bark' is missing/);
  });
  it.each(["object", "class"])("keeps plain %s source getters supported", kind => {
    const receiver =
      kind === "object"
        ? "const obj = { a, get value() { return this.a(); } };"
        : "class Box { a = a; get value() { return this.a(); } } const obj = new Box();";
    const source = `import {createSignal} from "solid-js"; export function App() {
      const [a] = createSignal(1); ${receiver} return <p>{obj.value}</p>; }`;
    expect(check({ "plain-source-getter.tsx": source }).diagnostics).toEqual([]);
  });
  for (const [kind, signature, implementation, content, boundary, expected] of [
    [
      "failure",
      "read():string",
      '()=>{throw new RangeError("read")}',
      "service.read()",
      "Errored",
      /FOREIGN_HANDOFF/
    ],
    ["pending", "read():Promise<string>", 'async()=>"ready"', "value()", "Loading", /PENDING_ROOT/]
  ]) {
    const child =
      kind === "pending" ? "const value=createMemo(async()=>await service.read());" : "";
    const context =
      'import {createContext,useContext,createMemo,Errored,Loading} from "solid-js";interface Service {' +
      signature +
      "}const Ctx=createContext<Service>();function createService():Service{return {read:" +
      implementation +
      "}}function Child(){const service=useContext(Ctx);" +
      child +
      "return <p>{" +
      content +
      "}</p>}";
    it("admits a method-shaped " + kind + " contract under " + boundary, () => {
      const source =
        context +
        "export function App(){return <Ctx value={createService()}><" +
        boundary +
        " fallback={()=> <p>fallback</p>}><Child/></" +
        boundary +
        "></Ctx>}";
      expect(check({ [kind + "-boundary.tsx"]: source }).diagnostics).toEqual([]);
    });
    it("keeps the method-shaped " + kind + " obligation without " + boundary, () => {
      const source =
        context + "export function App(){return <Ctx value={createService()}><Child/></Ctx>}";
      expect(check({ [kind + "-missing.tsx"]: source }).typeDiagnostics.join("\n")).toMatch(
        expected
      );
    });
  }
});
