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
| **S3 Setters in plain types** (`nativeWrite`) | `plain_call_drops`, `native_write_writes` | The lowering wraps every setter that meets a plain (non-receipt) function type, as an object property or a call argument. The runtime checks the write where it runs (S1). | `native-plain-setters.test.js`, `native-write.spec.tsx` |
| **S4 Context hooks** (F-S37): the guard raises only what the declared type admits; setup admits the hook | `guard_never_fires`, `hook_in_setup`, `nullable_hook_refused`, `hook_requirement_provided` | Solid 2 sets a provider's value once and `useContext` returns it (the "set once" premise, P-CONTEXT). The guard's raise is typed from TypeScript's narrowing of the value's declared type. | `native-context.test.js`, `native-context.spec.ts` |
| **S5 Props carry callers' colors** (D-119) | `widen_monotone`, `prop_handled_by_child`, `prop_escapes_in_color`; `settled_prop_unsound` (why widening is needed) | A prop read is the `child c` operation at the child's own site, with `c` the color the caller passes (`Source<T, E, P>` with the component's type parameters, D-029). | `native-props.test.js`, ts-plugin T08 |
| **S6 Foreign routers** (F-S43): discharge only contexts provided around every render | `every_render_provided`, `foreign_router_sound`; `render_union_unsound` (why intersection) | The lowering finds every JSX render of the module-level router binding (a router used other than as a tag is not discharged). The runtime provider holds a non-unset value (the core's P-FOREIGN premise). | `native-foreign-provided.test.js` |
| **S7 Context members** (F-S45): a member call fails what its providers' members fail | `context_member_sound`, `escaping_context_unknown`; `missed_provider_unsound` (why an escaping context is unknown) | The collected values are every value the context can hold: every provider tag's `value` and the default, with no other use of the context (else `unknown`). The receiver is that context's value: `useContext(Ctx)`, through constant bindings and hooks whose every return is it. | `native-context-members.test.js` (15 cases; 14 targeted mutations killed) |
| **S9 Callback colors** (F-S46): an array callback's operations are its host's | `delegated_callback_colored`, `hole_raise_as_read`; `undelegated_callback_unsound` (why delegation) | The lowering delegates every array-method callback that runs in its own host (`yield* __nativeLexicalCallback(…)`; holes through `nativeHoleColors`). A callback given to another function is not delegated (F-S47, open). | `native-callback-colors.test.js` |
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
failures, which has the same color.

**S8.** The trace of `n` runs followed by disposal contains each cleanup
exactly when its run happened, and each cleanup comes right after its run and
before the next. Ignoring the returned cleanup runs none.

## Not covered here

- **The type-driven `yield*` insertion itself.** That a lowered program means
  what the original meant is checked by parity, not proved. The evidence is the
  native harnesses' DOM comparisons with each original: Todos, Sierpinski,
  Hacker News, and the dashboard (30 states, streamed SSR, hydration). The
  compiler correspondence remains the core's P-ENCODING obligation.
- **Failure inference precision.** S7 is soundness only. Every unresolved call
  is `unknown`, which is sound and may be imprecise.
- **Solid's runtime.** "Set once" providers, owner cleanup order and
  `useContext` throwing without a provider are Solid 2 facts, used as premises
  (the core's trust boundary).
