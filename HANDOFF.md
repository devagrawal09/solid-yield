# HANDOFF — solid-blocks (checkpoint 2026-10-05; Phase 4 "extend" complete)

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

- **D-069 F6.** The library route and the compiler route number hydration keys differently, so neither can hydrate the other's markup. A future compiler route either adopts Solid's owner numbering or ships its own client.
- **D-069 F1–F5.** These are declared differences from handwritten Solid: `$effect`'s order, rows rendered once, superseded memo runs closed, events held as a transaction, deeper hydration keys. They are pinned, not judged. Rule on any you want changed.
- **D-070 F1 / F2.** An `$effect`'s or `$settled`'s raise, and a DOM-dispatched `$event`'s failure, are in no view type, though they fail at run time. D-070 lists the options for each.
- **Instruction counts.** Valgrind does not run on macOS arm64, so §8's synthetic numbers are wall time. On Linux, `node examples/harness/runtime-cost/measure.mjs --wall` restores the instruction counts.
- **Conformance coverage.** The fork's `$`-dialect-only scenarios (memo-effect-order, owner-routing, store-paths, …) have no library source yet. Porting them is a candidate for later work (`COVERAGE.md`, "Not ported").
