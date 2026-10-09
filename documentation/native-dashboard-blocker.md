# Native dashboard: F-S37 fixed; next reasons F-S38–F-S43 (2026-10-09)

F-S36 was a type-lowering gap and is fixed: Solid `Accessor<T>` imports name the
library's `Source<T>` contract (`native:dashboard:type-contract`).

**F-S37 is fixed.** `useFilters()` reads its context during `FilterBar`'s setup
and guards it with `if (!value) throw …`. Setup admits context acquisition but
not reads or raises, so the generated helper was refused at `filters.tsx:32:17`.

Two Solid 2 facts make the read and the guard safe:

- A provider sets its value once, when it is created
  (`setContext(provider, props.value)`), and `useContext` returns that value. A
  consumer holds the same value for its whole life, so reading it in setup cannot
  miss an update.
- `useContext` itself throws when no provider (and no default) is above it, before
  the author's guard runs. That case is the context's requirement, which the
  library already carries in the component's type and refuses at a root or
  handoff that leaves it unprovided. The guard can only see a value a provider
  gave.

The lowering now gives a context value used whole (a guard, a return) as the
provided value itself, through `nativeUseContext(Ctx)`, whose only operation is
the context read (`ContextRead<Q>`, admitted in setup). The guard's throw lowers
to `nativeContextGuard(value, failure)`: its raise is typed from TypeScript's
narrowing of `value` in the guarded branch. `Filters` is an object type, so
`!value` narrows to `never` and the guard raises nothing; a context typed
`User | null` keeps the raise, and setup still refuses it. The failure inference
applies the same rule, so `useFilters` infers no failure and `FilterBar` does not
inherit the guard's `Error`. A context value read only through its members (the
prelude's destructuring, as in Todos) keeps the path form unchanged.

## Side by side

Author, `filters.tsx:26–34`:

```tsx
export function useFilters() {
  const value = useContext(FilterContext);
  if (!value) throw new Error("Dashboard filters need a provider");
  return value;
}

export function FilterBar() {
  const filters = useFilters();
  return (
```

Generated:

```tsx
export function* useFilters() {
  const value = yield* __nativeUseContext(FilterContext);
  if (!value) return yield* __nativeContextGuard(value, __nativeFailure(["global:Error"], new Error("Dashboard filters need a provider")));
  return value;
}
```

## What the dashboard reports now

Lowering emits exactly the Router notice at `app.tsx:92:9`. The generated program
then has 15 TypeScript errors in 7 groups, pinned by
`native:dashboard:structural-stop` ([evidence](../examples/harness/native-dashboard/structural-stop.json)):

| Group | Authored positions | What happens |
| --- | --- | --- |
| T08 ruling | `app.tsx:69:25` | `incident()` (pending, may fail `NotFound`) is passed into a prop typed `Incident`, inside the caller's own `Errored`/`Loading`. `SETTLED_PROP` is review slot T08's diagnostic. Correct by the current rules, or a model change: **Dev's ruling**. |
| F-S38 | `chart.tsx:50`, `incidents.tsx:50`, `panels.tsx:10`, `panels.tsx:69` | `Panel`'s `children: JSX.Element` lowers settled, but `Panel` wraps its children in its own `Errored`/`Loading`; callers' pending children are refused. |
| F-S39 | `chart.tsx:108`, `panel.tsx:12`, `panel.tsx:18` | A prop or row value used as a method receiver (`props.title.toLowerCase()`, `point.value.toFixed(0)`) is not read before the call. |
| F-S40 | `incidents.tsx:108` | `reload={() => refresh(incidents)}` is hosted by the JSX hole that creates it, not the child event that calls it, so its write is refused. |
| F-S41 | `main.tsx:3` | `render(() => <App />)` refuses an entry component whose props are all optional. |
| F-S42 | `panels.tsx:30` | `createEffect`'s effect function returns a cleanup; the library's effect phase returns nothing. |
| F-S43 | `app.tsx:78`, `app.tsx:79` | Route components require `FilterContext`. `FilterProvider` surrounds the foreign `Router`, but the requirement is not discharged across it. |

F-S38–F-S43 are compiler gaps, not author mistakes. No author patch or further
lowering change was attempted for them.

## Acceptance

- Half A: **FAIL** (compiler gaps remain).
- Half B: **FAIL / not run.** The author patch is empty; native hydrated parity,
  SSR, `AckFailed` rollback and `NotFound` comparisons have not run.
- Final panel and route colors are unavailable while the program is rejected.
