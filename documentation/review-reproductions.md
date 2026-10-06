# First-time reviews: reproduction notes (2026-10-07)

Reference apps and logs are read-only: `/private/tmp/sy-review-3` (kanban) and `/private/tmp/sy-review-4` (chat). These notes concern main at `bd3716b`, Solid rc.13, and TypeScript 6.0.3.

## Chat: `any` at the router handoff (A2)

**Not reproduced from the saved app.** A TypeScript checker loaded the chat app's own tsconfig and published declarations, with only the outer catch-all `Errored` removed in memory. It reported no errors. The stages were:

- stream memo: `Source<Message[], TransportError, true>`;
- room page, after `catch: [TransportError, PostError]`: failure `never`;
- lazy room call: failure `ChunkError`;
- route, after `catch: [ChunkError]`: failure `never`.

The same shape is pinned against this checkout in `packages/yield/test/review-failure.type-tests.tsx`: a streamed memo, row fallback, lazy page, typed catches and a context provided above `foreign`. It checks both exact failures and the absence of `any`. It needs no catch-all boundary. No type was changed to hide or discard a failure. The earlier intermediate source that produced `any` is not retained in the reference app, so its origin remains unconfirmed.
