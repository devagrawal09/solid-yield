# Rendering modes — `@solidjs/blocks` twin (JSX flavor)

[`examples/rendering`](../rendering) — one shared app under three render modes: client-only (`csr/`), streaming SSR (`stream/`), string SSR (`string/`) — with the shared app written in `@solidjs/blocks`. The variants' configs, entries and servers are the original's (the entries carry a `@jsxImportSource @solidjs/web` pragma, see below).

```bash
pnpm test         # behavior (8) + parity against examples/rendering (1): DOM after 29 steps (CSR)
pnpm typecheck && pnpm lint
pnpm build        # csr:build + stream:build + string:build
node ../../scripts/example-blocks/browser.mjs rendering --variant csr|stream|string   # 34 steps each
```

## What is converted

Everything in `shared/src`: the router (`RouteHOC`, `Link`, `useRouter`), `App`, every page (`Home`, `Profile` and its lazy view, `Settings`, `Stream`, `ErrorStream`, `Reveal`, `Skeleton`) and the SSR document `Shell`. Nothing is left as plain Solid components; under streaming SSR and hydration every one of them adopts the server's markup (the experiment branch's port had to keep `Shell`, `ErrorStream` and `AsyncCard` plain — none of those failures occur here).

## What the library's rules change

- **The router's location is a `$signal`** in context; `matches(name)` is a hole block (`yield* matches("profile")`); the tab's pending class is `isPendingOf(location)`; `Link` navigates with an `$event`. The location is the navigated one, else the URL a server render starts from (`props.url`, read in the location memo: a setup does not read, D-042). Outside a router the context is a detached one (the original throws; a setup does not fail).
- **Pages are `lazy()` chunks, `adopt`ed**: `adopt(lazy(() => import("./Profile")))` keeps the page's type and makes it usable in call form. A page may be pending (Profile reads its user outside its own boundary) or fail (Stream's stream may fail with anything), and nothing in the app handles that: as in the original, the root does (CSR's render defers, streaming SSR holds the response, string SSR's entry wraps the app in a `<Loading>`). So the pages are rendered in call form (`<Match when={…}>{yield* Profile()}</Match>`), which hands their pending / failures on, and `App`'s type carries them.
- **The entries are the original's, typed for `@solidjs/web`'s JSX** (a pragma): the library's `render` / `hydrate` take a settled root, and this app's root is pending by design. That is the one place the app's coloring is not enforced.
- **Async data is `$memo` + `attempt`** (Profile, ErrorStream, Reveal's cards, Skeleton's feed), so failures are declared: ErrorStream's loads declare `Error`, and its boundaries' fallbacks receive it typed. Each boundary pair is a tag around a call (`<Loading>{Errored({ fallback, children: () => Title(…) })}</Loading>`): a boundary tag hands on nothing it does not handle.
- **What a `<Loading>` covers is its own component**: Profile's facts list, Stream's two lists, Reveal's card body.
- **Stream**: the memo returns the original's async generator (as a function); the projection is Solid's, created in the setup and read through `paths` — its length stated pending, its rows settled (a row exists only for an index the store holds).
- **Skeleton**: `$memo(…, { loadingValue })` is not pending (commit #0 is the placeholder); the derived store is Solid's `createStore(fn, seed, { seedLoadingValue })`, read through `paths`; refetch dimming is `isPendingOf`.
- **Handlers are `$event`s** (Reveal's radios through a small factory, Settings' buttons and its portal click counter). `createUniqueId()` keeps the original's ids (compared unnormalized in the browser).

Casts: none. The tests cast `App` for `createComponent`.

## Library fixes this port found

- **A view that is a function is a branch's content** (`Show` / `Match` called an adopted lazy page's memo as a render callback: `PENDING_ASYNC_UNTRACKED_READ`).
- **A read from a JSX position is never a view's own**: `<Reveal>` reads its `order` prop getter untracked while a nested card's view is being built; that read turned every card into a whole-view re-render.
- **`adopt()`** and **`$memo` with a `loadingValue` is not pending** (above).
- **The package's export conditions**: jsdom test runs resolved the server build (node before browser); every twin's tests now run the client runtime.

## Tests

- The shared app, client-rendered in jsdom (the CSR variant's `render`), for this twin and the original side by side; fake timers for the ticker, the simulated fetches and the stream; lazy chunks are real dynamic imports.
- Behavior: Home's ticker, link navigation with the pending tab, Settings (input, body portal, logical clicks through the portal), Stream (memo and projection), Error Stream (errors inside and outside Loading, both resets), Reveal (ordering, restart, the collapsed switch), Skeleton (default data, fetched feed, refetch dimming), popstate.
- Parity: 29 steps through every page and interaction; the whole `<body>` (the portal included) after each.

## Browser check (Chromium, production builds, page clock paused)

34 steps per variant: every page by client navigation and by document load, Home's ticker, Profile's cascade, typing, the portal, the stream, both error boundaries and a reset, Reveal with a restart in another order, Skeleton's refetch. `csr` (static), `stream` and `string` (their servers) all pass: no console errors, page errors or hydration warnings, the same DOM after every step.

## Client bundles

| variant |  original min / gz |      twin min / gz |    gz |
| ------- | -----------------: | -----------------: | ----: |
| csr     | 100,839 / 37,845 B | 110,615 / 41,285 B | +9.1% |
| stream  | 124,310 / 46,741 B | 132,927 / 48,975 B | +4.8% |
| string  | 124,406 / 46,785 B | 133,026 / 49,044 B | +4.8% |
