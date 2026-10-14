import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// A call that may fail, made in a JSX hole (`<p>{format(name())}</p>`): its
// attempt is the hole's (`nativeHole`), so its failure is a failing read of
// the view — the Errored above takes it, a root without one reports it, an
// exported component hands it to its callers. Before, the attempt sat in the
// view itself, which cannot raise: GENERATED_TYPE for every such call.
// And values typed `any`: TypeScript leaves their members unchecked, and so
// does the model.
const file = resolve(import.meta.dirname, "fixtures/native-hole-failures.tsx");
const checked = code => {
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "solid-yield",
    types: [],
    lib: ["lib.esnext.d.ts", "lib.dom.d.ts"]
  };
  const host = ts.createCompilerHost(options),
    read = host.readFile;
  host.readFile = path => (path === file ? code : read(path));
  return ts
    .getPreEmitDiagnostics(ts.createProgram([file], options, host))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
};
const lower = source => {
  const result = lowerNativeProject(new Map([[file, source]]));
  expect(result.diagnostics).toEqual([]);
  return result.files.get(file);
};
const component = `import { createSignal, Errored } from "solid-js";
import { render } from "@solidjs/web";
function format(s: string) {
  if (!s) throw new RangeError("empty");
  return s.trim();
}
function Name() {
  const [name] = createSignal("a");
  return <p title={format(name())}>{format(name())}</p>;
}`;

describe("a call that may fail in a JSX hole", { timeout: 60_000 }, () => {
  it("is the hole's: an Errored above takes its failure", () => {
    const code = lower(`${component}
render(() => <Errored fallback={e => <p>{String(e())}</p>}><Name /></Errored>, document.body);`);
    expect(code).toMatch(/\{yield\* __nativeHole\(function\* \(\) \{/);
    expect(code).toMatch(/title=\{yield\* __nativeHole\(/);
    expect(checked(code)).toEqual([]);
  });

  it("with no Errored above, the root reports it", () => {
    const code = lower(`${component}
render(() => <Name />, document.body);`);
    expect(checked(code).join("\n")).toMatch(/global:RangeError/);
  });

  it("an exported component hands it to its callers", () => {
    const code = lower(component.replace("function Name", "export function Name"));
    expect(checked(code)).toEqual([]);
  });

  it("in a row of a list, the row's view carries it", () => {
    const code = lower(`import { createSignal, For } from "solid-js";
declare function format(s: string): string;
export function Names() {
  const [rows] = createSignal<{ name: string }[]>([]);
  return <ul><For each={rows()}>{row => <li>{format(row.name)}</li>}</For></ul>;
}`);
    expect(code).toContain("__nativeHole(");
    expect(checked(code)).toEqual([]);
  });
});

describe("values typed `any`", { timeout: 60_000 }, () => {
  it("a context's, a store's, a signal's and a memo's members are unchecked", () => {
    const code =
      lower(`import { createContext, createMemo, createSignal, createStore, For, useContext } from "solid-js";
const Settings = createContext<any>({ theme: "dark" });
export function Any() {
  const [user] = createSignal<any>({ name: "a", tags: ["x"] });
  const [state] = createStore<any>({ rows: [{ name: "r" }] });
  const settings = useContext(Settings);
  const first = createMemo(() => user().tags[0]);
  return (
    <section class={settings.theme}>
      <p>{first()}</p>
      <For each={state.rows}>{row => <i>{row.name}</i>}</For>
    </section>
  );
}`);
    expect(code).toContain("const settings = yield* __nativeUseContext(Settings)");
    expect(code).toContain("class={settings.theme}");
    expect(code).toContain("(yield* state).rows");
    expect(code).toContain("(yield* row).name");
    expect(checked(code)).toEqual([]);
  });

  it("a method of `any` is outside code: its failures are unknown", () => {
    const code = lower(`import { createSignal } from "solid-js";
import { render } from "@solidjs/web";
function Shout() {
  const [user] = createSignal<any>({ name: "a" });
  return <p>{user().name.toUpperCase()}</p>;
}
render(() => <Shout />, document.body);`);
    expect(code).toContain("__nativeInvoke(");
    expect(checked(code).join("\n")).toMatch(/unknown/);
  });

  it("read in a callback a plain function is given, it is refused there, as a typed read is", () => {
    expect(() =>
      lowerNativeProject(
        new Map([
          [
            file,
            `import { createStore } from "solid-js";
const once = (fn: () => any) => { let last: any; return () => (last ??= fn()); };
export function Count() {
  const [rows] = createStore<any>({ items: [1] });
  const count = once(() => rows.items.length);
  return <p>{count()}</p>;
}`
          ]
        ])
      )
    ).toThrow(/SUGAR_CALLBACK.*:5:28/);
  });

  it("a prop of `any` is still refused: it could hide a colored source", () => {
    const code = lower(`function Row(props: any) { return <li>{props.name}</li>; }
export function List() { return <ul><Row name="a" /></ul>; }`);
    // `DeclareProp` is [PROP_TYPE]'s type, which `solid-yield check` prints
    expect(checked(code).join("\n")).toMatch(/DeclareProp/);
  });
});

describe("a promise given to For", { timeout: 60_000 }, () => {
  const list = each => `import { createMemo, For } from "solid-js";
declare function load(): Promise<string[]>;
const once = <T,>(fn: () => T) => { let last: { value: T } | undefined; return () => (last ??= { value: fn() }).value; };
export function Names() {
  const cached = once(() => load());
  const loaded = createMemo(() => load());
  return <ul><For each={${each}}>{name => <li>{name.length}</li>}</For></ul>;
}`;
  it("is the promise itself, as Solid's For takes it: refused, not awaited", () => {
    const code = lower(list("cached()"));
    expect(code).toMatch(/__nativeAttempt\(\(\) => \(\{\s*value: cached\(\)\s*\}\)/);
    expect(checked(code).join("\n")).toMatch(/FOR_EACH/);
  });

  it("read through a memo, it is the memo's value", () => {
    expect(checked(lower(list("loaded()")))).toEqual([]);
  });
});
