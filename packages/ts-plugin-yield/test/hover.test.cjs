const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { makeService, root } = require("./helpers.cjs");
const { join } = require("node:path");
const source = fs.readFileSync(join(root, "colors.tsx"), "utf8");
test("component and call hovers show colors from generated library types", () => {
  const { service } = makeService({ "colors.tsx": source });
  try {
    for (const [name, expected] of [
      ["DocPage", "fails NotFound"],
      ["PendingCount", "pending true"],
      ["SaveButton", "may-wait true; requires Identity"]
    ]) {
      const qi = service.quickInfo(
        join(root, "colors.tsx"),
        source.indexOf("function " + name) + 9
      );
      const text = qi?.displayParts.map(p => p.text).join("");
      assert.ok(text?.includes(expected), `${name}: ${text}`);
      assert.equal(qi.textSpan.start, source.indexOf("function " + name) + 9);
    }
  } finally {
    service.dispose();
  }
});

test("local routine calls query library PendingOf/FailsOf/WaitsOf/RequiresOf", () => {
  const source = `import {createMemo} from "solid-js";
export function Counter(){
 const value=createMemo(async()=>1);
 function read(){return value();}
 return <p>{read()}</p>;
}`;
  const { service } = makeService({ "routine.tsx": source });
  try {
    const qi = service.quickInfo(join(root, "routine.tsx"), source.lastIndexOf("read()"));
    assert.equal(
      qi.displayParts.map(p => p.text).join(""),
      "read: pending true; fails none; may-wait false; requires none"
    );
    assert.equal(service.diagnostics(join(root, "routine.tsx")).length, 0);
  } finally {
    service.dispose();
  }
});
