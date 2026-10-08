export default {
  mutate: ["packages/eslint-plugin-yield/src/*.js"],
  testRunner: "vitest",
  plugins: [
    "./scripts/mutation/tools/node_modules/@stryker-mutator/vitest-runner/dist/src/index.js",
    "./scripts/mutation/heartbeat.mjs"
  ],
  vitest: { configFile: "scripts/mutation/vitest-eslint.config.mjs", related: false },
  coverageAnalysis: "perTest",
  concurrency: 2,
  timeoutMS: 3000,
  timeoutFactor: 2,
  dryRunTimeoutMinutes: 5,
  reporters: ["clear-text", "json", "heartbeat"],
  jsonReporter: { fileName: "documentation/mutation-stryker-eslint.json" },
  tempDirName: ".stryker-tmp-eslint",
  disableTypeChecks: false,
  ignorePatterns: ["**/.native-generated/**", "scripts/mutation/tools/**", ".stryker-tmp*/**"],
  incremental: true,
  incrementalFile: "scripts/mutation/.native-generated/stryker-eslint-incremental.json"
};
