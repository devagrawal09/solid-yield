const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { makeService, root, ts } = require("./helpers.cjs");
const fixture = path.join(root, "review2-app");
for (const c of require("./fixtures/review2-app/expectations.json"))
  test(`review 2: ${c.case}`, () => {
    const source = fs.readFileSync(path.join(fixture, "cases", c.case), "utf8");
    const { service } = makeService({
      "index.tsx": source,
      "errors.ts": fs.readFileSync(path.join(fixture, "src/errors.ts"), "utf8")
    });
    try {
      const ds = ["index.tsx", "errors.ts"].flatMap(f => service.diagnostics(path.join(root, f)));
      if (!c.code) return assert.deepEqual(ds, [], c.case);
      const found = ds.filter(d => d.messageText.startsWith(`[${c.code}]`));
      assert.equal(found.length, 1, JSON.stringify(ds.map(d => d.messageText)));
      const d = found[0];
      assert.equal(path.basename(d.file.fileName), "index.tsx");
      assert.equal(d.file.getLineAndCharacterOfPosition(d.start).line + 1, c.line);
      assert.equal(
        d.category,
        c.code === "NATIVE_FOREIGN_BOUNDARY"
          ? ts.DiagnosticCategory.Warning
          : ts.DiagnosticCategory.Error
      );
      for (const d of ds) {
        assert.doesNotMatch(d.messageText, /\[generated\]|Create<|this throw.*generator/);
        assert.ok((d.relatedInformation ?? []).every(r => !r.file.isDeclarationFile));
        const locations = (d.relatedInformation ?? []).map(r => `${r.file.fileName}:${r.start}`);
        assert.equal(new Set(locations).size, locations.length);
      }
      if (c.code === "EVENT_REJECTS") {
        assert.doesNotMatch(d.messageText, /Errored/);
        assert.match(d.messageText, /try\/catch.*declare the failure/);
      }
      if (c.code === "FOREIGN_HANDOFF") {
        assert.equal(d.relatedInformation.length, 1);
        assert.match(d.relatedInformation[0].messageText, /rendered here/);
        assert.equal(
          d.relatedInformation[0].file.getLineAndCharacterOfPosition(d.relatedInformation[0].start)
            .line + 1,
          source.trimEnd().split("\n").length
        );
      }
      if (c.case === "base-sibling.tsx") assert.match(d.messageText, /NotFound/);
      if (c.case === "selective-unhandled.tsx") {
        assert.match(d.messageText, /TypeError/);
        assert.doesNotMatch(d.messageText, /FetchError/);
      }
      if (c.case === "selective-unknown.tsx") assert.match(d.messageText, /unknown/);
      if (c.case === "readme.tsx") {
        assert.equal(ds.length, 1);
        assert.equal(d.relatedInformation.length, 1);
        assert.equal(
          d.relatedInformation[0].file.getLineAndCharacterOfPosition(d.relatedInformation[0].start)
            .line + 1,
          15
        );
      }
    } finally {
      service.dispose();
    }
  });
test("unknown hover identifies the opaque call and its authored line", () => {
  const source = `import {createMemo, Loading, Errored} from "solid-js";
async function load(){ return await fetch('/api'); }
export function Page(){const value=createMemo(()=>load());return <Loading fallback='wait'>{value()}</Loading>;}`;
  const { service } = makeService({ "api.tsx": source });
  try {
    const text = service
      .quickInfo(path.join(root, "api.tsx"), source.indexOf("function Page") + 9)
      ?.displayParts.map(p => p.text)
      .join("");
    assert.match(text, /an unknown error \(from fetch at api.tsx:2\)/);
  } finally {
    service.dispose();
  }
});
