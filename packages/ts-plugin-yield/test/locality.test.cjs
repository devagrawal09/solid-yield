const test = require("node:test");
const assert = require("node:assert/strict");
const { makeService, root } = require("./helpers.cjs");
const { join } = require("node:path");
for (const c of require("./cases.cjs"))
  test(`${c.slot}: ${c.file} maps to the offending line`, () => {
    const file = join(root, c.file + ".tsx");
    const { service } = makeService({ [c.file + ".tsx"]: c.source });
    try {
      const ds = service.diagnostics(file);
      assert.ok(ds.length > 0);
      assert.ok(
        ds.every(d => !String(d.messageText).includes("[generated]")),
        JSON.stringify(ds.map(d => d.messageText))
      );
      const d = ds.find(d => d.messageText.includes(`[${c.code}]`));
      assert.ok(d, JSON.stringify(ds.map(d => d.messageText)));
      assert.equal(d.file.getLineAndCharacterOfPosition(d.start).line + 1, c.line, d.messageText);
      assert.ok(!String(d.messageText).includes("__@"));
    } finally {
      service.dispose();
    }
  });
