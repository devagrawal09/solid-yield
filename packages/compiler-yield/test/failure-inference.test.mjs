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
  assert.deepEqual(summary(report, "widened"), [kind]);
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
  assert.deepEqual(
    summary(report, "named"),
    report.classes
      .filter(c => ["A", "B"].includes(c.name))
      .map(c => c.id)
      .sort()
  );
  assert.deepEqual(summary(report, "opaque"), ["unknown"]);
});

test("shadowed intrinsic names are not treated as pure builtins", () => {
  const report = infer({
    "shadow.ts": `export {}; class Failure extends globalThis.Error{} class Error {constructor(){throw new Failure()}}
 function fail(){return new Error()} const Promise={reject(){throw 'not a promise'}};
 function reject(){return Promise.reject()}`
  });
  const kind = report.classes.find(c => c.name === "Failure").id;
  assert.deepEqual(summary(report, "fail"), [kind]);
  assert.deepEqual(summary(report, "reject"), ["unknown"]);
});

test("native clocks and array callbacks keep callback failures and reject shadows", () => {
  const report = infer({
    "intrinsics.ts": `class E extends Error{}
 function clock(){return Date.now()+Math.random()}
 function timer(){setTimeout(()=>{throw new E()},10)}
 function map(){return [1,2].map(()=>{throw new E()})}
 function shadow(){const Date={now(){throw 'bad'}};return Date.now()}
 function opaque(){const collection={map(fn:()=>number){throw 'bad'}};return collection.map(()=>1)}
 `
  });
  const kind = report.classes.find(c => c.name === "E").id;
  assert.deepEqual(summary(report, "clock"), []);
  assert.deepEqual(summary(report, "timer"), [kind]);
  assert.deepEqual(summary(report, "map"), [kind]);
  assert.deepEqual(summary(report, "shadow"), ["unknown"]);
  assert.deepEqual(summary(report, "opaque"), ["unknown"]);
});

test("path-safe catches cover subclasses, keep siblings, unknown, partial rethrows and finalizers", () => {
  const report = infer({
    "paths.ts": `class Base extends Error{} class Sub extends Base{} class Sibling extends Error{}
 function source(flag:boolean){if(flag)throw new Sub();throw new Sibling()}
 function base(){try{throw new Sub()}catch(e){if(e instanceof Base)return 1;throw e}}
 function sibling(){try{source(true)}catch(e){if(e instanceof Base)return 1;throw e}}
 function inverted(){try{source(true)}catch(e){if(!(e instanceof Base))throw e;return 1}}
 function partial(flag:boolean){try{throw new Sub()}catch(e){if(flag)throw e;return 1}}
 function opaque(){try{external()}catch(e){if(e instanceof Base)return 1;throw e}}
 function all(){try{external()}catch{return 1}}
 function finalizer(){try{throw new Sub()}catch{return 1}finally{throw new Sibling()}}
 async function later(){throw new Sibling()}
 function timing(){try{return later()}catch{return 1}}
 async function awaited(){try{return await later()}catch{return 1}}
 function returnedError(){try{throw 0}catch{return new Sub()}}
 function replaced(){try{throw new Sub()}catch{throw new Sibling()}}
 `
  });
  const id = name => report.classes.find(c => c.name === name).id;
  for (const name of ["base", "all", "awaited", "returnedError"])
    assert.deepEqual(summary(report, name), [], name);
  for (const name of ["sibling", "inverted", "finalizer", "timing", "replaced"])
    assert.deepEqual(summary(report, name), [id("Sibling")], name);
  assert.deepEqual(summary(report, "partial"), [id("Sub")]);
  assert.deepEqual(summary(report, "opaque"), ["unknown"]);
});

test("Promise platform contracts retain executor throws, reject calls and opaque thenables", () => {
  const report = infer({
    "promise.ts": `class E extends Error{}
 function number(){return new Promise<number>(resolve=>resolve(1))}
 function throws(){return new Promise<number>(()=>{throw new E()})}
 function rejects(){return new Promise<number>((_,reject)=>reject(new E()))}
 function thenable(value:PromiseLike<number>){return new Promise<number>(resolve=>resolve(value))}
 `
  });
  const kind = report.classes.find(c => c.name === "E").id;
  assert.deepEqual(summary(report, "number"), []);
  assert.deepEqual(summary(report, "throws"), [kind]);
  assert.deepEqual(summary(report, "rejects"), [kind]);
  assert.deepEqual(summary(report, "thenable"), ["unknown"]);
});
