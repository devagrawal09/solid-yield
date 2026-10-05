---
"solid-blocks": minor
"eslint-plugin-solid-blocks": minor
---

`$effect` is split (D-079): `$effect(compute, effect)`, Solid's `createEffect` with both halves generators. The compute tracks and is pure — reads, `raise`, a synchronous `attempt` — and returns a value; the effect phase, `function* (value, prev)`, runs after it, untracked: writes, `$cleanup`, a synchronous `attempt` or event call, and settled reads, untracked because the phase is (D-083). A write in the compute is a type error and a development error (`WRITE_IN_REACTIVE`); a read of a source that may be pending in the effect phase is a type error (the phase does not wait). Either half's failure joins the component's and reaches the nearest `Errored` (a compute failure is rethrown, not logged and skipped). The one-function form is removed. `eslint-plugin-solid-blocks`: the effect phase is a block for every rule.
