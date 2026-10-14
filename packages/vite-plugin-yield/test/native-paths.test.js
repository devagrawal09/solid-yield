import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRequire } from "node:module";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Paths of the native lowering the language surface and the example apps did
// not reach (found by measuring what the whole test system exercises), each
// a program checked as plain Solid says. Three found bugs: an event handler's
// parameter typed as `Event` beyond key, input and mouse events (Solid types
// each event: `PointerEvent`, `SubmitEvent`, …) and untyped when destructured;
// a class expression's failure named `__class`; and a break or continue
// leaving a catch refused (it is a completion record now, native-jumps.test.js).
const require = createRequire(import.meta.url);
const { check } = require("../../ts-plugin-yield/src/cli.cjs");
const base = resolve(import.meta.dirname, `.native-generated/paths-${process.pid}`);
const options = {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  target: "ESNext",
  module: "ESNext",
  moduleResolution: "Bundler",
  jsx: "preserve",
  jsxImportSource: "solid-yield",
  jsxFactory: "jsx",
  jsxFragmentFactory: "Fragment",
  types: [],
  lib: ["ESNext", "DOM"]
};

/** `[name, source, expected error codes]`: checked together */
const programs = [
  // a callback prop's write in a nested helper: still the child's event
  [
    "callback-prop-nested-write",
    `import { createSignal } from "solid-js";
function Child(props: { onPick: (v: number) => void }) {
  return <button onClick={() => props.onPick(1)}>x</button>;
}
export function App() {
  const [n, setN] = createSignal(0);
  return (
    <>
      <Child onPick={v => { const apply = () => setN(v); apply(); }} />
      <p>{n()}</p>
    </>
  );
}`,
    []
  ],
  // an async memo's returns, past a nested function's
  [
    "async-memo-nested-function",
    `import { createSignal, createMemo, createStore, isPending, Errored, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const m = createMemo(async () => {
    const twice = (x: number) => { return x * 2; };
    return twice(1);
  });
  return <Loading fallback={<p>…</p>}><p>{m()}</p></Loading>;
}
render(App, document.body);`,
    []
  ],
  // a class expression is named by its variable (NotFound, not __class)
  [
    "class-expression-error",
    `import { createSignal, createMemo, createStore, isPending, Errored, Loading } from "solid-js";
import { render } from "@solidjs/web";
const NotFound = class extends Error {};
export function App() {
  const [n] = createSignal(1);
  const m = createMemo(() => { if (n() < 0) throw new NotFound("missing"); return n(); });
  return <p>{m()}</p>;
}
render(App, document.body);`,
    ["FOREIGN_HANDOFF"]
  ],
  // awaits inside a receiver and an argument
  [
    "await-in-receiver-and-argument",
    `import { createSignal, createMemo, createStore, isPending, Errored, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [n, setN] = createSignal(0);
  return <button onClick={async () => {
    try {
      const kind = (await fetch("/x?n=" + n())).headers.get("content-type");
      setN(Math.max(0, 1 + ((await (await fetch("/y")).json()) as number)) + (kind ? 1 : 0));
    } catch (e) {
      /* @yield-absorb: logged */
      console.error(e);
    }
  }}>{n()}</button>;
}`,
    []
  ],
  // an async handler's destructured event
  [
    "async-handler-destructured",
    `import { createSignal, createMemo, createStore, isPending, Errored, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [n, setN] = createSignal(0);
  return <input onInput={async ({ currentTarget }) => { setN(Number(currentTarget.value)); }} value={String(n())} />;
}`,
    []
  ],
  // isPending(() => { return m(); })
  [
    "is-pending-block-thunk",
    `import { createSignal, createMemo, createStore, isPending, Errored, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const m = createMemo(async () => 1);
  return <Loading fallback={<p>…</p>}><p>{isPending(() => { return m(); }) ? "…" : m()}</p></Loading>;
}
render(App, document.body);`,
    []
  ],
  // a function declared in a finally
  [
    "finally-nested-function",
    `import { createSignal, createMemo, createStore, isPending, Errored, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [n] = createSignal(1);
  const m = createMemo(() => {
    let out = 0;
    try { out = JSON.parse(String(n())) as number; } catch { /* @yield-absorb: a number parses */ out = -1; } finally { const log = () => { return out; }; log(); }
    return out;
  });
  return <p>{m()}</p>;
}`,
    []
  ],
  // onPointerDown: a PointerEvent
  [
    "event-pointer",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(0);
  return <div onPointerDown={e => setN(e.pointerId)}>{n()}</div>;
}`,
    []
  ],
  // onSubmit: a SubmitEvent
  [
    "event-submit",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(0);
  return <form onSubmit={e => { e.preventDefault(); setN(e.submitter ? 1 : 0); }}>{n()}</form>;
}`,
    []
  ],
  // onWheel, onFocusIn
  [
    "event-wheel-focus",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(0);
  return <div onWheel={e => setN(e.deltaY)} onFocusIn={e => setN(e.relatedTarget ? 1 : 0)}>{n()}</div>;
}`,
    []
  ],
  // ({ currentTarget }) => …
  [
    "event-destructured",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(0);
  return <input onChange={({ currentTarget }) => setN(currentTarget.checked ? 1 : 0)} type="checkbox" checked={n() > 0} />;
}`,
    []
  ],
  // a default the event type rejects: plain TypeScript's TS2322
  [
    "event-destructured-default",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(0);
  return <input onKeyDown={({ key } = new KeyboardEvent("keydown")) => setN(key.length)} value={String(n())} />;
}`,
    ["TS2322"]
  ],
  // onDragStart, onPaste
  [
    "event-drag-clipboard",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(0);
  return <div onDragStart={e => setN(e.dataTransfer ? 1 : 0)} onPaste={e => setN(e.clipboardData?.getData("text").length ?? 0)}>{n()}</div>;
}`,
    []
  ],
  // a property the event lacks is still an error (a near miss: TS2551)
  [
    "event-wrong-property",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(0);
  return <div onPointerDown={e => setN(e.pointerIdd)}>{n()}</div>;
}`,
    ["TS2551"]
  ],
  // break in a catch, out of its loop
  [
    "break-in-catch",
    `import { createSignal, createMemo, createStore, isPending, Errored, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [items] = createSignal(["1", "x", "3"]);
  const m = createMemo(() => {
    let total = 0;
    for (const s of items()) {
      try { total += JSON.parse(s) as number; } catch { /* @yield-absorb: stop at the first bad item */ break; }
    }
    return total;
  });
  return <p>{m()}</p>;
}`,
    []
  ],
  // continue in a catch
  [
    "continue-in-catch",
    `import { createSignal, createMemo, createStore, isPending, Errored, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [items] = createSignal(["1", "x", "3"]);
  const m = createMemo(() => {
    let total = 0;
    for (const s of items()) {
      try { total += JSON.parse(s) as number; } catch { /* @yield-absorb: skip a bad item */ continue; }
      total += 1;
    }
    return total;
  });
  return <p>{m()}</p>;
}`,
    []
  ],
  // continue outer from a catch beside a return
  [
    "labeled-continue-and-return",
    `import { createSignal, createMemo } from "solid-js";
export function App() {
  const [rows] = createSignal([["1", "x"], ["3"]]);
  const m = createMemo(() => {
    let total = 0;
    outer: for (const row of rows()) {
      for (const s of row) {
        try {
          if (s === "stop") return -1;
          total += JSON.parse(s) as number;
        } catch {
          /* @yield-absorb: skip the rest of a bad row */
          continue outer;
        }
      }
      if (total > 100) break outer;
    }
    return total;
  });
  return <p>{m()}</p>;
}`,
    []
  ],
  // a switch's break stays; the loop's crosses
  [
    "switch-break-inside-try",
    `import { createSignal, createMemo } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  const m = createMemo(() => {
    let out = "";
    for (let i = 0; i < n(); i++) {
      try {
        switch (i) { case 0: out += "a"; break; default: out += JSON.parse("1"); }
        if (i > 5) break;
      } catch {
        /* @yield-absorb: a literal parses */
        out += "?";
      }
    }
    return out;
  });
  return <p>{m()}</p>;
}`,
    []
  ],
  // a handler's loop
  [
    "break-in-catch-in-event",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(0);
  return <button onClick={() => {
    for (const s of ["1", "x"]) {
      try { setN(n() + (JSON.parse(s) as number)); } catch { /* @yield-absorb: stop */ break; }
    }
  }}>{n()}</button>;
}`,
    []
  ],
  // a row's arrow reading its component's `arguments`: Babel hoists it, as it does `this`
  [
    "row-arguments",
    `import { createSignal, For } from "solid-js";
export function App(props: { label: string }) {
  const [items] = createSignal([1, 2]);
  return <ul><For each={items()}>{x => <li>{x}{arguments.length}{props.label}</li>}</For></ul>;
}`,
    []
  ],
  [
    "arrow-component-this",
    `import { createSignal } from "solid-js";
export const App = () => {
  const [n] = createSignal(1);
  return <p>{n()}{String(this)}</p>;
};`,
    []
  ],
  // a self-recursive component (Sierpinski's shape): a prop read in member
  // arithmetic, a braceless early return, a failing prop, a Math call
  [
    "recursion-member",
    `import { render } from "@solidjs/web";
type TreeProps = { depth: number; children: number };
const Tree = (props: TreeProps) => {
  let { depth } = props;
  if (depth <= 0) return <i>{props.children}</i>;
  depth = depth - 1;
  return <b><Tree depth={props.depth - 1}>{props.children}</Tree><Tree depth={depth}>{props.children}</Tree></b>;
};
export function App() {
  return <Tree depth={3}>{1}</Tree>;
}
render(App, document.body);`,
    []
  ],
  [
    "recursion-failing-prop",
    `import { createSignal, createMemo, Errored } from "solid-js";
import { render } from "@solidjs/web";
type TreeProps = { depth: number; children: number };
const Tree = (props: TreeProps) => {
  let { depth } = props;
  if (depth <= 0) return <i>{props.children}</i>;
  depth = depth - 1;
  return <b><Tree depth={depth}>{props.children}</Tree></b>;
};
export function App() {
  const [n] = createSignal(1);
  const checked = createMemo(() => { if (n() < 0) throw new RangeError("negative"); return n(); });
  return <Errored fallback={() => <p>failed</p>}><Tree depth={3}>{checked()}</Tree></Errored>;
}
render(App, document.body);`,
    []
  ],
  [
    "recursion-math-write",
    `import { render } from "@solidjs/web";
type TreeProps = { depth: number; children: number };
const Tree = (props: TreeProps) => {
  let { depth } = props;
  if (depth <= 0) return <i>{props.children}</i>;
  depth = Math.floor(depth / 2);
  return <b><Tree depth={depth}>{props.children}</Tree></b>;
};
export function App() {
  return <Tree depth={3}>{1}</Tree>;
}
render(App, document.body);`,
    []
  ],
  // D-125: a component is checked whatever it returns; what its return
  // computes outside the JSX is computed in the body (READ_IN_SETUP)
  [
    "return-ternary",
    `import { createSignal } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  return n() > 1 ? <b>big</b> : <i>small</i>;
}`,
    ["READ_IN_SETUP"]
  ],
  [
    "return-ternary-pending",
    `import { createMemo } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const n = createMemo(async () => 1);
  return n() > 1 ? <b>big</b> : <i>small</i>;
}
render(App, document.body);`,
    ["READ_IN_SETUP"]
  ],
  [
    "return-and",
    `import { createSignal } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  return n() > 1 && <b>big</b>;
}`,
    ["READ_IN_SETUP"]
  ],
  [
    "return-string",
    `import { createSignal } from "solid-js";
export function App() {
  return "plain text";
}`,
    []
  ],
  [
    "return-array",
    `import { createSignal } from "solid-js";
export function App() {
  return [<b>a</b>, <i>b</i>];
}`,
    []
  ],
  [
    "return-bare",
    `import { createSignal } from "solid-js";
export function App(props: { show: boolean }) {
  if (!props.show) return;
  return <p>shown</p>;
}`,
    ["READ_IN_SETUP"]
  ],
  [
    "return-null",
    `import { createSignal, createMemo, createContext, useContext, Errored } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [n] = createSignal(1);
  if (Math.random() > 2) return null;
  return <p>{n()}</p>;
}`,
    []
  ],
  // a function of the file handed by name to an array method is an inline
  // callback (`items().map(scale)`); a built-in (`map(Number)`) stays plain
  [
    "named-callback",
    `import { createSignal, createMemo } from "solid-js";
export function App() {
  const [n] = createSignal(2);
  const [items] = createSignal([1, 2]);
  function scale(x: number) { return x * n(); }
  const m = createMemo(() => items().map(scale).join());
  return <p>{m()}</p>;
}`,
    []
  ],
  [
    "named-comparator",
    `import { createSignal, createMemo } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  const [items] = createSignal([3, 1, 2]);
  const byWeight = (a: number, b: number) => (a - b) * n();
  const m = createMemo(() => [...items()].sort(byWeight).join());
  return <p>{m()}</p>;
}`,
    []
  ],
  [
    "builtin-callback",
    `import { createSignal, createMemo } from "solid-js";
export function App() {
  const [items] = createSignal(["1", "2"]);
  const m = createMemo(() => items().map(Number).join());
  return <p>{m()}</p>;
}`,
    []
  ],
  [
    "named-callback-in-setup",
    `import { createSignal } from "solid-js";
export function App() {
  const [n] = createSignal(2);
  const scale = (x: number) => x * n();
  const doubled = [1, 2].map(scale);
  return <p>{doubled.join()}</p>;
}`,
    ["READ_IN_SETUP"]
  ],
  // a reduce's seed is not a callback: only the first argument is wrapped
  [
    "named-reducer",
    `import { createSignal, createMemo } from "solid-js";
export function App() {
  const [n] = createSignal(2);
  const [items] = createSignal([1, 2]);
  const add = (total: number, x: number) => total + x * n();
  const m = createMemo(() => items().reduce(add, 0));
  return <p>{m()}</p>;
}`,
    []
  ],
  // a context called as a function is its JSX form (D-116: valid Solid)
  [
    "context-call-return",
    `import { createContext, useContext } from "solid-js";
const Theme = createContext("light");
function Themed() {
  return <p>{useContext(Theme)}</p>;
}
export function App() {
  return Theme({ value: "dark", children: () => <Themed /> });
}`,
    []
  ],
  // a context without a default read in a hole is the component's read
  [
    "context-required-in-hole",
    `import { createContext, useContext, createSignal } from "solid-js";
const Ctx = createContext<{ count: () => number }>();
function InPlace() {
  return <p>{useContext(Ctx).count()}</p>;
}
export function App() {
  const [n] = createSignal(1);
  return <Ctx value={{ count: n }}><InPlace /></Ctx>;
}`,
    []
  ],
  [
    "context-read-in-row",
    `import { createContext, useContext, createSignal, For } from "solid-js";
const Ctx = createContext<{ count: () => number }>();
function Rows() {
  const [items] = createSignal([1, 2]);
  return <For each={items()}>{x => <p>{useContext(Ctx).count() + x}</p>}</For>;
}
export function App() {
  const [n] = createSignal(1);
  return <Ctx value={{ count: n }}><Rows /></Ctx>;
}`,
    []
  ],
  [
    "context-two-reads-in-place",
    `import { createContext, useContext, createSignal } from "solid-js";
const Ctx = createContext<{ count: () => number; label: string }>();
function Both() {
  return <p title={useContext(Ctx).label}>{useContext(Ctx).count()}</p>;
}
export function App() {
  const [n] = createSignal(1);
  return <Ctx value={{ count: n, label: "x" }}><Both /></Ctx>;
}`,
    []
  ],
  // a destructured accessor and action: read where used; the action is the event's (F-S40)
  [
    "context-destructured-accessor-action",
    `import { createContext, useContext, createSignal } from "solid-js";
import type { JSX } from "@solidjs/web";
const Ctx = createContext<{ count: () => number; bump: () => void }>();
function Provider(props: { children: JSX.Element }) {
  const [count, setCount] = createSignal(0);
  return <Ctx value={{ count, bump: () => setCount(count() + 1) }}>{props.children}</Ctx>;
}
function Child() {
  const { count, bump } = useContext(Ctx);
  return <button onClick={() => bump()}>{count()}</button>;
}
export function App() {
  return <Provider><Child /></Provider>;
}`,
    []
  ],
  [
    "context-tuple-accessor-action",
    `import { createContext, useContext, createSignal } from "solid-js";
import type { JSX } from "@solidjs/web";
const Ctx = createContext<[() => number, { bump: () => void }]>();
function Provider(props: { children: JSX.Element }) {
  const [count, setCount] = createSignal(0);
  return <Ctx value={[count, { bump: () => setCount(count() + 1) }]}>{props.children}</Ctx>;
}
function Child() {
  const [count, { bump }] = useContext(Ctx);
  return <button onClick={() => bump()}>{count()}</button>;
}
export function App() {
  return <Provider><Child /></Provider>;
}`,
    []
  ],
  [
    "context-reader-in-value",
    `import { createContext, useContext, createSignal } from "solid-js";
import type { JSX } from "@solidjs/web";
const Ctx = createContext<{ double: () => number }>();
function Provider(props: { children: JSX.Element }) {
  const [count] = createSignal(2);
  return <Ctx value={{ double: () => count() * 2 }}>{props.children}</Ctx>;
}
function Child() {
  const { double } = useContext(Ctx);
  return <p>{double()}</p>;
}
export function App() {
  return <Provider><Child /></Provider>;
}`,
    []
  ],
  // a promise chain a component body starts and that cannot fail runs on after it, as in Solid; its continuation is an event's
  [
    "setup-promise-continuation",
    `import { createSignal } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  const [out, setOut] = createSignal(0);
  Promise.resolve(2).then(v => setOut(v + n()));
  return <p>{out()}</p>;
}`,
    []
  ],
  [
    "setup-promise-caught",
    `import { createSignal } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  const [out, setOut] = createSignal(0);
  Promise.resolve(2).then(v => setOut(v + n())).catch(() => {});
  return <p>{out()}</p>;
}`,
    []
  ],
  // one that may reject has no boundary in the body (review 3)
  [
    "setup-promise-rejects",
    `import { createSignal } from "solid-js";
class Bad extends Error {}
async function risk(): Promise<number> { throw new Bad(); }
export function App() {
  const [n] = createSignal(1);
  const [out, setOut] = createSignal(0);
  risk().then(v => setOut(v + n()));
  return <p>{out()}</p>;
}`,
    ["NATIVE_SETUP_FAILURE"]
  ],
  // D-125: a braceless return's computed part is the body's
  [
    "return-braceless-split",
    `import { createSignal } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  if (n() > 5) return n() > 9 ? <b>big</b> : <i>mid</i>;
  return <p>small</p>;
}`,
    ["READ_IN_SETUP"]
  ],
  // a function declaration only a timer runs is an event's
  [
    "scheduled-declaration",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(1);
  function tick() { setN(n() + 1); }
  setInterval(tick, 1000);
  return <p>{n()}</p>;
}`,
    []
  ],
  [
    "map-in-helper",
    `import { createSignal } from "solid-js";
function labels(items: () => number[], n: () => number) {
  return items().map(x => x + n());
}
export function App() {
  const [items] = createSignal([1, 2]);
  const [n] = createSignal(1);
  return <p>{labels(items, n).join()}</p>;
}`,
    []
  ],
  // a function declaration handed out returns its action's promise (D-121)
  [
    "handed-out-declaration",
    `import { action, createSignal } from "solid-js";
function saver(set: (k: number) => void) {
  const base = action(function* (k: number) { set(k); return k; });
  function invoke(k: number) { return base(k); }
  invoke.label = "save";
  return invoke;
}
export function Save() {
  const [n, setN] = createSignal(0);
  const save = saver(setN);
  return <button onClick={() => save(n() + 1).catch(() => {})}>{n()}</button>;
}`,
    []
  ],
  [
    "getter-nested-function-class",
    `import { createSignal } from "solid-js";
export function App() {
  const [n] = createSignal(2);
  const totals = {
    get total() {
      const double = function (x: number) { return x * 2; };
      class Box { v = 1; }
      return double(n()) + new Box().v;
    }
  };
  return <p>{totals.total}</p>;
}`,
    []
  ],
  // a callback prop calling a routine that writes is the event's that calls it (F-S40)
  [
    "prop-calls-writing-routine",
    `import { createSignal } from "solid-js";
function Child(props: { onBump: () => void }) {
  return <button onClick={() => props.onBump()}>+</button>;
}
export function App() {
  const [n, setN] = createSignal(0);
  function bumpTwice() { setN(n() + 2); }
  return <div><p>{n()}</p><Child onBump={() => bumpTwice()} /></div>;
}`,
    []
  ],
  // a provider's getter (D-124) is a source its slot holds: read where the member is
  [
    "context-getter-member",
    `import { createContext, useContext, createSignal } from "solid-js";
import type { JSX } from "@solidjs/web";
const Ctx = createContext<{ readonly count: number }>();
function Provider(props: { children: JSX.Element }) {
  const [n] = createSignal(0);
  return <Ctx value={{ get count() { return n(); } }}>{props.children}</Ctx>;
}
function Child() {
  const value = useContext(Ctx);
  return <p>{value.count}</p>;
}
export function App() {
  return <Provider><Child /></Provider>;
}`,
    []
  ],
  // destructured, Solid reads it once in the body: a read in setup
  [
    "context-getter-destructured",
    `import { createContext, useContext, createSignal } from "solid-js";
import type { JSX } from "@solidjs/web";
const Ctx = createContext<{ readonly count: number }>();
function Provider(props: { children: JSX.Element }) {
  const [n] = createSignal(0);
  return <Ctx value={{ get count() { return n(); } }}>{props.children}</Ctx>;
}
function Child() {
  const { count } = useContext(Ctx);
  return <p>{count}</p>;
}
export function App() {
  return <Provider><Child /></Provider>;
}`,
    ["READ_IN_SETUP"]
  ],
  // a store in a context's value, with an action typed by its declared slot
  [
    "context-store-tuple",
    `import { createContext, useContext, createStore } from "solid-js";
import type { JSX } from "@solidjs/web";
type State = { items: string[] };
const Ctx = createContext<[State, { add: (s: string) => void }]>();
function Provider(props: { children: JSX.Element }) {
  const [state, setState] = createStore<State>({ items: [] });
  return <Ctx value={[state, { add: s => setState(st => { st.items.push(s); }) }]}>{props.children}</Ctx>;
}
function Child() {
  const [state, { add }] = useContext(Ctx);
  return <button onClick={() => add("x")}>{state.items.length}</button>;
}
export function App() {
  return <Provider><Child /></Provider>;
}`,
    []
  ],
  // a context declared in one file, provided (as a call) and destructured in another: the provider's getter is found across files
  [
    "ctx-shared",
    `import { createContext } from "solid-js";
export const Shared = createContext<{ readonly count: number; label: () => string }>();`,
    []
  ],
  [
    "ctx-shared-consumer",
    `import { createSignal, useContext } from "solid-js";
import { Shared } from "./ctx-shared";
function Reader() {
  const { count, label } = useContext(Shared);
  return <p title={label()}>{count}</p>;
}
export function SharedApp() {
  const [n] = createSignal(1);
  return Shared({ value: { get count() { return n(); }, label: () => "x" }, children: () => <Reader /> });
}`,
    ["READ_IN_SETUP"]
  ],
  // a context call's spread is its JSX form's
  [
    "ctx-spread-call",
    `import { createContext, useContext } from "solid-js";
const Theme = createContext("light");
function Themed() {
  return <p>{useContext(Theme)}</p>;
}
export function App() {
  const props = { value: "dark" };
  return Theme({ ...props, children: () => <Themed /> });
}`,
    []
  ],
  // a context read in an array callback of the view is the component's
  [
    "ctx-read-in-map",
    `import { createContext, useContext, createSignal } from "solid-js";
const Scale = createContext(2);
export function App() {
  const [items] = createSignal([1, 2]);
  return <ul>{items().map(x => <li>{x * useContext(Scale)}</li>)}</ul>;
}`,
    []
  ],
  // a foreign component's render callback with a block body returns a checked view
  [
    "foreign-block-callback",
    `import { createSignal } from "solid-js";
import type { JSX } from "@solidjs/web";
declare const List: (props: { each: number[]; children: (n: number) => JSX.Element }) => JSX.Element;
export function App() {
  const [n] = createSignal(1);
  return <List each={[1, 2]}>{x => { const d = x * 2; return <p>{d}</p>; }}</List>;
}`,
    []
  ],
  // a spread object's handler computed by a call stays as written (D-116)
  [
    "spread-handler-call",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(1);
  const make = (k: number) => () => setN(n() + k);
  return <button {...{ onClick: make(2) }}>{n()}</button>;
}`,
    []
  ],
  // a signal handed as an accessor to a foreign function inside a memo's
  // attempt thunk: taken before the statement, outside the thunk
  [
    "accessor-in-attempt-thunk",
    `import { createSignal, createMemo, Errored } from "solid-js";
declare function sample(get: () => number): number;
export function App() {
  const [n] = createSignal(1);
  const m = createMemo(() => sample(n) + 1);
  return <Errored fallback={() => <p>failed</p>}><p>{m()}</p></Errored>;
}`,
    []
  ],
  // a context typed by a class: its slots are the class's, not a literal's
  [
    "context-class-typed",
    `import { createContext, useContext } from "solid-js";
class Settings {
  constructor(public theme: string) {}
}
const Ctx = createContext<Settings>();
function Themed() {
  const settings = useContext(Ctx);
  return <p>{settings.theme}</p>;
}
export function App() {
  return <Ctx value={new Settings("dark")}><Themed /></Ctx>;
}`,
    []
  ],
  // a context typed in parentheses
  [
    "context-parenthesized-type",
    `import { createContext, useContext, createSignal } from "solid-js";
const Ctx = createContext<({ count: () => number; bump: () => void })>();
function Counter() {
  const { count, bump } = useContext(Ctx);
  return <button onClick={() => bump()}>{count()}</button>;
}
export function App() {
  const [n, setN] = createSignal(0);
  return <Ctx value={{ count: n, bump: () => setN(n() + 1) }}><Counter /></Ctx>;
}`,
    []
  ],
  // an async handler with no reactive work stays a producer behind one
  // attempt; its destructured parameter keeps Solid's event type
  [
    "async-handler-destructured",
    `async function save(text: string | null): Promise<void> {
  if (!text) throw new Error("empty");
}
export function App() {
  return (
    <button
      onClick={async ({ currentTarget }) => {
        try {
          await save(currentTarget.textContent);
        } catch (error) {
          /* @yield-absorb: logged */
          console.error(error);
        }
      }}
    >
      save
    </button>
  );
}`,
    []
  ],
  // the same handler uncaught: its rejection reaches no boundary (Errored
  // does not catch an event's)
  [
    "async-handler-destructured-uncaught",
    `import { Errored } from "solid-js";
async function save(text: string | null): Promise<void> {
  if (!text) throw new Error("empty");
}
export function App() {
  return (
    <Errored fallback={() => <p>failed</p>}>
      <button onClick={async ({ currentTarget }) => { await save(currentTarget.textContent); }}>save</button>
    </Errored>
  );
}`,
    ["EVENT_REJECTS"]
  ],
  // a helper mapping over an array with a read in its callback: the read is
  // its caller's (a memo's, a hole's; in the body it is read once)
  ...[
    ["helper-map-memo", "const m = createMemo(() => scaled([1, 2]).join());", "<p>{m()}</p>", []],
    ["helper-map-hole", "", "<p>{scaled([3]).join()}</p>", []],
    ["helper-map-body", "const once = scaled([4]);", "<p>{once.join()}</p>", ["READ_IN_SETUP"]]
  ].map(([name, body, view, expected]) => [
    name,
    `import { createSignal, createMemo } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  function scaled(xs: number[]) {
    return xs.map(x => x * n());
  }
  ${body}
  return ${view};
}`,
    expected
  ]),
  // JSX built in a component's body: the JSX is out of place (D-041), also
  // when it holds a read or is handed to a function there
  [
    "jsx-in-body-read",
    `import { createSignal } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  const views = [<p>{n()}</p>, <b>{n()}</b>];
  return <div>{views}</div>;
}`,
    ["JSX_IN_SETUP"]
  ],
  [
    "jsx-in-body-argument",
    `import { createSignal } from "solid-js";
declare function keep(e: unknown): void;
export function App() {
  const [n] = createSignal(1);
  keep(<p>{n()}</p>);
  return <div>{n()}</div>;
}`,
    ["JSX_IN_SETUP"]
  ],
  // a prop of any or unknown is declared at the component, reported at both
  [
    "prop-any",
    `function Child(props: { icon: any; label: unknown }) {
  return <i>{props.icon}</i>;
}
export function App() {
  return <Child icon={<svg />} label="x" />;
}`,
    ["PROP_TYPE"]
  ],
  // an effect reading a failing memo at the root: the failure is the memo's
  [
    "effect-reads-failing-memo-at-root",
    `import { createSignal, createMemo, createEffect } from "solid-js";
import { render } from "@solidjs/web";
function App() {
  const [n] = createSignal(1);
  const checked = createMemo(() => {
    if (n() > 5) throw new RangeError("big");
    return n();
  });
  createEffect(
    () => checked(),
    v => console.log(v)
  );
  return <p>{n()}</p>;
}
render(() => <App />, document.body);`,
    ["FOREIGN_HANDOFF"]
  ],
  // a function expression handed by name to an array method
  [
    "named-function-expression-callback",
    `import { createSignal, createMemo } from "solid-js";
export function App() {
  const [n] = createSignal(2);
  const [items] = createSignal([1, 2]);
  const scale = function (x: number) { return x * n(); };
  const m = createMemo(() => items().map(scale).join());
  return <p>{m()}</p>;
}`,
    []
  ],
  // a context's value destructured two deep, provided by Solid 1's Provider
  // member: the closing tag no longer hides the provider's value
  [
    "context-provider-member-nested",
    `import { createContext, useContext, createMemo } from "solid-js";
import { render } from "@solidjs/web";
const Ctx = createContext<{ nested: { parse: (s: string) => number } }>();
function parse(s: string): number {
  if (!s) throw new RangeError("empty");
  return s.length;
}
function Child() {
  const {
    nested: { parse: p }
  } = useContext(Ctx);
  const n = createMemo(() => p("x"));
  return <p>{n()}</p>;
}
function App() {
  return (
    <Ctx.Provider value={{ nested: { parse } }}>
      <Child />
    </Ctx.Provider>
  );
}
render(() => <App />, document.body);`,
    ["FOREIGN_HANDOFF"]
  ],
  // a member called through a name destructured from a context's value
  [
    "context-destructured-member-call",
    `import { createContext, useContext, createMemo } from "solid-js";
import { render } from "@solidjs/web";
const Ctx = createContext<{ nested: { parse: (s: string) => number } }>();
function parse(s: string): number {
  if (!s) throw new RangeError("empty");
  return s.length;
}
function Child() {
  const { nested } = useContext(Ctx);
  const n = createMemo(() => nested.parse("x"));
  return <p>{n()}</p>;
}
function App() {
  return (
    <Ctx value={{ nested: { parse } }}>
      <Child />
    </Ctx>
  );
}
render(() => <App />, document.body);`,
    ["FOREIGN_HANDOFF"]
  ],
  // a context guard by `=== null` or `=== undefined` fires only where the
  // context's type admits that value
  [
    "context-guard-null",
    `import { createContext, useContext } from "solid-js";
const A = createContext<{ n: number } | null>();
export function Child() {
  const a = useContext(A);
  if (a === null) throw new Error("no a");
  return <p>{a.n}</p>;
}`,
    ["NATIVE_SETUP_FAILURE"]
  ],
  [
    "context-guard-undefined",
    `import { createContext, useContext } from "solid-js";
const B = createContext<{ n: number } | undefined>();
export function Child() {
  const b = useContext(B);
  if (b === undefined) throw new Error("no b");
  return <p>{b.n}</p>;
}`,
    ["NATIVE_SETUP_FAILURE"]
  ],
  [
    "context-guard-cannot-fire",
    `import { createContext, useContext } from "solid-js";
const A = createContext<{ n: number }>();
const B = createContext<{ n: number }>();
export function Child() {
  const a = useContext(A);
  if (a === null) throw new Error("no a");
  const b = useContext(B);
  if (b === undefined) throw new Error("no b");
  return <p>{a.n + b.n}</p>;
}`,
    []
  ],
  // `Array(n)` throws RangeError only for a length that is not a literal
  // valid one; several arguments, or none, make an array
  [
    "array-constructor",
    `import { createMemo, createSignal } from "solid-js";
import { render } from "@solidjs/web";
function App() {
  const [n] = createSignal(3);
  const a = createMemo(() => Array(3).length);
  const b = createMemo(() => Array(n()).length);
  const c = createMemo(() => Array("x", "y").length);
  const d = createMemo(() => Array().length);
  return <p>{a() + b() + c() + d()}</p>;
}
render(() => <App />, document.body);`,
    ["FOREIGN_HANDOFF"]
  ],
  // a provider's value its context does not admit: TypeScript's error, where
  // plain TypeScript reports it (a store or an accessor of the wrong type was
  // retyped into the slot and passed unreported; a wrong value was reported as
  // a generated lazy-view error at the component)
  [
    "context-store-for-function",
    `import { createContext, useContext, createMemo, createStore } from "solid-js";
const Ctx = createContext<{ state: () => number }>();
function Child() {
  const { state: s } = useContext(Ctx);
  const n = createMemo(() => s());
  return <p>{n()}</p>;
}
export function App() {
  const [state] = createStore({ n: 1 });
  return (
    <Ctx value={{ state }}>
      <Child />
    </Ctx>
  );
}`,
    ["TS2322"]
  ],
  [
    "context-accessor-wrong-type",
    `import { createContext, useContext, createSignal } from "solid-js";
const Ctx = createContext<{ n: () => string }>();
function Child() {
  const { n } = useContext(Ctx);
  return <p>{n()}</p>;
}
export function App() {
  const [count] = createSignal(0);
  return (
    <Ctx value={{ n: count }}>
      <Child />
    </Ctx>
  );
}`,
    ["TS2322"]
  ],
  [
    "context-value-wrong-member",
    `import { createContext, useContext } from "solid-js";
const Ctx = createContext<{ a: { n: number } }>();
function Child() {
  const { a } = useContext(Ctx);
  return <p>{a.n}</p>;
}
export function App() {
  return (
    <Ctx value={{ a: { n: "x" } }}>
      <Child />
    </Ctx>
  );
}`,
    ["TS2322"]
  ],
  [
    "context-value-wrong",
    `import { createContext, useContext } from "solid-js";
const Ctx = createContext<{ n: number }>();
function Child() {
  const { n } = useContext(Ctx);
  return <p>{n}</p>;
}
export function App() {
  return (
    <Ctx value={5}>
      <Child />
    </Ctx>
  );
}`,
    ["TS2322"]
  ],
  // an accessor an object literal holds is that accessor: passed on, named
  // again in the body, or called (it was read wherever it was named)
  [
    "object-held-accessor",
    `import { createMemo, createSignal } from "solid-js";
function sample(get: () => number) {
  return get() * 2;
}
export function App() {
  const [n] = createSignal(1);
  const api = { n };
  const g = api.n;
  const a = createMemo(() => {
    try {
      return sample(api.n) + sample(g);
    } catch {
      return 0;
    }
  });
  const c = createMemo(() => api.n() + 1);
  return <p>{a() + c()}</p>;
}`,
    []
  ],
  // a getter's member is read where it is named (D-124)
  [
    "object-held-getter",
    `import { createMemo, createSignal } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  const api = {
    get twice() {
      return n() * 2;
    }
  };
  const m = createMemo(() => api.twice + 1);
  return <p>{m()}</p>;
}`,
    []
  ],
  // a context's type through a chain of aliases, however long
  [
    "context-alias-chain",
    `import { createContext, useContext, createSignal } from "solid-js";
type A9 = { count: () => number };
type A8 = A9;
type A7 = A8;
type A6 = A7;
type A5 = A6;
type A4 = A5;
type A3 = A4;
type A2 = A3;
type A1 = A2;
const Ctx = createContext<A1>();
function Child() {
  const { count } = useContext(Ctx);
  return <p>{count()}</p>;
}
export function App() {
  const [n] = createSignal(1);
  return (
    <Ctx value={{ count: n }}>
      <Child />
    </Ctx>
  );
}`,
    []
  ],
  // a circular alias is TypeScript's error; the check stops where it repeats
  [
    "context-alias-circular",
    `import { createContext, useContext, createSignal } from "solid-js";
type A = B;
type B = A;
const Ctx = createContext<A>();
function Child() {
  const { count } = useContext(Ctx);
  return <p>{count()}</p>;
}
export function App() {
  const [n] = createSignal(1);
  return (
    <Ctx value={{ count: n }}>
      <Child />
    </Ctx>
  );
}`,
    ["TS2456"]
  ],
  // the bound form with an inline handler: its first parameter is the data
  [
    "handler-bound-inline",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(0);
  return <button onClick={[(step, e) => setN(n() + step + e.clientX * 0), 2]}>{n()}</button>;
}`,
    []
  ],
  // an event Solid's own table does not type (an SVG animation's) is looked up
  [
    "svg-event-outside-table",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(0);
  return (
    <svg>
      <animate onBegin={e => setN(n() + (e.timeStamp > 0 ? 1 : 0))} />
      <text>{n()}</text>
    </svg>
  );
}`,
    []
  ],
  // a root rendered through a name for it, not its declaration
  [
    "render-alias",
    `import { render } from "@solidjs/web";
function Main() {
  return <p>main</p>;
}
const Root = Main;
render(Root, document.body);`,
    []
  ],
  // accessors a helper takes in an object: written there, held by a constant
  // of the routine or of the component's body, or taken first by the lowering
  // (a member read beside them)
  [
    "object-literal-accessors",
    `import { createMemo, createSignal } from "solid-js";
function pick(o: { get: () => number; n?: () => number }) {
  return o.get() + (o.n?.() ?? 0);
}
export function App() {
  const [n] = createSignal(1);
  const api = { n };
  const held = { get: n };
  const a = createMemo(() => {
    try {
      const local = { get: n };
      return pick({ get: n }) + pick({ get: api.n, n }) + pick(held) + pick(local);
    } catch {
      return 0;
    }
  });
  return <p>{a()}</p>;
}`,
    []
  ],
  // a computed accessor given in a try (its attempt runs a thunk): taken
  // before the statement, whether its names are the body's or the try's
  [
    "accessor-compound-argument",
    `import { createMemo, createSignal } from "solid-js";
function sample(get: () => number) {
  return get() * 2;
}
export function App() {
  const [n] = createSignal(1);
  const [m] = createSignal(2);
  const flag = true;
  const a = createMemo(() => {
    try {
      return sample(flag ? n : m);
    } catch {
      return 0;
    }
  });
  const b = createMemo(() => {
    try {
      const pickOne = true;
      return sample(pickOne ? n : m);
    } catch {
      return 0;
    }
  });
  return <p>{a() + b()}</p>;
}`,
    []
  ]
];
/** refusals stop a project's check: each on its own */
const refusals = [
  // a namespaced attribute on a component (Solid's props have no namespace)
  [
    "component-namespaced-attribute",
    `function Child(props: { label: string }) {
  return <p>{props.label}</p>;
}
export function App() {
  return <Child label="x" xlink:href="#a" />;
}`,
    ["NATIVE_SPREAD"]
  ],
  // throw an Error object (pinned refusal)
  [
    "throw-literal",
    `import { createSignal, createMemo, createStore, isPending, Errored, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [n] = createSignal(1);
  const m = createMemo(() => { if (n() < 0) throw "negative"; return n(); });
  return <p>{m()}</p>;
}`,
    ["NATIVE_THROW"]
  ],
  // a store read in an author's generator (pinned refusal)
  [
    "store-in-opaque-generator",
    `import { createSignal, createMemo, createStore, isPending, Errored, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [store] = createStore({ list: [1, 2, 3] });
  function* each() { for (const x of store.list) yield x; }
  const m = createMemo(() => [...each()].length);
  return <p>{m()}</p>;
}`,
    ["READ_IN_OPAQUE_GENERATOR"]
  ],
  // a jump out of finally (pinned refusal)
  [
    "break-in-finally",
    `import { createSignal, createMemo } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  const m = createMemo(() => {
    let total = 0;
    for (let i = 0; i < n(); i++) {
      try { total += JSON.parse(String(i)) as number; } catch { /* @yield-absorb: a number parses */ total = -1; } finally { if (total < 0) break; }
    }
    return total;
  });
  return <p>{m()}</p>;
}`,
    ["NATIVE_CONTROL_TRANSFER"]
  ],
  [
    "continue-in-finally",
    `import { createSignal, createMemo } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  const m = createMemo(() => {
    let total = 0;
    for (let i = 0; i < n(); i++) {
      try { total += JSON.parse(String(i)) as number; } catch { /* @yield-absorb: a number parses */ total = -1; } finally { if (total < 0) continue; }
    }
    return total;
  });
  return <p>{m()}</p>;
}`,
    ["NATIVE_CONTROL_TRANSFER"]
  ],
  // a snapshot write that is not pure arithmetic: refused at the write
  [
    "recursion-impure-write",
    `import { render } from "@solidjs/web";
type TreeProps = { depth: number; children: number };
const Tree = (props: TreeProps) => {
  let { depth } = props;
  if (depth <= 0) return <i>{props.children}</i>;
  depth = Math.random() * depth;
  return <b><Tree depth={depth}>{props.children}</Tree></b>;
};
export function App() {
  return <Tree depth={3}>{1}</Tree>;
}
render(App, document.body);`,
    ["NATIVE_RECURSION"]
  ],
  // a name the lowering reserves: refused at its declaration
  [
    "prelude-reserved-name",
    `import { createSignal, createMemo } from "solid-js";
const __nativeTry = "taken";
export function App() {
  const [n] = createSignal("1");
  const m = createMemo(() => { try { return JSON.parse(n()) as number; } catch { /* @yield-absorb: bad input */ return -1; } });
  return <p>{m()}{__nativeTry}</p>;
}`,
    ["NATIVE_NAME"]
  ],
  // D-125 keeps D-041: a helper that returns JSX is refused
  [
    "jsx-helper",
    `import { createSignal } from "solid-js";
function render2(label: string) { return <b>{label}</b>; }
export function App() {
  return render2("x");
}`,
    ["SUGAR_COMPONENT"]
  ],
  // a generic function keeps its instantiation: handed on as written
  [
    "generic-named-callback",
    `import { createSignal, createMemo } from "solid-js";
export function App() {
  const [n] = createSignal(2);
  const [items] = createSignal([1, 2]);
  function tag<T>(x: T): string { return \`\${x}:\${n()}\`; }
  const m = createMemo(() => items().map(tag).join());
  return <p>{m()}</p>;
}`,
    ["SUGAR_ESCAPE"]
  ],
  // a `function` handed a `this` keeps it: handed on as written
  [
    "this-bound-named-callback",
    `import { createSignal, createMemo } from "solid-js";
export function App() {
  const [n] = createSignal(2);
  const [items] = createSignal([1, 2]);
  function scale(this: { k: number }, x: number) { return x * this.k * n(); }
  const m = createMemo(() => items().map(scale, { k: 2 }).join());
  return <p>{m()}</p>;
}`,
    ["SUGAR_ESCAPE"]
  ],
  // a context called with a key that has no JSX form
  [
    "context-call-computed-key",
    `import { createContext, useContext } from "solid-js";
const Ctx = createContext(0);
function Show() {
  return <p>{useContext(Ctx)}</p>;
}
export function App() {
  return Ctx({ ["value"]: 1, children: () => <Show /> });
}`,
    ["NATIVE_CONTEXT"]
  ],
  // called with its children as a value, it is checked as its JSX form (review 3)
  [
    "context-call-eager-children",
    `import { createContext, useContext } from "solid-js";
const Ctx = createContext(0);
function Show() {
  return <p>{useContext(Ctx)}</p>;
}
export function App() {
  return Ctx({ value: 1, children: <Show /> });
}`,
    []
  ],
  // a handler has no reactive owner: Solid's useContext throws there
  [
    "context-read-in-handler",
    `import { createContext, useContext, createSignal } from "solid-js";
const Ctx = createContext<{ count: () => number }>();
function Child() {
  const [n, setN] = createSignal(0);
  return <button onClick={() => setN(useContext(Ctx).count())}>{n()}</button>;
}
export function App() {
  const [n] = createSignal(1);
  return <Ctx value={{ count: n }}><Child /></Ctx>;
}`,
    ["NATIVE_CONTEXT"]
  ],
  // Solid 1's `Ctx.Provider` is the context's provider (review 3)
  [
    "solid1-provider",
    `import { createContext, useContext } from "solid-js";
const Ctx = createContext(0);
function Show() {
  return <p>{useContext(Ctx)}</p>;
}
export function App() {
  return <Ctx.Provider value={1}><Show /></Ctx.Provider>;
}`,
    []
  ],
  // a handler an expression computes runs once where the element is created
  [
    "handler-from-call",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(1);
  const make = (k: number) => () => setN(n() + k);
  return <button onClick={make(2)}>{n()}</button>;
}`,
    ["NATIVE_HANDLER"]
  ],
  [
    "handler-ternary",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(1);
  const up = () => setN(n() + 1);
  const down = () => setN(n() - 1);
  return <button onClick={n() > 3 ? down : up}>{n()}</button>;
}`,
    ["NATIVE_HANDLER"]
  ]
];

function checkProject(dir, files) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  symlinkSync(resolve(import.meta.dirname, "../node_modules"), join(dir, "node_modules"));
  for (const [name, source] of files) writeFileSync(join(dir, `${name}.tsx`), source);
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({ compilerOptions: options, include: ["*.tsx"], exclude: ["node_modules"] })
  );
  const log = [],
    old = console.log;
  console.log = (...args) => log.push(args.join(" "));
  try {
    check(dir, { mode: "native", include: ["*.tsx"] });
  } finally {
    console.log = old;
  }
  /** @type {Map<string, string[]>} */
  const codes = new Map(files.map(([name]) => [name, []]));
  for (const row of log) {
    const m = row.match(/\/([\w-]+)\.tsx:\d+:\d+ error (TS\d+): ([\s\S]*)$/);
    if (m) codes.get(m[1])?.push(m[3].match(/\[([A-Z_]+)\]/)?.[1] ?? m[2]);
  }
  return { codes, log };
}

describe("native lowering paths, checked as plain Solid says", { timeout: 300_000 }, () => {
  /** @type {ReturnType<typeof checkProject>} */
  let result;
  beforeAll(() => {
    result = checkProject(
      base,
      programs.map(([name, source]) => [name, source])
    );
  }, 300_000);
  afterAll(() => rmSync(base, { recursive: true, force: true }));

  it.each(programs)("%s", (name, _source, expected) => {
    expect([...new Set(result.codes.get(name))].sort(), result.log.join("\n")).toEqual(expected);
  });

  it("names a class expression's failure by its variable", () => {
    const row = result.log.find(
      r => r.includes("class-expression-error.tsx") && r.includes("FOREIGN_HANDOFF")
    );
    expect(row).toMatch(/Remaining: NotFound\./);
  });

  it("reports a failure an effect reads at the memo that throws", () => {
    const rows = result.log.filter(
      r => r.includes("effect-reads-failing-memo-at-root.tsx") && / error TS/.test(r)
    );
    expect(
      rows.map(r =>
        r
          .match(/\.tsx:(\d+):(\d+)/)
          ?.slice(1)
          .join(":")
      ),
      rows.join("\n")
    ).toEqual(["6:18"]);
    expect(rows[0]).toMatch(/Remaining: RangeError\./);
    // the root that renders it is the related location
    expect(result.log.join("\n")).toMatch(
      /related: \S*effect-reads-failing-memo-at-root\.tsx:15:15: The app is rendered here\./
    );
  });

  it("names what a context's value fails with, through Provider members and destructured members", () => {
    for (const name of ["context-provider-member-nested", "context-destructured-member-call"]) {
      const row = result.log.find(r => r.includes(`${name}.tsx`) && r.includes("FOREIGN_HANDOFF"));
      expect(row, name).toMatch(/Remaining: RangeError\./);
    }
    const rows = result.log.filter(r => r.includes("array-constructor.tsx") && / error TS/.test(r));
    // only `Array(n())`
    expect(
      rows.map(r => r.match(/\.tsx:(\d+):\d+/)?.[1]),
      rows.join("\n")
    ).toEqual(["9"]);
    expect(rows[0]).toMatch(/Remaining: RangeError\./);
  });

  it("reports a provider's wrong value as TypeScript does", () => {
    const at = name =>
      result.log
        .filter(r => r.includes(`/${name}.tsx`) && / error TS/.test(r))
        .map(r => r.replace(/^.*\/[\w-]+\.tsx:/, ""));
    expect(at("context-store-for-function")).toEqual([
      "11:19 error TS2322: Type '{ n: number; }' is not assignable to type '() => number'."
    ]);
    expect(at("context-accessor-wrong-type")).toEqual([
      "10:19 error TS2322: Type '() => number' is not assignable to type '() => string'."
    ]);
    expect(at("context-value-wrong-member")).toEqual([
      "9:24 error TS2322: Type 'string' is not assignable to type 'number'."
    ]);
    expect(at("context-value-wrong")).toEqual([
      "9:10 error TS2322: Type 'number' is not assignable to type '{ n: number; }'."
    ]);
  });

  it("a context from another module provides through its Provider", () => {
    const files = [
      [
        "ctx",
        'import { createContext } from "solid-js";\nexport const Theme = createContext("light");\nexport const Count = createContext<() => number>();'
      ],
      [
        "app",
        `import { createSignal, useContext } from "solid-js";
import { Theme, Count } from "./ctx";
function Show() {
  const theme = useContext(Theme);
  const count = useContext(Count);
  return <p>{theme}{count()}</p>;
}
export function App() {
  const [n] = createSignal(1);
  return (
    <Theme.Provider value="dark">
      <Count.Provider value={n}>
        <Show />
      </Count.Provider>
    </Theme.Provider>
  );
}`
      ],
      [
        "main",
        'import { render } from "@solidjs/web";\nimport { App } from "./app";\nrender(() => <App />, document.body);'
      ]
    ];
    const provided = checkProject(`${base}-provider`, files);
    expect([...provided.codes.values()].flat(), provided.log.join("\n")).toEqual([]);
    // without its Count.Provider, the root lacks it
    files[1][1] = files[1][1]
      .replace("<Count.Provider value={n}>", "")
      .replace("</Count.Provider>", "");
    const missing = checkProject(`${base}-provider`, files);
    rmSync(`${base}-provider`, { recursive: true, force: true });
    expect([...new Set(missing.codes.get("app"))].sort(), missing.log.join("\n")).toEqual([
      "FOREIGN_HANDOFF",
      "NO_PROVIDER"
    ]);
  });

  it("reserves the entry adapter's name", () => {
    const dir = `${base}-entry`;
    const project = checkProject(dir, [
      ["app", "export function App() {\n  return <p>app</p>;\n}"],
      [
        "main",
        'import { render } from "@solidjs/web";\nimport { App } from "./app";\nconst __nativeForeign = 1;\nrender(App, document.body);\nexport { __nativeForeign };'
      ]
    ]);
    rmSync(dir, { recursive: true, force: true });
    expect(project.codes.get("main"), project.log.join("\n")).toEqual(["NATIVE_NAME"]);
  });

  it.each(refusals)("%s (refused)", (name, source, expected) => {
    const alone = checkProject(`${base}-${name}`, [[name, source]]);
    rmSync(`${base}-${name}`, { recursive: true, force: true });
    expect([...new Set(alone.codes.get(name))].sort(), alone.log.join("\n")).toEqual(expected);
  });
});
