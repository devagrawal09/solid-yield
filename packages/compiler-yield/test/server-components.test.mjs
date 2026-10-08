import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { authoredContent, withoutFrameScaffolding } from "./dom-parity-diagnostics.mjs";
function run(mode, url, probe = {}) {
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
            ...probe,
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
test("C3/C4: 40 hydrated interactions and keyed slots; record exact DOM differences", () => {
  const library = run("library"),
    compiled = run("compiled-r");
  const original = process.env.C4_SNAPSHOTS ? run("original") : undefined;
  if (original)
    assert.deepEqual(original.snapshots, library.snapshots, "plain Solid router control");
  if (process.env.C4_SNAPSHOTS)
    writeFileSync(process.env.C4_SNAPSHOTS, JSON.stringify({ library, compiled, original }));
  assert.equal(compiled.roots, 1);
  assert.equal(compiled.snapshots.length, 40);
  assert.equal(compiled.payloads.length, 7, "one region RPC per navigation; no hydration refetch");
  assert.equal(
    compiled.firstNavigation,
    compiled.snapshots[4],
    "step 4 is immediate, before the RPC"
  );
  assert.equal(compiled.firstLikeRetained, true);
  assert.equal(
    compiled.firstNavigation.match(/<main>[\s\S]*?<\/main>/)?.[0],
    library.snapshots[4].match(/<main>[\s\S]*?<\/main>/)?.[0],
    "initial route Loading fallback matches the library before the first frame"
  );
  for (const step of [5, 23, 25, 29, 32, 35, 38])
    assert.doesNotMatch(
      compiled.snapshots[step],
      /<template id="pl-/,
      "settled frame removes its marker"
    );
  const differences = [];
  for (let i = 0; i < 40; i++) {
    const a = library.snapshots[i],
      b = compiled.snapshots[i];
    assert.deepEqual(authoredContent(b), authoredContent(a), `authored content at step ${i}`);
    if (a !== b)
      differences.push({
        step: i,
        reason: [
          "solid-frame wrappers",
          ...(/<template id="pl-/.test(b) ? ["pending template"] : []),
          ...(withoutFrameScaffolding(b) !== a ? ["F-C13 article link claim attributes"] : [])
        ],
        librarySha256: createHash("sha256").update(a).digest("hex"),
        compiledSha256: createHash("sha256").update(b).digest("hex")
      });
  }
  assert.equal(differences.length, 40, "do not report exact parity while frames add DOM nodes");
  assert.match(compiled.snapshots[25], /A typed content pipeline/);
  assert.match(compiled.snapshots[27], /class="hljs-keyword">interface<\/span>/);
  assert(differences.some(d => d.reason.includes("F-C13 article link claim attributes")));
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
          steps: 40,
          contentMatches: 40,
          serverRefetchedSteps: [5, 22, 23, 24, 25, 28, 29, 31, 32, 34, 35, 37, 38],
          differences,
          payloads: compiled.payloads
        },
        null,
        2
      ) + "\n"
    );
});
test("C4: a like clicked before the first frame survives its arrival", () => {
  const library = run("library", undefined, { C4_EARLY_LIKE: "1" });
  const compiled = run("compiled-r", undefined, { C4_EARLY_LIKE: "1" });
  assert.equal(compiled.snapshots.length, 6);
  assert.equal(compiled.firstLikeRetained, true);
  assert.equal(compiled.payloads.length, 1);
  assert.deepEqual(compiled.snapshots.map(authoredContent), library.snapshots.map(authoredContent));
});
for (const url of [
  "/docs/start",
  "/docs/missing",
  ...(process.env.DOCS_LEVEL === "S" ? [] : ["/docs/post-latency"]),
  ...((process.env.DOCS_LEVEL ?? "L") === "L" ? ["/docs/api", "/docs/changelog"] : [])
])
  test(`C3 production SSR/hydrate ${url}`, () => {
    const library = run("library", url),
      compiled = run("compiled-r", url);
    assert.deepEqual(authoredContent(compiled.snapshots[0]), authoredContent(library.snapshots[0]));
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
