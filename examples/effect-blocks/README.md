# Solid 2.0 × Effect — `@solidjs/blocks` twin

[`examples/effect`](../effect) written with `@solidjs/blocks` (JSX flavor): the typeahead (read path) and the checkout saga (action path), same markup and behavior. `src/solid-effect.ts`, `src/api.ts` and `src/log.ts` are the original's, verbatim: they are the Effect integration and data layer, not components.

What the library's rules change in the source:

- Components are `$component`s; every handler is an `$event`; per-row state and reads live in row blocks (`<For>{function* (item, i) { … }}</For>`).
- The typeahead's memo still returns `runEffect(…)` (an async iterable): Solid closes a superseded flight's iterator and the fiber is interrupted. Its type is `Source<Package[], boolean, unknown>` (a memo returning an async iterable may be pending and may fail with anything), and `Results` declares that prop type. `latest` / `isPending` are `latestOf` / `isPendingOf`.
- Boundaries: a view that reads a pending source is pending, so the orders list moved into `Orders` under `<Loading>`, and the search results are `Loading({ fallback, get children() { return Results(…) } })` inside the `<Errored>` (a boundary tag hands on nothing it does not handle; the getter creates the results inside the boundary).
- The optimistic phase and the optimistic orders store are Solid primitives created in the setup and read with `read(…)` / `paths<Order[], true>(…)` (stated pending: the fetch is asynchronous).

`no-explicit-any` is off for `src/solid-effect.ts` only (verbatim integration layer: Effect's runtime and fiber generics are `any` at that boundary). No casts in the block code.

```bash
pnpm test         # behavior (12) + parity against examples/effect (1): DOM after 42 steps
pnpm typecheck && pnpm lint && pnpm build
node ../../scripts/example-blocks/browser.mjs effect
```
