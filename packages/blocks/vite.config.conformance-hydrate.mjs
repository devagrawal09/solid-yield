import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// The conformance harness, hydrate environment: the development client builds,
// hydrating the markup the server environment pinned (run that first).
const src = resolve(import.meta.dirname, "src");

export default defineConfig({
  define: { __DEV__: "true", __SERVER__: "false" },
  test: {
    environment: "jsdom",
    pool: "threads",
    globals: true,
    // one copy of Solid: the scenario modules get exactly what this spec imports
    server: { deps: { inline: [/solid-js/, /@solidjs\//] } },
    include: ["test/conformance/hydrate.spec.ts", "test/conformance/hydrate-self-test.spec.ts"]
  },
  resolve: {
    conditions: ["development", "browser"],
    alias: [
      { find: /^solid-blocks\/internal$/, replacement: resolve(src, "internal.ts") },
      { find: /^solid-blocks$/, replacement: resolve(src, "index.ts") }
    ]
  }
});
