#!/usr/bin/env node
// Pin the first structural stop after F-S35; this is not runtime acceptance.
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
const contextErrors = errors.filter(
  d =>
    d.file?.fileName === file &&
    d.code === 2322 &&
    /Type 'Source<(Range|TeamFilter), never, false>' is not assignable to type 'Accessor</.test(
      ts.flattenDiagnosticMessageText(d.messageText, "\n")
    )
);
assert.equal(
  contextErrors.length,
  2,
  "F-S36 changed: review the context facade before claiming dashboard acceptance."
);
const providerLine = authored.split("\n").findIndex(l => l.includes("<FilterContext value=")) + 1;
assert.equal(providerLine, 23);
const structuralDiagnostics = contextErrors.map(d => {
  const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
  const kind = /Source<(Range|TeamFilter),/.exec(message)[1];
  const property = kind === "Range" ? "range" : "team";
  const at = d.file.getLineAndCharacterOfPosition(d.start);
  const origin = locate(result.positions.get(file), d.start, d.length);
  const prefix = authored.slice(0, origin.sourceStart).split("\n");
  return {
    code: "TS2322",
    message,
    property,
    author: {
      file: relative(root, file),
      line: providerLine,
      column: authored.split("\n")[providerLine - 1].indexOf(property) + 1,
      text: authored.split("\n")[providerLine - 1].trim()
    },
    generated: {
      file: relative(root, file),
      line: at.line + 1,
      column: at.character + 1,
      text: output.slice(d.start, d.start + d.length)
    },
    mapped: {
      line: prefix.length,
      column: prefix.at(-1).length + 1,
      generated: origin.generated,
      text: authored.slice(origin.sourceStart, origin.sourceEnd)
    }
  };
});
assert.match(output, /import type \{ Accessor \} from "solid-js"/);
assert.match(output, /range: Accessor<Range>/);
assert.match(output, /team: Accessor<TeamFilter>/);
assert.match(output, /range,\s+team,\s+setRange,\s+setTeam/);
const panels = ["SummaryPanel", "SeriesPanel", "IncidentsPanel", "TeamPanel", "NotesPanel"];
const routes = [
  { name: "Overview", paths: ["/", "/overview"] },
  { name: "IncidentDetail", paths: ["/incidents/inc-101", "/incidents/missing"] }
];
const evidence = {
  finding:
    "F-S36: the shared FilterContext keeps Solid Accessor types but its generated provider supplies yield Sources",
  halfA:
    "FAIL: F-S35 is fixed and lowering returns only the Router boundary, but the generated context facade does not typecheck; both field errors map to the authored provider",
  halfB:
    "FAIL / not run: first new structural reason; no author patch, native hydrated parity, SSR, AckFailed or NotFound comparison",
  boundaries: result.diagnostics.map(d => ({ ...d, file: relative(root, d.file) })),
  structuralDiagnostics,
  sideBySide: {
    author: authored.split("\n").slice(11, 24).join("\n"),
    generated: output
      .slice(output.indexOf("interface Filters"), output.indexOf("export function* useFilters"))
      .replaceAll(root, "<root>")
  },
  patch,
  finalCheckedColors: {
    status:
      "unavailable: the generated project fails its shared context contract; inferred any or unknown colors in rejected output are not checked colors",
    panels: panels.map(name => ({
      name,
      pending: "unavailable",
      fails: "unavailable",
      requires: "unavailable",
      sharedFilter: "FilterContext"
    })),
    routes: routes.map(route => ({
      ...route,
      pending: "unavailable",
      fails: "unavailable",
      requires: "unavailable",
      sharedFilter: "FilterContext"
    }))
  },
  failurePaths: {
    AckFailed: "original catches this class and writes the row failure; native comparison not run",
    NotFound:
      "original route has Errored around Loading and IncidentBody; native comparison not run"
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
for (const d of structuralDiagnostics)
  console.log(
    `[${d.code}] ${d.message}\n  authored provider: ${d.author.file}:${d.author.line}:${d.author.column}; generated: ${d.generated.line}:${d.generated.column}; mapped: ${d.mapped.line}:${d.mapped.column}`
  );
console.log(
  "native dashboard F-S36 regression pin: PASS; half A FAIL; half B FAIL / not run; patch empty; final checked colors unavailable"
);
