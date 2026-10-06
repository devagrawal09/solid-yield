# First-time reviews: reproduction notes (2026-10-07)

Reference apps and logs are read-only: `/private/tmp/sy-review-3` (kanban) and `/private/tmp/sy-review-4` (chat). These notes concern main at `bd3716b`, Solid rc.13, and TypeScript 6.0.3.

## Chat: `any` at the router handoff (A2)

**Not reproduced from the saved app.** A TypeScript checker loaded the chat app's own tsconfig and published declarations, with only the outer catch-all `Errored` removed in memory. It reported no errors. The stages were:

- stream memo: `Source<Message[], TransportError, true>`;
- room page, after `catch: [TransportError, PostError]`: failure `never`;
- lazy room call: failure `ChunkError`;
- route, after `catch: [ChunkError]`: failure `never`.

The same shape is pinned against this checkout in `packages/yield/test/review-failure.type-tests.tsx`: a streamed memo, row fallback, lazy page, typed catches and a context provided above `foreign`. It checks both exact failures and the absence of `any`. It needs no catch-all boundary. No type was changed to hide or discard a failure. The earlier intermediate source that produced `any` is not retained in the reference app, so its origin remains unconfirmed.

## Chat: keyed remount and `insertBefore` (A3)

**Not reproduced.** The saved app removed the keyed experiment, so its exact tree is unavailable. `packages/yield/test/review-keyed.spec.tsx` now pins a keyed `Show` around a failed stream's `Errored`/`Loading`, with a new subscription on remount and no halt. The same tree written in plain Solid also passes. A second probe with `Errored` outside the keyed `Show` and a reset after changing the key also produced no halt (it made three subscriptions: the existing memo saw the changed prop before the remount).

There is no evidence here to assign the reported `insertBefore` error to the library or Solid, and no failing upstream repro was invented. The report remains open pending the removed tree.

The retained-iterator test also pins a reconnect pattern: a memo reads an attempt counter and creates a fresh iterator when it changes; the button changes the counter and resets the boundary. `reset` re-renders children, but cannot reopen an exhausted iterator. With a factory that creates a fresh iterator on each memo run, reset alone did retry in the tested shape; it is not a universal promise about a network subscription.
