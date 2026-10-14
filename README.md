# solid-yield

`solid-yield` is a library for writing Solid 2 components as **yield components**: generator functions in which every read is a `yield*`, so that a component's type says whether it may be pending, which errors it may fail with, and which contexts it requires.

## Sugar mode (in progress on proto/sugar)

Write plain Solid, add the plugin, and get typed failures without writing
generators or importing the library in your app code. The plugin converts the
reactive core to yield routines; everything outside that core stays plain Solid
at a named foreign boundary, where unknown failures must be handled. The editor
plugin and matching CLI check are planned. See [the branch design](https://github.com/devagrawal09/solid-yield/blob/5e03328ec2fcd872f87228d4dac4f21bae9fb4c1/documentation/sugar-design.md).

## The problem

In Solid 2 a component's signature hides what its reads do. The two components below render the same list:

### In Solid 2

```tsx
function TodoList(props: { listId: string }) {
  const theme = useContext(ThemeCtx);
  const todos = createMemo(() => fetchTodos(props.listId));
  return (
    <ul class={theme}>
      <For each={todos()}>{todo => <li>{todo.title}</li>}</For>
    </ul>
  );
}
// TodoList: (props: { listId: string }) => JSX.Element
```

`todos()` suspends until the fetch resolves, so a `<Loading>` must sit above it. If the fetch rejects, it throws, so an `<Errored>` must sit above it too. `ThemeCtx` must be provided. The type shows none of this.

### In solid-yield

<!-- prettier-ignore -->
```tsx
const TodoList = component(function* TodoList(props: Props<{ listId: string }>) {
  const theme = yield* ThemeCtx;
  const todos = yield* $memo(function* () {
    const id = yield* props.listId;
    return yield* attempt(
      () => fetchTodos(id),
      cause => new FetchError(String(cause))
    );
  });
  return view(function* () {
    return (
      <ul class={yield* theme}>
        {yield* For({ each: todos, children: function* (todo) {
          return view(function* () { return <li>{yield* todo.title}</li>; });
        } })}
      </ul>
    );
  });
});
// TodoList({ listId }): ComponentView<P, E, W, R> with
//   P = true (may be pending), E = FetchError (may fail),
//   W = false (binds no event that waits),
//   R = RequiredContext<"light" | "dark", "ThemeCtx"> (requires ThemeCtx)
```

What this gets you:

- **Boundaries are checked when you compile.** `Loading` removes the pending flag from the type, `Errored({ catch: [FetchError] })` removes `FetchError`, and `ThemeCtx.provide` removes the requirement.
- **A missing `Loading` or provider is a type error at the root.** `render` refuses what is left: `[PENDING_ROOT]`, or `[NO_PROVIDER] … "ThemeCtx"`. A failure that no `Errored` handles stays in the root's type and is re-thrown when it happens.
- **The lint covers what TypeScript can't see.** Its message names the line to write, and many of its rules autofix.

## The model

- **A yield component is a setup that returns a view.** The setup is a routine that runs once. It creates state with `$signal`, `$memo`, `$event` and `$effect`, and it reads contexts. The view is a routine that has no body, only **holes**: each read is a `yield*` inside JSX, and each hole is its own computation.
  `component(function* () { const [n] = yield* $signal(0); return view(function* () { return <p>{yield* n}</p>; }); })`
- **You call a component; you don't write it as a tag.** The `yield*` carries the child's pending, failures and requirements into the caller. A tag would drop them.
  `{yield* Card({ todo })}`
- **Props and context values are reactive sources.** You read them with `yield*` in a hole, a `$memo`, or an `$event`. A setup never reads them.
  `<h2 class={yield* theme}>{yield* props.todo.title}</h2>`
- **Async work and errors go through `attempt`.** In a `$memo`, `attempt` makes the memo pending while it waits, and failing with the error its handler returns. These **colors** flow up through every `yield*` until a `Loading` or `Errored` takes them. A write is `yield* setX(v)`, inside an `$event`.
  `yield* attempt(() => fetchTodos(id), cause => new FetchError(String(cause)))`
- **There are four colors.** They are the parameters of a view's type, `ComponentView<P, E, W, R>`:

  | Color    | Where it comes from                                                               | What discharges it                                                                    |
  | -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
  | pending  | reading an async `$memo` or store, or a `lazy` component                          | `Loading({ fallback, children })`                                                     |
  | fails    | an `attempt` whose handler returns a failure; `yield* raise(e)`                   | `Errored({ catch: [FetchError], fallback, children })`; with none, the root re-throws |
  | may-wait | binding (`onClick={yield* save}`) an `$event` that reads a pending source         | nothing; you show the wait (an `$optimistic`), and the lint warns (`no-unshown-wait`) |
  | requires | a setup reading a context created without a default, `createContext<T, "Name">()` | `Ctx.provide({ value, children })` around the call                                    |

## A complete example

Here is a todo list with three of the colors in it. `TodoList`'s view is pending, fails with `FetchError` and requires `ThemeCtx`, and `App` discharges each of them:

<!-- prettier-ignore -->
```tsx
import { Failure } from "solid-yield";
import { $event, $optimisticStore, attempt, component, createContext } from "solid-yield";
import { Errored, For, Loading, refresh, render, view } from "solid-yield";
import { api, type Todo } from "./api"; // list(): Promise<Todo[]>, add(todo): Promise<void>

class FetchError extends Failure("fetch") { // fails: a failure is a nominal Error instance
}
const fetchError = (cause: unknown) => new FetchError(String(cause));
const ThemeCtx = createContext<"light" | "dark", "ThemeCtx">(); // no default: readers require it

const TodoList = component(function* TodoList() {
  const theme = yield* ThemeCtx; // requires ThemeCtx
  const [todos, setTodos] = yield* $optimisticStore(function* () {
    return yield* attempt(() => api.list(), fetchError); // pending until loaded; fails with FetchError
  }, [] as Todo[]);
  const add = $event(function* (e: SubmitEvent & { currentTarget: HTMLFormElement }) {
    e.preventDefault();
    const todo = {
      id: crypto.randomUUID(),
      title: String(new FormData(e.currentTarget).get("title"))
    };
    yield* setTodos(list => void list.push(todo)); // optimistic: shows at once, until the event settles
    yield* attempt(() => api.add(todo), fetchError); // the bound event may fail: the view's failure too
    yield* refresh(todos); // the server's list replaces the optimistic one
  });
  return view(function* () {
    return (
      <form class={yield* theme} onSubmit={yield* add}>
        <input name="title" />
        <ul>
          {yield* For({ each: todos, children: function* (todo) {
            return view(function* () { return <li>{yield* todo.title}</li>; });
          } })}
        </ul>
      </form>
    );
  });
});

// each call discharges one color: provide (requires), Errored (fails), Loading (pending)
const App = component(function* App() {
  return view(function* () {
    return <main>{yield* ThemeCtx.provide({ value: "dark", children: function* () {
      return <>{yield* Errored({
        catch: [FetchError],
        fallback: err => <p>{err().message}</p>,
        children: function* () {
          return <>{yield* Loading({ fallback: "loading…", children: function* () {
            return <>{yield* TodoList()}</>;
          } })}</>;
        }
      })}</>;
    } })}</main>;
  });
});

render(App, document.getElementById("root")!); // settled, requires nothing: accepted
```

Mapped onto Solid 2: `$optimisticStore` is `createOptimisticStore`, `$event` is an `action`, `refresh` and the boundaries are Solid's own. The `yield*`s are what add the types.

## Using it today (from source)

There is no npm release yet. To build the packages, you need Node 24 and pnpm 11:

```sh
git clone https://github.com/devagrawal09/solid-yield.git
cd solid-yield && pnpm install && pnpm build   # builds packages/yield/dist
```

In your app, next to the clone, depend on the three packages by `file:` path. The versions below are tested together with pnpm:

```jsonc
{
  "dependencies": {
    "solid-yield": "file:../solid-yield/packages/yield",
    "solid-js": "^2.0.0-rc.13",
    "@solidjs/web": "^2.0.0-rc.13"
  },
  "devDependencies": {
    "vite-plugin-solid-yield": "file:../solid-yield/packages/vite-plugin-yield",
    "eslint-plugin-solid-yield": "file:../solid-yield/packages/eslint-plugin-yield",
    "@solidjs/vite-plugin": "3.0.0-next.47",
    "vite": "^8",
    "typescript": "~6.0",
    "eslint": "^10",
    "@typescript-eslint/parser": "^8",
    "vitest": "^5",
    "jsdom": "^30"
  }
}
```

pnpm copies a `file:` dependency when it installs it. So after `git pull && pnpm build` in the clone, run `pnpm install --force` in the app. If you want the app to point at the clone directly, use `link:` instead of `file:`, which is what `pnpm link` does.

```ts
// vite.config.ts: the yield transform runs before Solid's JSX compiler
import { defineConfig } from "vitest/config";
import solidYield from "vite-plugin-solid-yield";
import solid from "@solidjs/vite-plugin";

export default defineConfig({ plugins: [solidYield(), solid()], test: { environment: "jsdom" } });
```

```js
// eslint.config.mjs
import tsParser from "@typescript-eslint/parser";
import solidYield from "eslint-plugin-solid-yield";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, projectService: true }
    },
    plugins: { "solid-yield": solidYield },
    rules: { ...solidYield.configs.recommended.rules }
  }
];
```

```jsonc
// tsconfig.json, compilerOptions
"jsx": "preserve",
"jsxImportSource": "solid-yield",  // only settled views are elements; only DOM elements and foreign components are tags
"jsxFactory": "jsx",               // these two make TypeScript check a fragment's children
"jsxFragmentFactory": "Fragment"
```

**Solid versions.** `solid-yield` declares `solid-js` and `@solidjs/web` (and, for the no-JSX flavor, `@solidjs/h`) as peers at `^2.0.0-rc.11`. Today that range resolves to `2.0.0-rc.13`, the version everything here is tested on. `@solidjs/vite-plugin@3.0.0-next.47` needs rc.13 and Vite 8, and `typescript@~6.0` is pinned because `@typescript-eslint/parser` 8 does not support TypeScript 7.

**Tests.** vitest with `environment: "jsdom"` (as in the config above) picks the library's client build; call `flush()` from `solid-js` between steps.

The rest of the setup is in [getting-started.md](documentation/getting-started.md): mounting, flow controls, events and transactions, forms, and an app shell with a router.

## What you can't write

A Solid developer usually runs into these five rules first. Each one is checked by at least one of: TypeScript, a development error (stripped from production builds), or the lint. [refusals.md](documentation/refusals.md) lists them all.

<!-- prettier-ignore -->
```tsx
// 1. A read outside a hole: dev READ_IN_VIEW, lint no-read-in-view-body
return view(function* () { const n = yield* count; return <p>{n}</p>; });    // ✗
return view(function* () { return <p>{yield* count}</p>; });                 // ✓

// 2. A tag instead of a call: TS2786 "'Card' cannot be used as a JSX component", lint no-component-tag (autofix)
<main><Card todo={todo} /></main>                                            // ✗
<main>{yield* Card({ todo })}</main>                                         // ✓

// 3. A plain throw: dev UNTYPED_THROW, lint no-throw
if (!user) throw new Error("not found");                                     // ✗
if (!user) yield* raise(new NotFound());                                     // ✓ NotFound: an Error with a literal kind

// 4. Creating in a view: types (at view(…)) Create<"signal", never> is not assignable to ViewOp; dev CREATE_OUTSIDE_SETUP
return view(function* () { const [n] = yield* $signal(0); /* … */ });       // ✗
const [n] = yield* $signal(0); return view(function* () { /* … */ });       // ✓ create in the setup

// 5. Reading a prop in the setup: types (at component(…)) Read<false, never> is not assignable to SetupOp; dev READ_IN_SETUP
const id = yield* props.id;                                                  // ✗ in the setup
<p>{yield* props.id}</p>                                                     // ✓ in a hole, a $memo or an $event
```

## Roadmap

Public roadmap: https://github.com/devagrawal09/solid-yield/issues/1

[HANDOFF.md](HANDOFF.md#roadmap-and-compiler-checkpoint-2026-10-08-d-116) has the current order (D-116).

- **v0.1, the library** (now): the runtime, the transform and the lint described here. It is waiting to be published to npm.
- **v0.2:** bounded native sugar, the editor plugin and matching CLI check, including serialization-safe typed failures (D-115).
- **Then:** a dashboard twin written as plain Solid.
- **Then:** islands (server components with client slots) productized, subject to DOM parity and the purity trust model (D-114).
- **Then:** the lazy builder, with descriptors that become live on first interaction, a step toward resumability without a new runtime.

## Status

- **This is a design lab, and this is the strict dialect.** The compiler route is the ergonomic one. Here every read and write is spelled out, so each rule of the model can be checked and every awkward spot shows up as a finding.
- **What is stated:** [calculus.md](documentation/calculus.md) is a core calculus for the dialect. It states the soundness theorem the types claim ("the types say exactly what the runtime does"), and it traces each of its 52 proof obligations to the code and the tests that support it. The whole-dialect theorem is stated and supported by tests; the abstract core has the partial formal proofs described below.
- **What is tested:** every commit is gated. The gate runs nine example twins (docs-yield, effect-yield, hackernews-spa-yield, rendering-yield, room-yield, sierpinski-yield, sierpinski-yield-h, todos-yield and todos-yield-h), which are real Solid apps rewritten in this dialect, checked for DOM parity against the originals step by step. It also renders the twins on the server and hydrates that output, runs a conformance suite against handwritten Solid, and runs the packages' type, runtime and lint tests.
- **Decisions:** each rule comes with its alternatives and its reasoning in [DECISIONS.md](documentation/DECISIONS.md). Where the work stands, and how to work on the repository and run the gate, is in [HANDOFF.md](HANDOFF.md).

Read next: [getting-started.md](documentation/getting-started.md) (the setup, and the dialect on one page), [refusals.md](documentation/refusals.md) (every refusal, layer by layer) and [yield-library.md](documentation/yield-library.md) (the reference).

## Calculus proofs

The [proof audit](documentation/calculus-proofs/README.md) includes **12
obligations mechanized in Lean, 26 paper proofs, and 14 unprovable as worded** at
its audited revision. The abstract proofs cover color preservation, boundary
handling and root safety; later main repairs supersede some historical findings.
They do not prove the whole TypeScript/runtime connection.

Run `pnpm proofs` to build the Lean project and run the 11 runtime probes.
Install elan for the pinned `leanprover/lean4:v4.24.0` toolchain. Lake lookup is
`$LAKE`, PATH, then `/private/tmp/elan/bin/lake` with `ELAN_HOME=/private/tmp/elan`.
The report-only `proofs` gate step runs the same checks without coverage thresholds;
when Lake is absent, it reports SKIP with an install hint and keeps the gate green.
The [verification record](documentation/calculus-proofs/verification.md) separates
the historical audit from the adapted checks on main.

## License

MIT, copyright (c) 2026 Dev Agrawal ([LICENSE](./LICENSE)). The vendored Solid originals in `examples/originals/`, the JSX types generated from `@solidjs/web`, and the compiler outputs kept as the plugin's oracle are Solid's, under its MIT notice ([NOTICE](./NOTICE)).

## Examples

- [dashboard — original only; for sugar/native mode](examples/originals/dashboard/README.md)

## Analyzer

Run `pnpm run analyze docs-yield` (or omit the name for all nine twins).
The report shows which parts share state and boundaries, which effects or setup
work make a group eager, what each event can reach, and which regions are
server-derived (S), server-recomputable (R), or client-owned. It names captures
that cannot cross an edge. These are diagnostics, not savings or proven roots;
`--json` gives the full detail. See [the tool](packages/compiler-yield/README.md).

The analyzer recognizes module-level `"use pure"` as an author assertion and lists marked modules without checking their implementations; [C3c](https://github.com/devagrawal09/solid-yield/blob/ada81a8d3af2c1e3a783468ac820875fff1fb99d/documentation/compiler-c3c-scaling.md) measures islands (server components with client slots) as a wash near **25 KB gzip** of server-derivable code and a clear win from **~110 KB** (D-114; emitters stay on `proto/compiler`). C2 measured static extraction + eager root split (seven-root and single-root modes), where every root remains a full client component and the article still renders in the browser; those measurements show no load gain. C3–C3c instead render the content on the server and keep small interactive leaves as client slots.
