# HackerNews (SSR-SPA baseline) — `@solidjs/blocks` twin (JSX flavor)

[`examples/hackernews-spa`](../hackernews-spa) — the same app as the server-components HackerNews, but server functions return JSON and client components render everything — written with `@solidjs/blocks`. The data layer (`src/lib/hn.ts`, `src/lib/api.ts`: server functions wrapped in the router's `query`), the route tree and preloads, `server.js` and the styles are the original's (the 600KB thread capture is imported from the original, not duplicated).

```bash
pnpm test         # behavior (7) + parity against examples/hackernews-spa (1): URL + DOM after 15 steps
pnpm typecheck && pnpm lint && pnpm build
node ../../scripts/example-blocks/browser.mjs hackernews-spa                   # 13 steps
node ../../scripts/example-blocks/browser.mjs hackernews-spa --variant thread  # the 1,406-comment thread
```

## What the library's rules change

- **Every component is a `$component`**; `Toggle`'s state is a `$signal` and its handler an `$event`; props are read in holes (`{yield* props.story.title}`).
- **The routes' data are `$memo`s over the router's `query`** (`$memo(function* () { return getStory(yield* props.params.id) })`): a memo returning a promise is pending and may fail with anything. The feed's page and type are hole blocks (`$(function* () { … })`) over the location, as the original's plain functions.
- **The router is created at module scope and the app's tree in `App`'s setup**; routes pass through `route()`, which states what the router cannot see: a route may be pending (the app's `<Loading>` is above it) and its failures reach the app root, as the original's do.
- **`Comment` is recursive**: its type is stated (`Component<{ comment }, false, never>`) and its setup unnamed.
- **Row blocks**: the feeds' and threads' rows hold no state (a `Story` / `Comment` per row, rendered with the row's item path); the per-thread state is `Toggle`'s own.

Casts: none in block code. `src/lib/hn.ts` (`cachedStory as unknown as StoryDefinition`) and `storyType` (`as StoryTypes`) are the original's, verbatim. The tests cast `nextElementSibling` to `HTMLElement` and `App` for `createComponent`.

## Tests

- The apps run client-only in jsdom (development runtime), `fetch` answering the HN API from `tests/fixtures/hn-data.mjs`; `~/lib/hn` is an ordinary module there.
- Behavior: the top feed and row shapes (link / ask / job, url / no url, comments / discuss), paging to the last page and back, feed switching, a story page and its comment tree with collapse / expand, comment author and user pages (with and without an about), the 1,406-comment capture.
- Parity: 15 steps through every route and toggle; the URL and the DOM (hydration markers normalized) after each.

## Browser check (Chromium, production servers)

Both servers are started with `tests/fixtures/hn-fetch.mjs` (`node --import`: the HN API from the fixtures). 13 steps (SSR of `/`, paging, every feed, a story with collapse / expand, a user, SSR of a user with an about and of `/show?page=2`, back to top) and the `thread` variant (SSR of the capture in a fresh page, collapse, expand, its author). No console errors, page errors or hydration warnings; the same DOM after every step.

**Found (not the twin's):** loaded after another page of the same origin, the capture's document fails to hydrate — `TypeError: Cannot read properties of null (reading 'nextSibling')` in `Comment` / `Toggle` — in the original as in the twin, every time (4/4 in a standalone reproduction; 0/6 as a first visit). The client entry is an `async` module script; with the entry already loaded it runs while the 600KB document is still being parsed. That is why the capture has its own variant, loaded first in a fresh page.

## Client bundle

|          |       min |               gz |
| -------- | --------: | ---------------: |
| original | 229,025 B |         80,855 B |
| twin     | 236,668 B | 83,457 B (+3.2%) |
