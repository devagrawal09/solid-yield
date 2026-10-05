---
"solid-blocks": minor
"eslint-plugin-solid-blocks": minor
---

`try` / `catch` is not a block form (D-077). `attempt` takes an event call: `yield* attempt(() => post(msg), e => { … })` is `yield* post(msg)` with the call's failure handled — the handler receives the call's known failure and returns it, a transformation of it, or nothing to absorb it (D-076); the call's other colors are the block's as with `yield*`, so an `$effect` may attempt a synchronous call. `until`'s handler follows D-076 too: it returns the failure, or nothing (`until` then gives `undefined`). `eslint-plugin-solid-blocks`: new `no-try-catch`, an error in `recommended`: a `try` / `catch` in a block body (setup, view, hole, row, `$memo`, `$effect`, `$event`, `$settled`), whose caught failure would stay in the block's type, points to `attempt` or `Errored`.
