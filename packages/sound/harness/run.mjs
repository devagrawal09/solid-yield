// @ts-check
// The comparison harness: runs every available prototype (plus the null
// prototype) over the shared fixtures, scores against the slice expectation,
// measures cold and incremental check time, and writes results/latest.{md,json}.
//
//   node harness/run.mjs [--prototype all|typed|dataflow|null] [--group all|cases|equipment|mutants|openclaw|openclaw-precision]
//                        [--runs N] [--json path] [--verbose]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { byGroup, fixturesDir } from "../fixtures/index.mjs";
import { consoleFace } from "../src/codes.mjs";
import { createCheckerFor, fixtureFiles, loadPrototypes, packageDir } from "./load.mjs";
import { score } from "./score.mjs";

/** @typedef {import("./score.mjs").Score} Score */
/** @typedef {import("../src/types.d.ts").SoundDiagnostic} SoundDiagnostic */

/** @param {string} name @param {string} fallback */
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const selection = arg("prototype", "all");
const group = arg("group", "all");
const runs = Number(arg("runs", "3"));
const verbose = process.argv.includes("--verbose");
const jsonOut = arg("json", resolve(packageDir, "results/latest.json"));

/** @param {number[]} xs */
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
/** @param {number} n */
const ms = n => (Number.isFinite(n) ? n.toFixed(1) : "–");

/** @param {SoundDiagnostic} d */
function fmt(d) {
  const file = d.loc.file.replace(fixturesDir + "/", "");
  return `${d.severity.padEnd(5)} ${file}:${d.loc.line}:${d.loc.col} ${consoleFace(d)}`;
}

const { prototypes, missing } = await loadPrototypes(selection === "all" ? "all" : selection);
if (!prototypes.some(p => p.name === "null") && selection === "all") prototypes.push((await loadPrototypes("null")).prototypes[0]);
if (missing.length) console.error(`(prototypes not present, skipped: ${missing.join(", ")})`);
const fixtures = byGroup(group);

/**
 * @typedef {{
 *   prototype: string,
 *   scores: Score[],
 *   coldMs: Record<string, number>,
 *   incremental: { trivialMs: number, semanticMs: number, before: number, afterTrivial: number, afterSemantic: number } | null,
 *   crashes: { fixture: string, error: string }[]
 * }} PrototypeResult
 */

/** @type {PrototypeResult[]} */
const results = [];
for (const prototype of prototypes) {
  /** @type {Score[]} */
  const scores = [];
  /** @type {Record<string, number[]>} */
  const cold = {};
  /** @type {{ fixture: string, error: string }[]} */
  const crashes = [];
  let incremental = null;
  for (const fixture of fixtures) {
    /** @type {SoundDiagnostic[]} */
    let diagnostics = [];
    /** @type {number[]} */
    const times = [];
    let crashed = false;
    for (let r = 0; r < runs; r++) {
      const t0 = performance.now();
      try {
        const checker = createCheckerFor(prototype, fixture);
        const result = checker.check();
        times.push(performance.now() - t0);
        if (r === 0) diagnostics = result.diagnostics;
        if (fixture.group === "equipment" && r === 0) incremental = measureIncremental(checker, fixture);
        else checker.dispose();
      } catch (error) {
        crashed = true;
        crashes.push({ fixture: fixture.id, error: error instanceof Error ? (error.stack ?? error.message) : String(error) });
        break;
      }
    }
    if (crashed) {
      // A crash reports nothing: scored as such (every expectation missed).
      scores.push(score(fixture, fixturesDir, [], Number.NaN));
      continue;
    }
    const s = score(fixture, fixturesDir, diagnostics, median(times));
    (cold[fixture.group] ??= []).push(median(times));
    scores.push(s);
    if (verbose) {
      console.log(`\n[${prototype.name}] ${fixture.id} (${ms(s.elapsedMs)} ms)`);
      for (const d of diagnostics) console.log("  " + fmt(d));
      for (const m of s.misses) console.log(`  MISSED ${m.code} at ${m.at}${m.note ? " — " + m.note : ""}`);
    }
  }
  results.push({
    prototype: prototype.name,
    scores,
    coldMs: Object.fromEntries(Object.entries(cold).map(([g, xs]) => [g, xs.reduce((a, b) => a + b, 0)])),
    incremental,
    crashes
  });
}

/**
 * Two single-file edits to EquipmentRow.tsx: a trailing comment (trivial) and
 * a catch added around save's await (semantic: one handler failure goes away).
 * @param {import("../src/types.d.ts").Checker} checker
 * @param {import("../fixtures/schema.d.ts").Fixture} fixture
 */
function measureIncremental(checker, fixture) {
  const { rootDir } = fixtureFiles(fixture);
  const file = resolve(rootDir, "src/components/EquipmentRow.tsx");
  const text = readFileSync(file, "utf8");
  const before = checker.check().diagnostics.filter(d => d.severity === "error").length;
  /** @type {number[]} */
  const trivial = [];
  /** @type {number[]} */
  const semantic = [];
  let afterTrivial = before, afterSemantic = before;
  for (let r = 0; r < runs; r++) {
    let t0 = performance.now();
    afterTrivial = checker.update(file, text + `\n// edit ${r}\n`).diagnostics.filter(d => d.severity === "error").length;
    trivial.push(performance.now() - t0);
    const patched = text.replace("} finally { setBusy(false); }", "} catch { setError(\"failed\"); } finally { setBusy(false); }");
    t0 = performance.now();
    afterSemantic = checker.update(file, patched).diagnostics.filter(d => d.severity === "error").length;
    semantic.push(performance.now() - t0);
    checker.update(file, text);
  }
  checker.dispose();
  return { trivialMs: median(trivial), semanticMs: median(semantic), before, afterTrivial, afterSemantic };
}

// ---- report -----------------------------------------------------------------
/** @param {PrototypeResult} r */
function summary(r) {
  const scored = r.scores;
  const expectations = scored.reduce((n, s) => n + s.hits.length + s.misses.length, 0);
  const hits = scored.reduce((n, s) => n + s.hits.length, 0);
  const imprecise = scored.reduce((n, s) => n + s.imprecise.length, 0);
  const inSubsetMisses = scored.filter(s => s.soundnessFailure);
  // New labeled groups may contain mutants too; do not hide their misses.
  const mutantMisses = inSubsetMisses.filter(s => fixtures.some(f => f.id === s.fixture && f.mutation));
  const extraErrors = scored.reduce((n, s) => n + s.extraErrors.length, 0);
  const extraErrorsInSubsetClean = scored.filter(s => s.inSubset).reduce((n, s) => n + s.extraErrors.length, 0);
  const warningHits = scored.reduce((n, s) => n + s.warningHits, 0);
  const warningExpect = scored.reduce((n, s) => n + s.warningHits + s.warningMisses.length, 0);
  const extraWarnings = scored.reduce((n, s) => n + s.extraWarnings.length, 0);
  const leakage = scored.reduce((n, s) => n + s.leakage.length, 0);
  const unmapped = scored.reduce((n, s) => n + s.unmapped, 0);
  const violations = [...new Set(scored.flatMap(s => s.codeTableViolations))];
  const infoHits = scored.reduce((n, s) => n + s.infoHits, 0);
  const infoExpect = scored.reduce((n, s) => n + s.infoHits + s.infoMisses, 0);
  return { expectations, hits, imprecise, agreement: expectations ? hits / expectations : 1, inSubsetMisses: inSubsetMisses.map(s => s.fixture), mutantMisses: mutantMisses.map(s => s.fixture), extraErrors, extraErrorsInSubsetClean, warningHits, warningExpect, extraWarnings, leakage, unmapped, violations, infoHits, infoExpect, crashes: r.crashes.length };
}

const lines = [];
lines.push(`# solid-sound comparison — ${new Date().toISOString()}`, "");
lines.push(`Fixtures: ${fixtures.length} (${group}); runs per measurement: ${runs}. Prototypes: ${results.map(r => r.prototype).join(", ")}${missing.length ? `; not present: ${missing.join(", ")}` : ""}.`, "");
lines.push("## Summary", "");
lines.push("| criterion | " + results.map(r => r.prototype).join(" | ") + " |");
lines.push("|---|" + results.map(() => "---").join("|") + "|");
const sums = results.map(summary);
/** @param {string} label @param {(s: ReturnType<typeof summary>, r: PrototypeResult) => string} cell */
const row = (label, cell) => lines.push(`| ${label} | ${results.map((r, i) => cell(sums[i], r)).join(" | ")} |`);
row("expected errors hit / expected", s => `${s.hits} / ${s.expectations} (${(s.agreement * 100).toFixed(0)} %)`);
row("…of which located imprecisely (at a root, not the read)", s => String(s.imprecise));
row("**soundness failures** (in-subset misses)", s => s.inSubsetMisses.length ? `**${s.inSubsetMisses.length}**: ${s.inSubsetMisses.join(", ")}` : "0");
row("mutants missed", s => s.mutantMisses.length ? `**${s.mutantMisses.length}**` : "0");
row("extra errors (all / on in-subset fixtures)", s => `${s.extraErrors} / ${s.extraErrorsInSubsetClean}`);
row("expected warnings hit / expected", s => `${s.warningHits} / ${s.warningExpect}`);
row("extra warnings", s => String(s.extraWarnings));
row("expected info hit / expected", s => `${s.infoHits} / ${s.infoExpect}`);
row("generated-code leakage in messages", s => String(s.leakage));
row("unmapped locations", s => String(s.unmapped));
row("codes outside the table", s => (s.violations.length ? s.violations.join(", ") : "0"));
row("crashes", s => String(s.crashes));
row("cold check, cases total (ms)", (_, r) => ms(r.coldMs.cases ?? Number.NaN));
row("cold check, mutants total (ms)", (_, r) => ms(r.coldMs.mutants ?? Number.NaN));
row("cold check, Equipment app (ms)", (_, r) => ms(r.coldMs.equipment ?? Number.NaN));
row("incremental, EquipmentRow trivial edit (ms)", (_, r) => (r.incremental ? ms(r.incremental.trivialMs) : "–"));
row("incremental, EquipmentRow semantic edit (ms)", (_, r) => (r.incremental ? ms(r.incremental.semanticMs) : "–"));
row("errors before / after trivial / after semantic edit", (_, r) => (r.incremental ? `${r.incremental.before} / ${r.incremental.afterTrivial} / ${r.incremental.afterSemantic}` : "–"));
lines.push("");
for (const r of results) {
  const s = summary(r);
  if (s.inSubsetMisses.length) {
    lines.push(`> **SOUNDNESS FAILURE — ${r.prototype}: ${s.inSubsetMisses.length} in-subset fixture(s) with a missed obligation: ${s.inSubsetMisses.join(", ")}**`, "");
  }
}
lines.push("## Per fixture", "");
lines.push("| fixture | group | subset | " + results.map(r => r.prototype + " (hit/miss/extraE/extraW)").join(" | ") + " |");
lines.push("|---|---|---|" + results.map(() => "---").join("|") + "|");
fixtures.forEach((fx, i) => {
  const cells = results.map(r => {
    const s = r.scores[i];
    const miss = s.misses.length ? `**${s.misses.length}**` : "0";
    return `${s.hits.length}/${miss}/${s.extraErrors.length}/${s.extraWarnings.length}${s.soundnessFailure ? " ⚠" : ""}`;
  });
  lines.push(`| ${fx.id} | ${fx.group} | ${fx.inSubset ? "in" : "out"} | ${cells.join(" | ")} |`);
});
lines.push("");
for (const r of results) {
  const detail = r.scores.filter(s => s.misses.length || s.extraErrors.length || s.leakage.length || s.codeTableViolations.length || s.imprecise.length);
  if (!detail.length && !r.crashes.length) continue;
  lines.push(`## ${r.prototype}: misses, extras, leakage`, "");
  for (const s of detail) {
    lines.push(`- **${s.fixture}**`);
    for (const m of s.misses) lines.push(`  - missed ${m.code} at ${m.at}${m.note ? ` — ${m.note}` : ""}`);
    for (const m of s.imprecise) lines.push(`  - imprecise: ${m.code} located at a root / hand-off, not at the read`);
    for (const d of s.extraErrors) lines.push(`  - extra error: ${fmt(d)}`);
    for (const d of s.leakage) lines.push(`  - leakage: ${fmt(d)}`);
    for (const c of s.codeTableViolations) lines.push(`  - code outside the table: ${c}`);
  }
  for (const c of r.crashes) lines.push(`- **${c.fixture}** crashed: ${c.error.split("\n")[0]}`);
  lines.push("");
}
const md = lines.join("\n");
mkdirSync(resolve(packageDir, "results"), { recursive: true });
writeFileSync(resolve(packageDir, "results/latest.md"), md + "\n");
writeFileSync(jsonOut, JSON.stringify({ generatedAt: new Date().toISOString(), group, runs, results: results.map(r => ({ ...r, summary: summary(r) })) }, null, 2) + "\n");
console.log(md);
console.log(`\nwritten: results/latest.md, ${jsonOut}`);
