import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRequire } from "node:module";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// D-124: language forms the native surface check (scripts/native-surface)
// found refused or mis-lowered, each now checked as plain Solid says. One
// program per form, through `solid-yield check`.
const require = createRequire(import.meta.url);
const { check } = require("../../ts-plugin-yield/src/cli.cjs");
const base = resolve(import.meta.dirname, `.native-generated/forms-${process.pid}`);
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
const head = `import { createSignal, createMemo, createEffect, createStore, untrack, Loading } from "solid-js";
import { render } from "@solidjs/web";`;

/** `[name, source, expected error codes]` */
const programs = [
  [
    "object-getters-methods",
    `${head}
export function App() {
  const [n, setN] = createSignal(1);
  const o = {
    label: "x",
    get double() { return n() * 2; },
    get full() { return this.label + n(); },
    total() { return n() + 1; }
  };
  const m = createMemo(() => o.double + o.total());
  return <p onClick={() => setN(o.double)}>{m()}{o.full}</p>;
}`,
    []
  ],
  [
    "getter-read-in-setup",
    `${head}
export function App() {
  const [n] = createSignal(1);
  const o = { get double() { return n() * 2; } };
  const once = o.double;
  return <p>{once}</p>;
}`,
    ["READ_IN_SETUP"]
  ],
  [
    "untrack-in-every-host",
    `${head}
export function App() {
  const [a, setA] = createSignal(1);
  const [b] = createSignal(2);
  const once = untrack(() => a() + 1);
  const m = createMemo(() => a() + untrack(() => b()));
  createEffect(() => untrack(() => b()), v => console.log(v));
  return <p title={String(untrack(() => b()))} onClick={() => setA(untrack(() => a()) + 1)}>{m()}{once}{untrack(() => a())}</p>;
}`,
    []
  ],
  [
    "untrack-pending-in-setup",
    `${head}
export function App() {
  const title = createMemo(async () => "x");
  const once = untrack(() => title());
  return <p>{once}</p>;
}`,
    ["COLORED_CAPTURE"]
  ],
  [
    "iife",
    `${head}
export function App() {
  const [n] = createSignal(1);
  const m = createMemo(() => (() => { let s = 0; for (let i = 0; i < n(); i++) s += i; return s; })());
  return <p>{m()}{(() => n() * 3)()}</p>;
}`,
    []
  ],
  [
    "iife-pending-root",
    `${head}
function App() {
  const p = createMemo(async () => 1);
  return <p>{(() => p() * 2)()}</p>;
}
render(App, document.body);`,
    ["PENDING_ROOT"]
  ],
  [
    "iife-read-in-setup",
    `${head}
export function App() {
  const [n] = createSignal(1);
  const v = (() => n() * 2)();
  return <p>{v}</p>;
}`,
    ["READ_IN_SETUP"]
  ],
  [
    "array-callback-in-setup",
    `${head}
export function App() {
  const [n] = createSignal(1);
  const [items] = createSignal([1, 2, 3]);
  const big = items().filter(x => x > n());
  return <p>{big.join()}</p>;
}`,
    ["READ_IN_SETUP"]
  ],
  [
    "store-list-chains",
    `${head}
export function App() {
  const [n] = createSignal(1);
  const [store] = createStore({ list: [{ title: "t", done: false }] });
  const open = createMemo(() => store.list.filter(t => !t.done).map(t => t.title).join());
  return <p>{open()}{store.list.map(t => t.title).join()}{store.list.reduce((a, t) => a + t.title.length, n())}</p>;
}`,
    []
  ],
  [
    "nested-class",
    `${head}
export function App() {
  const [n, setN] = createSignal(1);
  const m = createMemo(() => {
    class Box {
      constructor(readonly x: number) {}
      get double() { return this.x * 2; }
    }
    return new Box(n()).double;
  });
  return <p onClick={() => { class C { constructor(readonly x: number) {} get d() { return this.x; } } setN(new C(n()).d); }}>{m()}</p>;
}`,
    []
  ],
  [
    "effect-phase-returns-void",
    `${head}
export function App() {
  const [n] = createSignal(1);
  createEffect(() => n(), v => console.log(v));
  return <p>{n()}</p>;
}`,
    []
  ],
  [
    "reader-helpers",
    `${head}
const scaled = (factor: number) => (count: () => number) => () => count() * factor;
export function App() {
  const [n] = createSignal(1);
  const triple = scaled(3)(n);
  return <p>{triple()}</p>;
}`,
    []
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
    const m = row.match(/\/([\w-]+)\.tsx:\d+:\d+ error (TS\d+): (.*)$/);
    if (m) codes.get(m[1])?.push(m[3].match(/\[([A-Z_]+)\]/)?.[1] ?? m[2]);
  }
  return { codes, log };
}

describe(
  "language forms native mode checks as plain Solid says (D-124)",
  { timeout: 300_000 },
  () => {
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
  }
);
