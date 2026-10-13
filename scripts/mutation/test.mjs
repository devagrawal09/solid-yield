import { test } from "node:test";
import assert from "node:assert/strict";
import { generate } from "./generate.mjs";
import { classify, exactLine } from "./run.mjs";
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
test("a kill: the expected code at a primary or related location in the mutated routine", () => {
  const m = {
      operator: "callback-throw",
      file: "App.tsx",
      line: 6,
      routine: { start: 4, end: 12 }
    },
    base = { diagnostics: [] };
  const diag = { file: "App.tsx", line: 8, code: "FOREIGN_HANDOFF", message: "handoff" };
  assert.equal(classify(m, { diagnostics: [diag] }, base), "killed");
  // Reported at the root (another file), the origin in the routine as related.
  const atRoot = { file: "main.tsx", line: 3, code: "FOREIGN_HANDOFF", message: "handoff" };
  assert.equal(
    classify(m, { diagnostics: [{ ...atRoot, related: [{ file: "App.tsx", line: 9 }] }] }, base),
    "killed"
  );
  for (const d of [
    atRoot,
    { ...atRoot, related: [{ file: "App.tsx", line: 13 }] },
    { ...atRoot, related: [{ file: "other.tsx", line: 9 }] },
    { ...diag, line: 3 },
    { ...diag, line: 13 },
    { ...diag, file: "other.tsx" },
    { ...diag, code: "PENDING_ROOT" }
  ])
    assert.equal(classify(m, { diagnostics: [d] }, base), "survived", JSON.stringify(d));
  // The literal rule, kept for comparison, needs the mutated line itself.
  assert.equal(exactLine(m, { diagnostics: [diag] }), false);
  assert.equal(exactLine(m, { diagnostics: [{ ...diag, line: 6 }] }), true);
});
test("without a routine span, only the mutated line counts", () => {
  const m = { operator: "setup-read", file: "App.tsx", line: 4 },
    diag = { file: "App.tsx", line: 4, code: "READ_IN_SETUP", message: "read" };
  assert.equal(classify(m, { diagnostics: [diag] }, { diagnostics: [] }), "killed");
  assert.equal(
    classify(m, { diagnostics: [{ ...diag, line: 5 }] }, { diagnostics: [] }),
    "survived"
  );
});
test("every generated mutant names its routine, and the routine holds the edit", () => {
  for (const project of corpus())
    for (const [file, source] of project.files)
      for (const m of generate(source, file)) {
        assert.ok(m.routine, `${file}: ${m.operator}`);
        assert.ok(m.routine.start <= m.line && m.line <= m.routine.end, `${file}: ${m.operator}`);
      }
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
test("state moved to module scope and a memo created in its hole are edit sites", () => {
  const source = [
    'import { createSignal, createMemo } from "solid-js";',
    "export function App() {",
    "  const [n, set] = createSignal(1);",
    "  const twice = createMemo(() => n() * 2);",
    "  const [copy] = createSignal(n());",
    "  return <button onClick={() => set(copy())}>{twice()}</button>;",
    "}"
  ].join("\n");
  const out = generate(source, "App.tsx");
  // `copy`'s initial value reads a local: it cannot move
  const moved = out.filter(m => m.operator === "module-state");
  assert.equal(moved.length, 1);
  assert.match(
    moved[0].source.split("\n")[1],
    /^const\s*\[n,\s*set\]\s*=\s*createSignal\(1\);\s*export/
  );
  const created = out.filter(m => m.operator === "create-in-hole");
  assert.equal(created.length, 1);
  assert.match(created[0].source, /\{createMemo\(\(\)\s*=>\s*n\(\)\s*\*\s*2\)\(\)\}/);
  for (const m of [...moved, ...created])
    assert.equal(m.source.split("\n").length, source.split("\n").length);
});
test("a deleted boundary: an expected code the base did not report counts anywhere", () => {
  const m = {
    operator: "delete-loading",
    file: "App.tsx",
    line: 6,
    routine: { start: 4, end: 12 }
  };
  // reported at the read the Loading covered, in another component
  const read = { file: "List.tsx", line: 9, code: "PENDING_ROOT", message: "pending" };
  assert.equal(classify(m, { diagnostics: [read] }, { diagnostics: [] }), "killed");
  // the base already reported it there: not this mutant's
  assert.equal(classify(m, { diagnostics: [read] }, { diagnostics: [read] }), "survived");
  // another code is not the expected one
  assert.equal(
    classify(m, { diagnostics: [{ ...read, code: "NO_PROVIDER" }] }, { diagnostics: [] }),
    "survived"
  );
  // other operators keep the routine rule
  assert.equal(
    classify(
      { ...m, operator: "setup-read" },
      { diagnostics: [{ ...read, code: "READ_IN_SETUP" }] },
      {
        diagnostics: []
      }
    ),
    "survived"
  );
});
