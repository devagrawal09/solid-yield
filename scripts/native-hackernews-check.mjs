#!/usr/bin/env node
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  root,
  ts,
  generate,
  authored,
  materialize,
  options
} from "../examples/harness/native-hackernews/project.mjs";
const step = process.argv[2] ?? "transform";
assert.ok(["diagnostics", "transform", "typecheck", "lint"].includes(step));
const dir = join(root, "packages/vite-plugin-yield/test/.native-generated", `hackernews-${step}`);
if (step === "typecheck") {
  materialize(dir, authored(true));
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { ...options(dir), jsxImportSource: "@solidjs/web" },
      include: ["**/*.ts", "**/*.tsx"]
    })
  );
  const { check } = createRequire(import.meta.url)("../packages/ts-plugin-yield/src/cli.cjs");
  assert.equal(check(dir, { mode: "native", include: ["**/*.ts", "**/*.tsx"] }), 0);
  console.log("native Hacker News typecheck: PASS (CLI)");
  process.exit(0);
}
const { result, program, generated } = generate(dir, step !== "diagnostics");
const errors = ts.getPreEmitDiagnostics(program);
const format = () =>
  ts.formatDiagnostics(errors, {
    getCurrentDirectory: () => root,
    getCanonicalFileName: f => f,
    getNewLine: () => "\n"
  });
if (step === "diagnostics") {
  const snapshot = {
    boundaries: result.diagnostics.map(d => ({ ...d, file: d.file.replace(root + "/", "") })),
    errors: errors.map(d => {
      const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      const pos = d.file.getLineAndCharacterOfPosition(d.start);
      const fails = /readonly "(\[FOREIGN_HANDOFF\][^"]+)": ([^;]+);/.exec(message);
      assert.ok(fails, message);
      return {
        code: "FOREIGN_HANDOFF",
        tsCode: d.code,
        details: message,
        message: fails[1],
        fails: fails[2],
        file: d.file.fileName.replace(dir + "/", ""),
        line: pos.line + 1,
        column: pos.character + 1
      };
    })
  };
  assert.deepEqual(
    snapshot,
    JSON.parse(
      readFileSync(
        join(root, "examples/harness/native-hackernews/expected-diagnostics.json"),
        "utf8"
      )
    )
  );
} else {
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, "NATIVE_FOREIGN_BOUNDARY");
  if (step === "typecheck") assert.equal(errors.length, 0, format());
  if (step === "lint") {
    const lintRequire = (await import("node:module")).createRequire(
      join(root, "examples/harness/package.json")
    );
    const { ESLint } = lintRequire("eslint"),
      parser = lintRequire("@typescript-eslint/parser"),
      plugin = lintRequire("eslint-plugin-solid-yield").default;
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ["**/*.tsx", "**/*.ts"],
          languageOptions: {
            parser,
            parserOptions: { project: join(dir, "tsconfig.json"), tsconfigRootDir: root }
          },
          plugins: { "solid-yield": plugin },
          rules: plugin.configs.recommended.rules
        }
      ]
    });
    for (const { file, code } of generated) {
      const [lint] = await eslint.lintText(code, { filePath: file });
      assert.deepEqual(lint.messages, [], file);
    }
  }
}
console.log(`native Hacker News ${step}: PASS (${result.iterations} inference passes)`);
