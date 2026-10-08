import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
export default defineConfig({
  plugins: [solid()],
  test: { environment: "jsdom", globals: true, include: ["tests/**/*.test.tsx"] },
  resolve: process.env.VITEST ? { conditions: ["development", "browser"] } : undefined
});
