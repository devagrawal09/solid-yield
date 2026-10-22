// @ts-check
// Re-measure intentionally: node harness/openclaw-baseline.mjs. Review changes.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fixtures, fixturesDir } from "../fixtures/index.mjs";
import { createCheckerFor, loadPrototypes, packageDir } from "./load.mjs";
import { score } from "./score.mjs";
import { baselineSignature } from "./openclaw-known.mjs";

const { prototypes } = await loadPrototypes("all");
if (!prototypes.some(p => p.name === "null")) prototypes.push((await loadPrototypes("null")).prototypes[0]);
const measured = prototypes.map(prototype => {
  const scores = fixtures.map(fixture => {
    const checker = createCheckerFor(prototype, fixture);
    try {
      const s = score(fixture, fixturesDir, checker.check().diagnostics, 0);
      if (s.leakage.length || s.unmapped || s.codeTableViolations.length) throw new Error(`Invalid diagnostics: ${prototype.name}/${fixture.id}`);
      return s;
    } finally { checker.dispose(); }
  });
  return { prototype: prototype.name, scores };
});
const known = Object.fromEntries(measured.map(result => [result.prototype, Object.fromEntries(result.scores.filter(s => s.group === "openclaw").map(s => [s.fixture, baselineSignature(s)]))]));
writeFileSync(resolve(packageDir, "results/openclaw-known.json"), JSON.stringify(known, null, 2) + "\n");
const mutantIds = new Set(fixtures.filter(f => f.mutation).map(f => f.id));
/** @param {import("./score.mjs").Score[]} scores */
function summary(scores) {
  return {
    hits: scores.reduce((n, s) => n + s.hits.length + s.warningHits, 0),
    misses: scores.reduce((n, s) => n + s.misses.length + s.warningMisses.length, 0),
    extras: scores.reduce((n, s) => n + s.extraErrors.length + s.extraWarnings.length, 0),
    soundnessFailures: scores.filter(s => s.soundnessFailure).length,
    mutantsMissed: scores.filter(s => mutantIds.has(s.fixture) && s.soundnessFailure).map(s => s.fixture),
    failingFixtures: scores.filter(s => s.soundnessFailure || s.extraErrors.length || s.extraWarnings.length || s.infoMisses).map(s => s.fixture),
    infoMisses: scores.reduce((n, s) => n + s.infoMisses, 0)
  };
}
const report = measured.map(result => ({ prototype: result.prototype, all: summary(result.scores), openclaw: summary(result.scores.filter(s => s.group === "openclaw")) }));
writeFileSync(resolve(packageDir, "results/openclaw-baseline.json"), JSON.stringify(report, null, 2) + "\n");
/** @param {"all" | "openclaw"} scope */
const table = scope => ["| Prototype | Hit | Miss | Extra | Soundness failures | Mutants missed | Info misses |", "|---|---:|---:|---:|---:|---:|---:|", ...report.map(r => { const s = r[scope]; return `| ${r.prototype} | ${s.hits} | ${s.misses} | ${s.extras} | ${s.soundnessFailures} | ${s.mutantsMissed.length} | ${s.infoMisses} |`; })].join("\n");
const md = "# OpenClaw baseline (D-131)\n\nUnchanged A=typed, B=dataflow, C=oxc, plus null. 143 total fixtures; 34 in\nopenclaw (18 clean controls, 16 diagnostic-bearing mutants). Hits/misses count\nrequired error and warning expectations; extras count emitted errors/warnings.\nA miss, including a required warning, is a soundness failure. Info misses are\nreported separately. No prototype analysis was edited.\n\n## New openclaw group\n\n" + table("openclaw") + "\n\n## Entire frozen suite\n\n" + table("all") + "\n\n" + report.map(r => `## ${r.prototype}: failing fixtures\n\nNew group: ${r.openclaw.failingFixtures.join(", ") || "none"}.\n\nAll groups: ${r.all.failingFixtures.join(", ") || "none"}.\n\nNew mutants missed: ${r.openclaw.mutantsMissed.join(", ") || "none"}.\n\nAll mutants missed: ${r.all.mutantsMissed.join(", ") || "none"}.`).join("\n\n") + "\n\n## Honest known failures\n\nresults/openclaw-known.json pins every new-group score signature, including\nmissed anchors, precise hits, extras and required related locations as scored.\nTests still run each checker; changes in either direction fail until reviewed.\nOld fixtures retain their original zero-miss assertions. Leakage, unknown codes\nand unmapped locations are never accepted. Null remains the negative checker.\nRegenerate with node harness/openclaw-baseline.mjs only after review; pnpm test\ndoes not update this baseline. Raw full harness scores remain in latest.json.\n";
writeFileSync(resolve(packageDir, "results/openclaw-baseline.md"), md);
const comparisonPath = resolve(packageDir, "COMPARISON.md");
const before = readFileSync(comparisonPath, "utf8");
const heading = "\n## OpenClaw current-slice baseline (D-131)\n";
const section = heading + "\nThe 34 new shared requirements are measured against unchanged A/B/C. No IR\nchoice or implementation change is made. Ref read scopes are included; ref\nownership and all FUTURE.md areas are deferred.\n\n" + table("openclaw") + "\n\nEntire suite (143 fixtures):\n\n" + table("all") + "\n\nFailing fixture IDs and missed mutants, including null, are listed in\n[results/openclaw-baseline.md](results/openclaw-baseline.md).\nNew-group tests pin known scores (not skip/expected-failure tests); old tests\nremain strict. Runtime evidence: results/openclaw-runtime.md.\n";
writeFileSync(comparisonPath, before.includes(heading) ? before.slice(0, before.indexOf(heading)) + section : before + section);
console.log(table("openclaw"));
