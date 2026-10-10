#!/usr/bin/env node
// Native dashboard half B: the unchanged original (empty author patch) against
// its native lowering — the 30-step client script (AckFailed rollback and the
// NotFound route boundary included), streamed SSR of each URL, and hydration.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { firstDifference, normalize } from "../src/index.ts";
import { dashboardContentError, serializedDashboardError } from "../dashboard/contract.mjs";
const root = resolve(import.meta.dirname, "../../..");
const require = createRequire(join(root, "package.json"));
const task = process.argv[2] ?? "parity";
assert.ok(["parity", "ssr", "hydrate"].includes(task));
assert.equal(readFileSync(join(import.meta.dirname, "author-fix.patch"), "utf8"), "");
// Owner-tree ids (hydration keys, streaming placeholder ids) differ with the
// library's owners; the markup is what must match.
const markup = html => normalize(html).replace(/\s(id)="pl-[^"]*"/g, "");
const dir = mkdtempSync(join(tmpdir(), "native-dashboard-"));
const run = (mode, kind, url) => {
  const output = join(dir, `${mode}-${kind}-${url.replaceAll("/", "_")}.json`);
  try {
    execFileSync(
      process.execPath,
      [
        join(dirname(require.resolve("vitest/package.json")), "vitest.mjs"),
        "run",
        "--maxWorkers=1",
        "--config",
        "examples/harness/native-dashboard/vite.config.mjs"
      ],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 180000,
        env: {
          ...process.env,
          NATIVE_DASHBOARD_MODE: mode,
          NATIVE_DASHBOARD_TASK: kind,
          NATIVE_DASHBOARD_URL: url,
          NATIVE_DASHBOARD_OUTPUT: output
        }
      }
    );
  } catch (error) {
    process.stderr.write(error.stdout ?? "");
    process.stderr.write(error.stderr ?? "");
    throw error;
  }
  return JSON.parse(readFileSync(output, "utf8"));
};
try {
  if (task === "parity") {
    const [original, native] = ["original", "native"].map(mode => run(mode, "client", "/overview"));
    assert.equal(original.snapshots.length, 30);
    for (const [step, value] of [
      [16, "ack-failed: Provider confirmation required"],
      [26, "not-found: No incident: missing"]
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
    console.log(
      "native dashboard client parity: 30 states match original (AckFailed rollback, NotFound boundary)"
    );
  } else if (task === "ssr") {
    for (const url of ["/overview", "/incidents/inc-101", "/incidents/missing"]) {
      const [original, native] = ["original", "native"].map(mode => run(mode, "ssr", url));
      assert.equal(dashboardContentError(original.serverSnapshot, url), null);
      if (url === "/incidents/missing") {
        assert.ok(serializedDashboardError(original.serverHtml), "original serializes NotFound");
        assert.ok(serializedDashboardError(native.serverHtml), "native serializes NotFound");
      }
      assert.equal(markup(native.serverSnapshot), markup(original.serverSnapshot), url);
    }
    console.log("native dashboard streamed SSR: 3 URLs match original; NotFound serialized");
  } else {
    for (const url of ["/overview", "/incidents/missing"]) {
      const [original, native] = ["original", "native"].map(mode => run(mode, "hydrate", url));
      assert.equal(original.retained, true, url);
      assert.equal(native.retained, true, url);
      if (url === "/incidents/missing")
        assert.ok(markup(original.snapshots[0]).includes("not-found: No incident: missing"));
      assert.equal(markup(native.snapshots[0]), markup(original.snapshots[0]), url);
    }
    console.log(
      "native dashboard hydration: server nodes retained; notes edit and NotFound boundary match original"
    );
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
