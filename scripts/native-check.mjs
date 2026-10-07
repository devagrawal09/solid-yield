#!/usr/bin/env node
// Real diagnostics from reconstructed probes and all nine twin inputs.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { createRequire } from "node:module";
import { format, resolveConfig } from "prettier";
import assert from "node:assert/strict";
import {
  inspectNativeProject,
  nativeFailures,
  lowerNativeProject
} from "../packages/vite-plugin-yield/src/native.js";
import { sugarFacts } from "../packages/compiler-yield/src/sugar-facts.js";
import { fixtures, missingSlots } from "./native/fixtures.mjs";
const root = resolve(import.meta.dirname, "..");
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const ts = require("typescript");
const lintRequire = createRequire(join(root, "examples/harness/package.json"));
const { ESLint } = lintRequire("eslint");
const parser = lintRequire("@typescript-eslint/parser");
const plugin = lintRequire("eslint-plugin-solid-yield").default;
const generated = join(root, "packages/vite-plugin-yield/test/.native-generated");
mkdirSync(generated, { recursive: true });
const compilerOptions = {
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
  lib: ["lib.esnext.d.ts", "lib.dom.d.ts"]
};
const tsconfig = join(generated, "tsconfig.json");
writeFileSync(
  tsconfig,
  JSON.stringify(
    {
      compilerOptions: {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "preserve",
        jsxImportSource: "solid-yield",
        jsxFactory: "jsx",
        jsxFragmentFactory: "Fragment",
        types: [],
        lib: ["ESNext", "DOM"]
      },
      include: ["**/*.tsx", "**/*.ts"]
    },
    null,
    2
  ) + "\n"
);
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ["**/*.tsx", "**/*.ts"],
      languageOptions: { parser, parserOptions: { project: tsconfig, tsconfigRootDir: root } },
      plugins: { "solid-yield": plugin },
      rules: plugin.configs.recommended.rules
    }
  ]
});
const results = [];
const outputs = new Map();
for (const fixture of fixtures) {
  const file = join(generated, fixture.id + ".tsx");
  try {
    const out = lowerNativeProject(new Map([[file, fixture.source]]));
    const code = await format(out.files.get(file), {
      ...(await resolveConfig(file)),
      filepath: file
    });
    writeFileSync(file, code);
    outputs.set(file, code);
    results.push({ ...fixture, file: relative(root, file), stage: "generated", diagnostics: [] });
  } catch (error) {
    results.push({
      ...fixture,
      stage: "transform",
      diagnostics: error.diagnostics ?? [
        {
          code: error.code ?? error.message.match(/\[(\w+)\]/)?.[1] ?? "TRANSFORM",
          message: error.message
        }
      ]
    });
  }
  console.log(`native fixture ${fixture.id}: ${results.at(-1).stage}`);
}
const foreignEdges = ["class-memo", "unknown-memo"].map(id => {
  const file = join(generated, `foreign-${id}.tsx`);
  const code = `import {foreign} from "solid-yield"; import {App} from "./${id}"; export const NativeHandoff=foreign(App);`;
  writeFileSync(file, code);
  outputs.set(file, code);
  return { id, file: relative(root, file), source: code, diagnostics: [] };
});
const program = ts.createProgram([...outputs.keys()], compilerOptions);
const diagnostics = ts.getPreEmitDiagnostics(program);
for (const edge of foreignEdges) {
  edge.diagnostics = diagnostics
    .filter(d => d.file?.fileName === join(root, edge.file))
    .map(d => ({
      stage: "type",
      code: `TS${d.code}`,
      message: ts.flattenDiagnosticMessageText(d.messageText, "\n")
    }));
  assert.ok(
    edge.diagnostics.some(d => d.message.includes("FOREIGN_HANDOFF")),
    `${edge.id}: foreign edge must reject inferred failures`
  );
}
for (const result of results.filter(r => r.stage === "generated")) {
  const file = join(root, result.file);
  result.diagnostics = diagnostics
    .filter(d => !d.file || d.file.fileName === file)
    .map(d => ({
      stage: "type",
      code: `TS${d.code}`,
      message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
      line:
        d.file && d.start !== undefined
          ? d.file.getLineAndCharacterOfPosition(d.start).line + 1
          : null
    }));
  const [lint] = await eslint.lintText(outputs.get(file), { filePath: file });
  result.diagnostics.push(
    ...lint.messages.map(m => ({
      stage: "lint",
      code: m.ruleId ?? "parse",
      message: m.message,
      line: m.line,
      severity: m.severity
    }))
  );
  result.stage = result.diagnostics.some(d => d.stage === "type" || d.severity === 2)
    ? "checked-error"
    : "accepted";
  if (result.expected === "accepted")
    assert.equal(result.stage, "accepted", `${result.id}: ${JSON.stringify(result.diagnostics)}`);
}
const filesUnder = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    if (["node_modules", ".generated", ".native-generated", "dist"].includes(d.name)) return [];
    const file = join(dir, d.name);
    return d.isDirectory()
      ? filesUnder(file)
      : /\.[jt]sx?$/.test(file) && !file.endsWith(".d.ts")
        ? [file]
        : [];
  });
const twins = [
  "docs",
  "effect",
  "hackernews-spa",
  "rendering",
  "room",
  "sierpinski",
  "sierpinski-h",
  "todos",
  "todos-h"
];
const originals = [];
for (const twin of twins) {
  const original = twin.replace(/-h$/, "");
  const dir = join(
    root,
    "examples/originals",
    original,
    original === "rendering" ? "shared/src" : "src"
  );
  const input = new Map(filesUnder(dir).map(file => [file, readFileSync(file, "utf8")]));
  const failureReport = nativeFailures(input);
  let errors = inspectNativeProject(input);
  let output;
  if (!errors.length)
    try {
      output = lowerNativeProject(input);
    } catch (error) {
      errors = error.diagnostics ?? [
        { code: error.message.match(/\[(\w+)\]/)?.[1] ?? "TRANSFORM", message: error.message }
      ];
    }
  if (output) {
    const emitted = [];
    for (const [file, code] of output.files) {
      const dest = join(generated, "originals", twin, relative(dir, file));
      mkdirSync(resolve(dest, ".."), { recursive: true });
      writeFileSync(dest, code);
      emitted.push(dest);
    }
    const checked = ts.createProgram(emitted, compilerOptions);
    errors.push(
      ...ts.getPreEmitDiagnostics(checked).map(d => ({
        stage: "type",
        code: `TS${d.code}`,
        message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
        file: d.file?.fileName,
        line:
          d.file && d.start !== undefined
            ? d.file.getLineAndCharacterOfPosition(d.start).line + 1
            : undefined
      }))
    );
    for (const file of emitted) {
      const [lint] = await eslint.lintText(readFileSync(file, "utf8"), { filePath: file });
      errors.push(
        ...lint.messages.map(m => ({
          stage: "lint",
          code: m.ruleId ?? "parse",
          message: m.message,
          file,
          line: m.line,
          severity: m.severity
        }))
      );
    }
  }
  originals.push({
    twin: original + "-yield" + (twin.endsWith("-h") ? "-h" : ""),
    original,
    files: input.size,
    inference: {
      status: "source call-graph estimate; generated colors unchecked until transform succeeds",
      iterations: failureReport.iterations,
      classes: failureReport.classes,
      components: failureReport.functions
        .filter(f => f.component)
        .map(({ id, calls, rejection, ...f }) => f),
      serverRejections: failureReport.functions
        .filter(f => f.server)
        .map(({ id, calls, ...f }) => f)
    },
    status: output
      ? errors.length
        ? "generated-with-diagnostics"
        : "generated-unverified"
      : "refused",
    diagnostics: errors,
    parity: "not run: no checked native program",
    ssr: "not run: no checked native program",
    differingStatements: null,
    diffReason: !output
      ? "No output emitted; a distance for a nonexistent transform is undefined."
      : "Generated output still requires a checked app harness.",
    reasons: [...new Set(errors.map(d => d.code))]
  });
  console.log(`native original ${twin}: ${originals.at(-1).status} (${errors.length} diagnostics)`);
}
const accepted = new Map(
  [...outputs].filter(
    ([file]) => results.find(r => r.file === relative(root, file))?.stage === "accepted"
  )
);
const analyzerEntry = join(generated, "analyzer-entry.tsx");
accepted.set(
  analyzerEntry,
  'import {render} from "solid-yield"; import {Counter} from "./counter"; render(Counter, document.body);'
);
const facts = sugarFacts(accepted, analyzerEntry);
assert.equal(facts.roots.length, 1, "The existing analyzer must see the generated counter root.");
const normalize = d => ({ ...d, file: d.file ? relative(root, d.file) : undefined });
const report = {
  schema: 1,
  solidVersion: JSON.parse(
    readFileSync(join(root, "examples/originals/todos/node_modules/solid-js/package.json"))
  ).version,
  typing:
    "generated TypeScript + recommended generated lint; source mapping/editor not implemented",
  historicalCorpus:
    "27 named categories reconstructed; seven original identities and all verbatim originals unavailable",
  missingSlots,
  foreignEdges,
  fixtures: results.map(r => ({ ...r, diagnostics: r.diagnostics.map(normalize) })),
  originals: originals.map(r => ({ ...r, diagnostics: r.diagnostics.map(normalize) })),
  analyzer: { roots: facts.roots.length }
};
const destination = join(root, "documentation/native-verification.json");
if (process.argv.includes("--write"))
  writeFileSync(destination, JSON.stringify(report, null, 2).replaceAll(root, "<root>") + "\n");
else {
  const expected = JSON.parse(readFileSync(destination, "utf8"));
  // Paths embedded in compiler messages contain this checkout's absolute root.
  const stable = value => JSON.stringify(value).replaceAll(root, "<root>");
  assert.equal(
    stable(report),
    stable(expected),
    "Native evidence changed; inspect, then rerun with --write."
  );
}
console.log(
  `native: ${results.filter(r => r.stage === "accepted").length} accepted fixtures; ${originals.filter(r => r.status === "refused").length}/9 original twin inputs refused; seven historical probes unavailable`
);
