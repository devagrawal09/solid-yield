---
"solid-blocks": minor
---

An `$event` does not attempt a stream, and a stream attempt's handler is a plain function (D-091). A stream keeps arriving, so it is consumed in a reactive block: `return yield* attempt(() => watch(feed), cause => new FeedError(cause))` in a `$memo` or a `$projection`. An attempt over a stream (or a promise of one) now yields a `StreamAttempt` op, which is not an `EventOp`: in an `$event` it is a type error, `[STREAM_IN_EVENT] a stream is consumed in a reactive block: $memo or $projection`, and in development the call rejects with `STREAM_IN_EVENT`. A stream's failures arrive after the host's run, so its handler returns an `Error` (the stream fails) or nothing (the stream ends); a generator handler, or one returning a value, is `[STREAM_HANDLER]`, and a generator handler fails the stream with `STREAM_HANDLER` at run time (it used to be driven synchronously, outside the host's run). Generator handlers stay for promise and synchronous attempts.
