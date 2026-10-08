import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { createRequire } from "node:module";
import { lowerNativeProject } from "../../../packages/vite-plugin-yield/src/native.js";
export const root = resolve(import.meta.dirname, "../../..");
export const source = join(root, "examples/originals/hackernews-spa/src");
export const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
export const ts = require("typescript");
const scan = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? scan(join(dir, e.name)) : [join(dir, e.name)]
  );
export function authored(fixed = false) {
  const files = new Map(scan(source).map(file => [file, readFileSync(file, "utf8")]));
  if (!fixed) return files;
  const patch = readFileSync(join(import.meta.dirname, "author-fix.patch"), "utf8")
    .trimEnd()
    .split("\n");
  let file,
    lines,
    out,
    cursor = 0;
  const finish = () => {
    if (file) files.set(file, [...out, ...lines.slice(cursor)].join("\n"));
  };
  for (let i = 0; i < patch.length; i++) {
    const line = patch[i];
    if (line.startsWith("--- a/")) {
      finish();
      const path = line.slice(6);
      assert.match(path, /^src\/routes\/(stories|story|user)\.tsx$/);
      file = join(source, path.slice(4));
      lines = files.get(file).split("\n");
      out = [];
      cursor = 0;
      assert.equal(patch[++i], `+++ b/${path}`);
    } else if (line.startsWith("@@")) {
      const hunk = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@$/.exec(line);
      assert.ok(hunk, line);
      const at = Number(hunk[1]) - (hunk[2] === "0" ? 0 : 1);
      assert.ok(at >= cursor);
      out.push(...lines.slice(cursor, at));
      cursor = at;
    } else if (line.startsWith("-")) assert.equal(lines[cursor++], line.slice(1));
    else if (line.startsWith("+")) out.push(line.slice(1));
    else throw new Error(`Unexpected patch line: ${line}`);
  }
  finish();
  return files;
}
export function options(dir) {
  return {
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
    resolveJsonModule: true,
    lib: ["ESNext", "DOM"],
    paths: {
      "~/*": [join(dir, "*")],
      "@solidjs/router": [join(root, "examples/hackernews-spa-yield/node_modules/@solidjs/router")]
    }
  };
}
export function materialize(dir, files) {
  mkdirSync(dir, { recursive: true });
  for (const [file, code] of files) {
    const target = join(dir, relative(source, file));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, code);
  }
  writeFileSync(join(dir, "native-env.d.ts"), 'declare module "*.css" {}\n');
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({ compilerOptions: options(dir), include: ["**/*.ts", "**/*.tsx"] })
  );
}
export function generate(dir, fixed = true) {
  const files = authored(fixed);
  const config = ts.parseJsonConfigFileContent({ compilerOptions: options(source) }, ts.sys, root);
  const result = lowerNativeProject(
    new Map([...files].filter(([file]) => /\.[tj]sx?$/.test(file) && !file.endsWith(".d.ts"))),
    { compilerOptions: config.options }
  );
  materialize(dir, new Map([...files, ...result.files]));
  const parsed = ts.parseJsonConfigFileContent(
    { compilerOptions: options(dir), include: ["**/*.ts", "**/*.tsx"] },
    ts.sys,
    dir
  );
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  return {
    result,
    program,
    generated: [...result.files].map(([file, code]) => ({
      file: join(dir, relative(source, file)),
      code
    }))
  };
}
