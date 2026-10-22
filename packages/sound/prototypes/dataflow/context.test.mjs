// @ts-check
import { describe, expect, it } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createChecker } from "./index.mjs";

const rootDir = dirname(fileURLToPath(import.meta.url));
const prelude = `import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import { render } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
`;

/** @param {string} source @param {Record<string, string>} [extra] */
function check(source, extra = {}) {
  const entry = resolve(rootDir, "_context-input.tsx");
  const documents = new Map([[entry, prelude + source + `
render(() => <App />, document.body);
`]]);
  for (const [name, text] of Object.entries(extra)) documents.set(resolve(rootDir, name), text);
  const checker = createChecker({ rootDir, files: [...documents.keys()], readFile: path => documents.get(path) });
  try { return checker.check().diagnostics; } finally { checker.dispose(); }
}

/** @param {import("../../src/types.d.ts").SoundDiagnostic[]} diagnostics */
const codes = diagnostics => diagnostics.map(d => d.code).sort();

const consumer = 'function Child() { const s = useContext(C); return <p>{s.read()}</p>; }';

describe("dataflow context paths and service values", () => {
  it("resolves contexts through namespace imports", () => {
    expect(check('import * as contexts from "./namespace-input"; function App() { const s = useContext(contexts.C); return <p>{s.read()}</p>; }', {
      "namespace-input.ts": 'import * as Solid from "solid-js"; const alias = Solid.createContext; export const C = alias({ read: () => 3 });'
    })).toEqual([]);
  });

  it("treats an undefined default as absent without inventing read facts", () => {
    expect(codes(check('const C = createContext<{ read: () => number } | undefined>(undefined); function App() { const s = useContext(C); return <p>{s?.read()}</p>; }'))).toEqual(["CONTEXT_PROVIDER_MISSING"]);
  });

  it("follows imported and local createContext aliases, not type spelling", () => {
    expect(check('import { C as Renamed } from "./context-input"; function App() { const s = useContext(Renamed); return <p>{s.read()}</p>; }', {
      "context-input.ts": 'import { createContext as original } from "solid-js"; const alias = original; export const C = alias({ read: () => 7 });'
    })).toEqual([]);
  });

  it("keeps closures from separate calls to one state factory apart", () => {
    expect(check('const C = createContext<{ read: () => number }>(); function make(read: () => number) { const [count] = createSignal(1); return { count, read: () => read() }; }' + consumer + 'function App() { const pending = createMemo(async () => 1); const [settled] = createSignal(2); const first = make(pending); const second = make(settled); return <><Loading fallback="wait"><C value={first}><Child /></C></Loading><C value={second}><Child /></C></>; }')).toEqual([]);
  });

  it("uses the helper caller's nearest provider and boundary path", () => {
    expect(codes(check('const C = createContext<{ read: () => number }>(); function service() { return useContext(C); } function Child() { const s = service(); return <p>{s.read()}</p>; } function App() { const read = createMemo(async () => 1); return <><Loading fallback="wait"><C value={{ read }}><Child /></C></Loading><C value={{ read }}><Child /></C></>; }'))).toEqual(["ASYNC_OUTSIDE_LOADING_BOUNDARY"]);
  });

  it("preserves members destructured from a factory argument", () => {
    expect(codes(check('const C = createContext<{ read: () => number }>(); function make({ read }: { read: () => number }) { return { read: () => read() }; }' + consumer + 'function App() { const read = createMemo(async () => 1); const service = make({ read }); return <C value={service}><Child /></C>; }'))).toEqual(["ASYNC_OUTSIDE_LOADING_BOUNDARY"]);
  });

  it("sees module escapes through later helper calls", () => {
    expect(codes(check('const C = createContext<{ read: () => number }>(); let stored: { read: () => number } | undefined; function remember() { stored = useContext(C); } function recall() { return stored; } function Child() { remember(); const s = recall(); return <p>{s?.read()}</p>; } function App() { return <C value={{ read: () => 1 }}><Child /></C>; }'))).toEqual(["ASYNC_OUTSIDE_LOADING_BOUNDARY", "ERROR_OUTSIDE_ERRORED_BOUNDARY", "UNANALYZED_BOUNDARY"]);
  });

  it("does not evaluate an unused lazy prop", () => {
    expect(check('function Child(p: { value: number }) { return <p>unused</p>; } function App() { const value = createMemo(async () => { throw new Error("bad"); }); return <Child value={value()} />; }')).toEqual([]);
  });

  it("reads lazy JSX children under the child's boundaries", () => {
    expect(check('function Child(p: { children: JSX.Element }) { return <Errored fallback={() => "failed"}><Loading fallback="wait">{p.children}</Loading></Errored>; } function App() { const value = createMemo(async () => { throw new Error("bad"); }); return <Child><p>{value()}</p></Child>; }')).toEqual([]);
  });

  it("keeps the consuming prop read primary and all forwarding sites related", () => {
    const source = `function Leaf(p: { value: number }) { return <p>{p.value}</p>; }
function Middle(p: { value: number }) { return <Leaf value={p.value} />; }
function App() { const value = createMemo(async () => 1); return <Middle value={value()} />; }`;
    const diagnostics = check(source);
    expect(codes(diagnostics)).toEqual(["ASYNC_OUTSIDE_LOADING_BOUNDARY"]);
    expect(diagnostics[0].loc.line).toBe(4);
    expect(diagnostics[0].related?.map(r => r.loc.line)).toEqual(expect.arrayContaining([5, 6]));
  });

  it("invalidates escaped aliases but not another factory instance", () => {
    const source = 'declare function store(value: { read: () => number }): void; const C = createContext<{ read: () => number }>(); function make() { return { read: () => 1 }; } function Bad() { const s = useContext(C); const alias = s; try { store(alias); } catch {} return <p>{s.read()}</p>; }' + consumer + 'function App() { const first = make(); const second = make(); return <><C value={first}><Bad /></C><C value={second}><Child /></C></>; }';
    expect(codes(check(source))).toEqual(["ASYNC_OUTSIDE_LOADING_BOUNDARY", "ERROR_OUTSIDE_ERRORED_BOUNDARY", "UNANALYZED_BOUNDARY"]);
  });

  it("checks a factory's reads as setup, but its memo body as tracking", () => {
    expect(codes(check('function make() { const [count] = createSignal(1); const snapshot = count(); const double = createMemo(() => count() * 2); return { snapshot, double }; } function App() { const s = make(); return <p>{s.double()}</p>; }'))).toEqual(["STRICT_READ_UNTRACKED"]);
  });

  it("warns about a pending handler read even when its failure is caught", () => {
    expect(codes(check('const C = createContext<{ read: () => number }>(); function Child() { const s = useContext(C); return <button onClick={() => { try { s.read(); } catch {} }}>read</button>; } function App() { const read = createMemo(async () => { throw new Error("bad"); }); return <Loading fallback="wait"><C value={{ read }}><Child /></C></Loading>; }'))).toEqual(["PENDING_ASYNC_IN_HANDLER"]);
  });

  it("does not trust an injected synchronous function beside a safe fallback", () => {
    expect(codes(check('type Api = { save: () => void }; declare const injected: Api | undefined; function make(api: Api | undefined) { const actual = api ?? { save() {} }; return { save: () => actual.save() }; } const C = createContext<ReturnType<typeof make>>(); function Child() { const s = useContext(C); return <button onClick={() => s.save()}>save</button>; } function App() { return <C value={make(injected)}><Child /></C>; }'))).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  });

  it("uses warn plus worst case for an unmodeled member mutation", () => {
    expect(codes(check('const C = createContext<{ read: () => number }>(); function Child() { const s = useContext(C); s.read = () => 2; return <p>{s.read()}</p>; } function App() { return <C value={{ read: () => 1 }}><Child /></C>; }'))).toEqual(["ASYNC_OUTSIDE_LOADING_BOUNDARY", "ERROR_OUTSIDE_ERRORED_BOUNDARY", "UNANALYZED_BOUNDARY"]);
  });
});
