import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import blocks from "vite-plugin-solid-blocks";

export default defineConfig({
  plugins: [blocks(), solid()],
  server: { port: 3008 },
  preview: { port: 3008 },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.tsx"]
  },
  // tests run the development builds (dev warnings, dev checks); `vite build` keeps its defaults
  resolve: process.env.VITEST ? { conditions: ["development", "browser"] } : undefined
});
