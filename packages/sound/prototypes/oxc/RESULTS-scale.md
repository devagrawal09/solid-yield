# C / oxc — scale results

## Outcome

**Partial success.** The full cold check finishes under the requested V8 cap and 60-second limit. The frozen suite stays exact. Semantic updates and the two pathological singleton cold checks still miss their latency targets. This is a completed partial check, not full semantic coverage of OpenClaw.

| Target | Measured | Result |
|---|---|---|
| All 2,669 roots, V8 old space capped at 2,048 MiB, under 60 s | 27.68 s check; 28.04 s cold-only worker process | Met |
| Frozen 173 fixtures | 103/103 error groups; 11/11 warnings; 5/5 required info; zero soundness failures, missed mutants or extra errors/warnings | Met |
| Single-file updates under 500 ms | See six edits below | Semantic edits miss |
| No file over 2 s cold | Sidebar 5.40 s; multi-select 3.92 s | Missed |

The old-space flag is not a total RSS limit. Cold-only peak worker RSS was **2249.33 MiB**, including Oxc native allocations; combined driver + worker sampled peak was 2320.22 MiB. RSS exceeds 2 GiB. The checker spawned no child processes; no application code ran.

## Method and safety

- Environment: v24.18.0, arm64, Apple M4 Pro. Parent branch: solid-sound at 05df715; working branch: solid-sound-oxc-scale.
- Input: read-only OpenClaw trial copy (09e09dcdf71), Solid rc.16, dependencies previously installed with scripts disabled. No copied app scripts, builds, tests, hooks or modules were executed. Only the trusted checker and these drivers ran.
- Reused the trial driver's source selection: all src .ts/.tsx except declarations, test/spec/story/test-support files and test/tests/e2e/solid-smoke/test-helpers/stories directories. Exactly 2669 checked roots, 3413 excluded files, 524547 checked-root LOC. Imports add project/shared files; loaded graph entries: 8511.
- Fresh Node worker, --max-old-space-size=2048; only one app checker process at a time. Parent samples worker RSS every 100 ms; resourceUsage is also recorded. Native libraries share the worker address space. Parent/worker combined sampling excludes the short-lived ps measurement command.
- check() time includes graph loading, parsing, resolution and analysis; createChecker took 55.03 ms. Cold-only process time includes worker startup and inventory. This is one final cold measurement, not a median or a machine/filesystem-cache flush.
- Updates are in-memory overrides only. Each edit is followed by a restore. Trivial edits append a newline. Semantic edits change a runtime AST literal, not an unused appended constant. The semantic selection skips imports and type-only nodes.

## What changed and why

1. Cached source locations and line starts replace repeated source-prefix splits. Resolution and package JSON lookups are cached too. An intermediate sidebar CPU profile had 4,232 samples in resolver calls, 848 in AST JSON conversion, 845 in file reads and 823 in AST walks; these were substantial loading costs, not just a solver loop.
2. Equal scalar facts join once, including distinct treatment of bigint, NaN, infinities and negative zero. Objects, services, sources and contexts retain their allocation identities.
3. Per-function context caches reuse copyable returns and replay failure/capture effects. Keys include arguments, lexical state, scope, boundaries and providers. Writes, growing source facts and promise handling invalidate cached effects. Mutable factory outputs are not reused as the same instance.
4. Work is bounded at 5,000 interpreter steps per file per initializer/render/hand-off/export job, with 64 value alternatives. Exhaustion warns and widens, routes possible reads/failures through the current scope, and widens captured assignment targets and mutable arguments. It never treats a skipped body as safe. Context-cache eviction at 32 entries causes re-analysis, not omission. Existing recursion bounds remain.
5. Cached module/render/component jobs have separate diagnostics and dependency records. A finite invalidation worklist includes importers and shared module writes. Caller edits re-run the render jobs that consume child props; resulting obligations flow back to callers. Unrelated jobs are retained. Discarding invalidated activation environments before replacement, and retaining only called components rather than every helper activation, removes avoidable update retention.
6. Position-free per-file semantic-syntax hashes let comment/newline edits reuse results while relocating original-source positions. They are deliberately conservative, **not output-effect summary hashes**: changing a body still propagates even if its final pending/failure facts would be unchanged. General parametric component summaries and output-hash-only propagation remain unfinished.

There is no TypeScript dependency in C, no new package dependency, suppression, failure annotation, fixture name rule or diagnostic filter. Installed implementations remain outside the authored project boundary, including on updates that discover a new package boundary. See NOTES.md for additive result fields.

## Before / after

| Run | Before | After |
|---|---|---|
| Trial full C | 90 s timeout, 1,590.84 MiB sampled worker RSS | 27.68 s cold check, 2249.33 MiB peak worker RSS |
| This branch, boundary fix only | 90 s timeout, 2,363.41 MiB peak worker RSS | Same final full result above |
| Trial 24-file subset | Hit heap cap after 44.42 s, 2,256.91 MiB RSS | Final run checks all 2,669 roots; not a repeated 24-file benchmark |
| settings-sidebar-shell.tsx | Trial 12 s timeout, 1,343.50 MiB; boundary-only repeat also timed out at 12 s | 5395.49 ms, 1145.25 MiB |
| multi-select.tsx | Trial 1,464.59 ms, 306.28 MiB | 3923.89 ms, 1031.23 MiB: slower, target missed |

Singleton times include their reachable import graph. Eager project preparation still loads a large graph even for one root; bounding interpretation does not bound that load to 2 seconds. No all-2,669-singleton sweep was run, and no claim is made that every other file meets 2 seconds.

## Incremental edits

| File | Edit | update ms | Restore ms | Invalidated modules | Checked / reused jobs |
|---|---|---:|---:|---:|---:|
| components/theme-brand-icon.tsx | trivial | 1.78 | 1.18 | 1 | 0 / 3649 |
| components/theme-brand-icon.tsx | semantic | 19419.80 | 17650.01 | 5422 | 2746 / 901 |
| lib/reactive/i18n.ts | trivial | 1.10 | 0.75 | 1 | 0 / 3647 |
| lib/reactive/i18n.ts | semantic | 17855.67 | 17992.88 | 5422 | 2746 / 901 |
| app/app-root.tsx | trivial | 6.03 | 4.49 | 1 | 0 / 3647 |
| app/app-root.tsx | semantic | 18322.61 | 17940.10 | 5422 | 2746 / 901 |

Semantic literal edits:
- components/theme-brand-icon.tsx: "branding" -> "branding-scale".
- lib/reactive/i18n.ts: true -> false.
- app/app-root.tsx: true -> false.

Trivial updates meet 500 ms and reparse only the edited file, without re-expanding jobs. The semantic results do not meet the target. The wide i18n import graph and conservative syntax hashes still cause broad re-analysis. The trial's 2.79–5.25 ms C updates were for a successful three-file subset, not this full graph.

## Diagnostic counts

These are obligations and conservative partial-check results, not a confirmed app-bug count. The original trial had no successful full-app count. Its seven successful singleton runs deduplicated to C: 9 info, 1 missing-context error, 27 forbidden-pending errors, 23 pending-handler warnings, 1 setup error, 2 strict-read errors, 58 partial warnings and 24 handler errors. That coverage differs from this full run, and included dependency-body diagnostics.

| Code | Severity | Full app |
|---|---|---:|
| ASYNC_OUTSIDE_LOADING_BOUNDARY | error | 557 |
| COMPONENT_OBLIGATIONS_EXPORTED | info | 516 |
| CONTEXT_PROVIDER_MISSING | error | 5 |
| ERROR_OUTSIDE_ERRORED_BOUNDARY | error | 1195 |
| PENDING_ASYNC_FORBIDDEN_SCOPE | error | 1292 |
| PENDING_ASYNC_IN_HANDLER | warn | 2288 |
| PENDING_ASYNC_UNTRACKED_READ | error | 410 |
| REACTIVE_WRITE_IN_OWNED_SCOPE | error | 2 |
| SETUP_MAY_THROW | error | 621 |
| STRICT_READ_UNTRACKED | error | 74 |
| UNANALYZED_BOUNDARY | warn | 10737 |
| UNHANDLED_HANDLER_FAILURE | error | 1443 |

Totals: **5599 errors, 13025 warnings, 516 info**. Diagnostics under node_modules: 0. Existing linked/unlinked package-boundary tests remain strict. The trial's review found 16 C findings inside installed dependencies; those bodies are not authored input here.

### Partial-check warnings by construct

One warning per code/location; if several reasons reach the same location, the first emitted construct labels its diagnostic. Worst-case site records retain their joined reasons.

| Construct | Warnings |
|---|---:|
| JSX spread | 403 |
| Solid action is outside the modeled subset | 89 |
| Solid children is outside the modeled subset | 9 |
| Solid createComponent is outside the modeled subset | 1 |
| Solid createDeferred is outside the modeled subset | 15 |
| Solid createErrorBoundary is outside the modeled subset | 1 |
| Solid createLoadingBoundary is outside the modeled subset | 2 |
| Solid createOptimistic is outside the modeled subset | 109 |
| Solid createOptimisticStore is outside the modeled subset | 10 |
| Solid createProjection is outside the modeled subset | 5 |
| Solid createStore is outside the modeled subset | 42 |
| Solid createUniqueId is outside the modeled subset | 42 |
| Solid dynamic is outside the modeled subset | 17 |
| Solid flush is outside the modeled subset | 1 |
| Solid getObserver is outside the modeled subset | 1 |
| Solid getOwner is outside the modeled subset | 5 |
| Solid isPending is outside the modeled subset | 78 |
| Solid latest is outside the modeled subset | 66 |
| Solid lazy is outside the modeled subset | 59 |
| Solid mapArray is outside the modeled subset | 3 |
| Solid omit is outside the modeled subset | 4 |
| Solid reconcile is outside the modeled subset | 1 |
| Solid refresh is outside the modeled subset | 1 |
| Solid runWithOwner is outside the modeled subset | 2 |
| Solid spread is outside the modeled subset | 1 |
| Solid template is outside the modeled subset | 1 |
| class construction | 161 |
| derived signal | 45 |
| dynamic or unmodeled JSX | 150 |
| file work budget exhausted | 5435 |
| function work budget exhausted | 2239 |
| installed dependency has no declaration | 51 |
| loop state needs a fixed-point analysis | 776 |
| merge source shape needs inference | 344 |
| module reactive state | 2 |
| reactive write in ref: ownership is not modeled | 21 |
| recursive call needs a wider summary | 53 |
| unmodeled expression ImportExpression | 37 |
| unmodeled expression MetaProperty | 5 |
| unmodeled expression SpreadElement | 1 |
| unmodeled expression YieldExpression | 3 |
| unmodeled statement TSEnumDeclaration | 1 |
| unmodeled statement TSModuleDeclaration | 147 |
| unsupported class shape | 189 |
| value alternatives exceed summary budget | 109 |

### Inference and work

- Inference-needed location/reason requests: **57346**; distinct file/line/column locations: **41289**.
- Worst-case spans: **30760**. Bound-hit AST sites: **7909**.
- Function-summary cache hits / misses: **23757 / 930582**. Misses include mutable returns that cannot safely be cached as the same allocation.

The warning counts show a substantial coverage cost. This pass does not turn thousands of partial sites into precise proofs. Loops, stores, dynamic/lazy JSX, spreads and the FUTURE.md APIs remain limits.

## Validation, evidence and remaining work

- Required final commands: node harness/run.mjs and pnpm test, run in packages/sound. The default harness includes B and the null checker; the C score above is taken from its own result. Package tests: 312 passed across 19 files. Frozen fixtures, shared harness/src/specs, pins, decisions and other prototypes are unchanged.
- Added 12 regression tests for summary replay, promises, captured writes, scalar distinctions, source-position moves, importer invalidation, both directions of prop flow, root removal, shared diagnostics, shared module writes and sound work-bound fallback. The no-TypeScript blocked-loader test remains in the package suite.
- The normal cold RSS above is from a separate unprofiled cold-only worker. A --cpu-prof run covering cold plus all updates peaked at 10166.88 MiB (native profiler/export memory included); it is not the normal RSS figure. This large profiling overhead is reported rather than hidden. Sidebar CPU profiles were also recorded separately.
- Intermediate experiments included an update heap-limit failure before invalidated activations were released. The final edit session completed; no failed attempt is presented as a passing timing.
- Remaining priorities: true output-effect/parametric summaries with hash-stopped propagation; reuse more mutable-return structure without merging factory identities; lazy/lightweight boundary discovery and import loading; fewer partial widenings. The 500 ms semantic-update and 2 s singleton targets are not solved.

Compact evidence is in scale-measurements.json. Raw JSON/process logs and CPU profiles were written outside the repository in the scratch output directory. No results/latest file or raw debug/profile artifact is committed.

## Reproduce

From packages/sound after pnpm install --frozen-lockfile --prefer-offline:

    node scale/run.mjs --diagnostics --timeout 90 --output $OUT/oxc-cold-final.json
    node scale/run.mjs --updates --diagnostics --timeout 300 --output $OUT/oxc-scale-final.json
    node scale/run.mjs --single src/components/settings-sidebar-shell.tsx --profile --timeout 30 --output $OUT/oxc-scale-sidebar.json
    node scale/run.mjs --single src/components/multi-select.tsx --timeout 30 --output $OUT/oxc-scale-select.json
    node harness/run.mjs
    pnpm test
    node scale/summarize.mjs $OUT

OUT must be an existing trusted scratch directory. SOUND_SCALE_APP can select a different read-only trial copy. Do not run copied app scripts.
