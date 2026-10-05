---
"solid-blocks": patch
---

`Loading`'s `on` carries its colors (D-071). In the call form `on` is typed `O` and its failures join `Loading`'s output; its pending stays the boundary's own (Solid reads `on` beside the boundary and drops its pending: a runtime test pins it). `h(Loading, { fallback, on }, …)` now types like the call form: the fallback's pending and failures and `on`'s failures pass on, where they were dropped.
