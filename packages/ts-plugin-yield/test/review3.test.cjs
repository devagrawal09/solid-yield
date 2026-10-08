const test = require("node:test");
const assert = require("node:assert/strict");
const { makeService, root, ts } = require("./helpers.cjs");
const { join } = require("node:path");
const { diagnosticSpan } = require("../src/service.cjs");
test("review 3: invalid refusal coordinates fall back to a routine without crashing", () => {
  const file = ts.createSourceFile(
    "Clock.tsx",
    "function Clock() {\n  return <p>tick</p>;\n}",
    ts.ScriptTarget.Latest,
    true
  );
  for (const [line, column] of [
    [2, 10000],
    [-3, -5],
    [NaN, Infinity]
  ]) {
    const span = diagnosticSpan(ts, file, { line, column });
    assert.equal(span.generated, true);
    assert.ok(span.start >= 0 && span.start + span.length <= file.text.length);
  }
});
test("review 3: a lowercase JSX tag has no variable binding", () => {
  const source =
    'import {createMemo} from "solid-js"; export function Details(){ const p=createMemo(()=>1); return <p>{p()}</p>; }';
  const { service } = makeService({ "Details.tsx": source });
  try {
    assert.deepEqual(service.diagnostics(join(root, "Details.tsx")), []);
  } finally {
    service.dispose();
  }
});
test("review 3: parse error names its own file", () => {
  const { service } = makeService({
    "Checkout.tsx": "export function Checkout(){return <p/>}",
    "ProductList.tsx": "export function ProductList(){ return <p>{yield}</p> }"
  });
  try {
    const ds = service.diagnostics(join(root, "ProductList.tsx"));
    assert.ok(ds.some(d => d.messageText.includes("[BABEL_PARSE_ERROR]")));
    assert.ok(ds.every(d => d.file.fileName.endsWith("ProductList.tsx")));
    assert.deepEqual(service.diagnostics(join(root, "Checkout.tsx")), []);
  } finally {
    service.dispose();
  }
});
