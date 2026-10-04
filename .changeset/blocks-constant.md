---
"@solidjs/blocks": minor
---

New `constant(value)`: a `Source<T, false, never>` that always reads `value`, so it is settled, never fails and never changes (D-060). It is usable anywhere, module level included, because a constant needs no owner. Its use case is the default of a context whose provided values are sources: `createContext(constant<Identity | null>(null))`. `createContext` itself is unchanged and keeps a plain default for a context of plain values. The library cannot tell the two kinds of context apart from the call, so the writer states it with `constant`. The room and rendering twins drop their interim workaround, a default of `undefined` plus a `$memo` created in each asking setup: room's identity context now defaults to `constant(null)`, and rendering's detached router has a `constant("index")` location.
