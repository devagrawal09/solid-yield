import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRequire } from "node:module";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { lowerNativeProject } from "../src/native.js";

// D-124 (D-116 applied): a Solid API native mode does not model stays plain
// Solid, a boundary whose value and failures are handled where it is used;
// the common ones are modelled. Each program goes through `solid-yield
// check`, as an app does, and gets what plain Solid says about it.
const require = createRequire(import.meta.url);
const { check } = require("../../ts-plugin-yield/src/cli.cjs");
const base = resolve(import.meta.dirname, `.native-generated/foreign-apis-${process.pid}`);
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

/** `[name, source, expected error codes]`: checked together, attributed by file. */
const programs = [
  [
    "untrack",
    `import { createSignal, createMemo, untrack } from "solid-js";
export function App() {
  const [a] = createSignal(1);
  const [b] = createSignal(2);
  const sum = createMemo(() => a() + untrack(() => b()));
  return <p>{sum()}</p>;
}`,
    []
  ],
  [
    "merge-omit",
    `import { merge, omit } from "solid-js";
export function Button(props: { label?: string; kind?: string; title: string }) {
  const merged = merge({ label: "ok", kind: "plain" }, props);
  const rest = omit(merged, "label");
  return <button title={rest.title} class={rest.kind}>{merged.label}</button>;
}`,
    []
  ],
  [
    "children-helper",
    `import { children, type ParentProps } from "solid-js";
export function List(props: ParentProps) {
  const resolved = children(() => props.children);
  return <ul>{resolved.toArray().length}{resolved()}</ul>;
}`,
    []
  ],
  [
    "render-effect",
    `import { createSignal, createRenderEffect } from "solid-js";
export function App() {
  const [n, setN] = createSignal(1);
  const [seen, setSeen] = createSignal(0);
  createRenderEffect(() => n(), value => { setSeen(value); });
  return <button onClick={() => setN(n() + 1)}>{seen()}</button>;
}`,
    []
  ],
  [
    "flush-reconcile-snapshot",
    `import { createSignal, createStore, flush, reconcile, snapshot, createUniqueId } from "solid-js";
export function App() {
  const [store, setStore] = createStore({ list: [1, 2] });
  const [copy, setCopy] = createSignal("");
  const id = createUniqueId();
  // their failures are unknown: handled in the event
  return <button id={id} onClick={() => {
    try {
      setStore(s => reconcile({ list: [3] }, "id")(s));
      flush();
      setCopy(JSON.stringify(snapshot(store)));
    } catch (e) {
      /* @yield-absorb: logged */
      console.error(e);
    }
  }}>{copy()}</button>;
}`,
    []
  ],
  [
    "on-settled",
    `import { createSignal, onSettled } from "solid-js";
export function App() {
  const [n, setN] = createSignal(0);
  onSettled(() => { setN(1); });
  return <p>{n()}</p>;
}`,
    []
  ],
  [
    "map-array",
    `import { createSignal, mapArray } from "solid-js";
export function App() {
  const [items] = createSignal(["a", "b"]);
  const upper = mapArray(items, item => item.toUpperCase());
  return <p>{upper().join()}</p>;
}`,
    []
  ],
  [
    "run-with-owner",
    `import { createSignal, getOwner, runWithOwner } from "solid-js";
export function App() {
  const [n, setN] = createSignal(0);
  const owner = getOwner();
  setTimeout(() => runWithOwner(owner, () => setN(1)), 10);
  return <p>{n()}</p>;
}`,
    []
  ],
  [
    "tracked-effect",
    `import { createSignal, createTrackedEffect } from "solid-js";
export function App() {
  const [n] = createSignal(0);
  createTrackedEffect(() => { console.log(n()); });
  return <p>{n()}</p>;
}`,
    []
  ],
  [
    "dynamic",
    `import { Errored } from "solid-js";
import { Dynamic } from "@solidjs/web";
export function App() {
  return <Errored fallback={() => <p>failed</p>}><Dynamic component="h1">title</Dynamic></Errored>;
}`,
    []
  ],
  [
    "accessor-to-helper",
    `import { createSignal, createMemo, Loading, type Accessor } from "solid-js";
function useDouble(count: Accessor<number>) { return () => count() * 2; }
function useCounter(count: Accessor<number>) {
  return { double: () => count() * 2, label: () => "n=" + count() };
}
function useLater(value: () => number) { return createMemo(() => value() + 1); }
export function App() {
  const [n] = createSignal(1);
  const double = useDouble(n);
  const { label } = useCounter(n);
  const label2 = createMemo(() => useDouble(n)());
  const title = createMemo(async () => "x");
  const length = useDouble(createMemo(() => useCounter(n).double()));
  const later = useLater(n);
  const titled = useDouble(createMemo(() => title().length));
  return <Loading fallback="…"><p>{double()}{label()}{label2()}{length()}{later()}{titled()}</p></Loading>;
}`,
    []
  ],
  [
    "refs",
    `export function App() {
  let input!: HTMLInputElement;
  let box: HTMLDivElement | undefined;
  return <div ref={box}><input ref={input} /><p ref={el => el.focus()}>x</p><button onClick={() => input.focus()}>go</button></div>;
}`,
    []
  ],
  [
    "dom-spread-props",
    `import { omit } from "solid-js";
export function Box(props: { title: string; class?: string }) {
  return <div {...props}>box</div>;
}
export function Button(props: { title: string; label: string }) {
  return <button {...omit(props, "label")}>{props.label}</button>;
}`,
    []
  ],
  [
    "dom-spread-events",
    `import { createSignal, omit } from "solid-js";
function Button(props: { onClick?: (e: MouseEvent) => void; label: string }) {
  const rest = omit(props, "label");
  return <button {...rest}>{props.label}</button>;
}
function handlers(log: (s: string) => void) { return { onClick: () => log("x"), title: "t" }; }
export function App() {
  const [n, setN] = createSignal(0);
  const attrs = { onClick: () => setN(n() + 1), title: "t" };
  return <><button {...attrs}>{n()}</button><button {...{ onClick: (e: MouseEvent) => setN(n() + e.detail) }}>+</button><button {...handlers(s => console.log(s))}>log</button><Button label={String(n())} onClick={e => setN(n() + e.detail)} /></>;
}`,
    []
  ],
  [
    "prop-handler",
    `import { createSignal } from "solid-js";
function Button(props: { onClick: (e: MouseEvent) => void; onHover?: () => void; label: string }) {
  return <button onClick={props.onClick} onMouseEnter={props.onHover}>{props.label}</button>;
}
export function App() {
  const [n, setN] = createSignal(0);
  return <Button label={String(n())} onClick={e => setN(n() + e.detail)} />;
}`,
    []
  ],
  [
    "jsx-namespace",
    `import { createSignal, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
function Button(props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  const rest = omit(props, "label");
  return <button {...rest}>{props.label}</button>;
}
export function App(props: { style: JSX.CSSProperties }) {
  const [n, setN] = createSignal(0);
  return <div style={props.style}><Button label={String(n())} type="button" onClick={() => setN(n() + 1)} /></div>;
}`,
    []
  ],
  [
    "nested-awaits",
    `import { createSignal } from "solid-js";
export function App() {
  const [text, setText] = createSignal("");
  return <button onClick={async () => {
    try {
      setText(await (await fetch("/x")).text());
      const data: unknown = await (await fetch("/y")).json();
      setText(JSON.stringify(data));
    } catch (e) {
      /* @yield-absorb: logged */
      console.error(e);
    }
  }}>{text()}</button>;
}`,
    []
  ],
  // what the check still reports through these
  [
    "spread-pending-root",
    `import { createMemo, omit } from "solid-js";
import { render } from "@solidjs/web";
function Box(props: { title: string; label: string }) {
  const rest = omit(props, "label");
  return <div {...rest}>{props.label}</div>;
}
function App() {
  const t = createMemo(async () => "x");
  return <Box title={t()} label="l" />;
}
render(App, document.body);`,
    ["PENDING_ROOT"]
  ],
  [
    "spread-event-rejects",
    `import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal("");
  const attrs = { onClick: async () => setN(await (await fetch("/x")).text()) };
  return <button {...attrs}>{n()}</button>;
}`,
    ["EVENT_REJECTS"]
  ],
  [
    "tracked-effect-write",
    `import { createSignal, createTrackedEffect } from "solid-js";
export function App() {
  const [n, setN] = createSignal(0);
  createTrackedEffect(() => { setN(n() + 1); });
  return <p>{n()}</p>;
}`,
    ["WRITE_IN_REACTIVE"]
  ],
  // a foreign tag is a boundary the check warns at, not an error
  [
    "dynamic-unhandled",
    `import { Dynamic } from "@solidjs/web";
export function App() {
  return <Dynamic component="h1">title</Dynamic>;
}`,
    []
  ],
  [
    "colored-capture",
    `import { createMemo } from "solid-js";
function useLater(value: () => string) { return () => value().length; }
export function App() {
  const title = createMemo(async () => "x");
  const length = useLater(title);
  return <p>{length()}</p>;
}`,
    ["COLORED_CAPTURE"]
  ]
];

/** `solid-yield check` on a project; the codes it reports, by file. */
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
  "Solid APIs native mode does not model stay plain Solid (D-124)",
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

    it("module-level roots are module state", () => {
      const file = resolve(base, "../foreign-apis-root.tsx");
      const { diagnostics } = lowerNativeProject(
        new Map([
          [
            file,
            `import { createRoot, createSignal } from "solid-js";
const counter = createRoot(() => createSignal(0));
export function App() { return <p>{counter[0]()}</p>; }`
          ]
        ])
      );
      expect(diagnostics.map(d => [d.code, d.line])).toEqual([["MODULE_STATE", 2]]);
    });

    it("a DOM spread of held props is Solid's; one with a widened prop goes through the bridge", () => {
      const file = resolve(base, "../foreign-apis-spread.tsx");
      const held = lowerNativeProject(
        new Map([[file, programs.find(([name]) => name === "dom-spread-props")[1]]])
      ).files.get(file);
      expect(held).toContain("<div {...props}>box</div>");
      expect(held).not.toContain("__nativeSpread");
      const { files } = lowerNativeProject(
        new Map([
          [
            file,
            `import { createSignal, omit } from "solid-js";
export function Box(props: { title: string; class?: string }) {
  return <div {...props}>box</div>;
}
export function Button(props: { title: string; label: string }) {
  return <button {...omit(props, "label")}>{props.label}</button>;
}
export function App() {
  const [n] = createSignal(0);
  return <><Box title={String(n())} /><Button title="t" label={String(n())} /></>;
}`
          ]
        ])
      );
      const code = files.get(file);
      // Box's title is live (a caller passes a read): its spread reads it.
      expect(code).toContain("yield* __nativeSpread(props)");
      // Button's spread leaves the live label out: what is left is held.
      expect(code).toContain('<button {...omit(props, "label")}>{yield* props.label}</button>');
    });
  }
);
