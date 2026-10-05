---
"solid-blocks": minor
"eslint-plugin-solid-blocks": patch
---

`$untrack` is removed (D-083): tracking is a property of the host, not of the read. Memos, holes and an `$effect`'s compute subscribe; an `$event` and an `$effect`'s effect phase do not, so a plain `yield* source` there is untracked, and the library adds no untrack of its own. The effect phase admits a settled read (`Read<false>` is an `EffectPhaseOp`; the development error `READ_IN_EFFECT` is gone). The `UntrackedRead` op type and the `UNTRACK_IN_SETUP` development error are gone. No twin used `$untrack`. `eslint-plugin-solid-blocks`: `no-foreign-reactive` points Solid's `untrack` to a plain read in an `$event` or an effect phase; `read-before-attempt` no longer exempts `$untrack`.
