const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { makeHost, root, ts } = require("./helpers.cjs");
const { createVirtualService } = require("../src/service.cjs");
const readme = readFileSync(join(__dirname, "../README.md"), "utf8");
const marker = readme.indexOf("<!-- native-draft-example -->");
assert.notEqual(marker, -1);
const start = readme.indexOf("```tsx", marker) + "```tsx".length;
const end = readme.indexOf("```", start);
assert.ok(end > start);
const example = readme.slice(start, end).trim();
const file = join(root, "onboarding.tsx");
const text = d => ts.flattenDiagnosticMessageText(d.messageText, "\n");

function services(source, run) {
  const host = makeHost({ "onboarding.tsx": source });
  const options = host.getCompilationSettings();
  host.getCompilationSettings = () => ({ ...options, jsxImportSource: "@solidjs/web" });
  const original = ts.createLanguageService(host);
  const native = createVirtualService(ts, host, { mode: "native", include: ["*.tsx"] });
  try {
    run(original, native);
  } finally {
    original.dispose();
    native.dispose();
  }
}

test("the documented typed context and local async form pass both checkers", () => {
  services(example, (original, native) => {
    assert.deepEqual(original.getSemanticDiagnostics(file).map(text), []);
    assert.deepEqual(native.diagnostics(file).map(text), []);
  });
});

test("the documented form still reports unhandled request failures", () => {
  const source = example.replace(
    /try \{([\s\S]*?)\} catch \(error\) \{[\s\S]*?return false;\s*\}/,
    "$1"
  );
  assert.notEqual(source, example);
  services(source, (original, native) => {
    assert.deepEqual(original.getSemanticDiagnostics(file).map(text), []);
    const diagnostics = native.diagnostics(file).map(text);
    assert.ok(
      diagnostics.some(message => message.includes("[EVENT_REJECTS]")),
      diagnostics.join("\n")
    );
  });
});
