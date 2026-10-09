#!/usr/bin/env node
// A pinned compiler stop, not dashboard native acceptance.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import {
  inspectNativeProject,
  lowerNativeProject,
  nativeFailures
} from "../packages/vite-plugin-yield/src/native.js";
import { locate } from "../packages/vite-plugin-yield/src/positions.js";
const root = resolve(import.meta.dirname, "..");
const source = join(root, "examples/originals/dashboard/src");
const files = new Map(
  readdirSync(source)
    .filter(f => /\.[tj]sx?$/.test(f) && !f.endsWith(".d.ts"))
    .map(f => [join(source, f), readFileSync(join(source, f), "utf8")])
);
const expected = join(root, "examples/harness/native-dashboard/structural-stop.json");
const prior = JSON.parse(readFileSync(expected, "utf8"));
assert.equal(
  readFileSync(join(root, "examples/harness/native-dashboard/author-fix.patch"), "utf8"),
  ""
);
const hash = code => createHash("sha256").update(code).digest("hex");
const hashes = Object.fromEntries([...files].map(([f, c]) => [relative(root, f), hash(c)]));
assert.deepEqual(hashes, prior.originalHashes, "The dashboard original must stay byte-identical.");
const scopeDiagnostics = inspectNativeProject(files);
assert.deepEqual(scopeDiagnostics, []);
const result = lowerNativeProject(files);
const boundaries = result.diagnostics.map(d => ({ ...d, file: relative(root, d.file) }));
assert.deepEqual(boundaries, prior.boundaries);
const repaired = result.files.get(join(source, "panels.tsx"));
assert.match(repaired, /return yield\* __nativeLexicalCallback\("hole"/);
assert.doesNotMatch(repaired, /SUGAR_CALLBACK/);
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const ts = require("typescript");
const dir = join(root, "packages/vite-plugin-yield/test/.native-generated/dashboard-stop");
mkdirSync(dir, { recursive: true });
for (const [file, code] of result.files) writeFileSync(join(dir, relative(source, file)), code);
writeFileSync(join(dir, "native-env.d.ts"), 'declare module "*.css" {}\n');
const program = ts.createProgram(
  [...result.files.keys()]
    .map(f => join(dir, relative(source, f)))
    .concat(join(dir, "native-env.d.ts")),
  {
    strict: true,
    noEmit: true,
    noErrorTruncation: true,
    skipLibCheck: true,
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
      "@solidjs/router": [join(root, "examples/originals/dashboard/node_modules/@solidjs/router")]
    }
  }
);
const errors = ts.getPreEmitDiagnostics(program);
const diagnostic = errors.find(
  d =>
    d.code === 2322 &&
    d.file?.fileName === join(dir, "filters.tsx") &&
    d.file.text.slice(d.start, d.start + d.length) === "range"
);
assert.ok(diagnostic, "F-S36 no longer reproduces; run both dashboard acceptance halves.");
const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
assert.match(
  message,
  /Type 'Source<Range, never, false>' is not assignable to type 'Accessor<Range>'/
);
const sourceFile = join(source, "filters.tsx");
const span = locate(result.positions.get(sourceFile), diagnostic.start, diagnostic.length);
assert.ok(span);
assert.equal(span.generated, false);
const sourceLoc = ts
  .createSourceFile(sourceFile, files.get(sourceFile), ts.ScriptTarget.ESNext)
  .getLineAndCharacterOfPosition(span.sourceStart);
assert.equal(sourceLoc.line + 1, 23);
const generatedLoc = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
const original = {
  code: "TS2322",
  diagnostic: `[TS2322] ${message} (examples/originals/dashboard/src/filters.tsx:${sourceLoc.line + 1}:${sourceLoc.character + 1})`,
  file: relative(root, sourceFile),
  line: sourceLoc.line + 1,
  column: sourceLoc.character + 1,
  authorSource: files.get(sourceFile).split("\n")[sourceLoc.line],
  generatedLine: generatedLoc.line + 1,
  generatedSource: diagnostic.file.text.split("\n")[generatedLoc.line],
  sourceSpan: {
    sourceStart: span.sourceStart,
    sourceEnd: span.sourceEnd,
    generated: span.generated
  },
  retainedContract: "range: Accessor<Range>; team: Accessor<TeamFilter>;",
  providedContract: "Source<Range, never, false>; Source<TeamFilter, never, false>"
};
const sourceFailureSets = nativeFailures(files)
  .functions.filter(f => f.component)
  .map(({ name, file, line, fails }) => ({ name, file, line, fails }));
for (const [f, c] of files) assert.equal(hash(readFileSync(f, "utf8")), hash(c));
const evidence = {
  finding: "F-S36: a native context retains Solid Accessor fields after its values become Sources",
  repairedFinding:
    "F-S35: JSX functions and returned functions keep their hole host; dashboard lowering completes",
  halfA:
    "FAIL: generated context contracts reject the correct source provider; author diagnostics are not accepted",
  halfB:
    "FAIL: not run; first-new-structure stop before author edits or native dashboard runtime acceptance",
  scopeDiagnostics,
  boundaries,
  original,
  patch: "",
  sourceFailureSets,
  colorStatus:
    "Final checked panel/route colors are unavailable: generated TypeScript fails at the context contract. Raw source failure sets are not final colors or proof of unhandled foreign failures.",
  originalHashes: hashes
};
if (process.argv[2] === "--record")
  writeFileSync(expected, JSON.stringify(evidence, null, 2) + "\n");
else assert.deepEqual(evidence, JSON.parse(readFileSync(expected, "utf8")));
for (const d of boundaries)
  console.log(`[${d.code}] ${d.message} (${d.file}:${d.line}:${d.column})`);
console.log(original.diagnostic);
console.log("native dashboard F-S36 regression pin: PASS; half A FAIL; half B FAIL (not run)");
console.log('patch: ""; originals byte-identical; final panel/route colors unavailable');
