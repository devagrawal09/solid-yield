# Sugar mode obligations (2026-10-10)

Sugar mode lowers native plain Solid to yield routines
([design](../sugar-design.md)). These are the obligations the lowering adds to
the λ-yield core, in the same abstract model as [the core proofs](README.md).
[SugarProofs.lean](lean/SugarProofs.lean) states and proves them on top of
`YieldProofs`.

**Status: written, not machine-checked yet.** This session's network policy
refuses `release.lean-lang.org`, so the Lean 4.24.0 toolchain could not be
installed. Run `lake build` in `lean/` to check both libraries. Until then the
theorems are paper proofs written in Lean syntax. Each one is short, and most
are corollaries of a checked core theorem. The runtime and compiler behaviour
each one models is pinned by the tests listed beside it.

As in the core, these are **relative** results. They check the rules the
lowering relies on, not the compiler. The last column names the implementation
premise: what the lowering or runtime must establish for the theorem to apply.

| Obligation | Theorem(s) | Implementation premise | Pinned by |
| --- | --- | --- | --- |
| **S1 Writes** (F-S40, `nativeWrite`): only an event or an effect's phase writes | `write_admitted_iff`, `writing_routine_host`, `hole_refuses_write`, `view_refuses_write` | A writing callback prop is typed with the event's operations (`__nativeLexicalCallback("event", …)`). | `native-callback-props.test.js` |
| **S2 Event-phase hosting** (runtime fix): an event-phase callback runs in the event that calls it | `event_phase_runs_in_caller`; `created_host_refuses` (the old behaviour) | `nativeHostCallback(body, deferred, callerEvent)` uses the caller's state when `state.host === EVENT`. | `native-write.spec.tsx` ("runs a callback prop created in a view…", which fails without the fix) |
| **S3 Setters in plain types** (`nativeWrite`) | `plain_call_drops`, `native_write_writes` | The lowering wraps every setter that meets a plain (non-receipt) function type, as an object property or a call argument. The runtime checks the write where it runs (S1). A library setter's call is delegated even when it is given a hoisted callback (F-S47), whose type would otherwise hold its delegation back. | `native-plain-setters.test.js`, `native-write.spec.tsx`, `native-callback-colors.test.js` (setter given a hoisted callback) |
| **S4 Context hooks** (F-S37): the guard raises only what the declared type admits; setup admits the hook | `guard_never_fires`, `hook_in_setup`, `nullable_hook_refused`, `hook_requirement_provided` | Solid 2 sets a provider's value once and `useContext` returns it (the "set once" premise, P-CONTEXT). The guard's raise is typed from TypeScript's narrowing of the value's declared type. | `native-context.test.js`, `native-context.spec.ts` |
| **S5 Props carry callers' colors** (D-119) | `widen_monotone`, `prop_handled_by_child`, `prop_escapes_in_color`; `settled_prop_unsound` (why widening is needed) | A prop read is the `child c` operation at the child's own site, with `c` the color the caller passes (`Source<T, E, P>` with the component's type parameters, D-029). An author-generic component's open prop (`value: T`, F-S50) is declared `Source<T, never, false>` and widened the same way, per instantiation: `T` is the value's type, not its color. | `native-props.test.js`, ts-plugin T08, `native-generics.test.js` |
| **S6 Foreign routers** (F-S43): discharge only contexts provided around every render | `every_render_provided`, `foreign_router_sound`; `render_union_unsound` (why intersection) | The lowering finds every JSX render of the module-level router binding (a router used other than as a tag is not discharged). The runtime provider holds a non-unset value (the core's P-FOREIGN premise). | `native-foreign-provided.test.js` |
| **S7 Context members** (F-S45): a member call fails what its providers' members fail | `context_member_sound`, `escaping_context_unknown`; `missed_provider_unsound` (why an escaping context is unknown) | The collected values are every value the context can hold: every provider tag's `value` and the default, with no other use of the context (else `unknown`). The receiver is that context's value: `useContext(Ctx)`, through constant bindings and hooks whose every return is it. | `native-context-members.test.js` (15 cases; 14 targeted mutations killed) |
| **S9 Callback colors** (F-S46, F-S47): a lexical callback's operations are its host's | `delegated_callback_colored`, `hole_raise_as_read`; `undelegated_callback_unsound` (why delegation) | The lowering delegates every lexical callback that runs in its own host (`yield* __nativeLexicalCallback(…)`; holes through `nativeHoleColors`). An array method's callback is delegated in place. A callback given to any other function is hoisted into a binding just before its host's statement and delegated there (F-S47). It is left in place, undelegated, only when it uses a binding a parameterless thunk between it and its host declares. | `native-callback-colors.test.js` |
| **S10 Requirements through generic wrappers** (F-S49): a call carries what its holes require | `wrapped_need`, `hole_requirement_carried`; `dropped_requirement_unsound` (why the parameter) | A wrapper the lowering makes generic gets `_R = never` and `& NativeRequiring<_R>`; the plain-call overload admits holes requiring `_R` and adds `_R` to the call's requirements (`HoleQ`). TypeScript infers `_R` from each call's holes. | `native-hole-requirements.test.js`, `context.type-tests.tsx` (F-S49 block) |
| **S11 Props through `lazy`** (D-119 with F-S51): a lazy page's props take the union of its callers' colors | `lazy_union_bounds`; `missed_caller_unsound` (why every caller is collected) | Every JSX use of a lazy binding of a native page is a collected call site, and each passes the color TypeScript infers for its prop. | `native-lazy-props.test.js` |
| **S12 Context facades** (F-S52): a retyped slot bounds what the context holds | `facade_bounds_held`; `plain_slot_unsound` (why the slot is retyped) | A declared function slot given a source or routine it does not admit is retyped to the union of the types its providers in the declaring file put there. TypeScript then checks every provider's value, in any file, against the retyped context, with `Source<T, E, P>` covariant in `E` and `P`. | `native-factories.test.js`, `native-context-facades.test.js` |
| **S13 Loop-driven generators** (F-S53): a generator a loop drives raises what its body raises | `loop_driven_sound`, `foreign_driver_unknown`; `foreign_driver_unsound` (why other generators stay unknown) | The call is the iterable of a `for…of` or `for await…of` itself, so only that loop calls `next()` and `return()`. Its iterator is not bound, returned or passed on. | `failure-inference.test.mjs` (loop-driven generators) |
| **S14 Root renderers** (F-S53): a render call raises only its arguments' failures | `renderer_sound`; `unchecked_root_unsound` (why the root is checked) | Every native root reaches its renderer through the root check: a bare root as `foreign(App satisfies RootCheck<typeof App>)`, a lifted root as `foreign(__nativeRoot satisfies RootCheck<typeof __nativeRoot>)`. A foreign handoff's residual failures must be empty. | `native-entries.test.js`, `failure-inference.test.mjs` (root renderer) |
| **S15 Kept promises** (found by mutation): a promise kept as a value is attempted where it is awaited | `kept_async_sound`; `kept_sync_unsound` (why a non-`async` callee keeps its attempt) | The callee is an `async` function declared in the program, and the call's promise is bound or passed on (not awaited, returned or discarded) inside an async routine. The await that consumes it is attempted. | `native-promises.test.js`; mutation catalog `remove-await` |
| **S8 Effect cleanup** (F-S42): a returned cleanup runs before the next run and at disposal, once each | `clean_mem_iff`, `run_mem_iff`, `clean_before_next_run`; `ignoring_never_cleans` (the old lowering) | `onCleanup` registered in the effect phase runs before the owner's next run and at disposal (Solid 2's owner contract). | `native-effect-cleanup.test.js` |

## What each result means

**S1–S3.** `Admits h .write` holds exactly for the effect phase and events.
A callback prop whose body writes therefore cannot be hosted by the JSX hole
that creates it (F-S40). It is typed as an event, and S2 makes the runtime agree.
The callback runs in its caller's event, so the write is admitted where it
happens. S3 models a receipt as a deferred state transition. A plain function
type's caller drops it; `nativeWrite` performs it. The theorems are definitional.
Their content is in the modelling: no write is lost, and none is performed
twice.

**S4.** With a provider above, the held value satisfies the context's
declared type. A guard whose test that type rules out never fires, and its
raise is not in the hook's operations. The hook is then `[context q]`, which
setup admits. A type that admits the guard's value keeps the raise, and setup
refuses it. Without a provider, `useContext` throws first. That case is the
hook's requirement, routed to a provider in any accepted root (the core's
`root_no_missing_context`).

**S5.** `mapChild g` replaces every prop read's color. If `g` only widens,
the call's color only widens (`widen_monotone`). Any observation of the passed
color that the child's own frames handle never reaches the caller. Any it does
not handle is in the call's color, where the callers' boundaries or the root
must cover it. Typing a pending value as settled loses its pending
(`settled_prop_unsound`), which is why the lowering widens instead.

**S6.** `everyRender paths` is the intersection over the router's render
paths. Checking a route component against it gives `ProvidedAt` at each path,
and the core's `foreign_context` routes every requirement to a provider. A union
would discharge a context one render lacks; `render_union_unsound` exhibits that.

**S7.** The inference's union over the collected values bounds the member's
actual failures whenever the held value is among them. A held value outside
the collection can fail outside the union, which is why an escaping context,
or a provider value that is not an object literal, makes the call `unknown`
(top, always sound).

**S9.** Folding is union, so a delegated callback's colors are in its host's
(`fold_append`). Without delegation, a failing read inside the callback is an
observation outside the host's color, exactly the gap F-S46 closed. In a hole
the lowering presents a raise as a settled read failing with the same
failures, which has the same color. Hoisting (F-S47) creates the callback a
statement earlier and delegates it there. Creating a function has no effect, and
delegation adds the callback's color whether or not the callee calls it, so the
host's color is an upper bound either way.

**S10.** A requirement passes every frame but a provider, so a need the
wrapper's subtree emits is one its hole emits (`wrapped_need`), and the call's
color with the parameter contains it. The caller's providers then discharge it,
or the root refuses it (`root_no_missing_context`). Without the parameter the
call would report none while the subtree still emits it.

**S11.** S5's results hold for any color above the one a call passes, and the
union over every collected caller is above each one. A caller the collection
misses could pass what the union lacks, so collection must be complete.

**S12.** A declared plain function type carries no color, while the held
source may be pending or failing. Retyping the slot to the provided type, with
TypeScript checking each provider against it, makes the slot's color an upper
bound for every value the context can hold. This is S7's argument for colors
in place of failures.

**S13.** A foreign driver can inject a failure with `throw()`, so an opaque
generator's failures are `unknown` (top). A loop injects nothing, so there the
body's own failures bound what iterating raises. The body's failures are
computed in the same fixpoint, so a generator that loops over another composes.

**S14.** The inference leaves a render call's root failures out of the
enclosing function, so an entry function that renders stays a plain function.
This is sound because the root check, not the enclosing function, owns those
failures: a checked root leaves none, so the arguments bound what the call
raises. An unchecked root could raise what no argument does.

**S15.** Attempting a call awaits it, so attempting a kept promise where it
is made would read the resolved value where the original holds a promise
(found by the mutation corpus: the lowered program read `data.title` where the
original reads `undefined`). An `async` callee raises nothing where it is
called, so its failures are all its promise's rejection, which the attempt at
the await accounts for. A callee that is not `async` can throw before it
returns, so leaving its call plain would lose that failure.

**S8.** The trace of `n` runs followed by disposal contains each cleanup
exactly when its run happened, and each cleanup comes right after its run and
before the next. Ignoring the returned cleanup runs none.

## Not covered here

- **The type-driven `yield*` insertion itself.** Native apps ship as written
  (D-120): the lowered program is the checker's model of them, and these
  results are about that model. That it means what the original meant is
  checked by parity, not proved. The evidence is the
  native harnesses' DOM comparisons with each original: Todos, Sierpinski,
  Hacker News, and the dashboard (30 states, streamed SSR, hydration). The
  compiler correspondence remains the core's P-ENCODING obligation.
- **Failure inference precision.** S7 and S13 are soundness only. Every
  unresolved call is `unknown`, which is sound and may be imprecise.
- **Solid's runtime.** "Set once" providers, owner cleanup order and
  `useContext` throwing without a provider are Solid 2 facts, used as premises
  (the core's trust boundary).
