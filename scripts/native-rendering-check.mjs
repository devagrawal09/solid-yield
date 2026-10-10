#!/usr/bin/env node
// Native Rendering half A: the unchanged original (shared/src and the CSR
// entry) lowers with the recorded notices and gives exactly the recorded,
// correct diagnostics, at their authored positions: three setup reads
// (READ_IN_SETUP, D-042) and a root that may fail with ChunkError (a lazy
// route's chunk; nothing handles it) and may be pending (D-099). The author's
// minimal fix (examples/harness/native-rendering/author-fix.json) type-checks
// and lints clean. Half B is examples/harness/native-rendering/check.mjs.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { lowerNativeProject } from "../packages/vite-plugin-yield/src/native.js";
import { locate } from "../packages/vite-plugin-yield/src/positions.js";
const root = resolve(import.meta.dirname, "..");
const original = join(root, "examples/originals/rendering");
const shared = join(original, "shared/src");
const harness = join(root, "examples/harness/native-rendering");
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const ts = require("typescript");
const lintRequire = createRequire(join(root, "examples/harness/package.json"));
const { ESLint } = lintRequire("eslint");
const parser = lintRequire("@typescript-eslint/parser");
const plugin = lintRequire("eslint-plugin-solid-yield").default;
const stage = process.argv[2] ?? "diagnostics";
assert.ok(["diagnostics", "typecheck"].includes(stage));
const sources = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const file = join(dir, d.name);
    if (d.isDirectory()) return sources(file);
    return /\.tsx?$/.test(d.name) && !d.name.endsWith(".d.ts") ? [file] : [];
  });
const authored = () =>
  new Map(
    [...sources(shared), join(original, "csr/client.tsx")].map(f => [f, readFileSync(f, "utf8")])
  );
export const fix = JSON.parse(readFileSync(join(harness, "author-fix.json"), "utf8"));
/** The author's minimal fix, applied to a copy of the authored files. */
export function patched(files) {
  const out = new Map(files);
  for (const { file, edits } of fix.files) {
    const path = join(original, file);
    let code = out.get(path);
    assert.ok(code !== undefined, "author fix file missing: " + file);
    for (const { from, to } of edits) {
      assert.ok(code.includes(from), "author fix anchor missing: " + from);
      code = code.replace(from, to);
    }
    out.set(path, code);
  }
  return out;
}
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
// The authored project's own options (its Node and Vite types) for inference.
const configPath = join(original, "tsconfig.json");
const sourceOptions = ts.parseJsonConfigFileContent(
  ts.readConfigFile(configPath, ts.sys.readFile).config,
  ts.sys,
  original
).options;
async function check(files) {
  const result = lowerNativeProject(files, { compilerOptions: sourceOptions });
  // Typed lint needs the program on disk: a scratch copy, removed after.
  const out = join(root, "packages/vite-plugin-yield/test/.native-generated/rendering-half-a");
  rmSync(out, { recursive: true, force: true });
  const written = new Map();
  for (const [file, code] of result.files) {
    const dest = join(out, relative(original, file));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, code);
    written.set(dest, file);
  }
  const ambient = join(out, "native-env.d.ts");
  writeFileSync(
    ambient,
    `/// <reference path="${join(original, "node_modules/vite/client.d.ts")}" />\n`
  );
  writeFileSync(
    join(out, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { ...JSON.parse(JSON.stringify(rawOptions)), noEmit: true },
      include: ["**/*.ts", "**/*.tsx"]
    })
  );
  const program = ts.createProgram([...written.keys(), ambient], options);
  /** An authored position for a generated offset. @param {string} dest @param {number} start @param {number} length */
  const at = (dest, start, length) => {
    const file = written.get(dest);
    const table = file && result.positions.get(file);
    const origin = table && locate(table, start, length);
    const prefix = origin && files.get(file)?.slice(0, origin.sourceStart).split("\n");
    return prefix
      ? `${relative(original, file)}:${prefix.length}:${prefix.at(-1).length + 1}`
      : null;
  };
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter(d => d.category === ts.DiagnosticCategory.Error)
    .map(d => {
      const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      const root = /readonly "\[([A-Z_]+)\][^"]*": ([^;]+);/.exec(message);
      const refusal = /\[(PENDING_ROOT|NO_PROVIDER)\]/.exec(message);
      return {
        code: root?.[1] ?? refusal?.[1] ?? `TS${d.code}`,
        fails: root?.[2] ?? null,
        at: d.file ? at(d.file.fileName, d.start ?? 0, d.length ?? 0) : null
      };
    });
  const eslint = new ESLint({
    cwd: out,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.tsx", "**/*.ts"],
        languageOptions: {
          parser,
          parserOptions: { project: join(out, "tsconfig.json"), tsconfigRootDir: out }
        },
        plugins: { "solid-yield": plugin },
        rules: plugin.configs.recommended.rules
      }
    ]
  });
  const lint = [];
  for (const dest of written.keys()) {
    const code = readFileSync(dest, "utf8");
    const [report] = await eslint.lintText(code, { filePath: dest });
    const lines = code.split("\n");
    for (const m of report.messages) {
      const offset =
        lines.slice(0, m.line - 1).reduce((n, line) => n + line.length + 1, 0) + m.column - 1;
      lint.push({ code: m.ruleId ?? "parse", at: at(dest, offset, 1) });
    }
  }
  rmSync(out, { recursive: true, force: true });
  return {
    notices: result.diagnostics.map(d => ({
      code: d.code,
      at: `${relative(original, d.file)}:${d.line}:${d.column}`
    })),
    errors,
    lint
  };
}
const rawOptions = {
  strict: true,
  skipLibCheck: true,
  target: "ESNext",
  module: "ESNext",
  moduleResolution: "Bundler",
  jsx: "preserve",
  jsxImportSource: "solid-yield",
  jsxFactory: "jsx",
  jsxFragmentFactory: "Fragment",
  lib: ["ESNext", "DOM"],
  types: [],
  paths: options.paths
};
if (import.meta.url === `file://${process.argv[1]}`) {
  if (stage === "typecheck") {
    const { errors, lint } = await check(patched(authored()));
    assert.deepEqual(errors, [], "the author's fix must type-check");
    assert.deepEqual(lint, [], "the author's fix must lint clean");
    const edits = fix.files.reduce((n, f) => n + f.edits.length, 0);
    console.log(
      `native Rendering typecheck: PASS (author fix: ${edits} edits in ${fix.files.length} files)`
    );
  } else {
    const actual = await check(authored());
    const expected = join(harness, "expected-diagnostics.json");
    if (process.argv.includes("--record"))
      writeFileSync(expected, JSON.stringify(actual, null, 2) + "\n");
    else assert.deepEqual(actual, JSON.parse(readFileSync(expected, "utf8")));
    for (const n of actual.notices) console.log(`[${n.code}] ${n.at}`);
    for (const e of actual.errors) console.log(`[${e.code}] ${e.at} ${e.fails ?? ""}`);
    for (const l of actual.lint) console.log(`[${l.code}] ${l.at}`);
    console.log(
      `native Rendering diagnostics: PASS (${actual.errors.length} errors, ${actual.lint.length} lint findings, exact)`
    );
  }
}
