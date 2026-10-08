// The exports-conditions matrix (scripts/exports-matrix.mjs): the plugin is
// one ESM entry with hand-written declarations under every condition set.
import { exportsMatrix } from "../../../scripts/exports-matrix.mjs";

exportsMatrix(new URL("..", import.meta.url), {
  ".": { runtime: "./src/index.js", types: "./src/index.d.ts" },
  "./virtual": { runtime: "./src/virtual.js", types: "./src/virtual.d.ts" },
  "./package.json": { runtime: "./package.json", types: null }
});
