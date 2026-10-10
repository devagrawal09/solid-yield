#!/usr/bin/env node
// The native edge example: the plain Solid app and its native lowering agree
// on every scripted state, and both release every timer on disposal.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { firstDifference, normalize } from "../src/index.ts";
const root = resolve(import.meta.dirname, "../../..");
const require = createRequire(join(root, "package.json"));
const dir = mkdtempSync(join(tmpdir(), "native-edges-"));
try {
  const results = [];
  for (const mode of ["original", "native"]) {
    const output = join(dir, `${mode}.json`);
    try {
      execFileSync(
        process.execPath,
        [
          join(dirname(require.resolve("vitest/package.json")), "vitest.mjs"),
          "run",
          "--maxWorkers=1",
          "--config",
          "examples/harness/native-edges/vite.config.mjs"
        ],
        {
          cwd: root,
          encoding: "utf8",
          timeout: 120000,
          env: { ...process.env, NATIVE_EDGES_MODE: mode, NATIVE_EDGES_OUTPUT: output }
        }
      );
    } catch (error) {
      process.stderr.write(error.stdout ?? "");
      process.stderr.write(error.stderr ?? "");
      throw error;
    }
    results.push(JSON.parse(readFileSync(output, "utf8")));
  }
  const [original, native] = results;
  assert.equal(original.snapshots.length, 15);
  const states = original.snapshots.map(normalize);
  if (process.env.NATIVE_EDGES_DUMP)
    states.forEach((state, i) => console.log(i, original.steps[i]?.[0], state.slice(-700)));
  for (const [step, present, absent] of [
    [0, 'class="loading"', "Alpha"],
    [1, "Alpha #1", 'class="loading"'],
    [1, "2 rows", null],
    [2, "Alpha #2", "Alpha #1"],
    [3, "at least 1", "Beta"],
    [3, "1 row<", null],
    // The week's rows load in a transition: the day's stay until they arrive.
    [4, "range: 24h", "Gamma"],
    [5, "Gamma #3", "Alpha"],
    [6, 'class="clock">1<', null],
    [7, 'class="clock">2<', null],
    [8, "no rows for none", "Gamma"],
    // The factory's tab context: the switch is a transition, held while the
    // streams tab's board is pending; a derived store, its isPending, an
    // async iterable memo and a Repeat index.
    [9, 'class="tab chosen">rows', 'class="streams'],
    [10, "<h3>round 1</h3>", 'class="loading">board'],
    [10, "<b>1</b> entry 1", null],
    [10, 'class="loading">stream', null],
    [10, "<li>0: ada</li><li>1: grace</li>", null],
    [11, "<li>three</li>", 'class="loading">stream'],
    [12, 'class="streams busy"><h3>round 1</h3>', null],
    [13, "<h3>round 2</h3>", "busy"],
    [14, 'class="tab chosen">rows', 'class="streams']
  ]) {
    assert.ok(states[step].includes(present), `original step ${step}: ${present}`);
    if (absent) assert.ok(!states[step].includes(absent), `original step ${step}: no ${absent}`);
  }
  assert.equal(firstDifference(original.steps, states, native.snapshots.map(normalize)), null);
  assert.equal(original.timersAfterDispose, 0);
  assert.equal(native.timersAfterDispose, 0);
  console.log("native edge example parity: 15 states match original; disposal clears every timer");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
