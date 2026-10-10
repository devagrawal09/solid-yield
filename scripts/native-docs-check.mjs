#!/usr/bin/env node
// Native Docs half A: the unchanged original lowers with the recorded notices
// and gives exactly the recorded, correct diagnostics (its root may fail with
// ChunkError and URIError, which nothing handles); the author's minimal fix
// (examples/harness/native-docs/author-fix.json: one Errored around the site)
// type-checks. Half B is examples/harness/native-docs/check.mjs.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { lowerNativeProject } from "../packages/vite-plugin-yield/src/native.js";
import { locate } from "../packages/vite-plugin-yield/src/positions.js";
const root = resolve(import.meta.dirname, "..");
const source = join(root, "examples/originals/docs/src");
const harness = join(root, "examples/harness/native-docs");
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const ts = require("typescript");
const stage = process.argv[2] ?? "diagnostics";
assert.ok(["diagnostics", "typecheck"].includes(stage));
const authored = () =>
  new Map(
    readdirSync(source)
      .filter(f => /\.[tj]sx?$/.test(f) && !f.endsWith(".d.ts"))
      .map(f => [join(source, f), readFileSync(join(source, f), "utf8")])
  );
const fix = JSON.parse(readFileSync(join(harness, "author-fix.json"), "utf8"));
const runtime = join(root, "packages/yield");
const options = {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  noErrorTruncation: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.Preserve,
  jsxImportSource: "solid-yield",
  jsxFactory: "jsx",
  jsxFragmentFactory: "Fragment",
  types: [],
  lib: ["lib.esnext.d.ts", "lib.dom.d.ts"],
  paths: {
    "solid-yield": [join(runtime, "dist/types/index.d.ts")],
    "solid-yield/internal": [join(runtime, "dist/types/internal.d.ts")],
    "solid-yield/jsx-runtime": [join(runtime, "jsx/jsx-runtime.d.ts")]
  }
};
function check(files) {
  const result = lowerNativeProject(files);
  const generated = new Map([
    ...result.files,
    [join(source, "native-env.d.ts"), 'declare module "*.css" {}\n']
  ]);
  const host = ts.createCompilerHost(options),
    read = host.readFile;
  host.readFile = file => generated.get(file) ?? read(file);
  const program = ts.createProgram([...generated.keys()], options, host);
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter(d => d.category === ts.DiagnosticCategory.Error)
    .map(d => {
      const file = d.file?.fileName;
      const table = file && result.positions.get(file);
      const origin = table && locate(table, d.start, d.length);
      const prefix = origin && files.get(file)?.slice(0, origin.sourceStart).split("\n");
      const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      const handoff = /readonly "\[([A-Z_]+)\][^"]*": ([^;]+);/.exec(message);
      return {
        code: handoff?.[1] ?? `TS${d.code}`,
        fails: handoff?.[2] ?? null,
        at: prefix ? `${relative(source, file)}:${prefix.length}:${prefix.at(-1).length + 1}` : null
      };
    });
  return {
    notices: result.diagnostics.map(d => ({
      code: d.code,
      at: `${relative(source, d.file)}:${d.line}:${d.column}`
    })),
    errors
  };
}
if (stage === "typecheck") {
  const files = authored();
  const app = join(source, "app.tsx");
  let code = files.get(app);
  for (const { from, to } of fix.edits) {
    assert.ok(code.includes(from), "author fix anchor missing: " + from);
    code = code.replace(from, to);
  }
  files.set(app, code);
  const { errors } = check(files);
  assert.deepEqual(errors, [], "the author's fix must type-check");
  console.log(`native Docs typecheck: PASS (author fix: ${fix.edits.length} edits in ${fix.file})`);
} else {
  const actual = check(authored());
  const expected = join(harness, "expected-diagnostics.json");
  if (process.argv.includes("--record"))
    writeFileSync(expected, JSON.stringify(actual, null, 2) + "\n");
  else assert.deepEqual(actual, JSON.parse(readFileSync(expected, "utf8")));
  for (const n of actual.notices) console.log(`[${n.code}] ${n.at}`);
  for (const e of actual.errors) console.log(`[${e.code}] ${e.at} ${e.fails ?? ""}`);
  console.log(`native Docs diagnostics: PASS (${actual.errors.length} recorded errors, exact)`);
}
