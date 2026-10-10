# Native edge example

A small plain Solid app (`app/`) that exercises the native lowering's edges at
run time. The mutation corpus's `sugar-edges` seed checks the same constructs
statically.

| Construct                                                                           | Where                       | What the run shows                                           |
| ----------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------ |
| Context hook with its guard (F-S37), and a guard inline in a component              | `filters.tsx`, `Status.tsx` | The provided value is held; neither guard fires              |
| Setter in a plain function type (`setRange`, written through `nativeWrite`)         | `FilterBar`                 | Choosing a range reloads the rows                            |
| Wrapper with its own `Errored` and `Loading` around a context reader (D-119, F-S49) | `Panel`, `Rows`             | Loading, then rows; an unknown range shows the panel's error |
| Array callback in a memo (F-S46)                                                    | `Rows`' `shown`             | Raising the minimum filters the list                         |
| Callback prop that writes, called from the child's event (F-S40)                    | `Row`'s `reload`            | `refresh(rows)` refetches                                    |
| Effect with a returned cleanup (F-S42)                                              | `Clock`                     | The clock ticks; disposal leaves no timer                    |
| Anonymous default component (F-S48)                                                 | `Badge.tsx`                 | Renders as `Badge`                                           |

The gate has three steps for it:

- `native:edges:typecheck`: the app type-checks as plain Solid.
- `native:edges:diagnostics`: `solid-yield check --native` accepts it, with
  no errors.
- `native:edges:parity` (`check.mjs`): runs the original and its native
  lowering through the same nine scripted steps in jsdom, with fake timers.
  The snapshots must match at every step, and both must hold no timer after
  disposal.

Removing `Panel`'s `Errored` makes the check report `FOREIGN_HANDOFF … Missing`
at the root. Removing `FilterProvider` makes it report `NO_PROVIDER …
FilterContext`.
