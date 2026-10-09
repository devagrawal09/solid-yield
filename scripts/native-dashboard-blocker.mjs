#!/usr/bin/env node
// F-S36, F-S37 and D-119 are in. Pin the remaining errors by group (F-S39 onward); this is not runtime acceptance.
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
const providerErrors = errors.filter(d => {
  if (d.file?.fileName !== file || d.code !== 2322) return false;
  const origin = locate(result.positions.get(file), d.start, d.length);
  return authored.slice(0, origin.sourceStart).split("\n").length === 23;
});
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
    "native dashboard type contract: PASS (both shared filter Sources accepted; F-S37 fixed)"
  );
  process.exit(0);
}
// F-S37 is fixed: useFilters holds the provided value in setup and its guard,
// ruled out by the Filters type, raises nothing.
const helperStart = output.indexOf("export function* useFilters");
const helperEnd = output.indexOf("export const FilterBar", helperStart);
const helper = output.slice(helperStart, helperEnd);
assert.match(helper, /yield\* __nativeUseContext\(FilterContext\)/);
assert.match(helper, /yield\* __nativeContextGuard\(value,/);
assert.doesNotMatch(helper, /yield\* value/);
const summary = name =>
  result.inference.functions.find(f => f.name === name && f.file.endsWith("filters.tsx"));
assert.deepEqual(
  summary("useFilters").fails,
  [],
  "F-S37 regressed: the context guard adds a failure"
);
// FilterBar's own unknown comes from its onChange calls into the provided setters.
assert.ok(
  !summary("FilterBar").fails.includes("global:Error"),
  "F-S37 regressed: FilterBar inherits the guard's failure"
);

// Every remaining error, at its authored position, in the group it was classified into.
const authoredAt = d => {
  const file = d.file?.fileName;
  const table = file && result.positions.get(file);
  const origin = table && locate(table, d.start, d.length);
  if (!origin || !files.has(file)) return null;
  const prefix = files.get(file).slice(0, origin.sourceStart).split("\n");
  return `${relative(source, file)}:${prefix.length}:${prefix.at(-1).length + 1}`;
};
const groups = {
  "F-S39": ["chart.tsx:108:45", "panel.tsx:12:43", "panel.tsx:18:68"],
  "F-S40": ["incidents.tsx:108:52"],
  "F-S41": ["main.tsx:3:15"],
  "F-S42": ["panels.tsx:30:5"],
  "F-S43": ["app.tsx:78:45", "app.tsx:78:56", "app.tsx:79:54"]
};
const groupOf = at => Object.keys(groups).find(g => groups[g].includes(at)) ?? "unclassified";
const remaining = errors
  .map(d => {
    const at = authoredAt(d);
    return { group: groupOf(at), at, code: `TS${d.code}` };
  })
  .sort((a, b) => `${a.group} ${a.at} ${a.code}`.localeCompare(`${b.group} ${b.at} ${b.code}`));
assert.ok(
  remaining.every(r => r.group !== "unclassified"),
  "A dashboard error outside the recorded classification: " +
    JSON.stringify(remaining.filter(r => r.group === "unclassified"))
);
assert.ok(
  !remaining.some(r => r.at?.startsWith("filters.tsx")),
  "F-S37 regressed: an error in filters.tsx"
);
const panels = ["SummaryPanel", "SeriesPanel", "IncidentsPanel", "TeamPanel", "NotesPanel"];
const routes = [
  { name: "Overview", paths: ["/", "/overview"] },
  { name: "IncidentDetail", paths: ["/incidents/inc-101", "/incidents/missing"] }
];
const evidence = {
  finding:
    "F-S37 fixed: useContext's value is the provider's (set once), held in setup; its guard raises only what the context's declared type admits",
  fixed: [
    "F-S36: Accessor imports name the library Source; both provider fields typecheck",
    "F-S37: useFilters lowers to nativeUseContext + nativeContextGuard; it and FilterBar infer no failure",
    "D-119 (T08 at app.tsx:69, F-S38 at Panel's children): plain-typed props take the colors their callers pass; IncidentDetail's and Panel's own boundaries cover them"
  ],
  next: {
    "F-S39":
      "A prop or row value used as a method receiver (props.title.toLowerCase(), point.value.toFixed(0)) is not read before the call",
    "F-S40":
      "A callback prop (reload={() => refresh(incidents)}) is hosted by the JSX hole that creates it, not the child event that calls it; its write is refused",
    "F-S41": "render(() => <App />) refuses an entry component whose props are all optional",
    "F-S42":
      "createEffect's effect function returning a cleanup does not match the library's effect phase",
    "F-S43":
      "Route components require FilterContext; FilterProvider surrounds the foreign Router, but the requirement is not discharged across it"
  },
  halfA:
    "FAIL: lowering has exactly the Router boundary notice; the generated program has the 10 errors below, all compiler gaps",
  halfB:
    "FAIL / not run: compiler gaps remain; empty author patch; native hydrated parity, SSR, AckFailed and NotFound comparisons not run",
  boundaries: result.diagnostics.map(d => ({ ...d, file: relative(root, d.file) })),
  remaining,
  sideBySide: {
    author: authored.split("\n").slice(25, 34).join("\n"),
    generated: helper.replaceAll(root, "<root>")
  },
  patch,
  finalCheckedColors: {
    status:
      "unavailable: the generated program is still rejected; inferred any or unknown from rejected output are not final checked colors",
    panels: panels.map(name => ({ name, sharedFilter: "FilterContext" })),
    routes: routes.map(route => ({ ...route, sharedFilter: "FilterContext" }))
  },
  failurePaths: {
    AckFailed: "native comparison not run: compiler gaps remain",
    NotFound: "native comparison not run: compiler gaps remain"
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
for (const r of remaining) console.log(`${r.group} [${r.code}] (${r.at})`);
console.log(
  `native dashboard: F-S37 fixed; ${remaining.length} errors pinned in ${new Set(remaining.map(r => r.group)).size} groups; half A FAIL; half B not run; patch empty`
);
