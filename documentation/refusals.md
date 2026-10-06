# Refusals: what the strict dialect will not let you write

**This is the strict dialect; the compiler route is the ergonomic one** (D-002). Every rule of the model is checked by up to four layers: TypeScript, the JSX transform (`vite-plugin-solid-blocks`, at build time), the runtime's development errors (thrown where they happen and stripped from production builds), and lint (`eslint-plugin-solid-blocks`, `recommended`). This page puts their codes in one place. [`blocks-library.md`](./blocks-library.md) §3 has each rule's tests; [`getting-started.md`](./getting-started.md) introduces the rules.

## What you can't write in a view

A view is `return view(function* () { return <…/>; })`: it has no body (D-032). Its holes (`{yield* …}` in JSX) read; flow controls give it structure. In the table, "—" means that layer does not check it.

| You wrote, in a view | Instead | Types | Transform | Dev error | Lint |
| --- | --- | --- | --- | --- | --- |
| a read outside JSX: `const n = yield* count;` above the `return` | read in a hole: `{yield* count}` | — in JSX (a `yield*` in JSX and one in a statement type alike); `[HVIEW_READ]` in an `h` view | — | `READ_IN_VIEW` | `no-read-in-view-body` |
| a branch: `if (yield* flag) return <A />;` | `Show({ when: flag, … })`, `Switch` / `Match` | — (`[HVIEW_READ]` in `h`) | — | `READ_IN_VIEW` | `no-read-in-view-body` |
| a local computation from reads: `const total = (yield* a) + (yield* b);` | a hole `{(yield* a) + (yield* b)}`, or a `$memo` in the setup | — (`[HVIEW_READ]` in `h`) | — | `READ_IN_VIEW` | `no-read-in-view-body` |
| a creation: `yield* $signal(0)`, `$memo`, `$store`, `$effect` | create in the setup (or a row's setup) | `Create` is not a `ViewOp` (reported at `view(`) | — | `CREATE_OUTSIDE_SETUP` | — |
| a write: `yield* setX(v)` | write in an `$event` (or an `$effect`'s effect phase) | `Write` is not a `ViewOp` | — | `WRITE_IN_REACTIVE` | `no-unyielded-write` (if not delegated) |
| `yield* $cleanup(fn)` | in the setup or an effect | `Cleanup` is not a `ViewOp` | — | `CLEANUP_OUTSIDE_OWNER` | — |
| a context read: `yield* Ctx` | in the setup | `ContextRead` is not a `ViewOp` | — | `CONTEXT_OUTSIDE_SETUP` | — |
| `yield* raise(e)` in a hole | raise in a `$memo` (its source carries the failure), or in a hole given as a prop | `Raise` is not a `ViewOp` | — | — | — |
| an async `attempt` in a hole | an async `$memo` in the setup; read it in a hole | `Wait` is not a `ViewOp` / `HoleOp` | — | `ASYNC_NOT_ALLOWED` | — |
| `throw new Error()` | `yield* raise(new NotFound())`, a `Failure` with a literal `kind` | — | — | `UNTYPED_THROW` (wrapped once; the original is its `cause`) | `no-throw` |
| a component as a tag: `<Card todo={todo} />` | `{yield* Card({ todo })}` | the JSX namespace's `ElementType` (a block component's view is branded) | — | — | `no-component-tag` (autofix) |
| a flow control or boundary as a tag: `<Show when={…}>` | `{yield* Show({ when, children: function* () { … } })}` | `ElementType` | — | — | `no-component-tag` (autofix) |
| a read in a call's argument: `Card({ n: yield* count })` | pass the source (`n: count`) or a hole (`n: function* () { return (yield* count) * 2; }`) | — | — | — | `no-read-in-prop` (autofix) |
| plain JSX as a call's `children`: `Show({ when, children: <p /> })` | a lazy view `children: function* () { return <p />; }`, or a row `function* (item) { … }` | `[LAZY_VIEW] children is a lazy view: function* () { return <.../>; }` (D-094; a render callback returning JSX, and a component's view built in the call, are refused too) | — | — | `component-children-generator` (autofix) |
| JSX as a flow control's `fallback`: `Loading({ fallback: <p>…</p>, … })` (built with the holding view, shown or not; while hydrating it claims a server node that is there only if the server showed the fallback: Solid's "Hydration key miss", D-092) | a lazy view `fallback: function* () { return <p>…</p>; }`, built when it shows | `[LAZY_VIEW] fallback is a lazy view: …` (D-094; `h` output, text and `Errored`'s render function `err => <p>…</p>` pass) | — | — | `component-children-generator` (autofix) |
| a block call not `yield*`-ed: `{Card({ todo })}`, `<>{Card({ todo })}</>`, `{[Main(), Footer()]}` | `{yield* Card({ todo })}`, under a `Loading` / `Errored` as its colors need (D-086) | `JSX.Element` is settled only: a pending or failing view is not one, in an element and in a fragment (`Fragment`'s children are `Element`; checked when the tsconfig sets `jsxFactory` / `jsxFragmentFactory`; `require-jsx-factory` warns when it does not, D-093) | — | — | `component-call-yielded` (autofix: the `yield*`) |
| a thunk as a child or attribute: `{() => x}`, `class={() => c}` | a hole: `{yield* x}` | JSX and `h` reject plain thunks | — | — | — |
| a source called: `count()` | `yield* count` | `Source` has no call signature | — | — | — |
| an `$event` handler given unbound: `onClick={save}` | bind it: `onClick={yield* save}` (D-072) | the JSX namespace's event attributes take only a bound handler (`[BOUND]` is missing) | — | — | `no-unbound-event` (autofix) |
| a plain function, or a value read from a source, in an event prop: `onClick={() => go()}`, `onClick={yield* props.onSave}` | an `$event` that does the work, bound: `const save = $event(function* () { yield* (yield* props.onSave)(); })`, `onClick={yield* save}` | event attributes take only a bound handler; in `h`, only an `$event` handler | — | — | — |
| `yield* save` (a bind) in an event, a memo or a hole prop | call it: `yield* save(x)` | `Bind` is a `ViewOp` only | — | — | — |
| `yield*` in `ref` | pass the ref function itself | — | `BLOCKS_YIELD_IN_REF` | — | `yield-in-jsx-hole` |
| `yield*` in a spread attribute: `{...(yield* attrs)}` | one hole per attribute | — | `BLOCKS_YIELD_IN_SPREAD` | — | `yield-in-jsx-hole` |
| `yield*` in a spread child | a flow control (`For`) | — | `BLOCKS_YIELD_IN_SPREAD_CHILD` | — | `yield-in-jsx-hole` |
| a plain `yield` in JSX | `yield*` | — | `BLOCKS_PLAIN_YIELD_IN_JSX` | — | `yield-in-jsx-hole` |
| a path used as an object: `{...props.user}`, `props.user === x`, `JSON.stringify(props.user)` | read it: `yield* props.user` | — (a path types as a source with keys) | — | `PATH_OBJECT` (listing keys, a descriptor, defining or deleting a key); `PATH_WRITE` | `no-path-object-use` |
| reactive state the library did not create: Solid's `createSignal`, the router's hooks, `dynamic` | the block forms: `$signal`, `$memo`, … | — | — | — | `no-foreign-reactive` |
| `$(…)` / `$scope(…)` | a bare `function*` (a hole, a row), or a `$memo` | not exported | — | — | `no-dollar-block` (autofix) |
| a bound handler that may wait on pending data: `onClick={yield* save}` where `save` reads a pending source | show its in-flight state (the view is not pending: nothing suspends it for a call, D-075) | the view's may-wait marker (`View<P, E, W>`), not an error | — | — | `no-unshown-wait` (warning, with types) |
| a view not wrapped in `view(…)`: `return function* () { … }` | `return view(function* () { … })` (D-089: the one spelling) | `[VIEW_WRAPPER]` at `$component(`; a row's: no overload of the flow control matches | — | — | `require-view-wrapper` (autofix) |

The neighbours of a view, for completeness:

| You wrote | Instead | Types | Dev error | Lint |
| --- | --- | --- | --- | --- |
| a read in a setup (`yield* count`, `yield* props.x`) | read in a hole, a `$memo`, an `$effect` or an `$event` | `Read` is not a `SetupOp` | `READ_IN_SETUP` | — |
| JSX in a setup (or in a memo, an effect, an event) | in the view it returns | — | `JSX_IN_SETUP` (when a hole is performed while a setup runs) | `jsx-only-in-view` |
| a setup that returns markup, or nothing | `return view(function* () { return <…/>; })` | setup return type | `COMPONENT_VIEW` | — |
| a row that returns markup | the row's setup returns its view | `RowBlock` | `ROW_VIEW` | — |
| a generator `Errored` fallback with unannotated parameters | annotate them: `function* (error: Path<NotFound>, reset: Reset)` (TypeScript does not infer a generator fallback's) | no overload of `Errored` matches | — | — |
| a row's setup reads, a row's view creates | as a component's | `[ROW_SETUP_OP]`, `[ROW_VIEW_OP]` | `READ_IN_SETUP`, `CREATE_OUTSIDE_SETUP` | — |
| a setter call not delegated to: `setX(v)` | `yield* setX(v)` | — | `UNYIELDED_WRITE` (end of the run) | `no-unyielded-write` |
| a setter called with no block running (`onClick={setX}`, a timer) | wrap it in an `$event` | — | `SETTER_OUTSIDE_RUN` | `no-unyielded-write` |
| a write in a `$memo` | in an `$event` or an `$effect`'s effect phase | `Write` is not a `MemoOp` | `WRITE_IN_REACTIVE` | `no-unyielded-write` |
| `$effect(function* () { … })`, one function | `$effect(compute, effect)`: read in the compute and return the value, write in `function* (value, prev) { … }` (D-079) | two arguments are required | — | — |
| a write, a `$cleanup` or an event call in an `$effect`'s compute | in its effect phase | not a `ComputeOp` | `WRITE_IN_REACTIVE`, `CLEANUP_OUTSIDE_OWNER` | — |
| a read of a source that may be pending in an `$effect`'s effect phase | read it in the compute and pass the value (D-079; a settled source the effect phase reads, untracked, D-083) | `Read<true>` is not an `EffectPhaseOp`: the effect phase does not wait | — (Solid's `NotReadyError` if it is pending) | — |
| a memo read after its first async `attempt` | read before it | — | `READ_AFTER_ATTEMPT` | `read-before-attempt` |
| `$optimistic(body)` / `$optimisticStore(scalar)` | `$optimistic(value)`; `$optimisticStore(object \| body)` (D-014) | overloads | `OPTIMISTIC_FORM` | — |
| a boundary's content built before the boundary | pass it as a lazy view (or, in `h`, a thunk) | `[LAZY_VIEW]` (D-094) | `BOUNDARY_CONTENT_BUILT` | — |
| a non-operation delegated to: `yield* 42` | `yield*` a source, a path, a prop, `attempt`, `raise` or a receipt | `Yieldable` ops | `NOT_AN_OPERATION` | — |
| `try { yield* save(); } catch (e) { … }` in a block | `yield* attempt(() => save(), e => { … })` (absorb: return nothing; transform: return an `Error` with a literal `kind`), or an `Errored` above (D-077) | — (the types cannot see a catch: the failure stays in the type) | — | `no-try-catch` |
| an op in a generator handler its host does not take: a write in a `$memo`'s, a wait in an `$effect`'s | the handler is the host's block code (D-078): write in an `$event`'s handler; wait in a `$memo` or an `$event` | the host's op union (`MemoOp`, `EffectOp`) | `WRITE_IN_REACTIVE`, `ASYNC_NOT_ALLOWED` | — |
| an `attempt` over a stream in an `$event`: `yield* attempt(() => watch(feed), …)` | attempt it in a reactive block: `return yield* attempt(() => watch(feed), cause => new FeedError(cause))` in a `$memo` or a `$projection`, and read that (D-091) | `StreamAttempt` is not an `EventOp` (`[STREAM_IN_EVENT]`) | `STREAM_IN_EVENT` | — |
| a generator handler (or one returning a value) on a stream attempt | a plain handler: return an `Error` (the stream fails) or nothing (the stream ends); a stream's failures arrive after the host's run (D-091) | `[STREAM_HANDLER]` | `STREAM_HANDLER` (every build: the stream fails with it) | — |
| a failure class without a literal `kind` | `readonly kind = "not-found" as const` | `[FAILURE_KIND]` at `attempt`, `until`, `raise`, `Errored catch`, `Props` | — | — |
| a pending or failing source passed to a prop declared settled | declare `Source<T, E, true>`, or pass a settled one | `[SETTLED_PROP]` | — | — |
| a pending view at the root | a `Loading` above every pending read | `render` / `hydrate` take `View<false, any>` | — | — |
| a block component handed to plain Solid unchecked: `defineRoute({ component: Live })`, `render(App, root)` from `@solidjs/web` | `foreign(Live)`, with its failures handled inside it (an `Errored` in its view); it may pend (D-088) | `[FOREIGN_HANDOFF]` at `foreign(…)` when it may fail (the property's type lists the failures' `kind`s) | — | `no-unchecked-foreign-handoff` (suggestion: `foreign(…)`) |
| two copies of the runtime | dedupe the dependency | — | `DUPLICATE_RUNTIME` | — |

## Every code, by layer

Counted against the code (2026-10-06): 4 transform codes (`REFUSALS` in `vite-plugin-solid-blocks`), 22 development errors, 11 type-level messages, 19 lint rules (17 errors and 2 warnings in `recommended`).

**The transform** (`vite-plugin-solid-blocks`). A compile error lists each refusal as `[CODE] message (line:column)`. The lint rule `yield-in-jsx-hole` reports the same list.

| Code | Position |
| --- | --- |
| `BLOCKS_YIELD_IN_REF` | `ref` |
| `BLOCKS_YIELD_IN_SPREAD` | a spread attribute |
| `BLOCKS_YIELD_IN_SPREAD_CHILD` | a spread child |
| `BLOCKS_PLAIN_YIELD_IN_JSX` | a plain `yield` |

**Development errors** (`solid-blocks`, development builds; the message starts `[CODE]`):

| Code | Thrown when |
| --- | --- |
| `READ_IN_VIEW` | a view reads at its top level, outside a JSX position (named component or row; on the server too) |
| `READ_IN_SETUP` | a setup reads (tracked or not) |
| `READ_AFTER_ATTEMPT` | a memo reads after its first async `attempt` |
| `CREATE_OUTSIDE_SETUP` | `$signal` / `$memo` / … outside a setup |
| `CONTEXT_OUTSIDE_SETUP` | `yield* Ctx` outside a setup |
| `CLEANUP_OUTSIDE_OWNER` | `$cleanup` outside a setup or an effect |
| `WRITE_IN_REACTIVE` | a write in a host that does not write (a setup, a view, a hole, a memo) |
| `UNYIELDED_WRITE` | a setter's receipt was not delegated to by the end of its run |
| `SETTER_OUTSIDE_RUN` | a setter is called with no block running |
| `ASYNC_NOT_ALLOWED` | an async `attempt` outside a `$memo` / `$event` |
| `NOT_AN_OPERATION` | a block delegated to something that is not an operation |
| `STREAM_IN_EVENT` | an `$event` attempts a stream (D-091) |
| `STREAM_HANDLER` | a stream attempt's handler returned a generator (every build; the stream fails with it, D-091) |
| `JSX_IN_SETUP` | a hole is performed while a setup runs |
| `COMPONENT_VIEW` | a setup does not return a view |
| `ROW_VIEW` | a row's body does not return a view |
| `PATH_OBJECT` | a path is enumerated, described, or has a key defined or deleted |
| `PATH_WRITE` | a path is written to |
| `OPTIMISTIC_FORM` | `$optimistic` / `$optimisticStore` in the other's form |
| `BOUNDARY_CONTENT_BUILT` | a boundary's content was built before the boundary |
| `DUPLICATE_RUNTIME` | a second copy of the runtime is loaded |
| `UNTYPED_THROW` | a plain `throw` out of a block run (wraps the original as `cause`, naming the host and the component) |

**Type-level messages** (in the expected type TypeScript prints):

| Message | Where |
| --- | --- |
| `[SETTLED_PROP]` | a pending or failing value, source or hole passed to a prop declared settled |
| `[FAILURE_KIND]` | a failure type without a literal `kind`: at `attempt`, `until`, `raise`, `Errored catch`, a `Props` declaration |
| `[ATTEMPT_ABSORBS]` | an `attempt` handler (or a generator handler's return) that is an `Error` on one path and not on another: it returns the failure (an `Error` with a literal `kind`) or absorbs it (returns nothing or a value), not sometimes one and sometimes the other (D-076, D-078) |
| `[STREAM_IN_EVENT]` | an `$event` that attempts a stream (or a promise of one): a stream is consumed in a `$memo` or a `$projection` (D-091) |
| `[STREAM_HANDLER]` | a generator handler, or one returning a value, on a stream attempt (D-091) |
| `[FOREIGN_HANDOFF]` | `foreign(Comp)` of a block component that may fail: "a block component handed to plain Solid may fail with the failure kinds this property lists: handle them inside, or wrap it in an Errored, first", the property's type the kinds (`"archive" \| "live"`) (D-088). A type cannot name the component; the lint's message does |
| `[HVIEW_READ]` | an `h` (no-JSX) view that yields |
| `[ROW_SETUP_OP]` | a row's setup that reads |
| `[ROW_VIEW_OP]` | a row's view that creates |
| `[VIEW_WRAPPER]` | a setup that returns a bare `function*`: "wrap the view: return view(function* () { ... })" (D-089) |
| `[LAZY_VIEW]` | a JSX element as a flow control's or a boundary's `fallback` or `children` (call form; `h` form's `fallback`): "fallback is a lazy view: function* () { return <.../>; }" (D-094) |

Every other type refusal is a plain assignability error. The common ones: an op that is not a `SetupOp` / `ViewOp` / `MemoOp` / `EffectOp` / `HoleOp` (reported at `view(` or `$component(`); a component tag (`ElementType`); a pending view as a child or at the root; a source called as a function; a plain thunk as a child.

**Lint rules** (`eslint-plugin-solid-blocks`, `recommended`: every rule an error, `no-unshown-wait` and `require-jsx-factory` warnings):

| Rule | Reports |
| --- | --- |
| `no-read-in-view-body` | a `yield*` in a view outside a JSX expression or attribute |
| `yield-in-jsx-hole` | a `yield*` in JSX where the transform makes no hole (its four codes) |
| `no-unbound-event` | an `$event` handler in an event prop without `yield*` (autofix) |
| `no-component-tag` | a block component, flow control or boundary written as a tag (autofix: the call) |
| `no-read-in-prop` | a `yield*` in a component call's argument (autofix) |
| `component-children-generator` | a call's `children` that is not a generator; a flow control's JSX `fallback` (D-092) (autofix) |
| `component-call-yielded` | a block component call in JSX (an array, a conditional) or a discarded statement, not delegated to with `yield*` (autofix) |
| `no-unchecked-foreign-handoff` | a block component handed to plain Solid (a `component` property or attribute, `@solidjs/web`'s `render` / `hydrate` / `renderTo…`, Solid's `lazy` over one) without `foreign(…)` (D-088; suggestion: the wrap) |
| `jsx-only-in-view` | JSX outside a view, a hole or a row's view |
| `no-unyielded-write` | a setter call, an event call or another block operation not delegated to |
| `read-before-attempt` | a memo read after its first `attempt` |
| `no-throw` | `throw` in a block |
| `no-try-catch` | `try` / `catch` in a block body (D-077) |
| `no-path-object-use` | a path spread, compared or stringified |
| `no-foreign-reactive` | reactive state from plain Solid, the router or `dynamic` in block code |
| `no-dollar-block` | `$` / `$scope` (removed, D-013; autofix) |
| `require-view-wrapper` | a view not wrapped in `view(…)` (D-089; autofix) |
| `no-unshown-wait` | a bound handler that may wait on pending data (warning, with types; D-075) |
| `require-jsx-factory` | a tsconfig without `"jsxFactory": "jsx"` / `"jsxFragmentFactory": "Fragment"`, so fragments are not type-checked (warning, once per project; D-093) |
