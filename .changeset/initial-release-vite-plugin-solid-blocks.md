---
"vite-plugin-solid-blocks": minor
---

Initial release: the JSX transform's one block rule for solid-blocks (`yield*` in a JSX hole becomes `perform(…)`; refused positions `BLOCKS_YIELD_IN_REF`, `BLOCKS_YIELD_IN_SPREAD`, `BLOCKS_YIELD_IN_SPREAD_CHILD`, `BLOCKS_PLAIN_YIELD_IN_JSX`), as a Vite plugin (before `@solidjs/vite-plugin`), a Babel plugin and a plain `transform()`; it also gives the library's `lazy(() => import("…"))` its module URL.
