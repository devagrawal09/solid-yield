import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// A promise an async routine keeps as a value is a promise in the original:
// the lowering must not await it where it is made (found by the mutation
// corpus's rendering-edges seed: an `await` removed in a derived store).
const file = resolve(import.meta.dirname, "fixtures/native-promises.tsx");
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
const start = `import { createMemo, createSignal } from "solid-js";
async function load(n: number): Promise<{ title: string }> { return { title: \`t\${n}\` }; }`;

describe("native kept promises", { timeout: 60_000 }, () => {
  it("keeps an un-awaited promise a promise, so reading through it is an error", () => {
    const code = lower(`${start}
export function View() {
  const [n] = createSignal(1);
  const title = createMemo(async () => {
    const data = load(n());
    return data.title;
  });
  return <p>{title()}</p>;
}`);
    expect(code).toMatch(/return _callee\(_argument\);/);
    expect(checked(code).join("\n")).toMatch(/'title' does not exist on type 'Promise/);
  });

  it("awaits a kept promise where the code awaits it", () => {
    const code = lower(`${start}
export function View() {
  const [n] = createSignal(1);
  const title = createMemo(async () => {
    const pending = load(n());
    const data = await pending;
    return data.title;
  });
  return <p>{title()}</p>;
}`);
    expect(code).toMatch(/const data = yield\* __nativeAttempt\(\(\) => pending/);
    expect(checked(code)).toEqual([]);
  });

  it("still attempts an awaited call where it is made", () => {
    const code = lower(`${start}
export function View() {
  const [n] = createSignal(1);
  const title = createMemo(async () => (await load(n())).title);
  return <p>{title()}</p>;
}`);
    expect(code).toContain("__nativeAttempt(() => _callee(_argument)");
    expect(checked(code)).toEqual([]);
  });
});
