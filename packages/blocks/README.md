# solid-blocks

Generator blocks for Solid 2 as a library. A runtime interpreter on Solid's public API, with strict types.

**This is the strict dialect; the compiler route is the ergonomic one.** Solid's `experiment/iterable-signals` branch builds the same model into its compiler and core. This package does it in userland, and makes every rule checkable: types first, then development errors, then [lint rules](../eslint-plugin-blocks). It is a design lab (D-002), not a polished end-user API.

```tsx
import { $component, $event, $signal, view, type Props } from "solid-blocks";

export const Counter = $component(function* Counter(props: Props<{ step: number }>) {
  // setup: creates, never reads
  const [count, setCount] = yield* $signal(0);
  const add = $event(function* () {
    yield* setCount((yield* count) + (yield* props.step));
  });
  // view: no body; every read is a hole
  return view(function* () {
    return <button onClick={add}>{yield* count}</button>;
  });
});
```

- Every read and write is a `yield*`.
- A setup creates and never reads.
- A view has no body: every read is a hole in JSX, and structure comes from flow controls.
- A block component is called (`{yield* Counter({ step })}`), not tagged.
- Failures are typed: `attempt`, `raise`, and `Errored` with `catch`.
- A prop's pending/failure color is declared: `Props<{ todo: Source<Todo, FetchError, true> }>`.

The full rules, where each is enforced, and what the library cannot do without a compiler are in [`documentation/blocks-library.md`](../../documentation/blocks-library.md).

## Setup

```sh
pnpm add solid-blocks solid-js @solidjs/web
pnpm add -D vite-plugin-solid-blocks @solidjs/vite-plugin eslint-plugin-solid-blocks
```

```js
// vite.config.mjs: the block rule runs before Solid's JSX compiler
import blocks from "vite-plugin-solid-blocks";
import solid from "@solidjs/vite-plugin";
export default { plugins: [blocks(), solid()] };
```

```jsonc
// tsconfig.json
{ "compilerOptions": { "jsx": "preserve", "jsxImportSource": "solid-blocks" } }
```

## Entry points

| Import | What |
| --- | --- |
| `solid-blocks` | the runtime and its types (client and server builds, development and production) |
| `solid-blocks/h` | the no-JSX flavor (`h`), which also needs `@solidjs/h` |
| `solid-blocks/jsx-runtime`, `solid-blocks/jsx-dev-runtime` | the JSX namespace for `jsxImportSource` |

`test/exports-matrix.test.mjs` pins which file each entry point resolves to under each condition: development, default, browser, node, and types.

## Peer dependencies

`solid-js` and `@solidjs/web` at `^2.0.0-rc.11`, plus `@solidjs/h` (optional) for `solid-blocks/h`. The library uses only Solid's public API (D-004). The twins in this repository's `examples/` show whether a new Solid release still matches it (D-016).

## Vendored JSX types

`jsx/jsx.d.ts` and `jsx/jsx-properties.d.ts` are generated from the installed `@solidjs/web`'s `types/` by `scripts/jsx-from-web.mjs`, which then runs `scripts/jsx-web-shared.mjs`. They are checked in and regenerated on every build (`pnpm run types:jsx`), so they follow a Solid bump in the lockfile.
