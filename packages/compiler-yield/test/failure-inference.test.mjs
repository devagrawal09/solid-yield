import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { nativeFailures } from "../../vite-plugin-yield/src/native.js";
const root = resolve(import.meta.dirname, "fixtures");
const infer = files =>
  nativeFailures(
    new Map(Object.entries(files).map(([file, source]) => [resolve(root, file), source]))
  );
const summary = (report, name) => report.functions.find(f => f.name === name).fails;
test("class identity, cross-module aliases and recursive call fixpoint", () => {
  const report = infer({
    "fail.ts":
      'export class Problem extends Error {} export function fail(){throw new Problem("x")}',
    "barrel.ts": 'export {fail as bad} from "./fail";',
    "main.ts":
      'import {bad} from "./barrel"; export function a(n:number){if(n)b(n-1);else bad()} function b(n:number){a(n)}'
  });
  const kind = report.classes.find(c => c.name === "Problem").id;
  assert.deepEqual(summary(report, "a"), [kind]);
  assert.deepEqual(summary(report, "b"), [kind]);
  assert.ok(report.iterations > 1);
});
test("handled catches, rethrows, unknown use, Promise.catch and try-await", () => {
  const report = infer({
    "catch.ts": `class E extends Error{} function fail(){throw new E()}
 function handled(){try{fail()}catch{}}
 function rethrown(){try{fail()}catch(e){throw e}}
 function widened(){try{fail()}catch(e){console.log(e);throw e}}
 async function settled(){try{await Promise.reject(new E())}catch{}}
 function promiseHandled(){return Promise.reject(new E()).catch(()=>1)}
 function promiseRethrown(){return Promise.reject(new E()).catch(e=>{throw e})}`
  });
  const kind = report.classes.find(c => c.name === "E").id;
  assert.deepEqual(summary(report, "handled"), []);
  assert.deepEqual(summary(report, "settled"), []);
  assert.deepEqual(summary(report, "rethrown"), [kind]);
  assert.deepEqual(summary(report, "widened"), ["unknown"]);
  assert.deepEqual(summary(report, "promiseHandled"), []);
  assert.deepEqual(summary(report, "promiseRethrown"), [kind]);
});
test("unknown floor, pure contract, server transport and class typed parameter", () => {
  const report = infer({
    "pure.ts": '"use pure"; export function trusted(){opaque()}',
    "main.ts": `import {trusted} from './pure'; class E extends Error{};
 function instance(e:E){throw e} function unknown(e:unknown){throw e} function value(){throw 'no'}
 function foreign(){return fetch('/api')} function pure(){trusted()}
 async function load(){'use server';throw new E()} function client(){return load()}`
  });
  const kind = report.classes.find(c => c.name === "E").id;
  assert.deepEqual(summary(report, "instance"), [kind]);
  for (const name of ["unknown", "value", "foreign"])
    assert.deepEqual(summary(report, name), ["unknown"]);
  assert.deepEqual(summary(report, "pure"), []);
  assert.deepEqual(summary(report, "client"), ["ChunkError", kind].sort());
});
test("constructor failures, field initializers and inherited constructors are included", () => {
  const report = infer({
    "construct.ts": `class A extends Error{} class Base {constructor(){throw new A()}} class Child extends Base{} class Field {value=opaque()}
 function inherit(){return new Child()} function field(){return new Field()}`
  });
  const kind = report.classes.find(c => c.name === "A").id;
  assert.deepEqual(summary(report, "inherit"), [kind]);
  assert.deepEqual(summary(report, "field"), ["unknown"]);
});

test("named Promise handlers contribute their own failures; opaque catch methods stay unknown", () => {
  const report = infer({
    "handlers.ts": `class A extends Error{} class B extends Error{}
 function handler(){throw new B()} function named(){return Promise.reject(new A()).catch(handler)}
 function opaque(x:any){return x.catch(()=>1)}`
  });
  const kind = report.classes.find(c => c.name === "B").id;
  assert.deepEqual(summary(report, "named"), [kind]);
  assert.deepEqual(summary(report, "opaque"), ["unknown"]);
});
