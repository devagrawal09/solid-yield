const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { makeService, root, ts } = require("./helpers.cjs");
const message = d => ts.flattenDiagnosticMessageText(d.messageText, "\n");
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
      const found = ds.filter(d => message(d).startsWith(`[${c.code}]`));
      assert.equal(found.length, 1, JSON.stringify(ds.map(d => message(d))));
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
        assert.doesNotMatch(message(d), /\[generated\]|Create<|this throw.*generator/);
        if (d.source === "solid-yield")
          assert.ok((d.relatedInformation ?? []).every(r => !r.file.isDeclarationFile));
        else {
          // Ordinary authored errors retain TypeScript's library declaration
          // locations; only private generated diagnostics need relocation.
          const original = service.refresh().originalLs.getProgram();
          for (const related of d.relatedInformation ?? [])
            assert.equal(related.file, original.getSourceFile(related.file.fileName));
        }
        const locations = (d.relatedInformation ?? []).map(r => `${r.file.fileName}:${r.start}`);
        assert.equal(new Set(locations).size, locations.length);
      }
      if (c.code === "EVENT_REJECTS") {
        assert.doesNotMatch(message(d), /Errored/);
        assert.match(message(d), /catch and handle/);
        assert.doesNotMatch(message(d), /declare|fails contract/);
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
      if (c.case === "base-sibling.tsx") assert.match(message(d), /NotFound/);
      if (c.case === "selective-unhandled.tsx") {
        assert.match(message(d), /TypeError/);
        assert.doesNotMatch(message(d), /FetchError/);
      }
      if (c.case === "selective-unknown.tsx")
        assert.match(message(d), /DOMException.*TypeError|TypeError.*DOMException/);
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
test("platform IO hover names its explicit rejection classes", () => {
  const source = `import {createMemo, Loading, Errored} from "solid-js";
async function load(){ return await fetch('/api'); }
export function Page(){const value=createMemo(()=>load());return <Loading fallback='wait'>{value()}</Loading>;}`;
  const { service } = makeService({ "api.tsx": source });
  try {
    const text = service
      .quickInfo(path.join(root, "api.tsx"), source.indexOf("function Page") + 9)
      ?.displayParts.map(p => p.text)
      .join("");
    assert.match(text, /DOMException.*TypeError|TypeError.*DOMException/);
    assert.doesNotMatch(text, /unknown|__native/);
  } finally {
    service.dispose();
  }
});
