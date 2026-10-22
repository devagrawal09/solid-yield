# B whole-app noise round

Base `f38b2bc`, branch `solid-sound-dataflow-noise`. B and C remain available;
only B and standalone evidence tools changed. No push.

The largest confirmed attribution defect is fixed, and resolved JSX function
bodies are now checked at direct calls. **Total diagnostics increased from
11,214 to 11,569.** This round does not meet a whole-app noise-reduction goal.
Much of the remaining volume is required uncertainty from unsupported semantics,
not a collection of proven application bugs. Removing it soundly needs more
analysis and retained causal paths.

## Same-input measurements

| Measure | Before | After |
|---|---:|---:|
| Checked roots / LOC | 2,669 / 524,547 | same |
| Candidates / excluded | 6,082 / 3,413 | same |
| Cold check | 19,814.6 ms | 18,330.7 ms |
| Worker process wall | 20,613.1 ms | 18,902.4 ms |
| OS peak worker RSS | 2.241 GiB | 2.254 GiB |
| Old-space cap | 2,048 MiB | same |
| Timeout / exit | no / 0 | no / 0 |
| Program sources / declarations | 3,114 / 445 | same |
| Checked implementation sources | 2,669 | same |
| Charged jobs | 3,711 | 3,707 |
| Activations with recursion/depth/work cutoffs | 299 | 307 |
| Activations exceeding 20,000 steps | 227 | 232 |
| Cutoff jobs taking at least one second | 0 | 0 |
| Errors / warnings / info | 4,802 / 5,969 / 443 | 5,004 / 6,113 / 452 |

These are one cold run per version, not a speed estimate. The earlier scale
report's 16.7 s / 2.08 GiB is historical, not this round's before run. Timing was
not isolated from the independent C worker. RSS exceeds old-space because it
includes native, code, young-generation and other memory. No heap/depth/work
limit was raised. Cutoff flags include recursion/depth as well as total work;
the table does not conflate all 307 with timeouts.

Node **24.18.0**, TypeScript **6.0.3**, macOS arm64. Trial dependencies remain
**rc.16**; shared fixtures remain **rc.17**. The same `scale/input.mjs` and full
compiler-options object were used. Input text hash and options match exactly;
see [manifest.json](noise-evidence/manifest.json), [before.json](noise-evidence/before.json)
and [after.json](noise-evidence/after.json). A preliminary Node 22 pair produced
identical diagnostic JSON; it was replaced by the matched Node 24 measurements.
The intermediate alias-only run is retained as `after-alias.*`, explicitly Node 22.

## Raw diagnostic counts

| Code | Severity | Before | After |
|---|---|---:|---:|
| UNANALYZED_BOUNDARY | warn | 5,566 | 5,690 |
| UNHANDLED_HANDLER_FAILURE | error | 1,859 | 1,948 |
| CONTEXT_PROVIDER_MISSING | error | 5 | 5 |
| SETUP_MAY_THROW | error | 114 | 125 |
| PENDING_ASYNC_IN_HANDLER | warn | 403 | 423 |
| STRICT_READ_UNTRACKED | error | 37 | 37 |
| PENDING_ASYNC_FORBIDDEN_SCOPE | error | 11 | 11 |
| REACTIVE_WRITE_IN_OWNED_SCOPE | error | 3 | 3 |
| PENDING_ASYNC_UNTRACKED_READ | error | 9 | 15 |
| ASYNC_OUTSIDE_LOADING_BOUNDARY | error | 1,216 | 1,207 |
| ERROR_OUTSIDE_ERRORED_BOUNDARY | error | 1,548 | 1,653 |
| COMPONENT_OBLIGATIONS_EXPORTED | info | 443 | 452 |
| **Total** | | **11,214** | **11,569** |

Raw records, including primary/related locations, messages and failure/source
data: [before](noise-evidence/before.diagnostics.json.gz),
[after](noise-evidence/after.diagnostics.json.gz). No display filtering or
severity changes are applied. Additions/removals by exact code/location and
changed-message counts are in [root-causes.json](noise-evidence/root-causes.json).

## Root causes, ranked separately from obligations

Every diagnostic is partitioned by visible causal evidence. Exact origin is
marked unresolved when B did not retain it. A nearby warning is never treated
as proof of causation. These are analysis strata, **not all-record TP/FP verdicts**.

| Direct boundary root-cause stratum | Before sites | After sites |
|---|---:|---:|
| Missing declaration or returned shape | 8 | 1,445 |
| Unchecked implementation import / re-export | 1,294 | 1,294 |
| Deferred Solid API / ownership semantics | 1,077 | 1,138 |
| Object, props, indexing, mutation or escape semantics | 1,102 | 1,105 |
| Recursion / depth / work cutoff | 302 | 310 |
| Unresolved render / provider / call shape | 403 | 257 |
| Other unsupported syntax / callback shape | 138 | 141 |
| Confirmed alias identity defect | 1,242 | 0 |
| **Direct warning sites** | **5,566** | **5,690** |

The alias defect is one cause amplified across 1,242 warning sites. After its
repair, unknown imports correctly account for many of the new shape warnings.
The 1,294 import sites comprise **1,258 imports and 36 re-exports**, unchanged.
There are 1,319 missing-result-shape and 126 missing-declaration warnings after.
Installed implementations remain outside authored checking; all final primary
diagnostic locations are inside `app/src`, and the bounded program has no extra
implementation files beyond the checked roots.

| Downstream / candidate stratum | Before | After |
|---|---:|---:|
| Downstream obligations, including explicit-boundary colocations | 5,165 | 5,387 |
| Supported scope/write candidates needing source review | 35 | 35 |
| Missing-provider candidates on modeled paths | 5 | 5 |
| Exported summaries, whose origins can overlap other paths | 443 | 452 |

After: 3,542 downstream findings name unknown failure without retained exact
origin; 1,049 source-read and 479 prop-flow findings also lack complete origins.
The full per-stratum severity/code table is machine-readable in `root-causes.json`.
Unknown failure sets are D-129 obligations; a function signature is never a
failure-free contract. Source-read candidates are not automatically proven
supported-code errors. The manual review below distinguishes those judgments.

There are **zero exact duplicate code/location records** before and after.
Pending/failure pairs share 1,216 sites before and 1,194 after. They are different
obligations, not duplicates to delete. Warning/error colocations rise from 47 to
182 sites. Dynamic-table, store and module-state chains produce correlated
cascades. Raw findings remain intact; grouping them here does not merge or hide
independent findings.

## Fixes and regression pairs

1. **Resolved identity.** `resolveAlias` preserves a local runtime declaration
   when it shares a symbol with a type-only import. It refuses TypeScript's
   declaration-free, shared synthetic unknown symbol as an application identity.
   Failed imports use their actual import-site boundary facts at calls. Unknown
   returned shapes remain worst case; an ordinary imported call is not invented
   as a Solid accessor. This repairs an under-reporting path as well as attribution.
2. **Direct JSX helpers.** A resolved direct or aliased JavaScript call to a
   JSX-returning function runs its body with the caller's scope and actual
   arguments. JSX inside it establishes normal tracking; returning JSX does not
   turn the call into a new component scope. Handler invocation checks the body
   too. Existing recursion/depth/work guards remain in force.

[noise.test.mjs](noise.test.mjs) has seven tests with paired controls/mutations:

| Control | Paired positive |
|---|---|
| Local JSX value beside unresolved type import | Pending memo read still needs Loading |
| Same shape with a resolved type import | Same pending obligation |
| Known safe local callback despite unrelated unresolved aliases | Injected unresolved callback still fails unknown |
| Unknown imported return consumed under Loading + Errored | Removing both boundaries retains pending + failure |
| Direct and aliased constant JSX helper | Pending read in its body remains reported |
| Known safe callback through JSX helper; held uncalled helper | Throwing callback; settled read when invoked in setup |
| Safe JSX-returning event handler | Throw in its body remains unhandled |

No shared fixture expectation or pin changed. Native/dependency contracts and
worst-case facts were not weakened. No name/path special cases or suppressions.

## Representative source chains

Paths below are relative to the read-only trial `app/`.

| Chain | Before / after interpretation |
|---|---|
| `pages/devices/view-inventory.tsx:23,667` type import + local PendingDevice -> shared unknown alias -> `app/browser-http.ts:4` createChangeListeners | Before falsely calls PendingDevice. After the import at `browser-http.ts:1` stays unchecked and the call's undeclared result is explicit worst case. No implementation was loaded. |
| `pages/chat/components/chat-composer-slash-menu.tsx:549` -> `chat-composer-slash-menu-dom.tsx:25` renderSlashMatchedName | Before opaque component call; after its string arguments and JSX body are analyzed in the caller. |
| `lib/reactive/i18n.ts:47` -> projectI18n -> `lib/reactive/projection.ts:79,111` -> observe at `:126,128` -> `i18n.ts:42` | Module signal/memo boundaries explain pending/unknown obligations on translation reads. They are not proof every translation is asynchronous. |
| `app-route-paths.ts:413` matcher -> unchecked `@openclaw/session-url-contract` import -> hand-off `chat-transcript-rows.ts:22` | Correct unknown failure and returned shape after identity repair; no failure-free implementation was inferred. Review E38. |
| `app-navigation.ts:362` NAVIGATION_PRESENTATION[routeId] -> hand-off `portals-page.tsx:629` | Explicit dynamic-member warning -> separate pending and failure obligations, E34/E40. Constant-table indexing remains unsupported. |
| `pages/chat/components/browser-tab-card.tsx:80` createStore -> keyed failedImages read at `:257` -> hand-off `chat-transcript-rows.ts:20` | Store/indexing cascade, E42; not a proven failed-image-table error. |
| `components/app-sidebar-session-section-render.tsx:300` ref -> host()/section() | Supported settled-accessor ref read: a real D-131 scope finding, E16. |
| `pages/agents-home/claws-trust-warning.tsx:45` scalar exported JSX helper -> parseClawHubAudit -> native trim at `:12` | Remaining false standalone component summary, E13. Direct calls improve, but this separate scalar-parameter summary is still wrong. |

## After review

[review.json](noise-evidence/review.json) records **45 errors and 15 silence sites**.
Each has an exact source location, excerpt, source hash, reason, TP/FP/UNSURE
verdict, and a separate contract-obligation status. Eight error records are new,
one has a changed explanation and 36 are unchanged.

Error selection is stratified by all nine error codes: quotas 10 handler,
5 setup, 5 strict, 4 forbidden, 3 write, 4 pending-setup, 6 pending-root,
6 failure-root and 2 provider. Each class sorts by file/line/column, selects up
to one third changed/new entries evenly across that pool, then fills evenly
from unchanged entries. This is not a random sample. Correlated error pairs
remain visible. Silence selection reuses the trial's original S01-S15 sites;
all were checked against final evidence and surrounding source.

| Code | TP | FP | Unsure |
|---|---:|---:|---:|
| UNHANDLED_HANDLER_FAILURE | 4 | 0 | 6 |
| SETUP_MAY_THROW | 2 | 1 | 2 |
| STRICT_READ_UNTRACKED | 3 | 0 | 2 |
| PENDING_ASYNC_FORBIDDEN_SCOPE | 0 | 0 | 4 |
| REACTIVE_WRITE_IN_OWNED_SCOPE | 0 | 0 | 3 |
| PENDING_ASYNC_UNTRACKED_READ | 0 | 0 | 4 |
| ASYNC_OUTSIDE_LOADING_BOUNDARY | 0 | 0 | 6 |
| ERROR_OUTSIDE_ERRORED_BOUNDARY | 1 | 0 | 5 |
| CONTEXT_PROVIDER_MISSING | 0 | 0 | 2 |
| **Total** | **10** | **1** | **34** |

TP means justified under the static contract, not an observed production failure.
Three reviewed TPs are supported ref/apply read errors; seven are required unknown
failure obligations. The scalar JSX-helper false positive remains unresolved.
Missing-provider findings stay unsure: source providers exist behind lazy/bridge
or nested renderer paths. A missing modeled path does not prove an app provider
is absent. The high unsure count is itself a limit of B's retained evidence.

Silence review: **11 locally justified, 4 missing partial warnings**. S04/S14 are
the unvisited higher-order preview renderer's onSettled and compute-form signal.
S10/S12 are ref arrays whose dispatch/cleanup is unmodeled and unwarned. Capture-only
refs are locally clean; other silences have explicit boundaries or downstream
module-state warnings. None establishes complete ownership checking.

No sample precision rate is extrapolated. A count change is not a precision rate,
and fixture success does not establish whole-app soundness.

## Validation and remaining work

- `node harness/run.mjs`, explicit Node 24, capped, timeout + group cleanup:
  B and unchanged C each pass 173 fixtures, zero crashes/misses/extras; B detects
  **58/58 mutants**. Warning/info expectations, mapping and code-table checks pass.
- Then `pnpm test --maxWorkers 1`, capped, timeout + group cleanup:
  **21 files / 327 tests passed**. Then standalone new tests: **7/7 passed**.
- No app code, scripts, hooks, tests or builds executed. Only trusted checker
  parsing and source reads. Frozen shared files and C are unchanged.

Unresolved: total noise did not fall; complete cause provenance is not retained;
scalar exported helper summaries still misclassify a native string operation;
higher-order renderer/ref-array warning gaps remain; deferred APIs, stores,
spreads, indexing, module state and work cutoffs remain partial. Selective semantic
updates are unchanged and were not this round's focus. The dominant uncertainty
cannot be removed soundly by treating these values as safe in the current subset.

Evidence tools: `scale/dataflow-noise-run.mjs` (one capped 120 s worker with group
cleanup), `dataflow-noise-bound.py` (serial capped trusted tests), and
`dataflow-noise-summary.py` (partition and review validation). Reproduce before
by copying B's seven implementation `.mjs` files from `f38b2bc` to a temporary
sibling `prototypes/_noise-before/`, selecting it with
`SOUND_NOISE_CHECKER=../prototypes/_noise-before/index.mjs`, and invoking the driver
with the explicit Node 24 path and label `before`. Run current B with label `after`.
Remove the temporary sibling afterward. Baseline file hashes are in the manifest.
Shared scale scripts are unchanged. `results/latest.*` remain uncommitted.
