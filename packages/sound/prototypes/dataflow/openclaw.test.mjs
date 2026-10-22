// @ts-check
import { describe, expect, it } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createChecker } from "./index.mjs";

const rootDir = dirname(fileURLToPath(import.meta.url));
const prelude = `import { createSignal, createMemo, createEffect, untrack, For, Show, Loading, Errored } from "solid-js";
import { render } from "@solidjs/web";
`;

/** @param {string} source */
function check(source) {
  const entry = resolve(rootDir, "_scope-input.tsx");
  const text = prelude + source + "\nrender(App, document.body);\n";
  const checker = createChecker({ rootDir, files: [entry], readFile: path => path === entry ? text : undefined });
  try { return checker.check().diagnostics; } finally { checker.dispose(); }
}

/** @param {string} source */
const codes = source => check(source).map(d => d.code).sort();

describe("dataflow setup-like scopes and lazy reads", () => {
  it("keeps compute values plain in apply helpers, but diagnoses direct prop reads", () => {
    const app = "function App() { const [count] = createSignal(1); return <Child value={count()} />; }";
    expect(codes("function Child(props: { value: number }) { const apply = (n: number) => console.log(n); createEffect(() => props.value, n => apply(n)); return <p />; }" + app)).toEqual([]);
    const diagnostics = check("function Child(props: { value: number }) { const apply = () => console.log(props.value); createEffect(() => 0, () => apply()); return <p />; }" + app);
    expect(diagnostics.map(d => d.code)).toEqual(["STRICT_READ_UNTRACKED"]);
    expect(diagnostics[0].related?.length).toBeGreaterThan(0);
  });

  it("checks default-row index snapshots, but not held row fields", () => {
    expect(codes("function App() { return <For each={[{ label: \"a\" }]}>{(row, index) => { const initial = index(); return <p>{row.label}{initial}</p>; }}</For>; }")).toEqual(["STRICT_READ_UNTRACKED"]);
    expect(codes("function App() { return <For each={[{ label: \"a\" }]}>{row => { const initial = row.label; return <p>{initial}</p>; }}</For>; }")).toEqual([]);
  });

  it("keeps index-mode indices held and item accessors reactive only where read", () => {
    expect(codes("function App() { return <For each={[\"a\"]} keyed={false}>{(row, index) => { const initial = index; return <p>{row()}{initial}</p>; }}</For>; }")).toEqual([]);
    expect(codes("function App() { return <For each={[\"a\"]} keyed={false}>{row => { const initial = row(); return <p>{initial}</p>; }}</For>; }")).toEqual(["STRICT_READ_UNTRACKED"]);
  });

  it("keeps Show callback bodies tracking", () => {
    expect(codes("function App() { const [value] = createSignal(1); return <Show when={value()}>{read => { const n = read(); return <p>{n}</p>; }}</Show>; }")).toEqual([]);
  });

  it("follows ref aliases and helpers without warning on DOM capture", () => {
    expect(codes("function App() { const [value] = createSignal(1); const sample = () => value(); const attach = (el: HTMLParagraphElement) => { el.title = String(sample()); }; return <p ref={attach}>{value()}</p>; }")).toEqual(["STRICT_READ_UNTRACKED"]);
    expect(codes("function App() { let element: HTMLParagraphElement | undefined; return <p ref={el => { element = el; el.title = \"ready\"; }} />; }")).toEqual([]);
  });

  it("does not let rendered Loading or local catch repair a pending ref read", () => {
    expect(codes("function App() { const read = createMemo(async () => 1); return <Loading fallback=\"wait\"><p ref={el => { try { el.title = String(read()); } catch {} }} /></Loading>; }")).toEqual(["PENDING_ASYNC_UNTRACKED_READ"]);
  });

  it("follows held untrack aliases and preserves local catches", () => {
    const helper = "const [value] = createSignal(1); const sample = () => { value(); throw new Error(); }; const alias = sample;";
    expect(codes("function App() { " + helper + " const n = untrack(alias); return <p />; }")).toEqual(["SETUP_MAY_THROW"]);
    expect(codes("function App() { " + helper + " try { untrack(alias); } catch {} return <p />; }")).toEqual([]);
  });

  it("checks ref reads, leaves write ownership partial, and catches callback failures", () => {
    expect(codes("function App() { const [n, set] = createSignal(1); return <p ref={el => { set(n() + el.childElementCount); }} />; }")).toEqual(["STRICT_READ_UNTRACKED", "UNANALYZED_BOUNDARY"]);
    expect(codes("function App() { return <p ref={() => { throw new Error(); }} />; }")).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
    expect(codes("function App() { let element: HTMLParagraphElement | undefined; return <p ref={element} />; }")).toEqual([]);
  });

  it("keeps writes checked through untrack aliases", () => {
    expect(codes("function App() { const [n, set] = createSignal(1); untrack(set); return <p>{n()}</p>; }")).toEqual(["REACTIVE_WRITE_IN_OWNED_SCOPE"]);
  });

  it("does not read an unused throwing prop", () => {
    expect(codes("function Child(props: { value: number }) { return <p />; } function App() { const read = createMemo(() => { throw new Error(); }); return <Child value={read()} />; }")).toEqual([]);
  });

  it("catches only the promise branch to which catch is attached", () => {
    expect(codes("function App() { return <button onClick={() => { const original = Promise.reject(new Error()); const branch = original.then(() => 1); void original.catch(() => {}); void branch; }} />; }")).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
    expect(codes("function App() { return <button onClick={() => { const original = Promise.reject(new Error()); const branch = original.then(() => 1); void original.catch(() => {}); void branch.catch(() => {}); }} />; }")).toEqual([]);
  });
});
