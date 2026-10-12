#!/usr/bin/env node
// Every diagnostic the native checker can emit has a test that pins it: a
// lowering refusal (fail/report/refusal), a CLI catalog code, or a library
// type brand ("[CODE] …"). A code no test names fails this step, but for the
// branches listed in UNREACHABLE, each with the reason it cannot fire.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const UNREACHABLE = {
  SUGAR_LEXICAL:
    "Babel's arrow conversion hoists `this` and `arguments` before the check, so a routine arrow keeps their meaning",
  NATIVE_HOST: "every JSX value in a program has a statement parent",
  NATIVE_ACTION: "a call argument is an expression or a spread"
};
/** @param {string} dir @returns {string[]} */
const walk = dir =>
  readdirSync(dir).flatMap(name => {
    if (["node_modules", "dist", ".native-generated", ".lake"].includes(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const read = path => readFileSync(path, "utf8");

/** @type {Map<string, string>} code → where it is emitted */
const emitted = new Map();
const add = (code, where) => emitted.has(code) || emitted.set(code, where);
for (const path of walk(join(root, "packages/vite-plugin-yield/src"))) {
  const code = read(path);
  for (const m of code.matchAll(/\b(?:fail|report)\(\s*[\w.?]+,\s*"([A-Z][A-Z0-9_]+)"/g))
    add(m[1], relative(root, path));
  for (const m of code.matchAll(/\bnativeRefusal\([^;]*?"([A-Z][A-Z0-9_]+)"/g))
    add(m[1], relative(root, path));
  for (const m of code.matchAll(/`\[([A-Z][A-Z0-9_]+)\] /g)) add(m[1], relative(root, path));
}
const catalog = join(root, "packages/ts-plugin-yield/src/catalog.cjs");
for (const m of read(catalog).matchAll(/^\s{2}([A-Z][A-Z_]+):/gm))
  add(m[1], relative(root, catalog));
for (const path of walk(join(root, "packages/yield/src")))
  for (const m of read(path).matchAll(/"\[([A-Z][A-Z_]+)\] /g)) add(m[1], relative(root, path));

const tests = [
  ...walk(join(root, "packages")).filter(p => /[\\/]test[\\/]/.test(p)),
  ...walk(join(root, "examples/harness")),
  ...walk(join(root, "scripts/mutation/corpus"))
]
  .filter(p => /\.(c?js|mjs|tsx?|json)$/.test(p))
  .map(p => read(p));
const uncovered = [];
for (const [code, where] of [...emitted].sort()) {
  // An unreachable branch is reported as such, whatever a comment names it.
  if (UNREACHABLE[code]) console.log(`unreachable ${code}: ${UNREACHABLE[code]}`);
  else if (!tests.some(t => t.includes(code))) uncovered.push(`${code} (${where})`);
}
const stale = Object.keys(UNREACHABLE).filter(code => !emitted.has(code));
if (stale.length)
  uncovered.push(...stale.map(code => `${code} (listed unreachable, no longer emitted)`));
console.log(`native coverage: ${emitted.size} codes, ${uncovered.length} without a test`);
if (uncovered.length) {
  console.error("No test pins:\n  " + uncovered.join("\n  "));
  process.exit(1);
}
