---
"solid-blocks": patch
---

A hole that always raises now carries its failure in its type. A zero-arity `function*` hole whose every path raises (`Show({ when: function* () { return yield* raise(new NotFound()); } })`) returns `never`, and the type that collects a hole's colors distributed over that `never`, dropping the hole's own `Raise`. The flow control's output, or an `h` view holding the hole, typed as never failing. A hole that raises only on some paths was not affected. Found by the raise tests (`test/raise.spec.tsx`, `test/raise.type-tests.tsx`; D-070).
