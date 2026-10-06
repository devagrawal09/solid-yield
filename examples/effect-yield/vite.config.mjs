import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import solidYield from "vite-plugin-solid-yield";

export default defineConfig({
  plugins: [solidYield(), solid()],
  server: { port: 3008 },
  preview: { port: 3008 },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.tsx"]
  },
  // tests run the development builds (dev warnings, dev checks); `vite build` keeps its defaults
  resolve: process.env.VITEST ? { conditions: process.env.YIELD_COST_PROD ? ["browser"] : ["development", "browser"] } : undefined
});
