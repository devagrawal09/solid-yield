// Optional, foreground reproductions and controls for the recorded growth findings.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const runner = fileURLToPath(new URL("run.mjs", import.meta.url));
const cases = [
  ["effect-switch-cleared", "effect-yield", "switch", 100, { SOAK_CLEAR_MOCKS: "1" }],
  ["effect-idle", "effect-yield", "idle", 100, {}],
  ["effect-switch", "effect-yield", "switch", 100, {}],
  ["effect-retry-fail", "effect-yield", "retry-fail", 100, {}],
  ["effect-search", "effect-yield", "search", 100, {}],
  ["effect-retry", "effect-yield", "retry", 100, {}],
  ["effect-supersede", "effect-yield", "supersede", 100, {}],
  ["effect-checkout", "effect-yield", "checkout", 100, {}],
  ["effect-cleared", "effect-yield", "all", 100, { SOAK_CLEAR_MOCKS: "1" }],
  [
    "hn-control",
    "hackernews-spa-yield",
    "all",
    100,
    { SOAK_CLEAR_MOCKS: "1", SOAK_REPLACE_HISTORY: "1" }
  ],
  [
    "rendering-control",
    "rendering-yield",
    "all",
    40,
    { SOAK_CLEAR_MOCKS: "1", SOAK_REPLACE_HISTORY: "1" }
  ],
  ["room-control", "room-yield", "all", 500, { SOAK_CLEAR_MOCKS: "1", SOAK_REPLACE_HISTORY: "1" }],
  ["todos-control", "todos-yield", "all", 150, { SOAK_CLEAR_MOCKS: "1" }],
  ["todos-h-control", "todos-yield-h", "all", 150, { SOAK_CLEAR_MOCKS: "1" }]
];
const results = [];
for (const [name, twin, scenario, rounds, env] of cases.filter(
  row => !process.argv[2] || row[0] === process.argv[2]
)) {
  const out = `/tmp/sy-soak-${name}.json`;
  const run = spawnSync(
    process.execPath,
    [
      runner,
      "--only",
      twin,
      "--scenario",
      scenario,
      "--minutes",
      "3",
      "--rounds",
      String(rounds),
      "--out",
      out
    ],
    { env: { ...process.env, ...env }, encoding: "utf8" }
  );
  if (run.status !== 0) throw new Error(`${name}: ${(run.stdout + run.stderr).slice(-2000)}`);
  const data = JSON.parse(readFileSync(out, "utf8"));
  const row = data.results[0];
  if (row.stepFailures.length) throw new Error(`${name}: invalid diagnostic step sequence`);
  results.push({ name, env, ...data, results: [row] });
  writeFileSync(
    process.argv[2]
      ? `/tmp/sy-soak-diagnostic-${process.argv[2]}.json`
      : "/tmp/sy-soak-diagnostics.json",
    JSON.stringify(results, null, 2) + "\n"
  );
  console.log(
    `${name}: ${row.rounds} rounds; heap ${(row.trends.heap.slope / 1024).toFixed(2)} KiB/round; parity ${row.mismatches.length}; errors ${row.errorCount}`
  );
}
