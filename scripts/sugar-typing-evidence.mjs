#!/usr/bin/env node
// Reproduce the locality/hover ledger from the same service used by tsserver/CI.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "..");
const require = createRequire(join(root, "packages/ts-plugin-yield/package.json"));
const { makeService, root: fixtureRoot } = require("./test/helpers.cjs");
const cases = require("./test/cases.cjs");
const locality = [];
for (const c of cases) {
  const name = c.file + ".tsx",
    file = join(fixtureRoot, name),
    { service } = makeService({ [name]: c.source });
  try {
    const diagnostics = service.diagnostics(file).map(d => {
      const p = d.file.getLineAndCharacterOfPosition(d.start);
      return { line: p.line + 1, column: p.character + 1, tsCode: d.code, message: d.messageText };
    });
    assert.ok(diagnostics.some(d => d.line === c.line && d.message.includes(`[${c.code}]`)));
    locality.push({
      slot: c.slot,
      file: `packages/ts-plugin-yield/test/fixtures/mistakes/${name}`,
      source: c.source,
      diagnostics
    });
  } finally {
    service.dispose();
  }
}
const colors = readFileSync(join(fixtureRoot, "colors.tsx"), "utf8");
const { service } = makeService({ "colors.tsx": colors });
const hover = [];
try {
  for (const name of ["DocPage", "PendingCount", "SaveButton"]) {
    const qi = service.quickInfo(
      join(fixtureRoot, "colors.tsx"),
      colors.indexOf("function " + name) + 9
    );
    hover.push({ component: name, text: qi.displayParts.map(p => p.text).join("") });
  }
} finally {
  service.dispose();
}
const text = JSON.stringify({ locality, hover }, null, 2) + "\n";
const output = join(root, "documentation/sugar-typing-evidence.json");
if (process.argv.includes("--write")) writeFileSync(output, text);
else
  assert.equal(
    readFileSync(output, "utf8"),
    text,
    "Typing evidence drifted; review it, then run with --write."
  );
console.log("sugar typing evidence: 10 source locations and 3 component hovers PASS");
