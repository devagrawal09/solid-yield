// @ts-check
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { deepStrictEqual } from "node:assert";
import { fixturesDir } from "../fixtures/index.mjs";

/** Stable score only: no timings or machine-specific absolute paths.
 * @param {import("./score.mjs").Score} s */
export function baselineSignature(s) {
  /** @param {import("../src/types.d.ts").SoundDiagnostic} d */
  const diagnostic = d => ({ code: d.code, severity: d.severity, message: d.message, loc: { ...d.loc, file: relative(fixturesDir, d.loc.file) } });
  // Match JSON storage: omit undefined optional notes/locations on both sides.
  return JSON.parse(JSON.stringify({ hits: s.hits, imprecise: s.imprecise, misses: s.misses, warningHits: s.warningHits, warningMisses: s.warningMisses, extraErrors: s.extraErrors.map(diagnostic), extraWarnings: s.extraWarnings.map(diagnostic), infoHits: s.infoHits, infoMisses: s.infoMisses, infos: s.infos, soundnessFailure: s.soundnessFailure, total: s.total }));
}

/** Only new-group scores may use this baseline. Old tests must stay strict.
 * @param {string} prototype @param {import("../fixtures/schema.d.ts").Fixture} fixture
 * @param {import("./score.mjs").Score} s */
export function assertKnownOpenclaw(prototype, fixture, s) {
  if (fixture.group !== "openclaw") throw new Error("Cannot baseline an old fixture");
  const known = JSON.parse(readFileSync(new URL("../results/openclaw-known.json", import.meta.url), "utf8"));
  if (!known[prototype]?.[fixture.id]) throw new Error(`Missing known score: ${prototype}/${fixture.id}`);
  deepStrictEqual(baselineSignature(s), known[prototype][fixture.id], `Known OpenClaw baseline changed: ${prototype}/${fixture.id}; review regressions or improvements`);
  deepStrictEqual(s.leakage, []);
  deepStrictEqual(s.codeTableViolations, []);
  deepStrictEqual(s.unmapped, 0);
}
