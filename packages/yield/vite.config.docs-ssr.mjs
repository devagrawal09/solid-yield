// The guide's SSR recipe, with source aliases for this workspace.
import { defineConfig } from "vitest/config";
import solid from "@solidjs/vite-plugin";
import solidYield from "../vite-plugin-yield/src/index.js";
import base from "./vite.config.mjs";
export default defineConfig({
  plugins: [solidYield(), solid({ ssr: true, hydratable: true })],
  define: { __DEV__: "true", __SERVER__: "true" },
  resolve: { ...base.resolve, conditions: ["node", "development"] },
  ssr: { noExternal: ["solid-yield"] }
});
