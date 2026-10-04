---
"solid-blocks": minor
---

Pending rows now propagate the same way failing rows do (D-063, extending D-059). `[UNSETTLED_ROW]` is removed: a `<For>`, `Repeat`, `Show` or `Match` row whose view may be pending is accepted. The row overloads return `View<RowPending<VY, R>, RowFails<VY, R>>`, so `{yield* For({ each, children: row })}` carries the rows' pending and failures into the holding view, and the nearest `Loading` / `Errored` above the list takes them. As a tag, the list is an element only when settled. New exported type: `RowPending`.
