---
"vite-plugin-solid-yield": minor
---

Initial release: the JSX transform's one yield rule for solid-yield (`yield*` in a JSX hole becomes `perform(…)`; refused positions `YIELD_IN_REF`, `YIELD_IN_SPREAD`, `YIELD_IN_SPREAD_CHILD`, `PLAIN_YIELD_IN_JSX`), as a Vite plugin (before `@solidjs/vite-plugin`), a Babel plugin and a plain `transform()`; it also gives the library's `lazy(() => import("…"))` its module URL.
