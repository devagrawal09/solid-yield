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
// F-C13: frame morphs claim anchors inside innerHTML; ordinary hydration does
// not. TOC claims also differ when mounting after a failure. Only router-owned
// attributes on Markdown and TOC anchors are removed in
// this separate diagnostic. Stored snapshots and the parity normalizer stay exact.
const withoutArticleClaims = html =>
  html.replace(
    /(<div class="markdown">|<aside class="on-this-page">)([\s\S]*?)(<\/div>|<\/aside>)/g,
    (_, start, body, end) =>
      start +
      body.replace(/<a\b[^>]*>/g, tag =>
        tag.replace(/ (?:data-active|data-pending)=""| aria-current="page"/g, "")
      ) +
      end
  );
const authoredContent = html => withoutArticleClaims(withoutFrameScaffolding(html));
test("C3: 28 hydrated interactions and keyed slots; record exact DOM differences", () => {
  const library = run("library"),
    compiled = run("compiled-r");
  assert.equal(compiled.roots, 1);
  assert.equal(compiled.snapshots.length, 28);
  assert.equal(compiled.payloads.length, 3, "one region RPC per navigation; no hydration refetch");
  const differences = [];
  for (let i = 0; i < 28; i++) {
    const a = library.snapshots[i],
      b = compiled.snapshots[i];
    assert.deepEqual(authoredContent(b), authoredContent(a), `authored content at step ${i}`);
    if (a !== b)
      differences.push({
        step: i,
        reason: [
          "solid-frame wrappers",
          ...(i === 4 ? ["pending template"] : []),
          ...(withoutFrameScaffolding(b) !== a ? ["F-C13 article link claim attributes"] : [])
        ],
        librarySha256: createHash("sha256").update(a).digest("hex"),
        compiledSha256: createHash("sha256").update(b).digest("hex")
      });
  }
  assert.equal(differences.length, 28, "do not report exact parity while frames add DOM nodes");
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
          steps: 28,
          contentMatches: 28,
          serverRefetchedSteps: [4, 5, 22, 23, 24, 25],
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
