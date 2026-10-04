import { defineConfig } from "vitest/config";
import solid from "@solidjs/vite-plugin";
import blocks from "vite-plugin-solid-blocks";

// The tests render the shared app client-side in jsdom (the CSR variant's
// `render`), for this twin and for examples/rendering side by side; the SSR
// variants (string, stream) are covered by the browser check
// (scripts/example-blocks/browser.mjs).
export default defineConfig({
  plugins: [blocks(), solid()],
  resolve: { conditions: process.env.BLOCKS_COST_PROD ? ["browser"] : ["development", "browser"] },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.tsx"]
  }
});
