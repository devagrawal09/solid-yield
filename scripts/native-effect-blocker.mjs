#!/usr/bin/env node
// Reproduce F-S34 after the three requested compiler fixes. Outside the gate:
// this checks evidence, not native effect parity or acceptance.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import {
  lowerNativeProject,
  inspectNativeProject
} from "../packages/vite-plugin-yield/src/native.js";
const root = resolve(import.meta.dirname, "..");
const source = join(root, "examples/originals/effect/src");
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const ts = require("typescript");
const files = new Map(
  readdirSync(source)
    .filter(f => /\.[tj]sx?$/.test(f))
    .map(f => [join(source, f), readFileSync(join(source, f), "utf8")])
);
const hash = code => createHash("sha256").update(code).digest("hex");
const hashes = Object.fromEntries([...files].map(([f, c]) => [f, hash(c)]));
const scopeDiagnostics = inspectNativeProject(files);
assert.equal(scopeDiagnostics.length, 1);
assert.equal(scopeDiagnostics[0].code, "MODULE_STATE");
assert.equal(scopeDiagnostics[0].line, 20);
assert.equal(scopeDiagnostics[0].column, 7);
let original;
try {
  lowerNativeProject(files);
} catch (error) {
  assert.equal(error.code, "SUGAR_CALLBACK");
  assert.equal(error.id, join(source, "solid-effect.ts"));
  assert.equal(error.loc.line, 50);
  assert.equal(error.loc.column, 16);
  assert.equal(error.sourceSpan.generated, true);
  assert.equal(error.intermediateRead, "parent()");
  assert.equal(error.intermediateHost, "() => ManagedRuntime.make(layer, parent()?.memoMap)");
  original = {
    diagnostic: error.message.replaceAll(root + "/", ""),
    file: error.id.replace(root + "/", ""),
    reportedLine: error.loc.line,
    reportedColumn: error.loc.column + 1,
    sourceSpan: error.sourceSpan,
    sourceSpanText: files
      .get(error.id)
      .slice(error.sourceSpan.sourceStart, error.sourceSpan.sourceEnd),
    authorReadLine: 52,
    authorSource: files.get(error.id).split("\n").slice(49, 55).join("\n"),
    intermediateRead: error.intermediateRead,
    intermediateHost: error.intermediateHost
  };
}
assert.ok(original, "F-S34 no longer reproduces; run both acceptance halves.");
const dir = join(root, "examples/effect-yield/.native-generated/effect-blocker");
mkdirSync(dir, { recursive: true });
const options = {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler
};
function errors(file, code) {
  const host = ts.createCompilerHost(options),
    read = host.readFile.bind(host),
    exists = host.fileExists.bind(host);
  host.readFile = f => (f === file ? code : read(f));
  host.fileExists = f => f === file || exists(f);
  return ts
    .getPreEmitDiagnostics(ts.createProgram([file], options, host))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}
const probes = [];
for (const [name, code] of [
  [
    "foreign-effect-generator",
    'import {Effect} from "effect";\nexport const program = Effect.gen(function* () { yield* Effect.sleep(1); return 1; });\n'
  ],
  ["module-log-store", files.get(join(source, "log.ts"))]
]) {
  const input = join(source, `${name}.ts`),
    result = lowerNativeProject(new Map([[input, code]])),
    generated = result.files.get(input);
  assert.deepEqual(errors(input, code), []);
  const output = join(dir, `${name}.ts`);
  writeFileSync(output, generated);
  assert.deepEqual(errors(output, generated), []);
  assert.ok(!generated.includes("__nativeAttempt"));
  if (name === "module-log-store") {
    assert.equal(result.diagnostics[0].code, "MODULE_STATE");
    assert.ok(generated.includes('from "solid-js"'));
    assert.ok(!generated.includes("$store"));
  }
  probes.push({
    name,
    original: code,
    generated,
    diagnostics: result.diagnostics.map(d => ({ ...d, file: d.file.replace(root + "/", "") })),
    typecheck: "PASS before and after"
  });
}
for (const [f, c] of files) assert.equal(hash(readFileSync(f, "utf8")), hashes[f]);
const evidence = {
  finding: "F-S34: a setup helper's context read is captured by a plain failure producer",
  halfA:
    "FAIL: MODULE_STATE is correct; the new compiler refusal is not an author disagreement and reports a generated span at the helper name",
  halfB:
    "FAIL: not run; no checked native program exists, stop rule applied before an author patch",
  scopeDiagnostics: scopeDiagnostics.map(d => ({ ...d, file: d.file.replace(root + "/", "") })),
  original,
  patch: "",
  probes,
  originalHashes: Object.fromEntries(
    Object.entries(hashes).map(([f, h]) => [f.replace(root + "/", ""), h])
  )
};
if (process.argv[2])
  writeFileSync(resolve(process.argv[2]), JSON.stringify(evidence, null, 2) + "\n");
for (const d of evidence.scopeDiagnostics)
  console.log(`[${d.code}] ${d.message} (${d.file}:${d.line}:${d.column})`);
console.log(original.diagnostic);
console.log("patch: empty (no author edits)");
console.log("scope probes: generator protocol PASS; module store PASS; originals byte-identical");
console.log("native effect acceptance: half A FAIL; half B FAIL (structural stop)");
