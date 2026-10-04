---
"solid-blocks": minor
"eslint-plugin-solid-blocks": patch
---

`start()` and `context()` are removed from `solid-blocks` (D-035, D-036). `yield* start(save(x))` ran an event call without waiting and without taking its colors. It existed only so an `$effect`, which cannot wait, could trigger an async event, and no twin used it. An effect now delegates only to a synchronous event; work that must wait is an event calling an event, or a `$memo`. `context(Ctx)` read a context this library did not create, and no twin used it either. `yield* Ctx` on a context made with the library's `createContext` is the one way to read a context; a foreign context is wrapped once in a library context. `eslint-plugin-solid-blocks`: `no-unyielded-write` loses its `start` special case and its message no longer suggests `start`.
