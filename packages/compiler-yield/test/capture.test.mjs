import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { capture } from "../src/capture.js";
const require = createRequire(new URL("../../vite-plugin-yield/package.json", import.meta.url));
const codec = await import(pathToFileURL(require.resolve("@solidjs/web/serialization")));

test("C2 edge: use the public codec, refuse functions and class-losing errors", () => {
  const value = {
    slug: "widgets",
    when: new Date(100),
    set: new Set([1, 2]),
    map: new Map([["a", 3]])
  };
  const copied = capture(value, codec, "fixture:2:9");
  assert.equal(copied.ok, true);
  assert.deepEqual(copied.value, value);
  const fn = capture(() => 1, codec, "fixture:3:9");
  assert.equal(fn.ok, false);
  assert.equal(fn.at, "fixture:3:9");
  class NotFound extends Error {
    kind = "not-found";
  }
  let node;
  codec.serializeJSON(new NotFound("missing"), { onParse: n => (node = n) });
  const decoded = codec.createJSONDeserializer()(node);
  assert.equal(decoded.kind, "not-found");
  assert.equal(decoded instanceof NotFound, false); // F-C6, not a passing capture
  assert.equal(capture({ nested: new NotFound("missing") }, codec, "fixture:4:9").ok, false);
  assert.equal(capture(Promise.resolve(1), codec, "fixture:5:9").ok, false);
});
