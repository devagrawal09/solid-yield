# Native Effect: F-S34 stop after three compiler fixes (2026-10-08)

The three requested fixes are implemented. Effect still reaches a new compiler
blocker, **F-S34**, so the requested stop rule applies. Both acceptance halves
fail; this is not native Effect acceptance. No author patch is applied.

Reproduce with `node scripts/native-effect-blocker.mjs`. It verifies the current
refusal, the module-state location, isolated Effect-generator and log-store
checks before and after lowering, and unchanged hashes of all seven original
TypeScript files. [Full evidence](native-effect-blocker.json) records the exact
read, host, positions, probes and original hashes.

| Fix | Result |
| --- | --- |
| Generator ownership / F-S30 | Direct generator callbacks to core APIs lower; other author generators keep their protocol. Native Todos passes without an exception list. |
| Module state / F-S31 | `log.ts:20:7` reports `MODULE_STATE`; the store retains its Solid import and lifetime. |
| Lexical callback host | The index reads inside checkout's store updaters at lines 141 and 152 no longer refuse. Updater, array, Promise, nested-arrow, memo and both effect-phase fixtures pass. |
| Event chain arguments / F-S33 | Checkout's cart/decline arguments at line 185 stay inside the event. Sync and async chained-call fixtures pass generated checks. |

The core generator APIs in installed Solid 2 rc.13 are `action`, `createSignal`,
`createMemo`, `createOptimistic`, `createEffect`, `createRenderEffect`,
`createStore`, `createProjection`, and `createOptimisticStore`. `action` supports
sync/async generators; the others accept async-iterable producers in argument 0.

## F-S34: a setup helper's context read loses its host

| Author source, `solid-effect.ts:51–52` | Generated read inside a plain producer |
| --- | --- |
| `const parent = useContext(RuntimeContext);` then `ManagedRuntime.make(layer, parent?.memoMap)` | `() => ManagedRuntime.make(layer, parent()?.memoMap)` |

Author, verbatim (`solid-effect.ts:50–55`):

```ts
export function createRuntime<R>(layer: Layer.Layer<R>): ManagedRuntime.ManagedRuntime<R, never> {
  const parent = useContext(RuntimeContext);
  const runtime = ManagedRuntime.make(layer, parent?.memoMap);
  onCleanup(() => void runtime.dispose());
  return runtime;
}
```

Refused generated host, verbatim:

```ts
() => ManagedRuntime.make(layer, parent()?.memoMap)
```

The emitted accessor read is `parent()`. Its author has a setup helper under an
owner. Lowering puts the read inside a plain failure producer and then refuses
it as an unknown callback. The position record is marked generated and points
at the helper name `createRuntime` at line 50, column 17, rather than the context
value use at line 52. This is a compiler host/mapping gap, not a valid author
restriction. No attempt is made to fix it or work around it in the source.

## Diagnostics, verbatim

```text
[MODULE_STATE] reactive state created at module level has no owner; create it inside a component and provide it via context, or keep it foreign and handle failures at its uses (examples/originals/effect/src/log.ts:20:7)
[SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole. (examples/originals/effect/src/solid-effect.ts:50:17)
```

The first diagnostic has the correct source location. The second is the
observed F-S34 compiler failure, with the incorrect source location described
above. This pair is evidence, not an accepted diagnostic snapshot.

## Patch, verbatim

The patch is the empty string (`""`). No author lines are changed. The old
checkout index-hoisting candidate is removed because the compiler now handles
those callbacks. A module-state restructuring is not attempted after the new
blocker: it would not produce a checked native program.

## Acceptance and validation

- Half A, unchanged source → exact correct diagnostics: **FAIL**. The module
  note is correct, but F-S34 is a compiler failure with a generated position.
- Half B, minimal patch → hydrated parity, SSR, matching failure behavior:
  **FAIL / not run**. No checked native Effect program exists; stop rule applies.
- Isolated foreign Effect generator and module log store: **PASS** before and
  after lowering. All seven original source files remain byte-identical.
- Native Effect is not added to the gate, and the baseline is not regenerated.
  No existing check or threshold is removed or relaxed.
- Final validation: `pnpm build` **PASS**; the full gate **GREEN: 69 pass /
  0 fail / 0 skip in 271s**. All five native Todos steps pass, including client
  and hydrated parity plus SSR. The refreshed audit accepts 55 fixtures.
- Earlier local commits `8337506` (generator/module rules) and `7d3f20f`
  (lexical callbacks) each followed a green 69-step gate: 164s and 506s.
  The final chained-call fix and this F-S34 report also follow the green gate.
  All commits stay local on `proto/sugar`; no push or main change occurred.
