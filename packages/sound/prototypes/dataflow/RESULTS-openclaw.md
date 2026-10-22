# Dataflow — OpenClaw results

Measured 2026-10-22 from base `5b967a1` on `solid-sound-dataflow-oc`, Node
24.18.0, macOS, Solid/@solidjs/web 2.0.0-rc.17. Only prototype B and its
OpenClaw score pins changed. The TypeScript-AST interpreter and value lattice
remain the checker; TypeScript is still only a lookup oracle.

## Frozen suite

Counts are expectation entries, not raw diagnostic counts. Hits/misses below
combine required errors and warnings; extras count emitted errors/warnings.
The first five rows are disjoint and cover all 143 fixtures.

| Group | Fixtures | Hit | Miss | Extra | Error hits | Warning hits |
|---|---:|---:|---:|---:|---:|---:|
| OpenClaw | 34 | 17 | 0 | 0 | 17 | 0 |
| Context cases | 29 | 19 | 0 | 0 | 16 | 3 |
| Original cases | 52 | 29 | 0 | 1 | 24 | 5 |
| Equipment Checkout | 1 | 5 | 0 | 0 | 3 | 2 |
| Mutants group | 27 | 28 | 0 | 0 | 27 | 1 |
| **All** | **143** | **98** | **0** | **1** | **87** | **11** |

Context cases plus their 12 mutants: 31 / 0 / 0 across 41 fixtures. Original
slice cases plus their 15 mutants, excluding Equipment: 45 / 0 / 1 across 67.

- In-subset soundness failures: **0**, including required warnings.
- Mutants missed: **0 / 43** (OpenClaw 0 / 16; old mutants 0 / 27).
- All 18 clean OpenClaw controls emit no errors or warnings.
- Required info: **5 / 5**, no misses. Three unrequired info findings remain
  on handled-catch, finally-nested-function and native-optimistic-store-basic,
  unchanged from the context baseline. They are not error/warning extras.
- Imprecise hits, crashes, leaked generated names, unmapped locations and codes
  outside the shared table: **all zero**.
- Equipment emits exactly **10 errors and 2 warnings**, all expected.

OpenClaw improves from **9 / 8 / 6** to **17 / 0 / 0**. All-suite results improve
from **90 / 8 / 6** to **98 / 0 / 1**. No prior expected error, warning or info
was lost. The one new legacy error is the D-131 conflict below, not hidden by
a relaxed pin or a source-specific exception.

## Extras and dispute

All six former OpenClaw extras are fixed: the pending setup prop error now
includes its required caller location, four broad ref warnings are gone, and
the pending ref read uses the required setup-like error rather than a handler
warning. No OpenClaw extra needs a soundness justification.

The sole remaining scored extra is STRICT_READ_UNTRACKED at `n()` in
`fixtures/cases/ref-event-reads.tsx:1:117`. Its frozen old expectation treats
ref reads as handler reads. D-131 explicitly requires setup-like read errors
in refs. Removing this finding would conceal a required read just like the
new ref mutants. This is an unavoidable scored mismatch under the frozen
expectations, not a false positive under D-131. **DISPUTES.md** records the
conflict and a passing prototype-local rc.17 runtime probe: the ref runs once,
its observer is nullish, and later signal changes update JSX but not the ref.
rc.17 emits no warning here because refs are intentionally untracked.

The legacy required partial-check warning is retained for reactive writes in
refs: ownership of those writes is still deferred. The write result is worst
case. DOM node capture and assignment alone need no warning. There are no
other new findings on older groups. No frozen expectation was edited.

## Changes

- Effect apply/helper reads of settled reactive values now report strict-read
  errors. Forwarded compute values stay plain.
- Setup/effect prop read errors retain related caller locations.
- Named and aliased untrack callbacks are analyzed; project failures and
  owned-scope write checks still apply. A local catch still handles failures.
- For row bodies use setup-like reads, returned JSX tracks, and held item/index
  parameters are kept separate from accessors. Show callbacks remain tracking.
- Refs use setup-like reads but callback failure handling; ref write ownership
  remains a partial-check boundary instead of a guessed setup-write error.
- Existing lazy prop demand and branch-local Promise rejection facts were
  already correct; added controls protect them.
- Ten changed OpenClaw score entries were tightened only for dataflow.

## Checks and timings

Run sequentially after implementation: `node harness/run.mjs`, then
`node harness/vite-measure.mjs dataflow --runs 5`, then `pnpm test`. All exited
0. The full harness includes unchanged other prototypes and the null control;
the scores above are B only. Tests: **217 passed in 10 files**, 50.78 s.
Production JS also passes TypeScript checkJs with explicit Node types.

| Measurement | Time (ms) |
|---|---:|
| Cold cases: sum of per-fixture medians, 81 programs, 3 runs | 8807.0 |
| Cold mutants: sum of per-fixture medians, 27 programs, 3 runs | 3053.3 |
| Cold Equipment, median of 3 | 166.2 |
| Cold OpenClaw: sum of per-fixture medians, 34 programs, 3 runs | 3826.8 |
| Incremental EquipmentRow: trivial edit | 58.7 |
| Incremental EquipmentRow: semantic edit | 59.5 |
| Vite plain cold build, median of 5 | 30 |
| Vite strict build with checker, median of 5 | 197 |
| Vite checker itself, last strict run | 173 |
| Vite report-only completed build | 189 |
| Vite dev entry transform | 25 |
| Vite HMR re-check, median of 5 edits | 50.3 |

Incremental errors before / after trivial / after semantic: **10 / 10 / 10**.
Strict Vite builds fail on the 10 expected errors; report-only builds complete.
Both see 2 expected warnings. HMR keeps the same 10 errors.

## Size and remaining gaps

Against `5b967a1`: production `analyze.mjs` **+60 / -35 = +25 lines**
(1763 → 1788); `values.mjs` and the other production files are unchanged.
New local tests: **112 lines**, 11 analysis tests and 1 runtime test.
Score pins: **+53 / -130 = -77 lines**. Documentation is counted separately.

Known limits remain in NOTES.md: no general mutable-heap or recursive-argument
fixpoint, bounded helper expansion, conservative branches, dynamic defaults
without a full value model, no cross-project owner facts, and deferred ref
ownership/cleanup/primitive creation and FUTURE.md rules. No universal
soundness claim follows from passing this finite suite.

No results/latest.* or COMPARISON.md changes are part of the commit.
