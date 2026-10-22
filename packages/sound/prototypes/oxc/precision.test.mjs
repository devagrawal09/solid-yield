// @ts-check
import { it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createChecker } from "./index.mjs";

const packageDir = fileURLToPath(new URL("../../", import.meta.url));
const imports =
  "import {render} from '@solidjs/web'; import {createMemo,createEffect,Loading,merge} from 'solid-js';";
function check(text) {
  const rootDir = mkdtempSync(resolve(packageDir, ".oxc-precision-"));
  const file = resolve(rootDir, "app.tsx");
  const checker = createChecker({
    rootDir,
    files: [file],
    readFile: path => (path === file ? imports + text : undefined)
  });
  try {
    return checker.check();
  } finally {
    checker.dispose();
    rmSync(rootDir, { recursive: true, force: true });
  }
}
const codes = text =>
  check(text)
    .diagnostics.map(d => d.code)
    .sort();

it("treats Loading reset functions as held values without hiding real events", () => {
  const app =
    "function App(){const key=()=>{throw new Error()};return <Loading on={key}><p>ok</p></Loading>}render(App,document.body);";
  expect(codes(app)).toEqual([]);
  expect(codes(app.replace("<p>ok", "<p onClick={()=>{throw new Error()}}>ok"))).toEqual([
    "UNHANDLED_HANDLER_FAILURE"
  ]);
});
it("keeps class receiver state, closures, methods, and getters", () => {
  const app =
    "function App(){const pending=createMemo(()=>Promise.resolve('ready'));class Machine{constructor(){this.value='ready'}get valueNow(){return this.value}get(){return this.valueNow}subscribe(fn){fn(this.get());return ()=>{}}start(){return this.get()}}const m=new Machine();createEffect(()=>0,()=>{m.subscribe(()=>{});m.start()});return <p>ok</p>}render(App,document.body);";
  expect(codes(app)).toEqual([]);
  expect(codes(app.replace("get(){return this.valueNow}", "get(){return pending()}"))).toContain(
    "PENDING_ASYNC_FORBIDDEN_SCOPE"
  );
});
it("preserves Array.find element facts and still checks its predicate", () => {
  const app =
    "function App(){const nodes=[document.createElement('button'),undefined];return <button onClick={()=>queueMicrotask(()=>nodes.find(n=>n?.isConnected)?.focus())}/>}render(App,document.body);";
  expect(codes(app)).toEqual([]);
  expect(codes(app.replace("n?.isConnected", "JSON.parse('bad')"))).toEqual([
    "UNHANDLED_HANDLER_FAILURE"
  ]);
});
it("preserves lazy merge overrides rather than treating defaults as a catch", () => {
  const app =
    "function Child(initial){const p=merge({onChange:()=>{}},initial);return <button onClick={()=>p.onChange?.()}/>}function App(){return <Child onChange={()=>{}}/>}render(App,document.body);";
  expect(codes(app)).toEqual([]);
  expect(
    codes(app.replace("<Child onChange={()=>{}}/>", "<Child onChange={()=>{throw new Error()}}/>"))
  ).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  expect(
    codes(
      app
        .replace("function App(){", "declare const injected:()=>void;function App(){")
        .replace("<Child onChange={()=>{}}/>", "<Child onChange={injected}/>")
    )
  ).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
});
it("uses merge defaults only when an override is really absent", () => {
  const app =
    "function Child(initial){const p=merge({onChange:()=>{throw new Error()}},merge({},initial));return <button onClick={()=>p.onChange?.()}/>}function App(){return <Child/>}render(App,document.body);";
  expect(codes(app)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  expect(codes(app.replace("<Child/>", "<Child onChange={()=>{}}/>"))).toEqual([]);
  expect(codes(app.replace("<Child/>", "<Child onChange={undefined}/>"))).toEqual([
    "UNHANDLED_HANDLER_FAILURE"
  ]);
});
it("retains public optional injections beside known defaults", () => {
  const app =
    "export function Entry(initial:{onChange?:()=>void}){const p=merge({onChange:()=>{}},initial);return <button onClick={()=>p.onChange?.()}/>}render(()=><Entry/>,document.body);";
  expect(codes(app)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  expect(codes(app.replace("<Entry/>", "<Entry onChange={()=>{}}/>"))).toEqual([]);
});
it("does not classify unknown imperative methods as Solid reads", () => {
  const result = codes(
    "declare class Base {} function App(){class Machine extends Base {}const m=new Machine();createEffect(()=>0,()=>m.start());return <p>ok</p>}render(App,document.body);"
  );
  expect(result).toContain("UNANALYZED_BOUNDARY");
  expect(result).toContain("ERROR_OUTSIDE_ERRORED_BOUNDARY");
  expect(result).not.toContain("PENDING_ASYNC_FORBIDDEN_SCOPE");
});
it("keeps opaque method results worst-case when exposed through a memo", () => {
  const result = codes(
    "declare class Base {}function App(){class Machine extends Base {}const m=new Machine();const read=createMemo(()=>m.start());createEffect(()=>0,()=>read());return <p>ok</p>}render(App,document.body);"
  );
  expect(result).toContain("PENDING_ASYNC_FORBIDDEN_SCOPE");
  expect(result).toContain("ERROR_OUTSIDE_ERRORED_BOUNDARY");
});
it("does not turn an exported pending obligation into a known uncovered root", () => {
  const body =
    "export function App(){const read=createMemo(()=>Promise.resolve('ready'));return <><Loading on='key'>{null}</Loading><p>{read()}</p></>}";
  expect(codes(body)).toEqual(["COMPONENT_OBLIGATIONS_EXPORTED"]);
  expect(codes(body + "render(App,document.body);")).toEqual(["ASYNC_OUTSIDE_LOADING_BOUNDARY"]);
  expect(codes(body + "render(()=><Loading><App/></Loading>,document.body);")).toEqual([]);
});

it("reads declaration annotations without treating a body as a safety promise", () => {
  const rootDir = mkdtempSync(resolve(packageDir, ".oxc-precision-"));
  const pkg = resolve(rootDir, "node_modules/@probe/annotations");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(
    resolve(pkg, "package.json"),
    JSON.stringify({ name: "@probe/annotations", types: "./index.d.ts" })
  );
  // A permissively parsed body is still not implementation evidence in a declaration.
  writeFileSync(
    resolve(pkg, "index.d.ts"),
    "export function run():void {} export default function safe():void {}"
  );
  const file = resolve(rootDir, "app.tsx");
  writeFileSync(
    file,
    "import safe,{run} from '@probe/annotations';export function App(){return <button onClick={()=>{run();safe()}}/>}"
  );
  const checker = createChecker({ rootDir, files: [file] });
  try {
    const diagnostics = checker.check().diagnostics;
    expect(diagnostics.map(d => d.code)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
    expect(diagnostics.every(d => d.loc.file === file)).toBe(true);
  } finally {
    checker.dispose();
    rmSync(rootDir, { recursive: true, force: true });
  }
});

for (const linked of [false, true]) {
  for (const declarations of [false, true]) {
    it(
      "uses declarations only at the installed boundary (linked=" +
        linked +
        ", declarations=" +
        declarations +
        ")",
      () => {
        const temp = mkdtempSync(resolve(packageDir, ".oxc-precision-"));
        const rootDir = resolve(temp, "app");
        const pkg = resolve(
          linked ? temp : rootDir,
          linked ? "installed-package" : "node_modules/@probe/machine"
        );
        mkdirSync(resolve(pkg, "dist"), { recursive: true });
        mkdirSync(rootDir, { recursive: true });
        if (linked) {
          mkdirSync(resolve(rootDir, "node_modules/@probe"), { recursive: true });
          symlinkSync(pkg, resolve(rootDir, "node_modules/@probe/machine"), "dir");
        }
        writeFileSync(
          resolve(pkg, "package.json"),
          JSON.stringify({
            name: "@probe/machine",
            type: "module",
            exports: declarations
              ? { types: "./dist/index.d.ts", default: "./dist/index.js" }
              : "./dist/index.js"
          })
        );
        const implementation = resolve(pkg, "dist/index.js");
        const probe = resolve(pkg, "dist/probe.tsx");
        // Parse-only package data. Neither file is imported into this test process.
        writeFileSync(
          implementation,
          "export function connect(){throw new Error('dependency body')}"
        );
        writeFileSync(
          probe,
          "import {createMemo} from 'solid-js';export function Probe(){const r=createMemo(()=>Promise.reject(new Error()));return <p>{r()}</p>}"
        );
        writeFileSync(
          resolve(pkg, "dist/index.d.ts"),
          declarations ? "export declare function connect(): {get(key:string):string};" : ""
        );
        if (!declarations) rmSync(resolve(pkg, "dist/index.d.ts"));
        const file = resolve(rootDir, "app.tsx");
        writeFileSync(
          file,
          "import {connect} from '@probe/machine';export function App(){return <button onClick={()=>{try{connect().get('key')}catch{}}}/>}"
        );
        const reads = [];
        const checker = createChecker({
          rootDir,
          files: [probe, file],
          readFile: path => {
            reads.push(path);
            return undefined;
          }
        });
        try {
          const result = checker.check();
          expect(result.diagnostics.every(d => d.loc.file === file)).toBe(true);
          expect(result.diagnostics.filter(d => d.severity === "error")).toEqual([]);
          expect(reads).not.toContain(implementation);
          expect(reads).not.toContain(probe);
          expect(result.diagnostics.filter(d => d.code === "UNANALYZED_BOUNDARY").length).toBe(
            declarations ? 0 : 1
          );
          const next = checker.update(
            file,
            "import {connect} from '@probe/machine';export function App(){return <button onClick={()=>connect().get('key')}/>}"
          );
          expect(next.diagnostics.filter(d => d.code === "UNHANDLED_HANDLER_FAILURE")).toHaveLength(
            1
          );
          expect(next.diagnostics.every(d => d.loc.file === file)).toBe(true);
        } finally {
          checker.dispose();
          rmSync(temp, { recursive: true, force: true });
        }
      }
    );
  }
}
