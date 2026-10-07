# solid-yield first-time review — reviewer 3 (log)

Start 00:22 IST 2026-10-07, end ~00:42 (system clock; tool time is fast, a human would need ~2-3 h).
Docs read: README.md, getting-started.md, refusals.md, 3 package READMEs. Previous logs read only at the very end.
Env: node 24.18, pnpm 11.20, vite 8.3.2, vitest 5.0.3, TS 6.0.3, eslint 10.12, @typescript-eslint/parser 8.71.1, @solidjs/vite-plugin 3.0.0-next.47, @solidjs/router 2.0.0-next.35, solid-js/@solidjs/web 2.0.0-rc.13, jsdom 30.1.2.

## .d.ts / package files I opened (each time because the docs lacked the answer)
1. `solid-yield/dist/types/index.d.ts` — to see what is exported (docs list no export table).
2. `lazy.d.ts` — `lazy`, `ChunkError`, `LazyComponent` (docs: nothing, but the task said "handle the chunk failure the docs describe").
3. `render.d.ts` — `renderToString` / `renderToStream` / `hydrate` signatures + `RootCheck`.
4. `foreign.d.ts` — to see `provided`.
5. `runtime.d.ts` (3 reads, ~300 lines) — `$store`, `$optimisticStore` (derived-body form), `$projection`, `refresh`, `$effect` JSDoc (failure colors!), `until`.
6. `types.d.ts` — grep only: `StoreSetter`, `TypedStore`, `Setter`.
7. `solid-yield/dist/server.dev.js` — grep for `lazy` while debugging the SSR failure.
8. 3rd-party: `@solidjs/router` d.ts (`url` prop; `createRouter`), `@solidjs/web` types/server.d.ts (`AssetManifest`), `@solidjs/vite-plugin` dist source (`getSolidOptions`, to learn why SSR compiled as DOM / non-hydratable under vitest), `@solidjs/web/dist/web.dev.js` (hydration preload).
Nothing from /Users/devagr/solid-yield or /private/tmp/sy-main was read.

## Setup
- S1 [doc CORRECT] Install line (getting-started + solid-yield README) worked verbatim, with `file:` tarballs substituted for the three library packages: no unmet peers, no warnings, 1.3 s. TS resolves to 6.0.3 (pnpm prints "7.0.2 is available", harmless). pnpm saved exact versions for the `rc` ranges (cosmetic).
- S2 [doc missing, minor] The install line has no `@solidjs/router`; it is only in the recipe ("pnpm add @solidjs/router@2.0.0-next.35"). Fine, but the README "Setup" block (which many will copy) doesn't mention it, nor `playwright`/browser tooling (not needed).
- S3 [doc ambiguous] Docs reference registry names for `vite-plugin-solid-yield` / `eslint-plugin-solid-yield` (0.0.0, unreleased); with `file:` it worked, and `solidYield.configs.recommended.rules` exists.
- S4 [env] sandbox: local port bind EPERM (no vite dev/preview), Chrome & Playwright headless shell die with `FATAL: mach_port_rendezvous_mac.cc:159 bootstrap_check_in ... Permission denied (1100)`. NO real-browser check was possible; I did not retry with the sandbox disabled. Everything below is jsdom/node.
- S5 [env, not library] vitest 5 in this sandbox swallows `console.log/warn/error` of test files (`vitest run` prints nothing); I wrote debug output to files, and later replaced console.* with a collector. This cost me a wrong first diagnosis of finding N2 (below) until I captured console.

## Doc gaps found while reading (before coding)
- D1 [missing] The task says "handle the chunk failure the docs describe". None of the six docs describes `lazy`, `ChunkError`, or a retry (the vite-plugin README only explains the module-URL annotation). Everything came from `lazy.d.ts`. (The behaviour itself is good: `Errored({catch:[ChunkError], fallback:(err, reset)=>…})`, `reset` loads again; verified by a test with a rejecting module mock.)
- D2 [missing] No doc shows `renderToString` / `renderToStream` / `hydrate`; only the `[PENDING_ROOT]` rule is explained. No SSR/hydration test recipe (see N3, N4: this was the single biggest time sink).
- D3 [missing] `$store`, `$optimisticStore` (incl. the derived `(draft)=>…, seed` form), `$projection`, `refresh`, `$effect(compute, effect)` are listed only as names/overload errors. No example of an *optimistic list move* (optimistic write, API call, `refresh` the source); I derived it from `runtime.d.ts` JSDoc. It then worked first time.
- D4 [info] Docs link to `documentation/yield-library.md`, `DECISIONS.md`, `packages/yield/test/docs/*.tsx`, `router.type-tests.tsx`: not shipped; links are absolute GitHub URLs now (fine) but "D-0xx" citations remain in docs and in lint/type messages (docs now say "you never need it", good).
- D5 [info] Root README.md is the monorepo readme (pnpm gate, twins, changesets): irrelevant for a consumer, the start page for a user is getting-started. Fine but noisy.

## Build log (what worked first time)
- 00:30 Wrote api/prefs/pages/router/app in one go from the docs: **`tsc`: ONE error**, **eslint: 0**, `vite build`: ok (board page is its own chunk). Things that typed first try: `For`/`Show` rows with `view(…)`, `Show({when: signal-of-failure, children: function*(f){…}})`, `Handler<[T]>` props and contexts (`SetThemeCtx`), 4 contexts provided above the router and listed in `foreign(…, {provided})`, `defineRoute` + `Props<RouteProps<"/boards/:id">>`, a `<form>` component root called in a hole (old finding #15 — works), `$optimistic(false)` in-flight, `$optimisticStore` derived from a memo, `$effect(compute, effect)` writing a signal in the effect phase, `Props<{ url?: string }>` (optional prop; undocumented but fine), `LazyBoard(props)` passing the router props wholesale.
- Tests: 14 tests in 6 files (one per page: home, boards, board, settings + chunk-retry + pending-root), plus 6 hydration tests in a second vitest run.

## Findings (new things that cost time / surprised me)

### N1. [SURPRISE + non-actionable message, ~8 min] A split `$effect` whose compute reads a failing source makes the *component* fail, not its view
`tsc` error at the **route registration in another file**: `src/router.tsx(15,26): error TS2345: Argument of type 'HoleCall<RouteProps<"/boards/:id">, false, ViewFails<ChildView<false, NetworkError | NotFound, false, RequiredContext<boolean, "CompactCtx">>, Element>, false, …>' is not assignable to parameter of type … Type '…' is not assignable to type '{ readonly "[FOREIGN_HANDOFF] a yield component handed to plain Solid may fail with the failure kinds this property lists: handle them inside, or wrap it in an Errored, first": "network" | "not-found"; }'.`
My BoardRoute (wrapper around the lazy page) was `foreign(...)`ed; the page had an `Errored` in its view catching `[NotFound, NetworkError]`, so I believed it handled them. It does not handle the `$effect`'s compute (reads `name`, a memo that may fail): per `runtime.d.ts` JSDoc "an effect's failures reach the nearest Errored above the *component*". Found by deleting the effect (error gone). The message names kinds but not the source, and the doc says nothing about effects' failure colors. Workaround: widen the route wrapper's `Errored catch` to `[ChunkError, NotFound, NetworkError]`.

### N2. [SURPRISE, silent failure, ~20 min] A typed event failure is lost when the event's own optimistic write disposes the row it was bound under
`move` is an `$event` bound `onChange={yield* pick}` inside a per-card `Errored({catch:[LockedError, NotFound, NetworkError], …})`. It does an optimistic `setCards(draft => card.columnId = to)` (the card's row moves to another column's `For`, the old row and its Errored are disposed), then `attempt(() => api.moveCard…, c => new LockedError)`. The LockedError was nowhere: no fallback, no unhandled rejection, no `.move-error`. The only trace (once I captured console): `[RUN_WITH_DISPOSED_OWNER] runWithOwner called with a disposed owner. Children created inside will never be disposed. in div.children › <provider> › …` — which says nothing about a lost failure. Without the optimistic write the `Errored` shows it. The doc rule ("an event's failure goes to the nearest Errored above where it was bound that takes it") is silent about a disposed binder. Workaround: the attempt handler is a generator absorbing into a page-level `$signal<LockedError | NotFound | NetworkError | null>` shown via `Show` (typed paths work: `{yield* f.message}`).

### N3. [BIG GAP, non-actionable error, ~12 min] SSR + hydration under vitest
- `ssrLoadModule` in a vitest globalSetup: `WebSocket server error: listen EPERM 0.0.0.0:24678` (sandbox; `server: {hmr:false, ws:false}` fixes).
- Then `Client-only API called on the server side. Run client-only code in onMount, or conditionally run client-only component with <Show>.  at notSup (@solidjs/web/dist/server.dev.js:4829) at eval (src/pages/board-route.tsx:19:64)`: the JSX was compiled in DOM mode (hoisted `template(…)`). The message points at a line of compiled JSX with no hint of compile mode. Cause (read `@solidjs/vite-plugin` source, `getSolidOptions`): in vitest's `test` mode the Solid plugin forces `hydratable:false`; a hydration test needs `solid({ ssr: true })` and a run in a **non-test mode** (`vitest run -c vitest.hydrate.config.ts --mode hydrate`), plus `resolve.conditions: ["browser","development"]` and `test.server.deps.inline: [/solid/]` in jsdom, otherwise `@solidjs/web` resolves to its server build (same `notSup` error from a different place). getting-started's test config only says "vitest with jsdom picks the client build" — true for client tests, false for hydration.
- In the jsdom client build `generateHydrationScript()` returns `""`; `hydrate` then fails `Cannot read properties of undefined (reading 'done')` (`globalThis._$HY` missing). I installed `_$HY = { events: [], completed: new WeakSet(), r: {}, fe(){} }` by hand.
- Streaming: `renderToStream(...).pipeTo(writable)` must be *awaited*; resolving on `onCompleteAll` produced a truncated stream (only the fallback). Streamed output hydrates after running the inline `<script>`s in order (jsdom `innerHTML` does not).

### N4. [GAP + misleading message] `lazy` + SSR + hydration
- SSR of the lazy page (`/boards/1`) came out EMPTY and the only trace was `[SSR_RENDER_ERROR_CONTAINED] Render error caught by <Errored>: Error: lazy() called with moduleUrl "src/pages/board.tsx" but no asset manifest is set. Pass a manifest option to renderToStream/renderToString.` (+ pointer to node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md). vite-plugin-solid-yield's README says the annotation is "for asset preloading and the hydration manifest" but never says SSR then *requires* `{ manifest }` (a Vite-manifest-shaped `Record<moduleUrl, {file}>`, found in `@solidjs/web` types/server.d.ts). My route wrapper's `Errored` rightly did not take it (untyped), so the page was blank.
- Client hydrate of that page needs the real chunk preloaded: with a fake manifest `file`: `Hydration module preload failed; rendering boundary content on the client: ERR_UNSUPPORTED_ESM_URL_SCHEME … 'http:'` and **`Hydration completed with 33 unclaimed server-rendered node(s)`**: the page ended up doubled/dead (server DOM not interactive). With no manifest entry: `[UNTYPED_THROW] a view in <App>: lazy() module "src/pages/board.tsx" (hydration id "…") was not preloaded before hydration … a routine fails with yield* raise(error) or through an attempt's handler; a plain throw is a bug.` The inner text is good, but the library's wrapper blames the user's code for a Solid-infrastructure error.
- What I did: pre-seed `_$HY.modules[hydrationId] = await import("../src/pages/board")` (Solid skips the preload when the module is already there) → the streamed lazy board page hydrates with **0 warnings** and stays interactive (search, optimistic move after hydration). That is a harness, not a browser.

### N5. [minor] `[NO_PROVIDER] <A> reads a context, created without a default, and no provider above it gives one: call the component inside Ctx.provide({ value, children }).` — the dev error does not name the context (`"MyCtx"`) although the type-level one does and the name is mandatory.

### N6. [minor] jsdom `Not implemented: Window's scrollTo() method` printed on each router navigation in tests (3 per run). Environment stub; not mentioned in the recipe test.

### N7. [observation, good] Docs ↔ behaviour checks that held
- `foreign(Comp, { provided: [...] })`: a wrapper that only *calls a lazy page* requiring `CompactCtx` typed and ran correctly (context through lazy + router + client navigation: test "compact reaches the lazy board page").
- Pending root: `render(App, el)` with a pending App → `[PENDING_ROOT] the root may be pending (a read under it has no Loading above): wrap the root, render(() => Loading({ children: App }), el), or put a Loading around the pending part`. Wrapped version: renders nothing until settled; `renderToString` of it gives no content (sync), `renderToStream` streams the content, and it hydrates (test).
- Hydration of `/`, `/settings`, `/boards` (Loading fallback on the server, then fills in), streamed `/boards`, streamed lazy `/boards/1`: nodes claimed (`toBe(before)`), interactive afterwards.
- `flush` import is admitted by `no-foreign-reactive` in tests (my tests import it, lint clean).

## Deliberate-mistake probe (15 type, 7 lint, 12 runtime), verbatim files kept only in my scratch
- LINT: all actionable (no-component-tag, no-read-in-view-body, no-unyielded-write, no-unbound-event, jsx-only-in-view, no-try-catch, component-children-generator). Nit: they still cite `D-0xx`.
- RUNTIME dev errors: all actionable ([READ_IN_VIEW], [UNYIELDED_WRITE], [UNTYPED_THROW], [READ_IN_SETUP], [WRITE_IN_REACTIVE], [CREATE_OUTSIDE_SETUP], [ASYNC_NOT_ALLOWED]), except N5. A typed failure with no `Errored` surfaces as an unhandled rejection with only the user's message (`nope!`), no mention of the kind or where.
- TYPE messages not actionable alone (all explained in refusals.md): component tag (`… Types of property '[COMPONENT]' are incompatible. Type 'true' is not assignable to type 'undefined'`), read in a setup (`No overload matches this call … Property 'kind' is missing in type 'Read<false, never>' but required in type 'Create<string, any>'`; **no lint rule covers it**), unbound/plain event (`Property '[BOUND]' is missing`), `$effect(function*(){})` (`Expected 2-3 arguments, but got 1.`), row JSX directly (TS2589 + a 30-line overload dump).
- Good type messages: [PENDING_ROOT], [SETTLED_PROP], [FAILURE_KIND], [UNNAMED_CONTEXT], [LAZY_VIEW].

## Time > 15 min
Nothing individually over 15 min by wall clock; N2 (~20 min of probing) and N3/N4 (~15 min each, mostly reading plugin/web source) were the longest.

## Final state
- `pnpm typecheck` 0 errors; `pnpm lint` 0 problems (recommended config, src + test + test-hydrate); `pnpm test` 14/14 (6 files: home, boards, boards ×2, board ×8, settings, chunk-retry, pending-root); `pnpm test:hydrate` 6/6; `pnpm build` ok (board is a separate chunk).
- Not done: real-browser check (sandbox forbids Chrome and listening sockets). Lazy-page hydration verified only through the jsdom harness with a pre-seeded module.

## Classification against previous-log-1 / previous-log-2 (read only after everything above was done)
Previous-1 (numbers = its items):
- 1/22 routing, router + app-wide context: FIXED (recipe + `foreign(…, {provided})` + `defineRoute`; 4 contexts above the router, a lazy page and a client navigation all typed and ran without casts).
- 2/14 test setup / client build: FIXED for client tests; STILL PRESENT for hydration (N3).
- 3/4/5 versions, TS 7, install line: FIXED (verbatim line works, no unmet peers).
- 6/7 flow-control signatures, Show with value (TS2589 noise): signatures FIXED (table + examples; typed first try); the TS2589 + 30-line overload dump for "row returns JSX" STILL PRESENT (now documented in getting-started).
- 8/9 event-prop type, no-unshown-wait default: FIXED (`Handler<[T]>`; no warning in my app).
- 10 changing value in a context: FIXED (documented; worked).
- 11 [NO_PROVIDER] type message good: STILL GOOD; the dev-time one doesn't name the context (N5, new).
- 12/13/16 form inputs, transaction, `$optimistic`: FIXED (documented; worked).
- 15 `<form>`/`<select>` as a component root crashing: FIXED (CardForm's root is a `<form>`, called in a hole; add + edit tests pass).
- 17 `String(cause)`: FIXED (doc now says take `message`).
- 18 `reset` plain function in fallback: FIXED (documented).
- 19 lint messages: STILL EXCELLENT; nit about tag-syntax `<Show>` hint FIXED (now `Show(…)`); `D-0xx` citations in messages STILL PRESENT (docs now disclaim them). Type messages for tag/unbound event STILL PRESENT (cryptic, documented in refusals.md).
- 20 read-in-setup type error (and no lint): STILL PRESENT.
- 21 pending-root reported as `[NO_PROVIDER] … any`: FIXED (got `[PENDING_ROOT] … wrap the root, render(() => Loading({ children: App }), el)`).
- 23 dead links / D-numbers / `yield *` formatting: PARTLY FIXED (absolute URLs, `yield*` spelled normally, "you never need it"); targets still not shipped; root README still the monorepo's.
- 24 env (no listen): STILL PRESENT, worse here (no browser at all).
Previous-2:
- F1 transaction/in-flight: FIXED (docs). F2 versions: FIXED. F3 `defineRoute` for params: FIXED (recipe has it; I used it first try). F4 `flush` lint in tests: FIXED (admitted; lint clean on tests). jsdom `scrollTo` warning: STILL PRESENT (N6). F5 row/view/context structure: FIXED docs.
NEW (not in either log): N1 effect-compute failures color the component (error far away), N2 silently lost event failure when its binder row is disposed by the optimistic write, N3 SSR/hydration under vitest (non-test mode, `ssr:true`, `_$HY`, awaiting pipeTo), N4 lazy + SSR needs `manifest`, blank page + misleading UNTYPED_THROW wrapper, chunk must be preloaded to hydrate, N5 NO_PROVIDER dev message unnamed, D1 lazy/ChunkError retry undocumented.
REGRESSIONS: none found.

## Post-interruption note
Interrupted once; on-disk state verified intact (typecheck/lint 0, 14/14 + 6/6). git is unusable here (sandbox denies writes to app/.git config), so the checkpoint is /private/tmp/sy-review-3/checkpoints/app-final-*.tgz (node_modules/dist excluded); log copy in app/REVIEW-LOG.md.
