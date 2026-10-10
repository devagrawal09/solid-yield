export const deferred = pkg => ({
  testRunner: "vitest",
  plugins: ["./scripts/mutation/vitest-forks.mjs", "./scripts/mutation/heartbeat.mjs"],
  vitest: { configFile: "scripts/mutation/vitest-deferred.config.mjs", related: false },
  coverageAnalysis: "perTest",
  concurrency: 4,
  timeoutMS: 5000,
  timeoutFactor: 2,
  dryRunTimeoutMinutes: 5,
  reporters: ["clear-text", "json", "heartbeat"],
  jsonReporter: { fileName: `documentation/mutation-stryker-${pkg}.json` },
  tempDirName: `.stryker-tmp-${pkg}`,
  disableTypeChecks: false,
  ignorePatterns: ["**/.native-generated/**", "scripts/mutation/tools/**", ".stryker-tmp*/**"],
  incremental: true,
  incrementalFile: `scripts/mutation/.native-generated/stryker-${pkg}-incremental.json`
});
