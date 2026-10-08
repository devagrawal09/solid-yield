#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { firstDifference, normalize } from "../src/index.ts";
const root = resolve(import.meta.dirname, "../../..");
const require = createRequire(join(root, "package.json"));
const task = process.argv[2] ?? "parity";
assert.ok(["parity", "ssr"].includes(task));
const dir = mkdtempSync(join(tmpdir(), "native-hackernews-"));
try {
  for (const hydrated of task === "ssr" ? [true] : [false, true]) {
    const results = [];
    for (const mode of ["original", "fixed", "native"]) {
      const output = join(dir, `${mode}-${hydrated}.json`);
      try {
        execFileSync(
          process.execPath,
          [
            join(dirname(require.resolve("vitest/package.json")), "vitest.mjs"),
            "run",
            "--maxWorkers=1",
            "--config",
            "examples/harness/native-hackernews/vite.config.mjs"
          ],
          {
            cwd: root,
            encoding: "utf8",
            timeout: 120000,
            env: {
              ...process.env,
              NATIVE_HACKERNEWS_MODE: mode,
              NATIVE_HACKERNEWS_HYDRATED: hydrated ? "1" : "0",
              NATIVE_HACKERNEWS_SMOKE: task === "ssr" ? "1" : "0",
              NATIVE_HACKERNEWS_OUTPUT: output
            }
          }
        );
      } catch (error) {
        process.stderr.write(error.stdout ?? "");
        process.stderr.write(error.stderr ?? "");
        throw error;
      }
      results.push(JSON.parse(readFileSync(output, "utf8")));
    }
    const [original, fixed, native] = results;
    if (task === "parity") {
      assert.equal(original.snapshots.length, 15);
      for (const [step, value] of [
        [0, "top story 1"],
        [6, "A reply"],
        [7, "[+] comments collapsed"],
        [10, "User : alice"],
        [12, "page 2"]
      ])
        assert.ok(
          original.snapshots[step].includes(value),
          `original step ${step} must reach ${value}`
        );
      assert.equal(
        firstDifference(
          original.steps,
          original.snapshots.map(normalize),
          fixed.snapshots.map(normalize)
        ),
        null
      );
      assert.equal(normalize(fixed.failureSnapshot), normalize(native.failureSnapshot));
      assert.equal(
        firstDifference(
          original.steps,
          original.snapshots.map(normalize),
          native.snapshots.map(normalize)
        ),
        null
      );
      if (hydrated) {
        assert.equal(original.retained, true);
        assert.equal(native.retained, true);
        assert.equal(fixed.retained, true);
      }
      console.log(
        `native Hacker News ${hydrated ? "hydrated" : "client"} parity: 15 happy states match original; fetch-failure state matches author fix`
      );
    } else {
      assert.ok(original.serverSnapshot.includes("Facebook loses users for the first time"));
      assert.equal((original.serverSnapshot.match(/class="comment"/g) || []).length, 1406);
      assert.equal(normalize(fixed.serverSnapshot), normalize(original.serverSnapshot));
      assert.equal(normalize(native.serverSnapshot), normalize(original.serverSnapshot));
      console.log(
        "native Hacker News streamed SSR smoke: cached 1,406-comment story matches original; no render errors"
      );
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
