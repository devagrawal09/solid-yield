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
  ]
];
/** refusals stop a project's check: each on its own */
const refusals = [
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

  it.each(refusals)("%s (refused)", (name, source, expected) => {
    const alone = checkProject(`${base}-${name}`, [[name, source]]);
    rmSync(`${base}-${name}`, { recursive: true, force: true });
    expect([...new Set(alone.codes.get(name))].sort(), alone.log.join("\n")).toEqual(expected);
  });
});
