# Getting started with `solid-yield`

**This is the strict dialect; the compiler route is the ergonomic one.** `solid-yield` runs yield components as a library on stock Solid 2, and holds every rule of the model to a check: a type, then a development error, then a lint rule. Solid's `experiment/iterable-signals` branch builds the same model into its compiler, which can make much of this implicit. Here nothing is implicit. This page is the dialect on one page, then a reference for flow controls and events, then a recipe for an app shell. Every refusal is listed in [`refusals.md`](./refusals.md); the full reference is [`yield-library.md`](https://github.com/devagrawal09/solid-yield/blob/main/documentation/yield-library.md) in the repository.

The programs this page builds are type-checked, linted and run by the repository's gate: [`getting-started.tsx`](https://github.com/devagrawal09/solid-yield/blob/main/packages/yield/test/docs/getting-started.tsx) (sections 1–5) and [`reference.tsx`](https://github.com/devagrawal09/solid-yield/blob/main/packages/yield/test/docs/reference.tsx) (the reference sections), each with its `.spec.tsx`.

Codes such as D-062, in this page's links, in [`refusals.md`](./refusals.md) and in the lint's and the types' messages, cite the design's decision log, [`DECISIONS.md`](https://github.com/devagrawal09/solid-yield/blob/main/documentation/DECISIONS.md): each entry has the rule, the alternatives and the reasoning. You never need it to fix a refusal.

## Install

```sh
pnpm add solid-yield solid-js@^2.0.0-rc.13 @solidjs/web@^2.0.0-rc.13
pnpm add -D vite@^8 @solidjs/vite-plugin@3.0.0-next.47 vite-plugin-solid-yield \
  typescript@~6.0 eslint@^10 @typescript-eslint/parser@^8 eslint-plugin-solid-yield \
  vitest@^5 jsdom
```

Why these versions (tested together, 2026-10-06: typecheck, lint, tests and `vite build` of the [app shell](#recipe-an-app-shell) below, no unmet peer):

- **Solid** is a peer dependency of `solid-yield` at `^2.0.0-rc.11`; `@solidjs/vite-plugin@3.0.0-next.47` needs `^2.0.0-rc.13`.
- **`@solidjs/vite-plugin`** (Solid's JSX compiler): its `3.0.0-next.*` releases — `latest` is `3.0.0-next.47` — need **`vite` `^8`** (or `^9`). With `vite` 7 it installs with an unmet peer.
- **`typescript@~6.0`**: `@typescript-eslint/parser` 8 (which the lint needs for type information) supports TypeScript `>=4.8.4 <6.1.0`; a bare `pnpm add -D typescript` installs 7, which it does not.
- **`eslint`** (`>=9`) and **`@typescript-eslint/parser`** are the lint plugin's peers. **`vitest`** and **`jsdom`** are for tests: vitest with jsdom picks the library's client build.
- The no-JSX flavor (`solid-yield/h`) also needs `@solidjs/h`.

```js
// vite.config.ts: the yield rule runs before Solid's JSX compiler
import { defineConfig } from "vitest/config";
import solidYield from "vite-plugin-solid-yield";
import solid from "@solidjs/vite-plugin";

export default defineConfig({
  plugins: [solidYield(), solid({ hydratable: true })],
  // Client tests. Hydration tests use the separate recipe below.
  test: { environment: "jsdom" }
});
```

```jsonc
// tsconfig.json: only settled views are elements; only DOM elements and foreign components are tags
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "jsxImportSource": "solid-yield",
    // a fragment's children are checked too
    "jsxFactory": "jsx",
    "jsxFragmentFactory": "Fragment",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "test"]
}
```

`jsxFactory` / `jsxFragmentFactory`: TypeScript checks a fragment's children (against `Fragment`, typed `Element`) only with them set; without them an unyielded component call in `<>…</>` passes the types, and only the lint `component-call-yielded` reports it. They are part of the setup: the lint `require-jsx-factory` warns, once per project, when the tsconfig lacks them.

```js
// eslint.config.mjs (flat config): the rules TypeScript cannot express
import tsParser from "@typescript-eslint/parser";
import solidYield from "eslint-plugin-solid-yield";

export default [
  {
    files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, projectService: true }
    },
    plugins: { "solid-yield": solidYield },
    rules: { ...solidYield.configs.recommended.rules }
  }
];
```

The one recommended config covers tests too: a test's `import { flush } from "solid-js"` is admitted (`flush` is not reactive state); `no-foreign-reactive` reports only a `flush` used inside a routine.

Then mount the root:

```tsx
import { render } from "solid-yield";
import { App } from "./app";

render(App, document.getElementById("root")!);
```

## The dialect on one page

|               | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Written                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Routines**  | Every read and every write is a `yield*`. Routines are `function*`, never `async`.                                                                                                                                                                                                                                                                                                                                                                                           | `yield* count`, `yield* setCount(1)`                                |
| **Setup**     | A component's body runs once. It _creates_ state, effects, events and contexts, and it never reads. It returns its view.                                                                                                                                                                                                                                                                                                                                                     | `const [count, setCount] = yield* $signal(0)`                       |
| **View**      | A view has no body. It is `return <…/>`, every read is a hole, and structure comes from flow controls. No `if`, no early `return`, no local computation, no `yield*` outside JSX.                                                                                                                                                                                                                                                                                            | `return view(function* () { return <p>{yield* count}</p>; })`       |
| **Holes**     | A `yield*` in a JSX position is a hole: its own computation, re-run when what it reads changes. Derive in a hole or in a `$memo`.                                                                                                                                                                                                                                                                                                                                            | `{(yield* count) * 2}`                                              |
| **Writes**    | A setter returns a receipt, and the write happens when it is delegated to. Only an `$event` or an `$effect`'s effect phase writes (`$effect(compute, effect)`: the compute reads, the effect writes).                                                                                                                                                                                                                                                                        | `yield* setCount((yield* count) + 1)`                               |
| **Events**    | An `$event` is _bound_ in a view, `onClick={yield* save}`: a hole that attaches the handler, un-called, and gives the view its failures; a call that may wait on a pending read marks the view _may wait_, never pending. Another event _calls_ it, `yield* save(x)`. A call is one transaction (see [Events, transactions and in-flight state](#events-transactions-and-in-flight-state)).                                                                                  | `<button onClick={yield* save}>`                                    |
| **Call form** | A yield component, a flow control and a boundary are _called_ in a hole, never tagged. Props are a source, a zero-arity `function*` hole, or a settled value. `children` is always a generator.                                                                                                                                                                                                                                                                              | `{yield* Card({ todo, children: function* () { return <i />; } })}` |
| **Colors**    | Reading may be _pending_ (async) or _fail_ with a typed error: `Source<T, E, P>`. A prop declares the colors it accepts. A call passes only what the declaration admits. Colors flow up through `yield*` to a `Loading` / `Errored`.                                                                                                                                                                                                                                         | `props: Props<{ user: Source<User, NotFound, true> }>`              |
| **Failures**  | A failure is an `Error` with a literal `kind`. `attempt(fn, onError)` gives a failure its type, and `raise(e)` fails with one. An `Errored` handles failures, or with `catch` only the listed ones. With no `Errored` the failure is re-thrown. A plain `throw` is a bug (`UNTYPED_THROW`), and `try` / `catch` is not a routine form (`no-try-catch`): `attempt`'s handler returns the failure, or absorbs it with nothing or a value; it may be a generator, e.g. a retry. | `yield* attempt(() => fetch(u), cause => new NotFound(cause))`      |

## Build it, rule by rule

### 1. Setup, view, hole, event

```tsx
import { component, $event, $signal, view, type Props } from "solid-yield";

export const Counter = component(function* Counter(props: Props<{ step: number }>) {
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

- **Setup.** The setup runs once. `yield* $signal(0)` _creates_, which a setup may do. Writing `yield* count` here would _read_, which a setup may not: that is a type error (`Read` is not a `SetupOp`, reported at `component(`), and the dev error `READ_IN_SETUP`.
- **Props.** `props.step` is a source like any other. The setup does not read it; the event does.
- **Event.** `$event` is a transaction. `setCount(…)` alone writes nothing: the write happens at `yield* setCount(…)`. A bare call is the lint error `no-unyielded-write`, and in development `UNYIELDED_WRITE`.
- **Binding.** `onClick={yield* add}` binds the event: the handler is attached, not called, and what a click may do joins the view's type. Here that is nothing. An event that may fail gives the view its failure, which goes to the nearest `Errored`. One that may wait on a pending read does not make the view pending: nothing suspends a view while a call waits. The view's type marks it _may wait_ instead, and the lint warning `no-unshown-wait` asks you to show the wait yourself ([how](#events-transactions-and-in-flight-state)). `onClick={add}` would drop both: it is a type error (an event attribute takes only a bound handler) and the lint error `no-unbound-event`, whose autofix adds the `yield*`.
- **View.** `{yield* count}` is a hole. The transform rewrites it to `perform(count)`, and only that text node updates. `view(…)` makes TypeScript report a mistake in the view at the view, not at `component(`. A top-level `const n = yield* count` above the `return` would be `READ_IN_VIEW` and the lint error `no-read-in-view-body`.

### 2. Call a component, pass it a source

<!-- prettier-ignore -->
```tsx
return view(function* () {
  return <main>{yield* Counter({ step: 2 })}</main>;
});
```

A yield component is called inside a hole, never written `<Counter step={2} />`. The tag is a type error (the JSX namespace's `ElementType`) and the lint error `no-component-tag`, whose autofix writes the call. The call is what carries the component's colors into the caller: a tag would type as a plain `JSX.Element` and drop them.

A prop is a value (`2`), a source (`step: count`), or a hole (`step: function* () { return (yield* count) * 2; }`), which the child reads where it reads the prop. A `yield*` in the argument object would read in the _caller's_ hole and re-create the child on every change: that is the lint error `no-read-in-prop`.

### 3. Async data with a typed failure

<!-- prettier-ignore -->
```tsx
export class NotFound extends Error {
  readonly kind = "not-found" as const;
}

// in the setup:
const [id, setId] = yield* $signal(1);
const user = yield* $memo(function* () {
  const current = yield* id; // a memo reads before its first async attempt
  return yield* attempt(
    () => fetchUser(current),
    // on failure, retry once: the retry's failure is the memo's
    function* () {
      return yield* attempt(
        () => fetchUser(current),
        cause => new NotFound(cause instanceof Error ? cause.message : String(cause))
      );
    }
  );
});
```

- **The memo's type.** `user` is a `Source<User, NotFound, true>`: it may be pending, and may fail with a `NotFound`.
- **`attempt`.** It is the one place a failure gets its type. The handler is required, and its return decides. A `Failure` — an `Error` with a literal `kind` — fails the attempt with it; without the `kind` it is the type error `[FAILURE_KIND]`. Nothing, or a value, absorbs the failure: the attempt gives `undefined` or that value.
- **`cause` is `unknown`.** It is whatever the promise rejected with. Take its `message` when it is an `Error`; `String(cause)` of an `Error` gives `"Error: …"`.
- **The retry.** A handler may be a generator, run as the memo's own routine code: its reads, its nested `attempt` and its `yield* raise(e)` are the memo's, as its colors are. Here it returns the nested attempt's value (absorbing the first failure) or fails with the retry's `NotFound`. In an `$event` the same handler could write, inside the event's transaction.
- **Reads after the attempt.** A memo's reads after an async `attempt` would not be tracked: dev error `READ_AFTER_ATTEMPT`, lint error `read-before-attempt`.

### 4. A child declares the colors it accepts

```tsx
export const UserCard = component(function* UserCard(
  props: Props<{ user: Source<User, NotFound, true> }>
) {
  return view(function* () {
    return <h2 class="user">{yield* props.user.name}</h2>;
  });
});
```

`Props<{ … }>` maps each field to a read. A bare `T` means settled and never failing, and is the default. `Source<T, E, true>` admits pending and `E`. `props.user.name` is a path: a read of one key, not an object.

At the call, `UserCard({ user })` type-checks because the declaration admits the memo's colors. Declared `user: User` instead, the same call would be refused with `[SETTLED_PROP]`. The child's view is now a `View<true, NotFound>`, and the caller must place it where pending and that failure are handled.

### 5. Boundaries and flow controls

<!-- prettier-ignore -->
```tsx
return view(function* () {
  return (
    <main>
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
    </main>
  );
});
```

- **Structure comes from flow controls.** A view may not `if`. `Show`'s `when` is a source or, here, a hole. Its `children` is a lazy view, built only when the branch shows.
- **`Loading`** handles the pending color.
- **`Errored`** with `catch: [NotFound]` handles that failure type and removes it from the type. Any other failure passes to the boundary above. **Effect failures belong to the component, not its view** (D-073): an `Errored` in a component's own view does not catch that component's `$effect`. Put the boundary around the component call, or absorb the failure with `attempt` inside the effect.
- **The root.** With both handled, `App` is a settled view, which `render` accepts. A root that may fail is accepted too (the failure is re-thrown there), but a pending root is not (`[PENDING_ROOT]`): an app that is pending by design is wrapped at the root, `render(() => Loading({ children: App }), el)`.

## Flow controls and events

### Flow controls: the call signatures

Every flow control and boundary is called in a hole, `{yield* Show({ … })}`. Its `children` (and a `fallback`) is a generator:

- **A child that takes nothing is a lazy view**: `function* () { return <…/>; }`, built where (and each time) the control shows it.
- **A child that takes a value is a row**: `function* (value) { …; return view(function* () { return <…/>; }); }`. A row's body is a setup, as a component's is: it runs once per row (per item, per shown branch), may create (`yield* $memo(…)`, owned by the row), and returns its view. Its argument is a path, read in the view's holes (`{yield* note.title}`).

Writing a row's JSX directly, `children: function* (f) { return <p>{yield* f.message}</p>; }`, is a type error. The first row overload prints `[ROW_VIEW] a row returns its view: return view(function* () { return <.../>; })`. Wrap the markup in `return view(…)`. The `For` callback overload checks generators before expanding recursive element types, avoiding the extra TS2589 error.

| Control   | Called as                                                                                                       | `children`                                                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `For`     | `For({ each, fallback?, keyed?, children })`                                                                    | a row `function* (item, index) { return view(…); }`: `item` a path, `index` a `Source<number>`                                                  |
| `Repeat`  | `Repeat({ count, from?, fallback?, children })`                                                                 | a row `function* (index) { return view(…); }`                                                                                                   |
| `Show`    | `Show({ when, fallback?, keyed?, children })`                                                                   | a lazy view; or a row `function* (value) { return view(…); }`, `value` the non-null `when` as a path                                            |
| `Switch`  | `Switch({ fallback?, children })`                                                                               | a lazy view returning the `Match` calls: `function* () { return <>{yield* Match(…)}{yield* Match(…)}</>; }`                                     |
| `Match`   | `Match({ when, keyed?, children })`                                                                             | as `Show`'s                                                                                                                                     |
| `Loading` | `Loading({ fallback?, on?, children })`                                                                         | a lazy view; handles the pending color of what it holds                                                                                         |
| `Errored` | `Errored({ catch?, fallback, children })`; `catch: [NotFound]` handles only those classes, the rest pass upward | a lazy view; `fallback` is text, a lazy view, `(err, reset) => <…/>` (`err` an accessor), or a row `function* (err, reset) { return view(…); }` |

`when`, `each` and `count` take a source, a path, a settled value, or a zero-arity `function*` hole (`when: function* () { return (yield* id) > 1; }`). A `fallback` is text, `h` output, or a lazy view; never a JSX element given as it is (`[LAZY_VIEW]`).

One example each (from [`reference.tsx`](https://github.com/devagrawal09/solid-yield/blob/main/packages/yield/test/docs/reference.tsx)):

<!-- prettier-ignore -->
```tsx
// For: one row per note; the row returns view(…)
{yield* For({
  each: props.notes,
  fallback: function* () {
    return <li class="empty">no notes</li>;
  },
  children: function* (note) {
    return view(function* () {
      return <li class="note">{yield* note.title}</li>;
    });
  }
})}

// Show with a value: `failure` is a $signal<BadTitle | null>; the child takes the
// non-null value, so it is a row
{yield* Show({
  when: failure,
  children: function* (f) {
    return view(function* () {
      return <p class="failure">{yield* f.message}</p>;
    });
  }
})}

// Show with a condition: the child takes nothing, a lazy view
{yield* Show({
  when: function* () {
    return (yield* saved) !== null;
  },
  fallback: "not saved yet",
  children: function* () {
    return <p class="saved">saved: {yield* saved}</p>;
  }
})}

// Switch / Match
{yield* Switch({
  fallback: function* () {
    return <p class="status">idle</p>;
  },
  children: function* () {
    return (
      <>
        {yield* Match({
          when: function* () {
            return (yield* props.status) === "saving";
          },
          children: function* () {
            return <p class="status">saving…</p>;
          }
        })}
        {yield* Match({
          when: function* () {
            return (yield* props.status) === "saved";
          },
          children: function* () {
            return <p class="status">saved</p>;
          }
        })}
      </>
    );
  }
})}

// Errored around Loading: `notes` is a $memo of Source<Note[], LoadFailed, true>
{yield* Errored({
  catch: [LoadFailed],
  // a render function: the error (an accessor) and a reset
  fallback: (err, reset) => (
    <p class="load-failed">
      {err().message} <button onClick={reset}>retry</button>
    </p>
  ),
  children: function* () {
    return (
      <>
        {yield* Loading({
          fallback: function* () {
            return <p class="loading">loading…</p>;
          },
          children: function* () {
            return <>{yield* NoteList({ notes })}</>;
          }
        })}
      </>
    );
  }
})}
```

`NoteList` declares the colors it accepts, `props: Props<{ notes: Source<Note[], LoadFailed, true> }>`; declared `Source<Note[]>`, the call is refused. `Errored`'s `reset` is the one plain function an event attribute takes (`onClick={reset}`): it has no colors to bind.

An array `Source` has no `.length`. Read it first: `{(yield* messages).length}` in a view hole, or `(yield* messages).length` in a memo or event.

### Event props: `Handler<[T]>`

A component that takes a callback declares it as a `Handler`:

```tsx
import { component, $event, view, type Handler, type Props, type Source } from "solid-yield";

export type Theme = "light" | "dark";

export const ThemePicker = component(function* ThemePicker(
  props: Props<{ theme: Source<Theme>; onPick: Handler<[Theme]> }>
) {
  const pickDark = $event(function* () {
    // a handler in a prop is read, then called: `yield* (yield* props.onPick)(…)`
    yield* (yield* props.onPick)("dark");
  });
  return view(function* () {
    return (
      <button class="theme" onClick={yield* pickDark}>
        {yield* props.theme}
      </button>
    );
  });
});

// the parent passes an $event:
//   const pick = $event(function* (t: Theme) { yield* setTheme(t); });
//   {yield* ThemePicker({ theme, onPick: pick })}
```

- **`Handler<Args, E = never>`** is `EventHandler<Args, E, unknown, false, boolean>`: it takes `Args`, may fail with `E`, returns anything, may or may not do async work of its own, and does **not** wait on pending data. Any `$event` within those colors is accepted.
- **A handler that reads data which may be pending** is refused there; declare the colors it has, `EventHandler<Args, E, unknown, true>` — and a view binding a call of it is marked _may wait_ (the lint asks you to show it). A bare `EventHandler<[Theme]>` defaults to "may wait", so it warns even for a handler that only calls a setter: prefer `Handler`.
- **A plain function type** (`onPick: (t: Theme) => void`) is not a handler: reading the prop gives a function, and `yield*` of its call fails with "Type 'void' must have a '[Symbol.iterator]()' method". Routine code calls events, not functions.
- **In a context**, the same: `createContext<Handler<[Theme]>, "SetThemeCtx">(undefined, { name: "SetThemeCtx" })`, read with `yield* (yield* setTheme)("dark")` in an event.

### Form inputs

<!-- prettier-ignore -->
```tsx
const [title, setTitle] = yield* $signal("");
const edit = $event(function* (e: InputEvent & { currentTarget: HTMLInputElement }) {
  yield* setTitle(e.currentTarget.value);
});
const save = $event(function* (e: SubmitEvent) {
  e.preventDefault(); // synchronous: before the event's first wait
  // … yield* attempt(() => saveTitle(yield* title), …)
});
// in the view:
<form onSubmit={yield* save}>
  <input name="title" value={yield* title} onInput={yield* edit} />
</form>
```

- **`value=` plus `onInput`**: the input shows the signal; the event writes it. The handler's parameter is the DOM event, typed as you need it (`InputEvent & { currentTarget: HTMLInputElement }`).
- **`e.preventDefault()` in an `$event` is synchronous** as long as it comes before the body's first wait: the body runs, inside the DOM dispatch, up to its first async `attempt`. After a wait the dispatch is over, and it is too late (as after an `await`).
- **A `<form>` or a `<select>` may be a component's root** and be called in a hole (`{yield* Editor()}`).

## Events, transactions and in-flight state

An `$event` call is one **transaction** (a Solid action):

- **Its writes are held until it settles.** `yield* setSaving(true)` before an async `attempt` never shows: the write lands, with every other write of the call, when the call finishes — and `setSaving(false)` at the end means the screen never sees `true`. Inside the call, a read gives the value from before it, the call's own writes included.
- **`$optimistic` is the tool for in-flight state.** An optimistic source shows what the event writes to it at once, and reverts when the event settles (below).
- **A synchronous event's writes commit by the next microtask.** In a browser every user action is its own task, so the next event reads them. In a test that dispatches `input` and then `submit` in the same task, the submit reads the value from before the input: `flush()` (from `solid-js`) or `await` between the two.
- **An event's failure** goes to whoever handles its call (`yield*` it from another event, `attempt(() => save(e), …)`), else to the nearest `Errored` above where it was bound that takes it; with none, the call's promise rejects.

The form above, saving with its in-flight state shown:

```tsx
export const Editor = component(function* Editor() {
  const [title, setTitle] = yield* $signal("");
  const [saved, setSaved] = yield* $signal<string | null>(null);
  const [failure, setFailure] = yield* $signal<BadTitle | null>(null);
  // a $signal set to true here would never show; an $optimistic shows at once
  const [saving, setSaving] = yield* $optimistic(false);
  const edit = $event(function* (e: InputEvent & { currentTarget: HTMLInputElement }) {
    yield* setTitle(e.currentTarget.value);
  });
  const save = $event(function* (e: SubmitEvent) {
    e.preventDefault();
    yield* setSaving(true); // shows at once; reverts when the save settles
    const current = yield* title;
    const result = yield* attempt(
      () => saveTitle(current),
      // absorbed: the handler writes the failure and returns nothing
      function* (cause) {
        yield* setFailure(new BadTitle(cause instanceof Error ? cause.message : String(cause)));
      }
    );
    if (result !== undefined) {
      yield* setSaved(result);
      yield* setFailure(null);
    }
  });
  return view(function* () {
    return (
      <form class="editor" onSubmit={yield* save}>
        <input name="title" value={yield* title} onInput={yield* edit} />
        <button type="submit" disabled={yield* saving}>
          {(yield* saving) ? "Saving…" : "Save"}
        </button>
        {/* Show({ when: failure, … }) and Show({ when: saved, … }), as in the flow-control examples */}
      </form>
    );
  });
});
```

**What `no-unshown-wait` reads.** The warning fires where a view binds a handler whose type says it _may wait on pending data_ (its `P` color: it reads a source that may be pending, and the call waits for it). It reads only the type; it cannot see whether you show the wait. So:

- if the handler does not read pending data, make its type say so — for an event prop, `Handler<[T]>` (`P = false`), not a bare `EventHandler<[T]>` (whose default is "may wait");
- if it does, show the wait with an `$optimistic` written at the start of the event, then silence that one line with the reason: `// eslint-disable-next-line solid-yield/no-unshown-wait -- shown by saving`;
- an event that waits on its own async work (an `attempt` over a fetch) is not flagged — that wait is not a pending read — but it is still a wait to show, the same way.

A required context passes its name twice: as the type's identity and in `{ name: "ThemeCtx" }` for runtime errors. Type arguments disappear when JavaScript is built. The options name must match the type name; `[CONTEXT_NAME]` explains a missing runtime name.

**A context holding a changing value.** Declare the value's type, `createContext<Theme, "ThemeCtx">(undefined, { name: "ThemeCtx" })`, and provide a source, `ThemeCtx.provide({ value: theme, children })`: readers read it like a prop, in holes, memos and events, and see each change. Declare the context as `Source<T, E, true>` only when the provided source may be pending or fail.

## Lazy pages and chunk retry

`lazy` from `solid-yield` loads a yield component. Its import can fail with `ChunkError` (`kind: "chunk"`, the rejection in `cause`, the module URL in `specifier`). A `Loading` covers the import's wait; an `Errored` that catches `ChunkError` covers an import failure. Its reset tries the import again:

```tsx
import { ChunkError, Errored, Loading, component, lazy, view } from "solid-yield";
const Page = lazy(() => import("./page"));
const PageRoute = component(function* PageRoute() {
  return view(function* () {
    return <>{yield* Errored({
      catch: [ChunkError],
      fallback: (err, reset) => <section>
        <p>{err().message}</p>
        <button onClick={reset}>Retry loading the page</button>
      </section>,
      children: function* () {
        return <>{yield* Loading({
          fallback: "Loading page…",
          children: function* () { return <>{yield* Page()}</>; }
        })}</>;
      }
    })}</>;
  });
});
```

`reset` is already a bound handler: use `onClick={reset}`. This catch handles the import failure; add the page's own failure classes if it can fail too. `Page.preload()` can start the import before navigation and rejects with `ChunkError` on failure. SSR also needs the [client asset manifest](#ssr-and-hydration).

## Stores, optimistic lists, effects and refresh

These examples are [type-checked and run](https://github.com/devagrawal09/solid-yield/blob/main/packages/yield/test/docs/state.tsx).

### A store

`$store` holds an object. Read its paths in holes; change it through its setter in an event:

```tsx
import { $event, $store, component, view } from "solid-yield";
const Preferences = component(function* Preferences() {
  const [settings, setSettings] = yield* $store<{ theme: "light" | "dark" }>({ theme: "light" });
  const toggle = $event(function* () {
    yield* setSettings(draft => {
      draft.theme = draft.theme === "light" ? "dark" : "light";
    });
  });
  return view(function* () {
    return (
      <button class="theme" onClick={yield* toggle}>
        {yield* settings.theme}
      </button>
    );
  });
});
```

### Both effect phases

The compute tracks reads and returns a value. The effect phase receives it, runs untracked after render, and may write state or the DOM. It does not run on the server:

```tsx
import { $effect, $event, $signal, component, view } from "solid-yield";
const EffectCounter = component(function* EffectCounter() {
  const [count, setCount] = yield* $signal(0);
  const [label, setLabel] = yield* $signal("");
  yield* $effect(
    function* () {
      return yield* count;
    },
    function* (value) {
      document.title = `Count ${value}`;
      yield* setLabel(`Count ${value}`);
    }
  );
  const increment = $event(function* () {
    yield* setCount(n => n + 1);
  });
  return view(function* () {
    return (
      <button class="effect-counter" onClick={yield* increment}>
        {yield* label}
      </button>
    );
  });
});
```

An effect's failures belong to the component, not its view. A boundary must sit above that component's call; one inside its returned view cannot catch its compute or effect-phase failure. An `attempt` that absorbs the failure in the effect adds no failure to the component's type.

### An optimistic list and refresh

A derived `$optimisticStore(body, seed)` follows a source and overlays writes while an event is in flight. A successful save refreshes the server source. `refresh` is a write, so delegate to it in an event or effect phase: `yield* refresh(remote)`.

```tsx
import {
  $event, $memo, $optimisticStore, attempt, component,
  Errored, For, Loading, refresh, view
} from "solid-yield";
class NetworkError extends Error {
  readonly kind = "network" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
type Card = { id: number; column: "todo" | "done" };
type BoardApi = {
  readCards(): Promise<Card[]>;
  moveCard(id: number, column: Card["column"]): Promise<void>;
};
function boardWith(api: BoardApi) {
  return component(function* Board() {
    const remote = yield* $memo(function* () {
      return yield* attempt(
        () => api.readCards(),
        cause => new NetworkError(cause)
      );
    });
    const [cards, setCards] = yield* $optimisticStore(function* (_draft: Card[]) {
      return yield* remote;
    }, []);
    const move = $event(function* () {
      yield* setCards(draft => {
        draft[0].column = "done";
      });
      yield* attempt(
        () => api.moveCard(1, "done"),
        cause => new NetworkError(cause)
      );
      yield* refresh(remote);
    });
    return view(function* () {
      return (
        <main>
          {
            yield* Errored({
              catch: [NetworkError],
              fallback: err => <p role="alert">{err().message}</p>,
              children: function* () {
                return (
                  <>
                    {
                      yield* Loading({
                        fallback: "Loading cards…",
                        children: function* () {
                          return (
                            <section>
                              <button class="move" onClick={yield* move}>
                                Move card 1
                              </button>
                              <ul>
                                {
                                  yield* For({
                                    each: cards,
                                    children: function* (card) {
                                      return view(function* () {
                                        return <li>{yield* card.column}</li>;
                                      });
                                    }
                                  })
                                }
                              </ul>
                            </section>
                          );
                        }
                      })
                    }
                  </>
                );
              }
            })
          }
        </main>
      );
    });
  });
}
// Supply your API: const Board = boardWith(api);
```

The derived body may update its draft or return the next object/array. The seed is the initial store shape; it is not a promise that a pending read is settled. This example uses `Loading` for that wait. The move button is outside the rows under the page boundary, so moving a card keeps its binding owner alive. A handler bound in a row that its own optimistic write disposes can currently lose its failure; that case is pinned and awaits a ruling (D-085 F-8).

## Reconnecting a stream

`Errored`'s reset re-renders its children. It can retry code that creates a fresh iterator, but cannot reopen an exhausted iterator or reconnect a socket by itself. Make the memo read an attempt counter and create a fresh subscription on each attempt. Change that counter before resetting the boundary:

```tsx
import {
  $event, $memo, $signal, attempt, component, Errored, Loading, view,
  type Path, type Props, type Reset
} from "solid-yield";
class TransportError extends Error {
  readonly kind = "transport" as const;
  constructor(cause: unknown) { super(cause instanceof Error ? cause.message : String(cause)); }
}
type Message = { text: string };
// Your transport must return a fresh iterator for each call.
declare function watchRoom(id: string): AsyncIterable<Message[]>;
const Room = component(function* Room(props: Props<{ roomId: string }>) {
  const [attemptNumber, setAttempt] = yield* $signal(0);
  let current: { number: number; id: string; stream: AsyncIterable<Message[]> } | undefined;
  const messages = yield* $memo(function* () {
    const number = yield* attemptNumber;
    const id = yield* props.roomId;
    return yield* attempt(() => {
      // Reset may re-read this memo before the event's writes commit.
      // Keep one iterator per attempt, including those extra reads.
      if (!current || current.number !== number || current.id !== id) {
        current = { number, id, stream: watchRoom(id) };
      }
      return current.stream;
    }, cause => new TransportError(cause));
  });
  return view(function* () {
    return <>{yield* Errored({
      catch: [TransportError],
      fallback: function* (error: Path<TransportError>, reset: Reset) {
        const reconnect = $event(function* () {
          yield* setAttempt(n => n + 1);
          reset();
        });
        return view(function* () {
          return <section>
            <p>{yield* error.message}</p>
            <button onClick={yield* reconnect}>Reconnect</button>
          </section>;
        });
      },
      children: function* () {
        return <>{yield* Loading({
          fallback: "Connecting…",
          children: function* () {
            return <p>{(yield* messages).map(message => message.text).join("; ")}</p>;
          }
        })}</>;
      }
    })}</>;
  });
});
```

The [example test](https://github.com/devagrawal09/solid-yield/blob/main/packages/yield/test/docs/stream.spec.tsx) checks exactly one new subscription per reconnect. The [retained-iterator test](https://github.com/devagrawal09/solid-yield/blob/main/packages/yield/test/review-keyed.spec.tsx) also checks that reset alone cannot reopen an exhausted iterator. The cache prevents a reset and the event’s committed write from opening two subscriptions. A lazy import's retry and a transport reconnect are different operations.

## Recipe: an app shell

An app-wide context above a router, routed pages, a test. Install as in [Install](#install), plus the router:

```sh
pnpm add @solidjs/router@2.0.0-next.35
```

```ts
// src/theme.ts
import { createContext } from "solid-yield";

export type Theme = "light" | "dark";
/** App-wide: provided once, above the router. No default, so a reader requires it. */
export const ThemeCtx = createContext<Theme, "ThemeCtx">(undefined, { name: "ThemeCtx" });
```

```tsx
// src/pages.tsx
import type { RouteProps } from "@solidjs/router";
import { component, type Props, view } from "solid-yield";
import { ThemeCtx } from "./theme";

export const Home = component(function* Home() {
  return view(function* () {
    return <h1>Home</h1>;
  });
});

// A page that reads its URL declares its props with the router's types.
// No preload here: data is undefined, rather than an unchecked unknown prop.
export const Notes = component(function* Notes(props: Props<RouteProps<"/notes/:mode", undefined>>) {
  return view(function* () {
    return <h1>notes: {yield* props.params.mode}</h1>;
  });
});

export const Settings = component(function* Settings() {
  const theme = yield* ThemeCtx; // a requirement: Settings needs a ThemeCtx provider above it
  return view(function* () {
    return <p class="theme">theme: {yield* theme}</p>;
  });
});
```

```tsx
// src/router.tsx
import { createRouter, defineRoute } from "@solidjs/router";
import { foreign } from "solid-yield";
import { Home, Notes, Settings } from "./pages";
import { ThemeCtx } from "./theme";

// The router is plain Solid: it renders a route with no `yield*`. `foreign`
// checks each hand-off: a route may be pending (a Loading is around the
// outlet) and must handle its own failures. `provided` says which contexts
// sit above the router; the runtime checks it where the page is created.
// A page that reads params goes through `defineRoute`, which types them
// from the path; a bare `{ path, component }` object does not (TS2322).
export const Router = createRouter({
  routes: [
    { path: "/", component: foreign(Home) },
    defineRoute({ path: "/notes/:mode", component: foreign(Notes) }),
    { path: "/settings", component: foreign(Settings, { provided: [ThemeCtx] }) }
  ]
});
```

```tsx
// src/app.tsx
import { component, $event, $signal, Loading, view } from "solid-yield";
import { Router } from "./router";
import { ThemeCtx, type Theme } from "./theme";

export const App = component(function* App() {
  const [theme, setTheme] = yield* $signal<Theme>("light");
  const toggle = $event(function* () {
    yield* setTheme((yield* theme) === "light" ? "dark" : "light");
  });
  return view(function* () {
    return (
      <div data-theme={yield* theme}>
        <nav>
          <a href="/">Home</a> <a href="/notes/all">Notes</a> <a href="/settings">Settings</a>
          <button class="toggle" onClick={yield* toggle}>
            toggle theme
          </button>
        </nav>
        {
          yield* ThemeCtx.provide({
            value: theme,
            children: function* () {
              return (
                <Router>
                  {props =>
                    Loading({
                      fallback: function* () {
                        return <p>Loading…</p>;
                      },
                      children: function* () {
                        return <>{props.children}</>;
                      }
                    })
                  }
                </Router>
              );
            }
          })
        }
      </div>
    );
  });
});
```

```tsx
// src/main.tsx
import { render } from "solid-yield";
import { App } from "./app";

render(App, document.getElementById("root")!);
```

```tsx
// test/app.test.tsx — vitest with jsdom picks the client build
import { expect, it } from "vitest";
import { flush } from "solid-js";
import { render } from "solid-yield";
import { App } from "../src/app";

it("renders the routed page under the app-wide context", async () => {
  history.replaceState(null, "", "/settings");
  const root = document.createElement("div");
  document.body.appendChild(root);
  const dispose = render(App, root);
  flush();
  await new Promise(r => setTimeout(r, 0));
  flush();
  expect(root.querySelector(".theme")!.textContent).toBe("theme: light");
  root.querySelector<HTMLButtonElement>(".toggle")!.click();
  await new Promise(r => setTimeout(r, 0));
  flush();
  expect(root.querySelector(".theme")!.textContent).toBe("theme: dark");
  dispose();
});
```

- **`foreign(Page)`** is the hand-off to plain Solid: a page may pend (the `Loading` around the outlet holds it) and must handle its own failures (an `Errored` in its view); a page that may fail is refused, `[FOREIGN_HANDOFF]`, naming the failures.
- **`foreign(Page, { provided: [Ctx] })`** says which contexts are provided above the router. Without it, a page that reads `ThemeCtx` is refused, `[NO_PROVIDER] … "ThemeCtx"`: plain Solid carries no requirement from the page to the provider. Listing a context the page does not require is refused too (`[NOT_REQUIRED]`). The claim is checked where the page is created: with no provider above, `NO_PROVIDER` at run time.
- **Links** are plain `<a href>`; the router intercepts them. A route page reads its URL from its props, declared with the router's types: `component(function* Notes(props: Props<RouteProps<"/notes/:mode", undefined>>) { … })`, then `yield* props.params.mode` in a memo or a hole (as the hackernews twin's pages do). The router's hooks (`useParams`, `useLocation`) are plain Solid reactive state, which routine code does not read (`no-foreign-reactive`).
- **A route whose page reads params is registered with `defineRoute`**: `defineRoute({ path: "/notes/:mode", component: foreign(Notes) })`. `defineRoute` types the page's `params` from its `path`. A bare `{ path, component }` object types `component` as a page with no params, so a page that requires `params.mode` is refused there (`TS2322 … Type '{}' is missing the following properties … params, location, data`). A plain Solid page declared with `RouteProps<…>` is refused the same way: this is the router's rule, not `foreign`'s. Pages that read no params (`Home`, `Settings`) can stay bare objects. [`router.type-tests.tsx`](https://github.com/devagrawal09/solid-yield/blob/main/packages/yield/test/router.type-tests.tsx) pins both against the router version above.
- **A callback for the pages** (a setter, `toggle`) goes in a context too — `createContext<Handler<[Theme]>, "SetThemeCtx">(undefined, { name: "SetThemeCtx" })` — since a route component gets no props from you; list it in `provided` beside `ThemeCtx`.

## Where a refusal is reported

Each rule is checked as early as the tools allow:

1. **Types.** For example: a component tag, a read in a setup, a create or write in a view, a source called like a function, an unbound event handler, an unhandled pending at the root (`[PENDING_ROOT]`), `[SETTLED_PROP]`, `[FAILURE_KIND]`, `[HVIEW_READ]`.
2. **The transform** (at build time). A `yield*` in a JSX position it cannot make a hole: `YIELD_IN_REF`, `…_SPREAD`, `…_SPREAD_CHILD`, `PLAIN_YIELD_IN_JSX`.
3. **Development errors**, thrown where they happen and stripped from production builds. For example: `READ_IN_VIEW`, `READ_IN_SETUP`, `UNYIELDED_WRITE`, `UNTYPED_THROW`, `JSX_IN_SETUP`, `PATH_OBJECT`, `NOT_AN_OPERATION` (which names what it received).
4. **Lint** (`eslint-plugin-solid-yield`), for what TypeScript cannot see. For example: `no-read-in-setup`, `no-read-in-view-body`, `no-read-in-prop`, `component-children-generator`, `component-call-yielded`, `no-unbound-event`, `no-throw`.

[`refusals.md`](./refusals.md) puts every one of them in one place, starting with what you cannot write in a view.

## SSR and hydration

Build JSX for the server and client separately. `vite build --ssr` alone does not turn the guide's client JSX config into an SSR compiler config. Client-only `template(...)` calls in a server bundle produce Solid's "Client-only API called on the server side" error.

For the client, keep `solid({ hydratable: true })` and enable the client manifest:

```ts
// vite.config.ts: add this build option to the client config above
build: { outDir: "dist/client", manifest: true }
```

```ts
// vite.ssr.config.ts: separate server JSX config
import { defineConfig } from "vite";
import solidYield from "vite-plugin-solid-yield";
import solid from "@solidjs/vite-plugin";
export default defineConfig({
  plugins: [solidYield(), solid({ ssr: true, hydratable: true })],
  ssr: { noExternal: ["solid-yield"] },
  build: { outDir: "dist/server" }
});
```

```sh
pnpm exec vite build
pnpm exec vite build --ssr src/entry-server.tsx --config vite.ssr.config.ts
```

**Root rule:** all four renderers take a root whose pending reads have a `Loading` above them and whose required contexts are provided. A root may fail: an unhandled failure is re-thrown there. If the app can pend, share the same root wrapper between both entries:

```ts
// root.ts
import { Loading } from "solid-yield";
import { App } from "./app";
export const Root = () => Loading({ children: App });
```

### Server script, manifest and render functions

`generateHydrationScript()` must come from **the server build** of `@solidjs/web` and run before the client entry. The client build returns `""`; development `hydrate` then reports `[NO_HYDRATION_SCRIPT]`. Do not manufacture `_$HY` in production.

The Vite client manifest names each lazy page's client chunk, CSS and imports. Pass that parsed manifest to both server render functions. For example, an entry can look like `{ "src/pages/page.tsx": { file: "assets/page-abc.js" } }`; its key must match the `moduleUrl` the yield plugin annotated. The actual manifest, not that illustrative filename, must come from the matching client build.

Without a manifest, a server call to an annotated lazy page throws; if SSR contains the error, the page can be blank. A manifest missing that module emits no preload entry. Hydration then reports `[LAZY_HYDRATION_PRELOAD]`. When the manifest is correct, Solid serializes the module mapping and `hydrate` loads those client entries before rendering the lazy page. Serve the real files at those URLs; a failed preload is not a successful hydration. Use the same app tree, wrappers and URL on both sides.

```ts
// entry-server.ts: built by vite.ssr.config.ts
import { readFileSync } from "node:fs";
import { generateHydrationScript } from "@solidjs/web";
import { renderToString, renderToStream } from "solid-yield";
import { Root } from "./root";
const manifest = JSON.parse(readFileSync("dist/client/.vite/manifest.json", "utf8"));

// Synchronous: pending content shows its Loading fallback.
const syncBody = renderToString(Root, { manifest });

// Complete streamed body, including the scripts that swap pending fragments.
let body = "";
const decoder = new TextDecoder();
await renderToStream(Root, { manifest }).pipeTo(new WritableStream({
  write(chunk) {
    body += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
  },
  close() { body += decoder.decode(); }
}));

// With Vite's default index.html entry; use your manifest's actual entry key.
const entry = manifest["index.html"].file;
const html = `<!doctype html><html><head>${generateHydrationScript()}</head><body>` +
  `<div id="app">${body}</div><script type="module" src="/${entry}"></script></body></html>`;
// Send html from your server. Use syncBody instead for a synchronous response.
```

Await `pipeTo`; `onCompleteAll` alone can fire before the last bytes reach the writable. Synchronous `renderToString` does not await lazy imports or async data; use streaming when you need their content. A live stream that never ends also never completes this collected-body example: pipe it to the response rather than collecting it.

```ts
// entry-client.ts: built by the client config
import { hydrate } from "solid-yield";
import { Root } from "./root";
hydrate(Root, document.getElementById("app")!);
```

### Vitest hydration recipe

The Solid plugin deliberately forces non-hydratable JSX in Vitest's **test mode**. Use a separate config and run it in a non-test mode. `ssr: true` enables the SSR compiler when Vite's SSR loader compiles the server fixture; the jsdom test still gets hydratable client JSX.

```ts
// vitest.hydrate.config.ts
import { defineConfig } from "vitest/config";
import solidYield from "vite-plugin-solid-yield";
import solid from "@solidjs/vite-plugin";
export default defineConfig({
  plugins: [solidYield(), solid({ ssr: true, hydratable: true })],
  resolve: { conditions: ["browser", "development"] },
  test: {
    environment: "jsdom",
    server: { deps: { inline: [/solid/] } },
    include: ["test-hydrate/**/*.test.tsx"],
    globalSetup: ["test-hydrate/ssr-setup.ts"]
  }
});
```

```sh
pnpm exec vitest run --config vitest.hydrate.config.ts --mode hydrate
```

In global setup, use `createServer` from Vite with `configFile: "vite.ssr.config.ts"`, `mode: "hydrate"`, `appType: "custom"`, and `server: { middlewareMode: true, hmr: false, ws: false }`. The last options avoid a WebSocket listener in a restricted test environment. Load `solid-yield`, `@solidjs/web` and your root with `vite.ssrLoadModule`. Render on that server side, collect streams with **awaited** `pipeTo`, prepend its `generateHydrationScript()`, provide the HTML to the test, and close Vite in `finally`.

In jsdom, `innerHTML` does not execute scripts. For your own server fixture, execute its inline scripts in document order before hydrating:

```tsx
// Use inject() for the server HTML supplied by your Vitest global setup.
document.body.innerHTML = serverHtml;
for (const script of [...document.body.querySelectorAll("script")]) {
  (0, eval)(script.textContent!);
  script.remove();
}
const root = document.getElementById("app")!;
const before = root.querySelector("button")!;
const dispose = hydrate(Root, root);
flush();
await Promise.resolve();
expect(root.querySelector("button")).toBe(before);
before.click();
flush();
expect(before.textContent).toBe("1");
dispose();
```

Start with a non-lazy counter fixture, then add streaming and lazy pages. Node cannot natively import an HTTP chunk URL during a jsdom test. A test for one known lazy page may pre-seed `_$HY.modules[id]` with its real imported module, using the IDs from the server's `_$HY.r._assets` mapping, before `hydrate`; that is a test harness, not a browser preload check. Keep the real manifest and verify server node identity and interaction. For router tests, stub `window.scrollTo` (for example, `vi.spyOn(window, "scrollTo").mockImplementation(() => {})`).

The [complete repository fixture](https://github.com/devagrawal09/solid-yield/blob/main/packages/yield/test/docs/hydration/global-setup.mjs) renders a counter to a string and through `pipeTo`; [its client test](https://github.com/devagrawal09/solid-yield/blob/main/packages/yield/test/docs/hydration/hydrate.test.tsx) keeps the server button and clicks it. In this workspace run `pnpm -C packages/yield exec vitest run --config vite.config.docs-hydrate.mjs --mode hydrate` after `pnpm build`. The consumer config above imports the installed plugins; the repository configs use source aliases.
