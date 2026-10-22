import { describe, expect, it } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createChecker } from "./index.mjs";
import { compilerOptions } from "../../harness/compiler-options.mjs";
const rootDir = dirname(fileURLToPath(import.meta.url));
function check(lines) {
  const source = 'import * as Solid from "solid-js"; import {render} from "@solidjs/web";' + lines.join("\n");
  const file = resolve(rootDir, "memory.tsx");
  const checker = createChecker({ rootDir, files: [file], compilerOptions, readFile: () => source });
  try { return checker.check().diagnostics; } finally { checker.dispose(); }
}
describe("typed context encoding", () => {
  it("uses declaration identity and the nearest provider", () => {
    const ds = check([
      'const C = Solid.createContext({value: () => 0}); const Provider = C;',
      'function Read() { const s = Solid.useContext(C); return <b>{s.value()}</b>; }',
      'function App() { const pending = Solid.createMemo(async () => 1); const [ready] = Solid.createSignal(2);',
      'return <Provider value={{value: pending}}><C value={{value: ready}}><Read /></C></Provider>; }',
      'render(App, document.body);'
    ]);
    expect(ds).toEqual([]);
  });
  it("does not read an unused lazy prop", () => {
    const ds = check([
      'function Child(p: {value: number}) { return <b>ready</b>; }',
      'function App() { const value = Solid.createMemo(async () => {throw new Error("bad")}); return <Child value={value()} />; }',
      'render(App, document.body);'
    ]);
    expect(ds).toEqual([]);
  });
  it("keeps recursive prop colors without an implicit-any view", () => {
    const ds = check([
      'function Tree(p: {value: number; depth: number}) { if (p.depth <= 0) return <b>{p.value}</b>; return <Tree depth={p.depth - 1} value={p.value} />; }',
      'function App() { const value = Solid.createMemo(async () => {throw new Error("bad")}); return <Tree depth={3} value={value()} />; }',
      'render(App, document.body);'
    ]);
    expect(ds.map(d => d.code).sort()).toEqual(["ASYNC_OUTSIDE_LOADING_BOUNDARY", "ERROR_OUTSIDE_ERRORED_BOUNDARY"]);
    expect(ds.every(d => d.related?.length)).toBe(true);
  });
  it("keeps mutation uncertainty within the affected provider", () => {
    const ds = check([
      'declare function expose(s: object): void;',
      'const C = Solid.createContext<{read: () => number}>();',
      'function Escape() { const s = Solid.useContext(C); try { expose(s); } catch {} return <b>held</b>; }',
      'function Read() { const s = Solid.useContext(C); return <b>{s.read()}</b>; }',
      'function App() { return <><C value={{read: () => 1}}><Escape /></C><C value={{read: () => 2}}><Read /></C></>; }',
      'render(App, document.body);'
    ]);
    expect(ds.map(d => d.code)).toEqual(["UNANALYZED_BOUNDARY"]);
  });
  it("makes other consumers of an escaped context object worst case", () => {
    const ds = check([
      'declare function expose(s: object): void;',
      'const C = Solid.createContext<{read: () => number}>();',
      'function Escape() { const s = Solid.useContext(C); try { expose(s); } catch {} return <b>held</b>; }',
      'function Read() { const s = Solid.useContext(C); return <b>{s.read()}</b>; }',
      'function App() { return <C value={{read: () => 1}}><Escape /><Read /></C>; }',
      'render(App, document.body);'
    ]);
    expect(ds.map(d => d.code).sort()).toEqual(["ASYNC_OUTSIDE_LOADING_BOUNDARY", "ERROR_OUTSIDE_ERRORED_BOUNDARY", "UNANALYZED_BOUNDARY"]);
  });
  it("does not treat a dropped promise in try/catch as handled", () => {
    const common = [
      'interface Api {save(): Promise<void>}; declare const api: Api;',
      'const C = Solid.createContext<Api>();',
      'function App() { return <C value={api}><Read /></C>; }',
      'render(App, document.body);'
    ];
    const dropped = check([...common, 'function Read() {const s = Solid.useContext(C); return <button onClick={() => {try {s.save();} catch {}}}>save</button>;}']);
    expect(dropped.map(d => d.code)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
    const caught = check([...common, 'function Read() {const s = Solid.useContext(C); return <button onClick={() => s.save().catch(() => {})}>save</button>;}']);
    expect(caught).toEqual([]);
  });
  it("retains colors on Component-annotated arrows", () => {
    const ds = check([
      'const Read: Solid.Component<{value: number}> = p => <b>{p.value}</b>;',
      'const App: Solid.Component = () => {const value = Solid.createMemo(async () => 1); return <Read value={value()} />;};',
      'render(App, document.body);'
    ]);
    expect(ds.map(d => d.code)).toEqual(["ASYNC_OUTSIDE_LOADING_BOUNDARY"]);
    expect(ds[0].related?.length).toBeGreaterThan(0);
  });
  it("keeps factory setup reads in setup", () => {
    const ds = check([
      'function factory() { const [count] = Solid.createSignal(0); const held = count(); return {held}; }',
      'const C = Solid.createContext<ReturnType<typeof factory>>();',
      'function Read() { const s = Solid.useContext(C); return <b>{s.held}</b>; }',
      'function App() { const s = factory(); return <C value={s}><Read /></C>; }',
      'render(App, document.body);'
    ]);
    expect(ds.map(d => d.code)).toEqual(["STRICT_READ_UNTRACKED"]);
  });
});
