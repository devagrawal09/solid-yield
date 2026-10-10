> Agent report from the 2026-10-10 migration trial ([summary](README.md)), unchanged. Paths under `/home/user/migrations/` are the session's working copies; the repros are in [`repros/solid-realworld/`](repros/solid-realworld) and the final checker output in [`checks/`](checks).

# solid-realworld → Solid 2, checked with solid-yield native mode

App: solidjs/solid-realworld @ f6e77ec (Solid ^1.3.3, rollup + babel-preset-solid, 26 `.js` files, 1,320 lines).
Copy: `/home/user/migrations/solid-realworld`, branch `solid2-migration` (7 local commits on top of f6e77ec).
Verifier: sy-verifier `proto/sugar-types` @ 31695cb (packed tarballs). Solid 2.0.0-rc.13 (`@solidjs/signals` pinned to rc.13),
Vite 8.3.4, @solidjs/vite-plugin 3.0.0-next.47, TypeScript 6.0.3. No router package: the app keeps its own hash router.

## 1. Outcome

| Item | Result |
| --- | --- |
| Files migrated | 26/26 (now 30 `.ts/.tsx`, 1,727 lines; +`types.ts`, `marked.d.ts`, `pages/Home/predicate.ts`) |
| Checker, original `.js` (allowJs) | 26 files, 30 errors (13 `BABEL_PARSE_ERROR`); with `checkJs` 76 errors (see Q1) |
| Checker, Solid 1 code renamed to `.tsx` | 150 errors |
| Checker, first plain-Solid-2 pass (flows already green) | 31 errors (14 of 28 files refused) |
| Checker, final | **0 errors, 0 warnings, 29 files** (`solid-realworld-check.txt`); 16 runs, peak 59 |
| Plain Solid 2 build (`vite build`) | OK, 0.65 s, 128.7 kB JS (43.5 kB gzip) |
| solid-yield build (`SOLID_YIELD=1 vite build`, native mode) | OK, 28–29 s (97% in the yield transform), 152.7 kB (49.7 kB gzip) |
| Flows (7 baseline + 7 fault/pending) | plain 14/14, yield 14/14, Solid 1 12/14 (the 2 failures are Solid 1 bugs, §5) |
| plain vs yield | **0 snapshot-field differences, all 28 DOM snapshots byte-identical**, identical API call logs |
| solid-yield dev server | all 7 main flows pass once warm; first cold page load exceeded the 8 s Playwright timeout |

Time (rough): baseline 10 min; setup + Q1 15 min; first plain Solid 2 pass 17 min (all flows green);
checker iteration 70 min; strict-subset runs, fault flows and verification of workarounds 25 min; repros + this report 40 min.

Flows (`e2e/flows.mjs`, Playwright + `page.route` mock of api.realworld.io, fresh mock state per flow):
home + pagination, tag filter, article + comments (anonymous), login (bad then good password), profile + favorites tab,
signed-in comment/delete/editor publish/settings/logout, follow + favorite. Fault flows: tags aborted, list 500,
article aborted, follow aborted, `/user` delayed, list delayed, tags delayed. Snapshots: `e2e/final-{solid1,plain,yield}/`.

### Answers to the four questions

**Q1. Does the checker accept `.js/.jsx` as is? No; converting to `.tsx` was necessary.**
- With the README tsconfig (`include: ["src"]`) and no `allowJs`: `config error TS18003: No inputs were found`, 0 files.
- With `allowJs`: 26 files lowered, 30 errors. 13 are `BABEL_PARSE_ERROR ... Unexpected token, expected ","` at
  intermediate-program positions such as `(17:54)`. The lowering inserts TypeScript-only syntax
  (`import { type RootCheck, ... }`, annotations) and re-parses with the parser plugins chosen by the `.js`/`.jsx` extension
  (repro 01). The remaining 17 were NATIVE_API ×12, NATIVE_SPREAD ×3, NATIVE_EFFECT_PHASES and one SUGAR_COMPONENT at the
  inline `render` root.
- Worse: without `checkJs`, TypeScript does not report semantic diagnostics for JS files, so model errors inside `.jsx`
  are silent. A `READ_IN_SETUP` in a `.jsx` component gives `0 errors`, exit 0, or only
  `[FOREIGN_HANDOFF] Fix the earlier errors in this component ...` at a `.tsx` root, pointing at errors that are never printed (repro 02).
- With `checkJs`: 76 errors (35 TS7006 implicit-any, 12 NATIVE_API, 9 BABEL_PARSE_ERROR, …).
  Also `Cannot find name 'Show'/'For'` at `[generated] 1:1`. babel-preset-solid 1.x auto-imported control-flow components.
- Done instead: `git mv` to `.tsx/.ts`, strict TS types (no `any`; two `as` in `createAgent.ts` reproduce the original's
  "return the caught error as the response" behaviour and are unrelated to checker diagnostics).

**Q2. rollup/babel → Vite + @solidjs/vite-plugin + vite-plugin-solid-yield.** Small. Switch npm → pnpm 11 (needs
`"packageManager": "pnpm@11.20.0"`; the bare `pnpm` here is 10.28 and ignores `allowBuilds`), move `public/index.html` to the
root, point it at `/src/index.tsx`, drop the rollup config and babel deps, and add one `vite.config.ts` with
`solidYield({ mode: "native", include: ["src/**"] })` before `solid()` behind `SOLID_YIELD=1`. Friction is in §2. The yield
build is 45× slower (29 s vs 0.65 s). Two Babel-era habits broke: implicit `Show`/`For`/`Suspense` globals and `onKeyup`
(now `onKeyUp`).

**Q3. createResource → async memo + Loading, createComputed and useTransition removal, failures.**
- *Detection*: on the Solid 1 code the checker refused `createResource` ×5, `createComputed` ×4, `useTransition` ×2 and
  `batch`, plus one-argument `createEffect` (`NATIVE_EFFECT_PHASES`). All correct, but worded as
  "Solid API createComputed has no verified native lowering". That reads as "valid but unsupported"; these APIs no longer
  exist. A refusal also hides the file's ordinary TS errors, including `TS2305 no exported member` (repro 19).
- *The natural Solid 2 replacement was refused*. `createResource(source, fetcher)` + `mutate()` maps to a writable async
  memo, `createSignal(fn)` (or `createStore(fn, seed)`). That gives `[generated] SUGAR_CALLBACK` at the enclosing factory's
  name (repro 06). All four resource modules had to become read-only `createMemo` + `action(function*)` + `refresh()`.
  Every optimistic mutation became "wait for the server, then refetch" (+4 GETs in the flows; §5). Plain
  `createMemo(async…)`/`createMemo(() => promise)` under `Loading` is accepted, including pending propagation through
  derived memos and props.
- *createComputed* (5 calls in 4 files): the App gate became a memo; the 4 that wrote store sources became
  `createEffect(compute, apply)`, as did the two loader calls made in component bodies. The checker accepted the effect writes. Two compute spellings were refused: a signal getter passed directly
  (`createEffect(token, …)` → GENERATED_TYPE + `TS1345 ... 'void' cannot be tested for truthiness`) and a named function
  (`SUGAR_ESCAPE Routine getPredicate is handed to an unknown consumer`) (repro 18).
  Not flagged: the effect-driven loader regresses first-load UX (§4).
- *useTransition*: deleting it (2 sites) raised no diagnostics. Solid 2's built-in transitions keep the old list on screen
  during tag/page changes, as Solid 1's `start()` did.
- *Pending at the root*: correct. Removing the root `<Loading>` gives `TS1360 [PENDING_ROOT] Wrap this read in Loading`
  with the `render` call as related location. Due to repro 15 it pointed at a static `<NavLink>` instead of the
  `currentUser()` read.
- *Failures / Errored*: the most valuable part. The checker reported that fetch-backed reads could reject with no boundary:
  `NavBar.tsx:21:19 [FOREIGN_HANDOFF] Wrap this rendered work in Errored ... Remaining: TypeError | unknown` (related:
  `index.tsx:14:15 The app is rendered here`). The original has no boundary. In Solid 1, an aborted `/tags` or a 500 on
  the list leaves the whole page stuck on "Loading..." with a pageerror. The migrated app (both builds) shows
  "Could not load tags." / "Could not load articles." / "Could not load this page." and keeps the rest of the page.
  Removing the route-level `Errored` brings the error back (`App.tsx:38:19 FOREIGN_HANDOFF ... unknown`). Removing only
  the list's Errored is correctly accepted, because the route boundary covers it. `EVENT_REJECTS` also caught a rejection
  my own migration introduced (§3, row 26).
  Precision problems around failures are in §3: CATCH_SWALLOWS for setter parameters, `reset()`, and the unknown floor
  (the "notice" UI it forced is unreachable at runtime).

**Q4. Hand-written router and context store: lowered (after restructuring), not treated as foreign.** No
NATIVE_FOREIGN_BOUNDARY was reported for them. Both were refused in their idiomatic Solid shapes:
- Router: `match()` wrote a closure variable and poked a signal from inside `<Match when>`. That is a write in a reactive
  scope (Solid 2 forbids it). The checker never reported it, because it refused the file for `useTransition` first (§3 row 5).
  The same pattern is why the original NavLink "active" class never updated. `getParams: () => …`
  closures returned from the factory gave `SUGAR_CALLBACK` (F-S27). Now the router returns `location` and a
  `getParams` memo, and `App` keeps a local `match` helper.
- Store: getters on `createStore` (`get articles() { return articles() }`) → `SUGAR_HOST Reactive operations in async
  functions or methods are unsupported` (the known `{ read() {...} }` disagreement). Solid 2 dev mode also warned
  `STRICT_READ_UNTRACKED` for those getters inside setters, so this one is justified. Then, with a context value of
  memos/setters/actions:
  - destructuring it through `useStore()` failed (`Property 'x' does not exist on type 'Read<false, never>'`, repro 07);
  - composing it in a `createConduit()` helper made every consumer's destructuring a `READ_IN_SETUP` (repro 09);
  - wrappers like `loadArticles(p)` returned from a factory were `SUGAR_ESCAPE` (F-S27).
  What passes: the Provider component composes the factories itself, consumers call `useContext(StoreContext)` directly,
  and every exported mutation is a Solid setter or an `action(function*)`.

## 2. Setup friction

1. **pnpm version**: `pnpm` on PATH (`/opt/node22/bin/pnpm`) is 10.28.0. It only self-switches to 11 when `package.json`
   has `packageManager`. The first install silently used pnpm 10, and pnpm 10 ignores `allowBuilds`. Fix: add
   `"packageManager": "pnpm@11.20.0"`.
2. **Signals version skew**: `solid-js@2.0.0-rc.13` depends on `@solidjs/signals@^2.0.0-rc.13`, which resolved to rc.14.
   Fix: `"@solidjs/signals": 2.0.0-rc.13` in the workspace overrides (the verifier's own lock has rc.13).
   `@solidjs/vite-plugin@3.0.0-next.47` also pulls `@solidjs/compiler@2.0.0-rc.14`; it built fine.
3. **README tsconfig has no `allowJs`**, so a JS app gets `TS18003 No inputs were found`. Adding it leads to Q1.
4. **marked@0.8 has no types**: added a 3-line `src/marked.d.ts` (excluded from selection automatically).
5. **Only the first refusal per file is shown**, so each fix exposed the next one: 14 of 28 files were refused in run 1,
   and runs took 30–45 s. A cascade from one refused store module produced misleading errors in all its importers
   (`NATIVE_SETUP_FAILURE` at every `useStore()`, `TS2488 ... [Symbol.iterator]`, `FOREIGN_HANDOFF ... Remaining: any`).
6. **No way to see the lowered code**: I wrote a script around `vite-plugin-solid-yield/virtual`'s `lowerNativeProject`
   with the CLI's refusal-retry loop. For crashes I patched a *private copy* of the plugin to dump the intermediate
   program when Babel fails (`positions.js`). The verifier was never modified.
7. Unrelated: the session scratchpad is shared with the other two agents. I overwrote another agent's `scratchpad/exp1`
   by accident and left a note there. All my files are now under `scratchpad/srw/`.

## 3. Diagnostic log

182 distinct (code, position) pairs over 16 runs on migrated code, which group into the root causes below. Verdicts per
root cause (37 rows): **correct 5, refused valid Solid 2 / unsupported 17, false positive 12, crash 1**, plus 2 rows (5, 6)
that the checker never reported because earlier refusals in the same files masked them. A ✓ under "Act." means the message
alone told me what to change.

| # | Code | Where (first seen) | Verdict | Act. | Change |
| --- | --- | --- | --- | --- | --- |
| 1 | NATIVE_API (createResource/createComputed/useTransition/batch, 12) | store/*.ts:1, App:1, pages/*/index:1 | correct; wording implies valid-but-unsupported | ~ | memos, effects, removed |
| 2 | NATIVE_EFFECT_PHASES | createCommon:9:3 | correct | ✓ | two-phase effect |
| 3 | NATIVE_PROPS (destructured props, 4) | ArticlePreview:6, Article:37, Comments:6, Home:4 | correct (Solid 2 dev also warns) | ✓ | `props.x` |
| 4 | NATIVE_SPREAD `{...getParams()}` (3) | App:29/33/34 | unsupported (F-S24) | ✓ | explicit `params`/`routeName` props |
| 5 | (not reported) write in `<Match when>` (router `match` → `triggerParams()`) and writes in component bodies (`setAppLoaded`, `loadArticle(slug)`) | createRouteHandler, App, Article/index (Solid 1 code) | masked by NATIVE_API/SUGAR_CALLBACK refusals in the same files; fixed from Solid 2 knowledge | — | route memo, effects |
| 6 | (not reported) setup snapshots `const { token } = store` | Home/index, ArticleList, Comments (Solid 1 code) | masked the same way | — | read in JSX/memo |
| 7 | NATIVE_HANDLER array-bound/property/curried handlers (5) | ArticleList:40:28, ArticlePreview:30:24, Article:31:64, Comments:25:45, Editor:92:31 | refused valid (mapping table: "property handlers refused") | ✗ (doesn't say what to write) | inline arrows |
| 8 | SUGAR_HOST store getters | store/index:41:16 | refused valid (known) | ~ | accessors in context |
| 9 | SUGAR_CALLBACK/SUGAR_ESCAPE functions returned from factories (router closures, `loadArticles`, `updateUser`, `loadComments` method) | createRouteHandler:36:31, createAuth:29:11, createComments:17:26 | refused valid (F-S27) | ✗ | setters / `action(function*)` |
| 10 | `[generated] SUGAR_CALLBACK` writable memo `createSignal(fn)` | createArticles:14:25, createProfile:5:25, createAuth:14:5 | refused valid — **new** (repro 06) | ✗ (at factory name) | createMemo+action+refresh |
| 11 | NATIVE_API `untrack` | Settings:1:23 | refused valid (not in API inventory) | ✓ | effect fills the form |
| 12 | SUGAR_CALLBACK `.catch(e => setState(...))` in an event | Auth:33:11, Settings:36:11, Editor:57:11 | refused valid (says "read", it is a write) | ✗ | async/await + try/catch |
| 13 | COMPONENT_TAG + FOREIGN_HANDOFF(ChunkError) for `lazy()` pages, even inside Errored | App:12:25 + 4 page index files, `[generated]` | refused valid — **new** (repro 10) | ✗ (advice doesn't work) | static imports |
| 14 | COMPONENT_TAG at `render(() => <Provider>…)` | index:8:8 | refused valid — **new** (repro 03) | ✗ (names `yield*`) | prop-less `Root` |
| 15 | NATIVE_SETUP_FAILURE at `useStore()` (7) | App:13, NavBar:6, NavLink:7, … | false positive (cascade of #8) | ✗ | — |
| 16 | TS2339 `... on type 'Read<false, never>'` (~20) | 7 files using `useStore()` | false positive — **new** (repro 07) | ✗ | `useContext(Ctx)` |
| 17 | READ_IN_SETUP at consumers' destructuring + at `page: articles.page` | index:53:13 + 7 consumers | false positive — **new** (repro 09) | ✗ | compose in Provider |
| 18 | GENERATED_TYPE `action(async function*)` (6) | createAuth:16/23/34, createComments:15, createArticles:67/73 | refused valid — **new** (repro 16) | ✗ | sync generator, typed `yield` |
| 19 | TS2344/TS2345 GENERATED_TYPE, then `TS2339 ... on type '{}'` | createRouteHandler:26, App:15/24/28/30, NavLink:10 | refused valid — **new** (repro 17) | ✗ | drop memo annotations |
| 20 | GENERATED_TYPE + TS1345 `createEffect(token, …)` | createCommon:7:16, 8:5 | refused valid — **new** (repro 18) | ✗ | `() => token()` |
| 21 | SUGAR_ESCAPE `createEffect(getPredicate, …)` | Home/index:34:16 | refused valid — **new** (repro 18) | ~ | inline arrow |
| 22 | TS2488 `'string \| undefined' must have a [Symbol.iterator]` (effect value members lowered as reads) | Profile/index:23:39 | false positive (repro 14 family) | ✗ | compute returns the predicate |
| 23 | BABEL_PARSE_ERROR `Unexpected reserved word 'yield'` (7 sites) | ArticleList:16/18, Profile:14, ArticlePreview/Article/Comments/Profile async helpers | **crash — new** (repros 05, 11, 13) | ✗ | inline / logic moved into actions |
| 24 | SUGAR_ESCAPE / WRITE_IN_REACTIVE: callback prop calling context action/setter | Home:53:17, Profile:81:17, ArticleList:6:25, Article:57:78 | false positive — **new** (repro 11) | ✗ | children call context actions |
| 25 | `[generated] SUGAR_CALLBACK` `props.onX(props.y)` | ArticlePreview:7:25, Comments:7:10 | refused valid (F-S19 "partial"; repro 08) | ✗ (component name) | hoist the read |
| 26 | EVENT_REJECTS `Profile.tsx:38:28 ... TypeError \| unknown` | Profile handleClick | **correct**: my refresh-based follow dropped the original catch | ✓ | handle in action |
| 27 | FOREIGN_HANDOFF fetch failures reach the root (`TypeError \| unknown`) | NavBar:21:19, App:12:25 | **correct** (original had no boundary; Solid 1 hangs, §5) | ✓ | scoped Errored ×5 |
| 28 | READ_IN_SETUP `[generated]` for JSX built in setup (`link = <NavLink…/>`) | Auth:7:25 | refused valid by design (jsx-only-in-view) | ✗ (component name) | JSX moved into the view |
| 29 | TS2322 store copy `Object.assign({}, state)`; GENERATED_TYPE for `...rest` of a store | Settings:27:13, Editor:55:56 | refused valid — **new** (repro 20) | ✗ | explicit field lists |
| 30 | TS2538 `[generated] 'undefined' cannot be used as an index type` (narrowing lost) | Editor:13:25 | false positive — **new** (repro 20) | ✗ | read prop once |
| 31 | TS7006 + `'_state' is of type 'unknown'` for `props.article.tagList.map(tag => <li/>)` | ArticlePreview:47 | false positive (F-S46 area) | ✗ | `<For>` |
| 32 | SETTLED_PROP ×3 + GENERATED_TYPE with `ParentProps<…>` | Article:15/20/29 (into NavLink) | false positive — **new** (repro 21) | ✗ | explicit `children?: JSX.Element` |
| 33 | TS2488 `'boolean' must have a [Symbol.iterator]` + EVENT_REJECTS | ArticlePreview:34:21 | false positive — **new** (repro 14) | ✗ | read `props.article.x` directly |
| 34 | CATCH_SWALLOWS for `catch { setNotice("…") }` with a `Setter` parameter (6) | createArticles:58/68/89, createComments:25, createProfile:18/28 | false positive (syntactic rule: only a locally destructured setter counts) | ~ | per-factory error signals |
| 35 | EVENT_REJECTS for Errored's `reset()` | App:39:71 | false positive — **new** (repro 12) | ✗ | dropped the retry button |
| 36 | FOREIGN_HANDOFF "unknown" at a static NavLink outside Errored | NavLink:12:18 | false positive — **new** (repro 15) | ✗ | no-op Errored around NavBar |
| 37 | TS2554 `createSignal<T>()` without initial value | scratch tests of the store | refused valid — **new** (repro 04) | ✗ | `createSignal<T \| undefined>(undefined)` |

Notes on the correct-but-imprecise ones:
- #26/#27 failure sets come from `send()` in `createAgent.ts`. `JSON.stringify` can throw TypeError, and the catch handler
  calls a setter received as a parameter (unknown). In practice `send()` never rejects: it catches everything and returns the
  error as a value, so the per-action "Could not …" notice the checker forced me to add cannot fire (the follow-abort fault
  flow confirms it).
- Messages that point at a component/factory name with `[generated]` (#10, #13, #25, #28, #30) were the slowest to resolve.
  Every one needed bisection or the dump script.

## 4. Missed bugs (false negatives)

All checked with the final, checker-clean code.
1. **Empty-state flash instead of the Loading fallback** (plain and yield identical). With `/articles` delayed 1.5 s,
   Solid 1 shows "Loading articles..."; Solid 2 shows **"No articles are here... yet."** until the list arrives.
   Cause: the createComputed→createEffect rewrite sets the article source *after* the first render. The list `Loading`
   has already revealed its (empty) content, and Solid 2 holds revealed content during revalidation.
   The checker sees every pending read covered by `Loading` and reports nothing. The pending model does not
   distinguish "covered" from "shows a fallback". (`e2e/final-*/pendinglist-waiting.json`)
2. **`ASYNC_OUTSIDE_LOADING_BOUNDARY` dev warning in checker-clean code.** Solid's dev runtime warns on every page
   "An async value was read outside a Loading boundary. The root mount will be deferred until all pending async settles".
   This happens in plain dev and in yield dev. It appeared only after removing `lazy()` (the checker-forced change #13):
   making only `Home` lazy again removes it, and the first-pass build (lazy pages) never shows it. I saw no deferred
   mount (a delayed `/tags` still shows the page with "Loading tags..."). Whether this is Solid's diagnostic or a real
   uncovered read, the checker accepted the program.
3. **Original bugs hidden by refusals.** The Solid 1 `ArticleList` calls an undeclared `slug`
   (`pageerror: slug is not defined` on every favorite click in the baseline). Plain `tsc` reports
   `TS2304: Cannot find name 'slug'`; the checker printed only `NATIVE_HANDLER` for that file (repro 19).
4. **Tracking through async helpers** (first pass, before the checker accepted the store). Memos calling `agent.*`
   tracked `state.token`, which `send()` read synchronously. Every fetch memo re-ran on login/logout (extra `GET /tags` and
   comments after logout), because Solid 1 resource fetchers were untracked. Nothing in the model flags an unintended
   dependency. The final code reads the token from a plain mirror (`session.token`) because `untrack` is refused (#11).

## 5. Strict-subset results (most important)

- **No case found where checker-clean code fails as plain Solid 2, and no difference between plain Solid 2 and
  vite-plugin-solid-yield.** 14 flows, 28 snapshots: 0 field differences, byte-identical `body.innerHTML`, identical mock
  API logs, same console errors. This includes the failure paths (aborted tags, 500 list, aborted article, aborted follow)
  and pending states. In dev mode the yield dev server passed the same 7 main flows and showed the same dev warnings as
  plain dev (snapshots not compared field by field).
- Non-functional differences: yield build 45× slower, +19% JS (+14% gzip), first cold dev page load > 8 s.
- The subset holds, but reaching it changed the app (next list). The two runtime regressions in §4.1/§4.2 come from
  checker-forced or migration-forced changes and exist in *both* builds.

Differences from the Solid 1 baseline (`e2e/compare.mjs e2e/final-solid1 e2e/final-plain`), all identical in yield:
| Difference | Cause |
| --- | --- |
| NavBar links get `active` class (Solid 1: never) | router rewrite; the original `triggerParams()` set `undefined` → no notify |
| Editor: tag pill appears, input clears (Solid 1: neither) | Solid 2 draft setters make the original mutation-style `setState(s => { s.tagList.push… })` work |
| Favorite works, count updates (Solid 1: ReferenceError) | `slug` bug fixed (TS2304) |
| Fault flows: tags/list/article failures show scoped fallbacks (Solid 1: stuck "Loading..." + pageerror) | Errored boundaries demanded by the checker |
| Follow failure shows "Follow alice" (server truth); Solid 1 shows "Unfollow alice" (optimistic, never reverted because `send` swallows) | refresh-based actions |
| `/user` pending: "Loading..." for the whole page (Solid 1: anonymous nav, empty body) | root `Loading` covers NavBar's `currentUser()` read |
| List pending on first load: "No articles are here... yet." | §4.1 |
| +4 GETs (`/articles/fresh-post`, comments after delete, profile after follow, list after favorite) | `createMemo` + `refresh` instead of `mutate` (writable memo refused) |
| Editor no longer sends `tagInput`/`errors` keys in the article payload | explicit field list (#29) |

## 6. Solid 2 / ecosystem blockers (not solid-yield's)

- `@solidjs/signals` resolves to rc.14 under `solid-js@rc.13` unless pinned (§2.2).
- `ASYNC_OUTSIDE_LOADING_BOUNDARY` fires (and names an owner path *inside* a `Loading`) when non-lazy pages start fetching in
  effects during the initial mount; no observable deferral (§4.2). Worth a look by the Solid team.
- Solid 2 store getters are re-evaluated inside setters (`STRICT_READ_UNTRACKED ... read directly in an effect callback` for
  every getter when `setState` ran in an effect). That makes the Solid 1 "store with resource getters" pattern a poor fit.
- Behaviour shifts that a migration must handle regardless of the checker: deferred reads after writes, effect-driven loaders
  vs `createComputed` (§4.1), tracking inside async helpers (§4.4), `classList` → `class` arrays, `onKeyup` → `onKeyUp`,
  `Index`/`Suspense` renames, and the end of babel-preset-solid's implicit control-flow imports.
- marked@0.8 prints a `sanitize` deprecation warning (unchanged from the original).

## 7. Recommendations for solid-yield (ranked)

1. **Support writable derived state** (`createSignal(fn)`, `createStore(fn, seed)`) as memos with a write channel. It is the
   one-to-one target for `createResource` + `mutate` in every Solid 1 app. Today it is a `[generated] SUGAR_CALLBACK` at the
   factory name (repro 06, new). Without it, migrations get refetch-after-write designs and extra network traffic.
2. **Make `lazy()` of a selected component passable.** Check `foreign(Page)` where the tag is rendered, so an authored
   `Errored` discharges ChunkError, and fix the COMPONENT_TAG on the result (repro 10, new; F-S26). Today the only fix is to
   drop code splitting, which also triggered §4.2.
3. **Never crash with BABEL_PARSE_ERROR.** Either emit `yield*` only inside generators or refuse with a source-positioned
   reason. Seen for: a helper calling a prop (05), a callback prop calling a context setter (11), an async helper calling a
   context setter (13), and `.jsx` files (01). Seven app sites; all positions point into the intermediate program.
4. **Callback props and context members are the normal Solid shape; host them.** False WRITE_IN_REACTIVE for a callback prop
   calling a context action (11). SUGAR_ESCAPE for anything a factory returns (F-S27). `props.onX(props.y)` refused (08,
   F-S19). Tuple context via a custom hook (07) and a factory composing factories (09) turn into setup reads.
5. **Per-call prop colours** (repro 15, new). One colored call site makes every other call of that component pending/failing.
   This forced a no-op `Errored` around the NavBar (a catch-all I had to add because of the checker). Also widen
   `ParentProps<>` like explicit props (21).
6. **Report ordinary TS diagnostics in refused files**, and say "removed in Solid 2" for createResource/createComputed/
   useTransition/batch instead of "no verified native lowering" (repro 19). Show all refusals per file, not just the first.
7. **`.js/.jsx`**: either lower with TS-free output and force semantic checking of selected JS files, or refuse JS
   selection with a clear config error. Silent `0 errors` (repro 02) is the worst outcome for the strict-subset claim.
8. **Type-annotation forms**: `createMemo<T>()`, annotated compute returns (17), `createSignal<T>()` (04),
   `createEffect(getter, …)` (18), `action(async function*)` from Solid's own docs (16), store copies and narrowing (20).
   Each produced TS errors at authored code that read like the author's mistake.
9. **CATCH_SWALLOWS**: recognise a `Setter` (by type, not by destructuring syntax) as a fallback write, and don't treat
   `Errored`'s `reset()` as an unknown-failing call (12).
10. **Pending model**: consider a hint when an async source first becomes pending *after* its `Loading` has revealed
    (effect-driven loaders), since that is where Solid 1 → 2 migrations lose their fallbacks (§4.1).
11. Tooling: expose the lowered program (`solid-yield check --emit-dir`), and print the related chain for root errors
    ("which component call carries this unknown?"). Repro 15 took six bisection runs to locate.

## 8. Repros

`/home/user/migrations/feedback/solid-realworld-repros/` — each dir has `src/`, `tsconfig.json`, a `node_modules`
symlink to the app's install, and a README with command / expected / actual. `ALL-OUTPUTS.txt` has a fresh run of all 21
(each fails the checker; plain `tsc` passes all except 19, which shows the hidden TS errors).

| Dir | Finding | Status |
| --- | --- | --- |
| 01-jsx-babel-parse-error | `.jsx` lowering emits TS syntax → BABEL_PARSE_ERROR | new |
| 02-js-files-unchecked-without-checkJs | model errors in `.jsx` silently dropped | new |
| 03-render-root-with-props-component-tag | `render(() => <Comp prop/>)` → COMPONENT_TAG | new |
| 04-createSignal-no-initial-value | `createSignal<T>()` → TS2554 | new |
| 05-helper-calling-prop-yield-parse-error | helper calling a prop → crash | new |
| 06-writable-memo-createSignal-fn | writable memo refused | new |
| 07-context-tuple-through-hook | `[a, {b}] = useHook()` → `Read<false, never>` | new (F-S37 covers object hooks only) |
| 08-prop-callback-with-prop-argument | `props.onX(props.y)` refused + parent false WRITE_IN_REACTIVE | F-S19 related |
| 09-nested-store-factory-read-in-setup | factory composing factories → consumers READ_IN_SETUP | new |
| 10-lazy-selected-component | lazy page unpassable even inside Errored | new (F-S26 area) |
| 11-callback-prop-calling-context-action | false WRITE_IN_REACTIVE / crash | new (F-S40 gap) |
| 12-errored-reset-event-rejects | `reset()` → EVENT_REJECTS | new |
| 13-context-setter-in-async-helper | crash | new |
| 14-hoisted-prop-member-read | `const x = props.item; x.flag` → TS2488 | new |
| 15-prop-colors-leak-across-callers | static call inherits other callers' pending/failure | new (D-119) |
| 16-async-generator-action | `action(async function*)` → GENERATED_TYPE | new |
| 17-createMemo-type-annotations | explicit memo types → GENERATED_TYPE, `{}` | new |
| 18-createEffect-compute-forms | getter / named compute refused | new |
| 19-refusal-hides-ts-errors | refusal hides TS2305/TS2552; NATIVE_API wording | new |
| 20-store-copy-and-narrowing | store copy typed as Source; narrowing lost | new |
| 21-parentprops-not-widened | `ParentProps<>` not widened → SETTLED_PROP | new (D-119) |

Other artifacts: `solid-realworld-check.txt` (final run: `29 files, 0 errors`), `solid-realworld-diffstat.txt`
(`git diff f6e77ec --stat`, includes the e2e snapshot dirs; `src/` alone: 49 files, +1,727/−1,323 with rename detection).
Harness in the copy: `e2e/{mock-api,flows,compare,serve}.mjs`.
