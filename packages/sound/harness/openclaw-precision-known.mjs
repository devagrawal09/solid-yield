// @ts-check
import { readFileSync } from "node:fs";
import { deepStrictEqual } from "node:assert";
import { baselineSignature } from "./openclaw-known.mjs";

/** Full per-fixture score, including every extra. No filtering or blanket xfail.
 * @param {string} prototype
 * @param {import("../fixtures/schema.d.ts").Fixture} fixture
 * @param {import("./score.mjs").Score} score */
export function assertKnownPrecision(prototype, fixture, score) {
  if (fixture.group !== "openclaw-precision") throw new Error("Cannot baseline an old fixture");
  const known = JSON.parse(readFileSync(new URL("../results/openclaw-precision-known.json", import.meta.url), "utf8"));
  if (!known[prototype]?.[fixture.id]) throw new Error("Missing precision baseline: " + prototype + "/" + fixture.id);
  deepStrictEqual(baselineSignature(score), known[prototype][fixture.id], "Precision baseline changed: " + prototype + "/" + fixture.id + "; review improvements and regressions");
  deepStrictEqual(score.leakage, []);
  deepStrictEqual(score.codeTableViolations, []);
  deepStrictEqual(score.unmapped, 0);
}
