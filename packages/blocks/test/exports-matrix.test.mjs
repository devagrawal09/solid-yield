// The exports-conditions matrix (scripts/exports-matrix.mjs): every subpath of
// solid-blocks under development / default / browser / node (and their
// combinations), at runtime (esbuild, Node) and for types (TypeScript).
// Needs the build (`pnpm build`).
import { exportsMatrix } from "../../../scripts/exports-matrix.mjs";

exportsMatrix(new URL("..", import.meta.url), {
  ".": {
    runtime: {
      default: "./dist/blocks.js",
      development: "./dist/blocks.dev.js",
      browser: "./dist/blocks.js",
      "browser+development": "./dist/blocks.dev.js",
      node: "./dist/server.js",
      "node+development": "./dist/server.dev.js",
      // the client runtime wins under a DOM test runner, as solid-js's does
      "browser+node+development": "./dist/blocks.dev.js"
    },
    types: "./dist/types/index.d.ts"
  },
  // undocumented: the runtime the root and `h` share (one copy per app)
  "./internal": {
    runtime: {
      default: "./dist/internal.js",
      development: "./dist/internal.dev.js",
      browser: "./dist/internal.js",
      "browser+development": "./dist/internal.dev.js",
      node: "./dist/internal.server.js",
      "node+development": "./dist/internal.server.dev.js",
      "browser+node+development": "./dist/internal.dev.js"
    },
    types: "./dist/types/internal.d.ts"
  },
  "./h": {
    runtime: {
      default: "./dist/h.js",
      development: "./dist/h.dev.js",
      browser: "./dist/h.js",
      "browser+development": "./dist/h.dev.js",
      node: "./dist/h.js",
      "node+development": "./dist/h.dev.js",
      "browser+node+development": "./dist/h.dev.js"
    },
    types: "./dist/types/h.d.ts"
  },
  "./jsx-runtime": { runtime: "./dist/jsx-runtime.js", types: "./jsx/jsx-runtime.d.ts" },
  "./jsx-dev-runtime": { runtime: "./dist/jsx-runtime.js", types: "./jsx/jsx-runtime.d.ts" },
  "./package.json": { runtime: "./package.json", types: null }
});
