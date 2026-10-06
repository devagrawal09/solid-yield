---
"solid-yield": patch
---

`Ctx.provide`'s `value` (and `h(Ctx.provide, { value })`) refuses `undefined`, with `[PROVIDE_UNDEFINED] a provided undefined reads as no provider: provide null, or a source`. Solid reads a provided `undefined` as unset, so a reader below found no provider while the types said the requirement was discharged (calculus §6.3 F-3). A context that may carry nothing models it inside the value: `null`, or a source of `T | null`.
