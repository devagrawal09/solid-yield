# Native effect: structural blocker (2026-10-08)

Starting code: `10e1743`, branch `proto/sugar`. The unchanged original does not
reach the two-half acceptance. Both halves **FAIL**: the first cannot establish
a correct model diagnostic snapshot; the second has no checked native program
to run. Hydrated parity and SSR were not run. This is a structural lowering
failure, not an accepted author-error diagnostic.

Reproduce with `node scripts/native-effect-blocker.mjs`. The script selects all
seven original TypeScript files, records the first transform refusal, and checks
two isolated probes. Each probe passes ordinary TypeScript before lowering and
fails after lowering. [The evidence](native-effect-blocker.json) contains the
complete original/generated probe text and verbatim TypeScript diagnostics.
Neither probe edits the original. Generated probe files are ignored scratch files.

## F-S30: foreign generators use a different protocol

| Plain Effect source (typecheck PASS) | Native output (TS2345) |
| --- | --- |
| `Effect.gen(function* () { yield* Effect.sleep(1); return 1; })` | `Effect.gen(function* () { yield* __nativeAttempt(() => Effect.sleep(1), error => __nativeFailure(["unknown"], error)); return 1; })` |

`lowerNativeEffects` seeds **every authored generator** as a routine. `Effect.gen`
expects yielded `YieldWrap<Effect<...>>` values; the inserted attempt yields
solid-yield `Raise<NativeFailure<"unknown">>` operations. Effect's driver cannot
run those operations. This happens even in a generator with no Solid API,
reactive read or write. It is a compiler bug, not an unhandled author failure.
Opaque generators must retain their protocol, with checked adapters at actual
crossings. Treating every generator as an action or catching its failure does
not supply that adapter.

The twin keeps `api.ts`'s Effect programs plain. Its `solid-effect.ts` explicitly
adapts the saga driver: `attempt` surrounds `it.next()` / `it.throw()` and the
awaited fiber exit, while Effect steps remain Effect steps. Copying that whole
driver into an author patch would change the integration, rather than handle a
diagnostic in plain Solid.

## F-S31: the module log has no generated owner/event bridge

| Unchanged original `src/log.ts:22,28` | Isolated native output `:13,17` | Twin oracle |
| --- | --- | --- |
| `const [entries, setEntries] = createStore<LogEntry[]>([]);` at module scope | Import renamed to `$store`, but the same destructuring remains at module scope | `createLog()` delegates `$store` in App's setup |
| `setEntries(list => { ... })` from `Effect.sync` and finalizers | `setEntries` has inferred type `Create<"store", never>` and is not callable (TS2349) | An `$event` writer is registered as `sink`; `log()` calls that event |

The original store lives for the module. The twin's store lives for App's owner
and removes its writer on cleanup. That is an oracle lowering pattern, **not**
permission to move module state into App in an author patch. Native mode needs
to preserve the module's sharing/lifetime and correctly bridge Effect's scheduler
to the writer, or retain the smallest checked plain-Solid boundary. Renaming the
import cannot preserve either contract. No new lifetime or boundary rule is
introduced here.

## F-S32: the first refusal points into intermediate code

The unchanged transform throws this verbatim message (absolute workspace prefix
removed):

```text
[SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole. (examples/originals/effect/src/api.ts:177:68)
```

Original `api.ts:177` logs an inventory interruption. The refused intermediate
line instead contains the search-success `Effect.tap` callback from original
`api.ts:113–114`:

```ts
Effect.tap(results =>
  Effect.sync(() => log("success", `search "${query}" → ${results.length} results`))
)
```

This callback supplies an Effect program to Effect's scheduler, not a rendered
value. The transform has introduced attempts/routine calls across the foreign
protocol without a host adapter. It cannot be recorded as a correct diagnostic
at original line 177. Adding an `Errored` at that line would neither repair the
foreign generator protocol nor execute the module store correctly.

## Acceptance and repository state

- Half A (unchanged diagnostic correctness): **FAIL**, structural refusal and
  incorrect original location; no acceptance snapshot.
- Half B (minimal author fix + hydrated parity + SSR): **FAIL**, no justified
  author edit and no checked output. No patch exists.
- Rule change: **none**. No callback exception, failure erasure, new fallback,
  moved store lifetime, or relaxation of the bounded native contract.
- All `examples/originals/effect` files remain byte-identical to `HEAD`.
- No native effect steps were added. The gate baseline was not regenerated.
- Verification before the local evidence commit: `pnpm build` passed;
  `node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json`
  finished **69 pass / 0 fail / 0 skip in 170s**, **GREEN**, with no regressions.
  This checks the existing gate; it does not establish native effect acceptance.

The requested structural stop applies. A full native-effect acceptance harness
must follow repairs to the generator, lifetime and host boundaries; this evidence
script is deliberately outside the gate and does not count as native acceptance.
