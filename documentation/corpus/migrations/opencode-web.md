> Agent report from the 2026-10-10 migration trial ([summary](README.md)), unchanged. Paths under `/home/user/migrations/` are the session's working copies; the repros are in [`repros/opencode-web/`](repros/opencode-web) and the final checker output in [`checks/`](checks). Its `jsx-iife-read-in-view` repro contained the app's own code and is replaced here by `jsx-iife-read-in-view-min`.

# opencode-web (bjesus/opencode-web) → Solid 2, verified with solid-yield native mode

Copy: `/home/user/migrations/opencode-web`, branch `solid2-migration` (base 7205e20, local commits 3ed4c27…a5a3176).
Solid 1 baseline worktree: `/home/user/migrations/opencode-web-solid1`. Verifier: sy-verifier @ 31695cb (packs).
Artifacts: `opencode-web-check.txt` (final checker output), `opencode-web-diffstat.txt`,
`opencode-web-e2e/<build>/` (DOM snapshots + results.json per build), `opencode-web-logs/` (checker runs on the Solid 1 source, the
first working migration and two abandoned variants; the @tanstack/solid-virtual build error), `opencode-web-repros/` (one dir per repro, `runtime-harness.mjs` for the runtime ones).

## 1. Outcome

| | result |
| --- | --- |
| Files migrated | 13/13 source files (8 .tsx, 5 .ts) + 3 new (`lib/virtualizer.ts`, `stores/client.ts`, `stores/connection.ts`). `server/proxy.ts` untouched. |
| Checker errors | **32** on the unmodified Solid 1 source → **28** on the first working plain-Solid-2 migration (fe21177, 59/59 flows) → **7** final (a5a3176) |
| How the 28 became 7 | 13 src files, +504/−451 lines of checker-driven rewrites on top of the working migration (+264/−139). Includes 5 `@yield-absorb` comments and leaving `src/stores/**` out of the native selection (both "had to", §3). |
| Plain Solid 2 build + run | builds; **59/59** flow checks prod, **59/59 dev with 0 console warnings** (the first virtualizer port needed `untrack` for that, §6; the final adapter needs none) |
| vite-plugin-solid-yield build + run | builds only once every TS95000 diagnostic is gone (they all block the Vite build, §2). **56/59 prod** (3 send checks: writes held, §5.1); **54/59 dev** (+2 virtual-list checks, SETTER_OUTSIDE_RUN, §5.3) |
| DOM vs baseline | plain vs yield final snapshots identical after attribute/style normalisation; Solid 1 vs plain differ only in the virtualizer's total height after a streamed message (577 vs 600 px), a timing effect of an original bug (§4) |
| Flows (Playwright, mock `opencode serve`) | load (list sorted, first session opened, markdown/tool parts/footer, model/agent pickers), open session (+error alert, +empty session), stream (SSE parts arrive incrementally, ≥4 distinct partial texts), send (prompt body, pending UI, streamed reply), create + rename, settings dialog, 120-message virtualised session |
| Time (rough) | baseline + mock server + flows 1 h; plain migration 1 h; checker iteration and probes 3.5 h; yield runtime runs, repros, report 2 h |

The Solid 1 original was built and driven unchanged (59/59 on the same flows; `opencode-web-e2e/solid1`).

### The four assigned questions, short answers

1. **@tanstack/solid-virtual (dependency not ready).** Plain Solid 2: the build fails at resolution,
   `"./store" is not exported … from package …/solid-js` (`opencode-web-logs/plain-build-solid-virtual.txt`); it also
   imports `createComputed`, `mergeProps`, `onMount`. pnpm only warns (`unmet peer solid-js@^1.3.0: found 2.0.0-rc.13`) and
   wires it to Solid 2 anyway; latest 3.13.41 has the same peer range and imports. Checker: the package is foreign and never
   inspected, so nothing says it is Solid-1-only. Its documented usage is refused: `get count() { return items().length }`
   in the options → `SUGAR_HOST Reactive operations in async functions or methods are unsupported` (repro getter-option).
   With a static count, the call itself → `NATIVE_SETUP_FAILURE` (opaque factory in a component body = `unknown`), and
   `ref={scrollRef}` → a crash (§3). The yield Vite build fails on the same resolve error. **What I did:** replaced it with a
   local adapter over `@tanstack/virtual-core@3.13.12` (framework-agnostic, no peer). The straight port (merge, reconcile,
   createEffect for createComputed, onSettled, untrack) worked in plain Solid 2 but was refused (`NATIVE_API` ×3). The final
   91-line adapter has a different API: keys pushed from the caller's effect, the raw setter as `onChange`, `createProjection`
   keyed by index. 5 of the 7 final checker errors come from it (`unknown` failures of opaque virtual-core calls), and under the
   yield dev runtime the setter that virtual-core calls from its observers throws (§5.3). The dependency is the single largest cost in this app.
2. **Streaming / SSE state.** Two-argument `createEffect`: caught on the Solid 1 source (`NATIVE_EFFECT_PHASES` ×3, correct).
   Writes in owned scope: none existed after migration (SSE writes run in async continuations, effect apply phases and events;
   the Solid 2 dev runtime agreed: no owned-write errors). The checker reported one false WRITE_IN_REACTIVE in the app (a callback
   prop; a second in a probe) and no true ones. The streaming path itself could not be checked: module-level stores → `MODULE_STATE` (blocks the build);
   `for await` with state writes → internal `BABEL_PARSE_ERROR`; the reconnect loop started from `onSettled` → `GENERATED_TYPE`,
   then `ASYNC_NOT_ALLOWED` at run time; a writing callback handed to a package → `SUGAR_ESCAPE`. Final app: the stores and
   the SSE loop (`stores/connection.ts`) are unselected, so **no line of the streaming path is checked**. The Solid 2 hazard that
   matters here, store reads not seeing writes until flush (and path setters throwing `fn is not a function`), is not flagged (§4).
3. **Failures inferred from SDK calls.** Every `@opencode-ai/sdk` call is `unknown` (opaque package). Inference is useful where
   the code is local: `fetch` → `TypeError | DOMException`, `JSON.parse` → `SyntaxError`, `throw new Error` → `Error`
   (router probe). In this app `unknown` added no information (every handler already caught) and a lot of noise:
   every opaque call in a component body or a frame/observer callback is an error (`NATIVE_SETUP_FAILURE`,
   `NATIVE_CALLBACK_FAILURE` ×4 remain in the final output), and reads of unselected module state make the root
   `FOREIGN_HANDOFF … Remaining: any`. Worse, `await props.api.session.x()` is mis-lowered: the await and the attempt
   disappear, so an uncaught rejection is **not** reported (false negative, repro prop-method-await). An async memo with a
   catch that returns a fallback was accepted cleanly (MessageInput `catalog`).
4. **Router 2.0.0-next.29 and root diagnostics.** The app declares the router but never imports it (upgraded, no code change).
   Root: `index.tsx render(() => <App/>)` ends as `App.tsx:18:7 [FOREIGN_HANDOFF] Fix the earlier errors in this component
   before checking its render call. Remaining: any.`, pointing at a `saveConfig` call in an effect. Not actionable.
   In a Router 2.0 probe (`createRouter`/`defineRoute`, session page with an async memo; repro router-root-probe):
   FOREIGN_HANDOFF at the page's read with `Remaining: TypeError | DOMException | Error` and the route as related location
   (good); `PENDING_ROOT` for the same read under a direct `render()` (good); the page's pending state through the route handoff
   is only mentioned in the related note, not reported; `NATIVE_FOREIGN_BOUNDARY` warning on Router (known F-S29 text).

## 2. Setup friction

| snag | fix |
| --- | --- |
| `pnpm` in the app dir is `/opt/node22/bin/pnpm` 10.28.0, not 11 (no `packageManager` field) | worked anyway; `allowBuilds` honoured (esbuild postinstall ran) |
| `solid-js@2.0.0-rc.13` / `@solidjs/vite-plugin@3.0.0-next.47` declare `^2.0.0-rc.13`; a fresh install pulls `@solidjs/signals`, `@solidjs/compiler`, `@solidjs/babel-plugin` **rc.14** | pinned all three to rc.13 in `pnpm-workspace.yaml` overrides (the verifier's own lock has rc.13) |
| `@tailwindcss/vite@4.1.15` peers vite ≤7 | 4.3.3 |
| SDK `^0.15.10`, marked, daisyui float to newer versions than the baseline lock | pinned to the baseline's resolved versions |
| Every TS95000 diagnostic blocks `vite build` in native mode, including `CATCH_SWALLOWS` and `MODULE_STATE`, which read like lint; the plugin reports them as `NativeDiagnosticError` | had to clear all of them to run the yield build at all |
| Vite error header names the wrong file: `[plugin vite-plugin-solid-yield] src/index.tsx:33:52` for a refusal in `SessionList.tsx:33:53` | read the message body |
| No way to see the generated program; `lowerNativeProject` throws on any refusal | wrote a 30-line dump script around `vite-plugin-solid-yield/virtual` + `nativeInclude` |
| `include` has no negation; tsconfig and Vite selections must be kept equal by hand | listed positive globs in both (`src/*.tsx`, `src/api/**`, `src/components/**`, `src/lib/**`) |
| Plain build must not load the yield plugin | `SOLID_YIELD=1` + dynamic import in `vite.config.ts` |
| `pnpm exec solid-yield` fails outside a package (repro dirs) | `./node_modules/.bin/solid-yield` |
| Yield build time | 31.7 s vs 1.0 s plain (`vite-plugin-solid-yield transform` 96 % of it) |

## 3. Diagnostic log

Verdicts: C correct · FP false positive · RV refused valid Solid 2 · U unsupported construct · M unclear/misplaced message.
"Act." = could I act on the message alone. Positions are the copy's at the time.

| code | file:line (count) | verdict | act. | change |
| --- | --- | --- | --- | --- |
| NATIVE_EFFECT_PHASES | ChatView 39, MessageInput 73, config.ts 48 (3) | C | yes | two-phase effects |
| NATIVE_API onMount | App 1, ChatView 1, MessageInput 1 (3) | C (gone in Solid 2) | partly: no "use onSettled" | onSettled |
| TS2307 `solid-js/store`, TS7006 (6) | session.ts | C (plain TS) | yes | import from `solid-js` |
| CATCH_SWALLOWS | sse.ts:43 (1) | C: hid stream errors from the reconnect/backoff loop | yes | removed the catch |
| NATIVE_COMPONENT | ChatView:54 Row (1) | RV (known, documented) | yes | Row at module level |
| TS2571 / TS2339 on `any` props and For items | MessageItem (10), later Settings, ChatView Row | FP, new (repro any-typed-props) | no | SDK types instead of `any` |
| SUGAR_READ_ARGS | SessionList:27 `props.api.session.create` (1) | FP/refusal, new (prop-method-await) | no | client via module signal |
| NATIVE_HANDLER `onClick={props.onClose}` | Settings:137 (1) | RV | yes | `() => props.onClose()` |
| SUGAR_CALLBACK `[generated]` at 1:1 | Markdown.tsx (1) | FP+M, new (try-catch-makes-routine): non-reactive callback with try/catch | no | dropped the try/catch (in dead code: marked 16 ignores `highlight`) |
| MODULE_STATE | session.ts ×5, config.ts ×1 (6) | RV (known F-S31). Solid's cheatsheet recommends module state for app-wide state; the diagnostic blocks the build | partly | **had to** leave `src/stores/**` unselected ("keep it foreign") |
| TRANSFORM "catch crossing a loop/label" at App.tsx:1:1 | (1) | U (known F-S21), M: code/position lost (doc says NATIVE_CONTROL_TRANSFER) | partly | loop body → `connectOnce()` returning "stop"/"retry" |
| BABEL_PARSE_ERROR `Unexpected reserved word 'yield'` | ChatView:32 (1) | internal error, new (prop-call-in-frame-callback) | no | `observeRow(el, props.measure)` helper |
| BABEL_PARSE_ERROR `expected "("` | probe of the SSE loop (for await) | internal error, new (for-await-parse-error) | no | loop kept unselected |
| NATIVE_API untrack / merge / reconcile | Settings, virtualizer (4) | RV (core Solid 2 APIs outside the native line) | yes | draft-signal pattern; adapter rewritten |
| SUGAR_ESCAPE factory/provider routines | context variant: config/session factories, provider object (3+) | RV, new-ish | partly | abandoned the context variant |
| SUGAR_ESCAPE `onChange` closure → package | virtualizer:68 (1) | RV | yes | raw setter as callback (→ §5.3) |
| SUGAR_CALLBACK returned closures `getTotalSize: () => totalSize()` | virtualizer:79 (1) | RV | partly | return the memo/projection |
| SUGAR_CALLBACK `providers().find(p => p.id === selectedProvider())` | MessageInput:141 (1, first reported at handleSend 99:9 `[generated]`) | FP | no | read the signal before `find` |
| SUGAR_HOST | SessionList:33 prop read after module-state ops in async handler (1); context member in async handler (probe) | RV, new (context-member-async) | no | client moved to module signal |
| STREAM_IN_EVENT "a stream is consumed in a reactive routine" | config.ts:46 `createSignal(loadConfig())` (1) | FP+M (try/catch made `loadConfig` a generator) | no | gone once stores unselected |
| CATCH_SWALLOWS (SyntaxError) | config.ts:31 (1) | FP: fallback assigned before the try | yes | catch returns the fallback |
| CATCH_SWALLOWS logging-only | SessionList ×4, App ×1, MessageInput ×1 (6) | 4 C (silent select/rename/delete/load failures), 2 FP (`alert` informs the user) | yes | **had to** add 5 `@yield-absorb` (original UX is log-and-continue); the 6th became a memo returning a fallback |
| WRITE_IN_REACTIVE callback prop `onClose={() => setShowSettings(false)}` | App:323 (1) | FP | no | disappeared after the Settings fix |
| GENERATED_TYPE at `onSettled(` | App:180, MessageInput:57 (2) | C in effect (it crashes at run time), M: no hint that effects may not wait | no | loader → async memo; loop → unselected module (repro async-start-in-onsettled) |
| SETTLED_PROP `measure={(el) => v.measureElement(el)}` | ChatView:154 (1) | FP | no | pass the method value |
| TS1345 `[generated] void cannot be tested for truthiness` | ChatView:66 (1) | FP (expression-bodied effect apply) | no | block body |
| TS2554 `createSignal<T>()` / TS2345 function-form createSignal | Settings:20/22/21/77 (4) | U | no | `createSignal<T \| undefined>(undefined)` + draft pattern |
| TS2339 `charAt` on `Source<…>` (primitive For item) | Settings:107 (2) | RV; crashes at run time under yield | no | `themeLabel(theme)` helper |
| TS2339 narrowing lost (`info.error`, `tokens`) | MessageItem:16/148 (2) | FP | no | `errorOf(info)` / `tokensOf(info)` helpers |
| TS2322 literal widened (`type: "text"` → string) | MessageInput:88 (1) | FP | no | `"text" as const` |
| TS6133 `'e'` unused catch binding | Settings:52 (1) | FP (generated `const e`) | yes | `catch {}` |
| TS2349/TS2722/TS2488/TS2322 on `ref={el}` (let) | MessageInput:11/201 (4) | RV; crashes at run time under yield | partly | removed the dead ref; ChatView uses `ref={(el) => (scrollRef = el)}` |
| TS6133 (dead code) / TS2353 `messageID` | SessionList, Settings (3) | C (plain tsc too; pre-existing) | yes | removed dead code; typed the fork body (request unchanged) |
| NATIVE_CALLBACK_FAILURE | ChatView:14/16/106/108 (4) **remaining** | noise: `unknown` from opaque virtual-core calls / a function parameter in rAF/RO callbacks | no | left (a catch-all try/catch would be gaming) |
| NATIVE_SETUP_FAILURE "Move this throw…" | ChatView:81 `createVirtualizer(...)` (1) **remaining** | noise + M (no throw exists; suggests `attempt`, unavailable to native code) | no | left |
| GENERATED_TYPE Row → MessageItem `message` | ChatView:61 (1) **remaining** | FP (D-119 widening does not follow a forwarded prop) | no | left |
| FOREIGN_HANDOFF `Remaining: any` | App:18 (1) **remaining** | derived, M | no | left |

Counts over the whole run (diagnostic instances in the app, from the table): 83 = C 22 · FP 25 · RV 24 · U 5 · internal 1
(+1 in a probe) · noise 5 · derived 1. Actionable from the message alone ("yes"): 28 of 83; "partly": 18.

## 4. Missed bugs (false negatives)

- **Uncaught SDK rejection not reported** when the call goes through a prop: `const res = await props.api.session.create(...)`
  without a catch gives TS2339 "did you forget to use await" instead of EVENT_REJECTS; the generated handler has neither the
  await nor an attempt (repro prop-method-await/NoCatch.tsx). The same call through a local signal is reported correctly.
- **Stale store reads (Solid 2 semantics).** Store/signal reads return the committed value until flush (`node` probe: a write
  then a read gives `0`, inside a setter `1`), and Solid 1 path setters throw `fn is not a function`. The original
  `updateMessage`/`updatePart` read `messages[sid]` outside the setter and wrote derived arrays; consecutive SSE events before a
  flush would overwrite each other. The path-setter form is a plain TS error (TS2554); the read-then-write form
  (`const l = store.s; setStore(d => { d.s = [...l, m] })`) is accepted silently. I moved all lookups into the draft.
- **`<select value>` with options from `<For>` in the same flush** (Solid 2 compiler/runtime): the value is set (now and in a
  microtask) while the select has 0 options, so the third picker showed `plan` instead of `build` (traced with a setter hook).
  Not a checker concern, but nothing flagged it; fixed with `selected={…}` on each option.
- **Solid 2 dev warnings the checker does not see:** ~915 `STRICT_READ_UNTRACKED` from virtual-core reading reactive options in
  the adapter's effect apply phase and ChatView setup; the fix (`untrack`) is refused by the checker.
- **Inconsistent attempt wrapping:** in ChatView's keys effect the unselected `currentMessages()` used as a `.map` receiver is
  not wrapped in an attempt (its `unknown` disappears), while the same call in the next effect is wrapped.
- Pre-existing app bugs found by tsc/runtime, not the checker: fork sends `messageID` to `session.create` (should be
  `session.fork`); Prism highlighting is dead (marked 16 ignores `highlight`); the virtualizer's `measure()` on every new
  message resets virtual-core's size cache, so rows overlap after streaming in Solid 1 and Solid 2 alike.

## 5. Strict-subset results (most important)

1. **Checker-clean async handler behaves differently under vite-plugin-solid-yield (prod and dev).** Repro
   `event-writes-held`: `0 errors`; plain shows `sending`, clears and disables the input during the await, and a second click
   is ignored (1 send); yield and yield-dev hold `setSending(true)`/`setDraft("")` until the handler settles, so the pending UI
   never shows and **the second click sends again (2 sends)**. Cause: the native lowering maps a plain async handler to a
   `$event`, which is one transaction (D-081). D-081 documents that for the library dialect; native code never asked for a
   transaction, and plain Solid 2 holds writes only inside `action()`. In the app (MessageInput.tsx:86–94, file has 0
   diagnostics) the textarea is neither cleared nor disabled while a prompt is in flight, and a second Enter posts the prompt
   twice (measured: 2 POSTs vs 1). This is the 3 failing send checks in both yield builds.
2. **Checker-clean component crashes the yield dev runtime.** Repro `jsx-iife-read-in-view` (opencode-web's MessageItem,
   unchanged, 0 errors): plain, plain-dev and yield prod render; yield-dev throws `[READ_IN_VIEW] <children>: read outside a JSX
   position` and halts. In the app, the yield dev build loaded nothing (0/7 flows) until the footer IIFE became a helper.
3. **Checker-clean setter handed to a package works in prod, throws in dev.** Repro `setter-handed-to-library` (0 errors):
   plain, plain-dev and yield prod count up; yield-dev throws `SETTER_OUTSIDE_RUN` and stays at 0. The documented
   `nativeWrite` check runs only at run time, only in development. In the app: virtualizer `onChange: notify` called from
   virtual-core's scroll/ResizeObserver handlers; yield-dev's list stopped following scroll (2 virtual checks, 11 page errors).
4. The final DOM after each flow is identical between plain and yield prod; all other run-time differences I hit (`ref={el}`
   crash, primitive `For` item crash, `ASYNC_NOT_ALLOWED` from `onSettled`) were reported by the checker first, as type errors
   or GENERATED_TYPE, so they are message-quality problems, not subset violations.

## 6. Solid 2 / ecosystem blockers (not solid-yield)

- @tanstack/solid-virtual: no Solid 2 release (peer `^1.3.0` up to 3.13.41); uses removed `solid-js/store`, `createComputed`,
  `mergeProps`, `onMount`. Replaced by a local adapter on virtual-core (§1, Q1).
- Straight port needed `untrack` around virtual-core option reads, or Solid 2 dev logs `STRICT_READ_UNTRACKED` ~900 times per run.
- `<select value>` set before `<For>` options exist in the same update (rc.13): wrong selection; workaround `selected` per option.
- Path-style store setters throw `fn is not a function` at run time (rc.13), an unhelpful message for a removed API.
- Module-level `createEffect` works but warns `NO_OWNER_EFFECT`; moved into App.
- @opencode-ai/sdk is fine (plain fetch). `@solidjs/router` 2.0 has a new API (`createRouter`/`defineRoute`; `Router`, `Route`,
  `A` no longer exported); the app does not use it.

## 7. Recommendations for solid-yield (ranked)

1. **Do not give plain async handlers transaction semantics in native mode** (or refuse them with a message that names the
   difference). Evidence: §5.1, repro event-writes-held; MessageInput.tsx:86. New as a native-mode finding (D-081 covers the dialect).
2. **Make dev-only runtime checks static or remove the dev/prod split**: READ_IN_VIEW (§5.2, new) and SETTER_OUTSIDE_RUN
   (§5.3, the nativeWrite contract in sugar-design "Setters in plain function types") pass the checker and only fail in dev.
3. **Treat `void <promise>` and a promise started in `onSettled`/effects as detached work, not a wait**, or report it as
   such. Today: GENERATED_TYPE, then ASYNC_NOT_ALLOWED (repro async-start-in-onsettled). This is the Solid 1 `onMount(async)`
   migration path for every app that loads data or opens a socket on mount.
4. **Fix prop-path lowering of method calls and narrowing**: `await props.x.y()` loses await + attempt (false negative); a
   nullable prop is refused (SUGAR_READ_ARGS); a local alias of a prop stays a path (TS2488 and a false EVENT_REJECTS); narrowing
   on props is lost (repros prop-method-await, valid-solid2-type-errors/f). New.
5. **`try/catch` must not make a function a routine** (SUGAR_ESCAPE / SUGAR_CALLBACK at 1:1 / STREAM_IN_EVENT;
   repro try-catch-makes-routine). New; it blocked a JSON parse helper and a markdown callback.
6. **Support module-level state and app-wide services without forcing them out of the selection.** MODULE_STATE blocks the
   build, contexts with routine members (SUGAR_ESCAPE), stores in typed contexts (NATIVE_TYPE_UNMAPPED + TS2322) and context
   reads in async handlers (SUGAR_HOST, repro context-member-async) are refused, so this app had no checkable state
   architecture. F-S31 is known; the combination is the finding.
7. **Treat `any` as `any`** (repro any-typed-props, new) and **lower primitive `For` items and `ref={let}` correctly** (both
   crash at run time under the plugin; repros valid-solid2-type-errors/c, ref-let-assignment).
8. **Make `unknown` from opaque packages less costly or more honest**: NATIVE_SETUP_FAILURE says "Move this throw" when there
   is no throw and suggests `attempt`, which native code cannot import; consider trusted package summaries (open question 4
   in sugar-design) for SDKs like `@opencode-ai/sdk`.
9. **Messages and positions**: TRANSFORM at 1:1 for F-S21 (doc says NATIVE_CONTROL_TRANSFER); BABEL_PARSE_ERROR with
   intermediate coordinates (repros for-await-parse-error, prop-call-in-frame-callback); SUGAR_HOST says "async functions or
   methods" for a getter (repro getter-option); wrong file in the Vite error header; GENERATED_TYPE without a reason.
10. **Support core Solid 2 APIs the cheatsheet teaches**: `untrack`, `merge`, `reconcile`, function-form and no-argument
    `createSignal`, expression-bodied effect apply (repro valid-solid2-type-errors).
11. **Make lint-like codes non-blocking in Vite** (CATCH_SWALLOWS, MODULE_STATE), or say in the README that they block builds.

## 8. Repros (`/home/user/migrations/feedback/opencode-web-repros/`)

Each has `README.md` (command, expected, actual) and `node_modules` → the copy's. Runtime ones: `node ../runtime-harness.mjs`
(builds plain, plain-dev, yield, yield-dev and probes each in Chromium).

| dir | kind |
| --- | --- |
| event-writes-held | strict-subset violation (prod + dev) |
| jsx-iife-read-in-view | strict-subset violation (dev runtime) |
| setter-handed-to-library | strict-subset violation (dev runtime) |
| async-start-in-onsettled | unclear message + run-time crash |
| prop-method-await | false negative, false positive, refusal |
| try-catch-makes-routine | false refusals |
| any-typed-props | false positives |
| context-member-async | refusal of valid code |
| for-await-parse-error, prop-call-in-frame-callback | internal errors |
| ref-let-assignment | refusal + run-time crash |
| getter-option | misleading refusal (@tanstack/solid-virtual usage) |
| valid-solid2-type-errors | 7 valid files, 10 errors (writable derived signal, no-arg signal, primitive For item, effect expression body, literal widening, prop narrowing, catch binding) |
| router-root-probe | probe for question 4 (not a bug) |

What is left: the 7 final errors (ChatView/virtualizer `unknown` noise, D-119 forwarding, derived root error); the yield
send-flow difference (needs a solid-yield change or an `action` + `createOptimistic` rewrite that plain Solid 2 does not need);
the context-based architecture variant (`opencode-web-logs/check-variant-context-factories.txt`) was abandoned.
