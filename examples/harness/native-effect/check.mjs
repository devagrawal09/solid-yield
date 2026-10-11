#!/usr/bin/env node
// Native Effect half B (D-121): the original, the author's minimal fix
// (author-fix.json: the cancel handler's absorbed failure) as plain Solid,
// and that fixed copy's native model, driven by the twin's script. Half A is
// scripts/native-effect-check.mjs.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { firstDifference, normalize } from "../src/index.ts";
const root = resolve(import.meta.dirname, "../../..");
const require = createRequire(join(root, "package.json"));
const original = join(root, "examples/originals/effect");
const fixed = join(original, ".native-generated/fixed");

// The author's fix as a project of its own (git-ignored), beside the original
// so it resolves the original's dependencies; the original stays byte-identical.
rmSync(fixed, { recursive: true, force: true });
cpSync(join(original, "src"), join(fixed, "src"), { recursive: true });
writeFileSync(
  join(fixed, "tsconfig.json"),
  JSON.stringify({ extends: join(original, "tsconfig.json"), include: ["src/**/*"] }, null, 2) +
    "\n"
);
const fix = JSON.parse(readFileSync(join(import.meta.dirname, "author-fix.json"), "utf8"));
for (const { file, edits } of fix.files) {
  const path = join(fixed, file);
  let code = readFileSync(path, "utf8");
  for (const { from, to } of edits) {
    assert.ok(code.includes(from), "author fix anchor missing: " + from);
    code = code.replace(from, to);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, code);
}

const dir = mkdtempSync(join(tmpdir(), "native-effect-"));
const run = mode => {
  const output = join(dir, `${mode}.json`);
  try {
    execFileSync(
      process.execPath,
      [
        join(dirname(require.resolve("vitest/package.json")), "vitest.mjs"),
        "run",
        "--maxWorkers=1",
        "--config",
        "examples/harness/native-effect/vite.config.mjs"
      ],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 600000,
        env: { ...process.env, NATIVE_EFFECT_MODE: mode, NATIVE_EFFECT_OUTPUT: output }
      }
    );
  } catch (error) {
    process.stderr.write(error.stdout ?? "");
    process.stderr.write(error.stderr ?? "");
    throw error;
  }
  return JSON.parse(readFileSync(output, "utf8"));
};
try {
  const [plain, fixedRun, native] = ["original", "fixed", "native"].map(run);
  const at = name => plain.snapshots[plain.steps.findIndex(([step]) => step === name)];
  // The script reaches the states it is meant to compare (the twin's parity test).
  for (const [step, value] of [
    ["type s", "Searching…"],
    ["so lands", "pkg-name"],
    ["so lands", 'search "s" interrupted'],
    ["halfway", "results stale"],
    ["zzz lands (no matches)", "No packages match"],
    ["retries give up", "Search gave up after retries"],
    ["orders load", "No orders yet."],
    ["reserving done, charging", "Cancel checkout"],
    ["orders refresh", "ord_"],
    ["compensations run", "Card declined"],
    ["compensations after cancel", "Checkout cancelled"]
  ])
    assert.ok(at(step)?.includes(value), `original step ${step} must reach ${value}`);
  for (const [name, other] of [
    ["fixed", fixedRun],
    ["native", native]
  ]) {
    assert.equal(
      firstDifference(plain.steps, plain.snapshots.map(normalize), other.snapshots.map(normalize)),
      null,
      name
    );
    assert.deepEqual(other.logs, plain.logs, `${name}: the same console output`);
  }
  console.log(
    `native Effect parity: ${plain.snapshots.length} states; the author fix and its native model match the original`
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
