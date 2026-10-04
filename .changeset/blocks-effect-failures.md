---
"solid-blocks": minor
---

An `$effect`'s or `$settled`'s failures join the enclosing component's failure type (D-073): `Create<K, E>` carries what the body may fail with, and `$component` and rows add it to their view's failures, matching where the runtime sends it (the nearest `Errored` above the component). `attempt(fn, onError)` gains an absorbing form: a handler that returns a value that is not an `Error` absorbs the failure and the attempt gives that value (a stream's absorbed failure ends the stream); a handler that may return either is the type error `[ATTEMPT_ABSORBS]`.
