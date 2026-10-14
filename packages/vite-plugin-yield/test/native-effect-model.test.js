import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// The model gaps the Effect original exposed (D-121), each on its own.
const file = resolve(import.meta.dirname, "fixtures/native-effect-model.tsx");
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

describe("a saga its driver steps inside an action (D-121)", { timeout: 60_000 }, () => {
  const bridge = (
    call = "const it = steps(); let step = it.next(); while (!step.done) { const sent = (yield Promise.resolve(step.value)) as number; step = it.next(sent); } return step.value;"
  ) => `import { action, createSignal } from "solid-js";
function drive<R>(steps: () => Generator<number, R, number>) {
  return action(function* () {
    ${call}
  });
}`;

  it("performs the saga's writes where they are made", () => {
    const code = lower(`${bridge()}
export function Saga() {
  const [phase, setPhase] = createSignal("idle");
  const run = drive(function* () {
    setPhase("one");
    const n = yield 1;
    setPhase("two");
    return n;
  });
  return <button onClick={() => run()}>{phase()}</button>;
}`);
    expect(code).toContain('__nativeWrite(setPhase)("one")');
    expect(code).toContain('__nativeWrite(setPhase)("two")');
    expect(checked(code)).toEqual([]);
  });

  it("keeps a yielded value's narrowing (`yield step.value` in the driver's loop)", () => {
    const code = lower(`import { action } from "solid-js";
export function drive<R>(steps: () => Generator<Promise<number>, R, number>) {
  return action(function* () {
    const it = steps();
    let step = it.next(0);
    while (!step.done) step = it.next((yield step.value) as number);
    return step.value;
  });
}`);
    expect(code).toMatch(/__nativeAttempt\(\(_awaited => \(\) => _awaited\)\(step\.value\)/);
    expect(checked(code)).toEqual([]);
  });

  it("finds a driver bound to a const arrow", () => {
    const code = lower(`${bridge()
      .replace(
        "function drive<R>(steps: () => Generator<number, R, number>) {\n  return action(",
        "const drive = <R,>(steps: () => Generator<number, R, number>) => {\n  return action("
      )
      .replace(/\n  \}\);\n\}$/, "\n  });\n};")}
export function Saga() {
  const [phase, setPhase] = createSignal("idle");
  const run = drive(function* () {
    setPhase("one");
    const n = yield 1;
    setPhase("two");
    return n;
  });
  return <button onClick={() => run()}>{phase()}</button>;
}`);
    expect(code).toContain('__nativeWrite(setPhase)("one")');
    expect(checked(code)).toEqual([]);
  });

  it("leaves them plain when the driver calls the saga outside an action", () => {
    const code = lower(`import { createSignal } from "solid-js";
function later<R>(steps: () => Generator<number, R, number>) {
  setTimeout(() => steps().next(), 0);
}
export function Saga() {
  const [phase, setPhase] = createSignal("idle");
  later(function* () { setPhase("one"); yield 1; });
  return <p>{phase()}</p>;
}`);
    expect(code).not.toContain("__nativeWrite");
  });

  it("leaves a nested callback's write plain: it may run outside the action", () => {
    const code = lower(`${bridge()}
export function Saga() {
  const [phase, setPhase] = createSignal("idle");
  const run = drive(function* () {
    setTimeout(() => setPhase("late"), 0);
    return yield 1;
  });
  return <button onClick={() => run()}>{phase()}</button>;
}`);
    expect(code).not.toContain("__nativeWrite(setPhase)");
  });
});

describe("an action call whose promise the code keeps", { timeout: 60_000 }, () => {
  it("keeps the promise a `.catch` handles", () => {
    const code = lower(`import { action, createSignal } from "solid-js";
export function Save() {
  const [n, setN] = createSignal(0);
  const save = action(function* (k: number) { setN(k); return k; });
  return <button onClick={() => save(n() + 1).catch(() => {})}>{n()}</button>;
}`);
    expect(code).not.toMatch(/yield\* save\(/);
    expect(code).toMatch(/_receiver = save\(/);
    expect(checked(code)).toEqual([]);
  });

  it("keeps a plain function handed out as a value plain: it returns the promise", () => {
    const code = lower(`import { action, createSignal } from "solid-js";
function saver(set: (k: number) => void) {
  const base = action(function* (k: number) { set(k); return k; });
  const invoke = (k: number) => base(k);
  invoke.label = "save";
  return invoke;
}
export function Save() {
  const [n, setN] = createSignal(0);
  const save = saver(setN);
  return <button onClick={() => save(n() + 1).catch(() => {})}>{n()}</button>;
}`);
    expect(code).toContain("const invoke = (k: number) => base(k)");
    expect(checked(code)).toEqual([]);
  });
});

describe("types the model keeps", { timeout: 60_000 }, () => {
  it("a routine's declared result types its returned callback and its callers", () => {
    const code = lower(`import { createContext, useContext } from "solid-js";
const Scale = createContext<number | null>(null);
function scaler(): <T extends number>(value: T) => number {
  const scale = useContext(Scale);
  return scale ? value => value * scale : (((v: number) => v) as any);
}
export function Doubled() {
  const scale = scaler();
  return <p>{scale(2).toFixed(1)}</p>;
}`);
    expect(code).toMatch(/as <T extends number>\(value: T\) => number/);
    expect(checked(code)).toEqual([]);
  });

  it("a type guard's narrowing survives its attempt", () => {
    const code = lower(`import { createMemo } from "solid-js";
type Exit = { ok: true; value: number } | { ok: false; cause: string };
declare function isOk(exit: Exit): exit is { ok: true; value: number };
declare const exit: Exit;
export function Show() {
  const shown = createMemo(() => (isOk(exit) ? exit.value : exit.cause.length));
  return <p>{shown()}</p>;
}`);
    expect(code).toContain("__nativeGuarded(exit, yield* __nativeAttempt(() => isOk(exit)");
    expect(checked(code)).toEqual([]);
  });

  it("a generic method keeps its instantiation through a captured call", () => {
    const code = lower(`import { createMemo, createSignal } from "solid-js";
declare const Lib: { box<A>(value: A): { value: A } };
declare function make(n: number): number;
export function Boxed() {
  const [n] = createSignal(1);
  const boxed = createMemo(() => Lib.box(make(n())).value.toFixed(1));
  return <p>{boxed()}</p>;
}`);
    expect(checked(code)).toEqual([]);
  });

  it("reads a context with a default inside a memo", () => {
    const code = lower(`import { createContext, createMemo, useContext } from "solid-js";
const Unit = createContext<string | null>(null);
function unit() {
  const value = useContext(Unit);
  return value ?? "px";
}
export function Size() {
  const size = createMemo(() => 4 + unit());
  return <p>{size()}</p>;
}`);
    expect(checked(code)).toEqual([]);
  });

  it("attempts a routine's stream a memo returns", () => {
    const code =
      lower(`import { createContext, createMemo, createSignal, useContext, Loading } from "solid-js";
const Base = createContext<number | null>(null);
function ticks(n: number): AsyncIterable<number> {
  const base = useContext(Base) ?? 0;
  return { async *[Symbol.asyncIterator]() { yield base + n; } };
}
export function Ticks() {
  const [n] = createSignal(1);
  const tick = createMemo<number>(() => ticks(n()));
  return <Loading fallback="…"><p>{tick()}</p></Loading>;
}`);
    expect(code).toMatch(/const _stream = yield\* ticks\(/);
    expect(code).toMatch(/__nativeAttempt\(\(\) => _stream/);
  });
});

describe("stores and accessor props", { timeout: 60_000 }, () => {
  it("passes a store's root to For as a path", () => {
    const code = lower(`import { createStore, For } from "solid-js";
export function Cart() {
  const [cart] = createStore([{ name: "a", quantity: 1 }]);
  return <ul><For each={cart}>{item => <li>{item.name}: {item.quantity}</li>}</For></ul>;
}`);
    expect(code).toMatch(/each: cart\b/);
    expect(checked(code)).toEqual([]);
  });

  it("reads a store's value for its reduce", () => {
    const code = lower(`import { createStore } from "solid-js";
export function Total() {
  const [cart] = createStore([{ price: 2, quantity: 3 }]);
  const total = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return <p>{total()}</p>;
}`);
    expect(code).toContain("__nativeReadStore(cart");
    expect(checked(code)).toEqual([]);
  });

  it("reads a row of strings before a string member (F-S39)", () => {
    const code = lower(`import { createSignal, For } from "solid-js";
export function Words() {
  const [words] = createSignal(["a", "bb"]);
  return <ul><For each={words()}>{w => <li>{w.length}</li>}</For></ul>;
}`);
    expect(code).toContain("(yield* w).length");
    expect(checked(code)).toEqual([]);
  });

  it("reads a row of `any` before its member, unchecked as in the original", () => {
    const code = lower(`import { For } from "solid-js";
const cache = (fn: () => any) => { let last: any; return () => (last ??= fn()); };
export function Names() {
  const rows = cache(() => [{ name: "a" }]);
  return <ul><For each={rows()}>{row => <li>{row.name.toUpperCase()}</li>}</For></ul>;
}`);
    // the row's value is read once; its unknown method's failures are attempted
    expect(code).toContain("const _receiver = (yield* row).name;");
    expect(code).toMatch(/__nativeAttempt\(\(\) => _receiver\.toUpperCase/);
    expect(checked(code)).toEqual([]);
  });

  it("types an accessor prop by its value (F-S54)", () => {
    const code = lower(`import { createMemo, createSignal, For, isPending, latest } from "solid-js";
function Results(props: { results: () => string[] }) {
  const list = () => latest(props.results);
  return <ul class={isPending(props.results) ? "stale" : ""}><For each={list()}>{item => <li>{item}</li>}</For>{props.results().length}</ul>;
}
export function Search() {
  const [query] = createSignal("a");
  const results = createMemo(() => [query()]);
  return <Results results={results} />;
}`);
    expect(code).toMatch(/results: __NativeSource<string\[\]/);
    expect(code).toContain("(yield* props.results).length");
    expect(checked(code)).toEqual([]);
  });
});

describe("a provider's value computed in its own owner (D-122)", { timeout: 60_000 }, () => {
  const source = (
    around = tree => tree
  ) => `import { createContext, onCleanup, Errored } from "solid-js";
import { render } from "@solidjs/web";
const Runtime = createContext<{ id: number } | null>(null);
class NoRuntime extends Error {}
function createRuntime() {
  const runtime = { id: 1 };
  onCleanup(() => void runtime);
  if (Math.random() > 2) throw new NoRuntime("none");
  return runtime;
}
function Child() { return <p>child</p>; }
export function App() {
  return ${around("<Runtime value={createRuntime()}><Child/></Runtime>")};
}
render(() => <App/>, document.body);`;

  it("runs a value that cleans up and may fail as the provider's init", () => {
    const code = lower(source(tree => `<Errored fallback="!">${tree}</Errored>`));
    expect(code).toMatch(
      /Runtime\.provide\(\{\s*init: function\* \(\) \{\s*return yield\* createRuntime\(\)/
    );
    expect(checked(code)).toEqual([]);
  });

  it("its failure is the provider's: with no Errored above, the root's", () => {
    const code = lower(source());
    expect(checked(code).join("\n")).toMatch(/FOREIGN_HANDOFF[^]*NoRuntime/);
  });
});
