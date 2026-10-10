import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// F-S53: Rendering's Stream and Skeleton shapes. Async iterable producers, a
// projection's draft, a Repeat index used as a key, derived stores and the
// thunks given to isPending/latest.
const file = resolve(import.meta.dirname, "fixtures/native-streams.tsx");
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
const items = `interface Item { id: number; text: string }
async function* items(): AsyncIterable<Item> {
  for (const item of [{ id: 1, text: "a" }, { id: 2, text: "b" }]) {
    await new Promise(resolve => setTimeout(resolve, 10));
    yield item;
  }
}`;

describe("native async iterables and derived stores (F-S53)", { timeout: 60_000 }, () => {
  it("keeps a projection's draft on the compute, not on the producer", () => {
    const code = lower(`import {createProjection, Loading, Repeat} from 'solid-js';
${items}
export function List() {
  const rows = createProjection<Item[]>(async function* (state) {
    for await (const item of items()) { state.push(item); yield; }
  }, []);
  return <Loading fallback="…"><ul><Repeat count={rows.length}>{i => <li>{rows[i].text}</li>}</Repeat></ul></Loading>;
}`);
    expect(code).toMatch(/createProjection\(function\* \(state\)/);
    expect(code).toMatch(/__nativeAttempt\(async function\* \(\)/);
    expect(checked(code)).toEqual([]);
  });

  it("reads a Repeat index used as a key", () => {
    const code = lower(`import {createStore, Repeat} from 'solid-js';
export function List() {
  const [rows] = createStore([{ text: "a" }, { text: "b" }]);
  return <ul><Repeat count={rows.length}>{i => <li>{i}: {rows[i].text}</li>}</Repeat></ul>;
}`);
    expect(code).toContain("rows[yield* i].text");
    expect(checked(code)).toEqual([]);
  });

  it("an async generator memo yields its items as its value", () => {
    const code = lower(`import {createMemo, For, Loading} from 'solid-js';
${items}
export function List() {
  const all = createMemo<Item[]>(async function* () {
    let seen: Item[] = [];
    for await (const item of items()) yield (seen = [...seen, item]);
  });
  return <Loading fallback="…"><ul><For each={all()}>{item => <li>{item.text}</li>}</For></ul></Loading>;
}`);
    expect(checked(code)).toEqual([]);
  });

  it("a derived store is a projection", () => {
    const code = lower(`import {createSignal, createStore, For} from 'solid-js';
interface Feed { user: string; items: { text: string }[] }
async function load(): Promise<Feed> { return { user: "Ada", items: [{ text: "x" }] }; }
export function Card() {
  const [version] = createSignal(0);
  const [feed] = createStore<Feed>(async draft => {
    version();
    const data = await load();
    draft.user = data.user;
    draft.items = data.items;
  }, { user: "", items: [] }, { seedLoadingValue: true });
  return <section><h2>{feed.user}</h2><For each={feed.items}>{item => <p>{item.text}</p>}</For></section>;
}`);
    expect(code).toMatch(/const feed = yield\* createProjection\(function\* \(draft\)/);
    expect(code).toContain("$projection as createProjection");
    expect(checked(code)).toEqual([]);
  });

  it("a derived store whose setter is used stays a store call", () => {
    const code = lower(`import {createStore} from 'solid-js';
export function Card() {
  const [feed, setFeed] = createStore(draft => { draft.n = 1; }, { n: 0 });
  return <button onClick={() => setFeed(f => { f.n++; })}>{feed.n}</button>;
}`);
    expect(code).not.toContain("createProjection");
    expect(checked(code).length).toBeGreaterThan(0);
  });

  it("gives isPending and latest the source a thunk reads", () => {
    const code = lower(`import {createMemo, createStore, isPending, latest} from 'solid-js';
export function Status() {
  const total = createMemo(async () => 1);
  const [store] = createStore({ items: [1, 2] });
  return <p class={{ busy: isPending(() => total()) || isPending(() => store.items) }}>{latest(() => total())}</p>;
}`);
    expect(code).toContain("isPending(total)");
    expect(code).toContain("isPending(store.items)");
    expect(code).toContain("latest(total)");
    expect(checked(code)).toEqual([]);
  });

  it("leaves a thunk that computes", () => {
    const code = lower(`import {createSignal, isPending} from 'solid-js';
export function Status() {
  const [a] = createSignal(1);
  return <p>{String(isPending(() => a() + 1))}</p>;
}`);
    expect(code).not.toContain("isPending(a)");
  });
});
