// Run with --mode hydrate: Solid deliberately turns hydration off in test mode.
import { defineConfig } from "vitest/config";
import solid from "@solidjs/vite-plugin";
import solidYield from "../vite-plugin-yield/src/index.js";
import base from "./vite.config.mjs";
export default defineConfig({
  plugins: [solidYield(), solid({ ssr: true, hydratable: true })],
  define: base.define,
  resolve: base.resolve,
  test: {
    environment: "jsdom",
    server: { deps: { inline: [/solid-js/, /@solidjs\//] } },
    include: ["test/docs/hydration/*.test.tsx"],
    globalSetup: ["test/docs/hydration/global-setup.mjs"]
  }
});
