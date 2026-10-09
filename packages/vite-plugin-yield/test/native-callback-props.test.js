import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// F-S40: a callback prop that writes is called from the child's event, not during render.
const file = resolve(import.meta.dirname, "fixtures/native-callback-props.tsx");
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
const child = `function Row(props: {label: string; reload: () => void}) {
  return <button onClick={() => props.reload()}>{props.label}</button>;
}`;

describe("native callback props (F-S40)", { timeout: 60_000 }, () => {
  it("hosts a refreshing callback prop in the child's event", () => {
    const code = lower(`import {For, createMemo, refresh} from 'solid-js';
${child}
export function List() {
  const items = createMemo(() => ['a']);
  return <ul><For each={items()}>{label => <Row label={label} reload={() => refresh(items)}/>}</For></ul>;
}`);
    expect(code).toContain('reload: __nativeLexicalCallback("event"');
    expect(checked(code)).toEqual([]);
  });

  it("hosts a callback prop that sets a signal in the child's event", () => {
    const code = lower(`import {createSignal} from 'solid-js';
${child}
export function Counter() {
  const [n, setN] = createSignal(0);
  return <Row label={String(n())} reload={() => setN(n() + 1)}/>;
}`);
    expect(code).toContain('reload: __nativeLexicalCallback("event"');
    expect(checked(code)).toEqual([]);
  });

  it("keeps a read-only render callback prop in its hole", () => {
    const code = lower(`import {createSignal} from 'solid-js';
function Frame(props: {render: () => string}) { return <section>{props.render()}</section>; }
export function App() {
  const [n] = createSignal(1);
  return <Frame render={() => String(n())}/>;
}`);
    expect(code).not.toContain('__nativeLexicalCallback("event"');
    expect(checked(code)).toEqual([]);
  });
});
