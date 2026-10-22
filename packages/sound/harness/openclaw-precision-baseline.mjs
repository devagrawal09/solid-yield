// @ts-check
// Deliberate refresh only. Review every signature change before accepting.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { openclawPrecisionFixtures as fixtures } from "../fixtures/openclaw-precision.mjs";
import { fixturesDir } from "../fixtures/index.mjs";
import { createCheckerFor, loadPrototypes, packageDir } from "./load.mjs";
import { score } from "./score.mjs";
import { baselineSignature } from "./openclaw-known.mjs";

const { prototypes } = await loadPrototypes("dataflow,oxc,null");
const measured = prototypes.map(prototype => ({ prototype: prototype.name, scores: fixtures.map(fixture => {
  const checker = createCheckerFor(prototype, fixture);
  try {
    const s = score(fixture, fixturesDir, checker.check().diagnostics, 0);
    if (s.leakage.length || s.unmapped || s.codeTableViolations.length) throw new Error("Invalid diagnostics: " + prototype.name + "/" + fixture.id);
    return s;
  } finally { checker.dispose(); }
}) }));
const known = Object.fromEntries(measured.map(r => [r.prototype, Object.fromEntries(r.scores.map(s => [s.fixture, baselineSignature(s)]))]));
writeFileSync(resolve(packageDir, "results/openclaw-precision-known.json"), JSON.stringify(known, null, 2) + "\n");
const summaries = measured.map(r => ({ prototype: r.prototype,
  hits: r.scores.reduce((n, s) => n + s.hits.length + s.warningHits, 0),
  misses: r.scores.reduce((n, s) => n + s.misses.length + s.warningMisses.length, 0),
  extraErrors: r.scores.reduce((n, s) => n + s.extraErrors.length, 0),
  extraWarnings: r.scores.reduce((n, s) => n + s.extraWarnings.length, 0),
  negativeErrors: r.scores.filter(s => !fixtures.find(f => f.id === s.fixture)?.mutation).reduce((n, s) => n + s.extraErrors.length, 0),
  dependencyErrors: r.scores.reduce((n, s) => n + s.extraErrors.filter(d => d.loc.file.includes("/node_modules/@precision/")).length, 0)
}));
writeFileSync(resolve(packageDir, "results/openclaw-precision-baseline.json"), JSON.stringify(summaries, null, 2) + "\n");
const header = "| Prototype | Hits | Misses | Extra errors | Extra warnings | Errors on negatives | Errors inside dependency |\n|---|---:|---:|---:|---:|---:|---:|";
const totals = summaries.map(r => "| " + [r.prototype,r.hits,r.misses,r.extraErrors,r.extraWarnings,r.negativeErrors,r.dependencyErrors].join(" | ") + " |").join("\n");
const detail = measured.map(r => "## " + r.prototype + ": every fixture\n\n| Fixture | Hit | Miss | Extra errors | Extra warnings |\n|---|---:|---:|---:|---:|\n" + r.scores.map(s => "| " + [s.fixture,s.hits.length+s.warningHits,s.misses.length+s.warningMisses.length,s.extraErrors.length,s.extraWarnings.length].join(" | ") + " |").join("\n")).join("\n\n");
writeFileSync(resolve(packageDir, "results/openclaw-precision-baseline.md"), "# OpenClaw precision baseline (D-133)\n\nUnchanged B=dataflow, C=oxc, and null. 30 fixtures: 15 negative controls and 15\npaired mutants, including E24/E28/E30/E40 as true D-129 obligations. No prototype\nanalysis was edited. Precision is measured by **extras per fixture**, especially\nerrors on negative controls, not merely successful expected hits.\n\n" + header + "\n" + totals + "\n\n" + detail + "\n\n## Exact known failures\n\nopenclaw-precision-known.json pins the whole score for each prototype and fixture,\nincluding every extra error/warning and its original location/message. No findings\nare filtered, and dependency-body errors remain visible failures of the new rule.\nA crash aborts the refresh. Old groups keep their existing assertions/baselines.\nBoth regressions and improvements fail the suite until reviewed. Partial class and\ndependency fixtures still count missed expectations in the table even where the\nlegacy scorer does not mark their whole fixture as an in-subset soundness failure.\nRuntime evidence: openclaw-precision-runtime.md.\n");
console.log(JSON.stringify(summaries, null, 2));
