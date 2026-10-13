import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import solidYield from "vite-plugin-solid-yield";

export default defineConfig({
  plugins: [solidYield(), solid()],
  server: { port: 3020 },
  preview: { port: 3020 },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.tsx"]
  },
  // tests run the development builds, so the library's dev checks run too
  resolve: process.env.VITEST ? { conditions: ["development", "browser"] } : undefined
});
