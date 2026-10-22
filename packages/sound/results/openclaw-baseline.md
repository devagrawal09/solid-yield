# OpenClaw baseline (D-131)

Unchanged A=typed, B=dataflow, C=oxc, plus null. 143 total fixtures; 34 in
openclaw (18 clean controls, 16 diagnostic-bearing mutants). Hits/misses count
required error and warning expectations; extras count emitted errors/warnings.
A miss, including a required warning, is a soundness failure. Info misses are
reported separately. No prototype analysis was edited.

## New openclaw group

| Prototype | Hit | Miss | Extra | Soundness failures | Mutants missed | Info misses |
|---|---:|---:|---:|---:|---:|---:|
| typed | 8 | 9 | 7 | 9 | 9 | 0 |
| dataflow | 9 | 8 | 6 | 8 | 8 | 0 |
| oxc | 9 | 8 | 16 | 8 | 8 | 0 |
| null | 0 | 17 | 0 | 16 | 16 | 0 |

## Entire frozen suite

| Prototype | Hit | Miss | Extra | Soundness failures | Mutants missed | Info misses |
|---|---:|---:|---:|---:|---:|---:|
| typed | 89 | 9 | 9 | 9 | 9 | 0 |
| dataflow | 90 | 8 | 6 | 8 | 8 | 0 |
| oxc | 90 | 8 | 16 | 8 | 8 | 0 |
| null | 0 | 98 | 0 | 78 | 43 | 5 |

## typed: failing fixtures

New group: oc-02-effect-prop-phase-mutant, oc-06-promise-forks-mutant, oc-08-lazy-unused-prop-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read, oc-23-ref-read-mutant, oc-23-ref-pending, oc-23-ref-pending-mutant, oc-04-default-without-provider.

All groups: native-optimistic-store-basic, event-updater, oc-02-effect-prop-phase-mutant, oc-06-promise-forks-mutant, oc-08-lazy-unused-prop-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read, oc-23-ref-read-mutant, oc-23-ref-pending, oc-23-ref-pending-mutant, oc-04-default-without-provider.

New mutants missed: oc-02-effect-prop-phase-mutant, oc-06-promise-forks-mutant, oc-08-lazy-unused-prop-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read-mutant, oc-23-ref-pending-mutant.

All mutants missed: oc-02-effect-prop-phase-mutant, oc-06-promise-forks-mutant, oc-08-lazy-unused-prop-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read-mutant, oc-23-ref-pending-mutant.

## dataflow: failing fixtures

New group: oc-02-effect-prop-phase-mutant, oc-09-forwarded-pending-setup-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read, oc-23-ref-read-mutant, oc-23-ref-pending, oc-23-ref-pending-mutant.

All groups: oc-02-effect-prop-phase-mutant, oc-09-forwarded-pending-setup-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read, oc-23-ref-read-mutant, oc-23-ref-pending, oc-23-ref-pending-mutant.

New mutants missed: oc-02-effect-prop-phase-mutant, oc-09-forwarded-pending-setup-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read-mutant, oc-23-ref-pending-mutant.

All mutants missed: oc-02-effect-prop-phase-mutant, oc-09-forwarded-pending-setup-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read-mutant, oc-23-ref-pending-mutant.

## oxc: failing fixtures

New group: oc-02-effect-prop-phase-mutant, oc-03-optional-context-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row, oc-12-index-row-mutant, oc-23-ref-read, oc-23-ref-read-mutant, oc-23-ref-pending, oc-23-ref-pending-mutant.

All groups: oc-02-effect-prop-phase-mutant, oc-03-optional-context-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row, oc-12-index-row-mutant, oc-23-ref-read, oc-23-ref-read-mutant, oc-23-ref-pending, oc-23-ref-pending-mutant.

New mutants missed: oc-02-effect-prop-phase-mutant, oc-03-optional-context-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read-mutant, oc-23-ref-pending-mutant.

All mutants missed: oc-02-effect-prop-phase-mutant, oc-03-optional-context-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read-mutant, oc-23-ref-pending-mutant.

## null: failing fixtures

New group: oc-01-factory-reader-mutant, oc-02-effect-prop-phase-mutant, oc-03-optional-context-mutant, oc-04-default-accessor-mutant, oc-05-project-get-method-mutant, oc-06-promise-forks-mutant, oc-07-scoped-outcome-mutant, oc-08-lazy-unused-prop-mutant, oc-09-forwarded-pending-setup-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read-mutant, oc-23-ref-pending-mutant, oc-01-translation-reader-mutant.

All groups: context-missing-provider, context-provider-over-default, context-signal-setup, context-method-setup, context-async-uncovered, context-async-setup, context-pending-handler, context-failing-handler, context-promise-uncaught, context-optional-api-uncaught, context-injected-sync, context-module-escape, context-unknown-escape, context-prop-uncovered, setup-read, return-ternary, return-and, named-callback-in-setup, array-callback-in-setup, getter-read-in-setup, memo-write, async-read, colored-prop, promise-catch, pending-root, iife-pending-root, async-setup-reads, throw-error, promise-event, rethrow-catch, unknown-rethrow-catch, plain-callback-throw-in-memo, effect-reads-failing-memo-at-root, foreign-route-failure, setup-promise-rejects, callback-prop-throws, async-handler-destructured-uncaught, kept-promise-rejects-at-its-await, timer-callback-failure, equipment-checkout, m-context-loading-removed, m-context-errored-removed, m-context-catch-removed, m-context-optional-catch-removed, m-context-provider-removed, m-context-default-removed, m-context-shadow-removed, m-context-alias-setup, m-context-method-write-memo, m-context-prop-child-loading-removed, m-context-prop-child-errored-removed, m-context-read-to-handler, m-loading-removed, m-errored-removed, m-catch-removed, m-read-moved-to-setup, m-write-in-memo, m-reactive-prop-read-in-setup, m-handled-catch-rethrows, m-async-helper-rejects, m-pending-through-prop, m-pending-read-in-setup, m-callback-prop-throws-forwarded, m-effect-phase-pending, m-injected-api-ambient, m-injected-api-prop, m-equipment-row-loading-removed, oc-01-factory-reader-mutant, oc-02-effect-prop-phase-mutant, oc-03-optional-context-mutant, oc-04-default-accessor-mutant, oc-05-project-get-method-mutant, oc-06-promise-forks-mutant, oc-07-scoped-outcome-mutant, oc-08-lazy-unused-prop-mutant, oc-09-forwarded-pending-setup-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read-mutant, oc-23-ref-pending-mutant, oc-01-translation-reader-mutant.

New mutants missed: oc-01-factory-reader-mutant, oc-02-effect-prop-phase-mutant, oc-03-optional-context-mutant, oc-04-default-accessor-mutant, oc-05-project-get-method-mutant, oc-06-promise-forks-mutant, oc-07-scoped-outcome-mutant, oc-08-lazy-unused-prop-mutant, oc-09-forwarded-pending-setup-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read-mutant, oc-23-ref-pending-mutant, oc-01-translation-reader-mutant.

All mutants missed: m-context-loading-removed, m-context-errored-removed, m-context-catch-removed, m-context-optional-catch-removed, m-context-provider-removed, m-context-default-removed, m-context-shadow-removed, m-context-alias-setup, m-context-method-write-memo, m-context-prop-child-loading-removed, m-context-prop-child-errored-removed, m-context-read-to-handler, m-loading-removed, m-errored-removed, m-catch-removed, m-read-moved-to-setup, m-write-in-memo, m-reactive-prop-read-in-setup, m-handled-catch-rethrows, m-async-helper-rejects, m-pending-through-prop, m-pending-read-in-setup, m-callback-prop-throws-forwarded, m-effect-phase-pending, m-injected-api-ambient, m-injected-api-prop, m-equipment-row-loading-removed, oc-01-factory-reader-mutant, oc-02-effect-prop-phase-mutant, oc-03-optional-context-mutant, oc-04-default-accessor-mutant, oc-05-project-get-method-mutant, oc-06-promise-forks-mutant, oc-07-scoped-outcome-mutant, oc-08-lazy-unused-prop-mutant, oc-09-forwarded-pending-setup-mutant, oc-10-untrack-not-a-catch-mutant, oc-12-keyed-row-snapshot-mutant, oc-12-row-pending-mutant, oc-12-index-row-mutant, oc-23-ref-read-mutant, oc-23-ref-pending-mutant, oc-01-translation-reader-mutant.

## Honest known failures

results/openclaw-known.json pins every new-group score signature, including
missed anchors, precise hits, extras and required related locations as scored.
Tests still run each checker; changes in either direction fail until reviewed.
Old fixtures retain their original zero-miss assertions. Leakage, unknown codes
and unmapped locations are never accepted. Null remains the negative checker.
Regenerate with node harness/openclaw-baseline.mjs only after review; pnpm test
does not update this baseline. Raw full harness scores remain in latest.json.
