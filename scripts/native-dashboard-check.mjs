#!/usr/bin/env node
// Native dashboard half A: the unchanged original lowers with exactly the Router
// boundary notice, and the generated program type-checks. Records the evidence
// (fixed gaps, side by side, final checked colors). Half B is
// examples/harness/native-dashboard/check.mjs.
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
// F-S45: FilterBar's onChange calls reach the provider's setters, which fail nothing.
assert.deepEqual(summary("FilterBar").fails, [], "F-S45 regressed: FilterBar fails");
assert.match(output, /setRange: __nativeWrite\(setRange\)/);

// Half A: the generated program has no errors.
const authoredAt = d => {
  const file = d.file?.fileName;
  const table = file && result.positions.get(file);
  const origin = table && locate(table, d.start, d.length);
  if (!origin || !files.has(file)) return null;
  const prefix = files.get(file).slice(0, origin.sourceStart).split("\n");
  return `${relative(source, file)}:${prefix.length}:${prefix.at(-1).length + 1}`;
};
assert.deepEqual(
  errors.map(d => ({ at: authoredAt(d), code: `TS${d.code}` })),
  [],
  "The native dashboard has errors"
);

// Final checked colors: each panel's and route's component type, as the
// accepted program types it.
const checker = program.getTypeChecker();
const colorsOf = (name, fileName) => {
  const file = program.getSourceFile(join(source, fileName));
  let declaration;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name) declaration = node;
    else ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(declaration, `${name} in ${fileName}`);
  const [signature] = checker.getTypeAtLocation(declaration.name).getCallSignatures();
  const view = checker.getReturnTypeOfSignature(signature);
  const [pending, fails, waits, requires] = (view.aliasTypeArguments ?? []).map(t =>
    checker.typeToString(t).replaceAll(root, "<root>")
  );
  assert.equal(view.aliasSymbol?.name, "ComponentView", `${name}'s view`);
  return { pending, fails, waits, requires };
};
const panels = [
  ["SummaryPanel", "panels.tsx"],
  ["SeriesPanel", "chart.tsx"],
  ["IncidentsPanel", "incidents.tsx"],
  ["TeamPanel", "panels.tsx"],
  ["NotesPanel", "panels.tsx"]
];
const routes = [
  { name: "Overview", file: "app.tsx", paths: ["/", "/overview"] },
  { name: "IncidentDetail", file: "app.tsx", paths: ["/incidents/inc-101", "/incidents/missing"] }
];
const evidence = {
  finding:
    "Half A PASS: the unchanged original lowers with exactly the Router boundary notice; the generated program type-checks",
  fixed: [
    "F-S36: Accessor imports name the library Source; both provider fields typecheck",
    "F-S37: useFilters lowers to nativeUseContext + nativeContextGuard; it and FilterBar infer no failure",
    "D-119 (T08 at app.tsx:69, F-S38 at Panel's children): plain-typed props take the colors their callers pass; IncidentDetail's and Panel's own boundaries cover them",
    "F-S39: a member a source lacks (props.title.toLowerCase(), point.value.toFixed(0)) reads the source first; path and index-signature keys stay paths; a wrapped Errored fallback keeps Solid's (error, reset) types",
    "F-S40: a component callback prop whose body writes (refresh, a setter) is hosted by the event that calls it, not the hole that creates it",
    "F-S41: a component that renders its own provider but never places props.children is not a provider wrapper; App keeps its declared props",
    "F-S42: an effect function's returned cleanup registers through onCleanup ($cleanup), which runs before the next effect run or on disposal, as Solid 2 does",
    "F-S43: a foreign router rendered only under providers hands its route components those contexts (nativeForeignProvided); the route handoff is typed as the plain call, so a page that declares no props takes the router's route props",
    "F-S45: a call through a context value's member calls what every provider put there (setRange is a signal setter: no failure); a context's provider tag, HydrationScript and markSafeError fail nothing"
  ],
  runtimeFixes: [
    "nativeWrite: a library setter in a plain function type (setRange: (range: Range) => void) writes when called, where a write is admitted",
    "a provider's expression child (props.children) reads in a hole of the provider's lazy view",
    "an event-phase lexical callback (F-S40's reload) runs in the event that calls it, not the view that created it"
  ],
  halfA:
    "PASS: lowering has exactly the Router boundary notice; the generated program has no errors",
  halfB:
    "examples/harness/native-dashboard/check.mjs: 30-state client parity (AckFailed rollback, NotFound boundary), streamed SSR of 3 URLs, hydration",
  boundaries: result.diagnostics.map(d => ({ ...d, file: relative(root, d.file) })),
  sideBySide: {
    author: authored.split("\n").slice(25, 34).join("\n"),
    generated: helper.replaceAll(root, "<root>")
  },
  patch,
  finalCheckedColors: {
    panels: panels.map(([name, file]) => ({
      name,
      sharedFilter: "FilterContext",
      ...colorsOf(name, file)
    })),
    routes: routes.map(({ name, file, paths }) => ({
      name,
      paths,
      sharedFilter: "FilterContext",
      ...colorsOf(name, file)
    }))
  },
  originalHashes
};
for (const [f, c] of files) assert.equal(hash(readFileSync(f, "utf8")), hash(c));
const expected = join(root, "examples/harness/native-dashboard/half-a.json");
if (process.argv.includes("--record"))
  writeFileSync(expected, JSON.stringify(evidence, null, 2) + "\n");
else assert.deepEqual(evidence, JSON.parse(readFileSync(expected, "utf8")));
for (const d of evidence.boundaries)
  console.log(`[${d.code}] ${d.message} (${d.file}:${d.line}:${d.column})`);
for (const panel of evidence.finalCheckedColors.panels)
  console.log(`${panel.name}: pending ${panel.pending}, fails ${panel.fails}`);
console.log("native dashboard half A: PASS (exact diagnostics; generated program type-checks)");
