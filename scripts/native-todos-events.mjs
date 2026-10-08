#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import {
  fixBulkActionReads,
  fixBulkHandlerArgument
} from "../examples/harness/native-todos/author-fix.mjs";
const require = createRequire(import.meta.url),
  ts = require("typescript");
const { createVirtualService } = require("../packages/ts-plugin-yield/src/service.cjs");
const root = resolve(import.meta.dirname, "../examples/originals/todos");
const step = process.argv[2];
assert.ok(["snapshot", "typecheck"].includes(step));
const files = new Map(
  readdirSync(join(root, "src"))
    .filter(f => /\.[tj]sx?$/.test(f))
    .map(f => [join(root, "src", f), readFileSync(join(root, "src", f), "utf8")])
);
const checked = input => {
  const config = ts.parseJsonConfigFileContent(
    ts.readConfigFile(join(root, "tsconfig.json"), ts.sys.readFile).config,
    ts.sys,
    root
  );
  const host = ts.createCompilerHost(config.options);
  const service = createVirtualService(
    ts,
    {
      ...host,
      getCompilationSettings: () => ({
        ...config.options,
        configFilePath: join(root, "tsconfig.json")
      }),
      getCurrentDirectory: () => root,
      getScriptFileNames: () => [...input.keys()],
      getScriptVersion: f => input.get(f) ?? "0",
      getScriptSnapshot: f => {
        const c = input.get(f) ?? ts.sys.readFile(f);
        return c === undefined ? undefined : ts.ScriptSnapshot.fromString(c);
      },
      getDefaultLibFileName: ts.getDefaultLibFilePath
    },
    { mode: "native", include: ["src/**"] }
  );
  try {
    return [...input.keys()]
      .flatMap(f => service.diagnostics(f))
      .map(d => ({
        file: d.file.fileName.slice(root.length + 1),
        line: d.file.getLineAndCharacterOfPosition(d.start).line + 1,
        code: d.code,
        message: d.messageText
      }));
  } finally {
    service.dispose();
  }
};
if (step === "snapshot")
  assert.deepEqual(
    checked(files),
    [82, 121].reverse().map(line => ({
      file: "src/app.tsx",
      line,
      code: 95000,
      message:
        "[EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure."
    }))
  );
else {
  const file = join(root, "src/todos.ts");
  files.set(file, fixBulkActionReads(files.get(file)));
  const app = join(root, "src/app.tsx");
  files.set(app, fixBulkHandlerArgument(files.get(app)));
  assert.deepEqual(checked(files), []);
  // The fallback value is returned when a bulk state read itself throws.
  const code = readFileSync(file, "utf8");
  for (const name of ["toggleAll", "clearCompleted"]) {
    const fixed = fixBulkActionReads(code),
      start = fixed.indexOf(`    ${name}: action(function*`),
      open = fixed.indexOf("{", start),
      close = fixed.indexOf("\n    })", open);
    const body = fixed.slice(open + 1, close);
    const run = new Function(
      "todos",
      "setTodos",
      "Errors",
      "refresh",
      "api",
      `return function* (completed) {${body}}`
    );
    const failing = new Proxy([], {
      get() {
        throw new Error("state read failed");
      }
    });
    assert.deepEqual(
      run(
        failing,
        () => {},
        {},
        () => {},
        {}
      )().next(),
      { value: false, done: true }
    );
  }
}
console.log(`native Todos events ${step}: PASS`);
