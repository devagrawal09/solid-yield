#!/usr/bin/env node
// F-S36 is fixed. Pin the first new reason, F-S37; this is not runtime acceptance.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import {
  inspectNativeProject,
  lowerNativeProject
} from "../packages/vite-plugin-yield/src/native.js";
import { locate } from "../packages/vite-plugin-yield/src/positions.js";
const root = resolve(import.meta.dirname, "..");
const source = join(root, "examples/originals/dashboard/src");
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const ts = require("typescript");
const files = new Map(
  readdirSync(source)
    .filter(f => /\.[tj]sx?$/.test(f) && !f.endsWith(".d.ts"))
    .map(f => [join(source, f), readFileSync(join(source, f), "utf8")])
);
const hash = code => createHash("sha256").update(code).digest("hex");
const originalHashes = Object.fromEntries([...files].map(([f, c]) => [relative(root, f), hash(c)]));
const patch = readFileSync(
  join(root, "examples/harness/native-dashboard/author-fix.patch"),
  "utf8"
);
assert.equal(patch, "");
assert.deepEqual(inspectNativeProject(files), []);
const result = lowerNativeProject(files);
assert.equal(result.diagnostics.length, 1);
assert.equal(result.diagnostics[0].code, "NATIVE_FOREIGN_BOUNDARY");
assert.equal(result.diagnostics[0].line, 92);
assert.equal(result.diagnostics[0].column, 9);
const runtime = join(root, "packages/yield");
const options = {
  strict: true,
  noEmit: true,
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
    "solid-yield": [join(runtime, "dist/types/index.d.ts")],
    "solid-yield/internal": [join(runtime, "dist/types/internal.d.ts")],
    "solid-yield/jsx-runtime": [join(runtime, "jsx/jsx-runtime.d.ts")]
  }
};
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
  .filter(d => d.category === ts.DiagnosticCategory.Error);
const file = join(source, "filters.tsx"),
  authored = files.get(file),
  output = result.files.get(file);
const providerErrors = errors.filter(
  d =>
    d.file?.fileName === file &&
    d.code === 2322 &&
    /Accessor<(Range|TeamFilter)>/.test(ts.flattenDiagnosticMessageText(d.messageText, "\n"))
);
assert.equal(
  providerErrors.length,
  0,
  "F-S36 regressed: context values must use the lowered Source type"
);
assert.match(output, /Source as Accessor/);
assert.match(output, /range: Accessor<Range>/);
assert.match(output, /team: Accessor<TeamFilter>/);
assert.match(output, /Element as _NativeElement/);
if (process.argv.includes("type-contract")) {
  console.log(
    "native dashboard type contract: PASS (both shared filter Sources accepted; F-S37 still blocks setup)"
  );
  process.exit(0);
}
const setupErrors = errors.filter(
  d =>
    d.file?.fileName === file &&
    d.code === 2769 &&
    output.slice(d.start, d.start + d.length) === "FilterBar"
);
assert.equal(
  setupErrors.length,
  1,
  "F-S37 changed: review setup context reads before claiming dashboard acceptance"
);
const structuralDiagnostics = setupErrors.map(d => {
  const message = ts.flattenDiagnosticMessageText(d.messageText, "\n").replaceAll(root, "<root>");
  assert.match(message, /Read<false, never>/);
  assert.match(message, /Raise</);
  assert.match(message, /SetupOp/);
  const at = d.file.getLineAndCharacterOfPosition(d.start);
  const origin = locate(result.positions.get(file), d.start, d.length);
  const prefix = authored.slice(0, origin.sourceStart).split("\n");
  return {
    code: "TS2769",
    message,
    author: {
      file: relative(root, file),
      line: prefix.length,
      column: prefix.at(-1).length + 1,
      text: authored.slice(origin.sourceStart, origin.sourceEnd)
    },
    generated: {
      line: at.line + 1,
      column: at.character + 1,
      text: output.slice(d.start, d.start + d.length).replaceAll(root, "<root>")
    },
    mapped: { generated: origin.generated }
  };
});
const panels = ["SummaryPanel", "SeriesPanel", "IncidentsPanel", "TeamPanel", "NotesPanel"];
const routes = [
  { name: "Overview", paths: ["/", "/overview"] },
  { name: "IncidentDetail", paths: ["/incidents/inc-101", "/incidents/missing"] }
];
const helperStart = output.indexOf("export function* useFilters");
const helperEnd = output.indexOf("export const FilterBar", helperStart);
const evidence = {
  finding:
    "F-S37: useFilters lowers its context value guard and return to Source reads and a Raise; component setup cannot admit them",
  fixed: "F-S36: Accessor imports now name the library Source; both provider fields typecheck",
  halfA:
    "FAIL: unchanged lowering has exactly the Router boundary notice; generated code rejects setup context reads before foreign handoff acceptance can be established",
  halfB:
    "FAIL / not run: first new structural reason; empty author patch; native hydrated parity, SSR, AckFailed and NotFound comparisons not run",
  boundaries: result.diagnostics.map(d => ({ ...d, file: relative(root, d.file) })),
  structuralDiagnostics,
  sideBySide: {
    author: authored.split("\n").slice(25, 34).join("\n"),
    generated:
      output.slice(helperStart, helperEnd).replaceAll(root, "<root>") +
      output.slice(helperEnd, output.indexOf("return view", helperEnd)).replaceAll(root, "<root>")
  },
  patch,
  finalCheckedColors: {
    status:
      "unavailable: setup context contract is rejected; inferred any or unknown from rejected output are not final checked colors",
    panels: panels.map(name => ({
      name,
      pending: "unavailable",
      fails: "unavailable",
      mayWait: "unavailable",
      requires: "unavailable",
      sharedFilter: "FilterContext"
    })),
    routes: routes.map(route => ({
      ...route,
      pending: "unavailable",
      fails: "unavailable",
      mayWait: "unavailable",
      requires: "unavailable",
      sharedFilter: "FilterContext"
    }))
  },
  failurePaths: {
    AckFailed: "native comparison not run under F-S37 stop",
    NotFound: "native comparison not run under F-S37 stop"
  },
  originalHashes
};
for (const [f, c] of files) assert.equal(hash(readFileSync(f, "utf8")), hash(c));
const expected = join(root, "examples/harness/native-dashboard/structural-stop.json");
if (process.argv.includes("--record"))
  writeFileSync(expected, JSON.stringify(evidence, null, 2) + "\n");
else assert.deepEqual(evidence, JSON.parse(readFileSync(expected, "utf8")));
for (const d of evidence.boundaries)
  console.log(`[${d.code}] ${d.message} (${d.file}:${d.line}:${d.column})`);
console.log(
  `F-S37 [TS2769] No overload matches this call. (${structuralDiagnostics[0].author.file}:${structuralDiagnostics[0].author.line}:${structuralDiagnostics[0].author.column})`
);
console.log(
  "native dashboard F-S37 pin: PASS; half A FAIL; half B FAIL / not run; patch empty; final colors unavailable"
);
