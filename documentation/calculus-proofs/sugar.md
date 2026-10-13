# Sugar mode obligations (2026-10-10)

Sugar mode lowers native plain Solid to yield routines
([design](../sugar-design.md)). These are the obligations the lowering adds to
the λ-yield core, in the same abstract model as [the core proofs](README.md).
[SugarProofs.lean](lean/SugarProofs.lean) states and proves them on top of
`YieldProofs`.

**Status: machine-checked (2026-10-12).** `lake build` in `lean/` builds both
libraries with Lean 4.24.0 (the toolchain `lean-toolchain` pins; installed from
the Lean GitHub release, since the session's network policy refuses
`release.lean-lang.org`). Every `#print axioms` reports only Lean's standard
axioms (`propext`, `Classical.choice`, `Quot.sound`) or none: no `sorryAx`.
The runtime and compiler behaviour each theorem models is pinned by the tests
listed beside it.

As in the core, these are **relative** results. They check the rules the
lowering relies on, not the compiler. The last column names the implementation
premise: what the lowering or runtime must establish for the theorem to apply.

| Obligation | Theorem(s) | Implementation premise | Pinned by |
| --- | --- | --- | --- |
| **S1 Writes** (F-S40, `nativeWrite`): only an event or an effect's phase writes | `write_admitted_iff`, `writing_routine_host`, `hole_refuses_write`, `view_refuses_write` | A writing callback prop is typed with the event's operations (`__nativeLexicalCallback("event", …)`). | `native-callback-props.test.js` |
| **S2 Event-phase hosting** (runtime fix): an event-phase callback runs in the event that calls it | `event_phase_runs_in_caller`; `created_host_refuses` (the old behaviour) | `nativeHostCallback(body, deferred, callerEvent)` uses the caller's state when `state.host === EVENT`. | `native-write.spec.tsx` ("runs a callback prop created in a view…", which fails without the fix) |
| **S3 Setters in plain types** (`nativeWrite`) | `plain_call_drops`, `native_write_writes` | The lowering wraps every setter that meets a plain (non-receipt) function type, as an object property or a call argument. The runtime checks the write where it runs (S1). A library setter's call is delegated even when it is given a hoisted callback (F-S47), whose type would otherwise hold its delegation back. | `native-plain-setters.test.js`, `native-write.spec.tsx`, `native-callback-colors.test.js` (setter given a hoisted callback) |
| **S4 Context hooks** (F-S37): the guard raises only what the declared type admits; setup admits the hook | `guard_never_fires`, `hook_in_setup`, `nullable_hook_refused`, `hook_requirement_provided` | Solid 2 sets a provider's value once and `useContext` returns it (the "set once" premise, P-CONTEXT). The guard's raise is typed from TypeScript's narrowing of the value's declared type. A context with a default requires nothing and its read cannot fail, so its read is no operation (`nativeUseContext` yields nothing for `Q = never`) and is admitted wherever Solid's `useContext` is, a memo included. | `native-context.test.js`, `native-context.spec.ts` |
| **S5 Props carry callers' colors** (D-119) | `widen_monotone`, `prop_handled_by_child`, `prop_escapes_in_color`; `settled_prop_unsound` (why widening is needed) | A prop read is the `child c` operation at the child's own site, with `c` the color the caller passes (`Source<T, E, P>` with the component's type parameters, D-029). An author-generic component's open prop (`value: T`, F-S50) is declared `Source<T, never, false>` and widened the same way, per instantiation: `T` is the value's type, not its color. An accessor prop (`results: () => T`, F-S54) its callers pass a source is declared `T`, so it widens the same way; a call of it is a read. | `native-props.test.js`, ts-plugin T08, `native-generics.test.js` |
| **S6 Foreign routers** (F-S43): discharge only contexts provided around every render | `every_render_provided`, `foreign_router_sound`; `render_union_unsound` (why intersection) | The lowering finds every JSX render of the module-level router binding (a router used other than as a tag is not discharged). The runtime provider holds a non-unset value (the core's P-FOREIGN premise). | `native-foreign-provided.test.js` |
| **S7 Context members** (F-S45): a member call fails what its providers' members fail | `context_member_sound`, `escaping_context_unknown`; `missed_provider_unsound` (why an escaping context is unknown) | The collected values are every value the context can hold: every provider tag's `value` and the default, with no other use of the context (else `unknown`). The receiver is that context's value: `useContext(Ctx)`, through constant bindings and hooks whose every return is it. | `native-context-members.test.js` (15 cases; 14 targeted mutations killed) |
| **S9 Callback colors** (F-S46, F-S47): a lexical callback's operations are its host's | `delegated_callback_colored`, `hole_raise_as_read`; `undelegated_callback_unsound` (why delegation) | The lowering delegates every lexical callback that runs in its own host (`yield* __nativeLexicalCallback(…)`; holes through `nativeHoleColors`). An array method's callback is delegated in place. A callback given to any other function is hoisted into a binding just before its host's statement and delegated there (F-S47). It is left in place, undelegated, only when it uses a binding a parameterless thunk between it and its host declares. | `native-callback-colors.test.js` |
| **S10 Requirements through generic wrappers** (F-S49): a call carries what its holes require | `wrapped_need`, `hole_requirement_carried`; `dropped_requirement_unsound` (why the parameter) | A wrapper the lowering makes generic gets `_R = never` and `& NativeRequiring<_R>`; the plain-call overload admits holes requiring `_R` and adds `_R` to the call's requirements (`HoleQ`). TypeScript infers `_R` from each call's holes. | `native-hole-requirements.test.js`, `context.type-tests.tsx` (F-S49 block) |
| **S11 Props through `lazy`** (D-119 with F-S51): a lazy page's props take the union of its callers' colors | `lazy_union_bounds`; `missed_caller_unsound` (why every caller is collected) | Every JSX use of a lazy binding of a native page is a collected call site, and each passes the color TypeScript infers for its prop. | `native-lazy-props.test.js` |
| **S12 Context facades** (F-S52): a retyped slot bounds what the context holds | `facade_bounds_held`; `plain_slot_unsound` (why the slot is retyped) | A declared function slot given a source or routine it does not admit is retyped to the union of the types its providers in the declaring file put there. TypeScript then checks every provider's value, in any file, against the retyped context, with `Source<T, E, P>` covariant in `E` and `P`. | `native-factories.test.js`, `native-context-facades.test.js` |
| **S13 Loop-driven generators** (F-S53): a generator a loop drives raises what its body raises | `loop_driven_sound`, `foreign_driver_unknown`; `foreign_driver_unsound` (why other generators stay unknown) | The call is the iterable of a `for…of` or `for await…of` itself, so only that loop calls `next()` and `return()`. Its iterator is not bound, returned or passed on. | `failure-inference.test.mjs` (loop-driven generators) |
| **S14 Root renderers** (F-S53): a render call raises only its arguments' failures | `renderer_sound`; `unchecked_root_unsound` (why the root is checked) | Every native root reaches its renderer through the root check: a bare root as `foreign(App satisfies RootCheck<typeof App>)`, a lifted root as `foreign(__nativeRoot satisfies RootCheck<typeof __nativeRoot>)`. A foreign handoff's residual failures must be empty. | `native-entries.test.js`, `failure-inference.test.mjs` (root renderer) |
| **S15 Kept promises** (found by mutation): a promise kept as a value is attempted where it is awaited | `kept_async_sound`; `kept_sync_unsound` (why a non-`async` callee keeps its attempt) | The callee is an `async` function declared in the program, and the call's promise is bound or passed on (not awaited, returned or discarded) inside an async routine. The await that consumes it is attempted. | `native-promises.test.js`; mutation catalog `remove-await` |
| **S16 Sagas driven inside an action** (D-121): a saga's writes run in the action that drives it | `driven_saga_write_admitted`; `memo_driven_saga_refused` (why every call of the saga must be inside the action) | Every use of the driver's parameter is a direct call whose nearest function is the generator given to Solid's `action` (`native-sagas.js` checks it through TypeScript). The iterator it returns is stepped there and not handed out. A write in a callback nested in the saga is left plain: it may run outside the action. | `native-effect-model.test.js` (sagas) |
| **S17 Provider values in the provider's owner** (D-122): an `init`'s failures are the provider's | `init_admits_cleanup`, `provider_bounds`; `init_dropped_unsound` (why the init's failures join the provider's color) | `Ctx.provide({ init, children })` runs `init` once, as a setup, inside Solid's provider root (`setContext(provider, props.value)` reads `value` once); its type adds `FailsOf<Y>` and `RequiresOf<Y>` to the provider's. The lowering moves a value there only when its operations are setup operations or a raise. | `provider-init.spec.tsx`, `context.type-tests.tsx` (D-122), `native-effect-model.test.js` (D-122) |
| **S18 A failing call in a JSX hole** (2026-10-12): its failure is the hole's, a failing read of the view | `hole_hosted_in_view`, `hole_raise_as_read` (S9); `raise_in_view_refused` (why the wrapper is needed) | `nativeHole(work)` is typed `Yieldable<HoleViewOp<Y>, R>`: a `Raise<E>` becomes `Read<false, E>`, a stream attempt nothing (its failures reach its handler). At run time the compiled JSX hole runs the work as a hole, where a raise is admitted. The lowering wraps only an attempt directly in a JSX expression (no function between), and drops the wrapper with the attempt when the call turns out to be a source's or a routine's. | `native-hole-failures.test.js` |
| **S19 A promise given to For** (2026-10-12): the list is the promise itself, not what awaiting it gives | `boxed_keeps_made`, `boxed_no_wait`, `boxed_list_is_original`; `awaited_list_unsound` (why the attempt is boxed) | The call is the whole value of a `For` (from `solid-js`) `each` and returns a promise; its attempt takes `{ value: call }`, which is not a promise, so the attempt catches what making the call raises and waits for nothing. The library's `For` refuses an `each` whose value is not a list (`EachRule`, `[FOR_EACH]`), as Solid's `For` fails on one at run time. | `native-hole-failures.test.js` (a promise given to For), `jsx.type-tests.tsx` (`PromiseEach`); mutation catalog `non-core-cache` |
| **S20 The insertion itself** (2026-10-12): the lowered routine computes what Solid computes | `insertion_preserves`, `eval_depends_on_trace`, `lowered_reads_are_dependencies` (with `run_bind`); `snapshot_untracked` (why every source read needs its `yield*`) | On a core of plain Solid expressions (literals, plain calls, source reads, sums, conditionals, `throw`), the lowering inserts `yield*` at exactly the reads TypeScript types as sources (an accessor call, a store path, a memo) and leaves every other call plain; the driver returns a settled source's value and tracks it, and suspends on a pending one, as Solid's read does (`NotReadyError`). The premise is checked on the real lowering by a differential run, not proved. | `scripts/native-insertion/check.mjs` (`native:insertion`: seeded programs as written and lowered, every slot through writes); `native.test.js`, `native-jsx-holes.test.js`, `native-receivers.test.js`; the native parity harnesses |
| **S21 Props are getters** (D-119, 2026-10-13): a child reads its caller's expression where it reads the prop | `lowerWith_subst` (lowering is compositional), `prop_reads_are_callers`; `settled_prop_untracked` (why a prop is a getter) | A prop read in the lowered child delegates to the caller's lowered expression (the lowering passes props as getters, `Source<T, E, P>` per D-119), so it runs and tracks at the child's read. | `native-props.test.js`, ts-plugin T08, `native:insertion` (each memo crosses a child's prop) |
| **S22 Events and reruns** (2026-10-13): an event writes what Solid writes; a computation reruns exactly when it must | `event_preserves`, `event_untouched`, `untouched_keeps`, `memo_cache_consistent` | An event's writes are its setters' calls in order, each value computed as its expression is (S1, S3); Solid reruns a computation when an event wrote one of its tracked reads. | `native:insertion` (twelve writes per program, every slot compared after each), the native parity harnesses |
| **S23 Boundaries, lists and effects** (2026-10-13): they compose S20–S22 | `boundary_sees_same`, `rows_preserve`, `effect_preserves` | `Errored` and `Loading` map the outcome their content gives (a failure, a suspension) to the fallback; a list runs its row once per item with the item as the row's prop; an effect hands its compute's value to a phase that writes as an event does (S8 for its cleanup). | `native:insertion` (every slot inside its own `Errored` and `Loading`), the native parity harnesses (Todos' lists, the dashboard's effects) |
| **S24 Untracked reads and inline routines** (2026-10-13, D-124): `untrack` keeps the outcome and tracks nothing; an IIFE, a called-only local function, a getter or a method is its caller's | `surface_preserves`, `untrack_tracks_nothing`, `inline_reads_are_hosts`, `inline_pending_suspends_host` | Solid's `untrack` computes its body without tracking (a pending read still suspends); a function called in place runs its body where it is called. | `native:surface` (the pending variant: each form's pending read reported where Solid suspends), `native-forms.test.js` |
| **S25 Statements** (2026-10-13, D-124): locals, sequencing, branches, loops, `throw` and `try` | `statements_preserve` (with `runS_bind`, `toS_run`, `iter_run`), `catch_passes_pending`, `catch_takes_failure` | A statement's expressions are S20's with the locals they name put in; a loop's count is read once (an array callback's list, a bound); `try` is `nativeTry`, which hands a failure to the handler and rethrows a suspension. | `native:surface` (every statement form in all seven hosts, reading, writing and pending), the surface mutants (`scripts/mutation`, 70 programs) |
| **S26 Callbacks run at once** (2026-10-13, found by the surface mutants): an array method's callback is an inline routine of its host; a kept promise's rejection reaches what is chained on it | `each_preserves`, `callback_raise_fails_host`, `plain_callback_unsound`; `chained_carries_rejection`, `chained_receiver_dropped_unsound` | `every`, `reduce`, `sort`'s comparator call the callback element by element where the method is called; its first throw ends the method and propagates; `promise.then(k)` rejects with the promise's rejection | `native-forms.test.js` (`plain-callback-throw-in-memo`, `store-callback-throw-in-memo`, `kept-promise-rejects-through-then`), `native:surface` |
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

**S16.** A setter call in a hand-driven saga cannot be delegated: the
saga's `yield*` hands values to its driver. Performed where it is made, the
write runs in whatever host is running the saga's step. The driver is checked
to step it only inside an action, an event, so the write is admitted there, as
in the original. Driven from a memo, it would not be.

**S17.** Solid computes a provider's value in the provider's own owner,
so what it creates and cleans up is the provider's, and what it throws is
caught above the provider. The `init` runs there as a setup does; its failures
are added to the provider's color, which then bounds both the init's and the
children's. Leaving them out would let a failure pass the boundary check.

**S18.** A view admits reads, child views and binds, not a raise; a hole admits
a raise. The work of a call that may fail, made in a JSX hole, runs where the
view evaluates the hole, so it is the hole's. Seen from the view, its raise is a
settled read failing with the same failures, which the view admits and the
boundary above takes. Left in the view, the raise is refused.

**S19.** Solid's `For` maps the list it is given where it reads it; a promise is
not a list, and it fails on one. Attempting the call there would await the
promise and map the resolved list, so the model would accept what the original
fails on. Boxed, the attempt still takes what making the call raises, and the
list is the original's promise, which `For`'s type refuses.

**S20.** The lowering is generator sequencing (`Prog.bind`), so running it is running its parts in order (`run_bind`); by induction on the expression, the lowered routine gives Solid's outcome and Solid's tracked reads, in order, up to and including the read that suspends (`insertion_preserves`). Solid's tracked reads are what the outcome depends on: a store that agrees on them gives the same evaluation (`eval_depends_on_trace`), so the lowered routine's reads are exactly its dependencies and Solid reruns it exactly when it must (`lowered_reads_are_dependencies`). A value read once and kept is tracked by nothing (`snapshot_untracked`): that is the read in setup that `READ_IN_SETUP` refuses.

**S21.** A child's prop reads delegate to the caller's lowered getters. Lowering is compositional (`lowerWith_subst`): the child lowered that way is the lowering of the child with the caller's expressions put where it reads them. So by S20 it computes what Solid computes with getter props, reads tracked at the child's read site (`prop_reads_are_callers`). A value the caller read once and passed is tracked by nothing in the child (`settled_prop_untracked`): the reason D-119 widens a prop rather than settling it.

**S22.** The lowered event leaves the store Solid's event leaves (`event_preserves`, by S20 at each write), and an event changes only the sources it writes (`event_untouched`). So a computation none of whose tracked reads the event wrote keeps its result (`untouched_keeps`): Solid not rerunning it is right, and one it does rerun computes Solid's result at the new store (S20). A memo's cache stays Solid's outcome under the same condition (`memo_cache_consistent`).

**S23.** A boundary maps the outcome it is given, and by S20 the lowered content gives Solid's outcome (`boundary_sees_same`). A list's row is a component whose prop is the item: by S21 each lowered row computes what Solid's row computes (`rows_preserve`). An effect computes a value and hands it to a phase that writes: by S20 and S22 the lowered effect leaves the store Solid's effect leaves (`effect_preserves`).

**S24.** S20's core gains `untrack(e)` and an inline routine (an IIFE, a local function only ever called, a getter or a method read where it is called). The lowering makes the first `nativeUntrack`, run step by step untracked, and the second a generator delegated in place; the lowered routine still computes Solid's outcome and tracked reads (`surface_preserves`). `untrack` tracks nothing yet keeps its outcome, so a pending read in it still suspends: no color is cast away (`untrack_tracks_nothing`, D-116). An inline routine's reads are its host's (`inline_reads_are_hosts`), and a pending one suspends the host (`inline_pending_suspends_host`) — what a lexical callback run on its own had hidden, and what the native surface check's pending variant found.

**S25.** The surface forms are statements as much as expressions. A statement runs over the locals (an environment) and S20's expressions, with the locals they name put in: an assignment (`const`, `let`, compound assignment, increment, destructuring), a sequence, a branch (`if`, `switch`, a ternary as a statement), a loop whose count is read once (`for`, `for…of`, `for…in`, `while`, `do…while`; an array callback run in place is a loop whose body is an inline routine, S24), `throw`, and `try`/`catch`. The lowered statement, its expressions S20's and its `try` `nativeTry`, leaves Solid's locals, tracks Solid's reads in order and suspends or fails where Solid does (`statements_preserve`). A `catch` takes a failure with the locals at the throw (`catch_takes_failure`) and never a suspension (`catch_passes_pending`): a pending read inside a `try` still suspends the host.

**S26.** An array method calls its callback at once, element by element, in the host that calls the method (`items.every(x => …)`, `reduce`, a comparator). Each call is an inline routine of that host: by S24 its reads are the host's, and the lowered loop computes Solid's outcome and reads (`each_preserves`); a callback that raises fails the host with its error though it reads nothing (`callback_raise_fails_host`). The lowering ran a callback that reads nothing as plain code, its raise not the host's, and `plain_callback_unsound` gives a program where that differs. A promise an event keeps (`const request = fetch(url)`) is attempted where it is awaited; a continuation chained on it (`request.then(k)`) raises the promise's rejection too (`chained_carries_rejection`), which reading the receiver as a plain name dropped (`chained_receiver_dropped_unsound`). Platform calls join `async` ones under `kept_async_sound` (WebIDL turns their exceptions into rejections).

**Every surface form, by what proves it.** The native surface check's forms (`scripts/native-surface/forms.mjs`) each decompose into proved constructs:

| Forms | Constructs | Proofs |
| --- | --- | --- |
| `plain`, `ternary`, `logical-and`, `logical-or`, `nullish`, `optional-chain`, `nested-ternary-template`, `typeof-instanceof`, `in-operator`, `casts`, `exponent-bitwise`, `string-concat` | reads, plain calls, sums, conditionals | S20 |
| `template`, `tagged-template`, `array-literal`, `object-literal`, `array-spread`, `object-spread`, `string-methods`, `math`, `object-statics`, `map-set`, `date`, `regex` | plain calls of read values (a literal is a call building the value) | S20 |
| `bigint`, `json-stringify` | a plain call that may throw | S20 (`raise`), S18 in a hole, S23 under `Errored` |
| `store-path`, `store-list` | a read of a path; a structural read (`readStore`) of a list and a loop over it | S20, S25, S9 |
| `destructure-object`, `destructure-array`, `destructure-default`, `compound-assign`, `increment`, `comma-sequence` | assignments in sequence | S25 |
| `if-else`, `switch` | branches | S25 |
| `for-of`, `for-in`, `for-index`, `while`, `do-while`, `labeled-continue` | loops (a `continue` is a branch around the rest of the body) | S25 |
| `try-catch`, `try-finally` | `try`/`catch` (a `finally` runs on both paths: after the `try`, and in a handler that runs it and rethrows) | S25 |
| `map`, `filter`, `reduce`, `find`, `some-every`, `sort-copy`, `for-each`, `array-from` | a loop whose body is the callback, run in place | S25, S24, S9 |
| `callback-throw`, `callback-reads-throw`, `reduce-throw`, `callback-failing-call`, `comparator-throw`, `store-callback-throw` | that loop, its callback an inline routine that may raise: the raise is the host's | S26 (`callback_raise_fails_host`), S25 (`catch_takes_failure`), S24, S23 under `Errored` |
| `iife`, `local-arrow`, `local-function`, `closure-read`, `getter-object`, `getter-this`, `object-method`, `class-method`, `class-instance`, `optional-call`, `reader-helper` | inline routines (the body read where it is called) | S24 (the helper's parameter: S21, D-119) |
| `untrack` | untracked reads | S24 |
| `user-generator` | an author's generator, opaque: a call whose failures are unknown | S20 (`call`), S13 (`foreign_driver_unknown`) |
| `await`, `await-nested`, `await-json`, `await-loop`, `promise-then`, `await-uncaught` (events) | an event's attempts in sequence | S22, S15, S25 |
| `promise-kept` (event) | a promise kept as a value: a plain call; its attempt where it is awaited, or chained on | S26 (`chained_carries_rejection`), `kept_async_sound`, S22, S15 |

What the table rests on is the lowering's decomposition of each form, which no proof states: it is checked by `native:surface` (each form in every host, reading, writing and pending, as plain Solid says) and by the surface mutants.

**S8.** The trace of `n` runs followed by disposal contains each cleanup
exactly when its run happened, and each cleanup comes right after its run and
before the next. Ignoring the returned cleanup runs none.

## Not covered here

- **What the model rests on.** Native apps ship as written (D-120): the
  lowered program is the checker's model of them. S20–S26 prove the model means
  what the original means for expressions, props, events and reruns, boundaries,
  lists and effects, `untrack` and inline routines, statements (locals,
  branches, loops, `throw`, `try`), and callbacks an array method runs at once, given that the lowering finds every source read (checked
  on the real lowering by `native:insertion`) and that Solid's runtime behaves
  as its documented semantics (the trust boundary below). The native
  harnesses' DOM comparisons with each original (Todos, Sierpinski, Hacker
  News, the dashboard, Docs, Rendering, Effect) check both on whole apps. The
  compiler correspondence remains the core's P-ENCODING obligation.
- **Failure inference precision.** S7 and S13 are soundness only. Every
  unresolved call is `unknown`, which is sound and may be imprecise.
- **Solid's runtime.** "Set once" providers, owner cleanup order and
  `useContext` throwing without a provider are Solid 2 facts, used as premises
  (the core's trust boundary).
