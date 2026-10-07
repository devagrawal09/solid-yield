import docsLevelPlugin from "../../harness/docs-level.mjs";
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
export default defineConfig({
  plugins: [docsLevelPlugin(),solid()],
  test: { environment: "jsdom", globals: true, include: ["tests/**/*.test.tsx"] },
  resolve: process.env.VITEST ? { conditions: ["development", "browser"] } : undefined
});
