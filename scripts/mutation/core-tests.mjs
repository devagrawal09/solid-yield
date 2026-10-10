#!/usr/bin/env node
// Full requested checker scope for a later, longer run; no new assertions.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const commands = [
  [
    join(dirname(require.resolve("vitest/package.json")), "vitest.mjs"),
    "run",
    "--maxWorkers=2",
    "--root",
    "packages/vite-plugin-yield"
  ],
  ...["compiler-yield", "ts-plugin-yield"].map(pkg => [
    "--test",
    ...readdirSync("packages/" + pkg + "/test")
      .filter(f => /\.test\.[cm]js$/.test(f))
      .map(f => "packages/" + pkg + "/test/" + f)
  ])
];
for (const args of commands) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
