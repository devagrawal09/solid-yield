# Room — `solid-blocks` twin (JSX flavor)

[`examples/originals/room`](../originals/room)'s `/live` page — live server functions, SSR with the router — written with `solid-blocks`. The original's `/` page, one live server component, is not part of the twin: the blocks model has no server components (D-058), so the twin serves `/live` at both `/` and `/live`. The wire is the original's, verbatim: `src/lib/sources.ts`, `src/lib/rooms.ts`, `src/server-config.ts`, `server.js`, the chaos plugin in `vite.config.ts`. Every component is a block, the document shell `start` renders into (`src/Document.tsx`) included.

```bash
pnpm test         # behavior (4) + parity against examples/originals/room (1): DOM + draft after 13 steps on /live
pnpm typecheck && pnpm lint && pnpm build
```

The Chromium check (`tests/browser.steps.mjs`) ran from the Solid fork's `scripts/example-blocks/browser.mjs`, which was not carried here (HANDOFF).

## What the library's rules change

- **Components are `$component`s** with named setups (`$component(function* Card(props) {…})`, so dev owner labels read `<Live> › <Card>`). Handlers are `$event`s; the transport's `onstatus` hook reports through one (`createWire`).
- **The router is created at module level** (`createRouter({ routes })` in `app.tsx`) and `App`'s view renders it. `routes.ts` hands each route to the router as `foreign(Live)` (D-088): the router is plain Solid and renders a route with no `yield*`, so a route may be pending (the app's `<Loading>` is above it) and handles its own failures.
- **What a `Loading` covers is its own component**, in the call form with a lazy view: `yield* Loading({ fallback, children: function* () { return <>{yield* Members({ who, me })}</>; } })` — the content is built inside the boundary (D-062, D-066).
- **Failures are typed.** A memo over a stream or a promise may fail with anything, so every panel that reads a live source may fail. The original lets that reach the app root; here `/live`'s page is wrapped in an `Errored` at its root, which `foreign(Live)` requires (a route handed to the router handles its own failures, D-088), and the summary keeps its own `Errored`. A directory row's count failure passes up the list to the page's `Errored` (a row need not be settled, D-059 / D-063); the per-row `Errored`s the twin had before are gone. With no failure, the markup is the original's.
- **A prop given pending or failing data says so** (D-068): `who: Source<Presence, LiveError, true>`. The components that only forward a live source (`Transcript`, `CardBody`'s `members` / `activity`) take its color from their caller with type parameters (D-029), as do the components they forward it to.
- **`live`'s call type is the answer itself** (`RoomCard & { onstatus }`), not a stream of it: the card memo routes it through `attempt(…, cause => new LiveError(cause))`, as presence does, and is widened to `Source<RoomCard, LiveError, boolean>` (an upcast, not a cast).
- **The card's ticks read the (pending) activity once**, in one memo, into one flag per tick, and the rows read their flag. A row may be pending or fail (D-059 / D-063): the memo is the original's one derivation, not a settled-row requirement.
- **Posting on `/live`** uses the library's forms of Solid's: the transcript is an `$optimisticStore` over the room's stream, the sending flag an `$optimistic`, and posting an `$event` (a Solid action) that writes the row optimistically and waits with `until`. The composer shows `latestOf(text)`.
- **Identity outside the provider is "nobody"** (the original throws; a setup does not fail).

No `any`. One type assertion: the transcript's seed, `{ messages: [] } as { messages: Row[] }` (`live.tsx`), which widens an empty array.

## Tests

- `tests/fake-server-functions.ts` stands in for `@solidjs/web/server-functions` (aliased in `vitest.config.ts` for both apps): the `"use server"` bodies run in process against the in-memory rooms, `live` re-invokes on a death and reports `onstatus`, an undeclared stream (`GET` over an async generator) dies with an error. `fetch("/__chaos/drop")` is stubbed to kill every open call.
- The parity script drives `/live` (both apps mounted there): its shell sources, the card's nested promise and stream, an optimistic post held for its echo, the summary dying under chaos and regenerating, the archive's room-keyed boundary. `Math.random` is seeded and time is fake, so both apps mint the same identity and ids.

## Browser check (Chromium, production servers)

`/live` is compared as streamed: over the production harness (HTTP/1.1, six connections per origin) its seven live sources do not connect in headless Chromium — the original's as well as the twin's. The chaos switch is the dev server's; the production harness answers the POST with the app's document. Normalized: the tab's random identity, clock times, connection counters, besides hydration keys and markers.

## Client bundle

| | min | gz |
| --- | ---: | ---: |
| original | 322,023 B | 111,464 B |
| twin | 332,570 B | 114,598 B (+2.8%) |

Measured in the Solid fork with `scripts/example-blocks/bytes.mjs` (not carried here, so not reproducible from this repository); `documentation/blocks-library.md` §9 has a later figure (+0.2%).
