import { test } from "node:test";
import assert from "node:assert/strict";
import { generate } from "./generate.mjs";
import { classify } from "./run.mjs";
import { catalog } from "./catalog.mjs";
import { corpus } from "./corpus.mjs";
test("all operators have syntactically valid sites and preserve line count", () => {
  const found = new Set();
  for (const project of corpus())
    for (const [file, source] of project.files)
      for (const m of generate(source, file)) {
        found.add(m.operator);
        assert.equal(m.source.split("\n").length, source.split("\n").length, m.operator);
      }
  assert.deepEqual([...found].sort(), Object.keys(catalog).sort());
});
test("a kill requires the expected code at exactly the mutated file and line", () => {
  const m = { operator: "setup-read", file: "App.tsx", line: 4 },
    base = { diagnostics: [] };
  const diag = { file: "App.tsx", line: 4, code: "READ_IN_SETUP", message: "read" };
  assert.equal(classify(m, { diagnostics: [diag] }, base), "killed");
  for (const change of [
    { file: "other.tsx" },
    { line: 3 },
    { line: 5 },
    { code: "FOREIGN_HANDOFF" }
  ])
    assert.equal(classify(m, { diagnostics: [{ ...diag, ...change }] }, base), "survived");
});
test("crashes never kill; an existing exact-line diagnostic follows the literal rule", () => {
  const m = { operator: "effect-arity", file: "App.tsx", line: 3 },
    diag = { file: "App.tsx", line: 3, code: "NATIVE_EFFECT_PHASES", message: "arity" };
  assert.equal(classify(m, { diagnostics: [diag] }, { diagnostics: [diag] }), "killed");
  assert.equal(
    classify(m, { diagnostics: [], cliCrash: "crash" }, { diagnostics: [] }),
    "survived"
  );
});
test("named async handlers and callbacks are edit sites", () => {
  const source =
    'import {createSignal} from "solid-js";function App(){const [n,set]=createSignal(1);const tick=()=>set(2);setTimeout(tick,1);const save=async()=>{await Promise.resolve();};return <button onClick={save}>{n()}</button>}';
  const out = generate(source, "App.tsx");
  assert.equal(out.filter(m => m.operator === "async-reject").length, 1);
  assert.equal(out.filter(m => m.operator === "timer-read").length, 1);
});
test("valid handling is diagnostic-equivalent with a reason", () => {
  const source = "export function run(){try{throw new Error()}catch(e){throw e}}";
  const m = generate(source, "app.ts").find(m => m.operator === "swallow-catch");
  assert.ok(m.equivalent.includes("handle"));
  assert.equal(classify(m, { diagnostics: [] }, { diagnostics: [] }), "equivalent");
});
