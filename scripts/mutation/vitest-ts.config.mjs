import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["scripts/mutation/ts-tests.test.mjs"],
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 60000
  }
});
