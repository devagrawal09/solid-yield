// @ts-check
import { describe, expect, it } from "vitest";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { createChecker } from "./index.mjs";

const rootDir = dirname(fileURLToPath(import.meta.url));
const prelude = `import { createSignal, createMemo, createEffect, Loading, Errored, merge } from "solid-js";
import { render } from "@solidjs/web";
`;

/** @param {string} source @param {boolean} [rendered] */
function check(source, rendered = true) {
  const entry = resolve(rootDir, "_precision-input.tsx");
  const text = prelude + source + (rendered ? "\nrender(App, document.body);\n" : "");
  const checker = createChecker({ rootDir, files: [entry], readFile: path => path === entry ? text : undefined });
  try { return checker.check(); } finally { checker.dispose(); }
}
/** @param {string} source */
const codes = source => check(source).diagnostics.map(d => d.code).sort();

describe("dataflow precision models", () => {
  it("tracks reset keys without calling function-valued keys", () => {
    expect(codes(`function App() { const [key] = createSignal("a"); const held = () => { throw new Error(); }; return <Loading on={key()}><Loading on={held}><p /></Loading></Loading>; }`)).toEqual([]);
    expect(codes(`function App() { const read = createMemo(() => Promise.resolve(1)); return <Loading on={read()}><p /></Loading>; }`)).toEqual(["ASYNC_OUTSIDE_LOADING_BOUNDARY"]);
    expect(codes(`function App() { const read = createMemo(() => Promise.resolve(1)); return <Loading on="key"><p>{read()}</p></Loading>; }`)).toEqual([]);
  });

  it("keeps merge lazy and uses the last defined value, not a union of overrides", () => {
    expect(codes(`function Child(initial: { value: number }) { const props = merge({ value: 0 }, initial); return <p>{props.value}</p>; } function App() { const [value] = createSignal(1); return <Child value={value()} />; }`)).toEqual([]);
    expect(codes(`function App() { const props = merge({ onChange: () => { throw new Error(); } }, { onChange: () => {} }); return <button onClick={() => props.onChange()} />; }`)).toEqual([]);
    expect(codes(`function App() { const props = merge({ onChange: () => { throw new Error(); } }, { onChange: undefined }); return <button onClick={() => props.onChange()} />; }`)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
    expect(codes(`declare const injected: (() => void) | undefined; function App() { const props = merge({ onChange: () => {} }, { onChange: injected }); return <button onClick={() => props.onChange?.()} />; }`)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  });

  it("keeps missing optional callbacks absent without losing present unknown callbacks", () => {
    expect(codes(`function App() { const props = merge({ onChange: undefined }, {}); return <button onClick={() => props.onChange?.()} />; }`)).toEqual([]);
    expect(codes(`declare const injected: () => void; function App() { const props = merge({ onChange: () => {} }, { onChange: injected }); return <button onClick={() => props.onChange?.()} />; }`)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  });

  it("keeps native receiver contracts separate from injected lookalikes", () => {
    expect(codes(`function App() { const target = new EventTarget(); const listener = () => {}; const set = new Set<string>(); return <button onClick={() => { target.removeEventListener("click", listener); set.add("a"); }} />; }`)).toEqual([]);
    expect(codes(`declare const target: EventTarget | { removeEventListener(type: string, listener: () => void): void }; function App() { return <button onClick={() => target.removeEventListener("click", () => {})} />; }`)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  });

  it("does not execute callbacks merely stored or removed by native operations", () => {
    expect(codes(`function App() { const listener = () => { throw new Error(); }; const target = new EventTarget(); const set = new Set<() => void>(); return <button onClick={() => { target.removeEventListener("click", listener); set.add(listener); }} />; }`)).toEqual([]);
    expect(codes(`function App() { const listener = () => { throw new Error(); }; return <button onClick={() => listener()} />; }`)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  });

  it("follows imperative class closures in the caller scope, including real pending reads", () => {
    expect(codes(`function App() { class Machine { start() { return "ready"; } subscribe(listener: () => void) { listener(); } } const machine = new Machine(); createEffect(() => 0, () => { machine.subscribe(() => {}); machine.start(); }); return <p />; }`)).toEqual([]);
    expect(codes(`function App() { const read = createMemo(() => Promise.resolve(1)); class Machine { start() { return read(); } } const machine = new Machine(); createEffect(() => 0, () => machine.start()); return <p />; }`)).toEqual(["PENDING_ASYNC_FORBIDDEN_SCOPE"]);
    expect(codes(`function App() { const read = createMemo(() => Promise.resolve(1)); class Machine { constructor(public get: () => number) {} start() { return this.get(); } } const machine = new Machine(read); createEffect(() => 0, () => machine.start()); return <p />; }`)).toEqual(["PENDING_ASYNC_FORBIDDEN_SCOPE"]);
  });

  it("keeps late outer bindings visible to class methods", () => {
    expect(codes(`function App() { class Machine { start() { return read(); } } const machine = new Machine(); const read = createMemo(() => Promise.resolve(1)); createEffect(() => 0, () => machine.start()); return <p />; }`)).toEqual(["PENDING_ASYNC_FORBIDDEN_SCOPE"]);
  });

  it("uses fresh receivers for class instances and follows field callbacks", () => {
    expect(codes(`function App() { const [settled] = createSignal(1); class Machine { get: () => number; constructor(get: () => number) { this.get = get; } start = () => this.get(); } const machine = new Machine(settled); createEffect(() => 0, () => machine.start()); return <p />; }`)).toEqual(["STRICT_READ_UNTRACKED"]);
    expect(codes(`class Machine { constructor(public get: () => number) {} start() { return this.get(); } } function App() { const pending = createMemo(() => Promise.resolve(1)); const one = new Machine(pending); const two = new Machine(() => 1); createEffect(() => 0, () => two.start()); return <Loading><p>{one.start()}</p></Loading>; }`)).toEqual([]);
  });

  it("does not bind extracted class methods, and keeps native Error subclasses plain", () => {
    expect(codes(`function App() { class Machine { get() { return 1; } start() { return this.get(); } } const machine = new Machine(); const start = machine.start; return <button onClick={start} />; }`)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
    expect(codes(`class Failure extends Error {} function App() { return <button onClick={() => { try { throw new Failure(); } catch {} }} />; }`)).toEqual([]);
  });

  it("does not silently trust unsupported class inheritance", () => {
    expect(codes(`class Parent {} function App() { class Child extends Parent {} const child = new Child(); return <p>{child.read()}</p>; }`)).toContain("UNANALYZED_BOUNDARY");
  });

  it("preserves exported obligations as information until a renderer exists (SLICE)", () => {
    const source = `export function App() { const read = createMemo(() => Promise.resolve(1)); return <><Loading on="key">{null}</Loading><p>{read()}</p></>; }`;
    expect(check(source, false).diagnostics.map(d => d.code)).toEqual(["COMPONENT_OBLIGATIONS_EXPORTED"]);
    expect(check(source).diagnostics.map(d => d.code)).toEqual(["ASYNC_OUTSIDE_LOADING_BOUNDARY"]);
  });
});

describe("dataflow installed-package boundary", () => {
  it("never analyzes linked installed implementations or explicit installed roots", () => {
    const scratch = mkdtempSync(join(rootDir, "_boundary-"));
    try {
      const app = join(scratch, "app");
      const dependency = join(scratch, "installed");
      mkdirSync(join(app, "node_modules"), { recursive: true });
      mkdirSync(join(dependency, "dist"), { recursive: true });
      writeFileSync(join(dependency, "package.json"), JSON.stringify({ name: "boundary-test", main: "dist/index.ts" }));
      writeFileSync(join(dependency, "dist/index.ts"), `export function connect() { return { get() { return "ready"; } }; } export function opaque(): unknown { return 1; } export class Engine { start() { return 1; } }`);
      const probe = join(dependency, "dist/probe.tsx");
      writeFileSync(probe, `export function Probe(props: { callback: () => void }) { return <button onClick={() => props.callback()} />; }`);
      symlinkSync(dependency, join(app, "node_modules/boundary-test"), "dir");
      const entry = join(app, "app.tsx");
      const source = `import { connect } from "boundary-test"; export function App() { return <button onClick={() => { try { connect().get(); } catch {} }} />; }`;
      writeFileSync(entry, source);
      const checker = createChecker({ rootDir: app, files: [entry, probe, join(dependency, "dist/index.ts")] });
      try {
        const initial = checker.check();
        expect(initial.diagnostics).toEqual([]);
        expect(initial.facts?.map(f => f.component)).toEqual(["App"]);
        const mutant = checker.update(entry, source.replace("try { connect().get(); } catch {}", "connect().get();"));
        expect(mutant.diagnostics.map(d => d.code)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
        expect(mutant.diagnostics.every(d => d.loc.file === entry)).toBe(true);
        const constructor = checker.update(entry, `import { Engine } from "boundary-test"; export function App() { return <button onClick={() => { new Engine(); }} />; }`);
        expect(constructor.diagnostics.map(d => d.code)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
        const caught = checker.update(entry, `import { Engine } from "boundary-test"; export function App() { return <button onClick={() => { try { new Engine().start(); } catch {} }} />; }`);
        expect(caught.diagnostics).toEqual([]);
        const opaqueCall = checker.update(entry, `import { opaque } from "boundary-test"; export function App() { return <button onClick={() => { try { const result = opaque(); result.get(); } catch {} }} />; }`);
        expect(opaqueCall.diagnostics.length).toBeGreaterThan(0);
        expect(opaqueCall.diagnostics.every(d => d.code === "UNANALYZED_BOUNDARY" && d.loc.file === entry)).toBe(true);
        const rendered = checker.update(entry, `import { opaque } from "boundary-test"; import { render } from "@solidjs/web"; function App() { return <p>{opaque()}</p>; } render(App, document.body);`);
        expect(rendered.diagnostics.map(d => d.code)).toContain("ASYNC_OUTSIDE_LOADING_BOUNDARY");
        expect(rendered.diagnostics.map(d => d.code)).toContain("ERROR_OUTSIDE_ERRORED_BOUNDARY");
      } finally { checker.dispose(); }
    } finally { rmSync(scratch, { recursive: true, force: true }); }
  });
});
