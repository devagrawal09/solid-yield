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

const counter = `import { createContext, createSignal, useContext } from "solid-js";
  interface Counter { count: () => number; inc: () => void }
  const Ctx = createContext<Counter>();
  function makeCounter() { const [count, set] = createSignal(0);
    return { count, inc: () => set(count() + 1) }; }
  function Child() { const c = useContext(Ctx)!;
    return <button onClick={() => c.inc()}>{c.count()}</button>; }
  export function App() { return <Ctx value={makeCounter()}><Child/></Ctx>; }`;
const rejects = sources => {
  try {
    return check(sources).diagnostics.length > 0;
  } catch (error) {
    if (/\[(?:SUGAR|NATIVE|NO_PROVIDER)[A-Z_]*\]/.test(error.message)) return true;
    throw error;
  }
};

describe("typed native contexts", { timeout: 60_000 }, () => {
  const returningHelper = (awaited, callerCatch = false) => `
    async function helper(run:()=>Promise<boolean>){
      try{return ${awaited ? "await " : ""}run()}catch{return false}finally{Math.abs(1)}
    }
    export function App(){return <button onClick={async()=>{
      ${callerCatch ? "try{" : ""}
      await helper(async()=>{throw new RangeError("later")});
      ${callerCatch ? "}catch{return false}" : ""}
    }}>Run</button>}`;
  it("keeps an async helper returned Promise rejection outside its catch", () => {
    const result = check({ "returned-promise.tsx": returningHelper(false) });
    expect(result.diagnostics.join("\n")).toMatch(/EVENT_REJECTS/);
    expect(result.diagnostics.join("\n")).toMatch(/RangeError/);
    expect(result.typeDiagnostics.join("\n")).toMatch(/EVENT_REJECTS|FOREIGN_HANDOFF/);
    expect(result.typeDiagnostics.join("\n")).toMatch(/RangeError/);
    expect(
      result.inferenceDiagnostics.some(
        d => d.code === "EVENT_REJECTS" && /RangeError/.test(d.message)
      )
    ).toBe(true);
  });
  it("admits the returned Promise rejection under the caller catch", () => {
    const result = check({ "returned-caller-catch.tsx": returningHelper(false, true) });
    expect(result.diagnostics, result.diagnostics.join("\n")).toEqual([]);
  });
  it("admits return await when the helper catches the rejection", () => {
    expect(check({ "returned-await.tsx": returningHelper(true) }).diagnostics).toEqual([]);
  });
  it("still catches an ordinary synchronous callback throw", () => {
    expect(
      check({
        "returned-sync.tsx": `
      function helper(run:()=>boolean){try{return run()}catch{return false}}
      export function App(){return <button onClick={()=>{helper(()=>{throw new RangeError("now")})}}>Run</button>}
    `
      }).diagnostics
    ).toEqual([]);
  });
  it("does not catch an async callback hidden behind a void slot", () => {
    expect(
      rejects({
        "returned-erased.tsx": `
      function helper(run:()=>void){try{run()}catch{}}
      export function App(){return <button onClick={async()=>{await helper(async()=>{throw new RangeError("later")})}}>Run</button>}
    `
      })
    ).toBe(true);
  });
  it("checks explicit interfaces backed by a local factory", () => {
    expect(check({ "typed-counter.tsx": counter }).diagnostics).toEqual([]);
  });
  it("checks a known pure provider method without assuming foreign callbacks are safe", () => {
    const source = counter.replace("inc: () => set(count() + 1)", "inc: () => 42");
    expect(check({ "typed-pure.tsx": source }).diagnostics).toEqual([]);
  });
  it("does not expose a result hidden by an authored void contract", () => {
    const source = counter.replace("() => c.inc()", "() => { const n: number = c.inc(); }");
    expect(check({ "typed-void.tsx": source }).diagnostics.join("\n")).toContain(
      "Type 'void' is not assignable to type 'number'"
    );
  });
  it("does not expose the result of an authored void-returning pure method", () => {
    const source = counter
      .replace("inc: () => set(count() + 1)", "inc: () => 42")
      .replace("() => c.inc()", "() => { const n: number = c.inc(); }");
    expect(check({ "typed-pure-void.tsx": source }).diagnostics.join("\n")).toContain(
      "Type 'void' is not assignable to type 'number'"
    );
  });
  it("keeps an optional authored return value optional", () => {
    const source = counter
      .replace("inc: () => void", "inc: () => boolean | undefined")
      .replace("inc: () => set(count() + 1)", "inc: () => { set(count() + 1); return true; }")
      .replace("() => c.inc()", "() => { const n: boolean = c.inc(); }");
    expect(check({ "typed-optional.tsx": source }).diagnostics.join("\n")).toContain(
      "Type 'boolean | undefined' is not assignable to type 'boolean'"
    );
  });
  it("does not narrow an authored string result to an implementation literal", () => {
    const source = counter
      .replace("count: () => number; inc: () => void", "count: () => string; inc: () => string")
      .replace("createSignal(0)", `createSignal("ok" as const)`)
      .replace("inc: () => set(count() + 1)", "inc: () => count()")
      .replace("() => c.inc()", `() => { const narrow: "ok" = c.inc(); }`);
    expect(check({ "typed-string.tsx": source }).diagnostics.join("\n")).toContain(
      "Type 'string' is not assignable to type '\"ok\"'"
    );
  });
  it("checks an explicitly typed local provider bag", () => {
    const source = counter.replace(
      "return { count, inc: () => set(count() + 1) };",
      "const bag: Counter = { count, inc: () => set(count() + 1) }; return bag;"
    );
    expect(check({ "typed-bag.tsx": source }).diagnostics).toEqual([]);
  });
  it("checks explicit Promise methods with component-local form state", () => {
    const source = `import {createContext, createSignal, useContext} from "solid-js";
      import type {Accessor} from "solid-js";
      interface Desk { count: Accessor<number>; save: (title: string) => Promise<boolean> }
      const Ctx = createContext<Desk>();
      function makeDesk() { const [count,set] = createSignal(0);
        const bag: Desk = {count, save: async title => {
          try { await Promise.resolve(title); set(count()+1); return true; }
          catch { return false; }
        }}; return bag; }
      function Form() { const c = useContext(Ctx)!;
        const [title,setTitle] = createSignal(""); const [busy,setBusy] = createSignal(false);
        const submit = async () => { setBusy(true);
          try { if(await c.save(title())) setTitle(""); } finally { setBusy(false); }
        };
        return <form onSubmit={submit}><input value={title()}/><button disabled={busy()}>{c.count()}</button></form>; }
      export function App() { return <Ctx value={makeDesk()}><Form/></Ctx>; }`;
    expect(check({ "typed-promise.tsx": source }).diagnostics).toEqual([]);
  });
  it("checks imported interfaces and cross-file providers", () => {
    expect(
      check({
        "typed-shape.ts": `export interface Counter { count: () => number; inc: () => void }`,
        "typed-context.ts": `import { createContext } from "solid-js";
        import type { Counter } from "./typed-shape"; export const Ctx = createContext<Counter>();`,
        "typed-app.tsx": counter
          .replace(
            "interface Counter { count: () => number; inc: () => void }",
            `import { Ctx } from "./typed-context";`
          )
          .replace("const Ctx = createContext<Counter>();", "")
      }).diagnostics
    ).toEqual([]);
  });
  it("checks an imported factory with context-typed parameters", () => {
    const sources = {
      "typed-factory-shape.ts": `import type {Accessor} from "solid-js";
        export interface Counter { count: Accessor<number>; inc: (amount: number) => void }`,
      "typed-factory-context.ts": `import {createContext} from "solid-js";
        import type {Counter} from "./typed-factory-shape"; export const Ctx = createContext<Counter>();`,
      "typed-factory.ts": `import {createSignal} from "solid-js";
        import type {Counter} from "./typed-factory-shape";
        export function makeCounter() { const [count,set] = createSignal(0);
          const bag: Counter = {count, inc: amount => set(count()+amount)}; return bag; }`,
      "typed-factory-app.tsx": `import {useContext} from "solid-js";
        import {Ctx} from "./typed-factory-context"; import {makeCounter} from "./typed-factory";
        function Child() { const c = useContext(Ctx)!; return <button onClick={() => c.inc(1)}>{c.count()}</button>; }
        export function App() { return <Ctx value={makeCounter()}><Child/></Ctx>; }`
    };
    expect(check(sources).diagnostics).toEqual([]);
    expect(
      check({
        ...sources,
        "typed-factory-app.tsx": sources["typed-factory-app.tsx"].replace(
          "c.inc(1)",
          `c.inc("bad")`
        )
      }).diagnostics.join("\n")
    ).toContain("Argument of type 'string' is not assignable to parameter of type 'number'");
  });
  it("keeps an opaque provider conservative alongside a known provider", () => {
    const source =
      counter +
      `
      declare function opaque(): Counter;
      export function Other() { return <Ctx value={opaque()}><Child/></Ctx>; }`;
    expect(rejects({ "typed-opaque.tsx": source })).toBe(true);
  });
  it("does not accept a mismatched provider implementation", () => {
    expect(
      rejects({
        "typed-mismatch.tsx": counter.replace(
          "return { count, inc:",
          'return { count: () => "wrong", inc:'
        )
      })
    ).toBe(true);
  });
  it("does not narrow a bag that is later changed through an alias", () => {
    const source =
      counter.replace(
        "return { count, inc: () => set(count() + 1) };",
        `const bag: Counter = { count, inc: () => set(count() + 1) };
       const alias = bag; alias.inc = foreign; return bag;`
      ) + `declare const foreign: () => void;`;
    expect(rejects({ "typed-write.tsx": source })).toBe(true);
  });
  it("does not narrow a bag handed to an unknown function", () => {
    const source =
      counter.replace(
        "return { count, inc: () => set(count() + 1) };",
        `const bag: Counter = { count, inc: () => set(count() + 1) };
       foreign(bag); return bag;`
      ) + `declare function foreign(bag: Counter): void;`;
    expect(rejects({ "typed-escape.tsx": source })).toBe(true);
  });
  for (const [name, escape] of [
    [
      "array",
      `const escaped = [bag]; Object.defineProperty(escaped[0], "count", {value: foreign});`
    ],
    [
      "object",
      `const escaped = {bag}; Object.defineProperty(escaped.bag, "count", {value: foreign});`
    ],
    [
      "property",
      `const escaped = {value: bag}; Object.defineProperty(escaped.value, "count", {value: foreign});`
    ],
    [
      "returned array",
      `const leak = () => [bag]; Object.defineProperty(leak()[0], "count", {value: foreign});`
    ],
    [
      "returned object",
      `const leak = () => ({bag}); Object.defineProperty(leak().bag, "count", {value: foreign});`
    ],
    [
      "returned reference",
      `const leak = () => bag; Object.defineProperty(leak(), "count", {value: foreign});`
    ]
  ]) {
    it(`does not refine an unknown ${name} escape`, () => {
      const source =
        counter.replace(
          "return { count, inc: () => set(count() + 1) };",
          `const bag = { count, inc: () => set(count() + 1) }; ${escape} return bag;`
        ) + `declare const foreign: () => number;`;
      expect(rejects({ "typed-container-escape.tsx": source })).toBe(true);
    });
  }
  it("keeps unchecked callbacks conservative", () => {
    const source =
      counter.replace("inc: () => set(count() + 1)", "inc: () => foreign()") +
      `declare const foreign: () => void;`;
    expect(rejects({ "typed-callback.tsx": source })).toBe(true);
  });
  it("does not treat an opaque Accessor bag as a proved native source", () => {
    const source = `import {createContext,createSignal,useContext} from "solid-js";
      import type {Accessor} from "solid-js"; interface State {count:Accessor<number>}
      const Ctx=createContext<State>(); declare function opaque():State;
      function make(){const [count]=createSignal(0);try{return opaque()}catch{return {count}}}
      function Child(){const c=useContext(Ctx)!;return <p>{c.count()}</p>}
      export function App(){return <Ctx value={make()}><Child/></Ctx>}`;
    expect(() => check({ "typed-opaque-accessor.tsx": source })).toThrow(/\[NATIVE_CONTEXT\]/);
  });
  it("does not invent source effects after an Accessor bag escapes", () => {
    const source = `import {createContext,createSignal,useContext} from "solid-js";
      import type {Accessor} from "solid-js"; interface State {count:Accessor<number>}
      const Ctx=createContext<State>();
      function make(){const [count]=createSignal(0);const bag={count};const leaked=[bag];
        Object.defineProperty(leaked[0],"count",{value:()=>{throw new Error("lost")}});return bag}
      function Child(){const c=useContext(Ctx)!;return <p>{c.count()}</p>}
      export function App(){return <Ctx value={make()}><Child/></Ctx>}`;
    expect(() => check({ "typed-accessor-escape.tsx": source })).toThrow(/\[NATIVE_CONTEXT\]/);
  });
  const colored = (compute, boundary) => `
    import { createContext, createSignal, createMemo, useContext, Errored, Loading } from "solid-js";
    interface State { count: () => number }
    const Ctx = createContext<State>();
    function makeSafe() { const [count] = createSignal(1); return { count }; }
    function Child() { const c = useContext(Ctx)!; return <p>{c.count()}</p>; }
    function Other() { const count = createMemo(${compute});
      return <Ctx value={{count}}><Child/></Ctx>; }
    export function App() { return ${
      boundary === "Errored"
        ? `<Errored fallback={() => <p>failed</p>}>`
        : boundary === "Loading"
          ? `<Loading fallback={<p>loading</p>}>`
          : "<>"
    }
      <Ctx value={makeSafe()}><Child/></Ctx><Other/>
      ${boundary ? `</${boundary}>` : "</>"}; }`;
  it("admits failing sources from multiple providers under Errored", () => {
    expect(
      check({
        "typed-failing-safe.tsx": colored(`() => { throw new Error("broken"); }`, "Errored")
      }).diagnostics
    ).toEqual([]);
  });
  it("keeps the failure obligation without Errored", () => {
    const result = check({
      "typed-failing.tsx": colored(`() => { throw new Error("broken"); }`, "")
    });
    expect(result.diagnostics.join("\n")).toContain("[FOREIGN_HANDOFF]");
    expect(result.diagnostics.join("\n")).toContain("global:Error");
  });
  it("admits pending sources from multiple providers under Loading", () => {
    expect(
      check({ "typed-pending-safe.tsx": colored(`async () => 1`, "Loading") }).diagnostics
    ).toEqual([]);
  });
  it("keeps the pending obligation without Loading", () => {
    const result = check({ "typed-pending.tsx": colored(`async () => 1`, "") });
    expect(result.diagnostics.join("\n")).toMatch(/PENDING|[Pp]ending/);
  });
  it("keeps the provider requirement", () => {
    const source = counter.replace("<Ctx value={makeCounter()}><Child/></Ctx>", "<Child/>");
    expect(check({ "typed-required.tsx": source }).diagnostics.join("\n")).toContain(
      "[NO_PROVIDER]"
    );
  });
});
