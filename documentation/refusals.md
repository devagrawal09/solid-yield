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
| a write: `yield* setX(v)` | write in an `$event` (or an `$effect`) | `Write` is not a `ViewOp` | — | `WRITE_IN_REACTIVE` | `no-unyielded-write` (if not delegated) |
| `yield* $cleanup(fn)` | in the setup or an effect | `Cleanup` is not a `ViewOp` | — | `CLEANUP_OUTSIDE_OWNER` | — |
| a context read: `yield* Ctx` | in the setup | `ContextRead` is not a `ViewOp` | — | `CONTEXT_OUTSIDE_SETUP` | — |
| `yield* raise(e)` in a hole | raise in a `$memo` (its source carries the failure), or in a hole given as a prop | `Raise` is not a `ViewOp` | — | — | — |
| an async `attempt` in a hole | an async `$memo` in the setup; read it in a hole | `Wait` is not a `ViewOp` / `HoleOp` | — | `ASYNC_NOT_ALLOWED` | — |
| `throw new Error()` | `yield* raise(new NotFound())`, a `Failure` with a literal `kind` | — | — | `UNTYPED_THROW` (wrapped once; the original is its `cause`) | `no-throw` |
| a component as a tag: `<Card todo={todo} />` | `{yield* Card({ todo })}` | the JSX namespace's `ElementType` (a block component's view is branded) | — | — | `no-component-tag` (autofix) |
| a flow control or boundary as a tag: `<Show when={…}>` | `{yield* Show({ when, children: function* () { … } })}` | `ElementType` | — | — | `no-component-tag` (autofix) |
| a read in a call's argument: `Card({ n: yield* count })` | pass the source (`n: count`) or a hole (`n: function* () { return (yield* count) * 2; }`) | — | — | — | `no-read-in-prop` (autofix) |
| plain JSX as a call's `children`: `Show({ when, children: <p /> })` | a lazy view `children: function* () { return <p />; }`, or a row `function* (item) { … }` | — (content is accepted) | — | — | `component-children-generator` (autofix) |
| a pending or failing child not `yield*`-ed: `{Card({ todo })}` | `{yield* Card({ todo })}`, under a `Loading` / `Errored` as its colors need | `JSX.Element` is settled only | — | — | — |
| a thunk as a child or attribute: `{() => x}`, `class={() => c}` | a hole: `{yield* x}` | JSX and `h` reject plain thunks | — | — | — |
| a source called: `count()` | `yield* count` | `Source` has no call signature | — | — | — |
| `yield*` in an event prop: `onClick={yield* handler}` | an `$event`, `onClick={save}`; read the handler inside it | — | `BLOCKS_YIELD_IN_EVENT` | — | `yield-in-jsx-hole` |
| `yield*` in `ref` | pass the ref function itself | — | `BLOCKS_YIELD_IN_REF` | — | `yield-in-jsx-hole` |
| `yield*` in a spread attribute: `{...(yield* attrs)}` | one hole per attribute | — | `BLOCKS_YIELD_IN_SPREAD` | — | `yield-in-jsx-hole` |
| `yield*` in a spread child | a flow control (`For`) | — | `BLOCKS_YIELD_IN_SPREAD_CHILD` | — | `yield-in-jsx-hole` |
| a plain `yield` in JSX | `yield*` | — | `BLOCKS_PLAIN_YIELD_IN_JSX` | — | `yield-in-jsx-hole` |
| a path used as an object: `{...props.user}`, `props.user === x`, `JSON.stringify(props.user)` | read it: `yield* props.user` | — (a path types as a source with keys) | — | `PATH_OBJECT` (listing keys, a descriptor, defining or deleting a key); `PATH_WRITE` | `no-path-object-use` |
| reactive state the library did not create: Solid's `createSignal`, the router's hooks, `dynamic` | the block forms: `$signal`, `$memo`, … | — | — | — | `no-foreign-reactive` |
| `$(…)` / `$scope(…)` | a bare `function*` (a hole, a row), or a `$memo` | not exported | — | — | `no-dollar-block` (autofix) |
| a view not wrapped in `view(…)` | `return view(function* () { … })` | (errors reported at `$component(` instead) | — | — | `prefer-view-wrapper` (warning, autofix) |

The neighbours of a view, for completeness:

| You wrote | Instead | Types | Dev error | Lint |
| --- | --- | --- | --- | --- |
| a read in a setup (`yield* count`, `yield* props.x`) | read in a hole, a `$memo`, an `$effect` or an `$event` | `Read` is not a `SetupOp` | `READ_IN_SETUP` | — |
| `yield* $untrack(source)` in a setup | in a hole, a `$memo`, an `$effect` or an `$event` | `$untrack` is a read | `UNTRACK_IN_SETUP` | — |
| JSX in a setup (or in a memo, an effect, an event) | in the view it returns | — | `JSX_IN_SETUP` (when a hole is performed while a setup runs) | `jsx-only-in-view` |
| a setup that returns markup, or nothing | `return view(function* () { return <…/>; })` | setup return type | `COMPONENT_VIEW` | — |
| a row that returns markup | the row's setup returns its view | `RowBlock` | `ROW_VIEW` | — |
| a row's setup reads, a row's view creates | as a component's | `[ROW_SETUP_OP]`, `[ROW_VIEW_OP]` | `READ_IN_SETUP`, `CREATE_OUTSIDE_SETUP` | — |
| a setter call not delegated to: `setX(v)` | `yield* setX(v)` | — | `UNYIELDED_WRITE` (end of the run) | `no-unyielded-write` |
| a setter called with no block running (`onClick={setX}`, a timer) | wrap it in an `$event` | — | `SETTER_OUTSIDE_RUN` | `no-unyielded-write` |
| a write in a `$memo` | in an `$event` or an `$effect` | `Write` is not a `MemoOp` | `WRITE_IN_REACTIVE` | `no-unyielded-write` |
| a memo read after its first async `attempt` | read before it | — | `READ_AFTER_ATTEMPT` | `read-before-attempt` |
| `$optimistic(body)` / `$optimisticStore(scalar)` | `$optimistic(value)`; `$optimisticStore(object \| body)` (D-014) | overloads | `OPTIMISTIC_FORM` | — |
| a boundary's content built before the boundary | pass it as a function | overloads | `BOUNDARY_CONTENT_BUILT` | — |
| a non-operation delegated to: `yield* 42` | `yield*` a source, a path, a prop, `attempt`, `raise` or a receipt | `Yieldable` ops | `NOT_AN_OPERATION` | — |
| a failure class without a literal `kind` | `readonly kind = "not-found" as const` | `[FAILURE_KIND]` at `attempt`, `until`, `raise`, `Errored catch`, `Props` | — | — |
| a pending or failing source passed to a prop declared settled | declare `Source<T, E, true>`, or pass a settled one | `[SETTLED_PROP]` | — | — |
| a pending view at the root | a `Loading` above every pending read | `render` / `hydrate` take `View<false, any>` | — | — |
| two copies of the runtime | dedupe the dependency | — | `DUPLICATE_RUNTIME` | — |

## Every code, by layer

**The transform** (`vite-plugin-solid-blocks`). A compile error lists each refusal as `[CODE] message (line:column)`. The lint rule `yield-in-jsx-hole` reports the same list.

| Code | Position |
| --- | --- |
| `BLOCKS_YIELD_IN_EVENT` | an event prop |
| `BLOCKS_YIELD_IN_REF` | `ref` |
| `BLOCKS_YIELD_IN_SPREAD` | a spread attribute |
| `BLOCKS_YIELD_IN_SPREAD_CHILD` | a spread child |
| `BLOCKS_PLAIN_YIELD_IN_JSX` | a plain `yield` |

**Development errors** (`solid-blocks`, development builds; the message starts `[CODE]`):

| Code | Thrown when |
| --- | --- |
| `READ_IN_VIEW` | a view reads at its top level, outside a JSX position (named component or row; on the server too) |
| `READ_IN_SETUP` | a setup reads (tracked or not) |
| `UNTRACK_IN_SETUP` | a setup uses `$untrack` |
| `READ_AFTER_ATTEMPT` | a memo reads after its first async `attempt` |
| `CREATE_OUTSIDE_SETUP` | `$signal` / `$memo` / … outside a setup |
| `CONTEXT_OUTSIDE_SETUP` | `yield* Ctx` outside a setup |
| `CLEANUP_OUTSIDE_OWNER` | `$cleanup` outside a setup or an effect |
| `WRITE_IN_REACTIVE` | a write in a host that does not write (a setup, a view, a hole, a memo) |
| `UNYIELDED_WRITE` | a setter's receipt was not delegated to by the end of its run |
| `SETTER_OUTSIDE_RUN` | a setter is called with no block running |
| `ASYNC_NOT_ALLOWED` | an async `attempt` outside a `$memo` / `$event` |
| `NOT_AN_OPERATION` | a block delegated to something that is not an operation |
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
| `[ATTEMPT_ABSORBS]` | an `attempt` handler that may return an `Error` and a value that is not one: it either fails (returns the failure) or absorbs it (returns a value), D-073 |
| `[HVIEW_READ]` | an `h` (no-JSX) view that yields |
| `[ROW_SETUP_OP]` | a row's setup that reads |
| `[ROW_VIEW_OP]` | a row's view that creates |

Every other type refusal is a plain assignability error. The common ones: an op that is not a `SetupOp` / `ViewOp` / `MemoOp` / `EffectOp` / `HoleOp` (reported at `view(` or `$component(`); a component tag (`ElementType`); a pending view as a child or at the root; a source called as a function; a plain thunk as a child.

**Lint rules** (`eslint-plugin-solid-blocks`, `recommended`: every rule an error, `prefer-view-wrapper` a warning):

| Rule | Reports |
| --- | --- |
| `no-read-in-view-body` | a `yield*` in a view outside a JSX expression or attribute |
| `yield-in-jsx-hole` | a `yield*` in JSX where the transform makes no hole (its five codes) |
| `no-component-tag` | a block component, flow control or boundary written as a tag (autofix: the call) |
| `no-read-in-prop` | a `yield*` in a component call's argument (autofix) |
| `component-children-generator` | a call's `children` that is not a generator (autofix) |
| `jsx-only-in-view` | JSX outside a view, a hole or a row's view |
| `no-unyielded-write` | a setter call, an event call or another block operation not delegated to |
| `read-before-attempt` | a memo read after its first `attempt` |
| `no-throw` | `throw` in a block |
| `no-path-object-use` | a path spread, compared or stringified |
| `no-foreign-reactive` | reactive state from plain Solid, the router or `dynamic` in block code |
| `no-dollar-block` | `$` / `$scope` (removed, D-013; autofix) |
| `prefer-view-wrapper` | a view not wrapped in `view(…)` (warning, autofix) |
