import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { nativeFailures } from "../../vite-plugin-yield/src/native.js";

// Resolve the real Solid declarations installed by the consuming plugin.
const root = resolve(import.meta.dirname, "../../vite-plugin-yield/test/fixtures");
const infer = source => nativeFailures(new Map([[resolve(root, "typed-context.tsx"), source]]));
const source = body =>
  `import {createContext, createSignal, useContext} from "solid-js";
  interface Counter { count: () => number; inc: () => void }
  function makeCounter() { const [count,set] = createSignal(0); ` +
  body +
  ` }
  const Ctx = createContext<Counter>();
  function read() { const c = useContext(Ctx)!; c.inc(); }
  function App() { return <Ctx value={makeCounter()}><p/></Ctx>; }`;
const safe = "return {count, inc: () => set(count()+1)};";
const failures = report => report.functions.find(fn => fn.name === "read").fails;

for (const [label, helper, expected] of [
  ["caught", "function helper(run:()=>void){try{run()}catch{}}", []],
  ["uncaught", "function helper(run:()=>void){run()}", ["global:RangeError"]],
  [
    "rethrown",
    "function helper(run:()=>void){try{run()}catch(error){throw error}}",
    ["global:RangeError"]
  ],
  [
    "selectively caught",
    "function helper(run:()=>void){try{run()}catch(error){if(!(error instanceof RangeError))throw error}}",
    []
  ],
  [
    "wrong catch",
    "function helper(run:()=>void){try{run()}catch(error){if(!(error instanceof TypeError))throw error}}",
    ["global:RangeError"]
  ],
  [
    "stored",
    "declare function store(value:unknown):void;function helper(run:()=>void){store(run)}",
    ["unknown", "global:RangeError"]
  ],
  [
    "nested",
    "function helper(run:()=>void){setTimeout(()=>run(),0)}",
    ["unknown", "global:RangeError"]
  ],
  [
    "awaited and caught",
    "async function helper(run:()=>Promise<void>){try{await run()}catch{}}",
    []
  ],
  [
    "detached",
    "async function helper(run:()=>Promise<void>){try{run()}catch{}}",
    ["global:RangeError"]
  ],
  ["erased async", "function helper(run:()=>void){try{run()}catch{}}", ["global:RangeError"]],
  [
    "returned Promise",
    "async function helper(run:()=>Promise<boolean>){try{return run()}catch{return false}finally{Math.abs(1)}}",
    ["global:RangeError"]
  ],
  [
    "returned await",
    "async function helper(run:()=>Promise<boolean>){try{return await run()}catch{return false}finally{Math.abs(1)}}",
    []
  ]
]) {
  test(`callback failures are handled at the helper invocation: ${label}`, () => {
    const async = [
      "awaited and caught",
      "detached",
      "erased async",
      "returned Promise",
      "returned await"
    ].includes(label)
      ? "async "
      : "";
    const report = infer(
      `${helper}; function read(){return helper(${async}()=>{throw new RangeError("bad")})}`
    );
    assert.deepEqual(new Set(failures(report)), new Set(expected));
  });
}
test("one helper can be called with differently failing callbacks", () => {
  const report =
    infer(`function helper(run:()=>void){try{run()}catch(error){if(!(error instanceof RangeError))throw error}}
    function handled(){helper(()=>{throw new RangeError("caught")})}
    function read(){helper(()=>{throw new TypeError("not caught")})}`);
  assert.deepEqual(failures(report), ["global:TypeError"]);
  assert.deepEqual(report.functions.find(fn => fn.name === "handled").fails, []);
});
test("a caller catch handles a rejection returned through an async helper", () => {
  const report =
    infer(`async function helper(run:()=>Promise<boolean>){try{return run()}catch{return false}finally{Math.abs(1)}}
    async function read(){try{await helper(async()=>{throw new RangeError("later")})}catch{return false}}`);
  assert.deepEqual(failures(report), []);
  assert.deepEqual(report.diagnostics, []);
});

test("factory methods keep their checked effects through an explicit interface", () => {
  assert.deepEqual(failures(infer(source(safe))), []);
  assert.deepEqual(
    failures(infer(source("const bag: Counter = {count, inc: () => set(count()+1)}; return bag;"))),
    []
  );
});
test("every provider contributes its failures", () => {
  const extra = `function failing() { return {count: () => 0, inc: () => {throw new RangeError("bad")}}; }
    function Other() { return <Ctx value={failing()}><p/></Ctx>; }`;
  const report = infer(source(safe) + extra);
  assert.deepEqual(failures(report), ["global:RangeError"]);
});
test("an opaque provider prevents narrowing to the known provider", () => {
  const extra = `declare function foreign(): Counter;
    function Other() { return <Ctx value={foreign()}><p/></Ctx>; }`;
  assert.deepEqual(failures(infer(source(safe) + extra)), ["unknown"]);
});
test("an authored generator is not treated as a provider factory", () => {
  assert.deepEqual(
    failures(infer(source(safe).replace("function makeCounter", "function* makeCounter"))),
    ["unknown"]
  );
});
test("type-only wrappers and local hooks keep the same context provenance", () => {
  const wrapped = source(safe).replace(
    "const c = useContext(Ctx)!",
    "const c = (useContext(Ctx) as Counter)!"
  );
  assert.deepEqual(failures(infer(wrapped)), []);
  const hooked = source(safe)
    .replace(
      "function read()",
      "function useCounter(): Counter { const c = useContext(Ctx); if (!c) throw new Error(); return c; } function read()"
    )
    .replace("const c = useContext(Ctx)!", "const c = useCounter()");
  assert.deepEqual(failures(infer(hooked)), []);
});
test("an unresolved callback keeps its unknown failure", () => {
  assert.deepEqual(
    failures(infer(source("return {count, inc: foreign};") + "declare const foreign: () => void;")),
    ["unknown"]
  );
});
test("an authored generator method is not treated as an ordinary checked method", () => {
  const body = "return {count, inc: function* () { throw new RangeError(); }};";
  assert.deepEqual(failures(infer(source(body))), ["unknown"]);
});
for (const escape of [
  'const escaped=[bag]; Object.defineProperty(escaped[0],"inc",{value:foreign});',
  'const escaped={bag}; Object.defineProperty(escaped.bag,"inc",{value:foreign});',
  'const escaped={value:bag}; Object.defineProperty(escaped.value,"inc",{value:foreign});',
  'const leak=()=>bag; Object.defineProperty(leak(),"inc",{value:foreign});',
  "foreign(bag);",
  "bag.inc=foreign;"
])
  test(`unknown bag escape remains conservative: ` + escape, () => {
    const body = `const bag = {count, inc: () => set(count()+1)}; ` + escape + " return bag;";
    const report = infer(source(body) + "declare const foreign: (value?: Counter) => void;");
    assert.deepEqual(failures(report), ["unknown"]);
  });
