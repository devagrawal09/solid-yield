import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// The conformance harness, server environment: the server builds of solid-js,
// @solidjs/web and solid-blocks (the `node` condition, __SERVER__). Pins each
// server mode's output under test/conformance/__artifacts__/, which the
// hydrate environment reads: run it first.
const src = resolve(import.meta.dirname, "src");

export default defineConfig({
  define: { __DEV__: "true", __SERVER__: "true" },
  test: {
    environment: "node",
    pool: "threads",
    globals: true,
    // one copy of Solid: the scenario modules get exactly what this spec imports
    server: { deps: { inline: [/solid-js/, /@solidjs\//] } },
    include: ["test/conformance/server.spec.ts"]
  },
  resolve: {
    conditions: ["node"],
    alias: [
      { find: /^solid-blocks\/internal$/, replacement: resolve(src, "internal.ts") },
      { find: /^solid-blocks$/, replacement: resolve(src, "index.ts") }
    ]
  }
});
