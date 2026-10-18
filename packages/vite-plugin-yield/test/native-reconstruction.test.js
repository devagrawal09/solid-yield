import { describe, it, expect } from "vitest";
import { relative, resolve } from "node:path";
import { reconstructProject } from "../src/routines.js";
import { lowerNativeFile } from "../src/native.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { transform } from "../src/transform.js";
const id = resolve(import.meta.dirname, "fixtures/routines.tsx");
const lower = code => reconstructProject(new Map([[id, code]])).files.get(id);
const start = 'import { $signal, $event, $memo, attempt, type Source } from "solid-yield";';
describe("native routine reconstruction", { timeout: 30_000 }, () => {
  it.each([true, false])("normalizes active module IDs (relative input: %s)", relativeInput => {
    const entry = resolve(import.meta.dirname, "fixtures/routines-entry.tsx");
    const selected = relativeInput ? relative(process.cwd(), id) : id;
    const active = relativeInput ? id : relative(process.cwd(), id);
    const entryCode = "export function Entry() { return <p/>; }";
    const result = reconstructProject(
      new Map([
        [selected, `${start} export function read(n: Source<number>) { return n(); }`],
        [entry, entryCode]
      ]),
      { active: new Map([[active, true]]).keys() }
    );
    expect(result.files.get(id)).toContain("function* read");
    expect(result.files.get(id)).toContain("yield* n");
    expect(result.files.get(entry)).toBe(entryCode);
    expect(result.positions.has(id)).toBe(true);
  });
  it("leaves every module untouched when the active set is empty", () => {
    const code = "export function Entry() { return <p/>; }";
    const result = reconstructProject(new Map([[id, code]]), { active: [] });
    expect(result.files.get(id)).toBe(code);
    expect(result.iterations).toBe(1);
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
    const helper = resolve(import.meta.dirname, "fixtures/routines-helper.ts");
    const bridge = resolve(import.meta.dirname, "fixtures/routines-bridge.ts");
    const out = reconstructProject(
      new Map([
        [helper, `${start} export function read(n: Source<number>) { return n(); }`],
        [bridge, 'export { read as get } from "./routines-helper";'],
        [
          id,
          `${start} import { get } from "./routines-bridge";
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
  it("refuses a program whose routines do not settle within the fixpoint's bound", () => {
    const helper = resolve(import.meta.dirname, "fixtures/routines-helper.ts");
    const files = new Map([
      [helper, `${start} export function read(n: Source<number>) { return n(); }`],
      [
        id,
        `${start} import { read } from "./routines-helper";
        function Counter() { const [n] = $signal(0); const x = $memo(() => read(n));
          return <p>{x()}</p>; }`
      ]
    ]);
    // a helper inferred as a routine changes its callers in the next round
    expect(() => reconstructProject(files, { rounds: 1 })).toThrow(/\[SUGAR_FIXPOINT\]/);
    expect(reconstructProject(files).files.get(id)).toContain("yield* read(n)");
  });
  it("needs the project's tsconfig.json through the native file front end", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "no-config-"));
    const file = resolve(dir, "app.tsx");
    try {
      expect(() => lowerNativeFile("export const a = 1;", file, () => true, new Map())).toThrow(
        /^\[NATIVE_PROJECT\] /
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
  it("binds a handler read from a prop as a local event (D-126: the prop is the $event)", () => {
    const result = lower(`${start} import { type Props, type Handler } from "solid-yield";
      function Child(props: Props<{ save: Handler }>) { return <button onClick={props.save}/>; }`);
    expect(result).toContain("onClick={yield* props.save}");
  });
  it("handles arrow components and preserves a static early JSX return", () => {
    const result = lower(`${start} const Child = () => <p/>;
      function Parent() { if (true) return <p/>; return <>{Child()}</>; }`);
    expect(result).toContain("component(function* Child");
    expect(result).toContain("if (true) return view(function*");
  });
  it("renders conditional JSX and null return paths as Solid does (D-125)", () => {
    for (const body of [
      "if (n() > 1) return null; return <p/>;",
      "return n() > 1 ? <b/> : <p/>;"
    ]) {
      const result = lower(`${start} function Counter() { const [n] = $signal(0); ${body} }`);
      expect(result).toContain("component(function* Counter");
      expect(result).toContain("return view(function*");
      expect(() => transform(result, { filename: id })).not.toThrow();
    }
  });
  it("refuses reads in unknown callbacks", () => {
    expect(() =>
      lower(`${start} function Counter() { const [n] = $signal(0);
      const value = unknownConsumer(() => n()); return <p>{value}</p>; }`)
    ).toThrow(/SUGAR_CALLBACK/);
  });
  it("refuses a named routine escaping into a plain callback consumer", () => {
    expect(() =>
      lower(`${start} function Counter() { const [n] = $signal(0);
      const read = () => n(); const x = $memo(() => [1].map(read));
      return <p>{x()}</p>; }`)
    ).toThrow(/SUGAR_ESCAPE/);
  });
  it("reads a routine's member without handing it over; bind hands it over", () => {
    const result = lower(`${start} function Counter() { const [n] = $signal(0);
      const read = () => n(); const arity = read.length; const x = $memo(() => read() + arity);
      return <p>{x()}</p>; }`);
    expect(result).toContain("const arity = read.length");
    expect(() =>
      lower(`${start} function Counter() { const [n] = $signal(0);
      const read = () => n(); const bound = read.bind(null); const x = $memo(() => bound());
      return <p>{x()}</p>; }`)
    ).toThrow(/SUGAR_ESCAPE/);
  });
  it("preserves explicit authored generators", () => {
    const result = lower(`${start} function* helper() { yield 1; }
      const values = [...helper()];`);
    expect(result).toContain("function* helper()");
    expect(result).toContain("yield 1");
    expect(result).toContain("[...helper()]");
  });
  it("refuses async routine bodies", () => {
    expect(() => lower(`${start} const e = $event(async () => {});`)).toThrow(/SUGAR_ASYNC/);
  });
  it("leaves ordinary async I/O and plain attempt callbacks alone", () => {
    const result = lower(`${start} async function load() { return 1; }
      function Counter() { const x = $memo(() => attempt(() => load(), () => {}));
        return <p>{x()}</p>; }`);
    expect(result).toContain("async function load()");
    expect(result).toContain("yield* attempt(() => load(), () => {})");
  });
  it("reconstructs synchronous methods containing reactive reads", () => {
    const result = lower(`${start} function Counter() { const [n] = $signal(0);
      const obj = { read() { return n(); } }; return <p>{obj.read()}</p>; }`);
    expect(result).toContain("*read()");
    expect(result).toContain("yield* n");
    expect(result).toContain("yield* obj.read()");
  });
  it("refuses reactive reads in async methods", () => {
    expect(() =>
      lower(`${start} function Counter() { const [n] = $signal(0);
      const obj = { async read() { return n(); } }; return <p/>; }`)
    ).toThrow(/SUGAR_HOST/);
  });
});
