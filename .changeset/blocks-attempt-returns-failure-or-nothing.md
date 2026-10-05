---
"solid-blocks": minor
---

`attempt`'s handler returns the failure or nothing (D-076). `onError` returns an `Error` with a literal `kind` (the failure, possibly transformed), which the block fails with, or nothing, which absorbs the failure: the attempt gives `undefined` and its value is `T | undefined` (use `??` for a fallback). A handler returning any other value is a type error, and one returning the failure on one path and nothing on another is `[ATTEMPT_ABSORBS]`. This replaces the absorbing form of D-073, where a non-`Error` return value was the attempt's value. A stream's absorbed failure still ends the stream.
