# C — oxc: results

Measured 2026-10-22 on macOS arm64, Node 24.18.0, pnpm 11.20.0, Solid rc.17.

## Shared scores

All 109 fixtures pass their required diagnostics. No in-subset soundness failures, missed mutants, crashes, imprecise locations, unmapped locations, message leakage or code-table violations. No extra errors or warnings. There are 3 extra info-only exported-obligation notices from partial checks, in addition to all 5 required info findings.

Hits below count expectation groups, as the harness does. Some groups require several locations: 70 error groups consume 86 error diagnostics. The 11 required warnings all hit. Context-only means the 29 context cases and 12 context mutants, excluding Equipment.

| group | fixtures | error hit/required | warning hit/required | extra error/warn | soundness failures | inference-needed sites |
|---|---:|---:|---:|---:|---:|---:|
| all | 109 | 70/70 | 11/11 | 0/0 | 0 | 46 |
| cases | 81 | 40/40 | 8/8 | 0/0 | 0 | 20 |
| contextCases | 29 | 16/16 | 3/3 | 0/0 | 0 | 8 |
| mutants | 27 | 27/27 | 1/1 | 0/0 | 0 | 13 |
| contextMutants | 12 | 11/11 | 1/1 | 0/0 | 0 | 2 |
| context | 41 | 27/27 | 4/4 | 0/0 | 0 | 10 |
| equipment | 1 | 3/3 | 2/2 | 0/0 | 0 | 13 |

All 27 mutants meet every required error/warning, including the 12 context mutants. Equipment produces exactly 10 errors (2 row-handler failures and 8 injected-API control-handler failures) and 2 pending-handler warnings. Its 3 error expectation groups and both warning groups hit, with no extras. No disputes or frozen-file changes.

## Timings

The shared harness ran all A/B/C/null prototypes with its default 3 cold runs. C's Equipment cold wall time was 6.97 ms. Its incremental trivial/semantic updates were 3.58 / 3.76 ms. Error counts stayed 10 / 10 / 10; this harness's semantic edit did not add an error in the context version of Equipment.

A separate 5-run measurement used fresh checker instances for each run (parser module already imported). Medians: all fixtures sum 45.93 ms; 81 cases sum 27.26 ms; context-only sum 18.40 ms; Equipment 8.35 ms. Median fixture cold check 0.365 ms. These are not process-start/import timings.

Vite, 5 runs:

| measurement | ms |
|---|---:|
| plain cold build | 26.96 |
| strict plugin build (stops early on errors) | 13.54 |
| plugin's own cold check | 8.89 |
| report-only full build | 33.59 |
| dev entry transform | 28.13 |
| HMR recheck median | 3.75 |

Strict build fails as required; report-only completes; cold reports 10 errors/2 warnings; HMR keeps 10 errors. The strict build stops before compilation, so it must not be compared as a full build against plain Vite. The full report-only sample adds about 6.63 ms. Canonical paths prevent /var and /private/var from creating duplicate modules in Vite's scratch app.

## Tests and reproducibility

- pnpm install --frozen-lockfile --prefer-offline: passes, including a second run after adding Oxc.
- node harness/run.mjs: completes; C has zero soundness failures. The unchanged A/B baselines have 22/17 soundness-failing fixtures; null has 62.
- node harness/vite-measure.mjs oxc --runs 5: completes.
- pnpm test: 131 passed, 2 failed. The failures are the existing typed/dataflow slice checks in test/harness.test.mjs. Frozen prototypes were not changed.
- C-only tests: 120 passed (109 fixtures, static import scan, TypeScript-blocked child process, and 9 independent analysis/update checks).
- node prototypes/oxc/measure.mjs regenerates measurements.json: per-fixture cold medians and inference-needed counts/reasons. harness-measurements.json preserves the relevant shared-harness/Vite evidence. results/latest.* is not committed.

## Size and dependencies

Physical source lines (including comments/blank lines): checker + standalone Vite wrapper 1,732; measurement driver 79; C tests 207; total 2,018. No code was copied from A/B or the generator packages.

C adds oxc-parser 0.155.0 and oxc-resolver 11.24.2. On this machine they install five packages, including @oxc-project/types 0.155.0 and the two Darwin-arm64 native bindings. Both direct packages are MIT licensed. No release-age exception was needed. The shared TypeScript dependency remains solely for the existing prototypes/harness; C's checker and standalone wrapper run with it blocked.

| installed package | logical bytes | disk KiB |
|---|---:|---:|
| oxc-parser | 2,919,634 | 2,936 |
| oxc-resolver | 61,406 | 76 |
| parser Darwin-arm64 binding | 1,794,990 | 1,764 |
| resolver Darwin-arm64 binding | 1,581,462 | 1,552 |
| @oxc-project/types | 44,596 | 56 |
| total | 6,402,088 (6.11 MiB) | 6,384 (6.23 MiB) |

Sizes exclude unrelated pre-existing Oxc versions and optional binaries for other platforms. pnpm sharing/filesystem compression affect physical installation cost.

## Inference needed / worst case, per fixture

A count is a distinct source-location/reason pair in that check, not the number of dynamic activations. All counted sites use worst-case facts; annotations never promise failure-freedom. Total 46; context-only 10; Equipment 13. Full locations/reasons are in measurements.json. General limits are in NOTES.md.

| fixture | sites |
|---|---:|
| context-plain-object | 0 |
| context-default | 0 |
| context-missing-provider | 0 |
| context-provider-over-default | 0 |
| context-signal-view | 0 |
| context-signal-setup | 0 |
| context-factory-memo | 0 |
| context-helper-alias | 0 |
| context-method-view | 0 |
| context-method-setup | 0 |
| context-async-covered | 0 |
| context-async-uncovered | 0 |
| context-async-setup | 0 |
| context-pending-handler | 0 |
| context-failing-memo-covered | 0 |
| context-failing-handler | 0 |
| context-promise-caught | 0 |
| context-promise-uncaught | 0 |
| context-optional-api-caught | 2 |
| context-optional-api-uncaught | 2 |
| context-injected-sync | 1 |
| context-nested-shadow | 0 |
| context-provider-identity | 0 |
| context-module-escape | 1 |
| context-unknown-escape | 2 |
| context-prop-child-boundaries | 0 |
| context-prop-caller-boundaries | 0 |
| context-prop-uncovered | 0 |
| context-method-write-handler | 0 |
| counter | 0 |
| props | 0 |
| inline-event | 0 |
| named-event | 0 |
| catch | 0 |
| callback-read | 0 |
| setup-read | 0 |
| return-ternary | 0 |
| return-and | 0 |
| return-null | 0 |
| named-callback-in-setup | 0 |
| array-callback-in-setup | 0 |
| getter-read-in-setup | 0 |
| memo-write | 0 |
| untrack-in-every-host | 0 |
| reader-helpers | 0 |
| props-interface-live | 0 |
| props-accessor-callers | 0 |
| callback-prop-forwarded | 0 |
| recursion-failing-prop | 0 |
| async-memo-reads | 0 |
| async-memo-nested-function | 0 |
| async-event-reads | 0 |
| async-read | 0 |
| colored-prop | 0 |
| promise-catch | 0 |
| pending-root | 0 |
| iife-pending-root | 0 |
| async-setup-reads | 0 |
| native-latest-pending | 2 |
| native-for-indexed | 1 |
| throw-error | 0 |
| promise-event | 0 |
| handled-catch | 0 |
| rethrow-catch | 0 |
| unknown-rethrow-catch | 0 |
| finally-nested-function | 0 |
| plain-callback-throw-under-errored | 0 |
| plain-callback-throw-in-memo | 0 |
| effect-reads-failing-memo-at-root | 0 |
| foreign-route-failure | 0 |
| setup-promise-caught | 0 |
| setup-promise-rejects | 0 |
| callback-prop-throws | 0 |
| callback-prop-unseen | 3 |
| async-handler-destructured-uncaught | 0 |
| kept-promise-rejects-at-its-await | 0 |
| kept-promise-caught-by-its-chain | 0 |
| timer-callback-failure | 1 |
| native-optimistic-store-basic | 2 |
| event-updater | 2 |
| ref-event-reads | 1 |
| equipment-checkout | 13 |
| m-context-loading-removed | 0 |
| m-context-errored-removed | 0 |
| m-context-catch-removed | 0 |
| m-context-optional-catch-removed | 2 |
| m-context-provider-removed | 0 |
| m-context-default-removed | 0 |
| m-context-shadow-removed | 0 |
| m-context-alias-setup | 0 |
| m-context-method-write-memo | 0 |
| m-context-prop-child-loading-removed | 0 |
| m-context-prop-child-errored-removed | 0 |
| m-context-read-to-handler | 0 |
| m-loading-removed | 0 |
| m-errored-removed | 0 |
| m-catch-removed | 0 |
| m-read-moved-to-setup | 0 |
| m-write-in-memo | 0 |
| m-reactive-prop-read-in-setup | 0 |
| m-handled-catch-rethrows | 0 |
| m-async-helper-rejects | 0 |
| m-pending-through-prop | 0 |
| m-pending-read-in-setup | 0 |
| m-callback-prop-throws-forwarded | 0 |
| m-effect-phase-pending | 0 |
| m-injected-api-ambient | 6 |
| m-injected-api-prop | 4 |
| m-equipment-row-loading-removed | 1 |
