import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
// No JSX in this app (views are h); the solid plugin compiles the
// original examples/todos for the parity test.

export default defineConfig({
  plugins: [solid()],
  server: { port: 3013 },
  preview: { port: 3013 },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts"]
  },
  // tests run the development builds (dev warnings, dev checks); `vite build` keeps its defaults
  resolve: process.env.VITEST ? { conditions: ["development", "browser"] } : undefined
});
