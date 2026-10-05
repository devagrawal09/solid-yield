# HANDOFF — solid-blocks (checkpoint 2026-10-05; Phase 5 through D-082; next D-083)

This repository was extracted from the Solid fork `devagrawal09/solid`, branch `blocks-lib`, at commit **`6978eb83`** (D-015). Git history was not carried; the fork keeps it. The fork's own handoff at that commit (Phases 1A, 1B and 2, and its environment notes) is `git show 6978eb83:HANDOFF.md` in the fork.

## Where things are

| Commit | What |
| --- | --- |
| 1 `chore: scaffold the monorepo` | pnpm 11 workspace, root tooling, `scripts/blocks-gate.mjs` (the fork's gate minus its compiler steps), `.github/workflows/gate.yml` (CI = the gate), a fresh changesets config. The gate is red here by construction: there is nothing to gate. |
| 2 `feat: move …` | the 3 packages, the 8 twins, `examples/harness`, the 6 originals under `examples/originals/`, the docs, the 29 changesets. Verbatim apart from the edits the move needs; the commit message lists them. Vendored JSX types. First baseline: **30 / 30** on published rc.13. |
| 3 `refactor: rename …` | D-011: `solid-blocks`, `vite-plugin-solid-blocks`, `eslint-plugin-solid-blocks`, all in one commit. |
| 4 `test: exports-conditions matrix …` | `pkg:*:exports` gate steps. CI checks that the build leaves no diff in the vendored types. Baseline re-recorded: **33 / 33**. |
| 5 `docs: …` | READMEs (repo, `solid-blocks`, `eslint-plugin-solid-blocks`; the plugin's existed), this file, D-011/D-015 marked implemented. |

**Publishing.** Dev's ruling was a private GitHub repository `devagrawal09/solid-blocks`, created after commit 1 and pushed after every commit. The extraction session could not do this from its sandbox:

- `gh` failed TLS verification (`x509: OSStatus -26276`);
- SSH to github.com failed (broken pipe);
- the target directory `/Users/devagr/solid-blocks` was not writable, so the repository was built in `/private/tmp/solid-blocks`.

From outside the sandbox:

```sh
mv /private/tmp/solid-blocks /Users/devagr/solid-blocks && cd /Users/devagr/solid-blocks
pnpm install --frozen-lockfile --offline     # refresh node_modules/.bin shims after the move
gh repo create devagrawal09/solid-blocks --private --source . --remote origin
# one push per commit, so CI runs on each (commit 1's run is red by construction)
for c in $(git rev-list --reverse main); do git push origin "$c:refs/heads/main"; done
```

## Solid under test (D-016)

`solid-js`, `@solidjs/web` and `@solidjs/h` are declared `^2.0.0-rc.11`, the fork's declaration. On the registry this resolves to **`2.0.0-rc.13`** (`next`), two RCs ahead of the fork's local rc.11. Through `@solidjs/vite-plugin@3.0.0-next.35` (pinned exact, as in the fork) the twins compile with `@solidjs/compiler` / `@solidjs/babel-plugin` rc.13. `@solidjs/router` is `2.0.0-next.29`. There are no workspace links to Solid.

**Canary result: quiet.** All 30 of the fork's gate steps pass on rc.13. All 8 parity tests pass, along with every package test and every twin's typecheck and lint, and the plugin's compiled fixtures, regenerated through rc.13's compiler, are byte-identical. The only visible RC drift is in the vendored JSX types: rc.13 adds an optional `$key?: string | number` attribute to every element.

## Vendored files to regenerate per Solid RC

- `packages/blocks/jsx/jsx.d.ts` and `jsx/jsx-properties.d.ts` are built from the installed `@solidjs/web`'s `types/` by `scripts/jsx-from-web.mjs`, then the unchanged `scripts/jsx-web-shared.mjs` (D-067's `TagType`, web's `SerializableAttributeValue`).
- The build regenerates them (`types:jsx`), and CI fails if a commit's lockfile and those files disagree.
- When Solid moves: `pnpm update solid-js @solidjs/web @solidjs/h`, then `pnpm build`, then commit `jsx/` with the lockfile and run the gate.
- If web's generated banner, its `solid-js` `Element` import or its `type Element = … // END - difference …` block changes shape, the script stops with a named error rather than guessing.
- `packages/vite-plugin-blocks/test/fixtures/compiled/*.out` are the plugin's oracle (D-043). They pass through the published compiler, so a compiler RC that changes its output turns `pkg:vite-plugin-blocks:test` red. Regenerate them only deliberately (`node test/fixtures/generate.mjs`) and review the diff: it is Solid's change, not ours.

## Working here

```sh
pnpm install --frozen-lockfile
pnpm build                       # packages/blocks: dist/ + vendored JSX types
node scripts/blocks-gate.mjs --baseline documentation/blocks-gate-baseline.json   # ≈30 s; --fast ≈15 s
```

- The gate never builds; a stale `dist/` gives spurious reds, so rebuild after pulling.
- When the step list changes, re-record the baseline in the same commit (`--json documentation/blocks-gate-baseline.json`) and update `blocks-gate-baseline.md`.
- There is no pre-commit hook. `repo:prettier` in the gate covers formatting; prettier is pinned to the fork's 3.8.1.
- Patch docs with function-form replacements (`s.replace(a, () => b)`). A string replacement expands `` $` `` and once pasted DECISIONS.md into itself (fork incident).

## Known, recorded, not fixed

- **The plugin's "differential no-op" test skips.** It ran the plugin over Solid's own compiler fixtures, which stayed in Solid (D-043). `pkg:vite-plugin-blocks:test` is otherwise whole: 81 passed, 1 skipped.
- **Changesets would release `vite-plugin-solid-blocks` as a major.** It peer-depends on `solid-blocks` as `workspace:*`, which publishes as the exact version, so `solid-blocks`' first minor (0.0.0 → 0.1.0) leaves the range. Before the first release, decide the plugin's peer range for `solid-blocks` (e.g. `workspace:^` plus a 1.0, or an explicit range).
- **`pnpm peers check` reports one unmet peer.** `@solidjs/vite-plugin@3.0.0-next.35` wants `vite ^8 || ^9`; the twins, their originals and the plugin's tests use `vite ^7`, as in the fork.
- **Not carried.** The fork's `scripts/example-blocks/{browser,bytes}.mjs`, the manual Chromium check and the client-bytes measurement (not gated, D-037). They need Playwright and the originals' production builds. The twins' `tests/browser.steps.mjs` are here; port the runner if the browser check is wanted again.
- **CI.** The repository is on GitHub (`devagrawal09/solid-blocks`, private), and CI's first Linux run of the gate was green (2026-10-04T19:24Z, Node 24 / pnpm 11). That run was the first check of the `linux-x64-gnu` compiler binary and of oxlint on Linux. Phase 4's commits are local until the orchestrator pushes them.

## Phase 4 ("extend"), 2026-10-05

Four commits on `main` after `84521e5`, each gated green. The gate has 34 steps; the baseline was re-recorded in commit 1. Nothing was pushed: the sandbox cannot reach GitHub.

| Commit | What |
| --- | --- |
| 1 `test: port the conformance harness (D-039); findings D-069` | `packages/blocks/test/conformance` (its README), gate step `pkg:blocks:conformance`. 12 scenarios, handwritten Solid against the library dialect, on the client, on the server and in hydration. Self-tests plant regressions. The library route's server output is compared with the compiler route's, frozen from the fork. blocks-context dropped (D-036). Findings F1–F7 are in D-069. F7, a false server `READ_IN_VIEW`, is fixed in the runtime. |
| 2 `test: raise at every host …; D-070` | `test/raise.spec.tsx` (table-driven over 9 hosts, development and production builds) and `test/raise.type-tests.tsx` (`FailsOf` at each position). Findings in D-070. A raising hole's type is fixed (`GeneratorOps`). |
| 3 `perf: re-run the runtime-cost harness … (D-017)` | `examples/harness/runtime-cost/twins.mjs` measures each twin against its original over the parity script. `measure.mjs`'s workloads are rewritten: they had stopped writing after D-021. §8 has the numbers. |
| 4 `docs: getting started, refusals …` | `documentation/getting-started.md`, whose program is type-checked, linted and run as `packages/blocks/test/docs/`; `documentation/refusals.md`; README links. The D-002 line was already in all four READMEs. |

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
| 3 `feat: binding an event in a view is a hole (D-072)` (`c139676`) | `Bind<P, E>`, iterable `EventHandler`, `BoundEvent`; `perform` binds; `BLOCKS_YIELD_IN_EVENT` removed from the transform and the lint; `no-unbound-event` (staged out of `recommended`). |
| 4 `refactor: bind every event in a view …` (`ea3a76e`) | Event attributes take only a bound handler; `Errored`'s `Reset` and fallback colors; every site migrated (counts in D-072). |
| 5 `feat: an event's in-flight state is a source (D-075)` (`8b6ab6b`) | `save.pending`. **Reverted** by A1. |

**The amendments** (D-075 amended, D-076, D-077):

| Commit | What |
| --- | --- |
| A1 `Revert "feat: an event's in-flight state is a source (D-075)"` (`2f8fe47`) | D-075 is types only: the pending source, its tests and getting-started §6 are gone (and this file's Phase 5 section, rewritten here). |
| A2 `feat: a bound handler that may wait is a may-wait marker, not pending (D-075)` (`6bf94c0`) | A bound handler's `P` no longer makes the view pending: `[MAY_WAIT]`, `MayWaitOf`, `View<P, E, W>` (`W` defaults to `boolean`); flow controls, boundaries, `h` and `lazy` pass it on. Lint warning `no-unshown-wait` (with types). |
| A3 `feat: an attempt's handler returns the failure, or nothing (D-076)` (`59b885b`) | One `attempt` signature, `H extends Error \| void`: absorbed gives `T \| undefined`; any other value refused; `[ATTEMPT_ABSORBS]` reworded. |
| A4 `feat: try/catch is not a block form; attempt takes an event call (D-077)` (`2bd68c7`) | `attempt(() => call(), onError)`, the handler typed with the call's failures; `until` follows D-076; lint error `no-try-catch`; 16 sites migrated. |
| A5 `docs: HANDOFF …` (`6a66da5`) | This section, first version. |
| A6 `feat: an attempt's handler may be a generator, run as the host's code (D-078)` (`e5c876b`) | The handler runs as the host's block code; its return decides: an `Error` fails, nothing or a value absorbs (amends D-076). `until` follows it. |
| A7 `feat: $effect is split, $effect(compute, effect) (D-079)` (`360371d`) | Solid's `createEffect(compute, effect)`: a pure tracked compute, an untracked effect phase (`READ_IN_EFFECT`); `$untrack` its own op; 31 sites migrated. D-069 F1 gone. |
| A8 `feat: a superseded $memo run runs to completion, its result discarded (D-080)` (`caf6117`) | No `gen.return()` on supersession. D-069 F3 gone. |
| A9 `test: the row oracles return their element, not a thunk; D-069 F2 resolved, F8` (`168ca21`) | The three row references returned a thunk; fixed, re-recorded. F2 was the oracle's. New finding F8 (open). |
| A10 `docs: D-081, D-082; D-069 status` | D-081: F4 is the model (§3, with the `$optimistic` example). D-082: F5 a documented cost (§8), measured by the new `examples/harness/ssr-keys/measure.mjs` (+7 bytes, 0.4%, on rendering's streamed `/` and `/settings`; 2 characters per level of rows). D-069's status table. This section. |

**Landed through A10.** D-071–D-082 are decided and, where they change code, implemented. Of D-069: F1, F2, F3 gone; F4 the model; F5 documented; F6 not mixed (D-074); F7 fixed; F8 open.

**D-083** (Dev) — `$untrack` removed: a plain read in an effect phase is admitted and untracked because its host is (amends D-079; closes D-042's `$untrack` and D-029). Implemented in `feat: tracking is the host's; $untrack removed (D-083)`.

### Open for Dev (Phase 5)

- ~~**D-072's `P` in a view says more than the runtime does.**~~ Ruled by D-075 as amended: a may-wait marker, never pending (A2).
- ~~**`try` / `catch` is invisible to the types.**~~ Ruled by D-077 (A4). Count: **16** `try` / `catch` in block bodies, all migrated (effect 1, room 2, todos 5, todos-h 5, runtime.spec 3); none in conformance scenarios or docs.
- **`until`'s handler follows D-076.** Not in the ruling's words. `until` is an async `attempt`, and room's `post` could not absorb its delivery timeout in place otherwise (moving the wait into a second action would change which transaction it reads in). Revert it if `until` should stay failure-only.
- **The transform's twin fixtures keep 3 `try` / `catch`** (`packages/vite-plugin-blocks/test/fixtures/twins`: effect's `place`, room's `drop` and `post`). They are the transform's oracle (D-043), frozen as D-072 left their unbound events. Regenerating them from the migrated twins is a deliberate oracle change; say if you want it.
- **`no-unshown-wait` fires 7 times in the twins** (todos `retry` / `toggle` / `clear`, the same in todos-h, room's `submit`). They stay warnings: the originals show no in-flight state there, and the twins keep parity. With the pending source reverted, "show its in-flight state" means state the app writes itself; there is no library form for it.
- **A view annotated without `W` counts as may-wait.** `W` defaults to `boolean` so that every existing annotation accepts a may-wait view, and `MayWaitOf` reads `boolean` as "may" (as `PendingOf` does). `yield* v` of a `v: View<false, never>` therefore marks the enclosing view. The marker only drives a warning, and the lint reads the handler, not the view.
- **A handler returning a non-`Error` value is refused with the `[ATTEMPT_ABSORBS]` text.** TypeScript falls back to the constraint `Error | void` and prints the brand with it. The message names both allowed returns, but not the value's mistake specifically.
- **An attempt over a call types its handler's parameter as the call's `FailsOf`.** That is the model's claim for `yield* call` too. An untyped `throw` inside the called event (`no-throw`; `UNTYPED_THROW` in development) would reach the handler outside that type.
- **Plain functions in event attributes are refused.** "Any non-handler there is a type error" was read to cover `onClick={() => …}` too: a plain function can call an event whose colors would then reach no type. One twin site changed (room's `() => regenerate(reset)`). `Errored`'s `reset` is the one plain function kept, typed as already bound because it has no colors.
- **A row `Errored` fallback has its parameters annotated.** TypeScript does not infer them, even with `For`'s own row signature in a `declare function`. §7 records it.
- **D-069 F8: a nested row's server read order** (blocks-row-recursive, server). The oracle reads `open a` for the toggle, renders the nested rows, then reads `open a` again for the `<ul>`'s `style`; the library reads both of `a`'s holes first. Same reads, values and markup; server only. Declared with F5; not judged. Rule on it.
- **rendering-blocks' streamed SSR, found while measuring D-082, not fixed.** Through `vite dev`'s SSR loader (development builds), `renderToStream` of `/profile` never ends (the process blocks; the original's ends) and of `/stream` fails with a server `READ_IN_VIEW` in `MemoList` (a `For` over a streamed memo under a `Loading` in a hole). No gate step renders the twins' pages on the server, so nothing caught it. Details in D-082.
