export default {
  mutate: [
    "packages/vite-plugin-yield/src/native*.js",
    "packages/vite-plugin-yield/src/sugar.js",
    "packages/vite-plugin-yield/src/transform.js",
    "packages/vite-plugin-yield/src/positions.js",
    "packages/compiler-yield/src/failure-inference.js",
    "packages/ts-plugin-yield/src/*.cjs"
  ],
  testRunner: "command",
  commandRunner: { command: "node scripts/mutation/core-tests.mjs" },
  coverageAnalysis: "off",
  concurrency: 2,
  timeoutMS: 10000,
  timeoutFactor: 2,
  dryRunTimeoutMinutes: 5,
  disableTypeChecks: false,
  reporters: ["clear-text", "json"],
  jsonReporter: { fileName: "documentation/mutation-stryker-core.json" },
  tempDirName: ".stryker-tmp-core",
  ignorePatterns: ["**/.native-generated/**", "scripts/mutation/tools/**", ".stryker-tmp*/**"],
  incremental: true,
  incrementalFile: "scripts/mutation/.native-generated/stryker-core-incremental.json"
};
