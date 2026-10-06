---
"solid-yield": minor
"eslint-plugin-solid-yield": minor
---

`$settled` is removed (D-101, calculus §6.3 F-6). Run once after mount is an `$effect` with an empty compute: `yield* $effect(function* () {}, function* () { … })`. Its effect phase runs once, after the first render, held while a `Loading` above is pending (as `onSettled` was); its reads are untracked and must be settled (a read that may be pending is a type error there), and its `$cleanup` runs on disposal. `$settled` promised "after settle", but that held only when something else waited: a pending read nothing else waited for fired it at once and re-ran its body from the start when the source landed. `EffectOp` (its op type) is removed with it. The lint's `no-foreign-reactive` now points Solid's `onSettled` to the `$effect` form; `settled` is no longer a routine kind.
