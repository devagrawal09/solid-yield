import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: true,
    include: ["packages/eslint-plugin-yield/test/*.test.js"],
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 60000
  }
});
