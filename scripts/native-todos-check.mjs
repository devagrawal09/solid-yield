#!/usr/bin/env node
// Check the real original in native mode; generated code is never a fixture.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { lowerNativeProject } from "../packages/vite-plugin-yield/src/native.js";
const root = resolve(import.meta.dirname, "..");
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const ts = require("typescript");
const step = process.argv[2] ?? "transform";
assert.ok(["transform", "typecheck", "lint"].includes(step));
const source = join(root, "examples/originals/todos/src");
const inputs = new Map(
  readdirSync(source)
    .filter(f => /\.[tj]sx?$/.test(f))
    .map(f => [join(source, f), readFileSync(join(source, f), "utf8")])
);
const result = lowerNativeProject(inputs);
assert.deepEqual(result.diagnostics, []);
const dir = join(root, "packages/vite-plugin-yield/test/.native-generated", `todos-${step}`);
mkdirSync(dir, { recursive: true });
const generated = [...result.files].map(([file, code]) => ({
  file: join(dir, file.split("/").at(-1)),
  code
}));
for (const { file, code } of generated) writeFileSync(file, code);
const options = {
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
};
const config = join(dir, "tsconfig.json");
writeFileSync(config, JSON.stringify({ compilerOptions: options, include: ["*.tsx", "*.ts"] }));
if (step === "typecheck") {
  const parsed = ts.parseJsonConfigFileContent({ compilerOptions: options }, ts.sys, dir);
  const program = ts.createProgram(
    generated.map(f => f.file),
    parsed.options
  );
  const errors = ts.getPreEmitDiagnostics(program);
  assert.equal(
    errors.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(errors, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: f => f,
      getNewLine: () => "\n"
    })
  );
}
if (step === "lint") {
  const lintRequire = createRequire(join(root, "examples/harness/package.json"));
  const { ESLint } = lintRequire("eslint"),
    parser = lintRequire("@typescript-eslint/parser"),
    plugin = lintRequire("eslint-plugin-solid-yield").default;
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.tsx", "**/*.ts"],
        languageOptions: { parser, parserOptions: { project: config, tsconfigRootDir: root } },
        plugins: { "solid-yield": plugin },
        rules: plugin.configs.recommended.rules
      }
    ]
  });
  for (const { file, code } of generated) {
    const [lint] = await eslint.lintText(code, { filePath: file });
    assert.deepEqual(
      lint.messages.filter(message => message.severity === 2),
      [],
      file
    );
    assert.ok(
      lint.messages.every(message => message.ruleId === "solid-yield/no-unshown-wait"),
      file
    );
  }
}
console.log(`native Todos ${step}: PASS (${result.iterations} inference passes)`);
