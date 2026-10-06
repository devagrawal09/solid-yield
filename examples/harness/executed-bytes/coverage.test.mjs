import { test } from "node:test";
import assert from "node:assert/strict";
import { executedBytes } from "./coverage.mjs";
test("coverage unions ranges and subtracts unexecuted nested blocks", () => {
  assert.equal(
    executedBytes("abcdefghij", [
      {
        ranges: [
          { startOffset: 0, endOffset: 10, count: 1 },
          { startOffset: 2, endOffset: 8, count: 0 },
          { startOffset: 4, endOffset: 6, count: 1 }
        ]
      }
    ]),
    6
  );
});
test("coverage measures UTF-8 bytes, not V8 UTF-16 offsets", () => {
  assert.equal(
    executedBytes("a😀é", [{ ranges: [{ startOffset: 1, endOffset: 4, count: 1 }] }]),
    6
  );
});
test("coverage excludes inline source-map metadata", () => {
  const code = "run();\n";
  const source = code + "//# sourceMappingURL=data:application/json;base64,abcdef";
  assert.equal(
    executedBytes(source, [{ ranges: [{ startOffset: 0, endOffset: source.length, count: 1 }] }]),
    Buffer.byteLength(code)
  );
});
