# B whole-app noise round

Base `f38b2bc`; branch `solid-sound-dataflow-noise`. This includes the follow-up
requested after parent review of `cd51110`. Only B and standalone B evidence tools
changed. C, shared fixtures/pins, input rules, dependencies and compiler options
are unchanged. No push.

The confirmed scalar-JSX-helper false positive is fixed. The four reviewed missing
partial-warning sites now warn. Their underlying features remain unsupported.
Total diagnostics increased again because previously unvisited boundaries are now
visible and reached compute-form signal tuples retain worst-case facts. This is
not a whole-app noise-reduction or soundness claim.

## Matched input and measurements

| Measure | Original before | Round one (`cd51110`) | Current after |
|---|---:|---:|---:|
| Checked roots / LOC | 2,669 / 524,547 | same | same |
| Candidates / excluded | 6,082 / 3,413 | same | same |
| Cold check, ms | 19,814.6 | 18,330.7 | 18,265.3 |
| Worker process wall, ms | 20,613.1 | 18,902.4 | 19,564.1 |
| OS peak worker RSS, GiB | 2.241 | 2.254 | 2.217 |
| Old-space cap, MiB | 2,048 | same | same |
| Timeout / exit | no / 0 | no / 0 | no / 0 |
| Program sources / declarations | 3,114 / 445 | same | same |
| Authored implementation roots | 2,669 | same | same |
| Charged activation jobs | 3,711 | 3,707 | 3,707 |
| Activations with recursion/depth/work cutoffs | 299 | 307 | 307 |
| Activations exceeding 20,000 steps | 227 | 232 | 232 |
| Cutoff jobs taking at least one second | 0 | 0 | 0 |
| Errors / warnings / info | 4,802 / 5,969 / 443 | 5,004 / 6,113 / 452 | 5,028 / 6,447 / 451 |
| **Total diagnostics** | **11,214** | **11,569** | **11,926** |

Node **24.18.0**, TypeScript **6.0.3**, macOS arm64. Trial dependencies remain
**rc.16**, fixture dependencies **rc.17**. Every input hash and compiler option
matches. These are single cold measurements, not an isolated speed estimate; C
was independently running. RSS is worker-only, includes memory outside old-space,
and is not a combined process-group measurement. The earlier scale report's
16.7 s / 2.08 GiB remains historical. Current cold time includes the lexical
coverage scan; charged activation counts describe the dataflow jobs only. No
activation bound was raised.

Raw evidence: [original before](noise-evidence/before.diagnostics.json.gz),
[round one](noise-evidence/after-round1.diagnostics.json.gz),
[current after](noise-evidence/after.diagnostics.json.gz). Full metadata, options,
input hashes and source provenance are in [manifest.json](noise-evidence/manifest.json),
[before.json](noise-evidence/before.json), [after-round1.json](noise-evidence/after-round1.json)
and [after.json](noise-evidence/after.json). `after-alias.*` retains the intermediate
alias-only Node 22 run; it is not used for the matched timing table. The earlier
Node 22 before/after diagnostics matched the round-one Node 24 records exactly.

## Diagnostic counts

| Code | Severity | Original | Round one | Current |
|---|---|---:|---:|---:|
| UNANALYZED_BOUNDARY | warn | 5,566 | 5,690 | 6,005 |
| UNHANDLED_HANDLER_FAILURE | error | 1,859 | 1,948 | 1,964 |
| CONTEXT_PROVIDER_MISSING | error | 5 | 5 | 5 |
| SETUP_MAY_THROW | error | 114 | 125 | 122 |
| PENDING_ASYNC_IN_HANDLER | warn | 403 | 423 | 442 |
| STRICT_READ_UNTRACKED | error | 37 | 37 | 35 |
| PENDING_ASYNC_FORBIDDEN_SCOPE | error | 11 | 11 | 13 |
| REACTIVE_WRITE_IN_OWNED_SCOPE | error | 3 | 3 | 3 |
| PENDING_ASYNC_UNTRACKED_READ | error | 9 | 15 | 15 |
| ASYNC_OUTSIDE_LOADING_BOUNDARY | error | 1,216 | 1,207 | 1,213 |
| ERROR_OUTSIDE_ERRORED_BOUNDARY | error | 1,548 | 1,653 | 1,658 |
| COMPONENT_OBLIGATIONS_EXPORTED | info | 443 | 452 | 451 |

Follow-up removes three false scalar-helper setup findings and one spurious
exported summary. Two settled strict-read findings become pending-scope findings
on compute-form signals; their obligations are preserved. It adds 315 boundary
warnings, 19 pending-handler warnings and 29 errors on unsupported compute-form
signal flows. No finding is filtered, merged or downgraded.

## Fixes and regression pairs

1. **Round-one identity repair.** A local runtime declaration sharing a symbol
   with a type import stays local. TypeScript's shared declaration-free unknown
   alias symbol cannot acquire application bindings. The 1,242 false PendingDevice
   call warnings were 1,242 distinct sites in 333 files, not repeated contexts at
   one site. The real PendingDevice function returns JSX. Unparsed imports remain
   explicit worst-case boundaries.
2. **Round-one direct JSX helpers.** Resolved direct/aliased function calls use
   actual arguments and the caller's scope. Returned JSX introduces normal tracking.
3. **Scalar standalone summaries.** The resolved parameter type must consist
   entirely of scalar alternatives. With no JSX caller, supplied props or widened
   props, the standalone summary binds that parameter as an already evaluated
   ordinary value, rather than inventing a props object. Actual calls still evaluate
   their arguments in the caller. Object props and callable/unknown/mixed types keep
   their existing obligations. Function types are not trusted as failure-free.
4. **Missing boundary coverage.** A lexical authored-source scan reports resolved
   onSettled calls, literal compute-form signal calls and intrinsic literal ref
   arrays even in unvisited returned functions or beyond an activation cutoff.
   It does not execute their callbacks, invent their phase or claim their bodies
   were checked. Reached compute-form signal tuple members now retain worst-case
   facts; ordinary supported signal tuples are unchanged. Existing reached
   onSettled/ref-array paths retain their conservative facts and failures.

[noise.test.mjs](noise.test.mjs) now has **13 tests**. The six follow-up tests add:

| Negative control | Paired positive / preserved obligation |
|---|---|
| Exported string JSX helper, scalar alias and optional scalar union | Explicit setup throw and throwing rendered helper body still report |
| Scalar helper called from JSX with a settled signal argument | Moving argument read to setup reports strict read; pending argument needs Loading |
| Known scalar methods | Callback parameter still carries unknown failure; reactive object props still report |
| Capture-only ref in a returned renderer | Literal intrinsic ref array has an explicit partial boundary |
| Local same-spelled onSettled lookalike | Resolved imported alias in unvisited renderer warns |
| Ordinary supported createSignal setup | Literal compute signal warns in an unvisited body; reached result still needs Loading and Errored |

The earlier seven tests retain alias identity, safe/injected callback, imported
unknown-result boundary, direct/aliased JSX helper and JSX-returning handler pairs.
No shared corpus expectation or pin changed. No name/path-specific checker rules,
new failure-free callback contracts, suppressions or relaxed work limits.

## Root causes and correlated obligations

[Root-cause evidence](noise-evidence/root-causes.json) partitions every record by
visible origin, not merely by code. Missing exact provenance stays explicitly
unresolved; proximity to a warning is not proof of causation.

| Direct root-cause stratum | Original sites | Round one | Current |
|---|---:|---:|---:|
| Missing declaration / returned shape | 8 | 1,445 | 1,445 |
| Deferred Solid API / ownership semantics | 1,077 | 1,138 | 1,406 |
| Unchecked implementation import / re-export | 1,294 | 1,294 | 1,294 |
| Object / prop / indexing / mutation / escape semantics | 1,102 | 1,105 | 1,105 |
| Recursion / depth / work cutoff | 302 | 310 | 310 |
| Unresolved render / provider / call shape | 403 | 257 | 257 |
| Other unsupported syntax / callback shape | 138 | 141 | 188 |
| Confirmed alias identity defect | 1,242 | 0 | 0 |
| **Direct warning sites** | **5,566** | **5,690** | **6,005** |

The 1,294 import sites remain **1,258 imports + 36 re-exports**. Current warnings
include 1,319 missing-result-shape sites, 126 missing declarations, 494 onSettled
sites, 68 literal compute-form signal sites and 47 newly exposed ref arrays.
Follow-up warning growth is +205 onSettled, +68 compute-form, +47 ref arrays,
minus five old module-signal warnings replaced by compute-form warnings. One
recursion/work-limit reason changes category without changing their total.
Installed bodies remain outside authored analysis; all current primary locations
are under `app/src`. No additional implementation root was loaded.

| Downstream / candidate stratum | Original | Round one | Current |
|---|---:|---:|---:|
| Downstream obligations | 5,165 | 5,387 | 5,432 |
| Supported scope/write candidates needing source review | 35 | 35 | 33 |
| Missing-provider candidates on modeled paths | 5 | 5 | 5 |
| Exported summaries, with potentially overlapping origins | 443 | 452 | 451 |

Current downstream strata include 3,559 unknown-failure records, 1,075 source-read
records and 480 prop-flow records without complete retained origins. A supported
scope candidate is not automatically a proven application error. D-129 unknown
failure obligations remain mandatory.

Exact duplicate code/location records remain **zero**. Pending/failure pairs
share 1,199 current sites (1,194 in round one); warning/error colocations number
183 (182 before). These are distinct obligations or correlated cascades, not
findings to delete. Raw records retain their independent locations and severity.

## Source traces and refreshed review

- `pages/devices/view-inventory.tsx:23,667` type import + local function -> shared
  unknown alias -> unrelated `app/browser-http.ts:4` call: repaired in round one;
  the import at `browser-http.ts:1` remains opaque.
- `pages/agents-home/claws-trust-warning.tsx:45` scalar warning ->
  `parseClawHubAudit` -> native trim at `:12`: **false setup finding removed**.
  The helper's separate `title -> t -> projection.read -> Translate.this.locale`
  path still reports unknown at `i18n/lib/translate.ts:230` and retains exported
  obligations at the helper's `:45`. The whole helper is not declared safe.
- `chat-composer-slash-menu-dom.tsx:25,26` scalar name -> toLowerCase and slice,
  and `pages/plugins/plugin-card.tsx:50` scalar author -> replace: the same generic
  fix removes their false standalone obligations.
- `lib/reactive/i18n.ts:47` -> projectSource -> module signal/memo at
  `lib/reactive/projection.ts:79,111` -> observe at `:126,128`: partial module-state
  facts continue to explain conservative translation obligations.
- `app-navigation.ts:362` dynamic table -> hand-off at `portals-page.tsx:629`;
  `browser-tab-card.tsx:80` store -> keyed failedImages at `:257`: unsupported
  indexing/store cascades remain.
- New reviewed compute-form chains: `chat-details.tsx:101 -> :115` choice;
  `board-widget-cell.solid.tsx:120 -> :131` bodyError; `website.tsx:17 -> :35`
  activated; `youtube-video-card.tsx:20 -> :141` setPlaying;
  `chat-question-answer-controls.tsx:192 -> :219` setRevealed;
  `session-menu-details-solid.tsx:54 -> :101` query. Their new failures/pending
  facts are required worst cases, not proof ordinary native setters fail.

[review.json](noise-evidence/review.json) contains **53 current errors and 16
silence sites**, each with source location, excerpt, source hash, reason, verdict
and separate contract status. [The round-one review](noise-evidence/review-round1.json)
is retained unchanged. Its original sample used fixed quotas across all nine
error codes, with evenly spaced changed/new and unchanged source locations.

Follow-up keeps 44 surviving records, replaces resolved E13 with the helper's
remaining translation obligation, and reviews eight new affected records (first
two new raw records in each of forbidden-scope, pending-root, handler-failure and
error-root). Of 53 current records, 44 are unchanged from round one, eight are new
and one has a changed explanation. Original E13 is separately archived under
`resolvedFindings`, not silently relabeled or dropped.

| Code | TP | FP | Unsure |
|---|---:|---:|---:|
| UNHANDLED_HANDLER_FAILURE | 4 | 0 | 8 |
| SETUP_MAY_THROW | 2 | 0 | 3 |
| STRICT_READ_UNTRACKED | 3 | 0 | 2 |
| PENDING_ASYNC_FORBIDDEN_SCOPE | 0 | 0 | 6 |
| REACTIVE_WRITE_IN_OWNED_SCOPE | 0 | 0 | 3 |
| PENDING_ASYNC_UNTRACKED_READ | 0 | 0 | 4 |
| ASYNC_OUTSIDE_LOADING_BOUNDARY | 0 | 0 | 8 |
| ERROR_OUTSIDE_ERRORED_BOUNDARY | 1 | 0 | 7 |
| CONTEXT_PROVIDER_MISSING | 0 | 0 | 2 |
| **Total** | **10** | **0** | **43** |

Three TPs are supported ref/apply read errors; seven are required unknown-failure
obligations, not observed runtime failures. The many unsure judgments remain a
limit of retained paths/instances/phases. This targeted sample is not a precision
estimate; zero confirmed current sample FPs does not mean the app has none.

All 16 reviewed silences are locally justified now. S04 (`link-reader-preview-root.tsx:28`),
S14 (`:34`), S10 (`session-menu-snooze.tsx:108`) and S12 (`:147`) now have explicit
boundaries. They remain unsupported. S16 records the corrected trim site. Capture
refs stay clean; other silences have explicit boundaries or propagated module
obligations. No execution or ownership safety is inferred from a lexical warning.

## Validation and remaining limits

- Capped Node 24 `node harness/run.mjs`: B and unchanged C pass **173 fixtures**
  with zero crashes, misses or extra errors/warnings. B detects **58/58 mutants**;
  required warning/info, locations and code-table checks pass.
- Then capped `pnpm test --maxWorkers 1`: **21 files / 333 tests passed**.
  Standalone B noise tests: **13/13 passed**. Every heavy job has a timeout and
  process-group cleanup; none remains pending.
- No OpenClaw code, tests, scripts, builds or hooks executed. Input was read and
  parsed only. `results/latest.*` remain uncommitted.

Unresolved: total noise has not fallen; exact causal provenance is incomplete;
returned renderer execution, onSettled ownership, ref-array dispatch/cleanup,
derived signal behavior and writes remain unsupported. The coverage scan handles
resolved API references, literal compute arguments and intrinsic literal ref
arrays, not every indirect or mutable shape. Stores, spreads, indexing, module
state and work cutoffs remain partial. Selective semantic updates are unchanged.
No whole-app soundness or broad precision claim follows from these checks.

Trusted tools are `scale/dataflow-noise-run.mjs` (one capped 120 s worker),
`dataflow-noise-bound.py` (serial capped tests) and `dataflow-noise-summary.py`
(partition/review checks). To reproduce original before, copy B's seven `.mjs`
implementation files from `f38b2bc` into a temporary sibling `prototypes/_noise-before/`,
set `SOUND_NOISE_CHECKER=../prototypes/_noise-before/index.mjs`, and run the driver
with explicit Node 24 and label `before`. Current B uses label `after`. Remove the
snapshot afterward. Baseline hashes remain in the manifest. Shared scale scripts
are unchanged.
