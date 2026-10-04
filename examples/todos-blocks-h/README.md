# TodoMVC — `solid-blocks` twin, no-JSX flavor (`h`)

[`examples/todos`](../todos) written with `solid-blocks` and `solid-blocks/h`: no JSX in the app (`src/app.ts`), no JSX transform needed for the views. The data layer (`todos.ts`, `api.ts`, `filter.ts`) is the original's, verbatim. The JSX-flavor twin is [`todos-blocks`](../todos-blocks).

How the no-JSX flavor reads:

- A hole is a source (a store path such as `props.todo.title`, a `$signal` / `$memo` accessor, a `readStore` selection) or a block (`$(function* () { … })`, or a bare `function*`). The view generator itself never reads — a no-JSX view may only yield child views, a type error otherwise — so it runs once and each hole is its own computation.
- Components are given to `h` (`h(TodoItem, { todo })`, `h(Loading, { fallback }, h(MainSection, { filter }), …)`): they are created where the output is materialized, as a JSX tag would be. The result's type carries the component's and its children's pending / failures; `h(Loading, …)` subtracts pending, `h(Errored, …)` failures.
- Flow controls are called: `For({ each: filtered, children: todo => h(TodoItem, { todo }) })`, `Show({ when: hasTodos, children: h(…) })`; their output carries the coloring of `each` / `when` and of their content.
- Tag and attribute names are checked by TypeScript (`h("dvi")`, `h("a", { hreff })` are errors).

`no-explicit-any` is off for `src/todos.ts` only (verbatim data layer). No casts in the block code.

```bash
pnpm test         # behavior (7) + parity against examples/todos (1): DOM after 27 steps
pnpm typecheck && pnpm lint && pnpm build
node ../../scripts/example-blocks/browser.mjs todos --twin -blocks-h
```
