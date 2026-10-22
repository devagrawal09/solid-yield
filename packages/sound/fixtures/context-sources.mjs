// @ts-check
// Canonical sources for the context step; extract.mjs writes the .tsx copies.
/** @typedef {{ id: string, source: string }} Source */
/** @type {readonly Source[]} */
export const contextSources = [
  {
    "id": "context-plain-object",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ label: string }>();\nfunction Child() { const s = useContext(C); return <p>{s.label}</p>; }\nfunction App() { return <C value={{ label: \"ready\" }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-default",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext({ label: \"default\" });\nfunction App() { const s = useContext(C); return <p>{s.label}</p>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-missing-provider",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ label: string }>();\nfunction App() { const s = useContext(C); return <p>{s.label}</p>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-provider-over-default",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext({ read: () => 0 });\nfunction Child() { const s = useContext(C); return <p>{s.read()}</p>; }\nfunction App() { const read = createMemo(() => { throw new Error(\"bad\"); }); return <C value={{ read }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-signal-view",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ count: Accessor<number> }>();\nfunction Child() { const s = useContext(C); return <p>{s.count()}</p>; }\nfunction App() { const [count] = createSignal(1); return <C value={{ count }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-signal-setup",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ count: Accessor<number> }>();\nfunction Child() { const s = useContext(C); const n = s.count(); return <p>{n}</p>; }\nfunction App() { const [count] = createSignal(1); return <C value={{ count }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-factory-memo",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nfunction makeService() { const [count] = createSignal(1); const double = createMemo(() => count() * 2); return { double }; }\nconst C = createContext<ReturnType<typeof makeService>>();\nfunction Child() { const s = useContext(C); return <p>{s.double()}</p>; }\nfunction App() { const s = makeService(); return <C value={s}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-helper-alias",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ count: Accessor<number> }>();\nfunction service() { return useContext(C); }\nfunction Child() { const { count: read } = service(); const again = read; return <p>{again()}</p>; }\nfunction App() { const [count] = createSignal(1); return <C value={{ count }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-method-view",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nfunction makeService() { const [count] = createSignal(1); return { read: () => count() }; }\nconst C = createContext<ReturnType<typeof makeService>>();\nfunction Child() { const { read } = useContext(C); return <p>{read()}</p>; }\nfunction App() { const s = makeService(); return <C value={s}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-method-setup",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nfunction makeService() { const [count] = createSignal(1); return { read: () => count() }; }\nconst C = createContext<ReturnType<typeof makeService>>();\nfunction Child() { const s = useContext(C); const n = s.read(); return <p>{n}</p>; }\nfunction App() { const s = makeService(); return <C value={s}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-async-covered",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Child() { const s = useContext(C); return <p>{s.value()}</p>; }\nfunction App() { const value = createMemo(async () => 1); return <C value={{ value }}><Loading fallback=\"wait\"><Child /></Loading></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-async-uncovered",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Child() { const s = useContext(C); return <p>{s.value()}</p>; }\nfunction App() { const value = createMemo(async () => 1); return <C value={{ value }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-async-setup",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Child() { const s = useContext(C); const n = s.value(); return <p>{n}</p>; }\nfunction App() { const value = createMemo(async () => 1); return <C value={{ value }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-pending-handler",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Child() { const s = useContext(C); return <button onClick={() => { s.value(); }}>read</button>; }\nfunction App() { const value = createMemo(async () => 1); return <C value={{ value }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-failing-memo-covered",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Child() { const s = useContext(C); return <p>{s.value()}</p>; }\nfunction App() { const value = createMemo(() => { throw new Error(\"bad\"); }); return <C value={{ value }}><Errored fallback={() => \"failed\"}><Child /></Errored></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-failing-handler",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Child() { const s = useContext(C); return <button onClick={() => { s.value(); }}>read</button>; }\nfunction App() { const value = createMemo(() => { throw new Error(\"bad\"); }); return <C value={{ value }}><Errored fallback={() => \"failed\"}><Child /></Errored></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-promise-caught",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nfunction makeService() { return { save: async () => { throw new Error(\"bad\"); } }; }\nconst C = createContext<ReturnType<typeof makeService>>();\nfunction Child() { const { save: run } = useContext(C); return <button onClick={async () => { try { await run(); } catch { console.log(\"handled\"); } }}>save</button>; }\nfunction App() { const s = makeService(); return <C value={s}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-promise-uncaught",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nfunction makeService() { return { save: async () => { throw new Error(\"bad\"); } }; }\nconst C = createContext<ReturnType<typeof makeService>>();\nfunction Child() { const { save: run } = useContext(C); return <button onClick={async () => { await run(); }}>save</button>; }\nfunction App() { const s = makeService(); return <C value={s}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-optional-api-caught",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\ninterface Api { save(): Promise<void> }\nfunction makeService(api?: Api) { const actual = api ?? { save: async () => {} }; return { save: () => actual.save() }; }\nconst C = createContext<ReturnType<typeof makeService>>();\nfunction Child() { const s = useContext(C); return <button onClick={async () => { try { await s.save(); } catch { console.log(\"handled\"); } }}>save</button>; }\nfunction App(props: { api?: Api }) { const s = makeService(props.api); return <C value={s}><Child /></C>; }\ndeclare const injectedApi: Api | undefined;\nrender(() => <App api={injectedApi} />, document.body);\n"
  },
  {
    "id": "context-optional-api-uncaught",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\ninterface Api { save(): Promise<void> }\nfunction makeService(api?: Api) { const actual = api ?? { save: async () => {} }; return { save: () => actual.save() }; }\nconst C = createContext<ReturnType<typeof makeService>>();\nfunction Child() { const s = useContext(C); return <button onClick={async () => { await s.save(); }}>save</button>; }\nfunction App(props: { api?: Api }) { const s = makeService(props.api); return <C value={s}><Child /></C>; }\ndeclare const injectedApi: Api | undefined;\nrender(() => <App api={injectedApi} />, document.body);\n"
  },
  {
    "id": "context-injected-sync",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\ninterface Api { run(): void }\ndeclare const api: Api;\nconst C = createContext<Api>();\nfunction Child() { const { run: act } = useContext(C); return <button onClick={act}>run</button>; }\nfunction App() { return <C value={api}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-nested-shadow",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Child() { const s = useContext(C); return <p>{s.value()}</p>; }\nfunction App() { const outer = createMemo(async () => 1); const [inner] = createSignal(2); return <C value={{ value: outer }}><C value={{ value: inner }}><Child /></C></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-provider-identity",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst A = createContext<{ value: Accessor<number> }>({ value: () => 0 });\nconst B = createContext<{ value: Accessor<number> }>({ value: () => 2 });\nfunction Child() { const s = useContext(B); return <p>{s.value()}</p>; }\nfunction App() { const value = createMemo(async () => 1); return <A value={{ value }}><Child /></A>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-module-escape",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\ntype Service = { read: () => number };\nlet escaped: Service | undefined;\nconst C = createContext<Service>();\nfunction Child() { const s = useContext(C); escaped = s; return <p>{escaped.read()}</p>; }\nfunction App() { return <C value={{ read: () => 1 }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-unknown-escape",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\ntype Service = { read: () => number };\ndeclare function store(s: Service): void;\nconst C = createContext<Service>();\nfunction Child() { const s = useContext(C); try { store(s); } catch { console.log(\"handled\"); } return <p>{s.read()}</p>; }\nfunction App() { return <C value={{ read: () => 1 }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-prop-child-boundaries",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nfunction Child(p: { value: number }) { return <Errored fallback={() => \"failed\"}><Loading fallback=\"wait\"><p>{p.value}</p></Loading></Errored>; }\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Parent() { const s = useContext(C); return <Child value={s.value()} />; }\nfunction App() { const value = createMemo(async () => { throw new Error(\"bad\"); }); return <C value={{ value }}><Parent /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-prop-caller-boundaries",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nfunction Child(p: { value: number }) { return <p>{p.value}</p>; }\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Parent() { const s = useContext(C); return <Errored fallback={() => \"failed\"}><Loading fallback=\"wait\"><Child value={s.value()} /></Loading></Errored>; }\nfunction App() { const value = createMemo(async () => { throw new Error(\"bad\"); }); return <C value={{ value }}><Parent /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-prop-uncovered",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nfunction Child(p: { value: number }) { return <p>{p.value}</p>; }\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Parent() { const s = useContext(C); return <Child value={s.value()} />; }\nfunction App() { const value = createMemo(async () => { throw new Error(\"bad\"); }); return <C value={{ value }}><Parent /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "context-method-write-handler",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nfunction makeService() { const [count, setCount] = createSignal(0); return { count, set: () => setCount(1) }; }\nconst C = createContext<ReturnType<typeof makeService>>();\nfunction Child() { const s = useContext(C); return <button onClick={s.set}>{s.count()}</button>; }\nfunction App() { const s = makeService(); return <C value={s}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "m-context-loading-removed",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Child() { const s = useContext(C); return <p>{s.value()}</p>; }\nfunction App() { const value = createMemo(async () => 1); return <C value={{ value }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "m-context-errored-removed",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Child() { const s = useContext(C); return <p>{s.value()}</p>; }\nfunction App() { const value = createMemo(() => { throw new Error(\"bad\"); }); return <C value={{ value }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "m-context-catch-removed",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nfunction makeService() { return { save: async () => { throw new Error(\"bad\"); } }; }\nconst C = createContext<ReturnType<typeof makeService>>();\nfunction Child() { const { save: run } = useContext(C); return <button onClick={async () => { await run(); }}>save</button>; }\nfunction App() { const s = makeService(); return <C value={s}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "m-context-optional-catch-removed",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\ninterface Api { save(): Promise<void> }\nfunction makeService(api?: Api) { const actual = api ?? { save: async () => {} }; return { save: () => actual.save() }; }\nconst C = createContext<ReturnType<typeof makeService>>();\nfunction Child() { const s = useContext(C); return <button onClick={async () => { await s.save(); }}>save</button>; }\nfunction App(props: { api?: Api }) { const s = makeService(props.api); return <C value={s}><Child /></C>; }\ndeclare const injectedApi: Api | undefined;\nrender(() => <App api={injectedApi} />, document.body);\n"
  },
  {
    "id": "m-context-provider-removed",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ label: string }>();\nfunction Child() { const s = useContext(C); return <p>{s.label}</p>; }\nfunction App() { return <Child />; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "m-context-default-removed",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ label: string }>();\nfunction App() { const s = useContext(C); return <p>{s.label}</p>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "m-context-shadow-removed",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Child() { const s = useContext(C); return <p>{s.value()}</p>; }\nfunction App() { const outer = createMemo(async () => 1); const [inner] = createSignal(2); return <C value={{ value: outer }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "m-context-alias-setup",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ count: Accessor<number> }>();\nfunction service() { return useContext(C); }\nfunction Child() { const { count: read } = service(); const again = read; const n = again(); return <p>{n}</p>; }\nfunction App() { const [count] = createSignal(1); return <C value={{ count }}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "m-context-method-write-memo",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nfunction makeService() { const [count, setCount] = createSignal(0); return { count, set: () => setCount(1) }; }\nconst C = createContext<ReturnType<typeof makeService>>();\nfunction Child() { const s = useContext(C); const result = createMemo(() => s.set()); return <p>{result()}</p>; }\nfunction App() { const s = makeService(); return <C value={s}><Child /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "m-context-prop-child-loading-removed",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nfunction Child(p: { value: number }) { return <Errored fallback={() => \"failed\"}><p>{p.value}</p></Errored>; }\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Parent() { const s = useContext(C); return <Child value={s.value()} />; }\nfunction App() { const value = createMemo(async () => { throw new Error(\"bad\"); }); return <C value={{ value }}><Parent /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "m-context-prop-child-errored-removed",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nfunction Child(p: { value: number }) { return <Loading fallback=\"wait\"><p>{p.value}</p></Loading>; }\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Parent() { const s = useContext(C); return <Child value={s.value()} />; }\nfunction App() { const value = createMemo(async () => { throw new Error(\"bad\"); }); return <C value={{ value }}><Parent /></C>; }\nrender(() => <App />, document.body);\n"
  },
  {
    "id": "m-context-read-to-handler",
    "source": "import { createContext, useContext, createSignal, createMemo, Loading, Errored } from \"solid-js\";\nimport type { Accessor } from \"solid-js\";\nimport { render } from \"@solidjs/web\";\nconst C = createContext<{ value: Accessor<number> }>();\nfunction Child() { const s = useContext(C); return <button onClick={() => { s.value(); }}>read</button>; }\nfunction App() { const value = createMemo(async () => 1); return <C value={{ value }}><Loading fallback=\"wait\"><Child /></Loading></C>; }\nrender(() => <App />, document.body);\n"
  }
];
