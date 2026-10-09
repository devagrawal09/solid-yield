import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { lowerNativeProject, inspectNativeProject } from "../src/native.js";
import solidYield from "../src/vite.js";
const id = resolve(import.meta.dirname, "fixtures/native.tsx");
const lower = source => lowerNativeProject(new Map([[id, source]])).files.get(id);
it("refuses changing numeric props when reconstructing recursive snapshots", () => {
  const file = resolve(import.meta.dirname, "../../../examples/originals/sierpinski/src/main.tsx");
  const source = readFileSync(file, "utf8").replace("<Triangle x={0}", "<Triangle x={elapsed()}");
  expect(() => lowerNativeProject(new Map([[file, source]]))).toThrow(
    /Snapshot Triangle.x is not a fixed numeric prop/
  );
});
describe("native front end", { timeout: 30_000 }, () => {
  it("requires explicit file selection", () => {
    expect(() => solidYield({ mode: "native" })).toThrow(/NATIVE_INCLUDE/);
  });
  it("emits the library's read, write, event and view forms from Solid imports", () => {
    const out = lower(`import {createSignal,createMemo} from 'solid-js';
      export function Counter(){const [n,set]=createSignal(0);const twice=createMemo(()=>n()*2);
      return <button onClick={()=>set(n()+1)}>{twice()}</button>;}`);
    expect(out).toContain("$signal as createSignal");
    expect(out).toContain("component(function* Counter");
    expect(out).toContain("yield* set((yield* n) + 1)");
    expect(out).toContain("onClick={yield* $event(function*");
  });
  it("lowers native tags and ordinary typed props", () => {
    const out = lower(`function Child(p:{n:number}){return <p>{p.n}</p>;}
      export function App(){return <Child n={1}/>;}`);
    expect(out).toContain("Props<");
    expect(out).toContain("yield* p.n");
    expect(out).toContain("yield* Child({");
  });
  it("leaves a capitalized plain helper's value contract alone", () => {
    const out = lower(`export function Value(p: {n: number}) { return p.n + 1; }`);
    expect(out).not.toContain("Props");
    expect(out).not.toContain("yield");
  });
  it("resolves selected component imports before lowering tags", () => {
    const child = resolve(import.meta.dirname, "fixtures/native-child.tsx");
    const out = lowerNativeProject(
      new Map([
        [id, `import {Child} from './native-child'; export function App(){return <Child n={1}/>;}`],
        [child, `export function Child(p:{n:number}){return <p>{p.n}</p>;}`]
      ])
    ).files;
    expect(out.get(id)).toContain("yield* Child({");
    expect(out.get(child)).toContain("yield* p.n");
  });
  it("refuses an event receiver whose binding would change", () => {
    expect(() =>
      lower(
        `export function App(){return <button onClick={function(this: HTMLButtonElement){this.focus();}}/>;}`
      )
    ).toThrow(/NATIVE_RECEIVER/);
  });
  it("types unknown Promise rejections and native Error throws", () => {
    expect(
      lower(`export function App(){return <button onClick={()=>Promise.reject("failed")}/>;}`)
    ).toContain('__nativeFailure(["unknown"]');
    expect(
      lower(`export function App(){return <button onClick={()=>{throw new Error("failed")}}/>;}`)
    ).toContain('__nativeFailure(["global:Error"]');
  });
  it("accepts catch control flow for checked lowering", () => {
    const diagnostics = inspectNativeProject(
      new Map([
        [
          id,
          `import {createMemo} from 'solid-js'; function App(){const n=createMemo(async()=>1);try{throw new Error('x')}catch{}return <p>{n()}</p>}`
        ]
      ])
    );
    expect(diagnostics.map(d => d.code)).toEqual([]);
  });
  it("keeps unselected files on the explicit route", async () => {
    const plugin = solidYield({ mode: "native", include: () => false });
    expect(await plugin.transform.call({}, "export const n=1;", id)).toBeNull();
  });
});

it("renders native Solid source through the actual Vite/SSR pipeline", async () => {
  const { devServer } = await import("./server.js");
  const root = resolve(import.meta.dirname, "fixtures/native-app");
  const server = await devServer(root, {
    mode: "native",
    include: file => file === resolve(root, "Counter.tsx")
  });
  try {
    const entry = await server.ssrLoadModule("/entry.tsx");
    const plain = html => html.replace(/<!--.*?-->/g, "").replace(/ data-hk="[^"]*"/g, "");
    expect(plain(entry.native())).toBe(plain(entry.original()));
    expect(entry.native()).toContain("2");
  } finally {
    await server.close();
  }
}, 30_000);

it("keeps foreign entry rendering checked and out of routine inference", () => {
  const main = resolve(import.meta.dirname, "fixtures/main.tsx");
  const out = lowerNativeProject(
    new Map([
      [id, "export function App(){return <p/>}"],
      [
        main,
        `import {render} from '@solidjs/web';import {App} from './native';render(()=> <App/>,document.body);`
      ]
    ])
  ).files.get(main);
  expect(out).toMatch(/from ['"]@solidjs\/web['"]/);
  expect(out).toContain("__nativeForeign(App satisfies __NativeRootCheck<typeof App>)");
  expect(out).not.toContain("function*");
});
it("preserves native catches through the SSR runtime", async () => {
  const { devServer } = await import("./server.js");
  const root = resolve(import.meta.dirname, "fixtures/native-app");
  const server = await devServer(root, {
    mode: "native",
    include: file => file === resolve(root, "Catch.tsx")
  });
  try {
    const entry = await server.ssrLoadModule("/catch-entry.tsx");
    const plain = html => html.replace(/<!--.*?-->/g, "").replace(/ data-hk="[^"]*"/g, "");
    expect(plain(entry.native())).toBe(plain(entry.original()));
    expect(plain(entry.native())).toMatch(/<p[^>]*>7<\/p>/);
  } finally {
    await server.close();
  }
}, 30000);

it("retains entry markers and emits a single type-only import modifier", () => {
  const out = lower(
    `import {HydrationScript,type JSX} from '@solidjs/web';export function Shell(p:{children:JSX.Element}){return <html><HydrationScript/>{p.children}</html>}`
  );
  // F-S36: JSX.Element lowers to the library's Element; the JSX import goes with it.
  expect(out).toContain('import type { Element as _NativeElement } from "solid-yield"');
  expect(out).not.toContain("JSX");
  expect(out).toContain("<HydrationScript />");
  expect(out).not.toContain("import type { type");
}, 30_000);

it("evaluates reactive arguments in their host before an opaque call", () => {
  const out = lower(`import {createSignal,createMemo} from 'solid-js';
    declare const api:{load(n:number):number};
    export function App(){const [n]=createSignal(1);const value=createMemo(()=>api.load(n()));return <p>{value()}</p>}`);
  expect(out).toMatch(/const _receiver = api/);
  expect(out).toMatch(/const _method = yield\* __nativeAttempt\(\(\) => _receiver.load/);
  expect(out).toMatch(/const _argument = yield\* n/);
  expect(out).toContain("__nativeInvoke(_method, _receiver, [_argument])");
}, 30_000);
