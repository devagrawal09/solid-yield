---
"solid-blocks": minor
"eslint-plugin-solid-blocks": minor
---

A block component handed to foreign code handles its own failures (D-088). Plain Solid — the router's `component`, `@solidjs/web`'s `render` / `hydrate` / `renderTo…` — renders a component with no `yield*`, so its colors stop there: it may pend (under the app's `Loading`), but a failure would reach no type. New export `foreign(Comp)`: the identity at run time, and a type error, `[FOREIGN_HANDOFF]`, listing the failures' `kind`s, when the component may fail — handle them inside it (an `Errored` in its view) first: `defineRoute({ path: "/", component: foreign(Live) })`. New lint rule `no-unchecked-foreign-handoff` (an error in `recommended`): a block component given as a `component` property or attribute, to `@solidjs/web`'s `render` / `hydrate` / `renderTo…`, or (with types) to Solid's `lazy`, without `foreign(…)`; with type information it names what the component may fail with, and a local bridge (`route(Live)`) is reported too.
