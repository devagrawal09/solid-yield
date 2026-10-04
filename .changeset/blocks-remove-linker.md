---
"eslint-plugin-solid-blocks": minor
---

The type linker is removed (D-023): prop colors are declared on the props type (`Props<{ todo: Source<Todo, FetchError, true> }>`, D-068) and TypeScript checks every call site locally. Removed with it:

- the `@solidjs/blocks-linker` package (never released), with its Vite plugin and `solid-link` CLI;
- each twin's `link` / `link:check` scripts, its `solidLink()` Vite plugin and its committed `solid-props.gen.d.ts`;
- the `typed-props-key` lint rule (there is no linker key to name);
- `.prettierignore`, which existed only to keep the generated files byte-for-byte.

The blocks gate loses its per-twin `link:check` steps and `pkg:blocks-linker:test` (39 → 30 steps), and its baseline is regenerated.
