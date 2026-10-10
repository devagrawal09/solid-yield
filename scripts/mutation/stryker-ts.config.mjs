export default {
  mutate: ["packages/ts-plugin-yield/src/*.cjs"],
  testRunner: "vitest",
  plugins: [
    "./scripts/mutation/tools/node_modules/@stryker-mutator/vitest-runner/dist/src/index.js",
    "./scripts/mutation/heartbeat.mjs"
  ],
  vitest: { configFile: "scripts/mutation/vitest-ts.config.mjs", related: false },
  coverageAnalysis: "perTest",
  concurrency: 2,
  timeoutMS: 5000,
  timeoutFactor: 2,
  dryRunTimeoutMinutes: 5,
  reporters: ["clear-text", "json", "heartbeat"],
  jsonReporter: { fileName: "documentation/mutation-stryker-ts.json" },
  tempDirName: ".stryker-tmp-ts",
  disableTypeChecks: false,
  ignorePatterns: ["**/.native-generated/**", "scripts/mutation/tools/**", ".stryker-tmp*/**"],
  incremental: false,
  incrementalFile: "scripts/mutation/.native-generated/stryker-ts-incremental.json"
};
