// The package's export conditions: a test runner with a DOM (vitest + jsdom)
// resolves with both `node` and `browser`; the client runtime must win there,
// as solid-js's does (the server build skips the client's checks — whole-view
// detection, dev warnings — so a twin's tests would pass against the wrong
// runtime).
/// <reference types="node" />
import { createRequire } from "node:module";
import pkg from "../package.json" with { type: "json" };

// the installed solid-js (published, D-016); a JSON import from node_modules
// would be externalized and need Node's own import attribute
const solid = createRequire(import.meta.url)("solid-js/package.json") as {
  exports: Record<string, Exports>;
};

type Exports = string | { [condition: string]: Exports };

/** Node's algorithm: the first key (in order) whose condition is active. */
function pick(entry: Exports, conditions: Set<string>, key = "default"): string | undefined {
  if (typeof entry === "string") return entry;
  for (const [condition, value] of Object.entries(entry)) {
    if (condition === "types") continue;
    if (condition === "default" || conditions.has(condition)) {
      const found = pick(value, conditions, key);
      if (found) return found;
    }
  }
  return undefined;
}

it("with both node and browser conditions, the client build wins (as solid-js's does)", () => {
  const jsdom = new Set(["node", "browser", "development", "import"]);
  expect(pick(pkg.exports["."] as Exports, jsdom)).toBe("./dist/blocks.dev.js");
  expect(pick(solid.exports["."] as Exports, jsdom)).toMatch(/solid\.dev\.js$/);
  expect(pick(pkg.exports["."] as Exports, new Set(["node", "import"]))).toBe("./dist/server.js");
  expect(pick(pkg.exports["."] as Exports, new Set(["browser", "import"]))).toBe(
    "./dist/blocks.js"
  );
});
