#!/usr/bin/env node
// Native Docs half B: the original, the author's minimal fix (one Errored
// around the site, author-fix.json) as plain Solid, and that fixed copy
// through native mode. The shared docs script (typed failures included),
// streamed SSR of each URL, and hydration.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { firstDifference, normalize } from "../src/index.ts";
import { serializedDocsError } from "../ssr-smoke/docs-contract.mjs";
const root = resolve(import.meta.dirname, "../../..");
const require = createRequire(join(root, "package.json"));
const task = process.argv[2] ?? "parity";
assert.ok(["parity", "ssr", "hydrate"].includes(task));
// Owner-tree ids (hydration keys, streaming placeholder ids) differ with the
// library's owners; the markup is what must match.
const markup = html => normalize(html).replace(/\s(id)="pl-[^"]*"/g, "");
const dir = mkdtempSync(join(tmpdir(), "native-docs-"));
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
        "examples/harness/native-docs/vite.config.mjs"
      ],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 180000,
        env: {
          ...process.env,
          NATIVE_DOCS_MODE: mode,
          NATIVE_DOCS_TASK: kind,
          NATIVE_DOCS_URL: url,
          NATIVE_DOCS_OUTPUT: output
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
const modes = ["original", "fixed", "native"];
try {
  if (task === "parity") {
    const [original, fixed, native] = modes.map(mode => run(mode, "client", "/"));
    const at = name => original.snapshots[original.steps.findIndex(([step]) => step === name)];
    for (const [step, value] of [
      ["content loads", "Welcome to Field Notes"],
      ["like rate limited", "rate-limited: One like per article: start"],
      ["newsletter typed error", "bad-email: Enter a valid email"],
      ["search typed error", "search-error: Search is unavailable"],
      ["not-found typed error", "not-found: No article: missing"]
    ])
      assert.ok(at(step)?.includes(value), `original step ${step} must reach ${value}`);
    for (const [name, other] of [
      ["fixed", fixed],
      ["native", native]
    ])
      assert.equal(
        firstDifference(
          original.steps,
          original.snapshots.map(normalize),
          other.snapshots.map(normalize)
        ),
        null,
        name
      );
    console.log(
      `native Docs client parity: ${original.snapshots.length} states; the author fix and its native lowering match the original`
    );
  } else if (task === "ssr") {
    for (const url of ["/", "/docs/start", "/docs/missing"]) {
      const [original, fixed, native] = modes.map(mode => run(mode, "ssr", url));
      if (url === "/docs/missing")
        for (const [name, result] of [
          ["original", original],
          ["native", native]
        ])
          assert.ok(serializedDocsError(result.serverHtml), `${name} serializes NotFound`);
      assert.equal(markup(fixed.serverSnapshot), markup(original.serverSnapshot), url);
      assert.equal(markup(native.serverSnapshot), markup(original.serverSnapshot), url);
    }
    console.log("native Docs streamed SSR: 3 URLs match original; NotFound serialized");
  } else {
    for (const url of ["/", "/docs/missing"]) {
      const [original, , native] = modes.map(mode => run(mode, "hydrate", url));
      assert.equal(original.retained, true, url);
      assert.equal(native.retained, true, url);
      assert.equal(markup(native.snapshots[0]), markup(original.snapshots[0]), url);
    }
    console.log(
      "native Docs hydration: server nodes retained; theme toggle and NotFound match original"
    );
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
