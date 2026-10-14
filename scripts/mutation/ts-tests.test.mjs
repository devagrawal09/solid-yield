// Adapter only: register the unchanged node:test suite with Vitest so Stryker
// can select tests. Assertions and sources are the existing suite's own.
import { test } from "vitest";
import Module, { createRequire } from "node:module";
import { readdirSync } from "node:fs";
const require = createRequire(import.meta.url);
// Node's require cache outlives a Vitest rerun. Re-register the same suites and
// reload instrumented CommonJS modules on every mutant, including static ones.
for (const file of Object.keys(require.cache))
  if (/\/packages\/ts-plugin-yield\/(test|src)\//.test(file)) delete require.cache[file];
const load = Module._load;
const nodeTest = (name, options, fn) => {
  if (typeof options === "function") {
    fn = options;
    options = {};
  }
  return test(name, fn, options?.timeout);
};
nodeTest.test = nodeTest;
try {
  Module._load = function (id, ...rest) {
    return id === "node:test" ? nodeTest : load.call(this, id, ...rest);
  };
  // every test file of the package, as `node --test test/*.test.cjs` runs them
  for (const file of readdirSync(new URL("../../packages/ts-plugin-yield/test/", import.meta.url))
    .filter(f => f.endsWith(".test.cjs"))
    .sort())
    require("../../packages/ts-plugin-yield/test/" + file);
} finally {
  Module._load = load;
}
