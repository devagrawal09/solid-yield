// @ts-check
// Scores one prototype's diagnostics for one fixture against the slice
// expectation (fixtures/index.mjs, schema.d.ts). Pure: no I/O besides reading
// the fixture's files to resolve anchors.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BY_CODE } from "../src/codes.mjs";

/** @typedef {import("../fixtures/schema.d.ts").Fixture} Fixture */
/** @typedef {import("../fixtures/schema.d.ts").Expectation} Expectation */
/** @typedef {import("../fixtures/schema.d.ts").Anchor} Anchor */
/** @typedef {import("../src/types.d.ts").SoundDiagnostic} SoundDiagnostic */

/** Generated-code vocabulary that must never reach a user-facing message. */
export const LEAKAGE = /(_E_|_P_|\byield\*?|\bGenerator\b|Source<|Path<|\broutine\b|\blowered\b|__sound|SetupOp|ViewOp)/;

/** @typedef {{ line: number, startCol: number, endCol: number, file?: string, imprecise?: boolean }} Span */

/**
 * @param {string} text
 * @param {Anchor} anchor
 * @returns {Span | null}
 */
export function resolveAnchor(text, anchor) {
  if ("line" in anchor) return { line: anchor.line, startCol: 1, endCol: Number.MAX_SAFE_INTEGER, file: anchor.file, imprecise: anchor.imprecise };
  const occurrence = anchor.occurrence ?? 1;
  let index = -1;
  for (let i = 0; i < occurrence; i++) {
    index = text.indexOf(anchor.find, index + 1);
    if (index < 0) return null;
  }
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  const startCol = index - before.lastIndexOf("\n");
  // +2: a handler reported at the `{` or `(` right after an attribute name still counts.
  return { line, startCol, endCol: startCol + anchor.find.length - 1 + 2, file: anchor.file, imprecise: anchor.imprecise };
}

/**
 * @param {SoundDiagnostic} d
 * @param {string} fixtureDir
 * @param {Expectation} e
 * @param {Span[]} spans
 */
function matches(d, fixtureDir, e, spans) {
  if (d.code !== e.code) return false;
  const file = d.loc.file.replaceAll("\\", "/");
  for (const s of spans) {
    const expectedFile = resolve(fixtureDir, s.file ?? e.file).replaceAll("\\", "/");
    if (file !== expectedFile && !file.endsWith("/" + (s.file ?? e.file))) continue;
    if (d.loc.line === s.line && d.loc.col >= s.startCol && d.loc.col <= s.endCol) return s.imprecise ? "imprecise" : "precise";
  }
  return false;
}

/**
 * @typedef {{
 *   fixture: string,
 *   group: Fixture["group"],
 *   inSubset: boolean,
 *   hits: { code: string, file: string, count: number }[],
 *   imprecise: { code: string, file: string }[],
 *   misses: { code: string, file: string, at: string, note?: string }[],
 *   extraErrors: SoundDiagnostic[],
 *   warningHits: number,
 *   warningMisses: { code: string, file: string, at: string }[],
 *   extraWarnings: SoundDiagnostic[],
 *   infos: number,
 *   infoHits: number,
 *   infoMisses: number,
 *   leakage: SoundDiagnostic[],
 *   unmapped: number,
 *   codeTableViolations: string[],
 *   soundnessFailure: boolean,
 *   elapsedMs: number,
 *   total: number
 * }} Score
 */

/**
 * @param {Fixture} fixture
 * @param {string} fixturesDir
 * @param {SoundDiagnostic[]} diagnostics
 * @param {number} elapsedMs
 * @returns {Score}
 */
export function score(fixture, fixturesDir, diagnostics, elapsedMs) {
  const dir = resolve(fixturesDir, fixture.dir);
  /** @type {Map<string, string>} */
  const texts = new Map();
  /** @param {string} file */
  const textOf = file => {
    let t = texts.get(file);
    if (t === undefined) { t = readFileSync(resolve(dir, file), "utf8"); texts.set(file, t); }
    return t;
  };
  /** @param {Expectation} e */
  const spansOf = e => e.at.map(a => resolveAnchor(textOf(a.file ?? e.file), a)).filter(/** @returns {s is Span} */ s => s !== null);
  /** @param {Expectation} e */
  const describe = e => e.at.map(a => ("line" in a ? `line ${a.line}` : `"${a.find}"${a.occurrence ? ` #${a.occurrence}` : ""}`)).join(" | ");

  const consumed = new Set();
  /** @type {{ code: string, file: string }[]} */
  const imprecise = [];
  /**
   * @param {readonly Expectation[]} expectations
   * @param {SoundDiagnostic[]} pool
   */
  const run = (expectations, pool) => {
    /** @type {{ code: string, file: string, count: number }[]} */
    const hits = [];
    /** @type {{ code: string, file: string, at: string, note?: string }[]} */
    const misses = [];
    for (const e of expectations) {
      const spans = spansOf(e);
      if (!spans.length) throw new Error(`${fixture.id}: anchor not found for ${e.code} at ${describe(e)}`);
      const matched = pool.filter(d => matches(d, dir, e, spans));
      for (const d of matched) consumed.add(d);
      const precise = matched.filter(d => matches(d, dir, e, spans) === "precise").length;
      if (matched.length >= (e.minCount ?? 1)) { hits.push({ code: e.code, file: e.file, count: matched.length }); if (!precise) imprecise.push({ code: e.code, file: e.file }); }
      else misses.push({ code: e.code, file: e.file, at: describe(e), note: e.note });
    }
    return { hits, misses };
  };

  const errors = diagnostics.filter(d => d.severity === "error");
  const warnings = diagnostics.filter(d => d.severity === "warn");
  const infos = diagnostics.filter(d => d.severity === "info");
  const e = run(fixture.expected, errors);
  const w = run(fixture.expectedWarnings ?? [], warnings);
  const i = run(fixture.expectedInfo ?? [], infos);
  const extraErrors = errors.filter(d => !consumed.has(d));
  const extraWarnings = warnings.filter(d => !consumed.has(d));
  const codeTableViolations = [...new Set(diagnostics.filter(d => !(d.code in BY_CODE)).map(d => d.code))];
  const leakage = diagnostics.filter(d => LEAKAGE.test(d.message) || (d.related ?? []).some(r => LEAKAGE.test(r.message)));
  const unmapped = diagnostics.filter(d => d.data?.unmapped === true).length;
  const soundnessFailure = fixture.inSubset && e.misses.length > 0;
  return {
    fixture: fixture.id,
    group: fixture.group,
    inSubset: fixture.inSubset,
    hits: e.hits,
    imprecise,
    misses: e.misses,
    extraErrors,
    warningHits: w.hits.length,
    warningMisses: w.misses,
    extraWarnings,
    infos: infos.length,
    infoHits: i.hits.length,
    infoMisses: i.misses.length,
    leakage,
    unmapped,
    codeTableViolations,
    soundnessFailure,
    elapsedMs,
    total: diagnostics.length
  };
}
