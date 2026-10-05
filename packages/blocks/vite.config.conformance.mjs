import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// The conformance harness, client environment (D-039; test/conformance/README.md).
// No JSX plugins: the harness compiles each scenario source itself (the block
// rule, then the Solid compiler) and evaluates it against the modules this
// config resolves — the development client builds.
const src = resolve(import.meta.dirname, "src");

export default defineConfig({
  define: { __DEV__: "true", __SERVER__: "false" },
  test: {
    environment: "jsdom",
    pool: "threads",
    globals: true,
    // one copy of Solid: the scenario modules get exactly what this spec imports
    server: { deps: { inline: [/solid-js/, /@solidjs\//] } },
    include: [
      "test/conformance/conformance.spec.ts",
      "test/conformance/self-test.spec.ts",
      "test/conformance/routes.spec.ts"
    ]
  },
  resolve: {
    conditions: ["development", "browser"],
    alias: [
      { find: /^solid-blocks\/internal$/, replacement: resolve(src, "internal.ts") },
      { find: /^solid-blocks$/, replacement: resolve(src, "index.ts") }
    ]
  }
});
