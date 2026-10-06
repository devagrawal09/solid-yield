# First-time reviews: reproduction notes (2026-10-07)

Reference apps and logs are read-only: `/private/tmp/sy-review-3` (kanban) and `/private/tmp/sy-review-4` (chat). These notes concern main at `bd3716b`, Solid rc.13, and TypeScript 6.0.3.

## Hydration bootstrap (A1)

**Reproduced; setup error.** The chat's one-element fixture fails in Solid's `hydrate` when `globalThis._$HY` is absent. `generateHydrationScript()` from the client build returns an empty string. The server build returns the bootstrap script; installing that script before the client calls `hydrate` fixes the fixture. Development now reports `[NO_HYDRATION_SCRIPT]` with that recipe instead of the undefined `done` TypeError. Production retains Solid's original error.

`packages/yield/test/hydration-script.spec.ts` pins both the missing-script error and successful hydration with the real server script. The guide's separate SSR build and non-test-mode Vitest recipe also have a two-case test that preserves the server button and makes it interactive, for string and streamed output.

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

## Kanban: optimistic move loses the event failure (A4 / N2)

**Reproduced; resolved by D-109.** `packages/yield/test/review-disposed.spec.tsx` pins three cases in both builds: without the move, the row fallback handles the failure; after the move disposes that boundary, the call rejects with the original failure and development reports `[BOUNDARY_DISPOSED]`; a boundary placed above the disposable row handles it. No live ancestor is selected after the accepting captured boundary dies. Keyed re-delivery to the re-created row is a v0.3 target.

## Additional type finding

`Promise.reject()` has type `Promise<never>`. The stream check mistakenly classified its awaited `never` as an async iterable, so a rejecting `$event` was refused as a stream. The check now treats an awaited `never` as a promise, with the exact `TransportError` failure pinned in `test/rejected-promise.type-tests.ts`. This is a reproduced library type bug; it does not account for the chat's unconfirmed `any`.

The documented reconnect example was tested as written. A fresh iterator on every memo run opened two subscriptions during reconnect: reset re-read the old attempt before the event's write committed. Keeping one iterator per attempt avoids that extra subscription; `test/docs/stream.spec.tsx` pins one fresh subscription, iterator cleanup, and no reactivity halt.
