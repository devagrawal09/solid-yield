# HANDOFF — solid-yield (checkpoint 2026-10-06: v0.1, through D-101)

This repository was extracted from the Solid fork `devagrawal09/solid`, branch `blocks-lib`, at commit **`6978eb83`** (D-015). Git history was not carried; the fork keeps it. The fork's own handoff at that commit (Phases 1A, 1B and 2, and its environment notes) is `git show 6978eb83:HANDOFF.md` in the fork.

> **Names (D-096, 2026-10-06).** The product is `solid-yield` (was `solid-blocks`), with `vite-plugin-solid-yield` and `eslint-plugin-solid-yield`; the unit is a **routine** (was "block"), the model is **yield components**. Package directories are `packages/yield`, `packages/vite-plugin-yield`, `packages/eslint-plugin-yield`; twins are `examples/*-yield(-h)`; the gate is `scripts/yield-gate.mjs`. Text below written before D-096 was updated to the new names, except quoted fork paths and the extraction's own history.

## v0.1 (2026-10-06): state, and what is left

> **Status (2026-10-06).** The repository `devagrawal09/solid-yield` is **public** (Dev flipped it). `origin/main` is at `53b664a`; the commits after it (D-100, D-101) are local, for Dev to push. **npm publish waits for credentials**: nothing is on the registry yet (`solid-yield`, `vite-plugin-solid-yield`, `eslint-plugin-solid-yield` are unpublished).

The library is feature-complete for v0.1: through D-101 every ruling is implemented or recorded, and the gate is green (37 / 37 steps, against `documentation/yield-gate-baseline.json`; the step list did not change, so the baseline was not re-recorded). The table below is the checkpoint at D-099 (pushed since).

| Commit | What |
| --- | --- |
| `73573e6` `refactor: a component's setup and view are not wrapped in an untrack (D-097)` | The `untrack()` in `component` removed (dead under D-042). The dev read checks took "no observer" to mean "the run's own read"; each run now records the observer it started under, so `READ_IN_SETUP` / `READ_IN_VIEW` still fire for a component called inside a hole. Tests: one setup per instance; the creating hole never re-runs; both dev errors inside a hole. |
| `9c79862` `refactor: $component is component (D-096 amended)` | A clean rename (no alias) across the packages, lint, twins, harness, conformance, the plugin's fixtures and compiled oracle, docs. `$` marks an operation a routine `yield*`s; module-level calls have none. |
| `a6f5dfd` `feat: context requirements are a fourth color (D-098)` | `ContextRead<C>`, `RequiresOf`, `ComponentView<P, E, W, R>`; `createContext<T>()` is a requirement, `Ctx.provide({ value, children })` discharges it for the components called inside (not the reader's own setup read), `render` / `hydrate` / `foreign()` refuse what remains (`[NO_PROVIDER]`, naming the context), `NO_PROVIDER` at run time. A context's value is read like a prop (a path). Twins: todos, todos-h, rendering converted; room and effect stay defaulted (D-098 has the per-twin table). |
| `6e57607` `feat: pending roots are wrapped, explicitly; library renderToString / renderToStream (D-099)` | `render(() => Loading({ children: App }), el)`; library `renderToString` / `renderToStream` with the root rule; rendering's entries on the library's renderers, `foreign(App)` / `foreign(Shell)` and App's `Errored` removed; D-023's count is 4. |

### Not done as ruled (open for Dev)

- **D-098's message cannot name the component.** The refusal names the context (by its name literal, `createContext<User, "UserCtx">()`, else by its type), not "App requires …": a type has no access to a component's or a variable's name (as for D-088).
- ~~D-098: a requirement does not cross a hole prop.~~ Done (D-098 amended): it flows out through the call (`HoleCall`), except for a generic component's (D-029), a `lazy` one's and `h(Comp, props)`'s hole props. Was: A prop declares no requirement and a component's type is a plain function's (D-068), so a requiring component called in a user component's hole prop (`children`) is refused; provide inside the hole. Flow controls, boundaries and `provide` carry their children's. A declared requirement on a prop (`Source<T, E, P, R>`) would lift it; not built.
- ~~D-098: two unnamed contexts of one value type are one requirement~~ Ruled (D-098 amended): requirements are nominal; a context without a default is named (`createContext<User, "UserCtx">()`), unnamed is `[UNNAMED_CONTEXT]`. Two contexts given the same name and value type are still one (TypeScript cannot mint an identity per call).
- **D-098: a direct component call in `h`'s arguments is not discharged by an `h(Ctx.provide, …)` in the same expression (it is created first; `Created` / `Settle`).
- **D-098 (d) costs a double `yield*` for an event in a context**: `yield* (yield* save)(x)`, `onClick={yield* (yield* save)}` (as an event prop, D-042). todos' six action calls read so.
- **D-099: the stream is not held** — ruled (D-099 amended): this is the behaviour, made visible; recorded, no change. A root `Loading` is a boundary: Solid flushes the shell with its empty placeholder and streams the content in (rendering: +80–350 characters per streamed document; hydration claims unchanged). What shows is the same. Holding it needs Solid's stream protocol (D-004), a `Loading` that is not a boundary (D-071), or buffering everything.
- **D-099: rendering's string entries keep the original's fallback page** (`renderToString` cannot wait; the original has it); CSR and streaming have none.

### What is left: public / publish

- ~~Make the repository public, push `main`.~~ Done: public (Dev, 2026-10-06), `main` pushed through `53b664a`. Later commits are pushed by Dev (this sandbox cannot reach GitHub, see "Publishing" below).
- **Publish to npm: waits for credentials** (an npm login or automation token with publish rights for the three unscoped names). Then `pnpm changeset version` and `pnpm changeset publish` after the items below.
- Before the first release: collapse the changesets into one initial release note (they do not mention D-097–D-099 yet; D-100 and D-101 have their own); decide the plugin's peer range (the 0.x caret, "Known, recorded, not fixed"); `@solidjs/h` as a peer, the ESLint plugin's peers and description; LICENSE / `author` and Solid's MIT notice (from "Fixes with no ruling needed", below; not yet done).
- The upstream issue `documentation/upstream/solid-ssr-memo-loop-rc13.md` awaits "file it".
- **λ-yield.** `documentation/calculus.md` states the soundness theorem (D-071) and its 52 proof obligations, each now evidenced (`test/obligations.spec.tsx` holds the runtime tests that were missing). §6.3's findings are all closed, and no obligation is violated as tested: F-1 (an `Errored` fallback's dropped colors) and F-3 (`provide({ value: undefined })`) fixed, F-4 / F-5 (comments) fixed, F-7 fixed (a bound call no `Errored` takes rejects, D-085 note), **F-2 fixed by D-100** (`lazy` fails with a typed `ChunkError`; with no `Errored` it is re-thrown and the call renders nothing, no halt; rendering's pages let it reach the root, as the original), **F-6 closed by D-101** (`$settled` removed; run once after mount is `$effect(function* () {}, function* () { … })`; the 4 twin sites migrated with parity, SSR and hydrate smoke green).
- Earlier open items below still stand unless a ruling above closed them: D-088's added boundaries now count 4 (hackernews-spa 3, room 1; rendering's went with D-099).

## Reviews (2026-10-07): kanban and chat

The first-time reviews built larger apps from published docs alone: kanban at `/private/tmp/sy-review-3/{log.md,app}`, chat at `/private/tmp/sy-review-4/{log.md,app}`. Both logs were read in full; those references were not modified. This follow-up started at `bd3716b`. The [reproduction notes](./documentation/review-reproductions.md) separate confirmed findings from reports that could not be reproduced.

The counts below group each log's **new product reports**, rather than counting each symptom or recounting overlapping historical items. Sandbox install, port, browser and jsdom warnings are excluded. Kanban's six are N1–N5 and D1; chat's seven are missing lazy docs, `any` handoff, array length, SSR compilation, hydration bootstrap, reconnect and keyed halt.

| Review | New reports in its log | Fixed / documented here | Still present | Not reproduced |
| --- | --- | --- | --- | --- |
| Kanban | 6 | 5 | 1 (N2 / F-8) | 0 |
| Chat | 7 | 5 | 0 confirmed | 2 (A2, A3) |

- **A1: reproduced, setup error.** Client `generateHydrationScript()` returns an empty string. The script must come from the server build and execute before hydration. Missing it now gives development `[NO_HYDRATION_SCRIPT]`, with the recipe, instead of the undefined `done` TypeError. A one-element test and a separate SSR/Vitest test verify the real server script; the latter preserves and clicks the server button for both string and streamed output.
- **A2: not reproduced.** Removing the chat's outer catch-all in memory, using its own tsconfig and declarations, left zero type errors. Its stream fails with `TransportError`, its lazy call with `ChunkError`, and typed catches leave `never` at `foreign`. A type test pins those exact stages and no `any`. The earlier source producing `any` is not retained; no type fix was guessed.
- **A3: not reproduced.** The chat removed its keyed experiment. Both the library and plain Solid remount tests subscribe again without `[REACTIVITY_HALTED]`. An outer-boundary probe also did not halt. There is no evidence to assign the removed `insertBefore` failure to the library or Solid, so no failing upstream repro was invented.
- **N2 / D-085 F-8: reproduced, still present.** An optimistic list move disposes the event's bind row before its typed failure arrives. Neither its fallback nor the live outer fallback runs; the call resolves, and development only logs `[RUN_WITH_DISPOSED_OWNER]`. The runtime test explicitly pins current behaviour. **Dev's ruling is open:** A skips disposed boundaries in the captured chain, uses the nearest live one, else rejects and emits development `[BOUNDARY_DISPOSED]`; B adds only a development error; C holds disposal. **No option was chosen.**

Messages now name missing contexts and missing lazy preloads. Required contexts pass their name at runtime as well as in the type: `createContext<T, "Name">(undefined, { name: "Name" })`; existing named uses were migrated. The four beginner refusals have readable text pinned against TypeScript's actual diagnostics, without TS2589 for a JSX row. Recommended lint now catches source reads in component and row setup, including typed aliases.

The guide and package docs now cover lazy/`ChunkError` retry; stores, derived optimistic lists, both effect phases and `refresh`; D-073's component-level effect failures; reading an array source before `.length`; and SSR/hydration. The SSR recipe uses separate JSX configs, the server hydration script, the matching client manifest, awaited `pipeTo`, and Vitest outside test mode. The tested reconnect pattern keeps one iterator per attempt: reset cannot reopen an exhausted iterator, and caching avoids two fresh subscriptions when reset runs before an event write commits. All documented local and same-repository file/anchor targets were checked: zero broken targets. Those GitHub links refer to repository files, not files included in the npm tarball; remote availability of these local changes awaits Dev's push.

**New in this follow-up: one confirmed type bug, fixed.** A rejected `Promise<never>` was classified as a stream because its awaited type is `never`. It is now a wait, with its typed failure pinned. This does not explain A2's unconfirmed `any`.

| Commit | Change |
| --- | --- |
| `8ea4798` | Missing server hydration script: reproduction and development error |
| `c1e90f7` | Exact reviewed stream/lazy failure handoff type tests |
| `cff93f7` | Library and plain Solid keyed recovery; retained-iterator reconnect tests |
| `3d05b2a` | Disposed event binding: current-behaviour test and open D-085 F-8 |
| `523497c` | Runtime/type messages, runtime context names, setup-read lint |
| `3438ca0` | Rejected promises are waits, not streams |
| `f9fc7fb` | Worked docs, tested state/reconnect and SSR hydration recipes |

Every commit, including this handoff, follows `pnpm build` and the **full 37/37 GREEN gate** against the unchanged baseline. The separate documented hydration command also passes 2/2 tests. Commits are local on `main`; nothing was pushed. Remaining limits are F-8's ruling, the missing A2/A3 intermediate fixtures, and real-browser lazy preload verification (the documented jsdom workaround is not that check).

## Upstream

- [solidjs/solid#3815](https://github.com/solidjs/solid/issues/3815): rc.13 SSR memo/serialization-slot loop. Filed; issue open at the 2026-10-07 check. The library avoids re-creating the component (D-082); the upstream report remains.
- [solidjs/solid#3845](https://github.com/solidjs/solid/issues/3845): delayed second hydrate root replaces server nodes. Filed; issue open at the 2026-10-07 check. Dev reports the maintainer says the completion guard is deliberate (event replay, serialized-data lifetime, DOM drift). The private reset workaround was **withdrawn before implementation** (D-111). v0.2 uses eager islands only; v0.3's keyed attachment owns its event queue and payload, validates claims and falls back to render.

## Where things are

| Commit | What |
| --- | --- |
| 1 `chore: scaffold the monorepo` | pnpm 11 workspace, root tooling, `scripts/yield-gate.mjs` (the fork's gate minus its compiler steps), `.github/workflows/gate.yml` (CI = the gate), a fresh changesets config. The gate is red here by construction: there is nothing to gate. |
| 2 `feat: move …` | the 3 packages, the 8 twins, `examples/harness`, the 6 originals under `examples/originals/`, the docs, the 29 changesets. Verbatim apart from the edits the move needs; the commit message lists them. Vendored JSX types. First baseline: **30 / 30** on published rc.13. |
| 3 `refactor: rename …` | D-011: `solid-yield`, `vite-plugin-solid-yield`, `eslint-plugin-solid-yield`, all in one commit. |
| 4 `test: exports-conditions matrix …` | `pkg:*:exports` gate steps. CI checks that the build leaves no diff in the vendored types. Baseline re-recorded: **33 / 33**. |
| 5 `docs: …` | READMEs (repo, `solid-yield`, `eslint-plugin-solid-yield`; the plugin's existed), this file, D-011/D-015 marked implemented. |

**Publishing.** _(History: the repository is public since 2026-10-06.)_ Dev's ruling was a private GitHub repository `devagrawal09/solid-yield`, created after commit 1 and pushed after every commit. The extraction session could not do this from its sandbox:

- `gh` failed TLS verification (`x509: OSStatus -26276`);
- SSH to github.com failed (broken pipe);
- the target directory `/Users/devagr/solid-blocks` was not writable, so the repository was built in `/private/tmp/solid-blocks`.

From outside the sandbox:

```sh
mv /private/tmp/solid-blocks /Users/devagr/solid-blocks && cd /Users/devagr/solid-blocks
pnpm install --frozen-lockfile --offline     # refresh node_modules/.bin shims after the move
gh repo create devagrawal09/solid-yield --private --source . --remote origin
# one push per commit, so CI runs on each (commit 1's run is red by construction)
for c in $(git rev-list --reverse main); do git push origin "$c:refs/heads/main"; done
```

## Solid under test (D-016)

`solid-js`, `@solidjs/web` and `@solidjs/h` are declared `^2.0.0-rc.11`, the fork's declaration. On the registry this resolves to **`2.0.0-rc.13`** (`next`), two RCs ahead of the fork's local rc.11. Through `@solidjs/vite-plugin@3.0.0-next.35` (pinned exact, as in the fork) the twins compile with `@solidjs/compiler` / `@solidjs/babel-plugin` rc.13. `@solidjs/router` is `2.0.0-next.29`. There are no workspace links to Solid.

**Canary result: quiet.** All 30 of the fork's gate steps pass on rc.13. All 8 parity tests pass, along with every package test and every twin's typecheck and lint, and the plugin's compiled fixtures, regenerated through rc.13's compiler, are byte-identical. The only visible RC drift is in the vendored JSX types: rc.13 adds an optional `$key?: string | number` attribute to every element.

## Vendored files to regenerate per Solid RC

- `packages/yield/jsx/jsx.d.ts` and `jsx/jsx-properties.d.ts` are built from the installed `@solidjs/web`'s `types/` by `scripts/jsx-from-web.mjs`, then the unchanged `scripts/jsx-web-shared.mjs` (D-067's `TagType`, web's `SerializableAttributeValue`).
- The build regenerates them (`types:jsx`), and CI fails if a commit's lockfile and those files disagree.
- When Solid moves: `pnpm update solid-js @solidjs/web @solidjs/h`, then `pnpm build`, then commit `jsx/` with the lockfile and run the gate.
- If web's generated banner, its `solid-js` `Element` import or its `type Element = … // END - difference …` block changes shape, the script stops with a named error rather than guessing.
- `packages/vite-plugin-yield/test/fixtures/compiled/*.out` are the plugin's oracle (D-043). They pass through the published compiler, so a compiler RC that changes its output turns `pkg:vite-plugin-yield:test` red. Regenerate them only deliberately (`node test/fixtures/generate.mjs`) and review the diff: it is Solid's change, not ours.

## Working here

```sh
pnpm install --frozen-lockfile
pnpm build                       # packages/yield: dist/ + vendored JSX types
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json   # ≈30 s; --fast ≈15 s
```

- The gate never builds; a stale `dist/` gives spurious reds, so rebuild after pulling. Step `pkg:yield:dist-fresh` (`scripts/dist-fresh.mjs`, also in `--fast`) fails when any file in `packages/yield/dist/` is older than the newest file in its `src/`, build scripts or `tsconfig.build.json`. It goes by mtimes, so it fails after a checkout that touched `src/` until you run `pnpm build`.
- When the step list changes, re-record the baseline in the same commit (`--json documentation/yield-gate-baseline.json`) and update `yield-gate-baseline.md`.
- There is no pre-commit hook. `repo:prettier` in the gate covers formatting; prettier is pinned to the fork's 3.8.1.
- Patch docs with function-form replacements (`s.replace(a, () => b)`). A string replacement expands `` $` `` and once pasted DECISIONS.md into itself (fork incident).

## Known, recorded, not fixed

- **The plugin's "differential no-op" test skips.** It ran the plugin over Solid's own compiler fixtures, which stayed in Solid (D-043). `pkg:vite-plugin-yield:test` is otherwise whole: 81 passed, 1 skipped.
- **Changesets would release `vite-plugin-solid-yield` as a major.** It peer-depends on `solid-yield` as `workspace:^` since the review fixes (a caret on the current version, `^0.0.0` today), and a caret on a 0.x version admits no minor: `solid-yield`' first minor (0.0.0 → 0.1.0) leaves the range, and `pnpm changeset status` plans the plugin at major (0.0.0 → 1.0.0). `onlyUpdatePeerDependentsWhenOutOfRange` does not change it (the bump is out of range). Before the first release, decide: an explicit 0.x range (`>=0.1.0 <1`), releasing at 1.0, or versioning the plugin by hand for the first release.
- **`pnpm peers check` reports one unmet peer.** `@solidjs/vite-plugin@3.0.0-next.35` wants `vite ^8 || ^9`; the twins, their originals and the plugin's tests use `vite ^7`, as in the fork.
- **Not carried.** The fork's `scripts/example-blocks/{browser,bytes}.mjs`, the manual Chromium check and the client-bytes measurement (not gated, D-037). They need Playwright and the originals' production builds. The twins' `tests/browser.steps.mjs` are here; port the runner if the browser check is wanted again.
- **CI.** The repository is on GitHub (`devagrawal09/solid-yield`, private then; public since 2026-10-06), and CI's first Linux run of the gate was green (2026-10-04T19:24Z, Node 24 / pnpm 11). That run was the first check of the `linux-x64-gnu` compiler binary and of oxlint on Linux. Phase 4's commits are local until the orchestrator pushes them.

## Phase 4 ("extend"), 2026-10-05

Four commits on `main` after `84521e5`, each gated green. The gate has 34 steps; the baseline was re-recorded in commit 1. Nothing was pushed: the sandbox cannot reach GitHub.

| Commit | What |
| --- | --- |
| 1 `test: port the conformance harness (D-039); findings D-069` | `packages/yield/test/conformance` (its README), gate step `pkg:yield:conformance`. 12 scenarios, handwritten Solid against the library dialect, on the client, on the server and in hydration. Self-tests plant regressions. The library route's server output is compared with the compiler route's, frozen from the fork. yield-context dropped (D-036). Findings F1–F7 are in D-069. F7, a false server `READ_IN_VIEW`, is fixed in the runtime. |
| 2 `test: raise at every host …; D-070` | `test/raise.spec.tsx` (table-driven over 9 hosts, development and production builds) and `test/raise.type-tests.tsx` (`FailsOf` at each position). Findings in D-070. A raising hole's type is fixed (`GeneratorOps`). |
| 3 `perf: re-run the runtime-cost harness … (D-017)` | `examples/harness/runtime-cost/twins.mjs` measures each twin against its original over the parity script. `measure.mjs`'s workloads are rewritten: they had stopped writing after D-021. §8 has the numbers. |
| 4 `docs: getting started, refusals …` | `documentation/getting-started.md`, whose program is type-checked, linted and run as `packages/yield/test/docs/`; `documentation/refusals.md`; README links. The D-002 line was already in all four READMEs. |

### Open for Dev

- ~~**D-069 F6.**~~ Ruled D-074: the routes are not mixed (Phase 5).
- ~~**D-069 F1–F5.**~~ Ruled in Phase 5: F1 gone (D-079), F2 an oracle artifact (fixed), F3 gone (D-080), F4 the model (D-081), F5 a documented cost (D-082). D-069 has the status table; F8, found later, is open (Phase 5 below).
- ~~**D-070 F1 / F2.**~~ Ruled D-073 / D-072 and implemented (Phase 5).
- **Instruction counts.** Valgrind does not run on macOS arm64, so §8's synthetic numbers are wall time. On Linux, `node examples/harness/runtime-cost/measure.mjs --wall` restores the instruction counts.
- **Conformance coverage.** The fork's `$`-dialect-only scenarios (memo-effect-order, owner-routing, store-paths, …) have no library source yet. Porting them is a candidate for later work (`COVERAGE.md`, "Not ported").

## Phase 5 (Dev's rulings D-071–D-082), 2026-10-05

Five commits on `main` after `c6da576`, then ten more for Dev's amending rulings and the D-069 findings, each gated green (34 steps, the baseline unchanged). Nothing was pushed.

| Commit | What |
| --- | --- |
| 1 `docs: record D-071–D-075 …` (`bb65384`) | The five decisions; §1 / §3 / §7 and the READMEs for D-071 (the types say exactly what the runtime does) and D-074 (one route per app). |
| 2 `feat: an effect's raise joins its component's failures (D-073)` (`0deb1a7`) | `Create<K, E>`; `$effect` / `$settled` failures in the component's and a row's type; an absorbing `attempt` (since replaced by D-076). |
| 3 `feat: binding an event in a view is a hole (D-072)` (`c139676`) | `Bind<P, E>`, iterable `EventHandler`, `BoundEvent`; `perform` binds; `YIELD_IN_EVENT` removed from the transform and the lint; `no-unbound-event` (staged out of `recommended`). |
| 4 `refactor: bind every event in a view …` (`ea3a76e`) | Event attributes take only a bound handler; `Errored`'s `Reset` and fallback colors; every site migrated (counts in D-072). |
| 5 `feat: an event's in-flight state is a source (D-075)` (`8b6ab6b`) | `save.pending`. **Reverted** by A1. |

**The amendments** (D-075 amended, D-076, D-077):

| Commit | What |
| --- | --- |
| A1 `Revert "feat: an event's in-flight state is a source (D-075)"` (`2f8fe47`) | D-075 is types only: the pending source, its tests and getting-started §6 are gone (and this file's Phase 5 section, rewritten here). |
| A2 `feat: a bound handler that may wait is a may-wait marker, not pending (D-075)` (`6bf94c0`) | A bound handler's `P` no longer makes the view pending: `[MAY_WAIT]`, `MayWaitOf`, `View<P, E, W>` (`W` defaults to `boolean`); flow controls, boundaries, `h` and `lazy` pass it on. Lint warning `no-unshown-wait` (with types). |
| A3 `feat: an attempt's handler returns the failure, or nothing (D-076)` (`59b885b`) | One `attempt` signature, `H extends Error \| void`: absorbed gives `T \| undefined`; any other value refused; `[ATTEMPT_ABSORBS]` reworded. |
| A4 `feat: try/catch is not a routine form; attempt takes an event call (D-077)` (`2bd68c7`) | `attempt(() => call(), onError)`, the handler typed with the call's failures; `until` follows D-076; lint error `no-try-catch`; 16 sites migrated. |
| A5 `docs: HANDOFF …` (`6a66da5`) | This section, first version. |
| A6 `feat: an attempt's handler may be a generator, run as the host's code (D-078)` (`e5c876b`) | The handler runs as the host's routine code; its return decides: an `Error` fails, nothing or a value absorbs (amends D-076). `until` follows it. |
| A7 `feat: $effect is split, $effect(compute, effect) (D-079)` (`360371d`) | Solid's `createEffect(compute, effect)`: a pure tracked compute, an untracked effect phase (`READ_IN_EFFECT`); `$untrack` its own op; 31 sites migrated. D-069 F1 gone. |
| A8 `feat: a superseded $memo run runs to completion, its result discarded (D-080)` (`caf6117`) | No `gen.return()` on supersession. D-069 F3 gone. |
| A9 `test: the row oracles return their element, not a thunk; D-069 F2 resolved, F8` (`168ca21`) | The three row references returned a thunk; fixed, re-recorded. F2 was the oracle's. New finding F8 (open). |
| A10 `docs: D-081, D-082; D-069 status` | D-081: F4 is the model (§3, with the `$optimistic` example). D-082: F5 a documented cost (§8), measured by the new `examples/harness/ssr-keys/measure.mjs` (+7 bytes, 0.4%, on rendering's streamed `/` and `/settings`; 2 characters per level of rows). D-069's status table. This section. |

**Landed through A10.** D-071–D-082 are decided and, where they change code, implemented. Of D-069: F1, F2, F3 gone; F4 the model; F5 documented; F6 not mixed (D-074); F7 fixed; F8 open.

**After A10** (each gated green; the gate has 35 steps since A14):

| Commit | What |
| --- | --- |
| A11 `feat: tracking is the host's; $untrack removed (D-083)` (`bda1b10`) | A plain read in an effect phase is admitted, untracked because its host is; `$untrack`, `UntrackedRead`, `READ_IN_EFFECT`, `UNTRACK_IN_SETUP` removed (16 uses, all package tests; 0 twin uses). Amends D-079; closes D-042's `$untrack` and D-029 (`Inherit<T>` not added). |
| A12 `fix: a flow control's later prop reads are its own on the server (rendering /stream)` (`df06d89`) | A detector false positive (F7's sibling): Solid's server `For` re-reads a pending `each` when the view's template resolves its hole, inside the named view's run. Every flow-control prop getter now runs as the flow control's read. |
| A13 `fix: a pending view returned into a server hole is retried as itself (rendering /profile)` (`046387b`) | A library bug: a call-form component in a hole was re-created by Solid's server retry of that hole (the page set up twice); under it a Solid rc.13 slot bug spun in microtasks. `perform` hands a function view back to the server renderer as a one-element array. D-082 has both diagnoses. |
| A14 `test: server-render smoke in the gate` | Gate step `twins:ssr-smoke` (16 renders: rendering string + stream × 7 routes, room `/live`, hackernews' cached story); baseline re-recorded (35). |

### Open for Dev (Phase 5)

- ~~**D-072's `P` in a view says more than the runtime does.**~~ Ruled by D-075 as amended: a may-wait marker, never pending (A2).
- ~~**`try` / `catch` is invisible to the types.**~~ Ruled by D-077 (A4). Count: **16** `try` / `catch` in routine bodies, all migrated (effect 1, room 2, todos 5, todos-h 5, runtime.spec 3); none in conformance scenarios or docs.
- **`until`'s handler follows D-076.** Not in the ruling's words. `until` is an async `attempt`, and room's `post` could not absorb its delivery timeout in place otherwise (moving the wait into a second action would change which transaction it reads in). Revert it if `until` should stay failure-only.
- **The transform's twin fixtures keep 3 `try` / `catch`** (`packages/vite-plugin-yield/test/fixtures/twins`: effect's `place`, room's `drop` and `post`). They are the transform's oracle (D-043), frozen as D-072 left their unbound events. Regenerating them from the migrated twins is a deliberate oracle change; say if you want it.
- **`no-unshown-wait` fires 7 times in the twins** (todos `retry` / `toggle` / `clear`, the same in todos-h, room's `submit`). They stay warnings: the originals show no in-flight state there, and the twins keep parity. With the pending source reverted, "show its in-flight state" means state the app writes itself; there is no library form for it.
- **A view annotated without `W` counts as may-wait.** `W` defaults to `boolean` so that every existing annotation accepts a may-wait view, and `MayWaitOf` reads `boolean` as "may" (as `PendingOf` does). `yield* v` of a `v: View<false, never>` therefore marks the enclosing view. The marker only drives a warning, and the lint reads the handler, not the view.
- **A handler returning a non-`Error` value is refused with the `[ATTEMPT_ABSORBS]` text.** TypeScript falls back to the constraint `Error | void` and prints the brand with it. The message names both allowed returns, but not the value's mistake specifically.
- ~~**An attempt over a call types its handler's parameter as the call's `FailsOf`.**~~ Ruled by D-087 (implemented): typed failures are branded at run time; anything else is re-thrown past the handler. Was: That is the model's claim for `yield* call` too. An untyped `throw` inside the called event (`no-throw`; `UNTYPED_THROW` in development) would reach the handler outside that type.
- **Plain functions in event attributes are refused.** "Any non-handler there is a type error" was read to cover `onClick={() => …}` too: a plain function can call an event whose colors would then reach no type. One twin site changed (room's `() => regenerate(reset)`). `Errored`'s `reset` is the one plain function kept, typed as already bound because it has no colors.
- **A row `Errored` fallback has its parameters annotated.** TypeScript does not infer them, even with `For`'s own row signature in a `declare function`. §7 records it.
- ~~**D-069 F8: a nested row's server read order**~~ Ruled by D-084: the model (a view's holes are read before its children on the server). Was: (yield-row-recursive, server). The oracle reads `open a` for the toggle, renders the nested rows, then reads `open a` again for the `<ul>`'s `style`; the library reads both of `a`'s holes first. Same reads, values and markup; server only. Declared with F5; not judged. Rule on it.
- ~~**rendering-yield's streamed SSR, found while measuring D-082.**~~ Fixed (A12, A13); the gate now renders every twin page on the server (A14). Left: the Solid rc.13 slot loop under `/profile` (D-082) is Solid's; its issue is drafted in `documentation/upstream/solid-ssr-memo-loop-rc13.md` (not yet filed); the twins' hydration of their server output is still checked by nothing here. Was: Through `vite dev`'s SSR loader (development builds), `renderToStream` of `/profile` never ends (the process blocks; the original's ends) and of `/stream` fails with a server `READ_IN_VIEW` in `MemoList` (a `For` over a streamed memo under a `Loading` in a hole). No gate step renders the twins' pages on the server, so nothing caught it. Details in D-082.

## Review 2026-10-05

Two independent, read-only design reviews of `main` at `f608fa7`, kept verbatim:

- `documentation/reviews/2026-10-05-claude.md` (Claude; its file:line citations are at `df06d89`);
- `documentation/reviews/2026-10-05-codex.md` (Codex).

The Solid rc.13 SSR loop found under rendering's `/profile` (D-082) is drafted as an upstream issue in `documentation/upstream/solid-ssr-memo-loop-rc13.md` (status: draft, not yet filed).

### Rulings (Dev, 2026-10-05)

| Decision | Review | Ruling | Status |
| --- | --- | --- | --- |
| D-084 | D-069 F8 | On the server a view's holes are read before its children; the markup is unaffected. The model. | Documented (§3); D-069 fully resolved |
| D-085 | R1 (Claude G-2) | A bound event's failure routes to the bind site; the creation-time `BOUNDARY` lookup and context are removed | Implemented (the `BOUNDARY` context stays: the bind reads it); conformance `error-routing` |
| D-086 | R2 (both) | An unyielded component call is refused: `Fragment` children typed `Element`; lint `component-call-yielded` (autofix); fix todos-yield `app.tsx:269` | Implemented; the type half needs `jsxFactory` / `jsxFragmentFactory` in the tsconfig (see Open) |
| D-087 | R4 (Claude G-3) | Typed failures branded at run time in every build; an attempt over a call handles only branded failures, re-throws the rest | Implemented (`FAILURE` brand; raise.spec, dev and production) |
| D-088 | R5 (Claude I-1 / G-4) | A yield component handed to foreign code is `View<boolean, never>`: `foreign(Comp)`, lint `no-unchecked-foreign-handoff`; room's `route()` → `foreign()`, its row `Errored`s removed; D-067 reworded, D-023 corrected | Implemented. room keeps its `Live`-root `Errored` (`foreign` requires it); hackernews-spa (3 routes) and rendering (`App`) gained one each, which their originals lack (see Open) |
| D-089 | R6 | `view(function* …)` is required; `require-view-wrapper` (error, autofix); D-054 amended | Implemented (`[VIEW_WRAPPER]` at `component(`; a row's bare view is refused without the message, see DECISIONS) |
| D-091 | R3 (Codex §3, Claude G-7) | An `$event` does not attempt a stream (`StreamAttempt` is not an `EventOp`; `STREAM_IN_EVENT`); a stream attempt's handler is a plain function (`[STREAM_HANDLER]`) | Implemented |
| D-090 | R7 (Claude G-5) | An `$effect` compute waiting on a pending read holds no `Loading`; `Create<"effect">` carries no pending; a runtime test pins it | Implemented (the test confirms Solid holds no `Loading`) |

### Open for Dev (review)

- ~~**R3, stream error handlers**~~ Ruled by D-091 (implemented): an `$event` does not attempt a stream; a stream's handler is a plain function.
- **D-086's fragment refusal needs two tsconfig options.** TypeScript checks a fragment's children only when `jsxFragmentFactory` (and so `jsxFactory`) is set; `jsx-runtime.d.ts`'s `Fragment` is typed `Element` and the package's and twins' tsconfigs set both, but a user's project without them gets only the lint. Confirm the requirement, or rule fragments lint-only.
- **A provider-rooted `Errored` keeps its fallback out of the DOM** (found implementing D-085, not fixed). A call-form `Errored` held by a context provider tag at a view's root, rendered under another `Errored`, takes a failure but never shows its fallback; handwritten Solid does. Pre-existing (a memo's failure too). D-085's "Found, not fixed" has the shape.
- **The upstream issue** (`documentation/upstream/solid-ssr-memo-loop-rc13.md`) awaits "file it".
- **D-088 added boundaries to two twins the ruling did not name.** hackernews-spa's routes may fail (`ApiError`) and rendering's `App` may fail (`profile` / `feed` / `stream`); both originals let such a failure reach the root. `foreign()` refuses them, so hackernews has an `Errored` at each route's root (3) and rendering one around its pages (1), with fallbacks the originals do not have. Parity and the SSR smoke are green (no failure path is scripted). Confirm, or rule a different shape for twins whose original lets a failure reach the root (D-023's corrected validation counts them: room 1, hackernews-spa 3, rendering 1).
- **`foreign`'s message cannot name the component** (a type has no access to it); it lists the failures' `kind`s. The lint names the component.

### Fixes with no ruling needed (from the reviews; not yet done)

- The plugin's `function*` prefilter misses generator methods.
- `Loading.on` and `h(Loading)` colors.
- Docs drift: ESLint `html` remnants; §1's `createTrackedEffect` / `untrack`; §7's D-072 wording; room's "a row is settled"; D-082's stale text (§8's "Not measured" line, fixed since by `df06d89` / `046387b`).
- Root exports trimmed to the user model.
- `isElementThunk` sniffs the `"hyper-element"` symbol description (against D-004); it needs a public check.
- A gate step that hydrates a twin's server output.
- Attribution: LICENSE and package `author` → Dev, with Solid's MIT notice for the vendored originals and the generated JSX types.
- `@solidjs/h` as a peer dependency; the plugin's peer range.
- The ESLint plugin's description, and `@typescript-eslint/parser` as a peer.
- Collapse the changesets into one initial release note (43 at `f608fa7`; the Claude review counts 44, its README included).

## First-time-user review #2 (Codex, 2026-10-06)

A second first-time user (Codex) built a notes app from the published docs only (log and app outside the repository, `/private/tmp/sy-review-2/{log.md,app}`). Its classification against the first review, tallied: **fixed 6, still present 3, new 3**; 2 not re-tested.

- **Fixed (6):** F2, install and version advice (was 3/4/5); 1/22, real router and app-wide context (`foreign(Settings, { provided: [ThemeCtx] })`); 2/14, test setup and client build; 8/9, `Handler` and the wait warning's defaults (documentation); 17/18, error extraction and `reset` (documentation); 23, package-relative links and `yield *` spacing (the root README still links repository-relative).
- **Still present (3):** **F1**, event writes held until the transaction ends: *still present (behaviour); fixed (documentation)*. That is the model (an `$optimistic` written at the event's start shows the in-flight state, and the guide says so); no change. **F5**, row / view / context structure: still present (the rules); fixed (documentation). Sandbox network and port-binding failures: still present (environment, not the library).
- **New (3):** **F3**, a parameterized route did not typecheck as the recipe wrote it (`Props<RouteProps<"/notes/:mode">>` in a bare `{ path, component: foreign(Notes) }` object: TS2322). This is the router's contract: a bare route's `component` takes no params, and a plain Solid page fails the same way. Fixed in the recipe: it now registers the page with `defineRoute`. `router.type-tests.tsx` and `router.spec.tsx` pin it against `@solidjs/router` 2.0.0-next.35, now a devDependency of `packages/yield`. **F4**, the recommended lint extended to tests reported the guide's `import { flush } from "solid-js"`. Fixed in the rule, keeping one recommended config (D-005): the import is allowed, and only a `flush` used in a routine is reported. A lint test runs the recommended config over the guide's test block. jsdom's `scrollTo` "not implemented" warning under router navigation: new (environment); the router spec stubs it.
- **Not re-tested (2):** 15, form/select view roots (fixed since, `0007462`); 19/20/21, the deliberate-mistake diagnostics.
