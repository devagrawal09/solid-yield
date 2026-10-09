import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// F-S42: an effect function's returned cleanup is the library's $cleanup.
const file = resolve(import.meta.dirname, "fixtures/native-effect-cleanup.tsx");
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

describe("native effect cleanup returns (F-S42)", { timeout: 60_000 }, () => {
  it("registers a returned cleanup from a block body and an expression body", () => {
    const code = lower(`import {createEffect, createMemo, refresh} from 'solid-js';
export function Panel() {
  const summary = createMemo(() => 1);
  createEffect(() => {}, () => {
    const timer = setInterval(() => refresh(summary), 1000);
    return () => clearInterval(timer);
  });
  createEffect(() => summary(), value => () => console.log('cleanup', value));
  return <p>{summary()}</p>;
}`);
    expect(code).toContain("$cleanup as _onCleanup");
    expect(code.match(/yield\* _onCleanup\(_cleanup\d*\)/g)).toHaveLength(2);
    expect(checked(code)).toEqual([]);
  });

  it("uses an existing onCleanup import and leaves an effect without a return alone", () => {
    const code = lower(`import {createEffect, createSignal, onCleanup} from 'solid-js';
export function Clock() {
  const [n, setN] = createSignal(0);
  createEffect(() => n(), () => { onCleanup(() => {}); });
  createEffect(() => n(), () => { const t = setTimeout(() => setN(1), 5); return () => clearTimeout(t); });
  return <p>{n()}</p>;
}`);
    expect(code).not.toContain("_onCleanup");
    expect(code).toMatch(/yield\* onCleanup\(_cleanup\)/);
    expect(checked(code)).toEqual([]);
  });
});
