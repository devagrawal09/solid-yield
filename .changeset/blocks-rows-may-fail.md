---
"solid-blocks": minor
---

A row need not be settled for failures (D-059). A `<For>`, `Repeat`, `Show` or `Match` row whose view may fail is no longer the type error `[UNSETTLED_ROW] … may fail`. The flow control's row overloads now return `View<false, RowFails<VY, R>>`, a view that fails with whatever its rows fail with. Written as `{yield* For({ each, children: row })}`, the failures join the view that holds the list, and an `Errored` above it takes them. As a tag (`<For>`), the list is an element only when settled, because a JSX tag's type cannot carry colors. At run time a row's `raise` already reached the nearest `Errored` above the list, or was re-thrown at the root with none (D-033); now the types say so. A pending row is still `[UNSETTLED_ROW] … may be pending`. New exported type: `RowFails`.
