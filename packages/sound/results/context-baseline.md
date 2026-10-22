# solid-sound comparison — 2026-10-22T12:42:35.398Z

Fixtures: 109 (all); runs per measurement: 3. Prototypes: typed, dataflow, null.

## Summary

| criterion | typed | dataflow | null |
|---|---|---|---|
| expected errors hit / expected | 48 / 70 (69 %) | 57 / 70 (81 %) | 0 / 70 (0 %) |
| …of which located imprecisely (at a root, not the read) | 10 | 0 | 0 |
| **soundness failures** (in-subset misses) | **22**: context-missing-provider, context-provider-over-default, context-signal-setup, context-method-setup, context-async-uncovered, context-async-setup, context-pending-handler, context-module-escape, context-unknown-escape, context-prop-uncovered, equipment-checkout, m-context-loading-removed, m-context-errored-removed, m-context-provider-removed, m-context-default-removed, m-context-shadow-removed, m-context-alias-setup, m-context-method-write-memo, m-context-prop-child-loading-removed, m-context-prop-child-errored-removed, m-context-read-to-handler, m-pending-through-prop | **17**: context-missing-provider, context-signal-setup, context-method-setup, context-async-setup, context-pending-handler, context-module-escape, context-unknown-escape, context-prop-uncovered, equipment-checkout, m-context-provider-removed, m-context-default-removed, m-context-alias-setup, m-context-method-write-memo, m-context-prop-child-loading-removed, m-context-prop-child-errored-removed, m-context-read-to-handler, m-pending-through-prop | **62**: context-missing-provider, context-provider-over-default, context-signal-setup, context-method-setup, context-async-uncovered, context-async-setup, context-pending-handler, context-failing-handler, context-promise-uncaught, context-optional-api-uncaught, context-injected-sync, context-module-escape, context-unknown-escape, context-prop-uncovered, setup-read, return-ternary, return-and, named-callback-in-setup, array-callback-in-setup, getter-read-in-setup, memo-write, pending-root, iife-pending-root, async-setup-reads, throw-error, promise-event, plain-callback-throw-in-memo, effect-reads-failing-memo-at-root, foreign-route-failure, setup-promise-rejects, callback-prop-throws, async-handler-destructured-uncaught, kept-promise-rejects-at-its-await, timer-callback-failure, equipment-checkout, m-context-loading-removed, m-context-errored-removed, m-context-catch-removed, m-context-optional-catch-removed, m-context-provider-removed, m-context-default-removed, m-context-shadow-removed, m-context-alias-setup, m-context-method-write-memo, m-context-prop-child-loading-removed, m-context-prop-child-errored-removed, m-context-read-to-handler, m-loading-removed, m-errored-removed, m-catch-removed, m-read-moved-to-setup, m-write-in-memo, m-reactive-prop-read-in-setup, m-handled-catch-rethrows, m-async-helper-rejects, m-pending-through-prop, m-pending-read-in-setup, m-callback-prop-throws-forwarded, m-effect-phase-pending, m-injected-api-ambient, m-injected-api-prop, m-equipment-row-loading-removed |
| mutants missed | **11** | **8** | **27** |
| extra errors (all / on in-subset fixtures) | 68 / 68 | 53 / 53 | 0 / 0 |
| expected warnings hit / expected | 7 / 11 | 5 / 11 | 0 / 11 |
| extra warnings | 90 | 91 | 0 |
| expected info hit / expected | 5 / 5 | 5 / 5 | 0 / 5 |
| generated-code leakage in messages | 0 | 0 | 0 |
| unmapped locations | 0 | 0 | 0 |
| codes outside the table | 0 | 0 | 0 |
| crashes | 0 | 0 | 0 |
| cold check, cases total (ms) | 18075.1 | 8718.2 | 0.1 |
| cold check, mutants total (ms) | 6074.0 | 2909.1 | 0.0 |
| cold check, Equipment app (ms) | 293.0 | 122.9 | 0.0 |
| incremental, EquipmentRow trivial edit (ms) | 96.8 | 20.1 | 0.0 |
| incremental, EquipmentRow semantic edit (ms) | 93.8 | 20.0 | 0.0 |
| errors before / after trivial / after semantic edit | 18 / 18 / 17 | 18 / 18 / 17 | 0 / 0 / 0 |

> **SOUNDNESS FAILURE — typed: 22 in-subset fixture(s) with a missed obligation: context-missing-provider, context-provider-over-default, context-signal-setup, context-method-setup, context-async-uncovered, context-async-setup, context-pending-handler, context-module-escape, context-unknown-escape, context-prop-uncovered, equipment-checkout, m-context-loading-removed, m-context-errored-removed, m-context-provider-removed, m-context-default-removed, m-context-shadow-removed, m-context-alias-setup, m-context-method-write-memo, m-context-prop-child-loading-removed, m-context-prop-child-errored-removed, m-context-read-to-handler, m-pending-through-prop**

> **SOUNDNESS FAILURE — dataflow: 17 in-subset fixture(s) with a missed obligation: context-missing-provider, context-signal-setup, context-method-setup, context-async-setup, context-pending-handler, context-module-escape, context-unknown-escape, context-prop-uncovered, equipment-checkout, m-context-provider-removed, m-context-default-removed, m-context-alias-setup, m-context-method-write-memo, m-context-prop-child-loading-removed, m-context-prop-child-errored-removed, m-context-read-to-handler, m-pending-through-prop**

> **SOUNDNESS FAILURE — null: 62 in-subset fixture(s) with a missed obligation: context-missing-provider, context-provider-over-default, context-signal-setup, context-method-setup, context-async-uncovered, context-async-setup, context-pending-handler, context-failing-handler, context-promise-uncaught, context-optional-api-uncaught, context-injected-sync, context-module-escape, context-unknown-escape, context-prop-uncovered, setup-read, return-ternary, return-and, named-callback-in-setup, array-callback-in-setup, getter-read-in-setup, memo-write, pending-root, iife-pending-root, async-setup-reads, throw-error, promise-event, plain-callback-throw-in-memo, effect-reads-failing-memo-at-root, foreign-route-failure, setup-promise-rejects, callback-prop-throws, async-handler-destructured-uncaught, kept-promise-rejects-at-its-await, timer-callback-failure, equipment-checkout, m-context-loading-removed, m-context-errored-removed, m-context-catch-removed, m-context-optional-catch-removed, m-context-provider-removed, m-context-default-removed, m-context-shadow-removed, m-context-alias-setup, m-context-method-write-memo, m-context-prop-child-loading-removed, m-context-prop-child-errored-removed, m-context-read-to-handler, m-loading-removed, m-errored-removed, m-catch-removed, m-read-moved-to-setup, m-write-in-memo, m-reactive-prop-read-in-setup, m-handled-catch-rethrows, m-async-helper-rejects, m-pending-through-prop, m-pending-read-in-setup, m-callback-prop-throws-forwarded, m-effect-phase-pending, m-injected-api-ambient, m-injected-api-prop, m-equipment-row-loading-removed**

## Per fixture

| fixture | group | subset | typed (hit/miss/extraE/extraW) | dataflow (hit/miss/extraE/extraW) | null (hit/miss/extraE/extraW) |
|---|---|---|---|---|---|
| context-plain-object | cases | in | 0/0/2/2 | 0/0/2/2 | 0/0/0/0 |
| context-default | cases | in | 0/0/2/1 | 0/0/2/1 | 0/0/0/0 |
| context-missing-provider | cases | in | 0/**1**/2/1 ⚠ | 0/**1**/2/1 ⚠ | 0/**1**/0/0 ⚠ |
| context-provider-over-default | cases | in | 0/**1**/2/2 ⚠ | 1/0/1/2 | 0/**1**/0/0 ⚠ |
| context-signal-view | cases | in | 0/0/2/2 | 0/0/2/2 | 0/0/0/0 |
| context-signal-setup | cases | in | 0/**1**/1/2 ⚠ | 0/**1**/1/2 ⚠ | 0/**1**/0/0 ⚠ |
| context-factory-memo | cases | in | 0/0/2/3 | 0/0/2/3 | 0/0/0/0 |
| context-helper-alias | cases | in | 0/0/1/1 | 0/0/2/2 | 0/0/0/0 |
| context-method-view | cases | in | 0/0/2/3 | 0/0/2/3 | 0/0/0/0 |
| context-method-setup | cases | in | 0/**1**/3/3 ⚠ | 0/**1**/1/3 ⚠ | 0/**1**/0/0 ⚠ |
| context-async-covered | cases | in | 0/0/1/2 | 0/0/1/2 | 0/0/0/0 |
| context-async-uncovered | cases | in | 0/**1**/2/2 ⚠ | 1/0/1/2 | 0/**1**/0/0 ⚠ |
| context-async-setup | cases | in | 0/**1**/1/2 ⚠ | 0/**1**/1/2 ⚠ | 0/**1**/0/0 ⚠ |
| context-pending-handler | cases | in | 0/0/1/2 ⚠ | 0/0/1/2 ⚠ | 0/0/0/0 ⚠ |
| context-failing-memo-covered | cases | in | 0/0/1/2 | 0/0/1/2 | 0/0/0/0 |
| context-failing-handler | cases | in | 1/0/0/2 | 1/0/0/2 | 0/**1**/0/0 ⚠ |
| context-promise-caught | cases | in | 0/0/0/2 | 0/0/0/2 | 0/0/0/0 |
| context-promise-uncaught | cases | in | 1/0/0/2 | 1/0/0/2 | 0/**1**/0/0 ⚠ |
| context-optional-api-caught | cases | in | 0/0/0/2 | 0/0/0/2 | 0/0/0/0 |
| context-optional-api-uncaught | cases | in | 1/0/0/2 | 1/0/0/2 | 0/**1**/0/0 ⚠ |
| context-injected-sync | cases | in | 1/0/0/2 | 1/0/0/2 | 0/**1**/0/0 ⚠ |
| context-nested-shadow | cases | in | 0/0/2/3 | 0/0/2/3 | 0/0/0/0 |
| context-provider-identity | cases | in | 0/0/2/2 | 0/0/2/2 | 0/0/0/0 |
| context-module-escape | cases | in | 0/**2**/1/3 ⚠ | 2/0/0/2 ⚠ | 0/**2**/0/0 ⚠ |
| context-unknown-escape | cases | in | 0/**2**/2/2 ⚠ | 2/0/0/2 ⚠ | 0/**2**/0/0 ⚠ |
| context-prop-child-boundaries | cases | in | 0/0/2/2 | 0/0/0/2 | 0/0/0/0 |
| context-prop-caller-boundaries | cases | in | 0/0/0/2 | 0/0/0/2 | 0/0/0/0 |
| context-prop-uncovered | cases | in | 0/**2**/2/2 ⚠ | 0/**2**/2/2 ⚠ | 0/**2**/0/0 ⚠ |
| context-method-write-handler | cases | in | 0/0/3/3 | 0/0/3/3 | 0/0/0/0 |
| counter | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| props | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| inline-event | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| named-event | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| catch | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| callback-read | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| setup-read | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| return-ternary | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| return-and | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| return-null | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| named-callback-in-setup | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| array-callback-in-setup | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| getter-read-in-setup | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| memo-write | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| untrack-in-every-host | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| reader-helpers | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| props-interface-live | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| props-accessor-callers | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| callback-prop-forwarded | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| recursion-failing-prop | cases | in | 0/0/1/0 | 0/0/0/0 | 0/0/0/0 |
| async-memo-reads | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| async-memo-nested-function | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| async-event-reads | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| async-read | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| colored-prop | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| promise-catch | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| pending-root | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| iife-pending-root | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| async-setup-reads | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| native-latest-pending | cases | out | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| native-for-indexed | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| throw-error | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| promise-event | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| handled-catch | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| rethrow-catch | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| unknown-rethrow-catch | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| finally-nested-function | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| plain-callback-throw-under-errored | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| plain-callback-throw-in-memo | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| effect-reads-failing-memo-at-root | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| foreign-route-failure | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| setup-promise-caught | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| setup-promise-rejects | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| callback-prop-throws | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| callback-prop-unseen | cases | out | 2/0/0/0 | 2/0/0/0 | 0/**2**/0/0 |
| async-handler-destructured-uncaught | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| kept-promise-rejects-at-its-await | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| kept-promise-caught-by-its-chain | cases | in | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| timer-callback-failure | cases | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| native-optimistic-store-basic | cases | out | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 |
| event-updater | cases | out | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 |
| ref-event-reads | cases | out | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| equipment-checkout | equipment | in | 3/0/8/7 ⚠ | 3/0/8/7 ⚠ | 0/**3**/0/0 ⚠ |
| m-context-loading-removed | mutants | in | 0/**1**/2/2 ⚠ | 1/0/1/2 | 0/**1**/0/0 ⚠ |
| m-context-errored-removed | mutants | in | 0/**1**/2/2 ⚠ | 1/0/1/2 | 0/**1**/0/0 ⚠ |
| m-context-catch-removed | mutants | in | 1/0/0/2 | 1/0/0/2 | 0/**1**/0/0 ⚠ |
| m-context-optional-catch-removed | mutants | in | 1/0/0/2 | 1/0/0/2 | 0/**1**/0/0 ⚠ |
| m-context-provider-removed | mutants | in | 0/**1**/2/1 ⚠ | 0/**1**/2/1 ⚠ | 0/**1**/0/0 ⚠ |
| m-context-default-removed | mutants | in | 0/**1**/2/1 ⚠ | 0/**1**/2/1 ⚠ | 0/**1**/0/0 ⚠ |
| m-context-shadow-removed | mutants | in | 0/**1**/2/2 ⚠ | 1/0/1/2 | 0/**1**/0/0 ⚠ |
| m-context-alias-setup | mutants | in | 0/**1**/1/1 ⚠ | 0/**1**/1/2 ⚠ | 0/**1**/0/0 ⚠ |
| m-context-method-write-memo | mutants | in | 0/**1**/2/3 ⚠ | 0/**1**/2/3 ⚠ | 0/**1**/0/0 ⚠ |
| m-context-prop-child-loading-removed | mutants | in | 0/**1**/2/2 ⚠ | 0/**1**/1/2 ⚠ | 0/**1**/0/0 ⚠ |
| m-context-prop-child-errored-removed | mutants | in | 0/**1**/2/2 ⚠ | 0/**1**/1/2 ⚠ | 0/**1**/0/0 ⚠ |
| m-context-read-to-handler | mutants | in | 0/0/1/2 ⚠ | 0/0/1/2 ⚠ | 0/0/0/0 ⚠ |
| m-loading-removed | mutants | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| m-errored-removed | mutants | in | 2/0/0/0 | 2/0/0/0 | 0/**2**/0/0 ⚠ |
| m-catch-removed | mutants | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| m-read-moved-to-setup | mutants | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| m-write-in-memo | mutants | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| m-reactive-prop-read-in-setup | mutants | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| m-handled-catch-rethrows | mutants | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| m-async-helper-rejects | mutants | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| m-pending-through-prop | mutants | in | 0/**1**/1/0 ⚠ | 0/**1**/1/0 ⚠ | 0/**1**/0/0 ⚠ |
| m-pending-read-in-setup | mutants | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| m-callback-prop-throws-forwarded | mutants | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| m-effect-phase-pending | mutants | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| m-injected-api-ambient | mutants | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| m-injected-api-prop | mutants | in | 1/0/1/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |
| m-equipment-row-loading-removed | mutants | in | 1/0/0/0 | 1/0/0/0 | 0/**1**/0/0 ⚠ |

## typed: misses, extras, leakage

- **context-plain-object**
  - extra error: error cases/context-plain-object.tsx:7:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-plain-object.tsx:7:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-default**
  - extra error: error cases/context-default.tsx:6:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-default.tsx:6:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-missing-provider**
  - missed CONTEXT_PROVIDER_MISSING at "useContext(C)"
  - extra error: error cases/context-missing-provider.tsx:6:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-missing-provider.tsx:6:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-provider-over-default**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "s.read()"
  - extra error: error cases/context-provider-over-default.tsx:7:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-provider-over-default.tsx:7:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-signal-view**
  - extra error: error cases/context-signal-view.tsx:7:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-signal-view.tsx:7:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-signal-setup**
  - missed STRICT_READ_UNTRACKED at "s.count()"
  - extra error: error cases/context-signal-setup.tsx:5:45 [SETUP_MAY_THROW] The component's setup may fail with unknown at `const n = s.count(); return <p>{n}</p>; }`; a component body only creates state. Move this work into a memo or rendered work under an Errored boundary, or into a handler, or handle the failure where it is produced.
- **context-factory-memo**
  - extra error: error cases/context-factory-memo.tsx:8:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-factory-memo.tsx:8:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-helper-alias**
  - extra error: error cases/context-helper-alias.tsx:8:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-method-view**
  - extra error: error cases/context-method-view.tsx:8:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-method-view.tsx:8:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-method-setup**
  - missed STRICT_READ_UNTRACKED at "count()"
  - extra error: error cases/context-method-setup.tsx:6:45 [SETUP_MAY_THROW] The component's setup may fail with unknown at `const n = s.read(); return <p>{n}</p>; }`; a component body only creates state. Move this work into a memo or rendered work under an Errored boundary, or into a handler, or handle the failure where it is produced.
  - extra error: error cases/context-method-setup.tsx:8:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-method-setup.tsx:8:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-async-covered**
  - extra error: error cases/context-async-covered.tsx:7:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-async-uncovered**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "s.value()"
  - extra error: error cases/context-async-uncovered.tsx:7:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-async-uncovered.tsx:7:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-async-setup**
  - missed PENDING_ASYNC_UNTRACKED_READ at "s.value()"
  - extra error: error cases/context-async-setup.tsx:5:45 [SETUP_MAY_THROW] The component's setup may fail with unknown at `const n = s.value(); return <p>{n}</p>; }`; a component body only creates state. Move this work into a memo or rendered work under an Errored boundary, or into a handler, or handle the failure where it is produced.
- **context-pending-handler**
  - extra error: error cases/context-pending-handler.tsx:5:60 [UNHANDLED_HANDLER_FAILURE] This handler (`onClick={() => { s.value(); }}>read</button>; }`) can fail with unknown and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler.
- **context-failing-memo-covered**
  - extra error: error cases/context-failing-memo-covered.tsx:7:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
- **context-nested-shadow**
  - extra error: error cases/context-nested-shadow.tsx:7:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-nested-shadow.tsx:7:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-provider-identity**
  - extra error: error cases/context-provider-identity.tsx:8:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-provider-identity.tsx:8:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-module-escape**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "escaped.read()"
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "escaped.read()"
  - extra error: error cases/context-module-escape.tsx:9:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-unknown-escape**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "s.read()"
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "s.read()"
  - extra error: error cases/context-unknown-escape.tsx:9:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-unknown-escape.tsx:9:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-prop-child-boundaries**
  - extra error: error cases/context-prop-child-boundaries.tsx:8:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-prop-child-boundaries.tsx:8:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-prop-uncovered**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "p.value"
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "p.value"
  - extra error: error cases/context-prop-uncovered.tsx:8:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-prop-uncovered.tsx:8:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **context-method-write-handler**
  - extra error: error cases/context-method-write-handler.tsx:6:60 [UNHANDLED_HANDLER_FAILURE] This handler (`onClick={s.set}>{s.count()}</button>; }`) can fail with unknown and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler.
  - extra error: error cases/context-method-write-handler.tsx:8:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error cases/context-method-write-handler.tsx:8:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **recursion-failing-prop**
  - extra error: error cases/recursion-failing-prop.tsx:15:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `App, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
- **pending-root**
  - imprecise: ASYNC_OUTSIDE_LOADING_BOUNDARY located at a root / hand-off, not at the read
- **iife-pending-root**
  - imprecise: ASYNC_OUTSIDE_LOADING_BOUNDARY located at a root / hand-off, not at the read
- **plain-callback-throw-in-memo**
  - imprecise: ERROR_OUTSIDE_ERRORED_BOUNDARY located at a root / hand-off, not at the read
- **effect-reads-failing-memo-at-root**
  - imprecise: ERROR_OUTSIDE_ERRORED_BOUNDARY located at a root / hand-off, not at the read
- **foreign-route-failure**
  - imprecise: ERROR_OUTSIDE_ERRORED_BOUNDARY located at a root / hand-off, not at the read
- **equipment-checkout**
  - extra error: error equipment/src/App.tsx:14:203 [UNHANDLED_HANDLER_FAILURE] This handler (`onClick={service.reload}>Refresh inventory</butt`) can fail with unknown and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler.
  - extra error: error equipment/src/App.tsx:18:143 [UNHANDLED_HANDLER_FAILURE] This handler (`onClick={() => { service.reload(); reset(); }}>R`) can fail with unknown and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler.
  - extra error: error equipment/src/main.tsx:6:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, root);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error equipment/src/main.tsx:6:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, root);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
  - extra error: error equipment/src/components/CreateForm.tsx:19:67 [UNHANDLED_HANDLER_FAILURE] This handler (`onSubmit={submit}>`) can fail with unknown and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler.
  - extra error: error equipment/src/components/Detail.tsx:8:93 [UNHANDLED_HANDLER_FAILURE] This handler (`onClick={() => { service.reload(); reset(); }}>R`) can fail with unknown and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler.
  - extra error: error equipment/src/components/EquipmentRow.tsx:46:48 [UNHANDLED_HANDLER_FAILURE] This handler (`onClick={remove}>Delete</button></div>`) can fail with unknown and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler.
  - extra error: error equipment/src/components/EquipmentRow.tsx:48:51 [UNHANDLED_HANDLER_FAILURE] This handler (`onSubmit={save}>`) can fail with unknown and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler.
- **m-context-loading-removed**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "s.value()"
  - extra error: error mutants/m-context-loading-removed.tsx:7:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error mutants/m-context-loading-removed.tsx:7:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **m-context-errored-removed**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "s.value()"
  - extra error: error mutants/m-context-errored-removed.tsx:7:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error mutants/m-context-errored-removed.tsx:7:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **m-context-provider-removed**
  - missed CONTEXT_PROVIDER_MISSING at "useContext(C)"
  - extra error: error mutants/m-context-provider-removed.tsx:7:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error mutants/m-context-provider-removed.tsx:7:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **m-context-default-removed**
  - missed CONTEXT_PROVIDER_MISSING at "useContext(C)"
  - extra error: error mutants/m-context-default-removed.tsx:6:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error mutants/m-context-default-removed.tsx:6:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **m-context-shadow-removed**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "s.value()"
  - extra error: error mutants/m-context-shadow-removed.tsx:7:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error mutants/m-context-shadow-removed.tsx:7:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **m-context-alias-setup**
  - missed STRICT_READ_UNTRACKED at "again()"
  - extra error: error mutants/m-context-alias-setup.tsx:6:75 [SETUP_MAY_THROW] The component's setup may fail with unknown at `const n = again(); return <p>{n}</p>; }`; a component body only creates state. Move this work into a memo or rendered work under an Errored boundary, or into a handler, or handle the failure where it is produced.
- **m-context-method-write-memo**
  - missed REACTIVE_WRITE_IN_OWNED_SCOPE at "setCount(1)"
  - extra error: error mutants/m-context-method-write-memo.tsx:8:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error mutants/m-context-method-write-memo.tsx:8:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **m-context-prop-child-loading-removed**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "p.value"
  - extra error: error mutants/m-context-prop-child-loading-removed.tsx:8:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error mutants/m-context-prop-child-loading-removed.tsx:8:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **m-context-prop-child-errored-removed**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "p.value"
  - extra error: error mutants/m-context-prop-child-errored-removed.tsx:8:8 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `() => <App />, document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
  - extra error: error mutants/m-context-prop-child-errored-removed.tsx:8:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **m-context-read-to-handler**
  - extra error: error mutants/m-context-read-to-handler.tsx:5:60 [UNHANDLED_HANDLER_FAILURE] This handler (`onClick={() => { s.value(); }}>read</button>; }`) can fail with unknown and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler.
- **m-loading-removed**
  - imprecise: ASYNC_OUTSIDE_LOADING_BOUNDARY located at a root / hand-off, not at the read
- **m-errored-removed**
  - imprecise: ERROR_OUTSIDE_ERRORED_BOUNDARY located at a root / hand-off, not at the read
  - imprecise: ERROR_OUTSIDE_ERRORED_BOUNDARY located at a root / hand-off, not at the read
- **m-handled-catch-rethrows**
  - imprecise: ERROR_OUTSIDE_ERRORED_BOUNDARY located at a root / hand-off, not at the read
- **m-pending-through-prop**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "{p.n}"
  - extra error: error mutants/m-pending-through-prop.tsx:1:277 [ASYNC_OUTSIDE_LOADING_BOUNDARY] The view rendered by `App,document.body);` may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.
- **m-injected-api-prop**
  - extra error: error mutants/m-injected-api-prop.tsx:17:8 [ERROR_OUTSIDE_ERRORED_BOUNDARY] The view rendered by `() => <App />, document.body);` may fail and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.
- **m-equipment-row-loading-removed**
  - imprecise: ASYNC_OUTSIDE_LOADING_BOUNDARY located at a root / hand-off, not at the read

## dataflow: misses, extras, leakage

- **context-plain-object**
  - extra error: error cases/context-plain-object.tsx:5:56 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "s.label" may be pending here and no Loading boundary is above this read, up to the render root at context-plain-object.tsx:7; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Child>
  - extra error: error cases/context-plain-object.tsx:5:56 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.label" may fail with unknown here and no Errored boundary is above this read, up to the render root at context-plain-object.tsx:7; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **context-default**
  - extra error: error cases/context-default.tsx:5:54 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "s.label" may be pending here and no Loading boundary is above this read, up to the render root at context-default.tsx:6; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App>
  - extra error: error cases/context-default.tsx:5:54 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.label" may fail with unknown here and no Errored boundary is above this read, up to the render root at context-default.tsx:6; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App>
- **context-missing-provider**
  - missed CONTEXT_PROVIDER_MISSING at "useContext(C)"
  - extra error: error cases/context-missing-provider.tsx:5:54 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "s.label" may be pending here and no Loading boundary is above this read, up to the render root at context-missing-provider.tsx:6; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App>
  - extra error: error cases/context-missing-provider.tsx:5:54 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.label" may fail with unknown here and no Errored boundary is above this read, up to the render root at context-missing-provider.tsx:6; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App>
- **context-provider-over-default**
  - extra error: error cases/context-provider-over-default.tsx:5:56 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "s.read()" may be pending here and no Loading boundary is above this read, up to the render root at context-provider-over-default.tsx:7; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Child>
- **context-signal-view**
  - extra error: error cases/context-signal-view.tsx:5:56 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "s.count()" may be pending here and no Loading boundary is above this read, up to the render root at context-signal-view.tsx:7; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Child>
  - extra error: error cases/context-signal-view.tsx:5:56 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.count()" may fail with unknown here and no Errored boundary is above this read, up to the render root at context-signal-view.tsx:7; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **context-signal-setup**
  - missed STRICT_READ_UNTRACKED at "s.count()"
  - extra error: error cases/context-signal-setup.tsx:5:55 [SETUP_MAY_THROW] <Child>'s setup may fail with unknown (s.count() has no failure information); a component body only creates state. Move this work into a memo or rendered work under an Errored boundary, or into a handler, or handle the failure where it is produced.
- **context-factory-memo**
  - extra error: error cases/context-factory-memo.tsx:6:56 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "s.double()" may be pending here and no Loading boundary is above this read, up to the render root at context-factory-memo.tsx:8; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Child>
  - extra error: error cases/context-factory-memo.tsx:6:56 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.double()" may fail with unknown here and no Errored boundary is above this read, up to the render root at context-factory-memo.tsx:8; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **context-helper-alias**
  - extra error: error cases/context-helper-alias.tsx:6:86 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "again()" may be pending here and no Loading boundary is above this read, up to the render root at context-helper-alias.tsx:8; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Child>
  - extra error: error cases/context-helper-alias.tsx:6:86 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "again()" may fail with unknown here and no Errored boundary is above this read, up to the render root at context-helper-alias.tsx:8; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **context-method-view**
  - extra error: error cases/context-method-view.tsx:6:63 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "read()" may be pending here and no Loading boundary is above this read, up to the render root at context-method-view.tsx:8; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Child>
  - extra error: error cases/context-method-view.tsx:6:63 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "read()" may fail with unknown here and no Errored boundary is above this read, up to the render root at context-method-view.tsx:8; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **context-method-setup**
  - missed STRICT_READ_UNTRACKED at "count()"
  - extra error: error cases/context-method-setup.tsx:6:55 [SETUP_MAY_THROW] <Child>'s setup may fail with unknown (s.read() has no failure information); a component body only creates state. Move this work into a memo or rendered work under an Errored boundary, or into a handler, or handle the failure where it is produced.
- **context-async-covered**
  - extra error: error cases/context-async-covered.tsx:5:56 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.value()" may fail with unknown here and no Errored boundary is above this read, up to the render root at context-async-covered.tsx:7; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **context-async-uncovered**
  - extra error: error cases/context-async-uncovered.tsx:5:56 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.value()" may fail with unknown here and no Errored boundary is above this read, up to the render root at context-async-uncovered.tsx:7; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **context-async-setup**
  - missed PENDING_ASYNC_UNTRACKED_READ at "s.value()"
  - extra error: error cases/context-async-setup.tsx:5:55 [SETUP_MAY_THROW] <Child>'s setup may fail with unknown (s.value() has no failure information); a component body only creates state. Move this work into a memo or rendered work under an Errored boundary, or into a handler, or handle the failure where it is produced.
- **context-pending-handler**
  - extra error: error cases/context-pending-handler.tsx:5:60 [UNHANDLED_HANDLER_FAILURE] This onClick handler can fail with unknown (s.value() has no failure information) and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler. in <Child>
- **context-failing-memo-covered**
  - extra error: error cases/context-failing-memo-covered.tsx:5:56 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "s.value()" may be pending here and no Loading boundary is above this read, up to the render root at context-failing-memo-covered.tsx:7; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Child>
- **context-nested-shadow**
  - extra error: error cases/context-nested-shadow.tsx:5:56 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "s.value()" may be pending here and no Loading boundary is above this read, up to the render root at context-nested-shadow.tsx:7; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Child>
  - extra error: error cases/context-nested-shadow.tsx:5:56 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.value()" may fail with unknown here and no Errored boundary is above this read, up to the render root at context-nested-shadow.tsx:7; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **context-provider-identity**
  - extra error: error cases/context-provider-identity.tsx:6:56 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "s.value()" may be pending here and no Loading boundary is above this read, up to the render root at context-provider-identity.tsx:8; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Child>
  - extra error: error cases/context-provider-identity.tsx:6:56 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.value()" may fail with unknown here and no Errored boundary is above this read, up to the render root at context-provider-identity.tsx:8; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **context-prop-uncovered**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "p.value"
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "p.value"
  - extra error: error cases/context-prop-uncovered.tsx:4:51 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "props.value" may be pending here and no Loading boundary is above this read, up to the render root at context-prop-uncovered.tsx:8; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Parent> › <Child>
  - extra error: error cases/context-prop-uncovered.tsx:4:51 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "props.value" may fail with unknown here and no Errored boundary is above this read, up to the render root at context-prop-uncovered.tsx:8; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Parent> › <Child>
- **context-method-write-handler**
  - extra error: error cases/context-method-write-handler.tsx:6:60 [UNHANDLED_HANDLER_FAILURE] This onClick handler can fail with unknown (s.set has no failure information) and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler. in <Child>
  - extra error: error cases/context-method-write-handler.tsx:6:77 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "s.count()" may be pending here and no Loading boundary is above this read, up to the render root at context-method-write-handler.tsx:8; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Child>
  - extra error: error cases/context-method-write-handler.tsx:6:77 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.count()" may fail with unknown here and no Errored boundary is above this read, up to the render root at context-method-write-handler.tsx:8; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **equipment-checkout**
  - extra error: error equipment/src/components/EquipmentRow.tsx:46:48 [UNHANDLED_HANDLER_FAILURE] This onClick handler can fail with unknown and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler. in <EquipmentRow>
  - extra error: error equipment/src/components/EquipmentRow.tsx:48:51 [UNHANDLED_HANDLER_FAILURE] This onSubmit handler can fail with unknown and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler. in <EquipmentRow>
  - extra error: error equipment/src/components/CreateForm.tsx:19:67 [UNHANDLED_HANDLER_FAILURE] This onSubmit handler can fail with unknown and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler. in <CreateForm>
  - extra error: error equipment/src/components/Detail.tsx:8:93 [UNHANDLED_HANDLER_FAILURE] This onClick handler can fail with unknown (service.reload() has no failure information) and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler. in <Detail>
  - extra error: error equipment/src/App.tsx:14:203 [UNHANDLED_HANDLER_FAILURE] This onClick handler can fail with unknown (service.reload has no failure information) and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler. in <App>
  - extra error: error equipment/src/App.tsx:18:143 [UNHANDLED_HANDLER_FAILURE] This onClick handler can fail with unknown (service.reload() has no failure information) and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler. in <App>
  - extra error: error equipment/src/App.tsx:16:38 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "service.notice()" may be pending here and no Loading boundary is above this read, up to the render root at main.tsx:6; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App>
  - extra error: error equipment/src/App.tsx:16:38 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "service.notice()" may fail with unknown here and no Errored boundary is above this read, up to the render root at main.tsx:6; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App>
- **m-context-loading-removed**
  - extra error: error mutants/m-context-loading-removed.tsx:5:56 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.value()" may fail with unknown here and no Errored boundary is above this read, up to the render root at m-context-loading-removed.tsx:7; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **m-context-errored-removed**
  - extra error: error mutants/m-context-errored-removed.tsx:5:56 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "s.value()" may be pending here and no Loading boundary is above this read, up to the render root at m-context-errored-removed.tsx:7; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Child>
- **m-context-provider-removed**
  - missed CONTEXT_PROVIDER_MISSING at "useContext(C)"
  - extra error: error mutants/m-context-provider-removed.tsx:5:56 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "s.label" may be pending here and no Loading boundary is above this read, up to the render root at m-context-provider-removed.tsx:7; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Child>
  - extra error: error mutants/m-context-provider-removed.tsx:5:56 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.label" may fail with unknown here and no Errored boundary is above this read, up to the render root at m-context-provider-removed.tsx:7; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **m-context-default-removed**
  - missed CONTEXT_PROVIDER_MISSING at "useContext(C)"
  - extra error: error mutants/m-context-default-removed.tsx:5:54 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "s.label" may be pending here and no Loading boundary is above this read, up to the render root at m-context-default-removed.tsx:6; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App>
  - extra error: error mutants/m-context-default-removed.tsx:5:54 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.label" may fail with unknown here and no Errored boundary is above this read, up to the render root at m-context-default-removed.tsx:6; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App>
- **m-context-shadow-removed**
  - extra error: error mutants/m-context-shadow-removed.tsx:5:56 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "s.value()" may fail with unknown here and no Errored boundary is above this read, up to the render root at m-context-shadow-removed.tsx:7; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **m-context-alias-setup**
  - missed STRICT_READ_UNTRACKED at "again()"
  - extra error: error mutants/m-context-alias-setup.tsx:6:85 [SETUP_MAY_THROW] <Child>'s setup may fail with unknown (again() has no failure information); a component body only creates state. Move this work into a memo or rendered work under an Errored boundary, or into a handler, or handle the failure where it is produced.
- **m-context-method-write-memo**
  - missed REACTIVE_WRITE_IN_OWNED_SCOPE at "setCount(1)"
  - extra error: error mutants/m-context-method-write-memo.tsx:6:98 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "result" may be pending here and no Loading boundary is above this read, up to the render root at m-context-method-write-memo.tsx:8; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Child>
  - extra error: error mutants/m-context-method-write-memo.tsx:6:98 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "result" may fail with unknown here and no Errored boundary is above this read, up to the render root at m-context-method-write-memo.tsx:8; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Child>
- **m-context-prop-child-loading-removed**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "p.value"
  - extra error: error mutants/m-context-prop-child-loading-removed.tsx:4:86 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "props.value" may be pending here and no Loading boundary is above this read, up to the render root at m-context-prop-child-loading-removed.tsx:8; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in render › <App> › <Parent> › <Child>
- **m-context-prop-child-errored-removed**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "p.value"
  - extra error: error mutants/m-context-prop-child-errored-removed.tsx:4:76 [ERROR_OUTSIDE_ERRORED_BOUNDARY] "props.value" may fail with unknown here and no Errored boundary is above this read, up to the render root at m-context-prop-child-errored-removed.tsx:8; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller. in render › <App> › <Parent> › <Child>
- **m-context-read-to-handler**
  - extra error: error mutants/m-context-read-to-handler.tsx:5:60 [UNHANDLED_HANDLER_FAILURE] This onClick handler can fail with unknown (s.value() has no failure information) and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler. in <Child>
- **m-pending-through-prop**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "{p.n}"
  - extra error: error mutants/m-pending-through-prop.tsx:1:182 [ASYNC_OUTSIDE_LOADING_BOUNDARY] "props.n" may be pending here and no Loading boundary is above this read, up to the render root at m-pending-through-prop.tsx:1; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller. in <App> › <Child>

## null: misses, extras, leakage

- **context-missing-provider**
  - missed CONTEXT_PROVIDER_MISSING at "useContext(C)"
- **context-provider-over-default**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "s.read()"
- **context-signal-setup**
  - missed STRICT_READ_UNTRACKED at "s.count()"
- **context-method-setup**
  - missed STRICT_READ_UNTRACKED at "count()"
- **context-async-uncovered**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "s.value()"
- **context-async-setup**
  - missed PENDING_ASYNC_UNTRACKED_READ at "s.value()"
- **context-failing-handler**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick"
- **context-promise-uncaught**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick"
- **context-optional-api-uncaught**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick"
- **context-injected-sync**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick"
- **context-module-escape**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "escaped.read()"
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "escaped.read()"
- **context-unknown-escape**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "s.read()"
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "s.read()"
- **context-prop-uncovered**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "p.value"
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "p.value"
- **setup-read**
  - missed STRICT_READ_UNTRACKED at "count()" #1
- **return-ternary**
  - missed STRICT_READ_UNTRACKED at "n()" #1
- **return-and**
  - missed STRICT_READ_UNTRACKED at "n()" #1
- **named-callback-in-setup**
  - missed STRICT_READ_UNTRACKED at "n()" #1 | "map(scale)" | "[1, 2].map(scale)" — the read inside scale, called from setup through map; either the read or the call
- **array-callback-in-setup**
  - missed STRICT_READ_UNTRACKED at "items().filter" | "n())" — items() and n() are both setup reads on line 6; one expectation covers both
- **getter-read-in-setup**
  - missed STRICT_READ_UNTRACKED at "o.double" | "n() * 2" — an object getter is a sync helper; reading it in setup is a setup read
- **memo-write**
  - missed REACTIVE_WRITE_IN_OWNED_SCOPE at "set(1)"
- **pending-root**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "{n()}" | "render(App" — at the read, with the root as a related location; the root is accepted as an imprecise location
- **iife-pending-root**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "p() * 2" | "(() => p() * 2)()" | "render(App"
- **async-setup-reads**
  - missed STRICT_READ_UNTRACKED at "return n()" | "load()" #2 — the read inside the async helper called from setup, or the call
- **throw-error**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick"
- **promise-event**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick"
- **plain-callback-throw-in-memo**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "{total()}" | "throw new RangeError" | "render(App"
- **effect-reads-failing-memo-at-root**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "() => checked()" | "throw new RangeError" | "render(" — an effect's compute reads a failing memo; the failure reaches the root
- **foreign-route-failure**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "{n()}" | "throw new Error" | "component:Page" — the component is handed off as a value: a root
- **setup-promise-rejects**
  - missed SETUP_MAY_THROW at "risk().then" | "throw new Bad()" — a dropped rejecting promise in setup
- **callback-prop-throws**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick" | "onBump={" — the caller's handler throws RangeError through the callback prop
- **callback-prop-unseen**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick" #1 — Spread's onBump comes from a spread: unknown
  - missed UNHANDLED_HANDLER_FAILURE at "onClick" #2 — Handed is exported in a registry: unknown
- **async-handler-destructured-uncaught**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick" — Errored does not catch a handler's rejection
- **kept-promise-rejects-at-its-await**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick" — fetch's rejection, awaited with no catch
- **timer-callback-failure**
  - missed UNHANDLED_HANDLER_FAILURE at "setTimeout(" | "risk()" #2 — a timer callback is handler-like; risk() has no body: unknown
- **native-optimistic-store-basic**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick" — the store setter comes from an unanalyzed construct: worst case, possibly failing
- **event-updater**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick" — write() is a store setter from an unanalyzed construct: worst case
- **equipment-checkout**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick={edit}" — edit reads item(), derived from the possibly failing async list memo; Loading/Errored do not catch handlers
  - missed UNHANDLED_HANDLER_FAILURE at "onChange={changeStatus}" — the item()?.status read precedes try/finally and can throw; service.status itself catches through commit
  - missed UNHANDLED_HANDLER_FAILURE at line 9 — the optional injected EquipmentApi supplies plain functions without failure information
- **m-context-loading-removed**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "s.value()"
- **m-context-errored-removed**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "s.value()"
- **m-context-catch-removed**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick"
- **m-context-optional-catch-removed**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick"
- **m-context-provider-removed**
  - missed CONTEXT_PROVIDER_MISSING at "useContext(C)"
- **m-context-default-removed**
  - missed CONTEXT_PROVIDER_MISSING at "useContext(C)"
- **m-context-shadow-removed**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "s.value()"
- **m-context-alias-setup**
  - missed STRICT_READ_UNTRACKED at "again()"
- **m-context-method-write-memo**
  - missed REACTIVE_WRITE_IN_OWNED_SCOPE at "setCount(1)"
- **m-context-prop-child-loading-removed**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "p.value"
- **m-context-prop-child-errored-removed**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "p.value"
- **m-loading-removed**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "{m()}" | "render(App"
- **m-errored-removed**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "{total()}" | "throw new RangeError" | "render(App"
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "JSON.parse(String(x))" | "render(App" — the second failing read the removed Errored covered
- **m-catch-removed**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick"
- **m-read-moved-to-setup**
  - missed STRICT_READ_UNTRACKED at "count()" #1
- **m-write-in-memo**
  - missed REACTIVE_WRITE_IN_OWNED_SCOPE at "set(0)"
- **m-reactive-prop-read-in-setup**
  - missed STRICT_READ_UNTRACKED at "const title = props.title" — title is reactive: App passes t()
- **m-handled-catch-rethrows**
  - missed ERROR_OUTSIDE_ERRORED_BOUNDARY at "{n()}" | "throw new Error" | "render("
- **m-async-helper-rejects**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick"
- **m-pending-through-prop**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "{p.n}"
- **m-pending-read-in-setup**
  - missed PENDING_ASYNC_UNTRACKED_READ at "value()" #1
- **m-callback-prop-throws-forwarded**
  - missed UNHANDLED_HANDLER_FAILURE at "onClick" #1 | "onClick" #2 — both Leaf's and Middle's bindings call the throwing callback
- **m-effect-phase-pending**
  - missed PENDING_ASYNC_FORBIDDEN_SCOPE at "m() + 1" | "() => console.log(m() + 1)"
- **m-injected-api-ambient**
  - missed UNHANDLED_HANDLER_FAILURE at line 7 | line 8 | line 9 | line 10 | line 11 | line 12 — a name-only safe list would call these failure-free; they have no failure information
- **m-injected-api-prop**
  - missed UNHANDLED_HANDLER_FAILURE at line 8 | line 9 | line 10
- **m-equipment-row-loading-removed**
  - missed ASYNC_OUTSIDE_LOADING_BOUNDARY at "props.list()" | "<Inventory list={list} />" | "render("
