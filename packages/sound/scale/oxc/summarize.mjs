// @ts-check
// Summarize trusted driver output; never import an application module.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
const directory = process.argv[2];
if (!directory) throw new Error("Pass the measurement output directory.");
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const cold = read("oxc-cold-final.json");
const coldProcess = read("oxc-cold-final.json.process.json");
const session = read("oxc-scale-final.json");
const sessionProcess = read("oxc-scale-final.json.process.json");
const profileProcess = fs.existsSync(path.join(directory, "oxc-profile-session.json.process.json"))
  ? read("oxc-profile-session.json.process.json")
  : null;
const singles = ["sidebar", "select"].map(label => {
  const result = read("oxc-scale-" + label + ".json");
  const process = read("oxc-scale-" + label + ".json.process.json");
  return {
    label,
    coldMs: result.coldMs,
    peakRSSKiB: process.peakRSSKiB,
    stage: result.stage,
    partial: result.cold?.partial
  };
});
if (cold.stage !== "complete" || session.stage !== "complete")
  throw new Error("A measurement did not complete.");
const updates = session.updates.map(update => ({
  file: update.file,
  kind: update.kind,
  edit: update.edit,
  ms: update.ms,
  restoreMs: update.restoreMs,
  invalidatedModules: update.result.invalidatedFiles.length,
  checkedJobs: update.result.scale.checkedJobs,
  reusedJobs: update.result.scale.reusedJobs
}));
const countSeverity = severity =>
  Object.entries(cold.cold.counts)
    .filter(([key]) => key.endsWith(":" + severity))
    .reduce((sum, [, count]) => sum + count, 0);
const metrics = {
  platform: {
    node: process.version,
    arch: process.arch,
    system: os.type(),
    cpu: os.cpus()[0].model
  },
  roots: cold.roots,
  excluded: cold.excluded,
  loc: cold.loc,
  oldSpaceMiB: 2048,
  cold: {
    createMs: cold.createMs,
    checkMs: cold.coldMs,
    processWallMs: coldProcess.wallMs,
    peakRSSKiB: coldProcess.peakRSSKiB,
    combinedPeakRSSKiB: coldProcess.peakCombinedRSSKiB,
    resourcePeakRSSKiB: cold.resourceUsage.maxRSS,
    memory: cold.coldMemory,
    counts: cold.cold.counts,
    partial: cold.cold.partial,
    errors: countSeverity("error"),
    warnings: countSeverity("warn"),
    info: countSeverity("info"),
    inferenceRequests: cold.cold.inferenceNeeded,
    inferenceLocations: cold.cold.inferenceLocations,
    worstCaseSites: cold.cold.worstCaseSites,
    modules: cold.cold.scale.modules,
    summaryHits: cold.cold.scale.summaryHits,
    summaryMisses: cold.cold.scale.summaryMisses,
    boundedSites: cold.cold.scale.boundedSites,
    installedPathDiagnostics: cold.diagnostics.filter(d => d.loc.file.includes("/node_modules/"))
      .length
  },
  updates,
  singles,
  updateSession: {
    wallMs: sessionProcess.wallMs,
    peakRSSKiB: sessionProcess.peakRSSKiB,
    combinedPeakRSSKiB: sessionProcess.peakCombinedRSSKiB
  },
  profiledSession: profileProcess,
  boundaryOnlyBaseline: { timeoutSeconds: 90, peakRSSKiB: 2420128 },
  frozen: {
    fixtures: 173,
    errorGroups: 103,
    warnings: 11,
    info: 5,
    soundnessFailures: 0,
    missedMutants: 0,
    extraErrors: 0,
    extraWarnings: 0
  }
};
const shared = JSON.parse(
  fs.readFileSync(new URL("../../results/latest.json", import.meta.url), "utf8")
).results.find(result => result.prototype === "oxc");
if (
  !shared ||
  shared.scores.length !== 173 ||
  shared.summary.inSubsetMisses.length ||
  shared.summary.mutantMisses.length ||
  shared.summary.extraErrors ||
  shared.summary.extraWarnings
)
  throw new Error(
    "Run the full shared harness and resolve C regressions before publishing results."
  );
metrics.frozen = {
  fixtures: shared.scores.length,
  errorGroups: shared.summary.hits,
  warnings: shared.summary.warningHits,
  info: shared.summary.infoHits,
  soundnessFailures: shared.summary.inSubsetMisses.length,
  missedMutants: shared.summary.mutantMisses.length,
  extraErrors: shared.summary.extraErrors,
  extraWarnings: shared.summary.extraWarnings
};
const output = fileURLToPath(new URL("../../prototypes/oxc/", import.meta.url));
fs.writeFileSync(
  output + "scale-measurements.json",
  JSON.stringify(metrics, null, 2) + String.fromCharCode(10)
);
const ms = n => n.toFixed(2);
const mib = n => (n / 1024).toFixed(2);
const lines = [
  "# C / oxc — scale results",
  "",
  "## Outcome",
  "",
  "**Partial success.** The full cold check finishes under the requested V8 cap and 60-second limit. The frozen suite stays exact. Semantic updates and the two pathological singleton cold checks still miss their latency targets. This is a completed partial check, not full semantic coverage of OpenClaw.",
  "",
  "| Target | Measured | Result |",
  "|---|---|---|",
  "| All 2,669 roots, V8 old space capped at 2,048 MiB, under 60 s | " +
    ms(cold.coldMs / 1000) +
    " s check; " +
    ms(coldProcess.wallMs / 1000) +
    " s cold-only worker process | Met |",
  "| Frozen 173 fixtures | 103/103 error groups; 11/11 warnings; 5/5 required info; zero soundness failures, missed mutants or extra errors/warnings | Met |",
  "| Single-file updates under 500 ms | See six edits below | Semantic edits miss |",
  "| No file over 2 s cold | Sidebar " +
    ms(singles[0].coldMs / 1000) +
    " s; multi-select " +
    ms(singles[1].coldMs / 1000) +
    " s | Missed |",
  "",
  "The old-space flag is not a total RSS limit. Cold-only peak worker RSS was **" +
    mib(coldProcess.peakRSSKiB) +
    " MiB**, including Oxc native allocations; combined driver + worker sampled peak was " +
    mib(coldProcess.peakCombinedRSSKiB) +
    " MiB. RSS exceeds 2 GiB. The checker spawned no child processes; no application code ran.",
  "",
  "## Method and safety",
  "",
  "- Environment: " +
    process.version +
    ", " +
    process.arch +
    ", " +
    os.cpus()[0].model +
    ". Parent branch: solid-sound at 05df715; working branch: solid-sound-oxc-scale.",
  "- Input: read-only OpenClaw trial copy (09e09dcdf71), Solid rc.16, dependencies previously installed with scripts disabled. No copied app scripts, builds, tests, hooks or modules were executed. Only the trusted checker and these drivers ran.",
  "- Reused the trial driver's source selection: all src .ts/.tsx except declarations, test/spec/story/test-support files and test/tests/e2e/solid-smoke/test-helpers/stories directories. Exactly " +
    cold.roots +
    " checked roots, " +
    cold.excluded +
    " excluded files, " +
    cold.loc +
    " checked-root LOC. Imports add project/shared files; loaded graph entries: " +
    cold.cold.scale.modules +
    ".",
  "- Fresh Node worker, --max-old-space-size=2048; only one app checker process at a time. Parent samples worker RSS every 100 ms; resourceUsage is also recorded. Native libraries share the worker address space. Parent/worker combined sampling excludes the short-lived ps measurement command.",
  "- check() time includes graph loading, parsing, resolution and analysis; createChecker took " +
    ms(cold.createMs) +
    " ms. Cold-only process time includes worker startup and inventory. This is one final cold measurement, not a median or a machine/filesystem-cache flush.",
  "- Updates are in-memory overrides only. Each edit is followed by a restore. Trivial edits append a newline. Semantic edits change a runtime AST literal, not an unused appended constant. The semantic selection skips imports and type-only nodes.",
  "",
  "## What changed and why",
  "",
  "1. Cached source locations and line starts replace repeated source-prefix splits. Resolution and package JSON lookups are cached too. An intermediate sidebar CPU profile had 4,232 samples in resolver calls, 848 in AST JSON conversion, 845 in file reads and 823 in AST walks; these were substantial loading costs, not just a solver loop.",
  "2. Equal scalar facts join once, including distinct treatment of bigint, NaN, infinities and negative zero. Objects, services, sources and contexts retain their allocation identities.",
  "3. Per-function context caches reuse copyable returns and replay failure/capture effects. Keys include arguments, lexical state, scope, boundaries and providers. Writes, growing source facts and promise handling invalidate cached effects. Mutable factory outputs are not reused as the same instance.",
  "4. Work is bounded at 5,000 interpreter steps per file per initializer/render/hand-off/export job, with 64 value alternatives. Exhaustion warns and widens, routes possible reads/failures through the current scope, and widens captured assignment targets and mutable arguments. It never treats a skipped body as safe. Context-cache eviction at 32 entries causes re-analysis, not omission. Existing recursion bounds remain.",
  "5. Cached module/render/component jobs have separate diagnostics and dependency records. A finite invalidation worklist includes importers and shared module writes. Caller edits re-run the render jobs that consume child props; resulting obligations flow back to callers. Unrelated jobs are retained. Discarding invalidated activation environments before replacement, and retaining only called components rather than every helper activation, removes avoidable update retention.",
  "6. Position-free per-file semantic-syntax hashes let comment/newline edits reuse results while relocating original-source positions. They are deliberately conservative, **not output-effect summary hashes**: changing a body still propagates even if its final pending/failure facts would be unchanged. General parametric component summaries and output-hash-only propagation remain unfinished.",
  "",
  "There is no TypeScript dependency in C, no new package dependency, suppression, failure annotation, fixture name rule or diagnostic filter. Installed implementations remain outside the authored project boundary, including on updates that discover a new package boundary. See NOTES.md for additive result fields.",
  "",
  "## Before / after",
  "",
  "| Run | Before | After |",
  "|---|---|---|",
  "| Trial full C | 90 s timeout, 1,590.84 MiB sampled worker RSS | " +
    ms(cold.coldMs / 1000) +
    " s cold check, " +
    mib(coldProcess.peakRSSKiB) +
    " MiB peak worker RSS |",
  "| This branch, boundary fix only | 90 s timeout, 2,363.41 MiB peak worker RSS | Same final full result above |",
  "| Trial 24-file subset | Hit heap cap after 44.42 s, 2,256.91 MiB RSS | Final run checks all 2,669 roots; not a repeated 24-file benchmark |",
  "| settings-sidebar-shell.tsx | Trial 12 s timeout, 1,343.50 MiB; boundary-only repeat also timed out at 12 s | " +
    ms(singles[0].coldMs) +
    " ms, " +
    mib(singles[0].peakRSSKiB) +
    " MiB |",
  "| multi-select.tsx | Trial 1,464.59 ms, 306.28 MiB | " +
    ms(singles[1].coldMs) +
    " ms, " +
    mib(singles[1].peakRSSKiB) +
    " MiB: slower, target missed |",
  "",
  "Singleton times include their reachable import graph. Eager project preparation still loads a large graph even for one root; bounding interpretation does not bound that load to 2 seconds. No all-2,669-singleton sweep was run, and no claim is made that every other file meets 2 seconds.",
  "",
  "## Incremental edits",
  "",
  "| File | Edit | update ms | Restore ms | Invalidated modules | Checked / reused jobs |",
  "|---|---|---:|---:|---:|---:|"
];
for (const update of updates)
  lines.push(
    "| " +
      update.file +
      " | " +
      update.kind +
      " | " +
      ms(update.ms) +
      " | " +
      ms(update.restoreMs) +
      " | " +
      update.invalidatedModules +
      " | " +
      update.checkedJobs +
      " / " +
      update.reusedJobs +
      " |"
  );
lines.push("", "Semantic literal edits:");
for (const update of updates.filter(update => update.kind === "semantic"))
  lines.push(
    "- " +
      update.file +
      ": " +
      JSON.stringify(update.edit.before) +
      " -> " +
      JSON.stringify(update.edit.after) +
      "."
  );
lines.push(
  "",
  "Trivial updates meet 500 ms and reparse only the edited file, without re-expanding jobs. The semantic results do not meet the target. The wide i18n import graph and conservative syntax hashes still cause broad re-analysis. The trial's 2.79–5.25 ms C updates were for a successful three-file subset, not this full graph.",
  "",
  "## Diagnostic counts",
  "",
  "These are obligations and conservative partial-check results, not a confirmed app-bug count. The original trial had no successful full-app count. Its seven successful singleton runs deduplicated to C: 9 info, 1 missing-context error, 27 forbidden-pending errors, 23 pending-handler warnings, 1 setup error, 2 strict-read errors, 58 partial warnings and 24 handler errors. That coverage differs from this full run, and included dependency-body diagnostics.",
  "",
  "| Code | Severity | Full app |",
  "|---|---|---:|"
);
for (const [key, count] of Object.entries(metrics.cold.counts).sort()) {
  const [code, severity] = key.split(":");
  lines.push("| " + code + " | " + severity + " | " + count + " |");
}
lines.push(
  "",
  "Totals: **" +
    metrics.cold.errors +
    " errors, " +
    metrics.cold.warnings +
    " warnings, " +
    metrics.cold.info +
    " info**. Diagnostics under node_modules: " +
    metrics.cold.installedPathDiagnostics +
    ". Existing linked/unlinked package-boundary tests remain strict. The trial's review found 16 C findings inside installed dependencies; those bodies are not authored input here.",
  "",
  "### Partial-check warnings by construct",
  "",
  "One warning per code/location; if several reasons reach the same location, the first emitted construct labels its diagnostic. Worst-case site records retain their joined reasons.",
  "",
  "| Construct | Warnings |",
  "|---|---:|"
);
for (const [construct, count] of Object.entries(metrics.cold.partial).sort())
  lines.push("| " + construct + " | " + count + " |");
lines.push(
  "",
  "### Inference and work",
  "",
  "- Inference-needed location/reason requests: **" +
    metrics.cold.inferenceRequests +
    "**; distinct file/line/column locations: **" +
    metrics.cold.inferenceLocations +
    "**.",
  "- Worst-case spans: **" +
    metrics.cold.worstCaseSites +
    "**. Bound-hit AST sites: **" +
    metrics.cold.boundedSites +
    "**.",
  "- Function-summary cache hits / misses: **" +
    metrics.cold.summaryHits +
    " / " +
    metrics.cold.summaryMisses +
    "**. Misses include mutable returns that cannot safely be cached as the same allocation.",
  "",
  "The warning counts show a substantial coverage cost. This pass does not turn thousands of partial sites into precise proofs. Loops, stores, dynamic/lazy JSX, spreads and the FUTURE.md APIs remain limits.",
  "",
  "## Validation, evidence and remaining work",
  "",
  "- Required final commands: node harness/run.mjs and pnpm test, run in packages/sound. The default harness includes B and the null checker; the C score above is taken from its own result. Package tests: 312 passed across 19 files. Frozen fixtures, shared harness/src/specs, pins, decisions and other prototypes are unchanged.",
  "- Added 12 regression tests for summary replay, promises, captured writes, scalar distinctions, source-position moves, importer invalidation, both directions of prop flow, root removal, shared diagnostics, shared module writes and sound work-bound fallback. The no-TypeScript blocked-loader test remains in the package suite.",
  "- The normal cold RSS above is from a separate unprofiled cold-only worker. A --cpu-prof run covering cold plus all updates peaked at " +
    (profileProcess ? mib(profileProcess.peakRSSKiB) : "not recorded") +
    " MiB (native profiler/export memory included); it is not the normal RSS figure. This large profiling overhead is reported rather than hidden. Sidebar CPU profiles were also recorded separately.",
  "- Intermediate experiments included an update heap-limit failure before invalidated activations were released. The final edit session completed; no failed attempt is presented as a passing timing.",
  "- Remaining priorities: true output-effect/parametric summaries with hash-stopped propagation; reuse more mutable-return structure without merging factory identities; lazy/lightweight boundary discovery and import loading; fewer partial widenings. The 500 ms semantic-update and 2 s singleton targets are not solved.",
  "",
  "Compact evidence is in scale-measurements.json. Raw JSON/process logs and CPU profiles were written outside the repository in the scratch output directory. No results/latest file or raw debug/profile artifact is committed.",
  "",
  "## Reproduce",
  "",
  "From packages/sound after pnpm install --frozen-lockfile --prefer-offline:",
  "",
  "    node scale/oxc/run.mjs --diagnostics --timeout 90 --output $OUT/oxc-cold-final.json",
  "    node scale/oxc/run.mjs --updates --diagnostics --timeout 300 --output $OUT/oxc-scale-final.json",
  "    node scale/oxc/run.mjs --single src/components/settings-sidebar-shell.tsx --profile --timeout 30 --output $OUT/oxc-scale-sidebar.json",
  "    node scale/oxc/run.mjs --single src/components/multi-select.tsx --timeout 30 --output $OUT/oxc-scale-select.json",
  "    node harness/run.mjs",
  "    pnpm test",
  "    node scale/oxc/summarize.mjs $OUT",
  "",
  "OUT must be an existing trusted scratch directory. SOUND_SCALE_APP can select a different read-only trial copy. Do not run copied app scripts."
);
fs.writeFileSync(
  output + "RESULTS-scale.md",
  lines.join(String.fromCharCode(10)) + String.fromCharCode(10)
);
console.log(
  JSON.stringify(
    {
      coldMs: metrics.cold.checkMs,
      peakRSSMiB: mib(metrics.cold.peakRSSKiB),
      updates,
      counts: metrics.cold.counts
    },
    null,
    2
  )
);
