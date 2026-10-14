# solid-yield sugar/native mode — independent first-use review

Setup: repo at detached `proto/sugar-ls`; installed/built already. App at `/private/tmp/sy-review2-out/app`, case files in `../cases/`, runner `../run.sh`, tsserver probe `../probe.cjs`.
Mode note: the README's headline route is **native** mode (plain Solid 2, `include` globs); that is what I used. I did not test `"use yield"` directive sugar.

## 1. Install from the README

- Expected: pack 5 packages, write `pnpm-workspace.yaml` overrides, `pnpm add` tarballs, tsconfig, vite config -> builds.
- Actual: **worked first time, from the TS-plugin README's "Install and select files" section** (4s install, `vite build` OK, CLI OK). Packs written to `/tmp/solid-yield-packs` (that dir didn't exist; I `mkdir -p`'d it — README's `pack --pack-destination` command doesn't say to).
- Friction (none blocking):
  - Root README's main README says `eslint: ^10`, TS-plugin README says `eslint@^9`; I used ^9 (worked). README lists `jsxImportSource: "solid-yield"` in the "from source" section but `"@solidjs/web"` in the native section — two contradictory tsconfigs; native needs `@solidjs/web`.
  - The root README's pointer is split across three places (top paragraph, "Using it today (from source)" = explicit-dialect config with `file:` paths, and the TS-plugin README = native/tarball). I had to pick; a newcomer could easily follow the wrong one (the `file:` + `vite-plugin-solid-yield` `solidYield()` with no args is explicit-dialect, not native).
  - README never links the native harness examples (step 4).
- My app (`src/index.tsx`): Counter w/ `setTimeout(() => console.log(count()))`, `createContext<string>()` (no default) + `useContext`, `TodoList` w/ `createMemo(() => fetchTodos(props.listId))` where `fetchTodos` is async and throws a `FetchError extends Error`, `Errored` + `Loading`, `Form` with async `onSubmit`.
- First CLI run: `src/index.tsx:18:41 error TS2349: This expression is not callable. Type '{ id: number; title: string; }' has no call signatures.` — **my own mistake** (I called `todo()` in `<For>`; plain `tsc` gives the same error, so not the tool's). Fixed -> `solid-yield check: 2 files, 0 errors`. `vite build` OK (the build does not run the checker; only the transform's own refusals fail it).

## 2. CLI diagnostics (verbatim)

A clean app yields no diagnostics, so I removed one boundary at a time.

README's own 15-line example (matches the README claim: line 11, related line 15):
```
src/index.tsx:11:20 error TS2345: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
src/index.tsx:11:20 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: src/index.tsx:15:15: Component App reaches Solid here. can suspend (pending); never fails; does not wait; needs no context
  related: (same line repeated)
solid-yield check: 2 files, 2 errors
```
My app without `Loading` (line 18:18 = `todos()` in `<For each={todos()}>`):
```
index.tsx:18:18 error TS2345: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
index.tsx:18:18 error TS1360: [PENDING_ROOT] ... (identical)
  related: index.tsx:44:15: Component App reaches Solid here. can suspend (pending); can fail with FetchError | an unknown error; does not wait; needs no context
```
Without the provider (14:28 = `ThemeCtx` in `useContext(ThemeCtx)`):
```
index.tsx:14:28 error TS2345: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
index.tsx:14:28 error TS1360: [NO_PROVIDER] (identical)
```
Without `Errored`: **no diagnostic** (by design: README says an unhandled failure "stays in the root's type and is re-thrown"). So "typed failures" are visible in hover but never enforced in plain code.

Reactions: right line and column both times; message understandable without theory and the fix (wrap in Loading / add provider) is correct. Problems: **every root error is printed twice** (TS2345 + TS1360), and the "related" line is duplicated; the related text "Component App reaches Solid here" is jargon. Fix applied = restore the wrapper; re-run -> 0 errors.

## 3. Twelve mistakes (0 = nothing, 1 = caught but poor line/message, 2 = right tool, line, actionable)

Each case: `cases/<id>.tsx`, wrapped in Errored+Loading, run through CLI + ESLint + `vite build`.

| # | Mistake | Caught? | Message / location | Score |
|---|---|---|---|---|
| 1 | swallowed `catch (e) { return [] }` in async memo | no (CLI, ESLint, build: silent) | – | 0 |
| 2 | throw plain string | partly: `throw "x"` inside an event handler is caught: `5:51 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.` (also fails `vite build`). `throw "nope"` inside an async helper function: **silent** | actionable where it fires | 1 |
| 3 | subclass thrown, base class used in `instanceof Base` catch | no | – | 0 |
| 4 | `catch(e){ if (e instanceof FetchError) return -1; throw e }` | no (no complaint, no hint) | – | 0 |
| 5 | unhandled rejection in handler: `onClick={async () => { await fetchTodos("bad") }}`, also named `save`, also sync `throw`/call to `boom()` | no | – (the failure is put in the view's type instead; nothing to see at the handler) | 0 |
| 6 | context read without provider | yes, CLI | `14:28 [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.` (printed twice) | 2 |
| 7 | read at setup (`const initial = count()`) | yes, CLI | `7:19 error TS2769: [READ_IN_SETUP] Move this read into JSX, a memo, an effect, or an event so it stays reactive.` plus a "related" pointer into `node_modules/.../types.d.ts:109:14: 'kind' is declared here.` (noise) | 2 |
| 8 | `<Portal>` (from `@solidjs/web`) | warning only, exit 0 | `6:10 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Handle failures inside Portal or its callbacks; this imported component (Portal from @solidjs/web) is outside the native check.` – accurate, but doesn't say what to do with a Portal that has no failures; a warning on every use | 1 |
| 9 | module-level `createSignal` | yes but at the **uses**, with a type-leak message | `7:33/7:42/7:57 error TS2349: This expression is not callable. Type 'Create<"signal", never>' has no call signatures.` — three errors, none on the declaration (line 5); no `[CODE]`, no fix | 1 |
| 10 | generator in a component (`[...gen()]`) | yes, wrongly worded | `8:18 error TS2769: [NATIVE_SETUP_FAILURE] Move this throw into a memo or rendered work, or handle it with attempt; the component body only creates state. Here it cannot raise a failure.` and `8:15 error TS2488: Type 'void' must have a '[Symbol.iterator]()' method...` – there is no `throw` in my code; the transform seems to have lowered `gen()` as if it were a yield routine | 1 |
| 11 | destructured props `function Page({ listId })` | yes (CLI + build) | `6:1 error TS95000: [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.` (line right, column at the function not the pattern) | 2 |
| 12 | `createEffect(() => {...})` one arg | yes (CLI + build) | `7:3 error TS95000: [NATIVE_EFFECT_PHASES] Pass a tracked compute function and an untracked effect function to createEffect.` (build says a different sentence for the same code) | 2 |

**Total: 12/24** (0+1+0+0+0+2+2+1+1+1+2+2).
Extra: a `setTimeout` callback that calls something that throws *is* caught: `5:31 error TS2345: [NATIVE_CALLBACK_FAILURE] Catch the failure inside this callback.` (related points into `native-control.d.ts`, i.e. library internals) — but the equivalent `onClick` is not. ESLint (recommended config with `mode: native`) reported **nothing in any of the 12 cases**; the lint is effectively inert on plain Solid code, so "by which tool" is always the TS plugin/transform.
Honest read: the tool is strong on structural Solid-2 mistakes (pending, provider, setup reads, props, effect arity) and says nothing about error-handling *quality* (swallowed catches, wrong class, selective instanceof, unhandled event rejections). That is the "typed failures" half of the promise.

## 4. Native harness

README does not mention them; found in `examples/harness/native-{todos,sierpinski}/check.mjs` (args `parity|ssr`). Ran all four:
- `native Todos client parity: 27 states match original` / `native Todos hydrated parity: 27 states match original` / `native Todos streamed SSR smoke: two seeded todos match original; no render errors`
- `native Sierpinski client parity: 11 states match original` / `hydrated parity: 11 states match original` / `streamed SSR smoke: 729 dots match original; no render errors`
- The README's CLI commands: `pnpm solid-yield check examples/originals/todos --native 'src/**'` -> `5 files, 0 errors`; sierpinski -> `1 files, 0 errors`.
Meaning: two real Solid apps (unmodified originals) transform and behave identically in jsdom, hydration and SSR. Compelling, but it is two apps; the other five originals (docs, effect, hackernews-spa, rendering, room) have no native twin ("no complete original passed native acceptance" per sugar-design.md).

## 5. tsserver

Wrote `probe.cjs` (spawns tsserver with `--allowLocalPluginLoads --pluginProbeLocations <app>`, modelled on `test/protocol.test.cjs`). Results on my app without Loading:
- `semanticDiagnosticsSync` -> `[["18:18",2345,"[PENDING_ROOT] Wrap this read in Loading; ..."],["18:18",1360,"[PENDING_ROOT] ..."]]` (duplicated in the editor too).
- Hover quote: `TodoList — can suspend (pending); can fail with FetchError | an unknown error; does not wait; needs ThemeCtx`
- Also `Counter — does not suspend; never fails; does not wait; needs no context`; `Form — does not suspend; can fail with FetchError | an unknown error; does not wait; needs no context` (the async submit). Hover on `createMemo(` gave a (wrong-looking) `createMemo — does not suspend; never fails...`.
- Could not verify: any real editor (VS Code) UI, squiggle placement, completion/rename/code actions (README says unvirtualized), tsc (README: `tsc` does not load the plugin, so CI must use the CLI), where "an unknown error" in `FetchError | an unknown error` comes from (it never went away), directive `"use yield"` sugar.

## 6. Verdict

**Use on a real app today? No.** Safe as an opt-in *advisory CLI in CI* for structural Solid-2 mistakes (missing Loading/provider, setup reads, destructured props, effect arity) on a small app. Not as a "typed failures" tool: the failure half is hover-only, and none of my error-handling mistakes was flagged. Also: no npm release, sourcemaps for runtime not implemented, only two apps proven.

Top three fixes (in order):
1. Make failures actionable in plain code: flag swallowed catches / unhandled event rejections / base-class catches (or state loudly in the README that none of these is checked), and make an unhandled failure at the root optionally an error — today the "typed failures" promise has no diagnostic behind it.
2. De-duplicate and clean diagnostics: every root error prints twice (TS2345 + TS1360, plus duplicated `related`), `related` points into `node_modules/.../*.d.ts` internals, and module-level `createSignal`/generator cases leak `Create<"signal", never>` / `[NATIVE_SETUP_FAILURE] ... this throw` when no such thing was written.
3. One canonical install path in the README (native vs explicit tsconfig contradictions, eslint ^9 vs ^10, create `/tmp/solid-yield-packs`, link the harness examples) and make the ESLint step either do something in native mode or say it does nothing.

Most impressive: the README's 15-line example reproduces exactly (`PENDING_ROOT` at 11:20, render at 15:15), and the plugin infers `TodoList — can suspend (pending); can fail with FetchError ...; needs ThemeCtx` from *unannotated plain Solid* code, across a `createMemo` over an async function and a context, with accurate line numbers — plus the unmodified Todos/Sierpinski apps pass client/hydrated/SSR parity.

README over-promises (quotes):
- "write plain Solid 2, add the Vite plugin and the TS plugin, get typed failures with diagnostics at the right lines" (task framing) vs. README: "A failure that no `Errored` handles stays in the root's type and is re-thrown when it happens." — typed, but no diagnostic.
- "Event failures instead ask you to catch inside the handler or declare its failure contract." — not observed for `onClick` (sync throw, async await, named handler): silent. Only timer callbacks gave `[NATIVE_CALLBACK_FAILURE]`.
- "Apply the recommended ESLint rules ... this selection matches the native Vite files and permits `createSignal` and `createMemo`." — in native mode the lint reported nothing in any of 12 cases.
- "Tarball and `file:` installs are tested outside the workspace." — true (my install worked), but the root README's "Using it today (from source)" block is the explicit dialect and conflicts with the native config.
- "Diagnostics and component hovers use source positions where available" — true in my runs; "synthetic spans keep a marked fallback" — I did not see `[generated]`.

## Summary (10 lines)
1. Install from TS-plugin README worked first time (tarballs + overrides); README sections contradict each other (jsxImportSource, eslint 9/10).
2. README's 15-line example reproduces exactly: PENDING_ROOT 11:20 + related 15:15.
3. Missing Loading / missing provider: right line, clear message, correct fix — but each printed twice (TS2345+TS1360).
4. 12-mistake score: 12/24. Caught: provider, setup read, props destructure, effect arity, string throw (in handlers).
5. Missed entirely: swallowed catch, base-class catch, selective instanceof/rethrow, unhandled rejections in onClick.
6. Poor messages: module-level signal (`Create<"signal", never>` not callable, at uses), generator (mentions a throw that isn't there), Portal (warning only).
7. ESLint did nothing in native mode across all cases.
8. Harness: native-todos/-sierpinski parity (client 27/11, hydrated, SSR) all match originals.
9. Hover: "TodoList — can suspend (pending); can fail with FetchError | an unknown error; does not wait; needs ThemeCtx". Editor UI untested.
10. Verdict: not for a real app today; advisory CI only. Report: /private/tmp/sy-review2-out/REVIEW.md
