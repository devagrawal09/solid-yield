// @ts-check
import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createChecker } from "./index.mjs";
const packageDir = fileURLToPath(new URL("../../", import.meta.url));
function check(body) {
  const rootDir = mkdtempSync(resolve(packageDir, ".oxc-noise-"));
  const file = resolve(rootDir, "app.tsx");
  const text =
    "import {render} from '@solidjs/web';import {createSignal,createMemo} from 'solid-js';" + body;
  const checker = createChecker({
    rootDir,
    files: [file],
    readFile: p => (p === file ? text : undefined)
  });
  try {
    return checker.check();
  } finally {
    checker.dispose();
    rmSync(rootDir, { recursive: true, force: true });
  }
}
const errors = text =>
  check(text)
    .diagnostics.filter(d => d.severity === "error")
    .map(d => d.code);
const app = body =>
  `function App(){return <button onClick={()=>{${body}}}/>}render(App,document.body);`;
for (const [safe, broken] of [
  ["false && fail()", "true && fail()"],
  ["true || fail()", "false || fail()"],
  ["42 ?? fail()", "null ?? fail()"],
  ["false ? fail() : 1", "true ? fail() : 1"],
  ["true ? 1 : fail()", "false ? 1 : fail()"]
]) {
  it("checks the reachable branch of " + safe, () => {
    const source = body => "function fail(){throw new RangeError()}" + app(body);
    expect(errors(source(safe))).toEqual([]);
    expect(errors(source(broken))).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  });
}
it("keeps unknown branches, optional injections and abstract scalar defaults", () => {
  expect(errors("declare const injected:()=>void;" + app("injected?.()"))).toEqual([
    "UNHANDLED_HANDLER_FAILURE"
  ]);
  expect(
    errors("declare const flag:boolean;function fail(){throw new Error()}" + app("flag && fail()"))
  ).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  const text =
    "declare const flag:boolean;function fail(){throw new Error()}function App(){const [n]=createSignal(0);return <button onClick={()=>{const v=n();v ?? fail()}}/>}render(App,document.body);";
  expect(errors(text)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  expect(
    errors(
      "declare const text:string;function fail(){throw new Error()}" + app("`${text}` || fail()")
    )
  ).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
});
it("joins skipped assignment paths instead of making a maybe assignment definite", () => {
  const text =
    "declare const flag:boolean;" + app("let f=()=>{throw new Error()};flag && (f=()=>{});f()");
  expect(errors(text)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  expect(errors(app("let f=()=>{throw new Error()};true && (f=()=>{});f()"))).toEqual([]);
});
for (const operation of ["slice()", "concat([])", "at(0)", "pop()", "shift()"]) {
  it("preserves array element bodies through " + operation, () => {
    const source = throws =>
      app(
        `const callbacks=[()=>{${throws ? "throw new Error()" : ""}}];const copy=callbacks.${operation};${/^(at|pop|shift)/.test(operation) ? "copy?.()" : "copy.forEach(f=>f())"}`
      );
    expect(errors(source(false))).toEqual([]);
    expect(errors(source(true))).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
    expect(
      errors(
        "declare const injected:{" +
          operation.split("(")[0] +
          ":()=>Array<()=>void>};" +
          app(
            `injected.${operation}${/^(at|pop|shift)/.test(operation) ? "?.()" : ".forEach(f=>f())"}`
          )
      )
    ).toContain("UNHANDLED_HANDLER_FAILURE");
  });
}
it("preserves Array.from callback bodies and map inputs", () => {
  for (const mapped of [false, true]) {
    const source = throws =>
      app(
        `const fs=[()=>{${throws ? "throw new Error()" : ""}}];Array.from(fs${mapped ? ", f=>f" : ""}).forEach(f=>f())`
      );
    expect(errors(source(false))).toEqual([]);
    expect(errors(source(true))).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  }
  expect(
    errors("declare const input:Array<()=>void>;" + app("Array.from(input).forEach(f=>f())"))
  ).toContain("UNHANDLED_HANDLER_FAILURE");
});
it("keeps native string results through chains and array joins", () => {
  expect(
    errors(
      app(
        "const s='abc';s.slice(0,2).trim().toLowerCase().split(',').map(x=>x.trim());['a'].join(',').trim();s.split(',').pop()?.trim()"
      )
    )
  ).toEqual([]);
  expect(
    errors(app("const s='abc';s.slice(0,2).trim().split(',').map(x=>{x.trim();throw new Error()})"))
  ).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
  expect(
    errors("declare const injected:{slice:()=>{trim:()=>string}};" + app("injected.slice().trim()"))
  ).toContain("UNHANDLED_HANDLER_FAILURE");
  expect(errors("declare const text:string;" + app("text.slice(0,2).trim()"))).toEqual([]);
});
it("does not invent a reactive read from a failure-only lazy prop", () => {
  const source =
    "function Child(props){try{const value=props.value}catch{}return <p/>}function App(){const [read]=createSignal(0);function fail(){throw new Error()}return <Child value={fail()}/>}render(App,document.body);";
  expect(errors(source)).toEqual([]);
  expect(errors(source.replace("value={fail()}", "value={read()}"))).toEqual([
    "STRICT_READ_UNTRACKED"
  ]);
  expect(
    errors(source.replace("try{const value=props.value}catch{}", "const value=props.value;"))
  ).toEqual(["SETUP_MAY_THROW"]);
  const view = check(
    "function Child(props){return <p>{props.value}</p>}function App(){function fail(){throw new Error()}return <Child value={fail()}/>}render(App,document.body);"
  );
  const diagnostic = view.diagnostics.find(d => d.code === "ERROR_OUTSIDE_ERRORED_BOUNDARY");
  expect(diagnostic).toBeDefined();
  expect(diagnostic.loc.col).toBeLessThan(diagnostic.related.at(-1).loc.col);
});
