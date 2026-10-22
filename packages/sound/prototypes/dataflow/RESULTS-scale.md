# Dataflow scale pass

## Outcome

B completes the full 2,669-root OpenClaw input under a 2,048 MiB Node old-space
cap. This is a **partial check**, not full coverage: unchecked implementation
imports are explicit unknown boundaries, and expensive activations can stop with
unknown pending reads and failures. No checked root was removed.

**The requested selective semantic updates are not implemented.** Changes to
printed syntax still recheck every root. Only unchanged-syntax edits reuse the
previous result and move its locations. This pass improves cold checking and
trivial edits, but does not meet the semantic-update target.

## Final measurements

| Goal | Final result | Status |
|---|---|---|
| Full input under 60 s with capped old-space | 16.71 s check; 17.04 s process wall | Met, partial coverage |
| Trivial updates under 500 ms | 40.2–49.2 ms | Met on these edits |
| Semantic updates under 500 ms | 15,407.8–15,728.5 ms | Not met |
| Selective semantic invalidation | All 2,669 roots reanalyzed | Not implemented |
| File work below 2 s or explicit partial result | Largest charged file 134.5 ms | Observed; cooperative bounds only |
| Frozen expectations and mutants | 173 fixtures clean; 58/58 mutants detected | Met |

### Time and memory

- Cold checker creation: **44.9 ms**; `check`: **16712.2 ms**.
- Cold worker OS peak RSS: **2.08 GiB** (2229714944 bytes).
- Sampled worker group peak: **1.98 GiB**; with measuring driver: **2.12 GiB**.
- Conservative cold upper estimate using worker OS peak plus observed driver/wrapper peaks: **2.21 GiB**.
- Serial update run: worker OS peak **2.33 GiB**; sampled group plus driver **2.46 GiB**. Both cold and update workers exited normally with no timeout.

The full input is 524,547 LOC: 6,082 candidate TypeScript files, 3,413 excluded
by the trial rules, and 2,669 checked roots. The bounded program has 3,114 source
files: 2,669 roots, 382 other declarations and 63 TypeScript library files.

### Three in-memory edit pairs

| File under app/src | Trivial ms | Semantic ms | Semantic reanalysis |
|---|---:|---:|---:|
| `components/theme-brand-icon.tsx` | 43.5 | 15728.5 | 2669 roots |
| `lib/reactive/i18n.ts` | 40.2 | 15527.2 | 2669 roots |
| `app/app-root.tsx` | 49.2 | 15407.8 | 2669 roots |

Trivial edits append a newline; semantic edits flip a Boolean syntax node (or
append an unused constant if none exists). Each is followed by a restore. All
trivial edits reanalyzed zero roots. A syntax change that does not affect the
exported interface still causes a full check; that is the missing design.

The `MultiSelect` component job took 39.0 ms and `ShellSettingsSidebar` 22.8 ms;
both were partial. These exclude shared program creation and other jobs.

### Memory attribution

The final unbounded program-only probe aborted after 6.61 s, at OS peak
2.24 GiB. Its last checkpoint had 12,600 loaded files: 12,153 unchecked
sources/data (87,045,113 characters), 215 checked roots, 226 declarations and six
compiler library files. This is a failing load checkpoint, not a complete inventory.

| Separate bounded profile checkpoint | Retained heap MiB after GC |
|---|---:|
| program | 598.7 |
| type-checker | 765.9 |
| analysis-complete | 1354.9 |
| analysis-released | 1102.6 |

Releasing B while keeping the program and diagnostics removes about **252.2 MiB**.
The remaining heap exceeds the bound-program checkpoint by about **336.7 MiB**; it includes
demand-created TypeScript caches and retained diagnostics. Final type count is
226949 with 379817 instantiations. These are retained-state measurements, not exact
per-subsystem allocation totals.

### Full-app diagnostics

The completed partial check reports **11214 diagnostics**. These counts are not
a precision score; unknown boundaries deliberately carry conservative obligations.

| Code | Severity | Count |
|---|---|---:|
| `UNANALYZED_BOUNDARY` | warn | 5566 |
| `UNHANDLED_HANDLER_FAILURE` | error | 1859 |
| `CONTEXT_PROVIDER_MISSING` | error | 5 |
| `SETUP_MAY_THROW` | error | 114 |
| `PENDING_ASYNC_IN_HANDLER` | warn | 403 |
| `STRICT_READ_UNTRACKED` | error | 37 |
| `PENDING_ASYNC_FORBIDDEN_SCOPE` | error | 11 |
| `REACTIVE_WRITE_IN_OWNED_SCOPE` | error | 3 |
| `PENDING_ASYNC_UNTRACKED_READ` | error | 9 |
| `ASYNC_OUTSIDE_LOADING_BOUNDARY` | error | 1216 |
| `ERROR_OUTSIDE_ERRORED_BOUNDARY` | error | 1548 |
| `COMPONENT_OBLIGATIONS_EXPORTED` | info | 443 |

Largest partial-check reasons (the compact evidence lists every reason):

| Construct | Warnings |
|---|---:|
| `unchecked source import` | 1258 |
| `calling the component PendingDevice as a function` | 1242 |
| `a mutation of an object member` | 541 |
| `a spread into a component's props` | 332 |
| `onSettled(…)` | 280 |
| `recursive/deep or bounded function call` | 241 |
| `an unresolved provider or component` | 239 |
| `a dynamic service member` | 207 |
| `createOptimistic(…)` | 118 |
| `createMemo outside a component's setup` | 118 |
| `action(…)` | 94 |
| `onCleanup(…)` | 74 |

### Final validation

- Default `node harness/run.mjs`: B has **173 fixtures, zero soundness failures,
  zero misses, zero extra errors or warnings**, and all **58 mutants detected**.
  Required warnings/info, locations, code-table checks and dependency isolation
  have zero failures. No checker crashed.
- `pnpm test --maxWorkers 1`: **19 files / 308 tests passed**, including eight
  new scale tests. Frozen expectations and score pins were not edited.


## Method and safety

Measured on branch `solid-sound-dataflow-scale`, base `05df715`, macOS arm64,
Node 24.18.0 and TypeScript 6.0.3. The read-only trial app uses Solid
2.0.0-rc.16. The fixture package uses its existing rc.17 dependencies.

The input selection and compiler options follow the trial driver. All 2,669
selected roots remain checked; tests, declarations, stories and the trial's
support directories remain excluded. Application text was only read and parsed.
No application modules, scripts, tests, builds, hooks or plugins ran. Edits were
served from memory and restored; no application file was written.

Measurements ran serially, with at most one checker process at a time. The cold
and update workers use `--max-old-space-size=2048`, under macOS `/usr/bin/time`.
The driver samples the worker process group every 250 ms and records its own RSS
separately. There is no native checker child. Sampled peaks can miss short spikes;
the OS worker peak and an upper estimate including the observer are also shown.
The old-space cap is **not** a 2 GiB RSS cap.

Each final measurement is one run, not a median or a stable performance promise.
The separate memory-attribution run forces GC at its checkpoints and therefore
is not the cold timing run. `../../scale/README.md` gives the commands;
`../../scale/evidence/measurements.json` contains the compact measurements,
including full diagnostic counts, partial-check reasons and program counts.

## Why memory grew, and why TS 6 stays

The original import closure exhausts the capped heap **during program creation**,
before B can construct analysis facts. The load checkpoints separate checked
roots, unchecked sources, declarations and compiler libraries. Unchecked source
imports dominate that failing load. This establishes the first full-app failure's
cause; it does not explain every singleton failure in the earlier trial.

The bounded compiler host resolves checked roots and declarations, but does not
recursively load unchecked implementation files. Such imports and re-exports
warn and retain unknown values, including namespace aliases and absent
declarations. Installed declaration types remain available; installed bodies
still do not become analysis roots. Listing a source among the checked roots
adds coverage. This trades type precision for explicit partial checking; it is
not declaration generation and must not be presented as equal coverage.

The separate TS 7 spike reports faster small checks, but its full OpenClaw check
timed out at 90 seconds with about 6.5 GiB combined RSS. Its microbenchmark used
about 2.7 GiB. Switching engines does not remove B's repeated calls or this broad
import graph. TS 6 was retained so this pass could address those measured costs
without adding another backend. These older TS 7 numbers are context, not a
matched comparison with the new bounded host.

After binding, TypeScript also retains demand-created symbols, types and generic
instantiations. The profile keeps the program and diagnostic records alive when
it releases B's state: the heap difference estimates B's retained maps and facts,
not all allocations or TypeScript's share exactly.

## Changes to B

- Function and component activations no longer copy the entire module binding
  map; existing lookup falls back to that map. Captured local bindings stay local.
- Location, short text, symbol and Solid API lookups are cached within their
  analysis/program lifetime. Identical component facts are retained once.
- Root reporting skips a site already reported before rebuilding its AST lookup
  and message. It preserves the existing first diagnostic at that site.
- Each outer module/component job shares a 20,000-step or one-second budget
  with its nested calls and views. A stopped activation warns and retains unknown
  pending/read/failure facts instead of returning a safe empty result.
- A recursive component cycle closes only when supported held/forwarded-source
  inputs match the facts captured before setup, providers match and no observed
  mutation invalidates them. Changed or unsupported inputs use the unknown
  fallback. Ordinary recursive function calls remain partial.
- Updates compare valid printed syntax and a SHA-256 hash, including private
  bodies, JSX text, automatic semicolon effects and reference directives. Exact
  shape equality is required; the hash alone does not establish equality.
- Unchanged syntax copies previous diagnostics/facts and moves original-source
  locations. Earlier results are not mutated. An unmappable location forces a
  real check. Imported declaration updates also preserve full-check fallback.

The public `createChecker/check/update/dispose` shape remains available. Added
result fields show invalidated and actually reanalyzed roots, job timings, program
counts and update summary hashes. These hashes describe syntax, **not an inferred
exported interface**. A semantic update reports all roots reanalyzed; no selective
invalidation claim is made. Caller/callee prop changes therefore still receive
a conservative full recheck in both directions.

## Comparison and remaining limits

The read-only trial report records the old full B check aborting with SIGABRT at
8,055 ms and 2,323.61 MiB peak RSS, and its 24-root subset aborting at 6,021 ms and
2,300.03 MiB. An abort is not a faster successful check or an empty diagnostic
result. There is no old completed full-app diagnostic count to compare. The
new warnings and unknown facts must accompany every speed comparison.

The trial's C singleton times and failures are not directly comparable with the
new B per-job times: B shares a preloaded full program. Named jobs in the compact
evidence are charged analysis work, not independent singleton cold checks.

The budget is cooperative. A synchronous TypeScript query cannot be interrupted,
and a file may own several jobs. Observed file times below two seconds do not
prove a hard two-second wall-clock guarantee on other inputs. The requested
semantic dependency graph, exported-summary propagation and sub-500 ms semantic
updates remain future work. Finite fixture success does not establish general
soundness, complete OpenClaw coverage or real-app diagnostic precision.

## Validation

Final default comparison and package test results are recorded with the measured
values above. Fixture expectations, score pins, shared contracts, harness code,
other prototypes and frozen documents were not changed. New B-local tests cover
trivia/location reuse, semantic fallback, declaration updates, syntax-sensitive
hashes, unchecked imports and re-exports, namespace aliases and recursive calls.
