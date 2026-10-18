import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

const root = resolve(import.meta.dirname, "fixtures");
const check = sources => {
  const files = new Map(Object.entries(sources).map(([name, code]) => [resolve(root, name), code]));
  const result = lowerNativeProject(files);
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
    read = host.readFile,
    exists = host.fileExists;
  host.readFile = file => result.files.get(file) ?? read(file);
  host.fileExists = file => result.files.has(file) || exists(file);
  const diagnostics = ts
    .getPreEmitDiagnostics(ts.createProgram([...files.keys()], options, host))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  return {
    files: result.files,
    inferenceDiagnostics: result.inference.diagnostics,
    diagnostics: [
      ...diagnostics,
      ...result.inference.diagnostics.map(d => `[${d.code}] ${d.message}`)
    ]
  };
};
const text = sources => {
  try {
    return check(sources).diagnostics.join("\n");
  } catch (error) {
    return error.message;
  }
};

describe("declared native factory results", { timeout: 60_000 }, () => {
  const source = `import {createSignal} from "solid-js";
    interface Service { save(value: number): Promise<boolean>; }
    export function make(): Service { const [, set] = createSignal(0);
      async function commit(value: number): Promise<boolean> { set(value); return true; }
      return { save: (value: number) => commit(value) };
    }`;
  it("keeps an explicit interface and factory annotation without an API or context", () => {
    const result = check({ "service.ts": source });
    expect(result.diagnostics).toEqual([]);
    expect(result.files.get(resolve(root, "service.ts"))).toContain("interface Service");
  });
  it("keeps discriminated async results checked and narrow", () => {
    expect(
      check({
        "result.ts": source
          .replace(
            "interface Service",
            "type Result = {ok:true} | {ok:false; message:string}; interface Service"
          )
          .replaceAll("Promise<boolean>", "Promise<Result>")
          .replace("return true", "return {ok:true}")
      }).diagnostics
    ).toEqual([]);
  });
  it("keeps declared broad results and ordinary fields broad", () => {
    const code =
      source
        .replace(
          "save(value: number): Promise<boolean>;",
          "label: string; save(value: number): Promise<string>;"
        )
        .replace(
          "Promise<boolean> { set(value); return true; }",
          'Promise<string> { set(value); return "ok"; }'
        )
        .replace("return { save:", 'return { label: "ready", save:') +
      `
      export function App(){const service=make();return <button onClick={async()=>{
        const result: "ok" = await service.save(1); const label: "ready" = service.label;
        console.log(result,label);}}/>;}`;
    const diagnostics = check({ "broad.tsx": code }).diagnostics;
    expect(diagnostics.filter(d => /not assignable to type '"(?:ok|ready)"'/.test(d))).toHaveLength(
      2
    );
  });
  it("retains readonly function properties", () => {
    const code =
      source.replace(
        "save(value: number): Promise<boolean>;",
        "readonly save: (value: number) => Promise<boolean>;"
      ) +
      `
      export function App(){const service=make();
        return <button onClick={()=>{service.save=async()=>true;}}/>;}`;
    expect(check({ "readonly.tsx": code }).diagnostics.join("\n")).toMatch(/read-only property/);
  });
  it("retains readonly introduced by a mapped contract", () => {
    const code =
      source.replace("make(): Service", "make(): Readonly<Service>") +
      `
      export function App(){const service=make();
        return <button onClick={()=>{service.save=async()=>true;}}/>;}`;
    expect(check({ "mapped-readonly.tsx": code }).diagnostics.join("\n")).toMatch(
      /read-only property/
    );
  });
  it("rejects a wrong authored result", () => {
    expect(text({ "bad-result.ts": source.replace("return true", 'return "wrong"') })).toMatch(
      /string|boolean/
    );
    expect(
      check({ "bad-result.ts": source.replace("return true", 'return "wrong"') }).diagnostics.length
    ).toBeGreaterThan(0);
  });
  it("rejects incompatible method arguments", () => {
    expect(
      check({
        "bad-argument.ts": source.replace(
          "save: (value: number) => commit(value)",
          "save: (value: string) => commit(Number(value))"
        )
      }).diagnostics.join("\n")
    ).toMatch(/string|number/);
  });
  it("keeps a bad caller argument visible", () => {
    expect(
      check({
        "caller.tsx":
          source +
          `
      export function App(){ const service=make();
        return <button onClick={async()=>{ await service.save("wrong"); }}/>; }`
      }).diagnostics.join("\n")
    ).toContain("string");
  });
  it("does not erase an owned method's failure", () => {
    const result = check({
      "failure.tsx":
        source.replace("return true", 'throw new RangeError("failed")') +
        `
      export function App(){const service=make();return <button onClick={async()=>{await service.save(1)}}/>;}`
    });
    expect(result.diagnostics.join("\n")).toMatch(/EVENT_REJECTS[^]*RangeError/);
  });
  it.each(["unknown", "mixed", "escaped"])("does not certify a %s provider", mode => {
    const code = `import{createContext,createSignal,useContext}from"solid-js";
      import type{Accessor}from"solid-js";
      interface Service{count:Accessor<number>;save():Promise<boolean>}
      const Ctx=createContext<Service>(); declare const foreign:Service;
      declare function consume(service:Service):void;
      function make():Service{const[count,set]=createSignal(0);
        async function commit():Promise<boolean>{set(1);return true;}return{count,save:()=>commit()};}
      function Child(){const service=useContext(Ctx);return <button onClick={async()=>{await service.save()}}>{service.count()}</button>;}
      export function App(){const service=make();${mode === "escaped" ? "consume(service);" : ""}
        return <Ctx value={${mode === "unknown" ? "foreign" : "service"}}><Child/></Ctx>;}
      ${mode === "mixed" ? "export function Other(){return <Ctx value={foreign}><Child/></Ctx>}" : ""}`;
    expect(text({ "provider.tsx": code })).toMatch(/NATIVE_CONTEXT|FOREIGN_HANDOFF|EVENT_REJECTS/);
  });
});

describe("known callback effects across component imports", { timeout: 60_000 }, () => {
  const row = `import{createMemo}from"solid-js";
    export function Row(props:{id:string;onSelect:(id:string)=>void}){
      const item=createMemo(()=>props.id);return <button onClick={()=>props.onSelect(props.id)}>{item()}</button>;}`;
  const inventory = `import{Row}from"./Row";export function Inventory(props:{onSelect:(id:string)=>void}){
    return <Row id="camera" onSelect={props.onSelect}/>;}`;
  const app = callback => `import{createSignal}from"solid-js";import{Inventory}from"./Inventory";
    import{render}from"@solidjs/web";declare function foreignCallback(id:string):void;
    function App(){const[,set]=createSignal("");return <Inventory onSelect={${callback}}/>;}render(App,document.body);`;
  const sources = callback => ({
    "Row.tsx": row,
    "Inventory.tsx": inventory,
    "App.tsx": app(callback)
  });
  it("follows the same signal setter through three files", () => {
    expect(check(sources("set")).diagnostics).toEqual([]);
  });
  it("retains a known failing callback", () => {
    expect(check(sources('()=>{throw new RangeError("failed")}')).diagnostics.join("\n")).toMatch(
      /EVENT_REJECTS[^]*RangeError/
    );
  });
  it.each(["foreignCallback", "Math.random()>0.5?set:foreignCallback"])(
    "retains an unknown or mixed callback: %s",
    callback => {
      expect(check(sources(callback)).diagnostics.join("\n")).toMatch(/EVENT_REJECTS[^]*unknown/);
    }
  );
  it("does not prove all callers after a component escapes", () => {
    const input = sources("set");
    input["App.tsx"] +=
      "declare function consume(component:typeof Inventory):void;consume(Inventory);";
    expect(check(input).diagnostics.join("\n")).toMatch(/EVENT_REJECTS[^]*unknown/);
  });
  it.each(["Widgets.Inventory", "Widgets", "Widgets[key]"])(
    "retains callback obligations when a namespace import escapes: %s",
    escaped => {
      const input = sources("set");
      input["App.tsx"] += `
        import * as Widgets from "./Inventory";
        declare const key: "Inventory";
        declare function consume(component: unknown): void;
        function handoff() { try { consume(${escaped}); return true; } catch { return false; } }
        handoff();`;
      const result = check(input);
      expect(
        result.inferenceDiagnostics.some(
          d =>
            d.file.endsWith("Row.tsx") &&
            d.code === "EVENT_REJECTS" &&
            d.message.includes("unknown")
        )
      ).toBe(true);
    }
  );
  it("retains obligations when an exported namespace alias escapes", () => {
    const input = sources("set");
    input["Barrel.ts"] = 'export * as Widgets from "./Inventory";';
    input["App.tsx"] += `import {Widgets} from "./Barrel";
      declare function consume(component: unknown): void;
      function handoff() { try { consume(Widgets.Inventory); return true; } catch { return false; } }
      handoff();`;
    expect(
      check(input).inferenceDiagnostics.some(
        d =>
          d.file.endsWith("Row.tsx") && d.code === "EVENT_REJECTS" && d.message.includes("unknown")
      )
    ).toBe(true);
  });
  it("does not confuse an unrelated namespace member with a component escape", () => {
    const input = sources("set");
    input["Inventory.tsx"] += 'export const label = "inventory";';
    input["App.tsx"] += 'import * as Widgets from "./Inventory"; const label = Widgets.label;';
    expect(check(input).diagnostics).toEqual([]);
  });
});

describe("factory accessor descriptor stability", { timeout: 60_000 }, () => {
  const make = mutation => `import {createSignal} from "solid-js";
    declare function mutate(value:{count:()=>number}):void;
    function make(){const[count]=createSignal(0);const bag={count};${mutation}return bag;}
    export function App(){const service=make();const read=service.count;return <p>ready</p>;}`;
  const ordinary = source => {
    const file = resolve(root, "descriptor-original.tsx");
    const options = {
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
    const host = ts.createCompilerHost(options),
      read = host.readFile;
    host.readFile = name => (name === file ? source : read(name));
    return ts
      .getPreEmitDiagnostics(ts.createProgram([file], options, host))
      .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  };
  it("preserves a clean factory's accessor without reading it in setup", () => {
    const source = make("");
    expect(ordinary(source)).toEqual([]);
    expect(check({ "descriptor-clean.tsx": source }).diagnostics).toEqual([]);
  });
  it("permits observing an own data property without executing a getter", () => {
    const source = make("void bag.count;");
    expect(ordinary(source)).toEqual([]);
    expect(check({ "descriptor-data.tsx": source }).diagnostics).toEqual([]);
  });
  it.each(["void bag.arm;", "const {arm}=bag;"])(
    "does not trust a getter observation to leave descriptors unchanged: %s",
    observation => {
      const source = make(observation).replace(
        "const bag={count};",
        'const bag={count,get arm(){Object.defineProperty(this,"count",{get(){throw new RangeError("descriptor")}});return 0}};'
      );
      expect(ordinary(source)).toEqual([]);
      expect(() => check({ "descriptor-getter-observation.tsx": source })).toThrow(
        /NATIVE_ACCESSOR_DESCRIPTOR/
      );
    }
  );
  it.each([
    'Object.defineProperty(bag,"count",{get(){throw new RangeError("descriptor")}});',
    'const alias=bag;Object.defineProperty(alias,"count",{get(){throw new RangeError("descriptor")}});',
    "try{mutate(bag)}catch{};"
  ])("does not turn an unstable descriptor into a silent accessor extraction: %s", mutation => {
    const source = make(mutation);
    expect(ordinary(source)).toEqual([]);
    expect(() => check({ "descriptor-unsafe.tsx": source })).toThrow(/NATIVE_ACCESSOR_DESCRIPTOR/);
  });
});
