---
"solid-blocks": minor
"vite-plugin-solid-blocks": minor
"eslint-plugin-solid-blocks": minor
---

Binding an event in a view is a hole (D-072). `onClick={yield* save}` is a `Bind` op: the handler is attached un-called, and its pending read (`P`) and failures join the view's type, matching where a DOM dispatch's failure goes (the nearest `Errored` above the handler's creation site). `EventHandler` is iterable (`yield* save` gives the handler, branded `BoundEvent`); `perform` returns a handler as it is; in `h` an `$event` handler attribute carries the same colors. The transform no longer refuses a `yield*` in an event prop (`BLOCKS_YIELD_IN_EVENT` is removed). New lint rule `no-unbound-event` (autofix: `yield*`).
