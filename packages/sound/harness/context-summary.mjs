// @ts-check
// Summarize the shared context baseline without changing prototype output.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fixtures } from "../fixtures/index.mjs";

/** @typedef {import("./score.mjs").Score} Score */
/** @type {{ results: { prototype: string, scores: Score[], crashes: unknown[] }[] }} */
const report = JSON.parse(readFileSync(new URL("../results/context-baseline.json", import.meta.url), "utf8"));
/** @param {string} id */
const isContext = id => id.startsWith("context-") || id.startsWith("m-context-");
/** @param {Score[]} scores */
function totals(scores) {
  return {
    fixtures: scores.length,
    errorHits: scores.reduce((n, s) => n + s.hits.length, 0),
    errorMisses: scores.reduce((n, s) => n + s.misses.length, 0),
    warningHits: scores.reduce((n, s) => n + s.warningHits, 0),
    warningMisses: scores.reduce((n, s) => n + s.warningMisses.length, 0),
    extraErrors: scores.reduce((n, s) => n + s.extraErrors.length, 0),
    extraWarnings: scores.reduce((n, s) => n + s.extraWarnings.length, 0),
    infoHits: scores.reduce((n, s) => n + s.infoHits, 0),
    infoMisses: scores.reduce((n, s) => n + s.infoMisses, 0),
    soundnessFailures: scores.filter(s => s.soundnessFailure).length,
    missedMutants: scores.filter(s => s.group === "mutants" && s.soundnessFailure).map(s => s.fixture),
    imprecise: scores.reduce((n, s) => n + s.imprecise.length, 0),
    leakage: scores.reduce((n, s) => n + s.leakage.length, 0),
    unmapped: scores.reduce((n, s) => n + s.unmapped, 0)
  };
}
const summary = report.results.map(r => ({
  prototype: r.prototype, crashes: r.crashes,
  all: totals(r.scores),
  contextCases: totals(r.scores.filter(s => s.fixture.startsWith("context-"))),
  contextMutants: totals(r.scores.filter(s => s.fixture.startsWith("m-context-"))),
  equipment: totals(r.scores.filter(s => s.group === "equipment")),
  oldWithoutEquipment: totals(r.scores.filter(s => !isContext(s.fixture) && s.group !== "equipment")),
  oldScores: r.scores.filter(s => !isContext(s.fixture) && s.group !== "equipment").map(s => ({ fixture: s.fixture, errors: s.hits, errorMisses: s.misses, warningHits: s.warningHits, warningMisses: s.warningMisses, extraErrors: s.extraErrors, extraWarnings: s.extraWarnings }))
}));
writeFileSync(new URL("../results/context-summary.json", import.meta.url), JSON.stringify(summary, null, 2) + "\n");
const lines = ["# Context/services baseline summary", "", "Counts are expectation entries (not individual diagnostics); extras count diagnostics.", "A grouped entry can require several diagnostics, e.g. eight FailureControls handlers.", "Warning misses also count as soundness failures. Analysis is unchanged; only emitter severity-table wiring changed.", "", "| prototype | group | fixtures | errors hit/miss | warnings hit/miss | extra errors/warnings | failing fixtures |", "|---|---|---:|---:|---:|---:|---:|"];
/** @type {("all" | "contextCases" | "contextMutants" | "equipment" | "oldWithoutEquipment")[]} */
const groups = ["all", "contextCases", "contextMutants", "equipment", "oldWithoutEquipment"];
for (const r of summary) for (const group of groups) {
  const s = r[group];
  lines.push(`| ${r.prototype} | ${group} | ${s.fixtures} | ${s.errorHits}/${s.errorMisses} | ${s.warningHits}/${s.warningMisses} | ${s.extraErrors}/${s.extraWarnings} | ${s.soundnessFailures} |`);
}
writeFileSync(new URL("../results/context-summary.md", import.meta.url), lines.join("\n") + "\n");
const moved = new Set(["STRICT_READ_UNTRACKED", "ASYNC_OUTSIDE_LOADING_BOUNDARY", "PENDING_ASYNC_FORBIDDEN_SCOPE"]);
const changes = ["# Old slice expectation changes (D-129)", "", "Every entry below keeps its old code, anchors and count, but moves from error to warning to match rc.17.", "", "| fixture | code | anchors |", "|---|---|---|"];
for (const f of fixtures.filter(f => !isContext(f.id) && f.group !== "equipment")) for (const e of f.expectedWarnings ?? []) if (moved.has(e.code)) {
  changes.push(`| ${f.id} | ${e.code} | ${e.at.map(a => "find" in a ? a.find.replaceAll("|", "\\|") : `line ${a.line}`).join("; ")} |`);
}
changes.push("", "m-pending-through-prop also tightens its primary location to Child’s {p.n}; n={n()} is required as related. Root/caller primary anchors no longer count (D-129d).", "", "Equipment is intentionally promoted to the context subset. Its eight removed worst-case errors, seven removed partial warnings, retained ten real handler errors and two new pending-handler warnings are justified individually in fixtures/equipment/CONTEXT-EXPECTATION.md. Its old notice pending error first becomes a warning under D-129b, then disappears through precise context analysis. No other old expectation changes.");
writeFileSync(new URL("../results/context-expectation-changes.md", import.meta.url), changes.join("\n") + "\n");
const manifest = ["# Shared context fixture manifest", "", "29 strict native cases and 12 in-subset mutants. Empty expectations are negative controls.", "All sources: fixtures/context-sources.mjs. Expectations: fixtures/context.mjs.", "", "| fixture | errors | warnings | origin / parent |", "|---|---|---|---|"];
for (const f of fixtures.filter(f => isContext(f.id))) {
  manifest.push(`| ${f.id} | ${f.expected.map(e => e.code).join(", ") || "none"} | ${(f.expectedWarnings ?? []).map(e => e.code).join(", ") || "none"} | ${f.mutation?.parent ?? "native context case"} |`);
}
writeFileSync(new URL("../results/context-manifest.md", import.meta.url), manifest.join("\n") + "\n");
console.log(lines.join("\n"));
console.log(`Details: ${fileURLToPath(new URL("../results/context-summary.json", import.meta.url))}`);
