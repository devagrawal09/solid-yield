# Native dashboard: both acceptance halves pass (2026-10-10)

The operations dashboard (`examples/originals/dashboard`) is plain Solid 2 with
no solid-yield imports. In native mode it now lowers, type-checks and runs as
the original does. The author patch is empty.

- **Half A: PASS.** Lowering reports exactly the Router boundary notice at
  `app.tsx:92:9`. The generated program has no errors.
  `native:dashboard:diagnostics` checks this, and
  [the evidence](../examples/harness/native-dashboard/half-a.json) records it.
- **Half B: PASS.** `examples/harness/native-dashboard/check.mjs` runs the
  unchanged original against its native lowering, in three gate steps:
  - `native:dashboard:parity`: the shared 30-step client script, with
    independent content checks. It covers range and team changes, sorting, the
    optimistic acknowledgement and its `AckFailed` rollback, the metric switch,
    notes and storage, the refresh tick, detail navigation and the `NotFound`
    route boundary. All 30 states match.
  - `native:dashboard:ssr`: the streamed server render of `/overview`,
    `/incidents/inc-101` and `/incidents/missing`. The resolved documents match.
    Both streams serialize the public `NotFound`. Native mode carries it inside
    its `NativeFailure` wrapper, by design.
  - `native:dashboard:hydrate`: `/overview` and `/incidents/missing`. Server
    nodes are retained. A notes edit after hydration, and the hydrated not-found
    boundary, match the original.

The comparisons ignore owner-tree ids: hydration keys and streaming placeholder
ids. The library's owners make these differ; the markup must not.

## Final checked colors

These are read from the accepted program (`finalCheckedColors` in the
evidence). Each panel and each route is settled: it handles its own pending
data and failures through `Panel`'s `Errored`/`Loading`, or through the route's
own. Each requires only `FilterContext`, which `FilterProvider` gives above the
foreign router (F-S43).

| Component                                                                  | Pending | Fails   | Requires        |
| -------------------------------------------------------------------------- | ------- | ------- | --------------- |
| `SummaryPanel`, `SeriesPanel`, `IncidentsPanel`, `TeamPanel`, `NotesPanel` | `false` | `never` | `FilterContext` |
| `Overview` (`/`, `/overview`)                                              | `false` | `never` | `FilterContext` |
| `IncidentDetail` (`/incidents/:id`)                                        | `false` | `never` | `FilterContext` |

## What it took

Compiler gaps, each found as a TypeScript error in the generated program:

| Finding | What changed                                                                                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-S36   | Solid `Accessor<T>` annotations name the library's `Source<T>`.                                                                                                                                                                                      |
| F-S37   | `useContext` held in setup (`nativeUseContext`); its guard raises only what the context's type admits (`nativeContextGuard`).                                                                                                                        |
| D-119   | A plain-typed prop takes the colors its callers pass (T08, F-S38).                                                                                                                                                                                   |
| F-S39   | A member a source lacks reads the source first (`props.title.toLowerCase()`). An `Errored` fallback keeps Solid's `(error, reset)` types.                                                                                                            |
| F-S40   | A callback prop that writes is hosted by the event that calls it.                                                                                                                                                                                    |
| F-S41   | Only a component that places `props.children` under a provider is a provider wrapper.                                                                                                                                                                |
| F-S42   | An effect function's returned cleanup registers through `onCleanup`.                                                                                                                                                                                 |
| F-S43   | A foreign router rendered only under providers hands its route components those contexts (`nativeForeignProvided`). The route handoff is typed as the plain call (`nativeForeign`), so a page that declares no props takes the router's route props. |
| F-S45   | A call through a context value's member calls what every provider put there. `setRange` is a signal setter, so it fails nothing. A context's provider tag, `HydrationScript` and `markSafeError` fail nothing either.                                |

Runtime gaps, found by half B once the program type-checked:

| Gap                   | What changed                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Provider children     | `<FilterContext value={…}>{props.children}</FilterContext>`: an expression child of a lowered component or provider now reads in a hole of its lazy view (`<>{yield* props.children}</>`). A view has no body (`READ_IN_VIEW`).                                                                                                                                                                              |
| Plain setter types    | `Filters.setRange: (range: Range) => void` holds a library setter. A library setter writes when its receipt is delegated to, while the author's setter wrote when called. Where a setter meets a plain function type (an object property or a call argument), the lowering adapts it with `nativeWrite`, which writes when called. The runtime still checks where the write runs (`UNYIELDED_WRITE` before). |
| Event-phase callbacks | F-S40's `reload={() => refresh(incidents)}` is created in a view but called from the row's action. An event-phase lexical callback now runs in the event that calls it, not the host that created it (`WRITE_IN_REACTIVE` before).                                                                                                                                                                           |

## Side by side (F-S37)

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
  if (!value)
    return yield* __nativeContextGuard(
      value,
      __nativeFailure(["global:Error"], new Error("Dashboard filters need a provider"))
    );
  return value;
}
```
