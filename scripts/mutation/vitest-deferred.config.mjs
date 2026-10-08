import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: { "node:test": fileURLToPath(new URL("./node-test-adapter.mjs", import.meta.url)) }
  },
  test: {
    include: [
      "packages/vite-plugin-yield/test/*.test.js",
      "packages/compiler-yield/test/*.test.mjs",
      "scripts/mutation/ts-tests.test.mjs"
    ],
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 60000
  }
});
