import { test } from "node:test";
import assert from "node:assert/strict";
import { executedBytes, phaseLimit } from "./coverage.mjs";

test("measured tolerance applies only to its own phase and preserves the threshold", () => {
  const deterministic = { maxBytes: 137926 };
  const variable = { maxBytes: 81624, tolerance: 801 };
  assert.equal(phaseLimit(deterministic), 137926);
  assert.equal(phaseLimit(variable), 82425);
  assert.equal(82425 > phaseLimit(variable), false);
  assert.equal(82426 > phaseLimit(variable), true);
  assert.deepEqual(variable, { maxBytes: 81624, tolerance: 801 });
});

test("invalid tolerance cannot disable the byte gate", () => {
  for (const tolerance of [-1, 0.5, "801", null, NaN, Infinity])
    assert.throws(() => phaseLimit({ maxBytes: 81624, tolerance }), /tolerance/);
  assert.throws(() => phaseLimit({ maxBytes: NaN }), /maxBytes/);
  assert.throws(
    () => phaseLimit({ maxBytes: Number.MAX_SAFE_INTEGER, tolerance: 1 }),
    /safe integer/
  );
});
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
