#!/usr/bin/env node
// Native Rendering half B: the original, the author's minimal fix
// (author-fix.json: a local override signal and a memo over the prop at the
// three setup reads; the CSR root's Errored and Loading) as plain Solid, and
// that fixed copy through native mode. The twin's shared script, streamed SSR
// of every route, and hydration. Half A is scripts/native-rendering-check.mjs.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { firstDifference, normalize } from "../src/index.ts";
const root = resolve(import.meta.dirname, "../../..");
const require = createRequire(join(root, "package.json"));
const task = process.argv[2] ?? "parity";
assert.ok(["parity", "ssr", "hydrate"].includes(task));
const original = join(root, "examples/originals/rendering");
const fixed = join(original, ".native-generated/fixed");

// The author's fix as a project of its own (git-ignored), beside the original
// so it resolves the original's dependencies; the original stays byte-identical.
rmSync(fixed, { recursive: true, force: true });
cpSync(join(original, "shared/src"), join(fixed, "shared/src"), { recursive: true });
cpSync(join(original, "csr"), join(fixed, "csr"), { recursive: true });
cpSync(join(original, "types.d.ts"), join(fixed, "types.d.ts"));
writeFileSync(
  join(fixed, "tsconfig.json"),
  JSON.stringify(
    {
      extends: join(original, "tsconfig.json"),
      include: ["shared/src/**/*", "csr/**/*.tsx", "types.d.ts"]
    },
    null,
    2
  ) + "\n"
);
const fix = JSON.parse(readFileSync(join(import.meta.dirname, "author-fix.json"), "utf8"));
for (const { file, edits } of fix.files) {
  const path = join(fixed, file);
  let code = readFileSync(path, "utf8");
  for (const { from, to } of edits) {
    assert.ok(code.includes(from), "author fix anchor missing: " + from);
    code = code.replace(from, to);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, code);
}

// Owner-tree ids (hydration keys, streaming placeholder ids, createUniqueId)
// differ with the library's owners; the markup is what must match.
const markup = html =>
  normalize(html)
    .replace(/\s(id)="pl-[^"]*"/g, "")
    .replace(/ (for|id)="[0-9a-z-]+"/g, ' $1="#id"');
const dir = mkdtempSync(join(tmpdir(), "native-rendering-"));
const run = (mode, kind, urls) => {
  const output = join(dir, `${mode}-${kind}-${urls.join("+").replaceAll("/", "_")}.json`);
  try {
    execFileSync(
      process.execPath,
      [
        join(dirname(require.resolve("vitest/package.json")), "vitest.mjs"),
        "run",
        "--maxWorkers=1",
        "--config",
        "examples/harness/native-rendering/vite.config.mjs"
      ],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 600000,
        env: {
          ...process.env,
          NATIVE_RENDERING_MODE: mode,
          NATIVE_RENDERING_TASK: kind,
          NATIVE_RENDERING_URLS: urls.join(","),
          NATIVE_RENDERING_OUTPUT: output
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
const routes = ["/", "/profile", "/settings", "/stream", "/error-stream", "/reveal", "/skeleton"];
try {
  if (task === "parity") {
    const [original, fixed, native] = modes.map(mode => run(mode, "client", ["/"])["/"]);
    const at = name => original.snapshots[original.steps.findIndex(([step]) => step === name)];
    for (const [step, value] of [
      ["Home ticks", "<span>10</span>"],
      ["profile data", "Jon's Profile"],
      ["type", "<p>Hello yield</p>"],
      ["logical click inside the portal", "Portal logical clicks: 1"],
      ["all items", "5: Fifth item"],
      ["items settle / fail", "ItemError: Error: Item bad-item not found"],
      ["cards reveal (sequential)", "C resolved in 1700ms"],
      ["refetched", "Shipped release #"]
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
      `native Rendering client parity: ${original.snapshots.length} states; the author fix and its native lowering match the original`
    );
  } else if (task === "ssr") {
    const [original, fixed, native] = modes.map(mode => run(mode, "ssr", routes));
    for (const url of routes) {
      assert.equal(markup(fixed[url].serverSnapshot), markup(original[url].serverSnapshot), url);
      assert.equal(markup(native[url].serverSnapshot), markup(original[url].serverSnapshot), url);
      // Solid's notices (a contained render error on /error-stream) match too.
      assert.deepEqual(native[url].notices, original[url].notices, `${url} notices`);
    }
    console.log(`native Rendering streamed SSR: ${routes.length} routes match the original`);
  } else {
    const urls = ["/", "/settings", "/error-stream", "/skeleton"];
    for (const url of urls) {
      const [original, native] = ["original", "native"].map(
        mode => run(mode, "hydrate", [url])[url]
      );
      assert.equal(original.retained, true, url);
      assert.equal(native.retained, true, url);
      assert.equal(markup(native.snapshots[0]), markup(original.snapshots[0]), url);
    }
    console.log(
      `native Rendering hydration: ${urls.length} routes; server nodes retained; settled pages match the original`
    );
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
