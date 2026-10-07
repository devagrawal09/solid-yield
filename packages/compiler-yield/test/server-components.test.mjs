import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
function run(mode, url) {
  const dir = mkdtempSync(join(tmpdir(), "c3-docs-")),
    html = join(dir, "page.html");
  try {
    let result;
    for (const ssr of [true, false]) {
      const child = spawnSync(
        process.execPath,
        [new URL("./eager-docs.test.mjs", import.meta.url).pathname],
        {
          encoding: "utf8",
          timeout: 60000,
          maxBuffer: 4 * 1024 * 1024,
          env: {
            ...Object.fromEntries(
              Object.entries(process.env).filter(([k]) => k !== "NODE_TEST_CONTEXT")
            ),
            NODE_ENV: "production",
            C2_PRODUCTION: "1",
            C2_DOCS_MODE: mode,
            C2_HTML: html,
            ...(ssr ? { C2_SSR_ONLY: "1" } : {}),
            ...(url ? { C2_URL: url, C2_SMOKE: "1" } : {})
          }
        }
      );
      assert.equal(child.status, 0, child.stdout + child.stderr);
      if (!ssr) result = JSON.parse(child.stdout.split("C2_RESULT ")[1]);
    }
    return { ...result, html: readFileSync(html, "utf8") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
// This is a diagnostic comparison, NOT the parity normalizer. Exact snapshots
// remain untouched and their mismatches are recorded in the finding below.
const withoutFrameScaffolding = html =>
  html.replace(/<\/?solid-frame\b[^>]*>/g, "").replace(/<template id="pl-[^"]*"><\/template>/g, "");
test("C3: 24 hydrated interactions and keyed slots; record exact DOM differences", () => {
  const library = run("library"),
    compiled = run("compiled-r");
  assert.equal(compiled.roots, 1);
  assert.equal(compiled.snapshots.length, 24);
  assert.equal(compiled.payloads.length, 2, "one region RPC per navigation; no hydration refetch");
  const differences = [];
  for (let i = 0; i < 24; i++) {
    const a = library.snapshots[i],
      b = compiled.snapshots[i];
    assert.deepEqual(withoutFrameScaffolding(b), a, `authored content at step ${i}`);
    if (a !== b)
      differences.push({
        step: i,
        reason: i === 4 ? "solid-frame wrappers and pending template" : "solid-frame wrappers",
        librarySha256: createHash("sha256").update(a).digest("hex"),
        compiledSha256: createHash("sha256").update(b).digest("hex")
      });
  }
  assert.equal(differences.length, 24, "do not report exact parity while frames add DOM nodes");
  assert.match(compiled.snapshots[23], /not-found: No article: missing/);
  assert.match(compiled.snapshots[23], /Like: 1/);
  assert.match(compiled.snapshots[23], /rate-limited: One like per article: start/);
  assert.match(compiled.payloads[1].body, /not-found/);
  assert.match(compiled.payloads[1].body, /No article: missing/);
  assert.doesNotMatch(compiled.payloads[1].body, /Internal Server Error/);
  assert.match(compiled.payloads[0].body, /like#route-like/);
  assert.match(compiled.payloads[1].body, /like#route-like/);
  if (process.env.C3_PARITY_RECORD)
    writeFileSync(
      process.env.C3_PARITY_RECORD,
      JSON.stringify(
        {
          exactMatches: 0,
          steps: 24,
          contentMatches: 24,
          serverRefetchedSteps: [4, 5, 22, 23],
          differences,
          payloads: compiled.payloads
        },
        null,
        2
      ) + "\n"
    );
});
for (const url of ["/docs/start", "/docs/missing"])
  test(`C3 production SSR/hydrate ${url}`, () => {
    const library = run("library", url),
      compiled = run("compiled-r", url);
    assert.deepEqual(withoutFrameScaffolding(compiled.snapshots[0]), library.snapshots[0]);
    assert.equal(
      compiled.payloads.length,
      0,
      "hydration consumes the server region without refetch"
    );
    if (url.endsWith("missing")) {
      assert.match(compiled.html, /not-found/);
      assert.match(compiled.html, /No article: missing/);
      assert.doesNotMatch(compiled.html, /Internal Server Error/);
      assert.match(
        compiled.snapshots[0],
        /<p class="not-found">not-found: No article: missing<\/p>/
      );
    }
  });
