# Room — `solid-blocks` twin (JSX flavor)

[`examples/room`](../room)'s `/live` page — live server functions, SSR with the router — written with `solid-blocks`. The original's `/` page, one live server component, is not part of the twin: the blocks model has no server components (D-058), so the twin serves `/live` at both `/` and `/live`. The wire is the original's, verbatim: `src/lib/sources.ts`, `src/lib/rooms.ts`, `src/server-config.ts`, `server.js`, the chaos plugin in `vite.config.ts`. Every component is a block, the document shell `start` renders into (`src/Document.tsx`) included.

```bash
pnpm test         # behavior (4) + parity against examples/room (1): DOM + draft after 13 steps on /live
pnpm typecheck && pnpm lint && pnpm build
node ../../scripts/example-blocks/browser.mjs room    # after building both (production servers)
```

## What the library's rules change

- **Components are `$component`s** with named setups (`$component(function* Card(props) {…})`, so dev owner labels read `<Live> › <Card>`). Handlers are `$event`s; the transport's `onstatus` hook reports through one (`createWire`).
- **The router is created in `App`'s setup** and the view returns it. `routes.ts` hands each route to the router as `foreign(Live)` (D-088): the router is plain Solid and renders a route with no `yield*`, so a route may be pending (the app's `<Loading>` is above it) and handles its own failures.
- **What a `<Loading>` covers is its own component**, handed to the boundary as a view: `<Loading>{Members({ who, me })}</Loading>`, or in the call form `Loading({ fallback, children: () => Members({ who, me }) })` — the content is a function so it is built inside the boundary.
- **Failures are typed.** A memo over a stream or a promise may fail with anything, so every panel that reads a live source may fail. The original lets that reach the app root; here `/live`'s page is wrapped in an `Errored` at its root, which `foreign(Live)` requires (a route handed to the router handles its own failures, D-088), and the summary keeps its own `Errored`. A directory row's count failure passes up the list to the page's `Errored` (a row need not be settled, D-059 / D-063); the per-row `Errored`s the twin had before are gone. With no failure, the markup is the original's.
- **A prop given pending or failing data says so** (D-068): `who: Source<Presence, LiveError, true>`. The components that only forward a live source (`Transcript`, `CardBody`'s `members` / `activity`) take its color from their caller with type parameters (D-029), as do the components they forward it to.
- **`live`'s call type is the answer itself** (`RoomCard & { onstatus }`), not a stream of it: the card memo routes it through `attempt(…, cause => new LiveError(cause))`, as presence does, and is widened to `Source<RoomCard, LiveError, boolean>` (an upcast, not a cast).
- **A row is settled**: the card's ticks read the (pending) activity once, into one flag per tick, and the rows read their flag.
- **Posting on `/live` is Solid's**: `createOptimisticStore`, `createOptimistic`, `action` + `until` are used as they are (the library has no optimistic forms); blocks read the store through `paths<…, true>` and the flag through `read`. The composer shows `latestOf(text)`.
- **Identity outside the provider is "nobody"** (the original throws; a setup does not fail).

No `any`, no casts.

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
