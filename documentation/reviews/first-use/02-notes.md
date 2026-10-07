# First-time solid-yield review

Started 2026-10-06. Scope: only six supplied docs, package manifests, and (if needed) published declarations. No source repo, tests, twins, decision log, or previous log read during implementation. Node 24.18.0; pnpm 11.20.0.

## Running findings

- **F1 — surprising event semantics (documented):** `$signal` writes in an event are held until the transaction finishes. A conventional `setSaving(true)` / async save / `setSaving(false)` never shows in-flight state. Used the guide's `$optimistic(false)` pattern. The guide also explains flushing between input and submit in tests. No ambiguity or error here.
- **F2 — root README version advice:** root README says the `^2.0.0-rc.11` range resolves to rc.13 “today”, while the dated getting-started guide explicitly requires rc.13 for the compiler. Using the getting-started install line, with only the three library packages replaced by requested `file:` tarball paths. Actual versions and install result to follow.

No declaration files opened yet. No step over 15 minutes yet.

Environment-only install snag: sandbox networking initially failed; retried with the network-capable execution permission, without changing dependency advice. Initial output:
```
[ERR_PNPM_META_FETCH_FAIL] GET https://registry.npmjs.org/pnpm: fetch failed
[WARN] GET https://registry.npmjs.org/solid-js error (ENOTFOUND). Will retry in 10 seconds. 2 retries left.
[WARN] GET https://registry.npmjs.org/@solidjs%2Fweb error (ENOTFOUND). Will retry in 10 seconds. 2 retries left.
```

Install completed without unmet peers using exactly the guide's ranges/pins, except the requested tarball substitutions: Solid/web rc.13; router next.35; compiler next.47; Vite 8.3.2; TypeScript 6.0.3; parser 8.71.1; ESLint 10.12.0; Vitest 5.0.3; jsdom 30.1.2. The install advice is correct for this environment.

- **F3 — documented route props rejected by the router's types:** Used `Props<RouteProps<"/notes/:mode">>` exactly as the guide recommends, then `foreign(Notes)` as its shell recipe recommends. Runtime tests and build pass, but typecheck rejects the route registration. The message explains incompatible types but gives no usable route recipe. Initial message, verbatim:
```
$ tsc --noEmit
src/router.tsx(7,29): error TS2322: Type '(<A extends PropsInput<RouteProps<"/notes/:mode">, unknown> = PropsInput<RouteProps<"/notes/:mode">, never>>(props: A & NoInfer<Undeclared<A, RouteProps<"/notes/:mode">>>) => ComponentView<...>) & { ...; }' is not assignable to type 'RouteSectionComponent<any, Params> | undefined'.
  Type '(<A extends PropsInput<RouteProps<"/notes/:mode">, unknown> = PropsInput<RouteProps<"/notes/:mode">, never>>(props: A & NoInfer<Undeclared<A, RouteProps<"/notes/:mode">>>) => ComponentView<...>) & { ...; }' is not assignable to type 'Component<{}>'.
    Types of parameters 'props' and 'props' are incompatible.
      Type '{}' is not assignable to type 'PropsInput<RouteProps<"/notes/:mode">, unknown> & NoInfer<Undeclared<PropsInput<RouteProps<"/notes/:mode">, unknown>, RouteProps<"/notes/:mode">>>'.
        Type '{}' is missing the following properties from type 'PropsInput<RouteProps<"/notes/:mode">, unknown>': params, location, data
[ELIFECYCLE] Command failed with exit code 2.
```
Tried the documented pattern first. To investigate without reading implementation, opened the published `solid-yield/dist/types/index.d.ts` to locate `foreign`, then `foreign.d.ts` and searched `types.d.ts` for its component/props definitions. These are declaration consultation #1, #2, and #3. No library implementation opened.

- **F4 — test helper import flagged as reactive state:** Expanded the guide's `files: ["src/**/*.{ts,tsx}"]` to include tests, so the requested lint also checks them. The documented `flush` import is rejected at import time even though it is only called by ordinary test helpers, never routines. Verbatim:
```
$ eslint src test

/private/tmp/sy-review-2/app/test/app.test.tsx
  2:10  error  `flush` from "solid-js" is reactive state routines cannot see: routines read and write only with `yield*`  solid-yield/no-foreign-reactive

✖ 1 problem (1 error, 0 warnings)

[ELIFECYCLE] Command failed with exit code 1.
```
Tried the exact documented test helper. The message says routines cannot use it but doesn't distinguish this ordinary test code. Planned workaround: a single import-line suppression with an explanation; keep all recommended rules for app and tests.

Initial runtime result: all six jsdom tests passed; build passed. Router navigation emits jsdom's environment warning twice:
```
Not implemented: Window's scrollTo() method
Not implemented: Window's scrollTo() method
```
This is an actionable environment stub, not a library refusal. Will stub scrolling in jsdom only.

F3 workaround succeeded: `foreign.d.ts` itself shows `defineRoute({ path: ..., component: foreign(...) })` in a comment. Imported `defineRoute` from the router and wrapped only the parameterized route with it. Typecheck now passes without casts, ignored type errors, optional props, or library edits. The guide shows only bare objects in `createRouter({ routes: [...] })` and then separately recommends `Props<RouteProps<...>>`; it needs one combined example with `defineRoute`.

F4 workaround: suppressed `solid-yield/no-foreign-reactive` on the test-only `flush` import, with a reason. Unlike the guide's src-only config, our recommended config includes tests. App files have no rule suppression. Stubbed `window.scrollTo` in the jsdom test file.

- **F5 — structural rules require care (documented):** zero-argument flow children return JSX directly, but children receiving a row value must return `view(function* ...)`. Fallback JSX must be lazy, and context lookup belongs in setup while reading the value belongs in holes. Used the examples correctly on the first attempt; no type-depth errors or runtime refusal encountered. These were surprising but the guide covers them explicitly.

No step has taken over 15 minutes. No more declarations opened.

## Final verification before reading the old review

- `pnpm typecheck`: pass, including two `@ts-expect-error` compile-only checks proving Settings cannot be handed to plain Solid or rendered at the root without its required ThemeCtx.
- `pnpm lint`: pass, using all recommended rules on src and test, with one justified test-helper import suppression.
- `pnpm test`: 6/6 pass in Vitest 5 + jsdom. Covers delayed loading/results, typed failed route, local inputs, synchronous preventDefault, optimistic saving/disabled submit, save success, typed bad-title failure and recovery, two theme consumers, and real-router navigation preserving the provider.
- `pnpm build`: pass (76 modules transformed).
- Chrome dev check: notes rendered; failed route rendered LoadFailed UI; editor rendered BadTitle UI then saved a valid note; settings rendered both context readers and updated both to dark. Captured console error/warn entries: none. In-flight state is specifically verified in jsdom; browser interactions were too slow to observe the 80ms interval.
- No library edits, no unsafe type casts, no declaration augmentation. Only published tarball dependencies.
- Final app routes: `/notes/ok`, `/notes/failed` (same notes page with typed failure), `/editor`, `/settings`. `/` goes to `/notes/ok` in the entry module. Notes are in-memory fake API data and reset on reload; theme also resets on reload. This is intentional for the small example.
- No work interval over 15 minutes; the app and checks were completed well within the two-hour time box.

Local dev server needed network-capable execution permission because the sandbox denied listening. Environment message, verbatim:
```
error when starting dev server:
Error: listen EPERM: operation not permitted 127.0.0.1:5173
    at Server.setupListenHandle [as _listen2] (node:net:1987:21)
    at listenInCluster (node:net:2066:12)
    at node:net:2275:7
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21) {
  code: 'EPERM',
  errno: -1,
  syscall: 'listen',
  address: '127.0.0.1',
  port: 5173
}
[ELIFECYCLE] Command failed with exit code 1.
```
Retried unchanged command with permission; Vite started successfully. Browser tool's in-app browser was unavailable (`Browser is not available: iab`); inventoried the available browser and used Chrome successfully. Neither is a library finding.

Implementation and verification ended before the first read of `previous-log.md` below.

## Classification after reading `previous-log.md`

The old log was first opened after implementation and all checks were complete.

| Current finding | Classification | Comparison |
| --- | --- | --- |
| F1: event transaction/in-flight surprise | still present (behavior); fixed (documentation) | Old 13/16 lacked the explanation and optimistic pattern. Both are now explicit, and the pattern works. |
| F2: version/setup advice | fixed | Old 3/4/5 had missing dependencies and version mismatches. The new install line succeeds without unmet peers, and root rc.13 advice matches the installed result. |
| F3: parameterized router registration fails to typecheck | new | The older reviewer did not use the now-documented route-props recipe. `defineRoute` is still absent from that recipe; its published declaration comment supplied the solution. This is not evidence of a runtime regression. |
| F4: test-only `flush` import rejected by recommended lint | new | Older review linted src only. The new guide's tests use `flush`, while extending recommended lint to those tests produces the false positive. |
| F5: row/view/context structural surprises | still present (rules); fixed (documentation) | Old 6/7/10/12 lacked examples. New examples were sufficient; no declaration search for these was needed. |
| Sandbox npm/listen failures | still present (environment) | Comparable to old 24, but permission retry allowed a successful real Chrome check this time. |
| jsdom scrollTo warning / unavailable in-app browser | new (environment) | Not reported in the older log; worked around by a test-only scroll stub and Chrome. |

Other older findings assessed from this run:

- Old 1/22, missing real-router and app-wide context support: **fixed** for the exercised settings route. `foreign(Settings, { provided: [ThemeCtx] })` typechecks, and two required readers work with the provider above the router, without casts. Parameterized route registration has the separate new F3 snag.
- Old 2/14, missing test setup/client-build guidance: **fixed**. The config is explicit and all six tests render correctly.
- Old 8/9, missing callback type and confusing wait warning defaults: **fixed in documentation** via `Handler`, examples, and the warning explanation. Our app has no handler-valued props, so that API was not independently exercised.
- Old 17/18, Error message extraction and the plain retry reset exception: **fixed in documentation**; used the documented extraction and reset without a new error. Reset's behavior after a persistent API failure was not independently tested.
- Old 23, package-relative links and spaced `yield *` examples: **fixed in the supplied package READMEs and getting-started examples**. The root repository README still uses repository-relative links; remote links were not opened under this review's scope.
- Old 15, form/select root-element runtime bug: **not re-tested**. Our editor naturally has a section root; the new guide asserts form/select roots work. A documentation claim is insufficient to classify the runtime bug as fixed.
- Old 19/20/21, deliberate-invalid-program error quality and wrong pending-root refusal: **not re-tested**. This review followed the new recipes rather than re-running the older review's deliberate mistakes. The new refusals docs name PENDING_ROOT, but this alone does not prove that old diagnostic bug fixed.

No regression established by this run.

## Three changes that would have saved the most time

1. Add one complete parameterized route to the router recipe: `defineRoute({ path: "/notes/:mode", component: foreign(Notes) })` paired with `Props<RouteProps<"/notes/:mode">>`. Explain why the bare object form fails for required route props. This is the main remaining setup snag.
2. Make `no-foreign-reactive` allow `flush` imports used only outside routines, or supply a recommended test config/one-line suppression next to the jsdom example. The current message wrongly describes this test helper as state read by routines.
3. Add a short scaffolded starter combining the install command, index.html, pnpm scripts, route definitions, lint file coverage, and the jsdom test. The guide's individual snippets are useful, but assembling the Vite files and deciding whether tests belong in lint still relies on ordinary tooling knowledge. This is a smaller convenience than changes 1 and 2.

## First-time impression

The strict syntax takes care: I had to keep setup, view holes, row views, event writes, and context requirements separate. The current guide made those choices concrete, and its loading, typed failure, optimistic save, and context recipes worked on the first attempt. The resulting app is fully checked without unsafe casts or library changes. The weak point is where the library meets other tools: the parameterized router example needs defineRoute, and recommended lint mistakes the documented test helper for reactive state. Those two problems were small but sent me outside the prose into declarations and a suppression. This feels usable for a deliberate experiment, with more ceremony than I would want for an everyday notes app.
