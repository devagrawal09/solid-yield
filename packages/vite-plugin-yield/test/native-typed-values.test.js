import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// Value types the author declared survive the lowering (Rendering's
// ErrorStream and Reveal): a memo's `createMemo<T>`, and a helper's declared
// `Promise<T>` once it becomes a routine.
const file = resolve(import.meta.dirname, "fixtures/native-typed-values.tsx");
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
const loader = `import {createMemo, createSignal, Errored, Loading} from 'solid-js';
interface Item { title: string }
function loadItem(id: string): Promise<Item> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id !== "1") { reject(new Error(\`Item \${id} not found\`)); return; }
      resolve({ title: "Test Item" });
    }, 10);
  });
}`;

describe("native typed values", { timeout: 60_000 }, () => {
  it("a helper's declared Promise<T> types the attempt that wraps its value", () => {
    const code = lower(`${loader}
export function Item() {
  const [id, setId] = createSignal("1");
  const item = createMemo(async () => loadItem(id()));
  return <Errored fallback="!"><Loading><p>{item().title}</p><button onClick={() => setId("2")}/></Loading></Errored>;
}`);
    expect(code).toContain("__nativeAttempt((): Promise<Item> => new Promise(");
    expect(checked(code)).toEqual([]);
  });

  it("createMemo<T> keeps T as the memo's value, checked as Solid checks it", () => {
    const code = lower(`${loader}
export function Item() {
  const [id] = createSignal("1");
  const item = createMemo<Item>(async () => loadItem(id()));
  const names = createMemo<string[]>(() => []);
  return <Errored fallback="!"><Loading><p>{item().title}{String(names().includes("a"))}</p></Loading></Errored>;
}`);
    expect(code).not.toMatch(/createMemo<|\$memo</);
    expect(code).toContain("satisfies Item as Item");
    expect(code).toContain("satisfies string[] as string[]");
    expect(checked(code)).toEqual([]);
  });

  it("a value that does not satisfy createMemo<T> is still refused", () => {
    const code = lower(`import {createMemo} from 'solid-js';
export function Count() {
  const n = createMemo<number>(() => "one" as string);
  return <p>{n()}</p>;
}`);
    expect(checked(code).join("\n")).toMatch(/not assignable|does not satisfy/);
  });

  it("an Errored fallback's reset fails nothing", () => {
    const code = lower(`${loader}
export function Item() {
  const [id, setId] = createSignal("1");
  const item = createMemo<Item>(async () => loadItem(id()));
  return <Loading><Errored fallback={(error, reset) => <button onClick={() => { setId("1"); reset(); }}>{String(error())}</button>}><p>{item().title}</p></Errored></Loading>;
}`);
    expect(code).toMatch(/\breset\(\);/);
    expect(code).not.toContain("__nativeAttempt(() => reset()");
    expect(checked(code)).toEqual([]);
  });

  it("a routine captured as a callee before its arguments is not an escape", () => {
    // The async memo evaluates loadItem, then its argument, in source order.
    const code = lower(`${loader}
export function Item() {
  const [id] = createSignal("1");
  const item = createMemo(async () => loadItem(id()));
  return <Errored fallback="!"><Loading><p>{item().title}</p></Loading></Errored>;
}`);
    expect(code).toMatch(/const _callee = loadItem;/);
    expect(code).toMatch(/yield\* _callee\(_argument\)/);
  });
});
