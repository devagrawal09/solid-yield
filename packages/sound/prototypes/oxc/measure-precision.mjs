// @ts-check
// Report generation only. The checker never consults fixture expectations.
import { writeFileSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { byGroup, fixturesDir } from "../../fixtures/index.mjs";
import { score } from "../../harness/score.mjs";
import { baselineSignature } from "../../harness/openclaw-known.mjs";
import { createChecker } from "./index.mjs";
const out = dirname(fileURLToPath(import.meta.url));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const site = value => ({
  ...value,
  loc: { ...value.loc, file: relative(fixturesDir, value.loc.file) }
});
const rows = byGroup("all").map(fixture => {
  const rootDir = resolve(fixturesDir, fixture.dir);
  const files = fixture.files.map(file => resolve(rootDir, file));
  const times = [];
  let first;
  for (let run = 0; run < 5; run++) {
    const start = performance.now();
    const checker = createChecker({ rootDir, files });
    const result = checker.check();
    times.push(performance.now() - start);
    first ??= result;
    checker.dispose();
  }
  const elapsed = median(times);
  const scored = score(fixture, fixturesDir, first.diagnostics, elapsed);
  const needed = first.inferenceNeeded.map(site);
  return {
    id: fixture.id,
    group: fixture.group,
    mutant: Boolean(fixture.mutation),
    ...baselineSignature(scored),
    coldMs: elapsed,
    inferenceRequests: needed.length,
    inferenceSites: new Set(
      needed.map(value =>
        [value.loc.file, value.loc.line, value.loc.col, value.loc.endLine, value.loc.endCol].join(
          ":"
        )
      )
    ).size,
    inferenceNeeded: needed,
    worstCaseSites: first.worstCaseSites.map(site),
    worstCaseSiteCount: first.worstCaseSiteCount,
    partialSites: first.diagnostics.filter(d => d.code === "UNANALYZED_BOUNDARY").length
  };
});
const sum = (rows, key) => rows.reduce((n, row) => n + row[key], 0);
const totals = rows => ({
  fixtures: rows.length,
  hits: rows.reduce((n, row) => n + row.hits.length, 0),
  misses: rows.reduce((n, row) => n + row.misses.length, 0),
  warningHits: sum(rows, "warningHits"),
  warningMisses: rows.reduce((n, row) => n + row.warningMisses.length, 0),
  infoHits: sum(rows, "infoHits"),
  infoMisses: sum(rows, "infoMisses"),
  extraErrors: rows.reduce((n, row) => n + row.extraErrors.length, 0),
  extraWarnings: rows.reduce((n, row) => n + row.extraWarnings.length, 0),
  soundnessFailures: rows.filter(row => row.soundnessFailure).length,
  mutants: rows.filter(row => row.mutant).length,
  missedMutants: rows.filter(row => row.mutant && (row.misses.length || row.warningMisses.length))
    .length,
  inferenceRequests: sum(rows, "inferenceRequests"),
  inferenceSites: sum(rows, "inferenceSites"),
  worstCaseSites: sum(rows, "worstCaseSiteCount"),
  partialSites: sum(rows, "partialSites"),
  coldMedianMs: median(rows.map(row => row.coldMs)),
  coldSumMs: sum(rows, "coldMs")
});
const groups = Object.fromEntries(
  ["all", "cases", "equipment", "mutants", "openclaw", "openclaw-precision"].map(group => [
    group,
    totals(group === "all" ? rows : rows.filter(row => row.group === group))
  ])
);
writeFileSync(
  resolve(out, "precision-measurements.json"),
  JSON.stringify(
    { generatedAt: new Date().toISOString(), runs: 5, groups, fixtures: rows },
    null,
    2
  ) + String.fromCharCode(10)
);
console.log(JSON.stringify(groups, null, 2));
