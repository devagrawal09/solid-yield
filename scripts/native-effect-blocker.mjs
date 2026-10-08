#!/usr/bin/env node
// Reproduce structural lowering failures. This is evidence, not an acceptance step.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { lowerNativeProject } from "../packages/vite-plugin-yield/src/native.js";

const root = resolve(import.meta.dirname, "..");
const source = join(root, "examples/originals/effect/src");
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const ts = require("typescript");
const files = new Map(
  readdirSync(source)
    .filter(file => /\.[tj]sx?$/.test(file))
    .map(file => [join(source, file), readFileSync(join(source, file), "utf8")])
);
let diagnostic;
try {
  lowerNativeProject(files);
  throw new Error("The structural blocker no longer reproduces; run full effect acceptance.");
} catch (error) {
  assert.match(error.message, /^\[SUGAR_CALLBACK\]/);
  diagnostic = error.message.replaceAll(root + "/", "");
}

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
  const host = ts.createCompilerHost(options);
  const read = host.readFile.bind(host);
  host.readFile = name => (name === file ? code : read(name));
  const exists = host.fileExists.bind(host);
  host.fileExists = name => name === file || exists(name);
  return ts.getPreEmitDiagnostics(ts.createProgram([file], options, host)).map(d => {
    assert.ok(d.file && d.start !== undefined);
    const pos = d.file.getLineAndCharacterOfPosition(d.start);
    return {
      code: `TS${d.code}`,
      line: pos.line + 1,
      column: pos.character + 1,
      message: ts.flattenDiagnosticMessageText(d.messageText, "\n")
    };
  });
}

const probes = [];
for (const [name, original] of [
  ["module-log-store", files.get(join(source, "log.ts"))],
  [
    "foreign-effect-generator",
    'import { Effect } from "effect";\nexport const program = Effect.gen(function* () { yield* Effect.sleep(1); return 1; });\n'
  ]
]) {
  const input = join(source, `${name}.ts`);
  assert.deepEqual(errors(input, original), [], `${name}: the source must typecheck`);
  const result = lowerNativeProject(new Map([[input, original]]));
  const generated = result.files.get(input);
  assert.ok(generated);
  const output = join(dir, `${name}.ts`);
  writeFileSync(output, generated);
  const diagnostics = errors(output, generated);
  assert.ok(diagnostics.length, `${name}: blocker no longer reproduces`);
  probes.push({ name, original, generated, diagnostics });
}
const evidence = { diagnostic, probes };
if (process.argv[2])
  writeFileSync(resolve(process.argv[2]), JSON.stringify(evidence, null, 2) + "\n");
console.log(diagnostic);
for (const probe of probes)
  console.log(
    `${probe.name}: original typecheck PASS; generated ${probe.diagnostics.map(d => `${d.code}@${d.line}:${d.column}`).join(", ")}`
  );
