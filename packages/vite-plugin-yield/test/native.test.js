import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { lowerNativeProject, inspectNativeProject } from "../src/native.js";
import solidYield from "../src/vite.js";
const id = resolve(import.meta.dirname, "fixtures/native.tsx");
const lower = source => lowerNativeProject(new Map([[id, source]])).files.get(id);
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
  it("reports every incompatible native failure site before emitting", () => {
    const diagnostics = inspectNativeProject(
      new Map([
        [
          id,
          `import {createMemo} from 'solid-js'; function App(){const n=createMemo(async()=>1);
       try{throw new Error('x');}catch{} return <p>{n()}</p>;}`
        ]
      ])
    );
    expect(diagnostics.map(d => d.code)).toEqual([
      "NATIVE_REJECTION",
      "NATIVE_CATCH",
      "NATIVE_FAILURE"
    ]);
    expect(diagnostics.every(d => d.line > 0 && d.column > 0)).toBe(true);
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
