import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// F-S46: a lexical callback that runs in its own host colors that host.
// F-S44: a hole callback may build JSX with child components.
const file = resolve(import.meta.dirname, "fixtures/native-callback-colors.tsx");
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
const failing = `import {createSignal, createMemo, Errored} from 'solid-js';
import {render} from '@solidjs/web';`;

describe("native callback colors (F-S46)", { timeout: 60_000 }, () => {
  it("a failing read inside a hole's .map reaches the root", () => {
    const code = lower(`${failing}
export function List() {
  const [items] = createSignal(['a', 'b']);
  const bad = createMemo(() => { if (items().length > 5) throw new RangeError('too many'); return 1; });
  return <ul>{items().map(item => <li>{item}{bad()}</li>)}</ul>;
}
render(() => <List/>, document.body);`);
    expect(code).toContain('yield* __nativeHoleColors(__nativeLexicalCallback("hole"');
    expect(checked(code).join("\n")).toMatch(/\[FOREIGN_HANDOFF\][^]*global:RangeError/);
  });

  it("the same read under Errored is handled", () => {
    const code = lower(`${failing}
export function List() {
  const [items] = createSignal(['a', 'b']);
  const bad = createMemo(() => { if (items().length > 5) throw new RangeError('too many'); return 1; });
  return <Errored fallback="!"><ul>{items().map(item => <li>{item}{bad()}</li>)}</ul></Errored>;
}
render(() => <List/>, document.body);`);
    expect(checked(code)).toEqual([]);
  });

  it("a throw inside a hole callback is the hole's failure", () => {
    const code = lower(`${failing}
export function List() {
  const [items] = createSignal(['a', 'b']);
  return <ul>{items().map(item => { if (!item) throw new TypeError('empty'); return <li>{item}</li>; })}</ul>;
}
render(() => <List/>, document.body);`);
    expect(checked(code).join("\n")).toMatch(/\[FOREIGN_HANDOFF\][^]*global:TypeError/);
  });

  it("a pending read inside a memo's .filter callback makes the memo pending", () => {
    const code = lower(`import {createSignal, createMemo, Loading} from 'solid-js';
import {render} from '@solidjs/web';
export function List() {
  const [items] = createSignal(['a', 'b']);
  const allowed = createMemo(async () => ['a']);
  const shown = createMemo(() => items().filter(item => allowed().includes(item)));
  return <p>{shown().length}</p>;
}
export function Covered() {
  return <Loading fallback="…"><List/></Loading>;
}
render(() => <List/>, document.body);`);
    expect(code).toContain('yield* __nativeLexicalCallback("memo"');
    const errors = checked(code).join("\n");
    expect(errors).toMatch(/PENDING_ROOT|pending/i);
    expect(errors.split("\n").filter(line => /Covered/.test(line))).toEqual([]);
  });

  it("annotates a delegated callback's parameters, destructured ones included", () => {
    const code = lower(`import {createSignal} from 'solid-js';
export function Table() {
  const [rows] = createSignal({ a: 1, b: 2 });
  const [scale] = createSignal(2);
  return <ul>{Object.entries(rows()).map(([key, value]) => <li>{key}: {value * scale()}</li>)}</ul>;
}`);
    expect(code).toMatch(/\(\[key, value\]: \[string, number\]\)/);
    expect(checked(code)).toEqual([]);
  });

  it("does not delegate an event callback prop or a scheduled callback", () => {
    const code = lower(`import {createSignal, createMemo, refresh, onSettled} from 'solid-js';
function Row(props: {label: string; reload: () => void}) {
  return <button onClick={() => props.reload()}>{props.label}</button>;
}
export function List() {
  const items = createMemo(() => ['a']);
  const [, setHash] = createSignal('');
  onSettled(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  });
  return <ul>{items().map(label => <Row label={label} reload={() => refresh(items)}/>)}</ul>;
}`);
    expect(code).toContain('reload: __nativeLexicalCallback("event"');
    expect(code).not.toMatch(/yield\* __nativeLexicalCallback\("event"/);
    expect(checked(code)).toEqual([]);
  });
});

describe("callbacks given to other functions (F-S47)", { timeout: 60_000 }, () => {
  const consumer = (
    body,
    helper = "function consume<T>(callback: () => T): T { return callback(); }"
  ) =>
    `import {createSignal, createMemo, Errored, Loading} from 'solid-js';
import {render} from '@solidjs/web';
${helper}
export function Total() {
  const [n] = createSignal(1);
  const pending = createMemo(async () => n());
  ${body}
}`;

  it("delegates a nested callback through a binding before its statement", () => {
    const code = lower(`import {createSignal} from 'solid-js';
declare function consume<T>(callback: () => T): T;
export function App() {
  const [n] = createSignal(1);
  return <button onClick={() => consume(() => consume(() => n()))}/>;
}`);
    expect(code).toMatch(/const _callback2 = yield\* __nativeLexicalCallback\("event"/);
    expect(code).toMatch(/const _callback = yield\* __nativeLexicalCallback\("event"/);
    // The call keeps its attempt: its own failures are still typed.
    expect(code).toContain("__nativeAttempt(() => consume(_callback2)");
    expect(code).toContain("__nativeAttempt(() => consume(_callback)");
    expect(checked(code)).toEqual([]);
  });

  it("a pending read in a callback given to a function makes its host pending", () => {
    const code = lower(`${consumer(`const total = createMemo(() => consume(() => pending() * 2));
  return <p>{total()}</p>;`)}
function Root() { return <Errored fallback="!"><Total/></Errored>; }
render(() => <Root/>, document.body);`);
    expect(code).toMatch(/const _callback = yield\* __nativeLexicalCallback\("memo"/);
    expect(checked(code).join("\n")).toMatch(/PENDING_ROOT/);
  });

  it("the same read under Loading is accepted", () => {
    const code = lower(`${consumer(`const total = createMemo(() => consume(() => pending() * 2));
  return <p>{total()}</p>;`)}
function Root() { return <Errored fallback="!"><Loading><Total/></Loading></Errored>; }
render(() => <Root/>, document.body);`);
    expect(checked(code)).toEqual([]);
  });

  it("annotates a hoisted callback's parameters from the slot it was given to", () => {
    const code = lower(
      `${consumer(
        `const total = createMemo(() => consume(k => pending() * k));
  return <p>{total()}</p>;`,
        "function consume(callback: (k: number) => number): number { return callback(2); }"
      )}
function Root() { return <Errored fallback="!"><Loading><Total/></Loading></Errored>; }
render(() => <Root/>, document.body);`
    );
    expect(code).toContain('__nativeLexicalCallback("memo", function* (k: number)');
    expect(checked(code)).toEqual([]);
  });

  it("leaves a callback that uses a thunk's own binding in place", () => {
    const code = lower(`import {createSignal} from 'solid-js';
declare function consume<T>(callback: () => T): T;
export function App() {
  const [n] = createSignal(1);
  return <button onClick={() => [1].forEach(k => { const m = k; consume(() => n() + m); })}/>;
}`);
    expect(checked(code)).toEqual([]);
  });

  it("delegates an array-named method on a value that is not an array, like any call", () => {
    const code = lower(`import {createSignal} from 'solid-js';
declare const tree: { map<T>(f: (n: number) => T): T[] };
export function List() {
  const [n] = createSignal(1);
  return <ul>{tree.map(x => <li>{x + n()}</li>)}</ul>;
}`);
    expect(code).toMatch(
      /const _callback = yield\* __nativeHoleColors\(__nativeLexicalCallback\("hole"/
    );
  });
});

describe("native hole callbacks build JSX (F-S44)", { timeout: 60_000 }, () => {
  it("renders a component per item from .map", () => {
    const code = lower(`import {createSignal} from 'solid-js';
function Row(props: {label: string}) { return <li>{props.label}</li>; }
export function List() {
  const [items] = createSignal(['a', 'b']);
  return <ul>{items().map(item => <Row label={item}/>)}</ul>;
}`);
    expect(code).toContain("function* (item: string)");
    expect(checked(code)).toEqual([]);
  });

  it("carries a child's failure through .map to the root", () => {
    const code = lower(`import {createSignal, createMemo} from 'solid-js';
import {render} from '@solidjs/web';
function Row(props: {label: string}) {
  const bad = createMemo(() => { if (!props.label) throw new RangeError('empty'); return props.label; });
  return <li>{bad()}</li>;
}
export function List() {
  const [items] = createSignal(['a', 'b']);
  return <ul>{items().map(item => <Row label={item}/>)}</ul>;
}
render(() => <List/>, document.body);`);
    expect(checked(code).join("\n")).toMatch(/\[FOREIGN_HANDOFF\][^]*global:RangeError/);
  });
});
