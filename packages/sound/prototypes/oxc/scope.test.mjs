// @ts-check
import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createChecker } from "./index.mjs";
const packageDir = fileURLToPath(new URL("../../", import.meta.url));
const imports =
  "import {render} from '@solidjs/web'; import {createSignal,createMemo,createEffect,createContext,useContext,For,Loading,Errored,untrack} from 'solid-js';";
function check(text) {
  const rootDir = mkdtempSync(resolve(packageDir, ".oxc-scope-"));
  const file = resolve(rootDir, "main.tsx");
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
it("keeps keyed accessor rows precise across several items", () => {
  expect(
    codes(
      'function App(){const [rows]=createSignal([{id:1,label:"a"},{id:2,label:"b"}]);return <For each={rows()} keyed={r=>r.id}>{r=><p>{r().label}</p>}</For>} render(App,document.body);'
    )
  ).toEqual([]);
});
it("distinguishes plain default rows from their reactive index", () => {
  expect(
    codes(
      'function App(){return <For each={[{label:"a"}]}>{(r,i)=>{const text=r.label;const n=i();return <p>{text}{n}</p>}}</For>} render(App,document.body);'
    )
  ).toEqual(["STRICT_READ_UNTRACKED"]);
});
it("uses accessor item and numeric index in position mode", () => {
  expect(
    codes(
      'function App(){return <For each={["a"]} keyed={false}>{(r,i)=>{const text=r();const n=i;return <p>{text}{n}</p>}}</For>} render(App,document.body);'
    )
  ).toEqual(["STRICT_READ_UNTRACKED"]);
});
it("does not let rendered boundaries cover a row snapshot", () => {
  expect(
    codes(
      'function App(){const read=createMemo(()=>Promise.resolve("a"));return <Loading><For each={[1]}>{()=>{const text=read();return <p>{text}</p>}}</For></Loading>} render(App,document.body);'
    )
  ).toEqual(["PENDING_ASYNC_UNTRACKED_READ"]);
});
it("checks ref reads without calling plain DOM captures", () => {
  expect(
    codes("function App(){let element;return <p ref={element}/> } render(App,document.body);")
  ).toEqual([]);
  expect(
    codes(
      "function App(){const [n]=createSignal(1);const read=()=>n();return <p ref={el=>{el.title=read()}}/>} render(App,document.body);"
    )
  ).toEqual(["STRICT_READ_UNTRACKED"]);
});
it("ref pending reads are setup-like, but failures remain detached", () => {
  expect(
    codes(
      "function App(){const n=createMemo(()=>Promise.resolve(1));return <Loading><p ref={el=>{el.title=n()}}/></Loading>} render(App,document.body);"
    )
  ).toEqual(["PENDING_ASYNC_UNTRACKED_READ"]);
  expect(
    codes(
      "function App(){return <Errored fallback={()=>null}><p ref={()=>{throw new Error()}}/></Errored>} render(App,document.body);"
    )
  ).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
});
it("warns for deferred ref writes without hiding their reads", () => {
  expect(
    codes(
      "function App(){const [n,set]=createSignal(1);return <p ref={()=>set(n())}/>} render(App,document.body);"
    )
  ).toEqual(["STRICT_READ_UNTRACKED", "UNANALYZED_BOUNDARY"]);
});
it("apply helpers inherit effect scope, not their declaration scope", () => {
  const app =
    "function App(){const [n]=createSignal(1);return <Child n={n()}/>} render(App,document.body);";
  expect(
    codes(
      "function Child(p){const apply=x=>console.log(x);createEffect(()=>p.n,x=>apply(x));return <p/>}" +
        app
    )
  ).toEqual([]);
  expect(
    codes(
      "function Child(p){const apply=()=>console.log(p.n);createEffect(()=>0,()=>apply());return <p/>}" +
        app
    )
  ).toEqual(["STRICT_READ_UNTRACKED"]);
});
it("does not confuse null defaults with explicit undefined, including alternatives", () => {
  expect(
    codes(
      'const C=createContext(null);function App(){const x=useContext(C);return <p>{x??"none"}</p>} render(App,document.body);'
    )
  ).toEqual([]);
  expect(
    codes(
      "const C=createContext(undefined);function App(){useContext(C);return <p/>} render(App,document.body);"
    )
  ).toEqual(["CONTEXT_PROVIDER_MISSING"]);
  expect(
    codes(
      "const C=createContext(Math.random()?null:undefined);function App(){useContext(C);return <p/>} render(App,document.body);"
    )
  ).toEqual(["CONTEXT_PROVIDER_MISSING"]);
});
it("untrack forwards failure at its call and still respects a real catch", () => {
  const body = "const sample=()=>{throw new Error()};";
  const result = check(
    "function App(){" + body + "const value=untrack(sample);return <p/>} render(App,document.body);"
  );
  expect(result.diagnostics.map(d => d.code)).toEqual(["SETUP_MAY_THROW"]);
  expect(result.diagnostics[0].loc.col).toBe(
    (imports + "function App(){" + body + "const value=").length + 1
  );
  expect(
    codes(
      "function App(){" +
        body +
        "try{untrack(sample)}catch{}return <p/>} render(App,document.body);"
    )
  ).toEqual([]);
});
it("observes a memo used as a key function and widens an unknown key mode", () => {
  expect(
    codes(
      "function App(){const key=createMemo(()=>{throw new Error()});return <For each={[1]} keyed={key}>{r=><p>{r()}</p>}</For>} render(App,document.body);"
    )
  ).toEqual(["ERROR_OUTSIDE_ERRORED_BOUNDARY"]);
  expect(
    codes(
      "function App(){const [mode]=createSignal(false);return <For each={[1]} keyed={mode()}>{r=><p/>}</For>} render(App,document.body);"
    )
  ).toContain("UNANALYZED_BOUNDARY");
});
it("a declared key function has unknown failures, never a safety contract", () => {
  expect(
    codes(
      "declare function key(r:{id:number}):number; function App(){return <For each={[{id:1}]} keyed={key}>{r=><p>{r().id}</p>}</For>} render(App,document.body);"
    )
  ).toEqual(["ERROR_OUTSIDE_ERRORED_BOUNDARY"]);
});
it("handling the original promise does not handle its derived branch", () => {
  expect(
    codes(
      "async function save(){throw new Error()}function App(){return <button onClick={()=>{const p=save();const fork=p.then(()=>1);void p.catch(()=>{});void fork;}}/>} render(App,document.body);"
    )
  ).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
});
