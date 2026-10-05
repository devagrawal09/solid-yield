# Getting started with `solid-blocks`

**This is the strict dialect; the compiler route is the ergonomic one** (D-002). `solid-blocks` runs generator blocks as a library on stock Solid 2, and holds every rule of the model to a check: a type, then a development error, then a lint rule. Solid's `experiment/iterable-signals` branch builds the same model into its compiler, which can make much of this implicit. Here nothing is implicit. This page is the dialect on one page. The reference is [`blocks-library.md`](./blocks-library.md); every refusal is listed in [`refusals.md`](./refusals.md).

The program this page builds is [`packages/blocks/test/docs/getting-started.tsx`](../packages/blocks/test/docs/getting-started.tsx). It is type-checked, linted and run by the gate.

## Install

```sh
pnpm add solid-blocks solid-js @solidjs/web
pnpm add -D vite-plugin-solid-blocks @solidjs/vite-plugin eslint-plugin-solid-blocks @typescript-eslint/parser
```

Solid is a peer dependency, at `^2.0.0-rc.11`. The no-JSX flavor (`solid-blocks/h`) also needs `@solidjs/h`.

```js
// vite.config.mjs: the block rule runs before Solid's JSX compiler
import blocks from "vite-plugin-solid-blocks";
import solid from "@solidjs/vite-plugin";

export default { plugins: [blocks(), solid()] };
```

```jsonc
// tsconfig.json: only settled views are elements; only DOM elements and foreign components are tags
{ "compilerOptions": { "jsx": "preserve", "jsxImportSource": "solid-blocks", "strict": true } }
```

```js
// eslint.config.mjs (flat config): the rules TypeScript cannot express
import tsParser from "@typescript-eslint/parser";
import blocks from "eslint-plugin-solid-blocks";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, projectService: true }
    },
    plugins: { "solid-blocks": blocks },
    rules: { ...blocks.configs.recommended.rules }
  }
];
```

Then mount the root:

```tsx
import { render } from "solid-blocks";
import { App } from "./app";

render(App, document.getElementById("root")!);
```

## The dialect on one page

| | Rule | Written |
| --- | --- | --- |
| **Blocks** | Every read and every write is a `yield*`. Blocks are `function*`, never `async`. | `yield* count`, `yield* setCount(1)` |
| **Setup** | A component's body runs once. It *creates* state, effects, events and contexts, and it never reads (D-042). It returns its view. | `const [count, setCount] = yield* $signal(0)` |
| **View** | A view has no body (D-032). It is `return <…/>`, every read is a hole, and structure comes from flow controls. No `if`, no early `return`, no local computation, no `yield*` outside JSX. | `return view(function* () { return <p>{yield* count}</p>; })` |
| **Holes** | A `yield*` in a JSX position is a hole: its own computation, re-run when what it reads changes. Derive in a hole or in a `$memo`. | `{(yield* count) * 2}` |
| **Writes** | A setter returns a receipt, and the write happens when it is delegated to. Only an `$event` or an `$effect` writes. | `yield* setCount((yield* count) + 1)` |
| **Events** | An `$event` is *bound* in a view, `onClick={yield* save}`: a hole that attaches the handler, un-called, and gives the view its failures (D-072); a call that may wait on a pending read marks the view *may wait*, never pending (D-075). Another event *calls* it, `yield* save(x)`. | `<button onClick={yield* save}>` |
| **Call form** | A block component, a flow control and a boundary are *called* in a hole, never tagged (D-062). Props are a source, a zero-arity `function*` hole, or a settled value (D-065). `children` is always a generator (D-066). | `{yield* Card({ todo, children: function* () { return <i />; } })}` |
| **Colors** | Reading may be *pending* (async) or *fail* with a typed error: `Source<T, E, P>`. A prop declares the colors it accepts (D-068). A call passes only what the declaration admits. Colors flow up through `yield*` to a `Loading` / `Errored`. | `props: Props<{ user: Source<User, NotFound, true> }>` |
| **Failures** | A failure is an `Error` with a literal `kind` (D-034). `attempt(fn, onError)` gives a failure its type, and `raise(e)` fails with one. An `Errored` handles failures, or with `catch` only the listed ones. With no `Errored` the failure is re-thrown (D-033). A plain `throw` is a bug (`UNTYPED_THROW`), and `try` / `catch` is not a block form (`no-try-catch`): `attempt`'s handler returns the failure, or nothing to absorb it (D-076, D-077). | `yield* attempt(() => fetch(u), cause => new NotFound(cause))` |

## Build it, rule by rule

### 1. Setup, view, hole, event

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
    return (
      <button class="counter" onClick={yield* add}>
        {yield* count}
      </button>
    );
  });
});
```

- **Setup.** The setup runs once. `yield* $signal(0)` *creates*, which a setup may do. Writing `yield* count` here would *read*, which a setup may not: that is a type error (`Read` is not a `SetupOp`), and the dev error `READ_IN_SETUP`.
- **Props.** `props.step` is a source like any other. The setup does not read it; the event does.
- **Event.** `$event` is a transaction. `setCount(…)` alone writes nothing: the write happens at `yield* setCount(…)`. A bare call is the lint error `no-unyielded-write`, and in development `UNYIELDED_WRITE`.
- **Binding.** `onClick={yield* add}` binds the event: the handler is attached, not called, and what a click may do joins the view's type. Here that is nothing. An event that may fail gives the view its failure, which goes to the nearest `Errored` (D-072). One that may wait on a pending read does not make the view pending: nothing suspends a view while a call waits. The view's type marks it *may wait* instead, and the lint warning `no-unshown-wait` asks you to show the wait yourself (D-075). `onClick={add}` would drop both: it is a type error (an event attribute takes only a bound handler) and the lint error `no-unbound-event`, whose autofix adds the `yield*`.
- **View.** `{yield* count}` is a hole. The transform rewrites it to `perform(count)`, and only that text node updates. `view(…)` makes TypeScript report a mistake in the view at the view, not at `$component(`. A top-level `const n = yield* count` above the `return` would be `READ_IN_VIEW` and the lint error `no-read-in-view-body`.

### 2. Call a component, pass it a source

```tsx
{yield* Counter({ step: 2 })}
```

A block component is called inside a hole, never written `<Counter step={2} />`. The tag is a type error (the JSX namespace's `ElementType`) and the lint error `no-component-tag`, whose autofix writes the call. The call is what carries the component's colors into the caller: a tag would type as a plain `JSX.Element` and drop them.

A prop is a value (`2`), a source (`step: count`), or a hole (`step: function* () { return (yield* count) * 2; }`), which the child reads where it reads the prop. A `yield*` in the argument object would read in the *caller's* hole and re-create the child on every change: that is the lint error `no-read-in-prop`.

### 3. Async data with a typed failure

```tsx
export class NotFound extends Error {
  readonly kind = "not-found" as const;
}

const [id, setId] = yield* $signal(1);
const user = yield* $memo(function* () {
  const current = yield* id; // a memo reads before its first async attempt
  return yield* attempt(
    () => fetchUser(current),
    cause => new NotFound(String(cause))
  );
});
```

- **The memo's type.** `user` is a `Source<User, NotFound, true>`: it may be pending, and may fail with a `NotFound`.
- **`attempt`.** It is the one place a failure gets its type. The handler is required, and it must return a `Failure`: an `Error` with a literal `kind`. Without the `kind` it is the type error `[FAILURE_KIND]`.
- **Reads after the attempt.** A memo's reads after an async `attempt` would not be tracked: dev error `READ_AFTER_ATTEMPT`, lint error `read-before-attempt`.

### 4. A child declares the colors it accepts

```tsx
export const UserCard = $component(function* UserCard(
  props: Props<{ user: Source<User, NotFound, true> }>
) {
  return view(function* () {
    return <h2 class="user">{yield* props.user.name}</h2>;
  });
});
```

`Props<{ … }>` maps each field to a read. A bare `T` means settled and never failing, and is the default (D-024). `Source<T, E, true>` admits pending and `E`. `props.user.name` is a path: a read of one key, not an object.

At the call, `UserCard({ user })` type-checks because the declaration admits the memo's colors. Declared `user: User` instead, the same call would be refused with `[SETTLED_PROP]`. The child's view is now a `View<true, NotFound>`, and the caller must place it where pending and that failure are handled.

### 5. Boundaries and flow controls

```tsx
{yield* Show({
  when: function* () {
    return (yield* id) > 1;
  },
  children: function* () {
    return <p class="hint">not the first user</p>;
  }
})}
{yield* Errored({
  catch: [NotFound],
  fallback: err => <p class="error">{err().message}</p>,
  children: function* () {
    return (
      <>
        {yield* Loading({
          fallback: "loading…",
          children: function* () {
            return <>{yield* UserCard({ user })}</>;
          }
        })}
      </>
    );
  }
})}
```

- **Structure comes from flow controls.** A view may not `if`. `Show`'s `when` is a source or, here, a hole. Its `children` is a lazy view, built only when the branch shows.
- **`Loading`** handles the pending color.
- **`Errored`** with `catch: [NotFound]` handles that failure type and removes it from the type. Any other failure passes to the boundary above.
- **The root.** With both handled, `App` is a settled view, which `render` accepts. A root that may fail is accepted too (D-033: re-thrown), but a pending root is not.

The whole program is [`getting-started.tsx`](../packages/blocks/test/docs/getting-started.tsx).

## Where a refusal is reported

Each rule is checked as early as the tools allow:

1. **Types.** For example: a component tag, a read in a setup, a create or write in a view, a source called like a function, an unbound event handler, an unhandled pending at the root, `[SETTLED_PROP]`, `[FAILURE_KIND]`, `[HVIEW_READ]`.
2. **The transform** (at build time). A `yield*` in a JSX position it cannot make a hole: `BLOCKS_YIELD_IN_REF`, `…_SPREAD`, `…_SPREAD_CHILD`, `BLOCKS_PLAIN_YIELD_IN_JSX`.
3. **Development errors**, thrown where they happen and stripped from production builds. For example: `READ_IN_VIEW`, `READ_IN_SETUP`, `UNYIELDED_WRITE`, `UNTYPED_THROW`, `JSX_IN_SETUP`, `PATH_OBJECT`.
4. **Lint** (`eslint-plugin-solid-blocks`), for what TypeScript cannot see. For example: `no-read-in-view-body`, `no-read-in-prop`, `component-children-generator`, `no-unbound-event`, `no-throw`.

[`refusals.md`](./refusals.md) puts every one of them in one place, starting with what you cannot write in a view.
