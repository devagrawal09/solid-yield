import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { isSugar, lowerSugarProject } from "../src/sugar.js";
import { transform } from "../src/transform.js";
const id = resolve(import.meta.dirname, "fixtures/sugar.tsx");
const lower = code => lowerSugarProject(new Map([[id, code]])).files.get(id);
const start =
  '"use yield"; import { $signal, $event, $memo, attempt, type Source } from "solid-yield";';
describe("sugar: existing library semantics", { timeout: 30_000 }, () => {
  it("opts in only at the directive prologue", () => {
    expect(isSugar('// comment\n"use yield";')).toBe(true);
    const code = 'const text = "use yield";';
    expect(isSugar(code)).toBe(false);
    expect(lower(code)).toBe(code);
  });
  it("reconstructs setup, event binding, conditional reads and a view", () => {
    const result = lower(`${start} function Counter() {
      const [count, set] = $signal(0);
      const inc = $event(() => { set(count() + 1); });
      return <button onClick={inc}>{count() > 0 ? count() : 0}</button>; }`);
    expect(result).toContain("component(function* Counter");
    expect(result).toContain("return view(function*");
    expect(result).toContain("yield* set((yield* count) + 1)");
    expect(result).toContain("onClick={yield* inc}");
    expect(result).toContain("(yield* count) > 0 ? yield* count : 0");
    expect(() => transform(result, { filename: id })).not.toThrow();
  });
  it("infers a helper through a re-export for memo and event callers", () => {
    const helper = resolve(import.meta.dirname, "fixtures/sugar-helper.ts");
    const bridge = resolve(import.meta.dirname, "fixtures/sugar-bridge.ts");
    const out = lowerSugarProject(
      new Map([
        [helper, `${start} export function read(n: Source<number>) { return n(); }`],
        [bridge, 'export { read as get } from "./sugar-helper";'],
        [
          id,
          `${start} import { get } from "./sugar-bridge";
        function Counter() { const [n, set] = $signal(0);
          const x = $memo(() => get(n));
          const inc = $event(() => { set(get(n) + 1); });
          return <button onClick={inc}>{x()}</button>; }`
        ]
      ])
    ).files;
    expect(out.get(helper)).toContain("function* read");
    expect(out.get(id)).toContain("yield* get(n)");
    expect(out.get(id)).toContain("yield* set((yield* get(n)) + 1)");
  });
  it("keeps branch order, loops and early returns in an event", () => {
    const result = lower(`${start} function Counter() {
      const [n, set] = $signal(0);
      const save = $event(() => { if(n() === 0) return; for(let i=0;i<2;i++) set(i); });
      return <button onClick={save}>{n()}</button>; }`);
    expect(result).toContain("if ((yield* n) === 0) return;");
    expect(result).toContain("i++) yield* set(i)");
  });
  it("wraps a computed call prop as a hole, keeping the read at the child", () => {
    const result = lower(`${start} import { type Props } from "solid-yield";
      function Child(props: Props<{ n: number }>) { return <p>{props.n}</p>; }
      function Counter() { const [n] = $signal(0); return <>{Child({ n: n() + 1 })}</>; }`);
    expect(result).toMatch(/n: function\* \(\) \{\s*return \(yield\* n\) \+ 1/);
  });
  it("binds a handler read from a prop with both operations", () => {
    const result = lower(`${start} import { type Props, type Handler } from "solid-yield";
      function Child(props: Props<{ save: Handler }>) { return <button onClick={props.save}/>; }`);
    expect(result).toContain("onClick={yield* yield* props.save}");
  });
  it("handles arrow components and preserves a static early JSX return", () => {
    const result = lower(`${start} const Child = () => <p/>;
      function Parent() { if (true) return <p/>; return <>{Child()}</>; }`);
    expect(result).toContain("component(function* Child");
    expect(result).toContain("if (true) return view(function*");
  });
  it("refuses reads in unknown callbacks", () => {
    expect(() =>
      lower(`${start} function Counter() { const [n] = $signal(0);
      const x = $memo(() => [1].map(() => n())); return <p>{x()}</p>; }`)
    ).toThrow(/SUGAR_CALLBACK/);
  });
  it("refuses a named routine escaping into a plain callback consumer", () => {
    expect(() =>
      lower(`${start} function Counter() { const [n] = $signal(0);
      const read = () => n(); const x = $memo(() => [1].map(read));
      return <p>{x()}</p>; }`)
    ).toThrow(/SUGAR_ESCAPE/);
  });
  it("refuses authored generators and async routine bodies", () => {
    expect(() => lower(`${start} function* helper() {}`)).toThrow(/SUGAR_EXPLICIT/);
    expect(() => lower(`${start} const e = $event(async () => {});`)).toThrow(/SUGAR_ASYNC/);
  });
  it("leaves ordinary async I/O and plain attempt callbacks alone", () => {
    const result = lower(`${start} async function load() { return 1; }
      function Counter() { const x = $memo(() => attempt(() => load(), () => {}));
        return <p>{x()}</p>; }`);
    expect(result).toContain("async function load()");
    expect(result).toContain("yield* attempt(() => load(), () => {})");
  });
  it("refuses methods containing reactive reads", () => {
    expect(() =>
      lower(`${start} function Counter() { const [n] = $signal(0);
      const obj = { read() { return n(); } }; return <p>{obj.read()}</p>; }`)
    ).toThrow(/SUGAR_HOST/);
  });
});
