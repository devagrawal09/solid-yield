import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// D-119: a plain-typed prop takes the colors its callers pass; their boundaries cover them.
const file = resolve(import.meta.dirname, "fixtures/native-props.tsx");
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
  return { result, code: result.files.get(file) };
};
const head = `import {createMemo, createSignal, Errored, Loading, type Accessor} from 'solid-js';
import type {JSX} from '@solidjs/web';
declare function load(id: string): Promise<{title: string}>;`;

describe("native props carry their callers' colors (D-119)", { timeout: 60_000 }, () => {
  it("accepts a pending, failing value in a plain prop inside the caller's boundaries", () => {
    const { result, code } = lower(`${head}
function Body(props: {item: {title: string}}) { return <h2>{props.item.title}</h2>; }
export function Detail(props: {id: string}) {
  const item = createMemo(() => load(props.id));
  return <Errored fallback={() => <p>failed</p>}><Loading fallback={<p>…</p>}><Body item={item()}/></Loading></Errored>;
}`);
    expect(result.diagnostics).toEqual([]);
    expect(code).toMatch(/function\* Body<_E_item, _P_item extends boolean>/);
    expect(code).toContain("item: __NativeSource<{");
    expect(checked(code)).toEqual([]);
  });

  it("leaves a prop that only ever receives ready values as declared", () => {
    const { code } = lower(`${head}
function Label(props: {text: string}) { return <b>{props.text}</b>; }
export function App() { const [n] = createSignal('a'); return <Label text={n()}/>; }`);
    expect(code).not.toContain("__NativeSource");
    expect(checked(code)).toEqual([]);
  });

  it("lets a wrapper's own boundaries cover pending children that bind events", () => {
    const { code } = lower(`${head}
function Panel(props: {title: string; children: JSX.Element}) {
  return <section><Errored fallback={() => <p>failed</p>}><Loading fallback={<p>…</p>}>{props.children}</Loading></Errored></section>;
}
export function App() {
  const item = createMemo(() => load('a'));
  const [n, setN] = createSignal(0);
  return <Panel title="t"><button onClick={() => setN(n() + 1)}>{item().title}</button></Panel>;
}`);
    expect(code).toMatch(/function\* Panel<_E_children, _P_children extends boolean>/);
    expect(checked(code)).toEqual([]);
  });

  it("widens a forwarding chain down to the component that reads it", () => {
    const { code } = lower(`${head}
function Inner(props: {item: {title: string}}) { return <h2>{props.item.title}</h2>; }
function Middle(props: {item: {title: string}}) { return <div><Inner item={props.item}/></div>; }
export function App() {
  const item = createMemo(() => load('a'));
  return <Errored fallback={() => <p>failed</p>}><Loading fallback={<p>…</p>}><Middle item={item()}/></Loading></Errored>;
}`);
    expect(code).toMatch(/function\* Middle<_E_item, _P_item extends boolean>/);
    expect(code).toMatch(/function\* Inner<_E_item, _P_item extends boolean>/);
    expect(checked(code)).toEqual([]);
  });

  it("still reports a pending value that no boundary covers, at the root", () => {
    const { code } = lower(`${head}
import {render} from '@solidjs/web';
function Body(props: {item: {title: string}}) { return <h2>{props.item.title}</h2>; }
export function App() { const item = createMemo(() => load('a')); return <Body item={item()}/>; }
render(() => <App/>, document.body);`);
    const errors = checked(code);
    expect(errors.some(e => e.includes("SETTLED_PROP"))).toBe(false);
    expect(errors.some(e => e.includes("PENDING_ROOT"))).toBe(true);
  });
});
