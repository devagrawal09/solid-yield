# Migration trials: three corpus apps to Solid 2, checked by sugar mode

On 2026-10-10 three agents each took one app from the [corpus](../README.md), migrated it from Solid 1 to Solid 2, and used
solid-yield's native ("sugar") mode checker as the verifier. They worked to the same brief:

1. Build the Solid 1 original with mocked backends, and record Playwright flows and DOM snapshots.
2. Migrate to plain Solid 2.
3. Run the checker and judge every diagnostic.
4. Build the app twice, as plain Solid 2 and through `vite-plugin-solid-yield`, and compare both against the Solid 1 baseline.

This page combines their reports. The full reports are [solid-realworld.md](solid-realworld.md),
[aoe4-explorer.md](aoe4-explorer.md) and [opencode-web.md](opencode-web.md).

**Setup.**
- Verifier: `proto/sugar-types` @ `31695cb`, built and packed with Node 24.21.
- Stack: solid-js and @solidjs/web 2.0.0-rc.13 (`@solidjs/signals` pinned to rc.13), @solidjs/router 2.0.0-next.29, @solidjs/vite-plugin 3.0.0-next.47, Vite 8, TypeScript 6.0.3.

## Results

| App | Size | Plain Solid 2 | Checker errors | solid-yield build | Strict subset |
| --- | --- | --- | --- | --- | --- |
| [solid-realworld](https://github.com/solidjs/solid-realworld) (MIT) | 26 files, 1.3k lines, Solid 1.3, `.js` | 14/14 flows | 150 → 31 → **0** | 14/14 flows, 28 snapshots byte-identical to plain | **held** |
| [aoe4world explorer](https://github.com/aoe4world/explorer) (MIT) | 106 files, ~25k lines, Solid 1.9 + router | 7/7 flows, 12/12 snapshots identical to Solid 1 | 194 → 760 → **344** (51 files) | full selection: 0/7 (crashes, all in flagged files); the 55 checker-clean files: 7/7, identical | **held** for clean files |
| [opencode-web](https://github.com/bjesus/opencode-web) (no license) | 13 files, 1.4k lines, Solid 1.9, SSE | 59/59 checks | 32 → 28 → **7** | 56/59 prod, 54/59 dev | **3 violations** |

All three apps run as plain Solid 2. Errors are counted on the Solid 1 source, then on the first working Solid 2 migration, then at the end.

The checker cost far more than the migration itself. Per app:

- **solid-realworld:** the plain migration took 17 minutes; the checker took 70 more.
- **aoe4 explorer:** about 35 minutes to plain Solid 2, then about 2.5 hours of checker work, an hour of it waiting on lowering.
- **opencode-web:** 1 hour to plain Solid 2, then 3.5 hours of checker iteration.

Most of that time went to code the checker refused although it is valid Solid 2.

## 1. Strict-subset results

The claim under test is that code the checker accepts runs the same as plain Solid 2.

- **solid-realworld:** it held. Plain and solid-yield builds gave the same DOM, API calls and console output across 14
  flows, including failure and pending paths.
- **aoe4 explorer:** it held for checker-clean files. Every runtime crash in the solid-yield build was in a file the
  checker had flagged, though only with generated-type errors that did not name the cause (§5).
- **opencode-web:** three checker-clean programs behave differently under the plugin. All three were re-run and
  reproduced while writing this page.
  1. **An async event handler's writes are held until it settles**, in production and dev. A plain `async () => { setSending(true);
     setDraft(""); await …; }` is lowered to an `$event`, which is one transaction (D-081). The pending UI never shows, and
     the `sending()` guard lets a second click through: 2 sends instead of 1. Plain Solid 2 holds writes only inside
     `action()`. Repro: [`event-writes-held`](repros/opencode-web/event-writes-held).
  2. **An IIFE in a JSX hole** throws `READ_IN_VIEW` in the dev build only. Repro:
     [`jsx-iife-read-in-view-min`](repros/opencode-web/jsx-iife-read-in-view-min).
  3. **A signal setter handed to a library** (virtual-core's `onChange`) throws `SETTER_OUTSIDE_RUN` in the dev build only. Repro:
     [`setter-handed-to-library`](repros/opencode-web/setter-handed-to-library).
- **Other ways a pass misleads:**
  - **Plain JS files:** model errors in `.js`/`.jsx` files are dropped and the run reports `0 errors`. TypeScript gives no
    semantic diagnostics for JS without `checkJs`. Repro:
    [`02-js-files-unchecked-without-checkJs`](repros/solid-realworld/02-js-files-unchecked-without-checkJs).
  - **Awaiting through a prop:** `await props.api.session.create()` loses both the await and the failure tracking, so an uncaught rejection is
    not reported. The same call through a local signal is reported. Repro:
    [`prop-method-await`](repros/opencode-web/prop-method-await).
  - **`strict: false`:** the results are wrong without `strictNullChecks` and `strictFunctionTypes`. Every async memo gets
    `FAILURE_CLASS`, fetch failures become `ChunkError | any`, and 384 spurious `UNDECLARED_PROP` errors appear. Nothing warns.
    Repros: [`async-memo-no-failure`](repros/aoe4-explorer/async-memo-no-failure),
    [`undeclared-prop`](repros/aoe4-explorer/undeclared-prop).

## 2. What worked

- **A to-do list for the Solid 1 source.** `NATIVE_API` and `NATIVE_EFFECT_PHASES` named every removed API and every one-argument effect
  (aoe4: 80 correct; same in the other two). This alone is useful to a migrating agent.
- **Failure checking found real problems.**
  - solid-realworld had no error boundaries: in Solid 1 an aborted `/tags` or a 500 on the list left the page stuck on "Loading...". The
    checker's `FOREIGN_HANDOFF` led to scoped `Errored` fallbacks.
  - `EVENT_REJECTS` caught a rejection the migration itself had introduced.
  - In opencode-web, `CATCH_SWALLOWS` caught a catch that hid stream errors from the reconnect loop, and four silent load,
    rename and delete failures.
- **Pending matched expectations.** No false `PENDING_ROOT`. Removing a root `Loading` gave an error with the render call as
  related location, although in solid-realworld it pointed at a static link, not the read (the prop-colour leak in §3).
- **Unaffected JSX.** `classList` → `class={[…, {…}]}`, Tailwind arbitrary variants and valueless attributes lowered without trouble.

## 3. Refusals of valid Solid 2

| App | Diagnostic verdicts |
| --- | --- |
| solid-realworld | 37 root causes: correct 5, refused valid or unsupported 17, false positive 12, crash 1, plus 2 real problems masked by earlier refusals |
| opencode-web | 83 instances: correct 22, false positive 25, refused valid 24, unsupported 5, internal 1, noise 5, derived 1 |
| aoe4 explorer | correct 86 (80 of them on the Solid 1 source), false positive 7 (+384 config-dependent), refused valid 124, internal 6; 210 of the final 344 errors have messages that don't say what to change |

Seen in two or three apps:

- **Refs.**
  - The documented `let el; <div ref={el}>` is lowered into a *call* of `el`. It shows only as `[generated] TS2349 … not callable`,
    and the element is never assigned under the plugin.
  - A `ref` inside `Show`/`For`/`Loading` is refused as `NATIVE_HANDLER` at 1:1.
  - Repros: [`ref-variable-lowering`](repros/aoe4-explorer/ref-variable-lowering), [`ref-in-show`](repros/aoe4-explorer/ref-in-show),
    [`ref-let-assignment`](repros/opencode-web/ref-let-assignment).
- **Writable derived state.**
  - `createSignal(fn)` / `createStore(fn, seed)` is the direct replacement for `createResource` + `mutate`, and it is refused.
  - solid-realworld had to turn every optimistic update into a refetch (+4 GETs in its flows).
  - Repros: [`06-writable-memo-createSignal-fn`](repros/solid-realworld/06-writable-memo-createSignal-fn),
    [`writable-derived-signal`](repros/aoe4-explorer/writable-derived-signal).
- **Core Solid 2 APIs with no lowering.** `untrack` (all three apps), `merge`/`omit`, `reconcile`, `snapshot`; `createSignal<T>()` with no initial value;
  an accessor or named function as an effect's compute; expression-bodied effect phases; `action(async function*)`.
  Repros: [`valid-solid2-type-errors`](repros/opencode-web/valid-solid2-type-errors),
  [`18-createEffect-compute-forms`](repros/solid-realworld/18-createEffect-compute-forms),
  [`16-async-generator-action`](repros/solid-realworld/16-async-generator-action).
- **Callback props, context members and factory results** (F-S27, F-S19 and new forms):
  - a callback prop calling a context action is a false `WRITE_IN_REACTIVE`;
  - a tuple context through a custom hook, and a factory composing factories, become setup reads;
  - router accessor hooks (`useMatch`) can't be called at all.
- **App-wide state.** `MODULE_STATE` (F-S31) blocks the Vite build, although Solid 2's cheatsheet recommends module signals for
  app-wide state. Both opencode-web (its whole streaming store) and aoe4 left that code unchecked.
- **Opaque packages.** A call into a package is `unknown`, and an `unknown` in a component body or callback is an error.
  - Every route's `useParams`/`useLocation` gives `NATIVE_SETUP_FAILURE` (26 sites in aoe4).
  - So do the SDK and virtual-core calls in opencode-web.
  - `navigate` gives `EVENT_REJECTS`.
  - This is open question 4 in sugar-design (package contracts); without contracts, every router app fails the check.
- **Props.**
  - Narrowing is lost on prop paths, and a local alias of a prop member stays a path read.
  - `any`-typed props become `unknown`.
  - One coloured call site makes every call of that component pending or failing (D-119 widening; it forced a no-op
    `Errored` around solid-realworld's NavBar).
  - Repros: [`15-prop-colors-leak-across-callers`](repros/solid-realworld/15-prop-colors-leak-across-callers),
    [`any-typed-props`](repros/opencode-web/any-typed-props),
    [`14-hoisted-prop-member-read`](repros/solid-realworld/14-hoisted-prop-member-read).
- **Rows and returns.** Ternary and `&&` rows, components returning `null`, member-expression tags (`<ItemPage.Header>`), lowercase
  JSX helpers. Repros: [`row-ternary-return`](repros/aoe4-explorer/row-ternary-return),
  [`null-return-route`](repros/aoe4-explorer/null-return-route).
- **`lazy()`.**
  - A lazily imported checked component used as a tag can't pass, even inside `Errored` + `Loading`. The handoff check sits outside the
    author's boundary, and the message suggests `{yield* Comp(props)}`. solid-realworld dropped code splitting.
  - Lazy routes given to the router's `component:` passed in aoe4.
  - Repro: [`10-lazy-selected-component`](repros/solid-realworld/10-lazy-selected-component).
- **`try/catch` and `CATCH_SWALLOWS`.**
  - A `try/catch` makes a plain function a routine, which then can't be passed as a callback.
  - `CATCH_SWALLOWS` flags catches that recover (assign a fallback, call a `Setter` parameter, retry).
  - `Errored`'s `reset()` is treated as an unknown-failing call.
  - Repros: [`try-catch-makes-routine`](repros/opencode-web/try-catch-makes-routine),
    [`12-errored-reset-event-rejects`](repros/solid-realworld/12-errored-reset-event-rejects).

## 4. Crashes and hidden errors

- **The lowering crashes.** `BABEL_PARSE_ERROR` came from the lowering emitting invalid code: `yield` outside a generator, or TypeScript syntax in
  `.jsx`. That was 7 sites in solid-realworld (plus every `.jsx` file), 2 in opencode-web and 6 in aoe4, all with positions in
  the intermediate program. Triggers include:
  - a helper calling a prop;
  - an async helper calling a context setter;
  - a named handler called from a row;
  - keyed `Show` + `.slice()`;
  - `for await` with state writes.
- **A refused file hides its ordinary TypeScript errors.** In solid-realworld that hid a real bug in the original app:
  an undeclared `slug`, which throws on every favorite click. Repro: [`19-refusal-hides-ts-errors`](repros/solid-realworld/19-refusal-hides-ts-errors).
- **Only the first refusal per file is reported**, so each fix exposes the next one.

## 5. Speed, setup and tooling

- **Lowering speed.**
  - The CLI finds refusals one per pass and re-lowers the whole project after each (`service.cjs` `while (pending.size)`).
  - In aoe4 (~100 files) the first full run took 25 passes and 22.5 minutes before TypeScript started; the final run took 648 s.
  - Editing a file during a run restarts it.
- **The solid-yield Vite build** is 30–45× slower than plain: 29 s vs 0.65 s, 31.7 s vs 1.0 s, 2 min 40 s vs 5 s.
- **Every native diagnostic stops `vite build`**, including lint-like `CATCH_SWALLOWS` and `MODULE_STATE`. aoe4's solid-yield builds had to exclude
  files from the plugin, so the Vite and TypeScript selections differed, against the README's advice. The Vite error header can name the wrong file.
- **No view of the generated code.** There is no way to see the lowered program; each agent wrote its own dump script around
  `vite-plugin-solid-yield/virtual`.
- **Undocumented setup requirements:**
  - `strictNullChecks` + `strictFunctionTypes`;
  - `.js`/`.jsx` files are unusable (`TS18003` without `allowJs`, crashes with it);
  - pnpm 11 needs `"packageManager"` (the bare pnpm here was 10.28 and ignores `allowBuilds`);
  - `@solidjs/signals` resolves to rc.14 under solid-js rc.13 unless pinned;
  - TypeScript 6 rejects `baseUrl`.

## 6. Messages

- **Library-dialect advice in native mode:**
  - `call a yield component in a hole: {yield* Comp(props)}`;
  - `declare a failure class with class Boom extends Failure(`;
  - `fallback is a lazy view: function* () …`;
  - `Move this throw … attempt`, which native code can't import.
- **Positions that point nowhere useful:** `[generated]` at a component or factory name, `1:1`, or `undefined:undefined`.
  The agents spent most of their bisection time on these.
- **Removed APIs** (`createResource`, `createComputed`, `useTransition`, `batch`) are reported as "no verified native lowering", which reads as
  valid-but-unsupported.
- **`GENERATED_TYPE`** says no more than "the generated code cannot accept it". At the root, `FOREIGN_HANDOFF … Remaining: any`
  points at the render call and not at the read that carries the failure.

## 7. Migration hazards nobody flagged

These are Solid 2 behaviour changes the agents found by running the app. The checker accepted every one. Sugar mode wants to be the
migration target, so they are candidates for checks:

- **Read-after-write within one flush.** Reads return the committed value until flush:
  - opencode-web's SSE store merges lost events;
  - aoe4's table of contents kept 1 heading of 29.
- **`{count && <X/>}` renders `0`** (17 places in aoe4).
- **An effect-driven loader that first pends after its `Loading` has revealed** shows the empty state ("No articles are here…
  yet.") instead of the fallback. This came from rewriting `createComputed` in solid-realworld.
- **An effect phase that returns a non-function** (`() => setShow(false)`) crashes with `E is not a function`. Plain `tsc` catches it.
- **`<select value>` whose options come from `<For>`** in the same update selects the wrong option (opencode-web).

## 8. For Solid and the ecosystem (not solid-yield)

- `@tanstack/solid-virtual` has no Solid 2 release, and its imports fail to resolve. opencode-web replaced it with a 91-line adapter over `@tanstack/virtual-core`.
- Router 2 removes `<Router>`/`<Route>`/`<A>`, and relative `A href`s need rewriting.
- `ComponentProps<"img">` from `solid-js` is `never`; the one in `@solidjs/web` works.
- Path-style store setters throw `fn is not a function`.
- `refresh()` shows no pending state, so "Loading question…" disappears on a refetch.
- `ASYNC_OUTSIDE_LOADING_BOUNDARY` fires, naming an owner inside a `Loading`, with no visible deferral (solid-realworld).
- `@solidjs/signals` rc.14 is pulled in under rc.13.

## 9. Recommendations for solid-yield, ranked

1. **Close the subset gaps.**
   - Do not give plain async handlers transaction semantics in native mode, or refuse them and name the difference.
   - Make the dev-only checks (`READ_IN_VIEW`, `SETTER_OUTSIDE_RUN`) static, or stop them firing on checker-clean code.
   - Check JS files or refuse them.
   - Keep the await and the failure on `await props.x.y()`.
   - Require `strictNullChecks` and `strictFunctionTypes`.
   - Evidence: §1.
2. **Never crash and never hide errors.**
   - Turn every `BABEL_PARSE_ERROR` into a refusal at the authored position.
   - Print ordinary TypeScript errors in refused files.
   - Report every refusal in a file at once.
   - Evidence: §4.
3. **Speed.**
   - Collect all refusals in one lowering pass instead of one pass per refusal.
   - Snapshot sources once per run.
   - Make lint-like codes warnings in Vite.
   - Add `--emit-dir` to show the lowered program.
   - Evidence: §5.
4. **Lower the idioms Solid 2's own cheatsheet teaches:**
   - refs (`let el`; refs in control flow);
   - `createSignal(fn)` / `createStore(fn)`;
   - `untrack`/`merge`/`omit`/`snapshot`/`reconcile`;
   - `createSignal<T>()`;
   - effect compute forms;
   - `action(async function*)`;
   - module state as a warning;
   - ternary/`&&`/null rows;
   - `lazy()` components under an authored `Errored`.
   - Evidence: §3.
5. **Package contracts**, at least for `@solidjs/router` hooks and `navigate`, and a way to declare an SDK's failures. Credit
   `Errored`/`Loading` around the router's render-prop children the way F-S43 credits providers. Evidence: §3, aoe4 §1 Q2.
6. **Messages for native authors.**
   - No library-dialect advice.
   - Authored positions only.
   - Say "removed in Solid 2".
   - Explain `GENERATED_TYPE`.
   - Print the chain behind a root error.
   - Evidence: §6.
7. **Per-call-site prop colours** (D-119), so one coloured caller does not leak into every call. Evidence: §3.
8. **Migration checks** for the §7 hazards, starting with read-after-write in one flush and numeric `&&`.

## Notes on this run

- Each agent worked in a local copy; nothing was pushed to any upstream repository.
- [`patches/`](patches) holds the two MIT migrations as diffs against the pinned commits in [apps.json](../apps.json). Both
  apply cleanly. They include each agent's e2e harness (mock API, flows, compare) and leave out snapshot output and lockfiles.
- opencode-web has no license, so only its report and synthetic repros are here. One of its repros
  (`jsx-iife-read-in-view`) contained the app's own component, so it is replaced by
  [`jsx-iife-read-in-view-min`](repros/opencode-web/jsx-iife-read-in-view-min), a stand-in that reproduces the same
  error.
- [`checks/`](checks) has each app's final checker output.
- **Repros.** There are 56 in [`repros/`](repros), each with a README giving the command, expected and actual result. They resolve Solid and solid-yield from an app install made per the ts-plugin README: through a `node_modules`
  symlink (solid-realworld, opencode-web) or by running the CLI from the app (aoe4, as each README says). opencode-web's runtime repros run with
  `node ../runtime-harness.mjs`, which builds plain, plain-dev, solid-yield and solid-yield-dev and probes each in
  Chromium.
- **Rerun by the orchestrating session** (each matched the agent's report):
  - `event-writes-held`, `jsx-iife-read-in-view` (and the `-min` stand-in), `setter-handed-to-library`;
  - `10-lazy-selected-component`, `19-refusal-hides-ts-errors`;
  - `ref-variable-lowering`, `async-memo-no-failure`.
- **Paths.** Paths inside the three reports (`/home/user/migrations/...`) are the session's working copies. Their repros are now under
  `repros/<app>/` and their checker output under `checks/`.
- **Two incidents, no lost results.** The solid-realworld agent overwrote one of the finished opencode-web agent's scratch experiments, and
  the aoe4 agent's broad `pkill` may have stopped another agent's checker run.
