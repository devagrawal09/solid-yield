#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const test = spawnSync(process.execPath, ["--test", resolve(import.meta.dirname, "test.mjs")], {
  stdio: "inherit"
});
if (test.status !== 0) process.exit(test.status ?? 1);
const result = spawnSync(
  process.execPath,
  [
    resolve(import.meta.dirname, "run.mjs"),
    "--cached",
    "--baseline",
    process.argv[2] ?? "documentation/yield-gate-baseline.json"
  ],
  { stdio: "inherit" }
);
process.exit(result.status ?? 1);
