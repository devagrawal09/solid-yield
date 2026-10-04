# TodoMVC — `solid-blocks` twin

[`examples/todos`](../todos) written with `solid-blocks` (JSX flavor). `src/todos.ts` (optimistic store over a projection, actions, the error side-channel), `src/api.ts` and `src/filter.ts` are the original's, verbatim; only `src/app.tsx` and `src/main.tsx` changed.

What the library's rules change in the source:

- Components are `$component`s: setups read the context (`yield* TodosContext`, a library context) and create `$event` handlers; views read in JSX holes.
- The todos store is Solid's (optimistic, fetched): blocks read it through `paths<Todo[], true>` — stated pending, the first fetch is asynchronous — and structural reads (`filter`, `every`, `length` of a filtered list) through `readStore`.
- A view that reads a pending store is pending, so the boundary receives the two sections as views: `<Loading>{MainSection({ filter })}{Footer({ filter })}</Loading>`.
- The URL-hash filter is the original's primitive, created in the setup and read with `read(…)`.

`no-explicit-any` is off for `src/todos.ts` only (verbatim data layer: `TodoError.args: any[]`). No casts in the block code.

```bash
pnpm test         # behavior (7) + parity against examples/todos (1): DOM after 27 steps, failures and retries included
pnpm typecheck && pnpm lint && pnpm build
node ../../scripts/example-blocks/browser.mjs todos
```
