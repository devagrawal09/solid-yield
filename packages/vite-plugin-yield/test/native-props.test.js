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
    expect(code).toMatch(/function\* Body<_E_item, _P_item extends boolean, _R = never>/);
    expect(code).toContain("item: __NativeSource<{");
    expect(checked(code)).toEqual([]);
  });

  it("leaves a prop that only ever receives constants as declared; a live ready value widens it (D-126)", () => {
    const held = lower(`${head}
function Label(props: {text: string}) { return <b>{props.text}</b>; }
export function App() { const label = 'a'; return <Label text={label}/>; }`).code;
    expect(held).not.toContain("__NativeSource");
    expect(held).toContain("<b>{props.text}</b>");
    expect(checked(held)).toEqual([]);
    // A signal read is live even when it never waits or fails: Solid reads the
    // prop where it is named, so the prop is a source with no colors of its own.
    const { code } = lower(`${head}
function Label(props: {text: string}) { return <b>{props.text}</b>; }
export function App() { const [n] = createSignal('a'); return <Label text={n()}/>; }`);
    expect(code).toContain("text: __NativeSource<string, _E_text, _P_text>;");
    expect(code).toContain("<b>{yield* props.text}</b>");
    expect(checked(code)).toEqual([]);
  });

  it.each([
    ["inline", "return <Body {...{ get value() { return n(); }, label: 'x' }} />;"],
    [
      "named",
      "const props = { get value() { return n(); }, label: 'x' }; return <Body {...props} />;"
    ]
  ])("widens reactive getter props from %s spreads", (_, body) => {
    const { result, code } = lower(`${head}
function Body(props: {value: number; label: string}) { return <p>{props.value}{props.label}</p>; }
export function App() { const [n] = createSignal(1); ${body} }`);
    expect(result.diagnostics).toEqual([]);
    expect(code).toContain("value: __NativeSource<number, _E_value, _P_value>;");
    expect(code).toContain("label: string;");
    expect(code).toContain("yield* props.value");
    expect(checked(code)).toEqual([]);
  });

  it("keeps constant getters and overridden getter props held", () => {
    const { code } = lower(`${head}
function Body(props: {value: number}) { return <p>{props.value}</p>; }
export function App() {
  const [n] = createSignal(1);
  return <>
    <Body {...{ get value() { return 2; } }} />
    <Body {...{ get value() { return n(); } }} value={3} />
  </>;
}`);
    expect(code).not.toContain("__NativeSource");
    expect(checked(code)).toEqual([]);
  });

  it("keeps compatible callbacks held while widening another spread prop", () => {
    const { code } = lower(`${head}
function Body(props: {value: number; iterate: () => unknown}) { return <p>{props.value}</p>; }
export function App() { const [n] = createSignal(1); return <Body {...{ get iterate() { return function* () { return 'ok'; }; }, get value() { return n(); } }} />; }`);
    expect(code).not.toContain("iterate: __NativeSource");
    expect(checked(code)).toEqual([]);
  });

  it.each([
    ["literal", "", '{ "data-value": number }'],
    ["interface", 'interface Values { "data-value": number }', "Values"]
  ])("preserves quoted getter keys in a props %s", (_, declaration, type) => {
    const { code } = lower(`${head}
${declaration}
function Body(props: ${type}) { return <p>{props["data-value"]}</p>; }
export function App() { const [n] = createSignal(1); return <Body {...{ get "data-value"() { return n(); } }} />; }`);
    expect(code).toContain("__NativeSource<");
    expect(checked(code)).toEqual([]);
  });

  it("keeps pending and failing getter spreads visible to boundaries and roots", () => {
    const child = "<Body {...{ get item() { return item(); } }} />";
    const source = `${head}
import {render} from '@solidjs/web';
function Body(props: {item: {title: string}}) { return <h2>{props.item.title}</h2>; }
export function App() {
  const item = createMemo(async () => {
    if (Math.random() > 0.5) throw new RangeError('bad');
    return {title: 'ok'};
  });
  return ${child};
}
render(() => <App/>, document.body);`;
    const errors = checked(lower(source).code);
    expect(errors.some(e => e.includes("HELD_PROP"))).toBe(false);
    expect(errors.some(e => e.includes("PENDING_ROOT"))).toBe(true);
    expect(errors.some(e => e.includes("RangeError"))).toBe(true);
    const covered = source.replace(
      child,
      `<Errored fallback={() => <p>failed</p>}><Loading fallback={<p>loading</p>}>${child}</Loading></Errored>`
    );
    expect(checked(lower(covered).code)).toEqual([]);
  });

  it("does not hide an incompatible value supplied by a reactive getter", () => {
    const { code } = lower(`${head}
function Body(props: {value: number}) { return <p>{props.value}</p>; }
export function App() { const [text] = createSignal('wrong'); return <Body {...{ get value() { return text(); } }} />; }`);
    const errors = checked(code);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes("string") && e.includes("number"))).toBe(true);
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
    expect(code).toMatch(/function\* Panel<_E_children, _P_children extends boolean, _R = never>/);
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
    expect(code).toMatch(/function\* Middle<_E_item, _P_item extends boolean, _R = never>/);
    expect(code).toMatch(/function\* Inner<_E_item, _P_item extends boolean, _R = never>/);
    expect(checked(code)).toEqual([]);
  });

  it("still reports a pending value that no boundary covers, at the root", () => {
    const { code } = lower(`${head}
import {render} from '@solidjs/web';
function Body(props: {item: {title: string}}) { return <h2>{props.item.title}</h2>; }
export function App() { const item = createMemo(() => load('a')); return <Body item={item()}/>; }
render(() => <App/>, document.body);`);
    const errors = checked(code);
    expect(errors.some(e => /SETTLED_PROP|HELD_PROP|REACTIVE_PROP/.test(e))).toBe(false);
    expect(errors.some(e => e.includes("PENDING_ROOT"))).toBe(true);
  });
});
