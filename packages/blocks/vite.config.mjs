import { defineConfig } from "vitest/config";
import solidPlugin from "@solidjs/vite-plugin";
// The JSX transform's block rule (`yield*` in a JSX hole → `perform(…)`) is
// vite-plugin-solid-blocks, run before the JSX compiler (D-003, D-043). It
// is imported by path, not as a dependency: the plugin package devDepends on
// this one (its tests render through it), and the reverse edge would make a
// cycle in the workspace graph.
import blocks from "../vite-plugin-blocks/src/index.js";
import { resolve } from "node:path";

// Test JSX compiles with the native Rust compiler by default;
// `JSX_COMPILER=babel` switches to the Babel transform.
const compiler = process.env.JSX_COMPILER === "babel" ? "babel" : "native";
const src = resolve(import.meta.dirname, "src");

export default defineConfig({
  plugins: [blocks(), solidPlugin({ compiler })],
  define: { __DEV__: "true", __SERVER__: "false" },
  test: {
    environment: "jsdom",
    pool: "threads",
    globals: true,
    include: ["test/**/*.spec.ts", "test/**/*.spec.tsx"],
    exclude: ["**/node_modules/**", "test/server/**"]
  },
  resolve: {
    conditions: ["development", "browser"],
    alias: [
      { find: /^solid-blocks$/, replacement: resolve(src, "index.ts") },
      { find: /^solid-blocks\/h$/, replacement: resolve(src, "h.ts") },
      { find: /^solid-blocks\/jsx-runtime$/, replacement: resolve(src, "jsx-runtime.ts") }
    ]
  }
});
