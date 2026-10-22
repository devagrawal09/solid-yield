// @ts-check
// Measurement only. No fixture data is consulted by the checker.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { byGroup, fixturesDir } from "../../fixtures/index.mjs";
import { score } from "../../harness/score.mjs";
import { createChecker } from "./index.mjs";
const out = dirname(fileURLToPath(import.meta.url));
const fixtures = byGroup("all");
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const rows = fixtures.map(fixture => {
  const rootDir = resolve(fixturesDir, fixture.dir);
  const files = fixture.files.map(f => resolve(rootDir, f));
  const timings = [];
  let first;
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const checker = createChecker({ rootDir, files });
    const result = checker.check();
    timings.push(performance.now() - start);
    first ??= result;
    checker.dispose();
  }
  const scored = score(fixture, fixturesDir, first.diagnostics, median(timings));
  return {
    fixture: fixture.id,
    group: fixture.group,
    context: fixture.id.startsWith("context-") || fixture.id.startsWith("m-context-"),
    ...scored,
    inferenceNeededCount: first.inferenceNeededCount,
    inferenceNeeded: first.inferenceNeeded,
    worstCaseBoundaries: first.diagnostics.filter(d => d.code === "UNANALYZED_BOUNDARY").length
  };
});
const totals = rows => ({
  fixtures: rows.length,
  hits: rows.reduce((n, r) => n + r.hits.length, 0),
  misses: rows.reduce((n, r) => n + r.misses.length, 0),
  warningHits: rows.reduce((n, r) => n + r.warningHits, 0),
  warningMisses: rows.reduce((n, r) => n + r.warningMisses.length, 0),
  extraErrors: rows.reduce((n, r) => n + r.extraErrors.length, 0),
  extraWarnings: rows.reduce((n, r) => n + r.extraWarnings.length, 0),
  infoHits: rows.reduce((n, r) => n + r.infoHits, 0),
  infoMisses: rows.reduce((n, r) => n + r.infoMisses, 0),
  soundnessFailures: rows.filter(r => r.soundnessFailure).length,
  coldSumMs: rows.reduce((n, r) => n + r.elapsedMs, 0),
  coldMedianMs: median(rows.map(r => r.elapsedMs)),
  inferenceNeeded: rows.reduce((n, r) => n + r.inferenceNeededCount, 0),
  worstCaseBoundaries: rows.reduce((n, r) => n + r.worstCaseBoundaries, 0)
});
const groups = {
  all: totals(rows),
  openclaw: totals(rows.filter(r => r.group === "openclaw")),
  original: totals(rows.filter(r => r.group === "cases" && !r.context)),
  context: totals(rows.filter(r => r.context)),
  cases: totals(rows.filter(r => r.group === "cases")),
  contextCases: totals(rows.filter(r => r.group === "cases" && r.context)),
  mutants: totals(rows.filter(r => r.group === "mutants")),
  contextMutants: totals(rows.filter(r => r.group === "mutants" && r.context)),
  equipment: totals(rows.filter(r => r.group === "equipment"))
};
writeFileSync(
  resolve(out, "measurements.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      runs: 5,
      groups,
      fixtures: rows.map(r => ({
        id: r.fixture,
        group: r.group,
        inferenceNeededCount: r.inferenceNeededCount,
        inferenceNeeded: r.inferenceNeeded,
        worstCaseBoundaries: r.worstCaseBoundaries,
        coldMs: r.elapsedMs
      }))
    },
    null,
    2
  ) + "\n"
);
console.log(JSON.stringify(groups, null, 2));
