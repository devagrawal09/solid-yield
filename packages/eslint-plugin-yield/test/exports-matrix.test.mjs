// The exports-conditions matrix (scripts/exports-matrix.mjs): the lint plugin
// is one ESM entry under every condition set and ships no declarations
// (`types: null` pins that TypeScript finds none).
import { exportsMatrix } from "../../../scripts/exports-matrix.mjs";

exportsMatrix(new URL("..", import.meta.url), {
  ".": { runtime: "./src/index.js", types: null },
  "./package.json": { runtime: "./package.json", types: null }
});
