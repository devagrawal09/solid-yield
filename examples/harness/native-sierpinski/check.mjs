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
const dir = mkdtempSync(join(tmpdir(), "native-sierpinski-"));
try {
  for (const hydrated of task === "ssr" ? [true] : [false, true]) {
    const results = [];
    for (const mode of ["original", "native"]) {
      const output = join(dir, `${mode}-${hydrated}.json`);
      try {
        execFileSync(
          process.execPath,
          [
            join(dirname(require.resolve("vitest/package.json")), "vitest.mjs"),
            "run",
            "--maxWorkers=1",
            "--config",
            "examples/harness/native-sierpinski/vite.config.mjs"
          ],
          {
            cwd: root,
            encoding: "utf8",
            timeout: 120000,
            env: {
              ...process.env,
              NATIVE_SIERPINSKI_MODE: mode,
              NATIVE_SIERPINSKI_HYDRATED: hydrated ? "1" : "0",
              NATIVE_SIERPINSKI_SMOKE: task === "ssr" ? "1" : "0",
              NATIVE_SIERPINSKI_OUTPUT: output
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
    const [original, native] = results;
    if (task === "parity") {
      assert.equal(original.snapshots.length, 11);
      if (!hydrated) assert.ok(original.snapshots[0].includes("Loading..."));
      for (const [step, value] of [
        [1, ">0</div>"],
        [4, "**1**"],
        [7, ">5</div>"],
        [10, ">3</div>"]
      ])
        assert.ok(
          original.snapshots[step].includes(value),
          `original step ${step} must reach ${value}`
        );
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
      }
      console.log(
        `native Sierpinski ${hydrated ? "hydrated" : "client"} parity: 11 states match original`
      );
    } else {
      assert.equal((original.serverSnapshot.match(/class="dot"/g) || []).length, 729);
      assert.equal(normalize(native.serverSnapshot), normalize(original.serverSnapshot));
      console.log(
        "native Sierpinski streamed SSR smoke: 729 dots match original; no render errors"
      );
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
