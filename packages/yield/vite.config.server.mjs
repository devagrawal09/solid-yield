import { defineConfig } from "vitest/config";
import solidPlugin from "@solidjs/vite-plugin";
// The JSX transform's yield rule (`yield*` in a JSX hole → `perform(…)`) is
// vite-plugin-solid-yield, run before the JSX compiler (D-003, D-043). It
// is imported by path, not as a dependency: the plugin package devDepends on
// this one (its tests render through it), and the reverse edge would make a
// cycle in the workspace graph.
import solidYield from "../vite-plugin-yield/src/index.js";
import { resolve } from "node:path";

// Server rendering: SSR compile output, the server builds of solid-js and
// @solidjs/web (the `node` condition), and the runtime's server variant.
const compiler = process.env.JSX_COMPILER === "babel" ? "babel" : "native";
const src = resolve(import.meta.dirname, "src");

export default defineConfig({
  plugins: [solidYield(), solidPlugin({ compiler, solid: { generate: "ssr", hydratable: true } })],
  define: { __DEV__: "true", __SERVER__: "true" },
  test: {
    environment: "node",
    include: ["test/server/**/*.spec.tsx"],
    globals: true,
    pool: "threads"
  },
  resolve: {
    conditions: ["node"],
    alias: [
      { find: /^solid-yield\/internal$/, replacement: resolve(src, "internal.ts") },
      { find: /^solid-yield$/, replacement: resolve(src, "index.ts") }
    ]
  }
});
