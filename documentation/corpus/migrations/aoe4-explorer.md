> Agent report from the 2026-10-10 migration trial ([summary](README.md)), unchanged. Paths under `/home/user/migrations/` are the session's working copies; the repros are in [`repros/aoe4-explorer/`](repros/aoe4-explorer) and the final checker output in [`checks/`](checks).

# aoe4-explorer: Solid 1 → Solid 2 with the solid-yield native checker

App: aoe4world/explorer (MIT). Copy `/home/user/migrations/aoe4-explorer`, branch `solid2-migration` (base `f5b5476`,
7 local commits). Verifier: `/home/user/sy-verifier` proto/sugar-types @ 31695cb (packs from `/home/user/solid-yield-packs`).
Stack after migration: solid-js / @solidjs/web 2.0.0-rc.13, @solidjs/router 2.0.0-next.29, @solidjs/vite-plugin
3.0.0-next.47, vite 8.3.4, typescript 6.0.3, Tailwind 3.4. E2E: `e2e/flows.mjs` (7 flows), `e2e/compare.mjs`,
Solid 1 snapshots in `e2e/baseline-solid1/`. Saved checker outputs: `aoe4-explorer-check.txt` (final),
`aoe4-explorer-check-before.txt` (unmigrated source), `aoe4-explorer-check-run1-final.txt` (first complete run),
`aoe4-explorer-lowering-timeline-run1.log` (per-pass lowering timings of the first full run).

## 1. Outcome

| | |
| --- | --- |
| Files | 53 of 106 `src` files changed (the 53 untouched are mostly patch-note data and plain helpers). Whole app migrated, quiz included. |
| Checker | Unmigrated Solid 1 source: 194 errors (2m51s). First complete run after migration: 760 errors. Final: 344 errors in 51 files (124 with a solid-yield code, 220 plain TypeScript: 61 of those are ordinary `tsc` errors - plain `tsc` reports 93, legacy null handling exposed by `strictNullChecks` - and 159 exist only in the generated code). Not clean. |
| Plain Solid 2 build + run | Builds (5 s). **7/7 flows pass, 12/12 snapshot steps identical to Solid 1** (text, links, title, URL, TOC entries). |
| solid-yield build + run | Whole selection: builds only with 14 files excluded (any transform error aborts the whole Vite build); runs, but **0/7 flows**: every page renders the root `Errored` fallback, each crash in a file the checker reports errors in. Checker-clean selection (all 51 error files excluded, 55 files / 34 components lowered): **7/7 flows, 12/12 steps identical** (§5). |
| Time | Baseline build + flows 25 min; mechanical migration to green plain Solid 2 ~35 min; checker work (refusal hunting, repros, rewrites) ~2.5 h, of which roughly 1 h was waiting on lowering passes; strict-subset builds/runs 30 min; report 30 min. |

Answers to the four questions:

1. **createResource (38 live sites + 1 commented out).** I used two forms: 11 direct `createMemo(async () => …)` and 26
   `createMemo(() => asyncHelper(reads…))` (+1 synchronous memo, 2 with `{ loadingValue }` for 1.x `initialValue`). The
   helper form lowered cleanly every time. The direct async form was refused at 6 of 11 sites (`[SUGAR_CALLBACK]` for a
   call on `(await SDK).units.where(…)`, repro `async-memo-await-member`); binding `const sdk = await SDK` first fixed all 6.
   The memo bodies are now accepted, but the colours are not what I expected: (a) with the app's original `strict: false`,
   every async memo got `[generated] [FAILURE_CLASS] declare a failure class with class Boom extends Failure(` and fetch
   failures were inferred as `ChunkError | any` (ChunkError should need `"use server"`); with `strictNullChecks` they become
   `TypeError | DOMException` (repro `async-memo-no-failure`, `route-root-errored`). (b) A failing async memo producer is
   reported as `[NATIVE_CALLBACK_FAILURE] Catch the failure inside this callback` at its `await` (civs/[slug]:23,
   patches/[id]:23, versus:31) instead of being a failure of the memo's readers. (c) Pending was inferred as expected: no
   `PENDING_ROOT` anywhere; every resource read I put under `<Loading>` (the 1.x Suspense sites plus the places 1.x rendered
   `undefined` while loading) was accepted, and `loadingValue` was understood (PatchHistory had no pending complaint).
2. **Router 2.0.0-next.29.** The router has no `<Router>`/`<Route>`/`<A>` any more: `createRouter({ routes: defineRoutes([...]) })`,
   a render-prop child for the layout, plain `<a>` claimed by the router (`data-active`, `aria-current`). The checker treats
   `createRouter` as a foreign JSX boundary (warning) only when the instance is created at module level; created inside a
   factory function it is silent, but route `component:` values are still checked as handoffs either way. Problems:
   every route component calls a router hook in setup (`useParams`, `useLocation`, `useNavigate`, `useSearchParams`,
   `useIsRouting`) and each such call is an error, `[NATIVE_SETUP_FAILURE] Move this throw into a memo … the component body
   only creates state` (26 sites; opaque package call = unknown failure). An `<Errored>`/`<Loading>` around `{route.children}`
   in the router's render prop is not credited (repro `route-root-errored`), although F-S43 credits providers placed there.
   The accessor hooks cannot be called at all: `useMatch(() => props.href)` is refused (`SUGAR_CALLBACK`) and
   `useMatch(memo)` fails `TS2345 Source<string> is not assignable to () => string` (repro `router-hook-accessor`), so the app
   styles anchors with the router's own `aria-current`/`data-active` attributes. A redirect route returning `null` is refused
   (`SUGAR_COMPONENT`/`SUGAR_ESCAPE`). Lazy routes (`lazy(() => import(...))` from solid-js) passed without comment. The final run has
   4 `FOREIGN_HANDOFF`s and none is at a router boundary: the dev entry `render` ("Fix the earlier errors in this component
   before checking its render call. Remaining: any" - so the handoff check never got to the routes), two `<ItemPage…>`
   children, and the `<i>` inside `Icon` (an unknown failure widened through Tooltip → Portal props) - not where a reader
   would put an `Errored`.
3. **Performance.** One whole-project lowering pass on ~100 files takes 40-100 s (170 s while other agents loaded the box);
   a lone 1-component file takes 4-6 s, QuickNav alone 18 s. The CLI discovers refusals **one per pass** and re-lowers
   the whole project after each (service.cjs `while (pending.size)`), so the first complete run after migration needed
   25 passes, 22.5 min, before TypeScript started (`aoe4-explorer-lowering-timeline-run1.log`); my first attempt was killed
   at 15 min. The final run needed 6 passes (5 refusals left), 648 s in total: ~10.5 min lowering (last pass 172 s) and ~16 s of TypeScript. The CLI also re-reads sources on every per-file
   diagnostics call: editing any file mid-run restarted the whole loop. The Vite plugin re-lowers the project on a cold build
   (plain build 5 s, solid-yield build 2m38-2m50). Whole-project lowering is not usable interactively at this size; it is
   usable as a nightly job only once refusals are gone.
4. **Tailwind / classList / attributes.** `classList` → `class={[…, { … }]}` (7 sites) lowered without complaint, including
   space-separated keys. Trouble came from elsewhere in the JSX surface: `ref` inside `<Show>`/`<For>`/`<Loading>` children
   is refused with the wrong code and no position (`NATIVE_HANDLER` at 1:1, repro `ref-in-show`); the documented
   `let el; ref={el}` form is mis-lowered into a call of `el` (repro `ref-variable-lowering`); JSX spreads and `omit` are
   refused (F-S24, no lowering for `omit`/`merge`); member-expression tags (`<ItemPage.Header>`, `<TableOfContents.Provider>`)
   are refused as `[COMPONENT_TAG] call a yield component in a hole: {yield* Comp(props)}` (library-dialect advice);
   valueless attributes (`noscroll`) and Tailwind arbitrary variants (`aria-[current=page]:…`, `data-[active]:…`) were fine.
   One `[…].join("/")` href inside a row made the lowering emit unparsable code (`BABEL_PARSE_ERROR`, Toolbar).

## 2. Setup friction

| # | Snag | Fix |
| --- | --- | --- |
| S1 | Brief's data build (`cd data && yarn install`) is unnecessary: `data/src/sdk` imports only JSON + local TS; data's deps are parser tooling. | Skipped. Solid 1 worktree used yarn 1 (`--registry https://registry.npmjs.org`), `data` symlinked; main copy pnpm. |
| S2 | `prebuild` (`generateMaps.js`) fetches aoe4world.com (blocked). | Skipped; `src/data/maps.ts` is committed. |
| S3 | TS 6 deprecates `baseUrl`; the CLI reports TS5101 as a config error (exit 1). | Removed `baseUrl`; one bare `src/types/patches` import made relative. |
| S4 | TS 6 defaults to `strict: true`; the app is non-strict (TS 5.9: 7 errors, strict: 200). With `strict: false` the checker is silently wrong: spurious `[FAILURE_CLASS]` on every async memo, `ChunkError | any` failures, and 384 `[UNDECLARED_PROP]` errors from D-119 widening. | Final config `strict: false` + `strictNullChecks` + `strictFunctionTypes` (bisected: those two are what the checker needs). Cost: 93 plain TS errors from legacy null handling. README should state the requirement. |
| S5 | `pnpm exec solid-yield …` prepends pnpm's install check ("Lockfile passes supply-chain policies …") to the output. | Ran `node node_modules/ts-plugin-solid-yield/src/cli.cjs check .` for timings. |
| S6 | The CLI re-reads files per diagnostics call; editing during a run restarts all passes (seen at 16:00:39 in run 1). | Do not edit while checking. |
| S7 | vite-plugin-solid-yield throws `NativeDiagnosticError` for any transform-level error in the selection (MODULE_STATE, CATCH_SWALLOWS, refusals), even in lazy chunks unrelated to the page. | `YIELD_EXCLUDE` predicate in `vite.config.mts`; the Vite and TS selections then differ, against the README's advice. |
| S8 | Vite 8 warns on `__dirname` / ESM in `.ts` config (not solid-yield). | `vite.config.mts`, `import.meta.dirname`. |
| S9 | Diagnosing refusals needed my own harness (`lower.cjs`, a subset `lowerNativeProject` loop) and a probe `tsconfig`; a subset makes unselected imports foreign, which itself creates refusals (`usePageMeta` from an unselected App.tsx → `SUGAR_CALLBACK`). | Repros run through the CLI with their own tsconfig. |
| S10 | (My mistake) a broad `pkill -f "cli.cjs check"` at ~16:00 may have killed another agent's checker run on this shared box. | Used PIDs afterwards. |

## 3. Diagnostic log

Verdicts: C = correct, FP = false positive, RV = refused valid Solid 2, UC = unsupported construct (documented),
UM = unclear message, IE = internal error (lowering emitted invalid code). Counts are sites in the app.

| Code | file:line (examples) | n | Verdict | Actionable? | Change |
| --- | --- | ---: | --- | --- | --- |
| NATIVE_API createResource/on/onMount/…, NATIVE_EFFECT_PHASES (unmigrated run) | before-run | 80 | C | yes: names the 1.x API | the migration itself |
| TS2345 effect phase returns non-function (`() => setShow(false)`) | QuickNav:42, Search:84 | 2 | C (plain TS) | yes | block bodies. Real runtime crash `E is not a function` in plain Solid 2. |
| TS2322 `aria-expanded={bool}`, `colSpan` | SidebarNav, TwitchQuiz | 2 | C (Solid 2 JSX types) | yes | `"true"/"false"`, `colspan` |
| NATIVE_API `omit` / NATIVE_SPREAD | CivFlag, ItemIcon, Link | 6 | RV (UC, F-S24; omit/merge unmapped) | partly | explicit props, no spread |
| NATIVE_API `snapshot` | TwitchQuiz | 1 | RV | yes | shallow copy |
| NATIVE_THROW literal throw | query/content.ts:46 | 1 | UC (documented) | yes | `throw new Error(…)` |
| NATIVE_HANDLER ref inside Show/For/Loading | Toolbar, QuickNav, Search, Stats ×8, buildings/[id] ×2, TechnologySelector, TwitchQuiz | 15 | RV, UM (wrong code, 1:1) | no | moved refs to own components / nested tooltips |
| NATIVE_HANDLER `ref={props.ref}` | NavLink | 1 | RV | no | removed |
| SUGAR_RETURN row ternary / `cond && <x/>` / `return null` | Cards, SidebarNav, QuickNav, 5 route rows, Stats, questions, BattleReportView | 14 | RV, UM (often `undefined:undefined`) | partly | `<Show>` rows, `<></>` |
| SUGAR_COMPONENT lowercase JSX helper | BattleReportView, questions ×2 | 3 | RV; doc says helpers are unaffected | yes | PascalCase components |
| SUGAR_CALLBACK event read in prop call | ToggleSwitch:14, UnitSelector:16 | 2 | RV (F-S19 area), UM (at component) | no | local first |
| SUGAR_CALLBACK router accessor hooks | Nav:5, NavLink | 2 | RV; memo alternative TS2345 | no | aria-current/data-active styling |
| SUGAR_CALLBACK `createSignal(() => props.x)` | SidebarNav:120 | 1 | RV (writable derived signal) | no | override signal + effect |
| SUGAR_CALLBACK context value method reads/writes | TableOfContents:24/29 | 2 | RV (also masked a real bug, §4) | no | setter + plain registry in context |
| SUGAR_CALLBACK callback to local hook | SoloQuiz:38, TwitchQuiz | 2 | RV | no | memo passed; still SUGAR_ESCAPE (below) |
| SUGAR_CALLBACK `(await x).y()` in async memo | buildings, units, technologies, civs, patches ×2 | 6 | RV, UM (at component) | no | `const sdk = await SDK` |
| SUGAR_CALLBACK plain options param read | index.tsx:34 | 1 | RV, UM | no | **left** (public API) |
| SUGAR_CALLBACK `.filter(cb)` reading props in local helper | patches/[id]:196 | 1 | RV | no | hoisted read |
| SUGAR_CALLBACK Twitch chat listener via helper | TwitchQuiz:74 | 1 | RV | no | **left** |
| SUGAR_READ_ARGS accessor as effect compute / indexed memo / function prop args | QuickNav:15, BattleReportView:67 | 3 | RV, UM | no | arrows, Switch; QuickNav and BattleReportView **left** (QuickNav: section bisection did not isolate it) |
| SUGAR_ESCAPE null-returning route / listener routine / context named fn / helper arg | routes:49, Tooltip:15, SidebarNav:128, SoloQuiz:40 | 4 | RV | partly | `<></>`, listeners in onSettled, memos+setter; SoloQuiz **left** |
| SUGAR_HOST onCleanup in async fn; local fn param call in async helper | TwitchQuiz:524, RelatedContent:104 | 2 | RV | yes | sync wrapper; helper restructure |
| BABEL_PARSE_ERROR (`yield` outside generator / bad token) | PatchHistory:18, Toolbar:68, UnitSelector:31, TechnologySelector ×2, SidebarNav:145 | 6 | IE | no | inlined named handlers, template href, derived slice |
| CATCH_SWALLOWS log-and-fallback / retry catches | questions:97,180, RelatedContent:107 | 3 | FP (they recover) | yes | catches return fallbacks |
| MODULE_STATE module signals (Solid's cheatsheet idiom for app-wide state) | global.tsx ×4 (App.tsx moved there) | 4 | RV by design | yes | **left**; blocks the Vite build |
| *Final run (all left as is)* | | | | | |
| NATIVE_SETUP_FAILURE router hook in setup (`useParams`/`useLocation`/`useNavigate`/`useSearchParams`) | App:51, routes.tsx:19/25/37, every route | 26 | RV (opaque package call = may throw) | no: hooks must be called in setup | **left**; needs package contracts |
| SETTLED_PROP value from a tuple-destructured `<For>` row or keyed `<Show>` param passed as a prop | units/[id] ×10, patches/[id] ×4, buildings/[id] ×3, Nav:42 `([href, label]) => <MenuLink href={href}>`, SidebarNav:46/62, Tooltip:30 | 27 | RV, UM (plain values treated as pending sources) | no | **left** |
| GENERATED_TYPE + plain TS errors only in generated code (`Path<Item[]>` has no `reduce`, `Read<false, never>` vs `string`, `Source<…>`) | versus ×5, Stats ×4, patches/[id] ×3, SidebarNav ×3, … | 36 + 159 | UM; two clusters predicted real yield-runtime crashes (§5) | no | **left** |
| COMPONENT_TAG (after named imports) at the component name, tag not named | buildings/[id]:26/145, units/[id]:20/95, technologies/[id]:18 | 5 | UM | no | **left** |
| LAZY_VIEW `fallback is a lazy view: function* () { return <.../>; }` at the component name | buildings, units, technologies, content, patches/[id]:192 | 5 | UM (library-dialect text, no position) | no | **left** |
| EVENT_REJECTS handler can fail with unknown (`navigate`, `clipboard`, async quiz actions) | Search:121, TechnologySelector:94, TwitchGiveaway ×2, quiz/twitch | 5 | C by contract, noisy in practice (`navigate` cannot reject) | yes | **left** (no blanket try/catch, per brief) |
| FOREIGN_HANDOFF | Icon.tsx:3:113, ItemPage:54/88, dev.tsx:24 ("Fix the earlier errors … Remaining: any") | 4 | UM: reported at the leaf `<i>` in Icon via prop widening through Tooltip → Portal, not at the boundary | no | **left** |
| NATIVE_CALLBACK_FAILURE `Catch the failure inside this callback` at `await` in an async memo | civs/[slug]:23, patches/[id]:23, versus:31 | 3 | FP (memo failures belong to readers / Errored) | no | **left** |
| READ_IN_SETUP | App:95 (`const errPath = location.pathname`, an intentional snapshot), patches/[id]:256 (`props.id.split`) | 2 | C | yes | **left** |
| WRITE_IN_REACTIVE `onRestart={() => setShow(false)}` | quiz/twitch:240 | 1 | FP (event prop of a child, cascade) | no | **left** |
| ROW_SETUP_OP `a row routine` | Cards:23 (component name) | 1 | UM | no | **left** |
| UNDECLARED_PROP (first run, `strict: false`) | every component taking props | 384 | config-dependent FP (gone with `strictFunctionTypes`) | no | tsconfig flags (S4) |

Totals: the rows above the final run cover 165 sites (80 = the unmigrated 1.x API report); of the other 85, 76 were
rewritten and 9 left (5 refusals, 4 MODULE_STATE). Checker-driven rewrites: 3 commits, 39 `src` files, 821+/670- lines,
on top of the mechanical migration (51 files, 1026+/972-). Verdicts over the whole log: C 86 (+5 EVENT_REJECTS correct by
contract), FP 7 (+384 config-dependent UNDECLARED_PROP), RV 124, UC 1, IE 6, and UM for 210 of the final run's 344 errors
(generated-type, COMPONENT_TAG, LAZY_VIEW, FOREIGN_HANDOFF, ROW_SETUP_OP). Final run: 344 errors in 51 files.

## 4. Missed bugs (false negatives)

Found by building and running plain Solid 2, not by the checker:

1. **`{n && <JSX/>}` renders "0".** Solid 2's compiler keeps JS `&&` semantics (`c() ? <jsx> : value`); Solid 1 coerced to
   boolean. Snapshot diff: "1.688T/S0", "700" instead of "70" in 17 Stats/quiz spots. Fixed with `!!(…)`. Neither TS nor the
   checker says anything (arguably out of scope, but it is the most visible Solid 1→2 regression in this app).
2. **Read-after-write within a flush (TableOfContents).** `add()` did `setHeadings(headings().concat(h))` for 29 anchors in one
   flush; Solid 2 returns the committed value until flush, so only the last heading survived (patch page "Jump to": 1 of 29).
   The checker did refuse this file, but for an unrelated reason (`SUGAR_CALLBACK`, context member host); after the
   restructure the bug was gone too, so it neither found nor explained it.
3. **Effect phase returning a non-function** (`createEffect(current, () => setShow(false))`) - runtime `E is not a function`,
   `REACTIVITY_HALTED`, client navigation dead. Plain `tsc` caught it (TS2345 against `EffectFunction`), so the checker's
   TypeScript pass would too; listed because it is a Solid 2 hazard the migration notes should mention.

## 5. Strict-subset results

No file with zero checker errors failed in plain Solid 2. Under vite-plugin-solid-yield (14 files excluded so the build
completes, `/tmp/…/yield-exclude.txt` list: global.tsx, index.tsx, QuickNav.tsx, all quiz files) the app built but:

- Build 1 (before the workarounds below): every page crashed. `TypeError: resetFocusEl is not a function` /
  `aboutEl is not a function`: the documented ref form `let el; <div ref={el}/>` is lowered to
  `ref={__nativeCallback($event(function* (...args) { return el(...args) }))}` - the element is *called*, nothing assigns it,
  and the bundler then deletes `if (el) el.focus()` from the App effect (`function* () {}`). `TypeError: Cannot read
  properties of undefined (reading 'next')` in `drive`: a named function as effect phase (`createEffect(() => activePage(),
  applyDocumentMeta)`) is passed through unlowered. The checker did report errors at these files, but only as
  `[generated] TS2349 This expression is not callable. Type 'HTMLDivElement' has no call signatures` (+ TS2488, TS2722) at
  the component name and `[GENERATED_TYPE]` - nothing says "ref". Not a subset violation, a message problem (repro
  `ref-variable-lowering`).
- Build 2 (callback refs, block-bodied effect phases): no console errors, but the root `Errored` shows
  `TypeError: n.patch.date.valueOf is not a function` (PatchHistory on unit pages: a row's `history.patch.date` is no longer
  a Date after lowering) and `Cannot read properties of undefined (reading 'value')` on the home page. The checker flags
  PatchHistory with raw TS errors at exactly these reads: `PatchHistory.tsx:29:20 TS2365 Operator '>' cannot be applied to
  types 'Object' and 'number'`, `TS2367 … 'Read<false, never>' and 'string' have no overlap` (tuple-destructured row
  `([type, change, civs])`), `TS2339 Property 'map' does not exist on type 'Read<false, never>'`. So again caught, but as
  unexplained generated-type errors on valid code.
- Checker-clean selection: `YIELD_EXCLUDE` = all 51 files with any checker error (`yield-exclude-clean.txt` in my
  scratchpad), so the plugin lowered the remaining 55 files (34 components) and kept the rest plain Solid 2. Built in
  27.6 s (plugin transform 23.9 s of it), **7/7 flows pass, 12/12 steps identical** to Solid 1 and to plain Solid 2,
  no console errors. **No strict-subset violation found**: every runtime failure under the yield build was in a file the
  checker did not pass. The weak point is the opposite direction: 51 of 106 files fail, mostly with errors on valid code.

## 6. Solid 2 / ecosystem blockers (not solid-yield)

- Router 2 removes `<A>`/`<Router>`/`<Route>`; `A href="./units/x"` was route-relative (Solid 1 rendered
  `/civs/english/./units/king`), plain anchors resolve against the document URL → rewrote 3 links as absolute; `activeClass`/
  `end` → `useLinkState` or `data-active`/`aria-current` (Tailwind `data-[active]:` / `aria-[current=page]:` variants work).
- Writes from component bodies throw (`setActivePage(…)` in 6 route bodies, `tempHideNav` writing in the body + onCleanup)
  → effect phase / `onSettled` with returned cleanup. Ref callbacks run unowned, so `onCleanup` inside them (Tooltip/QuickNav
  positioning) moved into child components with `onSettled`.
- Boolean attributes are presence/absence (`aria-expanded`), lowercase attributes (`tabindex`, `colspan`).
- `ComponentProps<"img">` from `solid-js` is `never` for intrinsic tags; `@solidjs/web` exports the working one.
- 1.x `createResource(src, fn)` with a falsy source did not fetch; in Solid 2 the memo must guard explicitly. `refetch` →
  `refresh(memo)` is silent (no fallback, no `isPending`), so the quiz's "Loading question..." on refetch is gone.
- 1.x `createResource(params.id, …)` (value source) / fetcher-only resources were not reactive to param changes; the memos
  are (navigating patch→patch now updates pagination - a behaviour fix).
- Vite 8 `manualChunks` puts the Solid runtime into the `quiz` chunk (cosmetic).

## 7. Recommendations (ranked)

1. **State the TypeScript requirements and check them** (new). `strictNullChecks` + `strictFunctionTypes` change the
   results drastically (FAILURE_CLASS on every async memo, ChunkError, 384 UNDECLARED_PROP). Refuse to run, or warn, when
   they are off. Evidence: S4, repros `async-memo-no-failure`, `undeclared-prop`.
2. **Report all refusals in one pass** (new). Collect refusals per file and continue, instead of throwing and re-lowering
   the project per refusal (service.cjs `while (pending.size)`); 25 passes / 22.5 min on this app. Also snapshot sources
   once per CLI run. Evidence: §1 q3, timeline log.
3. **Lower `let el; ref={el}` as an assignment, and refs inside control flow** (new). It is Solid's primary ref form; today
   it is either refused with `NATIVE_HANDLER` at 1:1 or turned into a call. Repros `ref-in-show`, `ref-variable-lowering`.
4. **Fix the lowering crashes** (new): named handlers called from events (`handler-in-row-yield`), keyed-Show + `.slice()`
   (`yield-parse-error`), the Toolbar `[...].join` row. A `BABEL_PARSE_ERROR` with an intermediate `(40:90)` is never
   actionable.
5. **Package hook contracts for @solidjs/router** (open question 4 in sugar-design). Router hooks in setup make every route
   an error (26 NATIVE_SETUP_FAILURE), `navigate` in events adds `EVENT_REJECTS`, and accessor hooks are unusable.
   Credit `<Errored>/<Loading>` around the router's render-prop children like F-S43 credits providers.
6. **Support the common JSX/rows idioms**: ternary and `&&` rows (`row-ternary-return`), components returning `null`,
   member-expression tags, lowercase JSX helpers (or fix sugar-design.md, which says they are unaffected), indexed memo
   reads (`indexed-by-signal`), function props called with arguments (`function-prop-args`), accessor as effect compute
   (`source-as-effect-compute`), `createSignal(fn)` (`writable-derived-signal`), `omit`/`merge`/`snapshot`/`untrack`.
7. **Messages for native authors**: never print library-dialect advice (`{yield* Comp(props)}`, `class Boom extends
   Failure(`, `function* () { return <.../> }`), never `undefined:undefined`, never the component name when the construct
   has a position; `[ROW_SETUP_OP] a row routine` is not a sentence.
8. **CATCH_SWALLOWS**: accept a catch that assigns a fallback to a variable or continues a retry loop (3 FPs here).
9. **MODULE_STATE**: Solid 2's own cheatsheet recommends module signals for app-wide state; as an error it blocks the
   Vite build. Make it a warning (it already keeps the state foreign).

## 8. Repros

`/home/user/migrations/feedback/aoe4-explorer-repros/` - one directory per finding, each with a `README.md` (command,
input, expected, actual) and a `tsconfig.json` that resolves Solid from the app's `node_modules`:
`ref-in-show`, `ref-variable-lowering`, `row-ternary-return`, `lowercase-jsx-helper`, `event-read-in-prop-call`,
`options-param-read`, `async-memo-await-member`, `async-memo-no-failure`, `route-root-errored`, `yield-parse-error`,
`handler-in-row-yield`, `router-hook-accessor`, `null-return-route`, `listener-routine`, `function-prop-args`,
`writable-derived-signal`, `context-method-read`, `literal-throw` (known, NATIVE_THROW), `source-as-effect-compute`,
`indexed-by-signal`, `undeclared-prop`.
