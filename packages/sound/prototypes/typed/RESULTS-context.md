# Typed prototype — context/services results

Measured 2026-10-22T14:07:58.461Z; base `ddeafcb`, implementation commits `2dcfe26` and `cc64276`. No shared fixtures, harness, codes, other prototype, or COMPARISON.md were edited. This report does not select an IR.

## Checks

Counts below are expectation entries, not raw diagnostics. A grouped entry can require several findings. Warning columns are hit / miss / extra.

| Group | Fixtures | Error hit | Error miss | Extra errors | Warnings H / M / E |
|---|---:|---:|---:|---:|---:|
| All | 109 | 70 | 0 | 0 | 11 / 0 / 2 |
| Original cases | 52 | 24 | 0 | 0 | 5 / 0 / 2 |
| Context cases | 29 | 16 | 0 | 0 | 3 / 0 / 0 |
| Original mutants | 15 | 16 | 0 | 0 | 0 / 0 / 0 |
| Context mutants | 12 | 11 | 0 | 0 | 1 / 0 / 0 |
| Context only (cases + mutants) | 41 | 27 | 0 | 0 | 4 / 0 / 0 |
| Equipment | 1 | 3 | 0 | 0 | 2 / 0 / 0 |

- Soundness failures: **0**.
- Mutants caught: **27/27**, including **12/12 context mutants**.
- Info expectations: 5 hit, 0 missed.
- Imprecise locations: 0; leakage: 0; unmapped: 0; unknown codes: 0; crashes: 0.
- Extra warnings: native-optimistic-store-basic: PENDING_ASYNC_IN_HANDLER (outside subset); event-updater: PENDING_ASYNC_IN_HANDLER (outside subset). They retain worst-case facts for unsupported store values; the shared expectations were not weakened to hide them.

## Equipment

10 actual errors across 3 grouped expectation entries; 2 expected pending-handler warnings, 0 missed error entries, 0 extra errors. The ten source files are unchanged. The two row-handler holes remain; caught commit methods and settled notice/revision/reload stay clean.

## Timing

Commands ran sequentially in packages/sound, with no concurrent checks:

```sh
node harness/run.mjs
node harness/vite-measure.mjs typed --runs 5
pnpm test
```

Harness: 3 runs; cold cases **19520.7 ms**, mutants **6864.9 ms**, Equipment **421.8 ms**. Incremental Equipment trivial / semantic edit: **240.3 / 216.0 ms**; error counts before / trivial / semantic: 10 / 10 / 10.

Vite (five runs): plain build **28.6 ms**, plugin build **463.2 ms**; reported strict check **458.7 ms**. Strict build fails on errors: true (10 errors, 2 warnings). Report-only build: **448.4 ms**. Dev entry transform **38.8 ms**; HMR recheck median **188.1 ms** (10 errors after edit).

### Why cases got slower

The earlier 11.3 s case total covered 52 cases; the new roughly 20 s total covers 81, a 56% larger workload. On this final run, sums of per-fixture median checks are **12369.6 ms for the 52 original cases** and **7151.1 ms for the 29 context cases**. These sums need not equal the median of whole-group runs.

There is also more work per check: the original and virtual TS programs are still both built; the virtual program now substitutes service-member and lazy-prop facts, keeps read-site unions, and unfolds recursive component references. Findings are read as structured TS properties rather than parsed abbreviated error text. Symbol/alias discovery and the recursive-edge pass also run again on edits. There is no per-component cache. The runs do not separately time each of those costs, so no exact per-phase share is claimed. The older timing is not a controlled same-machine before/after benchmark.

## Tests

Command exits: harness 0, Vite 0, pnpm test 1.

```text
 Test Files  1 failed | 2 passed (3)
      Tests  1 failed | 21 passed (22)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  test/harness.test.mjs > the prototypes on the slice > dataflow: no soundness failure, no leakage, only table codes
AssertionError: dataflow / context-missing-provider: expected [ { …(4) } ] to deeply equal []
```

The typed fixture test and the ten local context tests pass. The frozen dataflow prototype still fails its context-missing-provider check; it was not changed as part of this worker.

## Size

Physical production code/declaration lines: **2282**, versus 1,498 at `ddeafcb` (**+784**). Local tests: **111** new lines. Combined code/declarations/tests: **2393 (+895)**. Documentation and generated files are excluded.

## Approach, gaps and disputes

TypeScript remains the checker. The source pass supplies declaration identity, scope, dependency expressions and inferred throws; typed facts handle member substitution, nearest providers, lazy props, read locations and boundary discharge. No dataflow engine is called and no user source is rewritten on disk.

No expectation is disputed or changed. Known gaps: bounded helper/promise analysis and recursive expansion; conservative related caller locations; detached callbacks do not yet share escape taint with sibling consumers (the escape warns and local aliases remain worst case); unsupported dynamic/storage forms; no per-component cache. See NOTES.md.
