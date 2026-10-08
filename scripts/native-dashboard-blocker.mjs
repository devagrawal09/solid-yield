#!/usr/bin/env node
// A pinned compiler stop, not dashboard native acceptance.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  inspectNativeProject,
  lowerNativeProject,
  nativeFailures,
  nativeForeignDiagnostics
} from "../packages/vite-plugin-yield/src/native.js";
const root = resolve(import.meta.dirname, "..");
const source = join(root, "examples/originals/dashboard/src");
const files = new Map(
  readdirSync(source)
    .filter(f => /\.[tj]sx?$/.test(f) && !f.endsWith(".d.ts"))
    .map(f => [join(source, f), readFileSync(join(source, f), "utf8")])
);
assert.equal(
  readFileSync(join(root, "examples/harness/native-dashboard/author-fix.patch"), "utf8"),
  ""
);
const hash = code => createHash("sha256").update(code).digest("hex");
const hashes = Object.fromEntries([...files].map(([f, c]) => [f.replace(root + "/", ""), hash(c)]));
const scopeDiagnostics = inspectNativeProject(files);
assert.deepEqual(scopeDiagnostics, []);
const boundaries = nativeForeignDiagnostics(files).map(d => ({
  ...d,
  file: d.file.replace(root + "/", "")
}));
const sourceFailureSets = nativeFailures(files)
  .functions.filter(f => f.component)
  .map(({ name, file, line, fails }) => ({ name, file, line, fails }));
let original;
try {
  lowerNativeProject(files);
} catch (error) {
  assert.equal(error.code, "SUGAR_CALLBACK");
  assert.equal(error.id, join(source, "panels.tsx"));
  assert.equal(error.loc.line, 47);
  assert.equal(error.loc.column, 34);
  assert.equal(error.sourceSpan.generated, false);
  assert.equal(error.intermediateRead, "totals()");
  assert.equal(error.intermediateHost, "() => totals().success.toFixed(2)");
  original = {
    diagnostic: error.message.replaceAll(root + "/", ""),
    file: error.id.replace(root + "/", ""),
    line: error.loc.line,
    column: error.loc.column + 1,
    sourceSpan: error.sourceSpan,
    sourceSpanText: files
      .get(error.id)
      .slice(error.sourceSpan.sourceStart, error.sourceSpan.sourceEnd),
    authorSource: files.get(error.id).split("\n")[46],
    intermediateRead: error.intermediateRead,
    intermediateHost: error.intermediateHost
  };
}
assert.ok(original, "F-S35 no longer reproduces; run both dashboard acceptance halves.");
for (const [f, c] of files) assert.equal(hash(readFileSync(f, "utf8")), hash(c));
const evidence = {
  finding: "F-S35: a JSX method receiver loses its hole host inside a plain failure producer",
  halfA: "FAIL: the source position is correct, but SUGAR_CALLBACK is a compiler false positive",
  halfB: "FAIL: not run; the stop rule applies before author edits, hydrated parity or SSR",
  scopeDiagnostics,
  boundaries,
  original,
  patch: "",
  sourceFailureSets,
  colorStatus:
    "Source failure inference only, before JSX handler discharge. No generated component colors or foreign handoff checks exist because lowering stopped.",
  originalHashes: hashes
};
const expected = join(root, "examples/harness/native-dashboard/structural-stop.json");
if (process.argv[2] === "--record")
  writeFileSync(expected, JSON.stringify(evidence, null, 2) + "\n");
else assert.deepEqual(evidence, JSON.parse(readFileSync(expected, "utf8")));
for (const d of boundaries)
  console.log(`[${d.code}] ${d.message} (${d.file}:${d.line}:${d.column})`);
console.log(original.diagnostic);
console.log(
  "native dashboard F-S35 regression pin: PASS; acceptance half A FAIL; half B FAIL (not run)"
);
console.log('patch: ""; originals byte-identical; final panel/route colors unavailable');
