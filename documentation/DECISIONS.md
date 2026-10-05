# DECISIONS — `@solidjs/blocks` build-out

Decision log for the blocks-library build-out on `blocks-lib`. One entry per decision: what was decided, the alternatives on the table, and why. New decisions append; a reversed decision is not edited but superseded by a new entry that names it. Forks of a topic branch are logged here too (see "Branch log").

> **Provenance.** The original of this file (26 entries, committed on `blocks-lib` in a container on 2026-10-04) was lost unpushed when that container's disk filled. This version was **reconstructed on 2026-10-04 from the session handoff**, which carried the decisions and their one-line rationale but not the full alternatives text. Where an entry's reasoning is thinner than it was, it says so. Entries whose content the handoff did not carry (D-015's text, D-025, D-026) are marked **lost** and left blank rather than invented. Per-entry ownership was not carried either: by D-002, design decisions are Dev's; process decisions were proposed by Claude and accepted by Dev. Re-affirm or correct any entry by appending, not editing.

Reading order with the rest of the plan: `blocks-library.md` (the reference), this file, `blocks-gate-baseline.md` (what "green" means).

> **Names (Phase 3).** Entries written in the Solid fork use the in-repo names `@solidjs/blocks`, `@solidjs/vite-plugin-blocks` and `@solidjs/eslint-plugin-blocks`, and the lint prefix `@solidjs/blocks/<rule>`. They are left as written (a log is not edited). Since the extraction's rename commit (D-011) the packages are `solid-blocks`, `vite-plugin-solid-blocks` and `eslint-plugin-solid-blocks`, and the lint prefix is `solid-blocks/<rule>`. Fork paths in entries (`documentation/plans/…`, `examples/blocks-harness`, `examples/<original>`) are `documentation/…`, `examples/harness` and `examples/originals/<original>` here.

## Index

| ID | Status | Decision |
| --- | --- | --- |
| D-001 | decided | Destination: standalone npm packages, not a PR to solidjs/solid |
| D-002 | decided | Audience: Dev as designer — a design lab; rigor over polish |
| D-003 | implemented (Phase 2) | JSX rule shipped as our own small Babel/Vite plugin (`@solidjs/vite-plugin-blocks`) |
| D-004 | decided | Solid PUBLIC API only, hard rule |
| D-005 | decided | One way per thing: remove aliases/overloads |
| D-006 | decided | Maximal strictness; no `read()`/`accessor()` escape hatches |
| D-007 | decided | Tip `dfe692cf` is the baseline; intent inferred and recorded |
| D-008 | decided | Gate per commit |
| D-009 | decided | Topic branches `bl/<topic>`, conventional commits + changesets, ff into `blocks-lib` |
| D-010 | decided | Order: tighten → standalone plugin → extract → extend |
| D-011 | implemented (Phase 3) | npm names unscoped: `solid-blocks`, `vite-plugin-solid-blocks`, `eslint-plugin-solid-blocks` |
| D-012 | decided | No-JSX `h`/`html` flavor is first-class |
| D-013 | decided | Rows and holes are bare `function*`; `$` and `$scope` removed |
| D-014 | decided | `$optimistic` / `$optimisticStore` mirror `$signal` / `$store` |
| D-015 | implemented (Phase 3) | Extraction: new pnpm monorepo `solid-blocks` with twins and vendored originals (Q22 closed) |
| D-016 | decided | Peer range `^2.0.0-rc`; twins' parity tests are the canary |
| D-017 | decided | Perf not in the gate |
| D-018 | dissolved | (open components) — dissolved by D-023 |
| D-019 | decided | Untyped sync throws: `[UNTYPED_THROW]` in dev, nearest `<Errored>` in prod |
| D-020 | decided | `$event` is always a transaction |
| D-021 | decided | Dev-mode receipt tracking → `[UNYIELDED_WRITE]` |
| D-022 | decided | Remove stray gitlink `async-reactivity-walkthrough` |
| D-023 | implemented (1B) | Type linker removed; prop colors declared (as `Source<T, E, P>`, D-068) |
| D-024 | implemented (1B) | Bare prop type = settled, never fails; async is opt-in |
| D-025 | **lost** | — |
| D-026 | **lost** | — |
| D-027 | decided | The gate pins `TZ=UTC` |
| D-028 | decided | A setter called outside a block run throws in dev |
| D-029 | implemented (1B); closed (D-083) | Pass-through props: explicit generics; `Inherit<T>` is not added (7 generic components across 8 twins) |
| D-030 | decided | A row body is a setup |
| D-031 | implemented (Phase 2) | The JSX transform stays (D-003 stands); no compiler off switch was needed |
| D-032 | decided | A view has no body: reads only in JSX positions, structure only via flow controls |
| D-033 | decided | No boundary = the failure is re-thrown; D-019 reworded |
| D-034 | decided | Error types carry a literal `kind`; one `Failure` constraint at every `E` entry point |
| D-035 | decided | `start()` removed |
| D-036 | decided | `context()` removed; `yield* Ctx` is the one way to read a context |
| D-037 | decided | D-008 amended: no Chromium clause; `oxlint` is a real gate step |
| D-038 | decided | Flow controls accept holes as well as sources |
| D-039 | implemented (Phase 4) | Conformance harness ported in Phase 4 |
| D-040 | implemented (1B) | A declared prop color is permission only |
| D-041 | decided | JSX only in view / hole / row returns; a setup never creates elements |
| D-042 | decided; `$untrack` closed (D-083) | All props are reactive; no static prop kind; `$snapshot` removed; `$untrack` (0 twin uses) removed by D-083 |
| D-043 | implemented (Phase 2) | After plugin parity, the fork's compiler and babel-plugin go back to pristine upstream (empty diff against `644eaf3b`) |
| D-044 | moot | `$dynamic` removed by D-058 |
| D-045 | decided | Parity is the only Solid-drift canary; no golden snapshots |
| D-046 | decided | `html`` ` flavor dropped; `h()` is the no-JSX flavor (D-012 amended) |
| D-047 | decided; module-URL pass implemented (Phase 2) | `@solidjs/blocks` exports `lazy` (colored); `adopt()` removed |
| D-048 | reversed | `latest` removed by D-064 |
| D-049 | decided | `h` flavor: the no-body rule is type-level only (`[HVIEW_READ]`) |
| D-050 | decided | D-013 amended: in JSX the hole is `yield*` only |
| D-051 | decided | D-032 amended: JSX enforcement is runtime + lint; type-level form for `h` only |
| D-052 | superseded | by D-060 (`constant()`); a plain default cannot be told from a plain context |
| D-053 | decided | `$effect` and `$settled` both stay: react vs run-once-after-settle |
| D-054 | decided | `view()` zero-runtime typing wrapper for error locality (no `setup()`) |
| D-055 | decided | A row receives `item: Source<T>` and `index: Source<number>` |
| D-056 | amended, implemented (1B) | by D-068: a plain annotation cannot be remapped by `$component` (TS); `Props<>` does the mapping |
| D-057 | decided | Phase 2 starts after Phase 1B lands (Q23 closed) |
| D-058 | decided | No server-component support in the model; SC twins removed or converted; `$dynamic` removed; D-044 moot |
| D-059 | decided | A row need not be settled: a row's failure propagates to the view holding the `<For>` |
| D-060 | decided | `constant(value)` export; `createContext` stays plain (D-052 superseded) |
| D-061 | decided | migrating-element twin removed (an element is not a value, D-041) |
| D-062 | decided | Components are called, not tagged; JSX tags are DOM elements only |
| D-063 | decided | Pending rows propagate like failing rows; `[UNSETTLED_ROW]` removed |
| D-064 | decided | `latest` removed (D-048 reversed) |
| D-065 | decided | Call-form props take a source, a hole or a settled value; no inline read in an argument |
| D-066 | decided | A component call's `children` is always a generator (lazy view; rows for lists) |
| D-067 | decided | Tags are DOM elements and foreign Solid components; block components are called (brand check) |
| D-068 | implemented (1B) | D-056 amended: `Props<{…}>` wrapper; colors declared as `Source<T, E = never, P = false>`; no `Async` |
| D-069 | recorded (Phase 4); ruled (Phase 5) | Conformance findings F1–F8: the library route against the oracle and the compiler route. F1 gone (D-079), F2 an oracle artifact (fixed), F3 gone (D-080), F4 the model (D-081), F5 a documented cost (D-082), F6 not mixed (D-074), F7 fixed; F8 open for Dev |
| D-070 | recorded (Phase 4) | Raise at every host: each reaches the nearest Errored or re-throws (D-033); an `$effect`'s and a DOM-dispatched `$event`'s failures are in no view type (ruled: D-072, D-073); a raising hole's type fixed |
| D-071 | decided | Meta-rule: the types say exactly what the runtime does; a color the runtime routes and the type lacks is a bug, never a §7 limitation |
| D-072 | implemented (Phase 5) | Binding an event in a view is a hole: `onClick={yield* save}` joins the handler's failures to the view (its `P`: the may-wait marker, D-075); the transform's event refusal moves to the types; lint `no-unbound-event` |
| D-073 | implemented (Phase 5) | An `$effect`'s or `$settled`'s raise joins the enclosing component's failure type, unless an attempt's `onError` absorbs it (the absorbing form: D-076) |
| D-074 | decided | The library route and the compiler route are not mixed: same markup, different hydration keys; server and client use one route |
| D-075 | implemented (Phase 5, amended) | Types only: a bound handler that may wait on a pending read marks the view *may wait* (`View<P, E, W>`), never pending; lint warning `no-unshown-wait`. The first ruling's `save.pending` source was built and reverted |
| D-076 | implemented (Phase 5) | An attempt's handler returns the failure (an `Error` with a literal `kind`) or nothing (absorbed: `T \| undefined`); any other value is a type error; `[ATTEMPT_ABSORBS]` for both |
| D-077 | implemented (Phase 5) | `try` / `catch` is not a block form (lint `no-try-catch`); `attempt` takes an event call, its typed failure through `onError`; 16 sites migrated |
| D-078 | implemented (Phase 5) | An attempt's handler may be a generator, run as the host's block code; its return decides: an `Error` fails, nothing or a value absorbs (amends D-076) |
| D-079 | implemented (Phase 5); amended by D-083 | `$effect(compute, effect)`: Solid's split effect, both halves generators; the compute tracks and is pure, the effect phase writes and reads untracked (supersedes D-053's one-pass form) |
| D-080 | implemented (Phase 5) | A superseded `$memo` run is not closed: it runs to completion and its result is discarded, as Solid's async memo (D-069 F3) |
| D-081 | decided, documented (Phase 5) | D-069 F4 is the model: an `$event` call is one transaction; a write made before it waits is held until it settles; `$optimistic` shows something during the wait |
| D-082 | decided, documented (Phase 5) | D-069 F5 is a documented cost (§8): the library route's hydration keys are 2 characters longer per nesting level; measured on rendering's SSR; hydration improves with the compiler |
| D-083 | implemented (Phase 5) | Tracking is a property of the host, not of the read: a plain read in an effect phase is admitted and untracked; `$untrack` removed (D-005, 0 twin uses); amends D-079, closes D-042's `$untrack` and D-029 |

## Entries

### D-001 — Destination: standalone npm packages
**Decided.** `@solidjs/blocks` and its companions ship as their own packages, not as a pull request against `solidjs/solid`.
*Alternatives:* a PR to `solid` adding the packages to the monorepo; keeping the work only on a fork branch.
*Reasoning:* the library is a userland counterpart of `experiment/iterable-signals` (which bakes the same model into compiler/core). Shipping it standalone keeps the two routes independently evaluable and avoids coupling a design-lab artifact to Solid's release train. Consequences: D-004 (public API only, so the packages can live outside the repo) and Phase 3 (extraction).

### D-002 — Audience: Dev as designer
**Decided.** The audience is Dev designing the model, not end users. Rigor (strict types, exhaustive dev errors, parity tests, a decision log) over polish (docs for newcomers, ergonomics).
*Alternatives:* a user-facing library with onboarding docs first.
*Reasoning:* the point of the build-out is to find out whether the model holds up; every ambiguity surfaced is a finding. README should say "this is the strict dialect; the compiler route is the ergonomic one" (design review).

### D-003 — JSX rule as our own Babel/Vite plugin
**Decided.** The one JSX-transform rule (`yield* e` inside a JSX expression/attribute in a generator → `perform(e)` from `blocksModule`) ships as a small standalone plugin (`vite-plugin-solid-blocks`, Phase 2) with no dependency on `@solidjs/compiler`/`@solidjs/babel-plugin` carrying it.
*Alternatives:* keep the rule in the Rust compiler and babel-plugin (where it is at baseline); require the compiler route.
*Reasoning:* D-001 — a standalone package cannot depend on an unreleased upstream transform. The Rust implementation stays as the oracle for fixture parity. *Status:* decided; implementation is Phase 2.

*Implemented (Phase 2, `bl/plugin`).* The package is `packages/vite-plugin-blocks`, named `@solidjs/vite-plugin-blocks` in the repo and `vite-plugin-solid-blocks` at extraction. Its only runtime dependencies are `@babel/core` and `magic-string`; `@solidjs/blocks` is a peer.

- **The rule** is lifted from the Babel copy into one function, `blocksRule(program)`, which classifies holes and refusals. Two appliers share it: `babelPluginBlocks` rewrites the AST, and `transform(code, { filename, blocksModule })` edits only the rewritten spans, so TypeScript and formatting are kept, the source map is exact, and it returns `null` when nothing changes.
- **The Vite plugin** `blocks()` runs `enforce: "pre"` before `solid()`. It skips a module with no `function*` unparsed, and its map chains through Vite.
- **Commits.** `a6575ff8`: package and fixture parity. `188a99fb`: Vite plugin, source-map test, a no-op over the 683 fixture files of Solid's compilers. `5770f1a5`: twins wired, plus D-047's module-URL pass. `013d20ce`: D-043.

### D-004 — Solid PUBLIC API only
**Decided, hard rule.** The runtime uses only exported, documented Solid 2 API. Anything the model needs that the public API cannot express is recorded in `blocks-library.md` §7 (Limitations) rather than reached for through internals.
*Alternatives:* patching core; importing from internal paths.
*Reasoning:* D-001 and D-016 — the packages must survive Solid's RC churn with the twins' parity tests as the only canary.

### D-005 — One way per thing
**Decided.** Aliases and overloads are removed rather than kept for convenience (examples: D-013 removes `$`/`$scope`; D-014 removes the `$optimistic` overload).
*Alternatives:* keep aliases as sugar with a lint preferring one form.
*Reasoning:* D-002 — in a design lab a second spelling hides whether the first is sufficient.

### D-006 — Maximal strictness; no escape hatches
**Decided.** No `read()`/`accessor()`/`paths()` escape hatches: every read and write in a block is a `yield*`. (The typed-failures v2 rewrite already removed them — see `.changeset/blocks-typed-failures-v2.md`.)
*Alternatives:* keep an escape hatch for interop, lint-gated.
*Reasoning:* the model's claim is that the generator protocol is complete; an escape hatch makes the claim untestable. Interop with plain Solid goes through `adopt()` and `context()` instead.

### D-007 — Baseline is `dfe692cf`
**Decided.** Dev's tip `dfe692cf` ("up", on top of "wip" `57d05dda`) is the baseline. Its unexplained intent was inferred from the diff and recorded in `.changeset/blocks-typed-failures-v2.md` and `blocks-library.md` §10 rather than reverted or re-derived.
*Alternatives:* baseline at the last documented commit `55f3c695` and re-apply.
*Reasoning:* the rewrite is coherent (typed failures v2) and the twins pass on it; recording intent is cheaper and more faithful than reconstruction. (Reconstructed note: this is also the baseline this file was rebuilt on after the container loss.)

### D-008 — Gate per commit
**Decided.** Every commit on a topic branch passes `scripts/blocks-gate.mjs`: for each of the 12 twins `test`, `typecheck`, `lint` (and `link:check` until Phase 1B removes it); `@solidjs/blocks` unit + type tests; `@solidjs/eslint-plugin-blocks` and `@solidjs/blocks-linker` tests; prettier check. ~~Chromium/Playwright steps run only before pushes.~~ (Dropped by D-037: no browser test exists.) "Green" = no step red that was green in the reference baseline run (see `blocks-gate-baseline.md`); pre-existing reds are listed there by name. *Reference run (reconstructed baseline, 2026-10-04, `09fa9de5`):* 52 pass / 2 fail / 1 skip over 55 steps; the reds are `pkg:blocks-linker:test` (3 staleness tests, fixture drift) and `pkg:compiler:test` (1 `blocks-summary` test not updated for `handler_fails` in `dfe692cf`), both pre-existing at the baseline and moot under D-023; `repo:oxlint` is SKIP (binary not installed). The babel-plugin and compiler steps run vitest only, against the already-built artifacts (the gate never builds). The timezone pin is D-027.
*Alternatives:* repo-wide `pnpm test` (too slow, and unrelated reds); gate only at merge.
*Reasoning:* the twins' DOM-parity tests are the model's only semantic oracle (D-016); running them per commit is what makes "ff when green" (D-009) meaningful. Build `@solidjs/blocks` with `--force` before gating — twins resolve it via `dist/`, and an unforced filtered build has produced spurious reds.

### D-009 — Branching and commit discipline
**Decided.** Topic branches `bl/<topic>` (branch names `blocks-lib/<x>` are impossible because `blocks-lib` exists as a branch). Conventional commits; one changeset per user-visible change; fast-forward into `blocks-lib` when the gate is green. Forks of a topic are logged in this file. Agent commits are authored `Claude <noreply@anthropic.com>`.
*Alternatives:* commit directly on `blocks-lib`; merge commits.
*Reasoning:* keeps `blocks-lib` linear and every commit gated, so bisecting a twin regression is one `git bisect` away.

### D-010 — Order of work
**Decided.** Phase 1A tighten (runtime/type hardening on the current repo) → Phase 1B declared prop colors → Phase 2 standalone plugin → Phase 3 extract to its own repo → Phase 4 extend.
*Alternatives:* extract first, then tighten in the new repo.
*Reasoning:* tightening needs the in-repo twins, the Rust compiler as oracle and the full Solid test infrastructure; extraction before that would duplicate all three. Phase 2 is file-disjoint from 1B and may run in parallel (Q23).

### D-011 — npm names unscoped
**Decided.** Published names are `solid-blocks`, `vite-plugin-solid-blocks`, `eslint-plugin-solid-blocks`. In-repo names stay `@solidjs/*` until extraction, where the rename is one commit.
*Alternatives:* `@solidjs/*` (implies org ownership we don't have); a personal scope.
*Reasoning:* D-001; unscoped names don't claim the Solid org's endorsement and need no scope access.

*Implemented (Phase 3, commit 3 of the extraction, "refactor: rename to the unscoped package names").* One commit renamed the three packages, every import and `jsxImportSource`, the lint plugin's namespace (`solid-blocks/<rule>` in every eslint config, rule id and disable comment), the vendored JSX types and their generators, the plugin's default `blocksModule` and its checked-in compiled fixtures (regenerated through the published compiler, byte-identical to the renamed files), the docs and the changesets. The package directories keep their names (`packages/blocks`, `packages/vite-plugin-blocks`, `packages/eslint-plugin-blocks`), and so do the gate's step names. This log keeps the names its entries were written with (see the names note at the top).

### D-012 — No-JSX flavor is first-class
**Decided.** The `h`/`html` flavor (`@solidjs/blocks/h`, `/html`) is first-class: same hole forms as JSX, same strictness, its own twins (`*-blocks-h`), and it must be a no-op for the JSX plugin.
*Alternatives:* JSX only; no-JSX as a best-effort subset.
*Reasoning:* the no-JSX flavor is the proof that the model does not depend on the transform (D-003): whatever JSX can express via the rule, `h` expresses without it. *Amended by D-046:* the flavor is `h()` only; the `html`` ` tagged template is dropped.

### D-013 — Rows and holes are bare `function*`
**Decided.** A row (list item body) or a hole (a reactive child/attribute position) is a zero-arity generator function; the runtime wraps it (as `holes.ts` `toHole` does). The `$` and `$scope` helpers are removed (lint `no-dollar-block` with autofix first; the rule stays as a deprecated-usage rule). A derivation reused in several holes is a `yield* $memo`.
*Alternatives:* keep `$` as the explicit marker; keep `$scope` for shared derivations.
*Reasoning:* D-005 — `$` was a second spelling of "this is a block"; `$scope` was a second spelling of `$memo`. Migration size at decision time: 33 twin sites + 14 test sites. *Implementation:* Phase 1A item 4.

### D-014 — `$optimistic` / `$optimisticStore` symmetry
**Decided.** `$optimistic` is the scalar form and `$optimisticStore` the object-or-body form, mirroring `$signal` / `$store`; the overload of `$optimistic` that accepted a body is removed. `context()`, `$snapshot` and `start` are kept as they are.
*Alternatives:* merge everything into one `$optimistic`; remove `context()` in favour of `createContext()`.
*Reasoning:* D-005 and symmetry with the existing pair. Whether `context()` and `createContext()` stay separate long-term is deferred until after Phase 1B. *Implementation:* Phase 1A item 5.

### D-015 — Repo layout for extraction
**Decided (Dev, 2026-10-04; Q22 closed).** Original text was lost; re-decided as the handoff's recommendation: a new pnpm monorepo `solid-blocks` with `packages/{blocks, vite-plugin-blocks, eslint-plugin-blocks}`, `examples/` twins plus vendored originals so the parity tests keep their oracle, the `@solidjs/web` JSX `.d.ts` vendored (today `types:jsx` builds it from `../web`), an exports-conditions matrix test, CI = the gate.

*Implemented (Phase 3, 2026-10-05).* This repository was extracted from the fork's `blocks-lib` at `6978eb83` in five commits. Git history was not carried.

1. Scaffold: a pnpm 11 workspace, the gate without its compiler steps, CI and changesets.
2. The move, verbatim apart from the edits it needs. The 8 twins keep their names. `examples/blocks-harness` became `examples/harness`. The 6 originals are vendored runnable under `examples/originals/`.
3. The D-011 rename.
4. The exports-conditions matrix (gate steps `pkg:*:exports`).
5. Docs.

- **Solid is the published one.** `solid-js`, `@solidjs/web` and `@solidjs/h` are declared `^2.0.0-rc.11`, which resolves to `2.0.0-rc.13`. There are no workspace links to Solid. The fork's `packages/compiler` and `packages/babel-plugin` were not carried: after D-043 they are upstream's, and the twins compile through the published `@solidjs/vite-plugin@3.0.0-next.35`, which uses compiler rc.13.
- **D-016's canary at extraction.** The gate is 30 / 30 on rc.13, against the fork's 30 / 30 on its local rc.11. All 8 parity tests pass. No public API the library or the twins use moved across two RCs.
- **The JSX types are vendored.** `types:jsx` is now `scripts/jsx-from-web.mjs`, then the unchanged `jsx-web-shared.mjs` (D-067's `TagType`). It re-stamps the installed `@solidjs/web`'s `types/jsx.d.ts` for blocks, the same two edits the fork's `jsx-sync --element/--import` made from `jsx-h.d.ts`, which is not published. The outputs are checked in and regenerated on every build. CI fails if the build leaves a diff. From rc.13 the output equals the fork's rc.11 output apart from the banner and rc.13's new `$key` attribute.
- **Exports matrix.** For each package, every subpath under default, development, browser, node and their combinations resolves to the table's file through esbuild, through Node (`--conditions`), and for types through TypeScript (`customConditions`). The checks run from a consumer's `node_modules`.
- **CI = the gate.** `.github/workflows/gate.yml` runs on Node 24 / pnpm 11: frozen install, build, the vendored-types check, then the gate against `documentation/blocks-gate-baseline.json` (33 steps, all passing).
- **Dropped with the compilers.** The plugin test "differential no-op", which ran over Solid's compiler fixtures, now skips.
- **Not carried.** The fork's manual `scripts/example-blocks/{browser,bytes}.mjs`, the Chromium check and the client-bytes measurement, are not gated (D-037). The twins' `tests/browser.steps.mjs` are carried.

### D-016 — Peer range and canary
**Decided.** Peer dependency on Solid is `^2.0.0-rc`; the twins' parity tests are the canary for RC drift — a Solid change that breaks a twin is a finding, not a reason to pin.
*Alternatives:* pin exact RC versions.
*Reasoning:* D-004 — if the public API moves under us, we want to know on the next gate run.

### D-017 — Perf not in the gate
**Decided.** The runtime-cost harness (`blocks-library.md` §8) runs manually; no perf budgets in the gate yet.
*Alternatives:* budgets per twin in the gate.
*Reasoning:* budgets would be noisy across machines and the design is still moving; revisit when Phase 1 lands.

*Re-run (Phase 4, item 3).* Still no budgets in the gate. Two changes to the harness, with the numbers in §8:

- **The twins against their originals.** `examples/harness/runtime-cost/twins.mjs` adds the measurement this entry's alternative named. It runs each twin's parity script against one app per process, on production builds. The twins cost 1–16% of the scripts' wall time.
- **The synthetic workloads.**
  - *Finding: the old workloads measured nothing.* Their `solid-blocks` side was still written with setters not delegated to and component tags. Since D-021 an undelegated setter writes nothing in production, so any measurement after D-021 timed a list that never grew.
  - *Fix.* The workloads are rewritten in the current dialect. Each run now prints what it left in the DOM, and the two flavors must agree.
  - *Numbers.* Valgrind does not run on macOS arm64, so the instruction counts could not be re-taken; wall time is reported instead: 1.11–1.27x. The fork's instruction counts are kept in §8, labelled.

### D-018 — Open components
**Dissolved** by D-023: with declared prop colors there is no "open" (undeclared-color) component for the linker to resolve, so the question it answered no longer exists. (Reconstructed: the original question text was not carried by the handoff.)

### D-019 — Untyped sync throws
**Decided.** A plain `throw` (not a typed `raise`) inside a block is a bug, not a failure channel. Dev builds re-throw with the prefix `[UNTYPED_THROW] <host> in <Component>…` naming the host (setup/view/hole/event) and component; production routes it to the nearest `<Errored>` so the app degrades rather than dies.
*Alternatives:* treat untyped throws as `raise(unknown)`; swallow in prod.
*Reasoning:* D-006 — typed failures are complete for library-mediated failures; making a plain throw loud in dev is what keeps that claim honest, while prod behaviour must still be an error boundary. Doc §1 strictness bullet and §7 wording follow. *Amended by D-033:* "routes to the nearest `<Errored>` **if there is one**; with none, the failure is re-thrown". *Implementation:* Phase 1A item 7.

### D-020 — `$event` is always a transaction
**Decided.** Every `$event` handler runs as a Solid `action` (transaction) — no sync fast path.
*Alternatives:* sync handlers stay plain; transaction only when the handler awaits.
*Reasoning:* one semantics (D-005) and it is what typed failures v2 already does. Revisit only on a measured cliff (D-017 harness).

### D-021 — Dev-mode receipt tracking
**Decided.** In dev, a setter returns a receipt; a receipt not delegated (`yield*`-ed) by the end of the run is reported as `[UNYIELDED_WRITE]`. The lint rule `no-unyielded-write` stays for editor-time feedback; the runtime check is the authority.
*Alternatives:* lint only; make setters throw if called outside `yield*` (impossible without a transform).
*Reasoning:* the lint cannot see through helpers; the runtime can. Open: whether to carve a sync exception for `start(call)`. *Implementation:* Phase 1A item 8.

### D-022 — Remove stray gitlink
**Decided.** `async-reactivity-walkthrough` is a mode-160000 gitlink with no `.gitmodules` and no references in the tree; `git rm --cached` it.
*Reasoning:* it breaks fresh clones and worktrees for nothing. (Provenance, found during the changeset re-derivation: the gitlink was introduced by `57d05dda`/`dfe692cf` themselves.) *Implementation:* Phase 1A item 1 — done in `bl/bootstrap` (`f26f5ca2`).

### D-023 — Type linker removed; prop colors declared
**Decided.** `@solidjs/blocks-linker` (and the Rust `summarizeBlocks`, the `solid-props.gen.d.ts` files, each twin's `link:check`, the `typed-props-key` lint rule) are removed. A component declares a prop's color on its prop type: `Async<T, E>` for a prop that may be pending or fail; TypeScript then checks every render site with ordinary generics (variance: settled ⊂ pending, `never` ⊂ `E`).
*Alternatives:* keep the whole-program linker (infers colors across modules, needs a build step and generated files, and was the one pre-existing gate red); a TS language-service plugin.
*Reasoning:* the linker reproduced, with a generator and a check script, what a declared annotation gives for free and locally; the generated files were the main source of twin drift. *Validation:* after migrating the 12 twins, report Async-vs-total prop counts per twin — if most props need the annotation, the decision is wrong and must be said so, never papered over with `any`. The same report counts pass-through components that needed a generic signature (D-029). *Implementation:* Phase 1B.

**Validation (1B, `bl/colors`).** Counted with the TypeScript checker over every `Props<…>` declaration in the twins' sources (tests and setup helpers excluded). "Colored" is a prop declared `Source<T, E, P>` with `E ≠ never` or `P ≠ false`; a settled `Path<T>` declaration is not a color.

| Twin | Components with props | Props | Colored **before** (linker-inferred / declared `Source<…>` at `fbd9fb97`, union) | Colored **after** (declared) | of which generic (D-029) | Generic components | Boundaries added for typing |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| effect | 3 | 4 | 1 / 2, 2 | 2 | 0 | 0 | 0 |
| hackernews-spa | 6 | 15 | 0 / 0, 0 | 0 | 0 | 0 | 0 |
| rendering | 13 | 19 | 3 / 7, 8 | 8 | 2 | 2 | 0 |
| room | 23 | 37 | 8 / 10, 11 | 11 | 6 | 5 | 0 |
| sierpinski | 3 | 10 | 2 / 0, 2 | 2 | 0 | 0 | 0 |
| sierpinski-h | 3 | 10 | 2 / 0, 2 | 2 | 0 | 0 | 0 |
| todos | 4 | 4 | 0 / 0, 0 | 0 | 0 | 0 | 0 |
| todos-h | 3 | 3 | 0 / 0, 0 | 0 | 0 | 0 | 0 |
| **all** | **58** | **102** | **16 / 19, 25** | **25** | **8** | **7** | **0** |

The "before" column is from the last linker run. The first figure is the 16 props the linker inferred as pending or failing (the preliminary survey's "~16 of ~85": the linker listed only keyed components' props). The second is the props already declared with a colored `Source<…>` in `TypedProps`, which the linker could not override. Their union is the colors the twins actually had. The declared colors after the migration are the same 25 props, so no prop gained or lost a color. Three changed shape:

- rendering's `FeedCard.feed` is `Source<Feed, FeedError>` (sync, may fail). The linker had said pending, but its callers pass a `loadingValue` memo and a `seedLoadingValue` projection, neither of which is pending.
- room's seven `Source<…, true, unknown>` declarations now name `LiveError` (D-034). Room's `Card` memo now routes its stream through `attempt(…, cause => new LiveError(cause))`, as presence's already did, instead of being widened to `unknown`.
- effect's `Results.results` declares `SearchError | TransientError` instead of `unknown`.

**Finding: the annotation is the minority.** 25 of 102 props are colored, a quarter. Most of them sit in the two twins that exist to show async data: rendering (8 of 19) and room (11 of 37). Three twins have none. D-023 holds.

**Finding (D-029): generics spread to the readers.** 3 components only forward a colored prop: room's `Transcript.messages`, room's `CardBody.members` and `.activity` (it reads `card`), and rendering's `Profile.info` (it reads `user`). The body of a generic component is checked for every color, so it can forward only into a prop that accepts every color, which means another generic. So the 4 components that read those props (`Messages`, `MemberCount`, `ActivityLine`, `Facts`) became generic too: 7 generic components carrying 8 generic props. Their bodies are unchanged, apart from `Profile`, whose own `Errored` fallback reads `err().message` and so needs `E extends Failure`. At this count `Inherit<T>` would save 7 type-parameter lists, so it does not earn its machinery yet. The rule worth stating is "a generic forwards only into a generic" (in `blocks-library.md` §6).

**Finding (`h`): call a generic component directly.** `h(Comp, props)` reads `ReturnType<Comp>`, which TypeScript computes for a generic function by erasing its type parameters to their constraints. So `h(Generic, { todo })` gets `boolean` / `unknown` colors. In an `h` view a generic component is called instead (`h("ul", Generic({ todo }))`), which keeps the caller's colors. No `h` twin has a generic component.

No twin needed a boundary, a cast or an `any` for typing. A declared failure needs no boundary at any position: `render` / `hydrate` accept a root that may fail but not one that is pending.

*Implemented (Phase 1B, `bl/colors`).*

- `e1aba8f6`: the types (`Props<{ … }>`, `Source<T, E, P>`, call-site checking).
- `45fdd477`: the twins' pass-through generics and the validation table above.
- `45cdfdf9`: `@solidjs/blocks-linker` and everything it fed are removed: the 8 `solid-props.gen.d.ts`, each twin's `link` / `link:check` scripts, devDependency and `solidLink()`, `typed-props-key`, `.prettierignore`, and the gate's linker steps (39 → 30 steps).
- `f00b389a`: `summarizeBlocks` is removed from the compiler. With it went the gate's last pre-existing red, so the baseline is 30 pass / 0 fail.

*Corrected by D-088 (Claude review I-2):* room's twin has `Errored`s the original lacks (the `Live` root, and one per directory row, justified by the pre-D-059 "a row is settled"), so "0 boundaries added for typing" was not so for room. The rows' boundaries go with D-088's implementation.

The decision text's `Async<T, E>` is spelled `Source<T, E, true>` (D-068). D-018 (open components) has nothing left to dissolve into: no component's color depends on who calls it.

### D-024 — Bare prop type is settled
**Decided.** A prop typed `T` is settled and never fails; `Async<T, E = never>` is the opt-in. Reads inside the child: bare → `Read<false, never>`, `Async<T, E>` → `Read<true, E>`. Pass-through carries the parent's declared color.
*Alternatives:* bare = "unknown color" (what the linker inferred); bare = async.
*Reasoning:* the common case must be the quiet one, and a settled default is the only one TS can enforce without inference across files. The call-site error should be readable via a branded `never` ("prop `todo` of TodoItem is settled; pass a settled value, or declare it `Async<Todo, FetchError>`").

*Implemented (1B, `e1aba8f6`).* `Props<{ todo: Todo }>` reads are `Read<false, never>`. A `Source<T, E, P>` declaration reads `Read<P, E>`.

At the call, a settled prop refuses a pending or failing source, path or hole. Hole props are now typed by what they yield (`HoleProp<T, E, P>`), so a pending hole no longer passes a settled prop, and `h(Comp, { children })` checks `children` like any prop (it was `unknown`). TypeScript prints the message in the expected type: `SettledProp<"[SETTLED_PROP] prop `todo` is settled: pass a settled value, or declare it Source<T, E, true>">`.

The message cannot name the component, as the decision's example did ("of TodoItem"): a type has no access to a component's name. The call on the reported line is the component.

### D-025 — **lost**
Not carried by the handoff. If you remember it, append it as a new entry naming D-025.

### D-026 — **lost**
Not carried by the handoff. If you remember it, append it as a new entry naming D-026.

### D-027 — The gate pins `TZ=UTC`
**Decided (2026-10-04).** `scripts/blocks-gate.mjs` runs every step with `TZ=UTC` (plus `FORCE_COLOR=0`, `NO_COLOR=1`, `CI=1`), whatever the host timezone.
*Alternatives:* pin the timezone inside the one twin that cares (`effect-blocks` formats a fixed 12:00 UTC timestamp in local time); leave it and accept a machine-dependent red.
*Reasoning:* the twin shares the assumption with its original — changing it would move the parity test away from its oracle — and a gate result must depend on the commit, not on the clock's locale. On an IST machine the step was red before the pin and green after; the lost container run was UTC, which is why it never showed there.

### D-028 — A setter called outside a block run throws in dev
**Decided (Dev, 2026-10-04).** After v2 a setter call returns a receipt and the write happens only at `yield*`. A setter invoked with no current block host (handed to foreign code: `onClick={setOpen}`, an `IntersectionObserver`, `setTimeout`) throws immediately in dev builds — `[SETTER_OUTSIDE_RUN] <setter> called outside a block run` — because the end-of-run receipt check of D-021 has no run to report at. Production keeps the silent no-op.
*Alternatives:* write eagerly when there is no host (a second behaviour for the same call, D-005); lint only ("setters are not values"), which misses dynamic cases; both.
*Reasoning:* the bug is at the call site and only the runtime sees it there; a lint can follow if the dev throw turns out to be found too late. *Implementation:* Phase 1A item 8, alongside the `[UNYIELDED_WRITE]` receipt check.

### D-029 — Pass-through props: explicit generics first
**Decided (Dev, 2026-10-04).** Under D-023 a component that forwards a prop it never reads (a `Card` handing `todo` to `TodoItem`) declares its color with an explicit type parameter: `type CardProps<P extends boolean = false, E = never> = { todo: Source<Todo, P, E> }` and `function* <P extends boolean, E>(props: CardProps<P, E>)`. The body is checked once for every color, so forwarding compiles only into a prop that accepts any color (`Async<…>`); forwarding into a bare (settled) prop is an error. Phase 1B's twin report counts these pass-through generics per twin next to the Async counts. An `Inherit<T>` marker — `$component` making the component implicitly generic over each `Inherit` prop, same rules, no type parameter to write — is added only if that count is high.
*Alternatives:* `Inherit<T>` from the start (less noise, more type machinery and worse error messages); declare every pass-through prop `Async<T, E>` (no generics anywhere, but ready values read as maybe-loading downstream and the component names errors it never sees); fix a numeric failure threshold up front.
*Reasoning:* options 1 and 2 have identical soundness — neither infers across files; 2 is sugar for 1 — so start with the one that has no machinery and makes the cost countable; the count decides whether the sugar earns its complexity.

*Implemented (1B, `45fdd477`).* Generic components keep their type parameters because `Component<…>` is now a plain function type (D-068). Before, `$component` returned a function intersected with the component brand, and TypeScript propagates a generic argument's type parameters only into a single-signature function result. So the brand moved onto the returned view.

The count is in D-023's validation. 3 components only forward a colored prop, and 4 components read what they forward. A generic body is checked for every color, so it forwards only into another generic: the readers became generic too, giving 7 generic components and 8 generic props. `Inherit<T>` would save 7 type-parameter lists, so it does not earn its machinery yet. One forwarder (rendering's `Profile`) shows the failure in its own `Errored` and needs `E extends Failure`.

`h(GenericComp, props)` loses the parameters (TypeScript's `ReturnType` of a generic function erases them), so an `h` view calls a generic component directly.

*Closed (Dev, 2026-10-05, with D-083).* `Inherit<T>` is not added: 7 generic components across the 8 twins, and the generics spread down the chain whatever the marker would save. Implemented as explicit generics; closed.

### D-030 — A row body is a setup
**Decided (Dev, 2026-10-04).** The bare `function*` of a `<For>`/row (D-013) is a setup: it runs once per item and returns the row's view generator, the same shape as `$component` (setup returns view). `yield* $memo` inside it is correct and owned by the row.
*Alternatives:* row body is a view (per-row derivations unsupported; extract a `$component`); positional/hook-like idempotent `$memo` in a view (rejected: positional magic, D-006); keep `$scope` for rows only (partly reverses D-013).
*Reasoning:* it answers "where does a per-row derivation live once `$scope` is gone" without a new concept, by making rows and components the same shape. *Implementation:* Phase 1A item 4 — doc §1 states the symmetry; runtime test "a row memo is created once per item".

### D-031 — The JSX transform stays
**Decided (Dev, 2026-10-04).** The rule "`yield* e` in a JSX expression/attribute → `perform(e)`" stays; D-003 stands and Phase 2 builds the standalone plugin (plus a disable option in the Rust compiler, which has `blocksModule` but no off switch today).
*Alternatives:* drop the transform and require explicit `function*` holes everywhere (≈273 twin sites by a rough grep vs 20 explicit holes today; the `h` flavor already works that way). Rejected: the transform is the ergonomic path inside the strict dialect, and dropping it would not have removed the granularity cliff (D-032 does).
*Reasoning:* the view stays a `function*` for TypeScript's sake (a `yield*` must sit in a generator to be typed); at runtime the transform removes every view yield, which is consistent with D-032. *Implementation note (2026-10-04):* no compiler disable option is needed after all. The twins get the fork's rule because the published `@solidjs/vite-plugin@3.0.0-next.35` links the workspace `packages/compiler`/`packages/babel-plugin`; the standalone plugin runs `enforce: "pre"`, so by the time the compiler sees a file every `yield*` in JSX is already `perform(…)` and the Rust rule is a no-op. Sequence: plugin → fixture parity (5 fixtures, 5 refusal codes) → twins through the plugin with the compiler rule idle → D-043 removes the rule.

*Note (Phase 2, 2026-10-04): the `perform` import's line.* While the Rust rule is the parity oracle, the plugin's `import { perform as _$perform } from "@solidjs/blocks";` takes its own first line, as the compiler's rule inserts it. On line 1 next to the code, a first-line comment would become the import's trailing comment and the compiled output would no longer be byte-identical to the rule's. The cost: compiler error messages in files with holes are one line late; runtime stack traces map exactly (the source map carries the shift). After D-043 removes the rule, the import is placed without shifting lines and the checked-in outputs are regenerated (they are the oracle then).

*Implemented (Phase 2).* No compiler off switch was added. The plugin runs first, so the Rust rule idled behind it. Commit `5770f1a5` tested that: for every JSX file of the six JSX twins, plugin + compiler output equalled compiler-alone output, byte for byte, in dom, ssr and hydratable modes.

**The import line.** In `013d20ce` the import moved to just before the module's first statement, on that statement's line, after any hashbang, directive prologue and leading comments.

- Prepending it to line 1 was tried first. oxc then printed a first-line `//` comment as the import's trailing comment and dropped it from the compiled output. That loses a first-line pragma such as `/** @jsxImportSource … */`, so it was rejected.
- The compiled outputs were regenerated against the upstream compiler. 16 of 26 are byte-identical to the Rust rule's. In the other 10, the only change is the import line coming after the leading comments instead of before them; the lines are otherwise the same.
- The refusal messages in `rule.json` are the Rust rule's, unchanged.

### D-032 — A view has no body
**Decided (Dev, 2026-10-04).** A view is `function* () { return <…/>; }`. Every read is a `yield*` directly in a JSX position (a hole); there is no `yield*` outside JSX, no `if`/early `return`, no local computation. All structure comes from flow controls (`<Show>`, `<Match>`, `<For>`, …), which take sources directly. The `h`/`html` flavor follows the same rule with explicit `function*` holes.
Consequences: (1) the whole-view read concept is deleted — `VY` is always `never`, so `ViewPending<VY, R>` collapses to `PendingOf<HOps<R>>`; a view is never pending or failing on its own, only its holes are; the runtime's whole-view detection (`viewRunning`/`jsxRead`, the machinery `a5faef57` patched) is repurposed into a dev error and otherwise removed (1A item 3 shrinks accordingly). (2) Enforcement at three levels: types (`Read` is not a `ViewOp`; type test "a view does not read"), dev runtime (`[READ_IN_VIEW] <Component>: read outside a JSX position`), lint `no-read-in-view-body` (error, in `recommended`). (3) Doc §3 row "A view reads; it does not create or write" becomes "A view does not read, create, write or branch; its holes read". (4) Twins migrate view-body reads and `if (yield* …)` branches (6 by grep) to holes and flow controls; the lint's first run gives the exact site count, which is recorded here.
*Alternatives:* keep whole-view reads and document the position-based granularity (§3 only); lint only the cliff case (a view-body read whose binding is used only in JSX); keep whole-view reads in the runtime for safety.
*Reasoning:* Dev: there should be no control flow or structure inside a view; all branching comes from flow controls, and a read is a hole. This removes the cliff (the same `yield* count` meaning a hole inside JSX and a whole-view re-render one line above) by removing the second meaning, not by warning about it. Fact that settled it: `ViewPending<VY, R> = PendingOf<VY | HOps<R>>` — holes were already tracked for pending/failures, so the whole-view read bought nothing but structure and a coarser scope. *Implementation:* new Phase 1A item 4b, after explicit holes (item 4).

### D-033 — No boundary: the failure is re-thrown
**Decided (Dev, 2026-10-04).** With no `<Errored>` on the path to the root, a failing view/memo is re-thrown by `reportError` and a failing `$event` rejects its promise (already the runtime's behaviour, tested for `$event`). The library installs no implicit root boundary and does not require one. D-019 is reworded accordingly.
*Alternatives:* `render()`/`hydrate()` install a default root `<Errored>` (feasible in one place, `rootOf(code)`); require a root boundary via a dev error and a lint.
*Reasoning:* crashing loudly with no boundary is the honest default for a strict dialect; a silent root fallback hides the failure. *Implementation:* doc §7 wording with 1A item 7; add the "no boundary → re-throw" runtime test for a view failure next to the existing `$event` one.

### D-034 — Error types carry a literal `kind`
**Decided (Dev, 2026-10-04).** `attempt`/`until`/`raise`/`<Errored catch>` remove a handled class from a failure union *structurally* (TS compares shapes) but match at runtime with `instanceof` (nominal). Two classes without a discriminant are one type to TS, so `catch={[A]}` would also erase `B` from the type while the runtime rethrows `B`. The types now enforce the convention every twin already follows: an error type accepted anywhere as `E` must satisfy one shared constraint `Failure = Error & { readonly kind: <string literal> }` (a plain `string` `kind`, or none, fails with a branded-never message: "error class X needs `readonly kind = \"x\" as const` so its failure can be told apart"). Entry points: `attempt<T, E>`, `until<T, E>`, `raise<E>` (unconstrained before this), `Errored`'s `catch`, and `Async<T, E>` in Phase 1B; everything else inherits.
*Alternatives:* require any own literal member without fixing the name (looser, worse message); document as a §7 limitation and rely on convention.
*Reasoning:* a typed-failure system whose type-level removal and runtime matching can disagree is unsound in exactly the case it exists for; the constraint costs one line per error class, which every twin already pays. *Implementation:* Phase 1A, with item 7; type test for the two-identical-classes case.

### D-035 — `start()` removed
**Decided (Dev, 2026-10-04).** `yield* start(call)` (v2: run an event call without waiting and without absorbing its colors) is removed, with its op, its tests and its doc mention. It existed for one typing corner — an `$effect` cannot wait, so an effect could not otherwise trigger an async event — and no twin uses it (1 runtime test, 3 type-test lines). An effect may delegate only to a sync event (already the rule); "an effect triggers an async event" is written in §7 as "model it as an event calling an event, or a `$memo`". If a twin or test turns out to need the escape, that is the finding to record here.
*Alternatives:* keep it with one spelling (`yield* start(call)`); keep it legal only inside `$effect`; allow a bare `start(call)` statement (the handoff's open question — now moot).
*Reasoning:* D-005 — an unused second way to call an event; its presence also forced the odd "yield in order to not wait" spelling. *Implementation:* Phase 1A, with item 8 (the `no-unyielded-write` rule loses its `start` special case).

### D-036 — `context()` removed
**Decided (Dev, 2026-10-04).** `context(Ctx)` ("read a context this library did not create") is removed. `yield* Ctx` on a context created with the library's `createContext` is the one way to read a context. Fact that settled it: no twin uses `context(Ctx)` and no twin creates a raw Solid context. A foreign context (a router's, an i18n library's) is reached by adopting the component that provides it (`adopt()`) or by wrapping the value once in a library context; if a twin or the router integration turns out to need the bridge, that is the finding to record here. Closes the handoff's deferred "do `context()` and `createContext()` stay separate" question.
*Alternatives:* keep it as the sanctioned interop bridge (and add a test that uses it); make `yield* Ctx` accept any Solid context.
*Reasoning:* D-005 and D-006 — an unused second name that is also an escape hatch. *Implementation:* Phase 1A, with item 8's surface cleanup; doc §1 setup-operations bullet.

### D-037 — D-008 amended: gate contents
**Decided (Dev, 2026-10-04).** (a) The "Chromium/Playwright steps run only before pushes" clause is dropped: no twin or blocks package has a browser test, so the clause was vestigial (three pushes were made under it without one). It returns when a browser test exists. (b) `oxlint` becomes a root devDependency so `repo:oxlint` runs for real instead of being SKIP forever (`.oxlintrc.json` existed since `dfe692cf` with no binary anywhere in the lockfile); the baseline is regenerated and any reds it adds are recorded, not hidden.
*Alternatives:* delete `.oxlintrc.json` and the step (eslint-plugin-blocks as the only lint); keep both clauses as written.
*Reasoning:* a gate step that can never run and a rule that is never exercised both make "green" mean less than it says. *Implementation:* `bl/bootstrap`, gate agent; baseline regenerated at the same commit.

### D-038 — Flow controls accept holes as well as sources
**Decided (Dev, 2026-10-04).** `<Show when>`, `<Match when>`, `<For each>` and the other flow controls accept a `Source` **or** a zero-arity `function*` (a hole, the same form as a JSX attribute hole): `<Show when={function* () { return (yield* todos).length > 0; }}>`. Derived conditions stay local to the view; one hole form everywhere (D-013). The D-013 rule still applies: a derivation used in more than one place is a `yield* $memo`.
*Alternatives:* sources only, every derived condition a named `$memo` in setup (verbose; the todos `when={todos().length > 0}` would need a memo per condition).
*Reasoning:* D-032 removed the view body, which is where derived conditions used to be computed; without this the migration would move every one of them into setup. *Implementation:* Phase 1A item 4b (types: the `when`/`each` prop types admit a hole; type + runtime test; `h` flavor too).

### D-039 — Conformance harness ported in Phase 4
**Decided (Dev, 2026-10-04).** The experiment branch's conformance harness (`packages/web/test/conformance` on `experiment/iterable-signals`: `conformance.spec.ts`, golden client/hydrate/server traces, 8 server-reference vs blocks-compiled HTML scenario pairs, `COVERAGE.md`) is ported as a semantics pin for the library route in Phase 4, after extraction; until then the 12 twins are the oracle. Note for the port: the `blocks-context` scenario is moot after D-036 and `blocks-effect` must be re-read against D-032.
*Alternatives:* port now as 1A's last item (pin before more runtime surgery); never (twins suffice).
*Reasoning:* the harness pins semantics independently of the twins, which is valuable, but it is most valuable once the runtime stops moving and the repo is standalone.

*Implemented (Phase 4, item 1).*

- **Where.** `packages/blocks/test/conformance/` (its README), as the gate step `pkg:blocks:conformance`: server, hydrate and client environments, plus a lint of the library sources. Those sources are type-checked by `test-types`.
- **Two sources per scenario.** The oracle is the fork's handwritten Solid source, unchanged apart from formatting. The other is a library-dialect twin as the dialect stands: call form (D-062), `Props<{…}>` / `Source<T, E, P>` (D-068), views with no body (D-032), typed failures (D-034), writes through receipts in `$event`s (D-021, D-028), no `context()` (D-036).
- **Real compiler output.** The library route runs `vite-plugin-solid-blocks`' `transform()`, then the published `@solidjs/compiler`. That is a new devDependency of `solid-blocks`, the version `@solidjs/vite-plugin` already uses.
- **What changed from the fork.** blocks-context was dropped (D-036). blocks-effect was re-read against D-032 and D-053 and declared F1. The library side's artifacts were regenerated against the library runtime. Every difference is in D-069. The port also found one runtime bug, a false server `READ_IN_VIEW` (D-069 F7), now fixed.
- **Golden traces and D-045.** D-045 rules out golden snapshots of the *originals* as a Solid-drift canary. The harness's goldens pin the *oracle's* traces, so that a change in Solid's semantics is reviewed as Solid's rather than showing up as a library divergence. The library side is never golden: it is judged against the oracle each run. So the goldens do not contradict D-045. When Solid moves, a golden moves with it, and the diff is reviewed as Solid's (rc.13 moved three, D-069).

### D-040 — `Async<T, E>` on a prop is permission only
**Decided (Dev, 2026-10-04).** Declaring `todo: Async<Todo, FetchError>` says "I can be given unsettled data"; it creates no obligation to handle it. A pending read or a failure from that prop propagates to the nearest `<Loading>`/`<Errored>` wherever it is — possibly in the parent — exactly as a pending read propagates in Solid. A bare prop means "give me settled data; I am never the one that is pending". The declaration is a type permission, not a UI duty.
*Alternatives:* duty — a component with an `Async` prop must contain the boundary for it (dev error when its pending escapes); permission plus a one-time dev hint when it escapes a component with no boundary.
*Reasoning:* boundaries are placed by whoever owns the layout, not by whoever declares a type; a duty would force a boundary per component and fight Solid's propagation model. Doc: 1B's §6 ("Declared colors") states this in one sentence.

*Implemented (1B, `e1aba8f6`).* A declared color adds no runtime obligation, and the types require a boundary only for pending. A declared failure joins the holding view at a call, at a row (D-059) and at the root. `render` / `hydrate` now take a root that may fail but not one that is pending (`() => View<false, any>`), since a failure with no `Errored` is re-thrown (D-033). No twin added a boundary for typing. §6 of `blocks-library.md` states it in one paragraph.

### D-041 — JSX only in view / hole / row returns
**Decided (Dev, 2026-10-04).** JSX appears only as the return of a view, of a hole, or of a row's view. A setup never creates elements: `const header = <h1>{yield* title}</h1>` in a setup is an error. Elements are not values in a block. Enforcement: lint `jsx-only-in-view` (error, in `recommended`); the transform's `perform` asserts the host in dev — a hole performed while a setup is the host is `[JSX_IN_SETUP] <Component>: JSX in a setup`; Phase 2's plugin inherits the rule unchanged. Closes the design-review item "the JSX rule applies syntactically anywhere in a generator".
*Alternatives:* JSX as a settled value anywhere (a slot element passed as a prop); JSX in a setup only through a creator (`$memo` returning a view, `$dynamic`).
*Reasoning:* D-032 made a view nothing but structure and holes; letting a setup build elements would reintroduce a second place where reads become holes, with a different host and different pending scope. *Implementation:* Phase 1A, with item 4b's lint work (new rule + tests; twin sites counted on first run and recorded here).

Twin sites on the lint's first run (`jsx-only-in-view`, 1A follow-up item 8, after D-058): hackernews-spa 1, migrating-element 1, room 1, every other twin 0. hackernews-spa's and room's App built the router tree in the setup (`const rendered = <Router>…`, from when a view could re-render): moved into the view, which runs once (D-032). migrating-element's `const hoistedCanvas = <Canvas />` is the example's point — one element held in a variable and shown in several `<Show>` slots, so its single DOM node migrates — and is kept with a commented `eslint-disable` (see the finding below).

### D-042 — All props are reactive; a setup never reads; `$snapshot` removed
**Decided (Dev, 2026-10-04).** Every prop is a `Source`; there is no static/plain prop kind. A setup never reads — the "take a value with `$snapshot`" exception in §3 row 7 is gone and `$snapshot` is deleted. "Take the value once and ignore updates" is written where Solid writes it: inside a reactive scope, untracked — `yield* $untrack(source)`, a read op admitted in holes, memos, effects and events (`HoleOp`/`MemoOp`/`EffectOp`/`EventOp`), never in a setup. Facts that settled it: the 16 twin files using `$snapshot` all snapshot *props* that are components, slots, callbacks or config (`props.AppShell`, `props.editor`, `props.toggle`, `props.onSearch`, `props.copy`, `props.log`) — i.e. `$snapshot` existed only because a setup could not otherwise hold a prop it needed, and it silently froze a value the parent believed was live. Migration: a component prop is read in a `$dynamic` body or a hole; a callback is read inside the event that calls it (`(yield* props.onSearch)(q)`); config and objects are read in holes/events. The migration count per twin is recorded here on the lint's first run.
*Alternatives:* a declared `Once<T>`/`Static<T>` prop kind (a plain value, usable in setup, call-site type error for a changing source) — rejected: a second kind of prop; keep `$snapshot` as is; forbid `$snapshot` only on props.
*Reasoning:* Dev: reading in setup should not be allowed; if the use case is "take once", do it in a reactive scope under `untrack`; and all props are reactive — one model, no plain-value escape. *Implementation:* Phase 1A (new item 4c after 4b: remove `$snapshot`, add `$untrack` with type/runtime/lint tests, migrate the 16 files, doc §1/§3). If no twin needs `$untrack` after migration, record that count here; it is then a D-005 candidate.

*Closed (D-083, 2026-10-05).* The count: **0** twin uses of `$untrack` after the migration (the 16 `$snapshot` sites all migrated without it), and none in the conformance scenarios or the docs. Its 16 uses were the package's own tests (runtime.spec 8, jsx.type-tests 5, nojsx.spec 1, raise.type-tests 1, the lint's tests 1). `$untrack` is removed (D-005): "take once" is a plain read where the host does not track, an `$event` or an `$effect`'s effect phase. The first twin that needs a read without subscribing inside a tracking host is the finding that brings it back.

### D-043 — After plugin parity, the fork's compiler goes back to pristine upstream
**Decided (Dev, 2026-10-04).** Once Phase 2's standalone plugin passes fixture parity against the Rust rule, the blocks footprint is removed from the fork's `@solidjs/compiler` and `@solidjs/babel-plugin`: `blocks_rule.rs` (364 lines), `blocks_summary.rs` (1,230 lines; its `summarizeBlocks` export was never released — only announced in the pending `compiler-blocks-rule` changeset), `tests/blocks-rule-fixtures.json`'s compiler side, `__tests__/blocks-*.test.js`, the `blocks_module` option and the `index.js`/`types.d.ts`/`compiler.rs`/`config.rs`/`lib.rs`/`node_adapter.rs` hunks, the babel copy `src/shared/blocks-rule.ts` with its `preprocess.ts`/`config.ts`/`types.ts` hunks and `test/blocks-rule.spec.js`, and the `compiler-blocks-rule.md` changeset. The plugin's checked-in expected outputs (generated once from the Rust rule) become the oracle. D-001/D-003 taken to their end: nothing of blocks remains in Solid's packages.
Facts for the executor: the diff of `packages/compiler` + `packages/babel-plugin` between `blocks-lib` and its upstream merge-base `644eaf3b` (`origin/next`) is 23 files / +2,047; the hunks in `directives/`, `refresh/`, `tsrx/` and `dom/` must be classified first — they may be unrelated fork work and are not removed by this decision. The crate requires `rust-version = "1.95"`; this machine's default toolchain is 1.88 with stable 1.99 installed — run cargo with `RUSTUP_TOOLCHAIN=stable`. Validation: `cargo clippy -- -D warnings`, `cargo test`, the compiler's 5,990-test vitest suite (the one pre-existing `blocks-summary` red disappears with the file), rebuild `compiler.node`, full gate.
*Alternatives:* keep the Rust rule as the oracle, disabled by default; keep both as supported routes (twins gated under both).
*Reasoning:* a reference implementation nobody ships drifts; checked-in outputs don't. *Implementation:* Phase 2's last commit (sequenced after the plugin's parity commit); `summarizeBlocks` alone goes earlier, in 1B.

*Implemented (Phase 2, `013d20ce`).* `git diff 644eaf3b -- packages/compiler packages/babel-plugin` is empty.

- **Removed:** 5 added files (`blocks_rule.rs`, `tests/blocks-rule-fixtures.json`, `__tests__/blocks-rule.test.js`, `src/shared/blocks-rule.ts`, `test/blocks-rule.spec.js`). 16 modified files are restored to upstream: the `blocks_module` plumbing, the babel hooks, and the hunks classified below. The `compiler-blocks-rule.md` changeset is deleted.

**Classifying the non-blocks hunks.** The diff touched `src/directives/` (`transform.rs`, `validate.rs`), `src/dom/` (`dynamics.rs`, `element.rs`), `src/refresh/transform.rs` and `src/tsrx/` (`lower.rs`, `semantic.rs`). All of it is formatting:

- Running `rustfmt --edition 2024` (toolchain 1.97.1) over each upstream file reproduces the fork's file byte for byte, for all 7.
- All of them came in with the blocks-linker commit `8099d934`, a crate-wide format; no other commit touched them.
- `compiler.rs`'s `pub(crate)` on `parse_program` and `source_type_for_filename` came from the same commit, for `blocks_summary.rs`, and has had no other user since 1B removed that file.

So all of it is blocks residue with no semantic content, and it is restored. Nothing was left in place.

**Validation:**

- `cargo test` passes with stable 1.99 on all three feature sets: default (55), `--no-default-features` (9 + 3), and `--no-default-features --features tsrx` (48 + 3 + 15 + 9).
- The compiler's vitest suite passes, 41 files and 5,938 tests. babel-plugin: `tsc`, rollup build, 268 tests.
- clippy and rustfmt were not run: no Rust file was edited, only restored byte for byte.
- `compiler.node` was built with `cargo build --release` and copied by hand, because the napi CLI hits `spawn EPERM` in the agent sandbox. The orchestrator re-runs the napi build outside it.

**Consumers moved to the plugin:**

- every JSX twin's Vite and Vitest configs (Phase 2 commit 3);
- `packages/blocks`' three vitest configs and the runtime-cost harness. Both import the plugin by path, because the plugin devDepends on `@solidjs/blocks` and a dependency the other way would make a cycle in the workspace graph;
- `eslint-plugin-blocks`' refusal-parity test, which now runs the plugin's `transform()` against `rule.json` (devDependency `@solidjs/compiler` → `@solidjs/vite-plugin-blocks`).

**Gate (D-008, D-037 amended in commit 5).**

- `pkg:babel-plugin:test` and `pkg:compiler:test` are dropped: both packages are upstream, and the twins compile through their artifacts.
- `pkg:vite-plugin-blocks:test` and `:typecheck` are in.
- A FAIL on a step the baseline lacks now counts as red. It had printed GREEN once, on a cache race since fixed.
- Baseline: 30 steps, all passing.

### D-044 — `$dynamic` returns a colored component
**Decided (Dev, 2026-10-04).** `$dynamic(body)` no longer returns a plain `SolidComponent`. Its body's colors are already known (`Y extends MemoOp` may read pending sources; `SyncReturn<R>` routes failures through `attempt`); the returned component now carries them, and rendering it in a view (`<Reply/>`, or `h(Reply)`) contributes `PendingOf<Y> | FailsOf<Y>` to the enclosing view's hole ops — the same mechanism holes use, so a view rendering a pending `$dynamic` is pending in its type. Runtime is unchanged (Solid's `dynamic()`; pending reaches the nearest boundary per D-040). Facts that settled it: 9 twin files use `$dynamic`, none has a boundary of its own, and the type said settled.
*Alternatives:* document as a §7 limitation; require a settled body (kills the server-component-call use that motivated `$dynamic`).
*Reasoning:* typed failures are "complete for library-mediated failures" (D-019); a library creator that drops known colors on the floor is a hole in that claim. *Implementation:* Phase 1A item 4d (element/`h` types admit a colored component; type test "a view rendering a pending `$dynamic` is pending"; runtime test unchanged behaviour). Note for `adopt()`: the same question applies to `adopt(lazy(X))` (7 twin uses) — a lazy chunk is pending while it loads; see the next decision on it.

### D-045 — Parity is the only Solid-drift canary
**Decided (Dev, 2026-10-04).** The twins' parity tests (one script against the original and the twin, DOM snapshot after each step, hydration keys normalized) remain the canary for Solid RC drift, as D-016 says. No golden snapshots of the originals are checked in, and the standalone repo keeps the caret peer range. If a Solid change alters the original and the twin identically, parity passes and that is the intended outcome: the library followed Solid.
*Alternatives:* golden snapshots of the originals per Solid version (a separate "Solid drift" gate step); pin an exact RC and bump deliberately.
*Reasoning:* the library's claim is parity with Solid, not stability against it. *Implementation:* none; Phase 3 vendors the originals runnable so the harness keeps its oracle.

### D-046 — `html`` ` flavor dropped
**Decided (Dev, 2026-10-04).** `@solidjs/blocks/html` (Solid's tagged templates with typed holes) is removed; `h()` is the no-JSX flavor. Facts that settled it: both `-h` twins use `h()` only; no twin, fixture or doc example exercises `html`` ` beyond the package's own unit tests (5 cases in `nojsx.spec.ts`, 3 in `nojsx.type-tests.ts`), and `html.ts`'s docstring still showed the `$(function* …)` form D-013 removed. Removal list: `src/html.ts`, the two `html` entries in `scripts/build.mjs`, the `./html` export and the `@solidjs/html` dependency in `package.json`, the 8 test cases, doc §1/§2 mentions (lines 11, 26, 33, 44–46 at `46124409`).
*Alternatives:* keep it and add an `html` twin; keep it on unit tests only.
*Reasoning:* D-005/D-012 — a second no-JSX surface with no twin cannot be kept in parity with the first. *Implementation:* Phase 1A item 4e.

### D-047 — `@solidjs/blocks` exports `lazy`; `adopt()` removed
**Decided (Dev, 2026-10-04).** The library exports its own `lazy`, wrapping `solid-js`'s with the same signature (`preload` / `moduleUrl` kept, so the Vite plugin's module-URL pass still works); the result is a block component colored **pending while its chunk loads**, unioned with the inner block component's own declared colors, and usable in call form (`{yield* Home()}`) as before. `adopt()` — "a component this library did not create, usable in call form" — is deleted: all 7 twin uses were `adopt(lazy(…))` (`rendering-blocks`), the general case had none, and its return type dropped the chunk-loading pending (the D-044 gap one level up). Foreign non-lazy components have no bridge; if a twin needs one, that is the finding.
*Alternatives:* blocks `lazy` plus keep `adopt` as the general bridge; keep `adopt` and overload it on Solid's lazy return type (`T & { preload; moduleUrl? }`).
*Reasoning:* Dev: if it is for lazy, build it into lazy; D-004 forbids patching Solid's, so the library wraps it; D-005 removes the now-unused bridge. *Implementation:* Phase 1A item 4d with D-044 (type test "a view rendering a loading `lazy` is pending"; the 7 sites change import only).

*Module URL (Phase 2, `5770f1a5`).* The 1A finding below said the module-URL pass belongs in the Phase 2 plugin; it now writes it.

- `@solidjs/vite-plugin-blocks` gives `lazy(() => import("…"))` from the blocks module the annotation `@solidjs/vite-plugin` writes for `solid-js`'s `lazy`: a third argument `"__SOLID_LAZY_MODULE__:<spec>"`, with `void 0` filling an omitted options slot. `solid()` resolves it to the project-relative path.
- Eligibility mirrors the compiler's `lazy.rs`.
- Tested through Vite: the fixture's lazy components carry `moduleUrl` on the client and the server, and all 7 of rendering-blocks' lazy calls (six pages in `App.tsx`, `Profile` in `Profile/index.tsx`) resolve to `shared/src/components/<Page>.tsx`.

Migration count (1A item 4c, after D-058 removed the server-component twins, 2026-10-04): 16 `$snapshot` sites in 6 files — effect 1, rendering 3, room 0 (both of its sites were in the removed server-component page), sierpinski 6, sierpinski-h 6, plus 6 in the package's tests. **`$untrack` was needed at 0 twin sites** (used only in the package's tests and type tests): every site had a reactive form — a seed became `$signal<T | undefined>(undefined)` plus a `$memo` falling back to the prop (rendering's router `url`, ErrorStream's `id`); a config read moved into the holes that use it (sierpinski's positions, rendering's `Repeat` index walking `props.rows[yield* i]`); a structure chosen from props became a flow control over a hole (sierpinski's leaf-or-branch: `<Switch>`/`<Match>` in JSX, `Show` in `h`, with the children's positions read in holes or — in `h`, where a component prop takes a value or a source — lazy memos, and the slow-children memo `{ lazy: true }` so a leaf never starts its idle work); a callback prop moved into the event that calls it (effect's `(yield* props.log.clear)()`). By D-042's own rule `$untrack` is therefore a D-005 candidate (kept: the decision adds it, and the rendering router's `url` read is the one place "taken once" would be the faithful spelling — it is read tracked, since the prop never changes).

### D-048 — `$event` paused on a pending read
**Decided (Dev, 2026-10-04): `$event(body, { latest: true })`.** A read inside an event that hits a pending source waits for its data (tested); the wait is unbounded (only `until` has a timeout) and by default a second call of the same event starts another independent run while the first keeps waiting. Nested event calls already merge into the outer transaction (Solid's `action`: "a nested action … runs inside the OUTER action's slice"). With `latest: true`, a new call closes the earlier run that is still paused (or awaiting an async `attempt`) — the runtime already closes superseded generators with `gen.return()` in the memo and event paths — and the closed run's promise settles as superseded (not a failure; the event's typed-failure color is unchanged). Runtime test: typing fast into a search box — only the last call's writes land. Doc §1 events bullet.
*Alternatives:* independent runs only (document); a per-event `timeout` failing with a typed `TimeoutError`.
*Reasoning:* the search-box case is common and the mechanism exists; an opt-in keeps Solid's default action semantics. *Implementation:* Phase 1A item 8 (touches the event path).

### D-049 — `h` flavor: the no-body rule is type-level only
**Decided (Dev, 2026-10-04).** For `h()` views, "a view reads only in holes" is enforced by the existing type check `[HVIEW_READ]` (`HViewOp = never`) only; the lint `no-read-in-view-body` and the dev error `[READ_IN_VIEW]` stay JSX-only.
*Alternatives:* the same three levels for both flavors by generator nesting; runtime only for `h`.
*Reasoning:* `h` views are the rarer form and already have the strongest (type-level) check — the one JSX cannot have (D-051).

### D-050 — D-013 amended: in JSX the hole is `yield*` only
**Decided (Dev, 2026-10-04, from a Phase 1A finding).** A bare `function*` as a JSX child or attribute value cannot be a hole: the JSX compiler passes it straight to `@solidjs/web`'s `insert()`/`setAttribute()`, which never call the library. In JSX the hole form is `{yield* x}` (the transform's `perform`); a `function*` block is the `h` flavor's hole form and the form for flow-control **props** (`<Show when={function* () { … }}>` reaches the component, D-038). A `function*` JSX child/attribute is a type error, pinned by a type test.
*Alternatives:* a second transform rule rewriting a `function*` JSX child/attribute into a hole call — rejected, it reverses D-031's one-rule stance.
*Reasoning:* the transform is the ergonomic path (D-031); the one thing it rewrites is `yield*`. Implemented in `9f0dac54` on `bl/tighten`.

### D-051 — D-032 amended: JSX enforcement is runtime + lint
**Decided (Dev, 2026-10-04, from a Phase 1A finding).** At the type level a JSX view's hole reads *are* its yields — TypeScript types `{yield* user.name}` inside JSX exactly like a statement yield — and that is the only channel for a JSX view's colors (`ViewPending<VY, R> = PendingOf<VY | HOps<R>>`). So "`Read` is not a `ViewOp`" holds for `h` (`HViewOp = never`, `[HVIEW_READ]`) but cannot for JSX. For JSX the no-body rule is enforced by the dev error `[READ_IN_VIEW]` and the lint `no-read-in-view-body` (which replaces `no-read-outside-hole`, D-005); migration count on the lint's first run: 0 in every twin (the old rule already enforced it). Recorded in §7 as a limitation of the transform route.
*Alternatives:* time-boxed research into branding `perform`'s yield (`HoleRead`) so a statement-level `Read` is rejected while JSX reads pass.
*Reasoning:* no parity test failed and the rule is enforced at two of three levels; a type-level form for JSX may not be expressible in TS. Implemented in `b1634e33` on `bl/tighten`.

### D-052 — `createContext(defaultValue)` wraps a plain value as a constant source
**Decided (Dev, 2026-10-04, from a Phase 1A finding).** Removing the `$` block form (D-013) left no way to create a constant source outside a setup; the two twins that needed one used it as a context default (room's `NOBODY` identity, rendering's detached-router default). `createContext` now accepts a plain default value and wraps it as a `Source<T, false, never>` itself (a constant needs no owner); `yield* Ctx` in a consumer reads the provided source or the constant. Context defaults go back to one line: `const IdentityContext = createContext<Identity | null>(null)`. The agent's interim workaround (default `undefined` + a `$memo` fallback in each consumer's setup) is reverted in both twins.
*Alternatives:* a new `constant(value)` export usable at module level; keep the workaround (a memo per consumer, no new surface).
*Reasoning:* the only real use is the context default, so the capability lives in `createContext` rather than as a new general export (D-005). *Implementation:* Phase 1A, with item 8's surface cleanup (type test: the default is settled; runtime test: a consumer with no provider reads the constant).

### Phase 1A log (items 2–6, `bl/tighten`)
`5a3bfba2` duplicate-runtime guard · `9f0dac54` rows and holes are bare `function*`, the `$` and `$scope` forms removed (32 twin + 13 test sites; new dev error `[ROW_VIEW]` for a row returning markup directly, D-030) · `b1634e33` a view has no body (`[READ_IN_VIEW]`, `no-read-in-view-body`) · `4f5f0dd1` one host state per run via `runAs` · `6200928e` `$optimistic` scalar / `$optimisticStore` object-or-body — D-014's "overload" never existed in this history; a dev error `[OPTIMISTIC_FORM]` now refuses the wrong form in both directions · `c9179cc5` path-proxy traps (`[PATH_OBJECT]`, lint `no-path-object-use`). The constant-source finding is D-052.

### D-053 — `$effect` and `$settled` both stay
*(Its one-pass `$effect` is superseded by D-079: `$effect(compute, effect)`. `$settled` stays as is.)*
**Decided (Dev, 2026-10-04).** Two things, not one: `$effect` (a `createTrackedEffect` pass; re-runs when what it reads changes; writes queue to the flush; 2 twin files) and `$settled` (`onSettled`; runs once after the graph settles, reads untracked; 6 twin files). §1 states the rule in one line: "`$effect` reacts; `$settled` runs once after settle".
*Alternatives:* fold `$settled` into an `$effect` that reads nothing (loses the after-settle timing); rename `$settled`.
*Reasoning:* the timing guarantee is the difference, and the twins use the one-shot form three times more — it is the common case, not a convenience.

### D-054 — `view()` typing wrapper (no `setup()`)
**Decided (Dev, 2026-10-04).** Optional zero-runtime wrappers that type-check a view (or a setup) in place, so a type error inside a hole lands on its own line instead of on the `$component(` call forty lines up with the whole yield union: `return view(function* () { return <div>{yield* props.todo.title}</div>; });`. Identity at runtime; the lint `prefer-view-wrapper` (warning) suggests it; the twins adopt it. *Amended (Dev, same day):* `view()` only — there is no `setup()` wrapper; the setup is the component function itself and its errors already land locally. The design review called this the biggest DX lever without a TS plugin.
*Alternatives:* better branded-never messages at `$component` only; defer to Phase 4 to compare with a TS language-service route.
*Reasoning:* cheap, local, removable; it does not preclude a plugin later. *Implementation:* Phase 1A item 9 (types + type tests showing the error location; lint; twin adoption; doc §1).

Implementation note (1A follow-up, `899e2899`): with `view(…)` a view's mistake is reported on the `view(function* () {` line, naming the op (`Create<"signal">` is not a `ViewOp`) — local, not at the `$component(` call with the whole setup's yield union — but not on the offending line: TypeScript does not check a `yield*` operand against a contextual yield type (tried: a constrained generic, an intersection, overloads with a non-generic last signature; all report at the call). Type tests pin both locations.

*Amended by D-089:* `view(function* …)` is required, not optional; `prefer-view-wrapper` becomes the error `require-view-wrapper`.

### D-055 — A row receives `item: Source<T>` and `index: Source<number>`
**Decided (Dev, 2026-10-04).** The row body of `<For>` (and the other list controls) is a setup (D-030) called with `item: Source<T, P, E>` and `index: Source<number>`: a keyed row's item can change in place, so it is reactive and read with `yield*` (`yield* todo.title` is a path read); the index moves when the list reorders. Consistent with D-042 (everything a block is given is reactive).
*Alternatives:* a plain `item` value with the row re-created on item change (Solid's `For` semantics; the row's setup could not react to item changes); mirror each Solid control's own convention.
*Reasoning:* one convention for every control, and it is the one the twins already use. *Implementation:* Phase 1A item 4 verification (type test on the row signature; runtime test: an in-place item change updates the row without re-creating it).

### D-056 — Props are a plain object type; `TypedProps` removed
**Decided (Dev, 2026-10-04).** A component declares its props as a plain object type — `$component(function* (props: { todo: Async<Todo, FetchError>; onToggle: (id: number) => void }) { … })` — and `$component` maps each field to `Source<T, false, never>` (bare) or `Source<T, true, E>` (`Async<T, E>`) at the type level. `TypedProps<P, Key>` is removed outright (not just its key, as D-023 first planned): nothing is left to wrap.
*Alternatives:* keep a key-less `Props<>` wrapper as an explicit mapping step.
*Reasoning:* D-005 — the wrapper existed for the linker key; without the key it is ceremony. *Implementation:* Phase 1B commit 1 (supersedes the "keys deprecated-but-accepted" step: `TypedProps` is deleted in commit 1 and the twins drop it in commit 2).

*Implemented as amended by D-068 (1B, `e1aba8f6`).* `TypedProps`, `PropColor`, `PropColors` and `PropColorsOpen` are removed outright. 59 twin annotations moved to `Props<…>`.

### D-057 — Phase 2 starts after Phase 1B lands
**Decided (Dev, 2026-10-04; Q23 closed).** Serial: Phase 2 (standalone plugin) begins once all of Phase 1B is fast-forwarded into `blocks-lib`. Both phases edit every twin's `vite.config` (1B removes `solidLink()`, Phase 2 adds `blocks()`); serial order avoids twelve guaranteed rebase conflicts and lets Phase 2 start from the linker-free twins.
*Alternatives:* fully parallel; Phase 2's twin-free commits first, then wait for 1B's linker removal.
*Reasoning:* the worktrees are cheap on this machine, but the merge conflicts are not worth the overlap.

## Open questions

- ~~**Q22** — repo layout for extraction (D-015).~~ Decided (D-015).
- ~~**Q23** — start Phase 2 in parallel with Phase 1B.~~ Decided: serial (D-057).
- D-032 migration: the exact count of view-body read / branch sites per twin, from the lint's first run.
- ~~Whether `context()` and `createContext()` stay separate long-term.~~ Decided: `context()` removed (D-036).
- ~~Whether `no-unyielded-write` gets a sync exception for `start(call)` (D-021).~~ Moot: `start` removed (D-035).

## Design-review items not yet turned into decisions

Async `$memo` is emulated over `createMemo` + `latest`/`isPending` → needs a deterministic pending-flip ordering test. The SSR path skips whole-view detection → needs a both-sides top-level-read hydration test. The JSX rule applies syntactically anywhere in a generator → lint "JSX only in views" or assert the host in `perform`. Refusals should be listed in one "what you can't write in a view" table. Port the experiment branch's `$`-block conformance harness (`packages/web/test`) as a semantics pin independent of the twins. Error-locality helpers (`view()`/`setup()` wrappers) are the biggest DX lever without a TS plugin.


### D-058 — No server-component support in the blocks model
**Decided (Dev, 2026-10-04).** Server components are out of scope for this model: the idea is that a future compiler finds inert regions and turns them into server components automatically, so the user never thinks about it. Twins whose point is server components are removed; a twin that merely *fetches* server data (server functions, SSR) stays. Disposition, from the survey (`"use server"` files / frame references / `$dynamic` users): **removed** — `examples/notes-blocks` (the RSC notes demo as Solid Server Components; its original is an SC demo too, so a converted twin would have no parity oracle), `examples/hackernews-blocks` (HN as Server Components over frame streams; `hackernews-spa-blocks` is already the same app client-rendered over server functions), `examples/chat-blocks` (a simulated LLM chat as Server Components). **Converted** — `examples/room-blocks`: keep the live server functions (server data), drop the one live server component; if that proves to be most of the app, remove it too and say so. **Kept** — hackernews-spa, effect, rendering (server data / SSR only), todos, todos-h, sierpinski, sierpinski-h, migrating-element (client only). `$dynamic` is removed with them: every call site was `attempt(() => <server-component call>)` and nothing else used it (D-005). Twin count 12 → 8 (+ room if the conversion holds).
Consequences: F1 (server-component props in event/`ref` positions) disappears — hydration-claim stubs only exist for server components — so D-042 applies as written; D-044 is moot; the `blocks-linker` fixture `gap` and any harness/gate references to the removed twins are deleted; the gate baseline is regenerated.
*Alternatives:* keep server components with an attach-by-value rule for event/ref positions (F1-A); convert every SC twin to client + server functions (no parity oracle for the converted ones).
*Reasoning:* Dev: server components are a compiler concern, not a model concern. *Implementation:* Phase 1A follow-up (same agent session).

### D-059 — A row need not be settled
**Decided (Dev, 2026-10-04).** A row's view may fail: a failure raised in a `<For>` (or `Repeat`) row propagates to the view holding the `<For>` — the `<For>` element's failure type is the union of its rows' failure types, which joins the enclosing view's, and at runtime the failure reaches the nearest `<Errored>` above the list or re-throws at the root (D-033). The "row must be settled" constraint is removed for failures; pending rows are unchanged by this decision (report if they prove to be the same wall). Closes F2: with `$dynamic` gone (D-058) the remaining colored elements are the library's `lazy` (pending) and `Async` props (1B), both of which propagate the same way.
*Alternatives:* require an `<Errored>` per failing row (B); accept failing elements at every position with root reporting (C, the general form — D-059 is its row-specific instance; extend to other positions only when a twin needs it).
*Reasoning:* the runtime already propagates; the types should say what the runtime does. *Implementation:* Phase 1A follow-up (types + type test "a failing row colors the holding view"; runtime test: a row's `raise` reaches an `<Errored>` above the `<For>`).

### D-060 — `constant(value)`; `createContext` stays plain
**Decided (Dev, 2026-10-04; supersedes D-052).** Finding: a context that holds a source (room's identity, provided `value={me}`) and a context that holds a plain value (todos' `[TodoStore, Actions]` tuple, destructured in consumers' setups; effect's `RuntimeContext` read by a verbatim Effect layer through Solid's `useContext`) are the same `createContext(null)` call, so the library cannot know which default to wrap; wrapping every plain default would make `yield* Ctx` return a source everywhere. So the writer states the kind: `constant(value)` → `Source<T, false, never>`, usable at module level (a constant needs no owner); room writes `createContext(constant<Identity | null>(null))`; todos and effect keep plain defaults. The `undefined` + `$memo` workaround in room and rendering is reverted.
*Alternatives:* keep the workaround (a memo per consumer); two creators (`createContext` / `createSourceContext`).
*Reasoning:* explicit, one small export, no ambiguity — and it is the one surviving use the `$` block form had. *Implementation:* Phase 1A follow-up 2.

### D-061 — migrating-element twin removed
**Decided (Dev, 2026-10-04).** `examples/migrating-element-blocks` is removed. Its point — `const hoistedCanvas = <Canvas />` held as a value and shown in several `<Show>` slots so the DOM node migrates — is exactly what D-041 forbids (an element is not a value in a block). Like D-058: a twin that exists to demonstrate something the model rejects by design is outside the model; node migration stays a Solid feature the compiler route can show. The `eslint-disable` exception the agent kept is gone with it. Twin count 9 → 8.
*Alternatives:* a sanctioned `$element(<Canvas />)` creator for hoisted elements (one escape for one demo); keep the lint exception as the documented limit.
*Reasoning:* the alternatives keep either an escape hatch or a permanent exception. *Implementation:* Phase 1A follow-up 2.

### D-062 — Components are called, not tagged
**Decided (Dev, 2026-10-04).** A component (anything that is not a DOM element) is used in call form inside a hole — `{yield* Card({ todo })}` — never as a JSX tag; JSX tags are for DOM elements only. Finding that drove it: a JSX tag's type is always `JSX.Element`, so a component's colors (pending / failures) travel only through `yield*` and are dropped at a tag; the agent's implementation therefore made a colored component's tag an element only when settled, which forces boundaries the originals do not have — the wall of F2 and of 1B's `Async` props. Dev's rule, and its reason: call everything by convention, so that when a component goes from no effects to effects (gains a color) it does not have to be rewritten at every call site; colors are always tracked. Flow controls are components and are called too: `{yield* For({ each: todos, children: function* (todo) { … } })}`, `{yield* Show({ when, children })}` — which is also the only form in which a list carries its rows' colors (D-059/D-063). Props are a plain object literal, checked directly against the declared prop type (D-056). Enforcement: lint `no-component-tag` (error, `recommended`) with an autofix tag → call; the JSX namespace rejects component tags at the type level if feasible; twins migrated (every component tag). JSX keeps: DOM elements, holes `{yield* x}`, component calls, settled children.
*Alternatives:* tags erase colors by rule (runtime propagates; §7 limitation); decide from 1B's counts.
*Reasoning:* the alternative makes typed failures complete only along `yield*` chains and silently incomplete at every tag; the convention costs one migration and never a per-call-site rewrite later. *Implementation:* Phase 1A follow-up 2 (before 1B, which depends on it).
*Migration (Phase 1A follow-up 3, with D-065…D-067; one commit, since the types that refuse tags and the recommended rules would turn an unmigrated twin red).* Per twin, tags → calls / children → generators / in-prop reads → holes, by the autofix, then by hand: effect-blocks 18 / 2 / 0, and by hand the tab's `fallback={<Checkout />}` became a lazy-view fallback. Built eagerly, it set `Checkout` up at start and fetched the orders before the tab opened, which parity step 16 caught; the autofix now writes a tag given as a prop as a lazy view, and a flow control's `fallback` accepts one. hackernews-spa-blocks 17 / 0 / 0, plus the `Router` callback's `children` by hand. rendering-blocks 37 / 6 / 0, plus 7 `when: yield* matches(…)` by hand, made holes. room-blocks 21 / 9 / 0, plus the `Router` callback's `children`. sierpinski-blocks 4 / 1 / 10. todos-blocks 7 / 2 / 0. todos-blocks-h and sierpinski-blocks-h have 0 (`h` already calls). In all, 104 block component tags. Package tests: 110 tags, 25 children, and 1 in-prop read by the syntactic lint, and tag-era type assertions became typed `View<…>` consts. Parity stayed green in every twin and no rule had to bend. The linker summaries of hackernews-spa, rendering and room were regenerated with `solid-link`: the calls pass `children` as a prop, and rendering's `FeedCard.feed` is now inferred pending / `FeedError` through the call.

### D-063 — Pending rows propagate like failing rows
**Decided (Dev, 2026-10-04).** D-059 extended to pending: a pending row propagates to the view holding the `For` (to the nearest `<Loading>`), tracked through the call form; `[UNSETTLED_ROW]` is removed. One rule for both colors; sierpinski's lazy-memo workaround can be revisited.
*Alternatives:* keep pending rows refused (read async data in a hole).
*Reasoning:* the same reasoning as D-059, and symmetry. *Implementation:* Phase 1A follow-up 2 (types, type test, runtime test: a pending row reaches a `<Loading>` above the list).

### D-064 — `latest` removed
**Decided (Dev, 2026-10-04; reverses D-048).** `$event(body, { latest: true })` is removed with its tests and doc mention: too many footguns — the superseded run resolving `undefined` where the type says a result was the first, and the fixes (propagating supersession to waiters, or a `SupersededError` color on every `latest` event) each add a rule. Events are independent runs, full stop; a search box that wants latest-wins reads the input through a `$memo` (which already closes superseded runs) and renders that.
*Alternatives:* keep `latest` with supersession propagating to waiters; keep it with a typed `SupersededError`.
*Reasoning:* D-005/D-006 — one event semantics, no corner cases. *Implementation:* Phase 1A follow-up 2 (revert `476f703c` minus its test for independent runs).

### D-065 — Call-form props take a source, a hole or a settled value
**Decided (Dev, 2026-10-04; D-062 rule 1).** A JSX tag wraps each dynamic attribute in a getter, so the read happens inside the child; a call evaluates its arguments first, in the parent — `Show({ when: (yield* n) > 0 })` would read in the parent's hole and re-create `Show` and its subtree on every change. So a prop value in call form is a `Source`, a zero-arity `function*` hole (D-038 generalised from flow controls to every component prop: `Card({ total: function* () { return (yield* n) * 2; } })`), or a plain settled value; the child reads it with `yield*` like any prop (D-042). A `yield*` inside a call's argument is a lint error: `no-read-in-prop` ("read in a prop: pass the source, or a hole").
*Alternatives:* a named `$memo` per derived prop in the caller's setup.
*Reasoning:* D-038 and D-042 made consistent — everything a component is given is reactive, and derived values have one form everywhere.

### D-066 — A component call's `children` is always a generator
**Decided (Dev, 2026-10-04; D-062 rule 2).** A tag builds its children inside the parent component — after it set its context, or decided to show them; a call would build plain-JSX children eagerly in the caller (`IdentityProvider({ children: <Router/> })` builds the router and its `useIdentity()` consumers before the provider sets its context; `Show({ children: <Panel/> })` builds while hidden). So `children` in call form is always a generator: `children: function* () { return <p>{yield* x}</p>; }` — a lazy view that may contain holes; lists take `children: function* (item, index)` rows (D-055). There is no plain-JSX children form; arrow render callbacks become row generators.
*Alternatives:* allow plain JSX children when they contain no holes (two forms, and the provider case still builds eagerly).
*Reasoning:* one form, always lazy — what the tag did implicitly; the verbosity is the cost of call form.

### D-067 — Tags are DOM elements and foreign Solid components; block components are called
**Decided (Dev, 2026-10-04; D-062 rule 3).** Solid's own components (`Router`, `Portal`, `HydrationScript`, context providers, Solid's `Reveal` — 11 twin sites) return Solid's `JSX.Element` and need Solid-style lazy props, so `yield*` cannot take them. Rule: a JSX tag is for things that are not blocks — DOM elements and foreign (plain-Solid) components; a block component is called. Enforcement: block components already carry a component mark; the JSX namespace rejects *branded block components* as tags (a type error), not every non-intrinsic tag; lint `no-component-tag` (error, autofix tag → call) for block components only. Foreign components have no colors to track, so nothing is lost at their tags.
*Alternatives:* a typed bridge to call them (`adopt()`, removed by D-047); library wrappers for the few in use.
*Reasoning:* it states the real boundary — the model vs plain Solid — instead of hiding it behind a bridge or wrappers that grow with every foreign component. D-062 stands as written with these three rules; its migration (116 tags: 65 flow controls/boundaries, ~40 block components, 11 foreign) proceeds.
*Foreign components that remain tags after the migration (12 sites).* `Router` ×2 (hackernews-spa-blocks, room-blocks); Solid's `Reveal` ×3, `Portal`, `HydrationScript`, and the `RouterContext` provider (rendering-blocks); `HydrationScript` and the `IdentityContext` provider (room-blocks); the `TodosContext` provider (todos-blocks); the `RuntimeContext` provider (effect-blocks).
*Amended by D-088:* "nothing is lost at their tags" holds for a foreign component's own tag, not for block components handed to it as values (the router, `render`): those go through `foreign()`.

### D-068 — D-056 amended: `Props<{…}>`, `Source<T, E = never, P = false>`, no `Async`
**Decided (Dev, 2026-10-04; from the Phase 1B agent's finding).** D-056 asked for a plain object annotation with `$component` mapping each field to a Source; TypeScript gives a body exactly the parameter type written, and nothing the called function declares can change it (checked with tsc: `props.label` is `string` inside the body and `yield*` iterates its characters). The mapping must be visible in the annotation, so: (1) a key-less wrapper `Props<{ todo: Source<Todo, FetchError, true>; label: string }>` — today's `TypedProps<P, K>` with the linker's `ColorOf<K, N>` lookup replaced by each field's own declared color; it is the only spelling that also carries D-029's pass-through generics (`function* <E, P extends boolean>(props: Props<{ todo: Source<Todo, E, P> }>)`); ~67 annotation sites. (2) Colors are declared with the one general type, parameters reordered to `Source<T, E = never, P extends boolean = false>`: `E` carries information and reads like `Result<T, E>`, `P` is a flag and goes last; the forms are bare `T` (settled, D-024), `Source<T, E>` (sync, may fail — e.g. a validating `$memo`), `Source<T, E, true>` (may be pending, may fail — the common async case under D-034), `Source<T, never, true>` (pending, never fails — rare). (3) No `Async<T, E>` alias (D-005: a second spelling that named only one corner). Variance and the call-site message are unchanged. Implementation note: `Component<…>` becomes a plain function type so a generic component keeps its type parameters (today `$component` drops them); D-067's tag check recognises a block component by its `View` return type instead of the brand; `$component`'s no-JSX rest parameter is to be checked against that.
*Alternatives:* a curried explicit type argument (cannot express D-029); annotating the variable with `Component<…>` (colors written twice); every field declared as a source type (breaks D-024's bare = settled).
*Reasoning:* the wrapper is the one thing that can do the field→Source mapping; one type for all four color corners. *Implementation:* Phase 1B commit 1 (the `Source` reorder across the library is inside that commit; site count reported).

*Implemented (1B, `e1aba8f6`).*

- **The reorder** touched about 63 `Source` / `Path` sites: 35 in the library, 8 in the tests, 20 in the twins. Room's seven `Source<…, true, unknown>` became `Source<…, LiveError, true>`. Room's `Card` memo now routes its stream through `attempt(…, cause => new LiveError(cause))` instead of widening to `unknown`, and effect's `Results.results` declares `SearchError | TransientError`.
- **Tag check.** "A function returning a `View`" could not tell a foreign component that returns blocks' `Element` (which includes a settled `View`) from a block component. The mark is therefore a `[COMPONENT]` brand on the returned view (`ComponentView<P, E>`): `TagType` refuses a function returning one, and `no-component-tag` looks for it with type information. The no-JSX rest parameter of `$component` (`NoJsxViewRule`) does not interfere with generic inference.
- **New exports.** `Props`, `PropsArgs`, `PropsInput`, `HoleProp`, `SettledProp`, `ComponentView`, `ViewPending`, `ViewFails`, `ViewYield`, `ViewReturn`, `NoJsxViewRule`. The view helpers had to be exported because a generic higher-order component's inferred type names them (rendering's `RouteHOC`).
- **D-034 at the declaration.** `Props<D extends PropsCheck<D>>` refuses a declared `E` that is not a `Failure` with a literal `kind`, at the annotation.

### D-069 — Conformance findings: the library route against the oracle and the compiler route
**Recorded (Phase 4, item 1; for Dev's ruling).** The conformance port (D-039) runs each scenario's handwritten Solid program (the oracle) and its library-dialect twin through the same steps, on the client, on the server and in hydration. It compares their traces. Every difference is declared exactly in `packages/blocks/test/conformance/scenarios/declared.ts` and listed in that directory's `COVERAGE.md`. This entry records them. F1–F5 are the library against the oracle; F6 is the library route against the compiler route's frozen server output. None is normalized away. Each is pinned, so a change in either direction turns the gate red.

*Status (Phase 5, 2026-10-05).*

| Finding | Status | Where |
| --- | --- | --- |
| F1 `$effect` one pass | **gone**: `$effect(compute, effect)`, blocks-effect equals the oracle | D-079, `360371d` |
| F2 a row's view renders once | **an oracle artifact, fixed**: the reference rows returned a thunk; blocks-row-list equals the oracle | "F2 resolved" below, `168ca21` |
| F3 a superseded memo run closed | **gone**: the run continues, its result discarded; async-flights equals the oracle | D-080, `caf6117` |
| F4 an `$event` call is one transaction | **the model**: kept and documented (§3), `$optimistic` for what shows during the wait | D-081 |
| F5 deeper hydration keys | **a documented cost** (§8): +2 characters per level, measured on rendering's SSR; hydration improves with the compiler | D-082 |
| F6 the routes' hydration keys differ | **not mixed**: one route per app | D-074 |
| F7 a false server `READ_IN_VIEW` | **fixed** (Phase 4) | F7 below |
| F8 a nested row's server read order | **the model**: a view's holes are read before its children on the server; the markup is unaffected (declared with F5 in `declared.ts`) | D-084, `168ca21` |

- ~~**F1**~~ *(resolved by D-079: with `$effect(compute, effect)` blocks-effect's library trace equals the oracle's; the declaration is removed.)* **F1 — `$effect` is one tracked pass (blocks-effect, client).** The reference uses Solid's split effect, `createEffect(compute, effect)`. `$effect` is one `createTrackedEffect` pass (D-053). The subscriptions, values, runs and cleanups are the same; the order is not:
  - the first run comes after the view's first read;
  - on a re-run the previous cleanup runs before the new reads;
  - the branch read of `c` happens inside the body, after the write of `b`.
  The split form has no block spelling. Re-read against D-032: the scenario's branch (`if (v > 1) … yield* c`) is inside the effect, which is where D-032 puts a branch; the view is `<p>{yield* b}</p>`, no body.
- ~~**F2**~~ *(resolved: an artifact of a non-idiomatic oracle, see "F2 resolved" below.)* **F2 — a row's view renders once (blocks-row-list, all environments).** Each hole is its own computation, so a list update re-renders no row view. The reference's row callback returns a thunk that the list's insert calls again on every update, so each row re-reads its `open`; the fork's islands mode matched the library here. At mount a row's view is built right after its setup (setup a, view a, setup b, view b). The reference sets every row up first, then renders. Writes, runs, cleanups and markup are the oracle's. In hydration the reordered rows keep their server nodes; the oracle re-creates every row's element.
- ~~**F3**~~ *(resolved by D-080: a superseded run is not closed; async-flights' library trace equals the oracle's, the declaration is removed.)* **F3 — a superseded `$memo` run is closed at its pending `attempt` (async-flights, client).** Its generator is returned. An async function continues after `await` and its result is discarded, so `owner after wait(2)` is not logged. A run disposed with its owner is not closed, so async-disposal is equivalent.
- *(F4: the model, D-081.)* **F4 — an `$event` call is one transaction (async-event, client; D-020).** The write made before the event waits (`saving`) is held until the call settles, so the DOM keeps `idle`; the reference writes through at once. Showing a write while an event waits is `$optimistic`'s job. Everything else is the oracle's, including the rejection reaching the `Errored` above the event's owner.
- *(F5: a documented cost, D-082.)* **F5 — hydration keys (every SSR scenario, server and hydrate).** The markup is the oracle's; the `_hk` values are not. Each `{yield* …}` hole is an owner, and so is each flow control called in one, so the library's keys are deeper: `1000` / `1010` / `1020` where handwritten Solid has `100` / `110` / `120` (`3` / `5` / `7` before the oracle fix, "F2 resolved"); `100222000` for the oracle's `104200` at depth 2 of the recursive rows; `200` for the `Loading`'s `20`. Each route hydrates its own markup with every node kept (3/3, 9/9, 4/4, 2/2).
- **F6 — the library route and the compiler route number hydration keys differently (blocks-row-list, -recursive, -keyed-store, server).** `routes.spec.ts` compares `server/library` with the fork's `server/blocks-compiled` output, kept frozen under `__artifacts__/compiler-route/`.
  - The markup is the same.
  - The compiler route makes each `$component` view and row view a hydration-id scope (`blockScope`): `00`, `01000`, `01100`, adding 3 digits per level of rows.
  - The library route has Solid's owner ids: `0`, `1000`, `1010`, adding 5 digits per level.
  - So the routes are not interchangeable. The library client, given the compiler route's markup, misses every key, the root's included, and leaves the page inert (`hydrate-self-test.spec.ts`). The reverse needs the blocks compiler, which is not here.
  - Consequence: a page rendered on the server by one route cannot be hydrated by the other. A future compiler route either adopts Solid's owner numbering or ships its own client.
  - The compiler-route output also has `<!--!$-->` between rows. That is Solid drift, not the route's: rc.13's own reference no longer emits it, though the fork's Solid did.
- **F7 — a false `READ_IN_VIEW` on the server (fixed).** Solid's server `For` / `Show` read `each` / `when` synchronously as they are created, with no observer, while the holding view runs. In development every named component holding a flow control hit `READ_IN_VIEW` on the server; anonymous ones were never checked. The runtime now runs a flow control's creation as its own (`flowControl` in `runtime.ts`). The test is ssr "a flow control's own prop reads are not the named view's" and the changeset is `blocks-server-flow-control-reads.md`.
- **F2 resolved (orchestrator's check, Dev's correction, 2026-10-05).** The reference row callbacks returned a *thunk* (`return () => <li …>`). Solid's `For` never re-invokes a row callback on a plain update: what re-ran was the thunk, resolved again by `insert`'s effect whenever the items changed, and the "set every row up, then render" mount order came from the same shape (setups in `mapArray`, thunks later in `insert`). The difference was the oracle's, not the library's. The three row references (blocks-row-list, -recursive, -keyed-store; `grep 'return () =>'` found no other row or child content — blocks-effect's is a cleanup) now return the element directly, idiomatic Solid. Re-recorded: blocks-row-list's client/library trace equals the oracle's (its declaration removed); the hydrate sub-point is gone too (the oracle no longer re-creates every row's element on a reorder: its reordered rows keep their server nodes and keys, as the library's do). The oracle's server keys moved with the shape (`3` / `5` / `7` → `100` / `110` / `120`; the recursive rows' `74` → `104200`): F5's described numbers are updated, its substance (the library one owner level deeper per hole) unchanged.
- *(F8: the model, D-084.)* **F8 — a nested row's server read order (blocks-row-recursive, server; found by F2's oracle fix).** With the idiomatic oracle, Solid's server render of node `a` reads `open a` for the toggle, renders the nested rows (`open a1` twice), then reads `open a` again for the `<ul>`'s `style`. The library reads both of `a`'s holes, then the nested rows. Same reads, values and markup (beyond F5's keys); only the order differs, and only on the server (the client and hydrate traces are equal modulo keys). Declared exactly in `declared.ts` with F5. Not judged; for Dev.
- **The compiler-route artifacts and the thunk shape.** `__artifacts__/compiler-route/*.server-blocks-compiled.html` is the fork's blocks compiler's server output of the *library-dialect* sources, frozen markup: no reference row callback is involved, so the thunk shape could not reach it, and F6 / D-074 (which compare server markup) are unaffected. The fork's own reference sources, ported verbatim here, had the thunk shape, so the fork's reference goldens and its islands-mode comparison (which "matched the library" on F2) carried the same artifact. The fork itself is not checked out here.

*Solid drift seen by the port (not findings; D-045).* Against the fork's goldens, every client golden trace is byte-identical on rc.13. The server and hydrate goldens and the `server-reference` artifacts of the three row scenarios moved with rc.13: `<!--!$-->` is gone between rows, the keys are renumbered (`4` → `5`, `60` → `70`), and one `_$HY.sh` script is gone from async-hydration's stream. They were regenerated on published Solid. The reference stays the oracle because it is plain Solid, whatever its version.

*Not ported.* blocks-context is moot under D-036: `yield* Ctx` is the one way to read a context, so there is no second form to pin. blocks-async-event still reads one, through a helper generator. Also not ported:
- the `$`-dialect-only scenarios (memo-effect-order, dynamic-subscriptions, owned-children, owner-routing, error-routing, event-reads-writes, store-paths, store-dynamic-index, prop-paths, jsx-block, error-markers): they have no generator-blocks source to translate;
- the tiers and islands suites: those are compiler features the library does not have (§7);
- every `$`, `blocks-compiled` and `blocks-uncompiled` mode.
The ported set is 12 scenarios, 4 of them with SSR: blocks-counter, -effect, -props-child, -async-resolve, -async-reject, -async-event, -row-list, -row-recursive, -row-keyed-store; async-flights, -disposal, -event, -hydration.

### D-070 — Raise at every host: where a failure is typed, where it lands
**Recorded (Phase 4, item 2; for Dev's ruling).** `packages/blocks/test/raise.spec.tsx` raises a kinded failure in every host and checks where it goes. The hosts: a setup; a hole (a prop's, and a flow control's source); a `$memo` (before and after an async `attempt`); an `$effect`; a `$settled`; an `$event`; a row. `raise.type-tests.tsx` pins `FailsOf` at each position. The suite runs on development and production builds.

At run time every host behaves as D-033 says:
- The failure reaches the nearest `Errored` as the original instance.
- An `Errored` whose `catch` does not list it passes it to the one above.
- With no `Errored` it is re-thrown at the root.

**How it is re-thrown depends on the host** (pinned, Solid's behaviour):
- a setup throws the failure itself out of `render`;
- a computation (a hole, a memo, an effect, `$settled`, a row) re-throws Solid's own error, with the failure as its `cause`;
- a memo failing after an async step becomes an unhandled rejection of that error;
- an event's call rejects with the failure, so a DOM dispatch with no boundary leaves an unhandled rejection.

A root handler that wants the typed failure reads `error.cause ?? error`.

**Where the failure lands in the types:**

| Host | `FailsOf` | Lands in the component's view type? |
| --- | --- | --- |
| setup | refused: `Raise` is not a `SetupOp` (a setup never reads, so it has nothing to fail on) | — |
| hole (a prop's) | the child's view, through the prop's declared `Source<T, E>`; a raising hole is refused for a settled prop | yes |
| hole (a flow control's source) | the flow control's output | yes |
| `$memo` | `Source<T, E>` | yes, through the holes that read it |
| row | the flow control's output (D-059) | yes |
| `$event` | `EventHandler<Args, E, …>`; `yield* go()` in another event joins it | **no**: `onClick={go}` takes the handler as a value |
| `$effect` / `$settled` | **dropped**: both give `Yieldable<Create<…>, void>` | **no** |

- **F1 (open): an effect's failure is in no type.** A component whose `$effect` or `$settled` raises has the view type `View<false, never>`, yet it fails at run time, to the nearest `Errored` or re-thrown. §1 says "typed failures are complete for library-mediated failures", and this is one that is not. Options:
  - carry the body's `FailsOf` into the setup's yield union (`Create<"effect", E>`) and into the view's colors, the way a memo's failures reach the holes that read it;
  - refuse `Raise` in an effect (`EffectOp` without `Raise`), so an effect's fallible work goes through an event or a memo;
  - accept it and say so in §7.
- **F2 (open): a DOM-dispatched event's failure is in no view type.** A DOM dispatch ignores the returned promise, so the failure goes to the nearest `Errored` (documented on `$event`). The handler's type carries `E`; the view that binds it with `onClick` does not. Options:
  - join an event's `E` into the view when it is bound in a JSX event position, which needs the JSX namespace to read the handler's type;
  - require a handler bound to the DOM to have `E = never`, so failures are handled inside it (`attempt`, or an `$optimistic` rollback);
  - accept it and say so in §7.
- **F3 (fixed): a hole that always raises lost its failure.** `GeneratorOps<Y, R>` in `holes.ts` distributed over the hole's return type. A hole that always raises returns `never`, so the whole result was `never` and its own `Raise` was dropped. `Show({ when: function* () { return yield* raise(e); } })` typed as settled and never failing. `never` is now its own case. The type test is "a flow control's source hole" and the changeset is `blocks-raising-hole-type.md`.

### D-071 — Meta-rule: the types say exactly what the runtime does
**Decided (Dev, 2026-10-05).** Wherever the runtime routes a color — pending, a failure — the type carries it to the same place. A channel the runtime has and the type lacks is a bug, never a §7 limitation. D-034, D-044, D-047, D-059, D-063, D-072, D-073 and D-074 are instances. A future finding of the form "the runtime does X but the type says Y" is resolved by making the type say X. A finding where the type cannot say X is reported to Dev; it is not documented away.
*Consequence.* §7's "two library-mediated failures are in no view type (open, D-070)" is not a limitation: D-070 F2 is ruled by D-072 and F1 by D-073.

### D-072 — Binding an event in a view is a hole (D-070 F2)
**Decided (Dev, 2026-10-05).** `<button onClick={yield* save}>` yields a **Bind** op. It contributes the handler's failures (`FailsOf`) and its `P` (`ReadsPendingOf`: it may wait on a pending read) to the enclosing view's type, and evaluates to the handler unchanged. The runtime binds it as before: a failure nobody handles goes to the nearest `Errored` above the handler's creation site (D-019, D-033). *(Amended by D-085: the bind site's.)* `yield* save` (bind) is distinct from `yield* save(x)` (call): bind is the un-called `EventCall` handler.
- The transform's refusal in event positions, `BLOCKS_YIELD_IN_EVENT`, moves to the types. `perform(save)` in an `on*` attribute is allowed when the expression is a block event handler (a type-level check); a source or any non-handler there is a type error. `ref` stays refused.
- A plain `onClick={save}` (no `yield*`) is the lint error `no-unbound-event`; its autofix adds the `yield*`.
- Migrated under this decision: the 8 twins, the package tests, the conformance scenarios, getting-started and refusals.md (site counts below, with the implementation).

*Implemented (Phase 5, commit 3: the mechanism).*
- **Types.** `Bind<P, E>` is a new op, a `ViewOp` (not an `EventOp`, a `MemoOp`, a `HoleOp` or a hole prop's). `EventHandler` is iterable: `[Symbol.iterator](): Generator<Bind<P, E>, BoundEvent<Args>, any>`, where `BoundEvent<Args>` is the handler's call signature with a `[BOUND]` brand (`Bound<H>` brands a DOM handler type). `PendingOf` / `FailsOf` read `Bind` as they read any op, so a bound event's `P` makes the view pending and its failures join the view's. *(Superseded by D-075 as amended: a bound event's `P` no longer makes the view pending; it is the view's may-wait marker.)* `A` (async work of its own) does not: a view does not wait for a call. In `h`, `OpsOfHole` maps an `$event` handler given as an attribute to `Bind<P, E>`.
- **Runtime.** A handler is marked (`EVENT_MARK`) and iterable: `yield* save` returns it. `perform` returns a marked handler as it is (it called any other function). Nothing else changes: the DOM calls the handler, and a failure nobody handles goes to the `Errored` above the creation site.
- **Transform.** `BLOCKS_YIELD_IN_EVENT` is removed from the rule, its `REFUSALS`, its d.ts and the lint's `yield-in-jsx-hole`. The three refused cases of `rule.json` are accepted cases now (#7–#9), plus the bound-data array (#10). Their compiled outputs were generated by `generate.mjs`; the other 26 outputs were byte-identical. Solid's compiler evaluates `onClick={_$perform(save)}` once, as the element is created (`addEvent(el, "click", _$perform(save), true)`, or `$$click` / `$$clickData` for the array form), drops it on the server, and makes it a getter on a foreign component's props.
- **Lint.** `no-unbound-event`: an event prop (`onX`, `on:x`, `oncapture:x`) whose value, or whose array's first element, is an `$event` handler and not a `yield*`. With type information a handler is anything with the library's `[EVENT]` brand (so `onInput={pick("a")}` is reported); without it, a binding of `$event(…)`. The autofix inserts `yield* ` in a generator.
- **Staging.** In this commit the JSX namespace's event attributes still take an unbound handler and `recommended` leaves `no-unbound-event` out, so the gate stays green before the migration. The next commit makes both refusals and migrates every site.

*Implemented (Phase 5, commit 4: the refusal and the migration).*
- **The refusal.** `scripts/jsx-web-shared.mjs` rewrites the vendored namespace's `EventHandlerUnion` to `Bound<EHandler> | BoundEventHandler<…>`, whose element 0 is `Bound<…>` too. An event attribute takes only a bound handler; an unbound `$event` handler, a plain function and a value read from a source (a prop holding a handler or a function) are type errors ("Property '[BOUND]' is missing"). In `h`, a plain function in an event attribute is refused the same way (an `$event` handler is the bind there). `no-unbound-event` is in `recommended`, as an error.
- **`Errored`'s `reset`** is Solid's: it re-renders the children and cannot pend or fail. It is typed `Reset = BoundEvent<[]>`, already bound with no colors, so `onClick={reset}` stays as written (3 JSX sites, 1 `h` site).
- **`Errored`'s fallback (a D-071 gap found on the way).** Its colors were dropped from the output type although the runtime sends a fallback's pending reads and failures to the boundaries above. A lazy-view fallback's colors now join the output, and a row fallback `function* (error: Path<E>, reset: Reset)` is typed (the runtime already ran one). TypeScript does not infer a generator fallback's parameters (a limitation of overload inference, bisected: it holds even for `For`'s own row signature in a `declare function`), so they are annotated. The overloads are per form (row; lazy view or content or render function). A generic fallback parameter constrained by the recursive `Content` type made `h(Errored, …)` "excessively deep".
- **One twin type was wrong.** effect-blocks' `effectAction` typed its call `EventCall<R, unknown, boolean, true>`: `P` widened to `boolean`, though the saga driver reads no pending source. Binding `place`, which calls it, made the root pending. It is `false` now (2 lines in `solid-effect.ts`), which is what the runtime does.

*Site counts (D-072).*

| Where | Sites | How |
| --- | ---: | --- |
| JSX twins | 34 | 32 by the `no-unbound-event` autofix (with types): effect 9, hackernews-spa 1, rendering 11, room 3, sierpinski 2, todos 6. 2 by hand, each an `Errored` fallback that is now a row: rendering's `ErrorStream` (`onClick={yield* retry}`) and room's `Summary` (`() => regenerate(reset)` became `onClick={[yield* regenerate, reset]}`) |
| `h` twins | 0 | todos-blocks-h's 6 and sierpinski-blocks-h's 2 handler attributes are bound by `h` as written; their colors join the output since commit 3 |
| `Errored` resets | 0 | 4 (`onClick={reset}`, effect ×2, todos, todos-h): typed `Reset` |
| conformance scenarios | 6 | autofix: the 6 library sources that bind an event |
| package tests | 15 | autofix: runtime.spec 5, jsx.type-tests 3, render-thunk.spec 2, raise.spec 1, transform.spec 1, ssr.spec 1, and the getting-started program 2; plus raise.type-tests 2 in commit 3, and nojsx.type-tests' `h` plain function made an `$event` (1) |
| lint test inputs | 4 | rules.test.js strings of other rules, for consistency |
| docs | 3 | getting-started.md 1 (and prose), the solid-blocks README 1, refusals.md (rows rewritten) |

The transform's fixtures keep `onClick={h}` (accepted #4) and its twin snapshots their unbound events: they are its oracle (D-043), and the transform does not see types.

### D-073 — An effect's raise joins the component's failure type (D-070 F1)
**Decided (Dev, 2026-10-05).** `$effect` and `$settled` bodies may raise. Their `FailsOf` joins the enclosing component's failure type, unless the effect handles the failure itself (an attempt whose `onError` absorbs it). This is Solid's runtime semantics today: an effect's failure reaches the nearest `Errored` (D-070's matrix). Tests: a type test, and a runtime test that an effect's raise reaches the nearest `Errored`.

*Implemented (Phase 5, commit 2).*
- `Create<K, E = never>` carries a failure. `$effect` and `$settled` give `Create<"effect" | "settled", FailsOf<body>>`; `$component` adds `FailsOf` of its setup's yields to its view's failures, and a row's setup's failures join the flow control's output (`RowOps<VY, R, Y>`; `RowFails<VY, R, Y>`). A memo's `Create` carries none: its failures are its source's.
- **"An attempt whose `onError` absorbs it" did not exist:** every handler's result was thrown. It is now: a handler returning a value that is not an `Error` absorbs the failure, and the attempt gives that value (types: a second overload of `attempt`, no `Raise`; runtime: `handled()` in the attempt and in `mapStream`). A stream's absorbed failure ends the stream, so the absorbed value is not in the attempt's type there. A handler that may return either is `[ATTEMPT_ABSORBS]`. *(Replaced by D-076: an absorbing handler returns nothing, and the attempt gives `undefined`.)*
- Not visible to the types: a `try` / `catch` around a `yield*` in a block body (effect-blocks' `place`, room's `drop` and `submit` events) handles a failure at run time while the body's type keeps it. The type over-states there; it never under-states. Recorded, not changed. *(Ruled by D-077: `try` / `catch` is not a block form.)*
- Tests: raise.type-tests "effect: its raise joins the component's failures (D-073)" (an effect and a `$settled`, an absorbing attempt, a failing attempt, a sync event called from an effect, a row's effect, `[ATTEMPT_ABSORBS]`); raise.spec "D-073: an effect's failure is its component's" (the `Errored` above the component; an absorbing attempt in an effect, in an event after an await, and over a stream).

### D-074 — The library route and the compiler route are not mixed (D-069 F6)
**Decided (Dev, 2026-10-05).** The two routes render identical markup with different hydration-key numbering, so a server and its client must be built with the same route. Documented in §7 and the README. No code change. The conformance harness pins the difference as a property of the routes, not a bug: `routes.spec.ts` asserts both key lists, and `hydrate-self-test.spec.ts` asserts that the library client misses every key of the compiler route's markup.

### D-075 — A bound handler that may wait is a may-wait marker on the view (types only)
**Decided (Dev, 2026-10-05; amended the same day).** *Ruling as amended: types only.* A bound handler's `P` (its call may wait on a pending read) does **not** make the view pending: the runtime never suspends a view for a waiting call, so a pending view type would over-state the runtime (D-071 holds in both directions). It is carried instead as a separate **may-wait marker** on the view, folded like `PendingOf` but never joining `ViewPending`, and surfaced by the lint **warning** `no-unshown-wait`: "this view binds a handler that may wait on pending data; show its in-flight state". No runtime support, no automatic `Loading`. Type test: binding a may-wait handler does not make the view pending, and the marker is present.

*The first ruling (superseded).* An event exposed its in-flight state as a typed source, `save.pending: Source<boolean, never, false>`, `true` while any call was paused on a pending read or awaiting an async attempt. **It was built and reverted:** Phase 5 commit 5 (`8b6ab6b`: the source in the runtime, its runtime and type tests, getting-started §6) was undone by `git revert`. The stop-report that led to the amendment: D-072's bound `P` made the view pending although the runtime never suspends a view for a call.

*Implemented (Phase 5 amendments, commit 2).*
- **Types.** A phantom `[MAY_WAIT]`. `Bind<W, E>` carries the handler's `P` there instead of in `[PENDING]`, so `PendingOf` does not see it. `MayWaitOf<Y>` folds it like `PendingOf` (a `Bind`, or a child view that may wait). Views carry it as a third parameter, `View<P, E, W>` (`ComponentView`, `Component`, `HView`, `ChildView`), defaulting to `boolean`: it is not a color, so every annotation without it accepts either, and a may-wait settled view is an element. `$component` gives `ViewMayWait<VY, R>`; flow controls and boundaries (`Loading` and `Errored` included: neither handles it), `h` and `lazy` pass it on. The element type's view members omit the key, so a view returning an element does not read the element type itself as a child that may wait. `EventHandler` has `[MAY_WAIT]?: P` for the lint.
- **Lint.** `no-unshown-wait` (a warning in `recommended`; type information only, silent without it): an event attribute bound with `yield*` (or the first element of the bound-data array), or an `h` `on…` attribute, whose handler's `[MAY_WAIT]` may be `true`.
- **Where it fires.** 7 bind sites in the twins, all left as warnings: todos-blocks `retry`, `toggle`, `clear`; todos-blocks-h the same three; room-blocks `submit`. The originals show no in-flight state there, and the twins keep parity. No twin's `Loading` became unnecessary for the type: those views were pending through their own reads too.
- **Tests.** raise.type-tests "an event that may wait … does not make the view binding it pending" (the view is settled and an element; the marker through `Show`'s content and a child view; `h`); rules.test.js `no-unshown-wait` (with types: `true`, `boolean`, the bound-data form, `h`; without: silent).

### D-076 — An attempt's handler returns the failure, or nothing
**Decided (Dev, 2026-10-05); amended by D-078** (a handler may be a generator, and a returned value absorbs with that value: "a non-`Error` value is a type error" is withdrawn; "return nothing to absorb" holds). Replaces D-073's two-overload `Absorbs<V>` scheme. `onError` returns either an `Error` with a literal `kind` — the failure, possibly transformed from `unknown` or from a call's known failure — which the block fails with, or nothing (`void`): the failure is absorbed, the attempt yields `undefined`, and its result type is `T | undefined`. Returning a non-`Error` value is a type error. A handler typed `E | void` stays refused as `[ATTEMPT_ABSORBS]`, reworded: "a handler returns the failure (an Error with a literal kind) or nothing (absorbs it), not sometimes one and sometimes the other". Absorbing a stream's failure still ends the stream. Absorbing handlers that returned a value migrate (`??` for a fallback). Docs: §1 and refusals.md.

*Implemented (Phase 5 amendments, commit 3).*
- **Types.** One signature, `attempt<T, H extends Error | void>(fn: () => T, onError: (error: unknown) => H & HandlerCheck<H>)`. `H` an `Error`: `KindCheck<H>`, a `Raise<H>`, the value `Attempted<T>`. `H` `void` (or `undefined`): no `Raise`, the value `Attempted<T> | undefined`. Both: the `[ATTEMPT_ABSORBS]` brand. Anything else fails the constraint `Error | void`, and TypeScript prints the brand with `void | Error`. The absorbed value is `undefined` for a stream too: a stream's own failure ends it, but `fn` throwing (or its promise rejecting) before there is a stream gives `undefined`, which D-073's type had missed.
- **Runtime.** `handled()` returns `undefined` for any non-`Error` (a handler cast past its type that returns a value absorbs, and the attempt still gives `undefined`, as its type says).
- **Migration.** No twin, conformance scenario or doc example absorbed with a value. The package tests did: raise.spec's three D-073 tests (an effect, an event after an await, a stream) and raise.type-tests' `EffectAbsorbs` (2 handlers). `until` passes its typed handler through a cast.
- **Tests.** raise.type-tests: `T | undefined`, `??`, `[ATTEMPT_ABSORBS]` in an expression and across statements, a value and `null` refused, `[FAILURE_KIND]`, the two result types exactly. raise.spec: the absorbed value is `undefined` (sync, async, a cast handler), a stream's absorbed failure ends it.

### D-077 — `try` / `catch` is not a block form
**Decided (Dev, 2026-10-05).** Lint `no-try-catch` (an error, in `recommended`): a `try` / `catch` inside a block body (setup, view, hole, memo, effect, event, row) is an error; the message points to `attempt` (absorb or transform) or `Errored`. `attempt` accepts an event call: `fn` may return an `EventCall` (`yield* attempt(() => post(msg), e => { … })`), and the call's typed failure goes through `onError` (transform or absorb) exactly like a promise's. Type test: a call's `FailsOf` is removed by an absorbing handler and transformed by a returning one. Migrate the three catching events (effect's `place`, room's `drop` and `submit`) and any other `try` / `catch` the lint finds in twins, tests, scenarios and docs, and report the count. Their types must no longer carry the caught failure: that was the finding, the type over-stated the runtime.
*Amended by D-087:* typed failures are branded at run time in every build, and an attempt over a call hands its handler only those; anything else is re-thrown past it, so `Caught<T>` is exact.

*Implemented (Phase 5 amendments, commit 4).*
- **`attempt` over a call.** Runtime: an event call is marked (`EVENT_CALL_MARK`); an `Attempt` whose `fn` returns one delegates to the call's own iterator, as `yield* call` does (at once when its body already finished, so an `$effect` may attempt a synchronous call; else waiting), inside a `catch` that hands its failure to `handled(onError(e))`. Types (the one signature of D-076): `Caught<T>` types the handler's parameter as the call's `FailsOf` (its known failure; `unknown` for anything else); `AttemptWait<T>` is the call's `EventCallOp<P, A, never>` (its colors, without its failures), so where it may run is where `yield* call` may (an `$effect` takes a synchronous call only); `Attempted<T>` is the call's result `R` (`R | undefined` absorbed).
- **`until`** is an async attempt, so its handler follows D-076 too: it returns the failure or nothing (`until` then gives `undefined`). Not in the ruling's words; needed to migrate room's post without moving its wait into another action.
- **Lint.** `no-try-catch` reports a `TryStatement` with a `catch` whose enclosing function is a block (every kind the rules recognise: setup, view, row, `$memo`, `$effect`, `$event`, `$settled`; and a bare `function*` hole given to `h`). A `try` / `finally` catches nothing and is not reported; a `try` in a plain function inside a block (an `attempt`'s `fn`) is plain code.
- **The count: 16 `try` / `catch` in block bodies, all migrated.** effect-blocks 1 (`place`: an absorbing attempt over the saga's call, whose `E` was `unknown`); room-blocks 2 (`drop`: two absorbing attempts recording a `ChaosError` for the text; `post`, which `submit` calls: an absorbing attempt and an absorbing `until` recording a `SendError` / `DeliveryError` for the message; Composer's `post` prop is now `EventHandler<[text], never, …>`); todos-blocks 5 and todos-blocks-h 5 (the shared data layer's five actions: `if (yield* attempt(() => settled(api.x(…)), absorb))`, `settled` mapping success to `true`; `retryTodo`'s cast now says `never`); package tests 3 (runtime.spec: a memo's dev-error check, the `$event` rejection test — now asserting the call rejects and the body stops at the `yield*` —, and an event's call of a failing event, now an attempt over the call). Conformance scenarios and docs: none. The transform's twin fixtures (`packages/vite-plugin-blocks/test/fixtures/twins`, its oracle, D-043) keep their 3 as snapshots, as D-072 kept their unbound events.
- **The types after.** effect-blocks' `Checkout` is `ComponentView<false, never, false>`; room's `Chaos` `<false, never, false>`, `Composer` `<false, never, true>`, `Chat` `<false, LiveError, true>` (no `SendError` / `DeliveryError`); todos' actions fail with nothing.
- **Tests.** raise.type-tests "D-077: attempt over an event call" (the handler gets the call's failures; absorbed: `FailsOf` `never`, `R | undefined`, `P` / `A` kept; transformed; returned narrowed; an event's and an effect's types; an effect refuses a call that waits; `[ATTEMPT_ABSORBS]`); raise.spec "D-077: an attempt over an event call" (absorbed and transformed in an `$effect`, with the `Errored` above; async in an `$event`, value or `undefined`; transformed fails the caller); rules.test.js `no-try-catch`.

### D-078 — An attempt's handler may be a generator (amends D-076)
**Decided (Dev, 2026-10-05).** `attempt(fn, handler)` with `handler: (error) => Error | void | Generator<HostOps, Error | V>`.
1. One handler, decided by its result: if it returns a generator, it runs as block code; otherwise its return is interpreted directly. A plain `e => new SendError(e)` is the degenerate form.
2. The generator's ops are the **host's** (an event: reads, writes, async, a nested attempt; a memo: reads, `raise`, a nested attempt; an effect: synchronous only), and its colors (`P`, `E`, `A`) join the host's. It is not a new host and has no boundary semantics. `yield* raise(e)` inside it fails the attempt with `e`. Type: `AttemptOps` folds the handler generator's yields.
3. The return decides the outcome: an `Error` with a literal `kind` (`KindCheck`) → the attempt **fails** with it (a transform; the only way a failure leaves the handler); nothing → **absorbed**, the attempt yields `undefined` (`T | undefined`); a value `V` (a nested attempt's result) → **absorbed**, the attempt yields it (`T | V`). A handler typed to return an `Error` sometimes and sometimes not → `[ATTEMPT_ABSORBS]`, reworded. D-076's "a non-`Error` value is a type error" is withdrawn; "return nothing to absorb" holds.
4. When it runs: synchronously for a synchronous throw; on rejection for a promise, inside the event's transaction (as an attempt already re-enters it) or as the memo's resumption; per failure for a stream — an `Error` fails the stream, anything else ends it. It runs under the same `runAs` host as the attempt (receipt tracking, `UNTYPED_THROW`, `READ_IN_VIEW` apply).
*Amended by D-091:* a stream attempt's handler is a plain function (an `Error` fails the stream, nothing ends it); a generator there is a type error and `STREAM_HANDLER` at run time; an `$event` does not attempt a stream.
Tests: type tests for each return shape and for host-op admission (a write in a memo's handler is a type error); runtime tests: transform, absorb with nothing, absorb with a value, a nested attempt (retry / fallback), `raise` inside the handler, a handler's write inside an event's transaction, a stream's end vs failure. Docs: §1, refusals.md, getting-started (the retry example). Migrate nothing unless a twin benefits. `until`'s handler follows the same rule (Dev, on the Phase 5 report).

*Implemented (Phase 5 amendments, commit 6).* Not a revert of D-076: its commit stands, amended by this one.
- **Runtime.** `handle(onError, e)`, a generator the `Attempt` delegates to (`yield*`) wherever it caught a failure — a synchronous throw, an event call's failure (D-077), a rejection: the handler's result, when it is a generator object, is delegated to as part of the attempt, so its ops reach the host's driver (an event's `eventSteps`, inside the transaction; a memo's resumption; an effect's synchronous `drive`, which refuses a wait). Its return: an `Error` is thrown (`known`), anything else is the attempt's value. A stream's failures happen outside the attempt's run: the handler runs under `runAs` with the attempt's host and name (as a resumption), a generator `drive`n synchronously; an `Error` fails the stream, anything else ends it.
- **Types.** `attempt<T, H>(fn, onError: (error: Caught<T>) => H & HandlerCheck<H>)`, no constraint on `H`. `HandlerReturn<H>` (a generator's return, else `H`), `HandlerYields<H>`; `AttemptOps` = the wait, the handler's yields, and `Raise<R>` when `R` is an `Error`; `AttemptResult` = `Attempted<T>`, or with `undefined` / `V` when absorbed. `until` gives `AttemptOps<Promise<T>, H>` / `AttemptResult<Promise<T>, H>`.
- **Twins.** None migrated. room's `post` and `drop` (D-077) record a failure for the UI through a closure; a generator handler could write it directly (`function* (cause) { yield* setError(new SendError(cause).message); }`), which reads better but is not a behaviour change; left as is (report).
- **Docs.** §1's `attempt` bullet, refusals.md (`[ATTEMPT_ABSORBS]`, a host op the handler's host does not take), getting-started §3 (the retry; its program and spec too).

### D-079 — `$effect` is split: `$effect(compute, effect)`
**Decided (Dev, 2026-10-05).** `$effect(compute, effect)`, both generators, its runtime semantics mirrored at the type level; supersedes D-053's one-pass form (`$settled` stays as is: `onSettled`, not a tracked effect). The one-function form existed so a compiler could split it statically; that cannot happen at run time, so the split is written by hand now. A compiler-only ergonomic wrapper (e.g. `$hoistedEffect`) may reintroduce the merged form later. No `createTrackedEffect` (legacy): Solid's `createEffect(compute, effect)`.
- **compute**, `function* ()`: tracked reads (`Read` ops), `raise` (D-073), a sync `attempt`; pure — a `Write` or a `$cleanup` here is a type error; returns a value `V`.
- **effect**, `function* (value: V, prev: V | undefined)`: runs after the compute, untracked: `Write`, `$cleanup`, a sync `attempt`, a sync event call, `$untrack`. A plain `yield* <source>` here is a type error ("read it in compute and pass the value, or `$untrack` it"), mirroring Solid's untracked effect phase.
- D-073's raise-joins-component applies to the compute; an effect-phase raise is a component failure too (the same runtime path): both are typed.
- Migrate every `$effect` in the package tests, the 8 twins, the scenarios and the docs (report the counts). Re-record the blocks-effect golden: D-069 F1 should disappear; a remaining difference is a new finding.

*Implemented (Phase 5 amendments, commit 7).*
- **Runtime.** `createEffect(compute, { effect, error }, options)`. The compute runs as a new host, `COMPUTE` ("an effect's compute": `WRITE_IN_REACTIVE` for a write, `CLEANUP_OUTSIDE_OWNER` for a `$cleanup`, `ASYNC_NOT_ALLOWED` for a wait). The effect phase runs as `EFFECT` with a cleanup sink (returned to Solid: it runs before the next effect run, or on disposal); a plain read there is the new development error `READ_IN_EFFECT`, an `$untrack` is not. `$settled` has its own host, `SETTLED`, with `$effect`'s old rules (reads allowed). **Solid logs and skips a compute failure** unless the effect has an `error` arm, so the arm rethrows it: it then reaches the nearest `Errored`, as an effect-phase failure does (D-073 holds). With no `Errored`, either is thrown out of `render` / `flush` as itself and Solid reports `REACTIVITY_HALTED` (the one-pass effect's was re-thrown wrapped, its `cause` the failure): raise.spec's host table records `thrown` for both phases.
- **Types.** `$effect<YC extends ComputeOp, V, YE extends EffectPhaseOp>(compute, effect: (value: V, prev: V | undefined) => …)` gives `Create<"effect", FailsOf<YC> | FailsOf<YE>>`. `ComputeOp` = `Read | UntrackedRead | Raise`; `EffectPhaseOp` = `UntrackedRead<false> | Write | Cleanup | Raise | EventCallOp<false, false>`. **`$untrack` is its own op now**, `UntrackedRead<P, E>` (it was a `Read`), so the effect phase can take it and refuse a tracked read; every union that admitted `Read` admits it. In the effect phase it must be settled: an untracked read of a pending source there throws (Solid's `NotReadyError`; the effect does not wait), checked at run time. `EffectOp` stays `$settled`'s. A refusal now lands on the offending half, not on the `$effect(` call.
- **Lint.** The effect phase (`$effect`'s second argument) is a block for every rule (`no-try-catch`, `no-throw`, `jsx-only-in-view`, …); `no-foreign-reactive` points `createEffect` / `createTrackedEffect` at `$effect(compute, effect)`.
- **Migration: 31 `$effect` sites.** Package tests 28 (runtime.spec 7, raise.spec 7 — its host table's effect case now one case per phase —, raise.type-tests 8, jsx.type-tests 5, nojsx.spec 1), lint test strings 2 (plus one new case for the effect phase), conformance 1 (blocks-effect, written as the reference's split form). **The twins: 0** (none uses `$effect`: their effects are `$settled`, 3 files). Docs: no `$effect` example; prose in §1 / §3 / §7, refusals.md and getting-started updated. The transform's compiled fixtures mention `$effect` only in their frozen twin snapshots (D-043), unchanged.
- **Conformance.** blocks-effect's client/library trace now equals the oracle's: **F1 is gone**, its declaration removed, COVERAGE.md regenerated. No new finding.
- **Tests.** raise.type-tests "D-079" (the compute's value and `prev` typed; a write, a `$cleanup` or an event call in the compute refused; a plain read in the effect phase refused; both halves' failures; the `Create` type); runtime "an $effect's compute does not write; its effect phase does not read (D-079)"; raise.spec both phases.

*Amended by D-083.* The effect phase admits a plain read of a settled source, untracked because the phase is; `READ_IN_EFFECT`, `UntrackedRead` and `$untrack` are gone. The bullets above describe the first implementation.

### D-080 — A superseded `$memo` run is not closed (D-069 F3)
**Decided (Dev, 2026-10-05).** A superseded `$memo` run is NOT closed: it continues after its pending attempt and its result is discarded, exactly like Solid's async memo and like the compiler route will behave. Remove the `gen.return()` on supersession in the memo path (events already run independently, D-064). The discarded run's reads must not subscribe the memo and its result must not land. Runtime test: the old "superseded run is closed" test inverts (the continuation runs, its result is discarded). Re-record the async-flights golden: D-069 F3 disappears. §3: "a superseded run runs to completion; its result is discarded; put no side effects after an await".

*Implemented (Phase 5 amendments, commit 8).*
- **Runtime.** `resume` no longer takes a "still current" check: every run is stepped to its end and settles its own promise. `memoCompute` drops its run counter. Solid keeps only the latest run's promise, so a stale value or failure is discarded there; the stale run's reads after its attempt are untracked (and in development `READ_AFTER_ATTEMPT`), so it subscribes nothing.
- **Tests.** runtime "a memo that waits is pending; a superseded run runs to completion and its result is discarded (D-080)" (the current run lands, then the superseded one continues — `after` counts 2 — without landing; a later write re-runs only from the current run's reads) and "a superseded run that fails after its attempt is discarded too" (a stale `raise` reaches no `Errored`).
- **Conformance.** async-flights' client/library trace equals the oracle's: **F3 is gone**, its declaration removed, COVERAGE.md regenerated. No new finding.
- **Docs.** §3's paragraph; §1's latest-wins line; effect-blocks' typeahead comment (why it returns a stream, not an `attempt`).

### D-081 — An `$event` call is one transaction (D-069 F4 is the model)
**Decided (Dev, 2026-10-05).** D-069 F4 is not a divergence to remove: it is the model, D-020's. An `$event` call is one transaction. A write it makes before it waits (an async `attempt`, `until`, a pending read) is held until the call settles, so nothing it wrote shows during the wait; handwritten Solid that writes a plain signal outside an action shows it at once. To show something during the wait, write an `$optimistic` (or `$optimisticStore`): it shows at once and reverts when the call settles. No code change.

*Documented (Phase 5).*
- **§3**, with the example: `yield* setSaving(true)` on a `$signal` before an attempt is held (the view keeps `false` until the call settles, and then shows the last write); on an `$optimistic` it shows at once and reverts when the call settles.
- **Tests already pinning it.** runtime "$event is an action: its writes are one transaction across an async attempt" (held) and "$optimistic / $optimisticStore: an $event's writes show at once and revert when it settles"; conformance async-event, declared F4 (the DOM keeps `idle` while the call waits).

### D-082 — Deeper hydration keys are a documented cost (D-069 F5)
**Decided (Dev, 2026-10-05).** D-069 F5 stays as it is and is documented as a cost of the library route in §8: the key length per level, and the bytes it adds to one twin's SSR output, measured. Hydration improvements come with the compiler later. No code change.

*Documented (Phase 5).*
- **Per level** (conformance, F5): a level of nested rows adds 5 characters to the library's keys and 3 to handwritten Solid's, so 2 more per level: blocks-row-recursive's rows at depths 0 / 1 / 2 are `1000` / `100222000` / `10022200222000` (4 / 9 / 14) against `100` / `104200` / `104204200` (3 / 6 / 9). A flat list's rows and a `Loading` called in a hole have one more character.
- **Measured** with `examples/harness/ssr-keys/measure.mjs` (new; manual, outside the gate, D-017): rendering-blocks against its original through Vite's SSR loader, development builds, rc.13, each render in its own process. `renderToString`: 801 bytes for both on each of the 4 URLs (every route is the `Loading` fallback; 2 equal keys). `renderToStream`: `/` 1,735 → 1,742 bytes (+7, 0.4%; 13 keys, mean length 4.23 → 5.23, longest 6 → 8); `/settings` 1,887 → 1,894 (+7, 0.4%; 11 keys, 3.91 → 4.73, 6 → 8). Almost every key gains one digit, the route's hole; the page's nested content two.
- **Found while measuring, not fixed (for Dev; outside this ruling).** The twin's streamed `/profile` never ends: the render blocks the process (it logs `LOAD USER` twice and `LOAD INFO`, then no timer fires; killed after 30 s), where the original's ends. The twin's streamed `/stream` fails with a server `READ_IN_VIEW` in `MemoList` (its `For` over a streamed memo, under a `Loading` called in a hole). Both are development builds under `vite dev`'s SSR loader; the gate renders neither page through `renderToStream`. Not measured.
- **`/stream`: a detector false positive, fixed (library).** `MemoList` reads nothing in its view body: it passes `props.items` to `For` unread, so neither the twin nor the lint was wrong. Solid's server `For` reads `each` in a memo as it is created (inside F7's `flowControl` window); while the memo is pending that first read throws `NotReadyError`, which the server memo swallows, and the memo reads again when `ssr()` resolves the view's hole — still inside `MemoList`'s view run, with no observer, so `checkRead` took it for the view's own read. F7's fix covered only the creation; every flow-control prop getter now runs as the flow control's read (`propRead` in flow.ts). Test: ssr "a flow control re-reading a pending prop when its hole resolves is not the named view". The streamed `/stream` then renders the original's markup (both lists at their first item).
- **`/profile`: a library bug, fixed; with a latent Solid bug under it.** The original sets the page up once (`LOAD USER`, `LOAD INFO`, done in 0.85 s); the twin set `ProfilePage` up twice (`LOAD USER` twice) and never ended. Not a missing `Loading` and not an event bound at render: the twin's shape is the original's. (1) *Library.* The call form puts a component call inside a hole (`{yield* Switch(…)}` compiles to `() => escape(perform(Switch(…)))`, where the original's `<Switch>` is created at template time). Solid's server hole calls a function it returns inside the hole (`while (typeof v === "function") v = v()`), so when the page's lazy `Profile` (a memo function, pending until its chunk loads) threw, the Routes view's `Switch` hole became the retry unit, and the root's retry re-created the `Switch`, the `Match` and `ProfilePage`. Fixed in `perform`: on the server a view that is a function goes back as a one-element array, so Solid resolves and retries it as its own node. (2) *Solid rc.13, not patched (D-004).* The second `user` memo shares the first's serialization slot (same owner id); created while the slot was pending, it runs its compute again and waits on its own promise, but its `NotReadyError` names the slot's deferred, which the first `user` resolves. The second `info` then retries on that already-resolved promise (`subscribePendingRetry`), in a microtask loop that starves the timer the second `user` waits on. Handwritten Solid in the same shape (a lazy component whose memo pends inside a re-created subtree) enters the same loop; in the scratch reproduction it escaped after ~15,000 turns only because the render was disposed. Worth reporting upstream. Test: ssr "a pending view returned into a hole is retried as itself …" (one setup; on the old runtime 2 setups and the spin guard trips). After the fix the twin's `/profile` logs as the original does and renders its markup; settled output is byte-identical (the conformance server artifacts, `/` and `/settings` unchanged).
- **Measured after both fixes** (`measure.mjs`, `renderToStream`): `/profile` 2,491 → 2,553 bytes (+62, 2.5%; 16 keys, mean length 5.69 → 9.19, longest 11 → 22); `/stream` 6,528 → 6,563 (+35, 0.5%; 17 keys, 5.59 → 7.41, 11 → 16). `/` and `/settings` as above. The twins' hydration of `/profile` is not checked by anything here (no gate step or test hydrates a twin's server output; the browser check was not carried).

## Phase 1A findings (agent report, items 4c–8; verbatim, 2026-10-04)

Rulings on these are D-058+ once taken; the D-013 and D-032 findings from items 4/4b are already decided as D-050 / D-051 and omitted here.

- **D-042 cannot be implemented as written for server-component props (1A item 4c, stopped before any change).** Survey: 33 `$snapshot` sites in 16 files (chat 4/2 files, effect 1/1, hackernews 1/1, notes 10/5, rendering 3/3, room 2/2, sierpinski 6/1, sierpinski-h 6/1). Most have a compliant form: a seed (`$signal(yield* $snapshot(props.initialTitle))`, `props.id`, the router's `props.url`) becomes `$signal<T | undefined>(undefined)` plus a `$memo` reading `(yield* local) ?? (yield* props.x)`; a row index or config read moves into holes (`{yield* props.rows[yield* i].id}`); sierpinski's setup-time `if (s <= TARGET)` becomes `<Show when={function* () { … }}>` with derived child props; a client callback goes into an `$event` (`(yield* props.log.clear)()`); `props.wire` is read in its `$dynamic` body. Two kinds have none: (1) **a prop value that must reach an event or `ref` position as itself** — notes `AppView` (`onSearch`, `onSubmit` in event props, `searchInput`, `spinner` in `ref`s) and chat `Markdown` (`copy` in `onClick`): these are server components whose props are frame stubs, and the stub's identity is what the hydration claim marker names ("the value read is the frame's props stub, so the claim markers still name the client props"). A setup may not read it (D-042), the transform refuses `yield*` in event and `ref` positions (`BLOCKS_YIELD_IN_EVENT`, `BLOCKS_YIELD_IN_REF`), and wrapping it in an `$event` replaces the stub, which breaks the claim. The only compliant spelling found reads the props in one hole and builds the markup in a closure (`{((onSubmit, …) => <form onSubmit={onSubmit}>…</form>)(yield* props.onSubmit, …)}`), which moves static server markup into a dynamic hole — improvisation, not done. (2) **Slot components rendered as tags in server components** (notes `Editor`, `Item`, `AppShell`; chat `StatusFill`; room `Composer`; hackernews `toggle`, also called as a plain function in `.map`): D-042 says "read in a `$dynamic` body", which wraps each slot in `dynamic()`'s memo — the hydration-key shift §9 lists among the experiment branch's pitfalls; untested. Options for Dev: allow `yield* $untrack(x)` (only) in event / `ref` positions (a transform + lint change, D-031/D-043); keep a setup-only `$snapshot` restricted to props whose type is a function or a component (a second prop kind, the rejected `Once<T>`); or accept the hole-closure spelling for server components. `$untrack` is not added until this is settled (adding it beside `$snapshot` would be two ways, D-005).
- **D-044 forces boundaries the originals do not have (1A item 4d; D-044 not implemented, D-047 done).** With `$dynamic` colored (implemented and reverted; the type is `DynamicComponent<Props, BodyPending | inner, FailsOf<Y> | inner>`), 10 twin tag sites become type errors (chat 2, hackernews 4, notes 3, room 1). Six migrate cleanly to `{yield* View(props)}` / `{yield* Loading({ …, children: () => View(props) })}` (the five route views — the router's `defineRoute` absorbs a route's colors, §7 — and room's `Room`, which only pends). Three cannot be written without a boundary or a cast, because their `ServerError` reaches a position that only takes settled elements: chat's `Reply` is in a `<For>` row (`[UNSETTLED_ROW]`: a row's view must be settled), and hackernews' `Nav` and notes' `NoteList` (through `Shell`) sit under the router's plain `children` callback, built in the setup (also a D-041 site), where nothing can be `yield*`-ed and a failing view is not an element. chat's `Welcome` propagates to `App`, which is fine only because the generated entry does not type-check the root. The originals have no `Errored` there: a server-component failure is re-thrown (D-033). So D-044 + the settled-element / settled-row rules mean the library *does* require a boundary wherever a typed failure meets plain JSX or a row — contradicting D-033's "does not require one" — and the twins would have to gain `Errored`s the originals lack (behaviour on failure changes) or casts (forbidden). Options for Dev: accept the new boundaries in the twins (a deliberate parity deviation on the failure path, recorded per twin); give the types a way to say "unhandled by design, re-thrown" (e.g. an `Errored`-less `Rethrow` marker or `render`/rows admitting failures); or keep `$dynamic` uncolored and record it in §7.
- **D-047: the module-URL pass does not see the library's `lazy`.** `@solidjs/vite-plugin`'s pass (`compiler/src/lazy.rs`) annotates only calls of `lazy` imported by its canonical name from `"solid-js"`, so `lazy` from `@solidjs/blocks` gets no third argument. The signature keeps `moduleUrl` (a caller or a later plugin can pass it). Solid's server `lazy` falls back to the module's bundler-injected `$$moduleUrl` export when there is none; if that export is missing the cost is a `lazyAssetUnmapped` dev finding and no chunk preloads, not a broken render. The rendering twin's 9 tests pass; its browser check (not in the gate) is unverified. Fix belongs in Phase 2's plugin (annotate `@solidjs/blocks`' `lazy` too) — not in the compiler (D-043).

- **D-052 is underspecified: a plain default cannot be told apart from a plain context (1A follow-up item 5, stopped before any change).** "`createContext` accepts a plain default value and wraps it as a `Source<T, false, never>`; `yield* Ctx` reads the provided source or the constant" fits a context whose provided values are sources (room's `IdentityContext`, provided `value={me}`). But the library's other contexts hold plain values: todos' `TodosContext` (×2: the store paths and action events, destructured in consumers' setups), effect's `RuntimeContext` (`createContext<ManagedRuntime | null>(null)`, provided a plain runtime and read by the verbatim Effect layer through Solid's own `useContext`, which relies on the `null` default), the tests' `Theme` contexts. At run time `createContext<Identity | null>(null)` and `createContext<ManagedRuntime | null>(null)` are the same call, so the library cannot know which default to wrap. Implementing it literally means every library context's `yield* Ctx` yields a source (plain provided values wrapped as constants too): consistent with D-042 ("everything a block is given is reactive"), but todos' consumers then read their store and actions in holes / events instead of destructuring in the setup, and the Effect layer's `useContext` would see a source where it expects `null`. Options for Dev: (a) every context is a source context (the ripple above; the Effect layer switches to `yield* Ctx`); (b) a source context is declared by its type — `createContext<Source<Identity | null>>(null)` — with a runtime marker the types require (e.g. an options flag `{ source: true }`, or a separate `sourceContext(default)`, the rejected "new export" in another name); (c) keep the interim workaround (default `undefined` + a `$memo` in the asking setup). The workaround in room and rendering is kept.

- **D-041 and the migrating-element twin (1A follow-up item 8).** The original (`examples/migrating-element`) demonstrates an element hoisted to a variable (`const hoistedCanvas = <Canvas />`) and rendered from several `<Show>` slots: one DOM node migrates between them, keeping the canvas's painted state and splats. D-041 ("elements are not values in a block") forbids exactly that; moving it into the view body would pass the lint as written but is the same thing (and a local computation in a view, D-032). Kept as the original's with `// eslint-disable-next-line @solidjs/blocks/jsx-only-in-view` and a comment; the runtime check does not fire (no hole in `<Canvas />`). Options for Dev: an allowed form for a hoisted element (a `$memo`/creator returning a view, D-041's rejected alternative), drop the hoisted half of the twin, or keep the disable as the recorded exception.

- **D-062: the call form needs three rules the decision does not give (1A follow-up item 4; D-063 landed, the rest stopped before the migration).** Survey of the eight twins (an ESLint pass over every JSX tag whose name is a component): **116 tags** — effect 19, hackernews-spa 18, rendering 43, room 24, sierpinski 4, todos 8 (the `-h` twins already call); by kind, 65 flow controls / boundaries (`Show` 24, `For` 16, `Match` 9, `Errored` 9, `Loading` 4, `Switch` 2, `Repeat` 1), about 40 block components, 11 Solid components (`Router` ×2, Solid's `Reveal` ×3, `Portal`, `HydrationScript` ×2, the context providers `RouterContext`, `IdentityContext`, `TodosContext`; effect's `RuntimeContext` too). **Type-level rejection is feasible**: `type ElementType = keyof IntrinsicElements` in the blocks JSX namespace (TS ≥ 5.1; here 6.0) makes every component tag "cannot be used as a JSX component" while DOM elements and fragments still check — it must go into `scripts/jsx-web-shared.mjs` (jsx.d.ts is generated); with it the package's own tests have 106 tag errors. What stops the migration is that a tag is not a plain object literal: the compiler turns its dynamic attributes and its children into *getters*, evaluated lazily inside the callee. (1) **Reads in props.** `<Show when={(yield* n) > 0}>` reads in `Show`'s own computation; `{yield* Show({ when: (yield* n) > 0, … })}` reads in the parent's hole, so every change re-creates `Show` and its subtree (state lost). A pure read `a={yield* src}` maps to `a: src` (forward the source — consistent with D-042); a derived read maps to a `function*` hole for flow controls (D-038), but a block component's prop has no hole form (`PropsInput<P>` is a value or a source) — options: extend D-038 to every component prop (`PropsInput<P>[N] | SettledHole<P[N]>`, read by `yield* props.x` as a hole), or a `$memo` in the caller's setup per derived prop. (2) **Lazy children.** `{yield* IdentityProvider({ children: <Router>…</Router> })}` builds the router — and its route components' `useIdentity()` — *before* the provider sets its context (room breaks); `Show({ when, children: <b>{yield* x}</b> })` builds the branch while hidden and outside it; and element children with holes cannot be written as a plain thunk (`() => <b>{yield* x}</b>` is not a generator). Options: children as a `function*` hole run where the callee reads `props.children` (for flow controls a zero-arity generator child that returns content rather than a view — today that is a row, `[ROW_VIEW]`), or rows everywhere (`function* () { return view(function* () { return <…/>; }); }` per branch). (3) **Solid's own components** (router, `Portal`, `HydrationScript`, Solid's `Reveal`, context providers) return Solid's `JSX.Element`: they are not block views, `yield*` cannot take them, and they need Solid-shaped lazy props (getters) — options: tags stay legal for non-block components (the type check then needs a component-kind brand rather than `keyof IntrinsicElements`), a typed bridge for calling one (what `adopt()` was, D-047), or library wrappers for the few used. Also: arrow render callbacks (`todo => <TodoItem todo={todo} />`, the non-row `For` form) cannot contain `yield*`, so every one becomes a row generator. Nothing of `no-component-tag` / the `ElementType` restriction / the twin migration is committed; D-063 (`[UNSETTLED_ROW]` removed, pending and failing rows propagate through the call form) is (`601cdf66`).

### D-083 — Tracking is a property of the host, not of the read; `$untrack` removed
**Decided (Dev, 2026-10-05).** Amends D-079's effect phase and closes D-042's `$untrack` question. A plain `yield* <source>` in the effect phase of `$effect(compute, effect)` is admitted and is untracked because the host is (Solid's `createEffect` effect phase), exactly as reads in events are untracked today; the library adds no untrack of its own. `$untrack` is removed (D-005: zero twin uses after the D-042 migration; its only remaining meaning, "read without subscribing inside a tracking host", had no user — the first twin that needs it is the finding that brings it back). Reads track where the host tracks: memos, holes and the compute phase subscribe; events and the effect phase do not. Also closes D-029: `Inherit<T>` is not added (7 generic components across 8 twins; generics spread down the chain regardless).

*Implemented (Phase 5).*
- **Runtime.** `READ_IN_EFFECT` and its `untracking` flag are gone: a read in the effect phase is `readOf` as anywhere else, and subscribes nothing because Solid runs the effect phase with no observer. `UntrackOp`, `$untrack` and `UNTRACK_IN_SETUP` are removed; `READ_IN_SETUP`'s message points to the hosts that read untracked. (`$settled` keeps its `untrack`: it is Solid's `onSettled` callback, not a read op.)
- **Types.** `UntrackedRead` is removed from every op union. `EffectPhaseOp` = `Read<false> | Write | Cleanup | Raise | EventCallOp<false, false>`: a settled read is admitted; a read that may be pending is refused, as `UntrackedRead<false>` was, because the effect phase does not wait (Solid's `NotReadyError` at run time).
- **Lint.** `no-foreign-reactive` points Solid's `untrack` to a plain read in an `$event` or an effect phase; `read-before-attempt` no longer exempts `$untrack` (a `raise` only).
- **Tests.** runtime "reads track where the host tracks: a memo and a compute subscribe; an event and the effect phase do not (D-083)" (a write to a source read only in the effect phase and an event re-runs nothing; a write to one read in the memo and the compute re-runs both, and the effect phase sees the other's current value); "an $effect's compute does not write; its effect phase reads, untracked (D-079, D-083)"; type-tests "ReadsInEffectPhase" and raise.type-tests D-079 (a settled read admitted, a pending one refused). Removed: "$untrack reads once …", the `UNTRACK_IN_SETUP` case, "$untrack after a memo's async attempt …". 16 `$untrack` uses, all in the package tests (D-042 has the per-file count); twins, scenarios and docs had none.
- **Docs.** §1 ("Reads": reads track where the host tracks), §1's setup operations, §3's D-042 and D-079 rows, refusals.md (the `$untrack` row and `UNTRACK_IN_SETUP` gone; the effect-phase row is now the pending read), the changesets for D-042 and D-079 restated without `$untrack`, and a changeset for the removal.

### D-084 — On the server a view's holes are read before its children (D-069 F8 is the model)
**Decided (Dev, 2026-10-05).** D-069 F8 is not a divergence to remove: it is the model. A hole is a computation the view owns, and the interpreter resolves a view's computations, then descends into its children. So on the server the library reads a view's holes before it renders the view's children. Handwritten Solid interleaves them in markup order: blocks-row-recursive's oracle reads `open a` for the toggle, renders the nested rows, then reads `open a` again for the `<ul>`'s `style`. The reads, the values and the markup are the same. The difference shows only in a read trace, and only on the server: the client and hydrate traces are equal. No code change. The declaration in `declared.ts` stays as the pin.
*Alternatives (rejected):* reorder the SSR interpreter so it interleaves hole reads with child rendering.
*Reasoning:* the difference cannot be observed: same reads, values and markup. The compiler route would not share a reordered interpreter anyway. Reordering would add machinery to the library route to match an order nothing depends on.
*Documented.* §3, next to the D-081 note: "on the server a view's holes are read before its children; the markup is unaffected". D-069's status table marks F8 resolved; with it every D-069 finding is resolved.

### D-085 — A bound event's failure routes to the bind site (review R1)
**Decided (Dev, 2026-10-05; review R1, Claude G-2).** *The fact, verified at `f608fa7`.* `$event` captures `getOwner()` and `useContext(BOUNDARY)` when it is created (`runtime.ts:1397-1404`). An unhandled call reports through `reportError(owner, …)` (`runtime.ts:1428-1432`). The library invented this: Solid has no creation-site notion. An action's failure is a rejected promise, and a DOM handler's throw is uncaught. The types already join a bound handler's failures to the *binding* view (D-072). So a handler created in one component and bound in another type-checks as handled under the binder's `Errored`. At run time that `Errored` never sees the failure, which goes to the creation site's boundary or is unhandled (the review's probe 2).
*Ruling.* When a handler is bound (`perform` in an `on*` attribute, or `h`'s attribute bind), the hole records its owner and boundary. A DOM call with no handler of its promise reports there. A call from another block throws at the caller, as it does today. The creation-time `BOUNDARY` lookup and the `BOUNDARY` context are removed. Types are unchanged: D-072 already names the binding view, and this makes the runtime agree (D-071).
*Tests.* A handler created in `Parent` and bound in `Child` under `Child`'s `Errored`: that `Errored` shows it. With an `Errored` above both: the bind site's shows it. A conformance error-routing scenario is added (the `$`-dialect one was not ported, D-069 "Not ported").
*Alternatives:* refuse cross-component binding (a lint plus an owner check at the bind); a §7 note (forbidden by D-071).
*Reasoning:* the bind is where the handler meets the DOM, the only place a DOM dispatch's failure can be said to happen. The type already says so. Refusing cross-component binding would forbid passing a handler through props or context, which is ordinary Solid. A §7 note would document a runtime/type mismatch away.
*Amends* D-072's "a failure nobody handles goes to the nearest `Errored` above the handler's creation site". *Implementation:* not yet.

### D-086 — An unyielded block call is refused by the types and by lint (review R2)
**Decided (Dev, 2026-10-05; review R2, both reviewers).** The JSX `Fragment`'s children are typed `Element`, regenerated through `scripts/jsx-web-shared.mjs`. So `{MainSection({…})}` without `yield*` is a type error. Today a fragment takes `children: unknown`, so a pending, failing call dropped into `<>…</>` checks as a settled, never-failing view. The new lint `component-call-yielded` (an error, in `recommended`) reports a block component call that is not `yield*`-ed; its autofix adds the `yield*`. Fix `examples/todos-blocks/src/app.tsx:269` (`<>{[MainSection({ filter: props.filter }), Footer({ filter: props.filter })]}</>`) and any other site the type or the lint finds.
*Alternatives:* lint only; types only.
*Reasoning:* the call drops its colors, which under-states failures, the dangerous direction of D-071. The type closes the hole. The lint gives the message and the autofix at the site, and it also covers positions the JSX namespace does not type (an array, a plain expression).
*Implementation:* not yet.

### D-087 — Typed failures are branded at runtime; an attempt over a call handles only them (review R4)
**Decided (Dev, 2026-10-05; review R4, Claude G-3).** Every build marks a typed failure at run time with one non-enumerable symbol. `raise` sets it, and so does an attempt's `handle` on an `Error` its handler returns. Today `known()` / `KNOWN` mark failures in development only. An `attempt` over an event call passes only branded failures to its handler. Anything else is re-thrown past the handler: a crash is a bug, not a failure (D-019). `Caught<T>` (the call's `FailsOf`) is then exact. HANDOFF's open item ("an untyped `throw` inside the called event would reach the handler outside that type") is ruled by this.
*Alternatives:* widen the handler's parameter to `unknown` (loses D-077's typed handler); document the gap (forbidden by D-071).
*Reasoning:* the type names the call's typed failures, so the runtime must hand over exactly those. One symbol on an object that is already being thrown costs nothing measurable, and doing it in production too means the two builds route a crash the same way.
*Amends* D-077 (`Caught<T>`). *Implementation:* not yet.

### D-088 — A block component handed to foreign code handles its own failures: `foreign(Comp)` (review R5)
**Decided (Dev, 2026-10-05; review R5, Claude I-1 / G-4).** A block component handed to foreign code as a value (the router, `render`) must be `View<boolean, never>`. It may pend under the app's `Loading`; it never fails outward. The exported checker `foreign(Comp)` is the identity at run time. Its type errors with a readable message otherwise. The lint `no-unchecked-foreign-handoff` reports a block component passed where a plain Solid component is expected without `foreign()`. This is a rule in §3 and is removed from §7's limitations. D-067's "foreign components have no colors to track, so nothing is lost at their tags" is reworded: it holds for a foreign component's own tag, not for block components it renders. In room, `route()` becomes `foreign()`. Its per-row `Errored`s (vestigial since D-063) are removed, and D-023's validation note is corrected (Claude I-2: room added boundaries the original lacks, justified by the pre-D-059 "a row is settled").
*Alternatives:* a blocks-aware router bridge (later, if a second twin needs it).
*Reasoning:* foreign code cannot carry a color, so the color must be gone before the handoff. Pending has a place to go (the app's `Loading`, which plain Solid also uses); a failure does not. One checker and one lint say this at the handoff site, instead of every twin writing its own `route()`.
*Amends* D-067; *corrects* D-023's validation. *Implementation:* not yet.

### D-089 — One spelling of a view: `view(function* …)` (review R6)
**Decided (Dev, 2026-10-05; review R6).** `view(function* …)` is required. A bare generator returned from a setup is a type error. The lint `prefer-view-wrapper` (a warning) becomes `require-view-wrapper` (an error, in `recommended`, autofix). D-054 is amended: the wrapper is no longer optional.
*Alternatives:* keep both spellings, with the wrapper suggested by a warning (D-054 as written).
*Reasoning:* two spellings of one thing go against D-005. The wrapper is the spelling that puts a view's type errors on its own line (D-054), so it is the one kept.
*Amends* D-054. *Implementation:* not yet.

### D-090 — An effect waiting on a pending read holds no boundary (review R7)
**Decided (Dev, 2026-10-05; review R7, Claude G-5).** An `$effect` whose compute reads a pending source does **not** hold a `Loading` boundary. Only render effects (holes) notify `Loading`; the compute waits silently. Solid does the same. The types say so: `Create<"effect">` contributes no pending to the component. A runtime test pins it ("an effect waits; no boundary shows it").
*Alternatives:* let an effect's pending read hold the nearest `Loading`, with `Create<"effect", E, P>` carrying the pending to the component.
*Reasoning:* Solid's effect compute does not notify a boundary. The library follows Solid and the type follows the runtime (D-071). An effect is not part of what the view shows, so nothing on screen is waiting for it. G-5 asked for exactly one runtime test to settle it, and this is that test.
*Implementation:* the runtime test; the type already has no pending bit.

### D-091 — An `$event` does not attempt a stream; a stream's handler is a plain function (review R3)
**Decided (Dev, 2026-10-05; review R3: Codex §3 "a stream error handler may type-check a wait that runtime refuses", Claude G-7 / Q5).** An `$event` does not attempt a stream. At the type level a stream-returning attempt is not an `EventOp` (message: "a stream is consumed in a reactive block — $memo or $projection"), with a development error behind it. Streams are consumed in reactive blocks, where `return yield* attempt(() => watch(feed), …)` is already the documented form. *Corollary:* a stream's failures arrive after the host's run, so a stream attempt's handler is a **plain** function: it transforms (returns an `Error`: the stream fails) or absorbs (returns nothing: the stream ends). There is no generator handler for a stream; one is a type error. Generator handlers (D-078) stay for promise and sync attempts.
*Alternatives:* sync-only generator handlers for streams (a `StreamHandlerOp` union); drive stream handlers asynchronously (re-enter the event's transaction).
*Reasoning:* events do one thing and finish; memos hold what keeps arriving.
*Amends* D-078 (point 4: "per failure for a stream"). Resolves HANDOFF's open R3.

*Implemented.*
- **Types.** A new op, `StreamAttempt` (`[KIND]: "stream"`): an `attempt` whose `fn` returns a stream, or a promise of one, yields it (`AttemptStream<T>`), intersected with the message `[STREAM_IN_EVENT] a stream is consumed in a reactive block: $memo or $projection` so that TypeScript prints it at the refusal (a colon there: TypeScript prints an em dash as `\u2014`). `EventOp` does not take it; `MemoOp` (`$memo`, `$projection`, `$optimisticStore`'s body) does, and so do the other hosts that took a synchronous stream attempt before (`EffectOp`, `ComputeOp`, `EffectPhaseOp`, `HoleOp`), unchanged. `StreamHandlerCheck<T, H>` on `attempt`'s handler: for a stream, a generator handler or one returning a value (not an `Error`, not nothing) is `[STREAM_HANDLER] a stream's failures arrive after the host's run: its handler is a plain function that returns an Error (the stream fails) or nothing (the stream ends)`. "Return nothing" was the ruling's absorb; the value form D-078 added has nowhere to go on a stream (the iterator's return value), so it is refused with the generator. `StreamAttempt` is exported with the other ops.
- **Runtime.** `STREAM_IN_EVENT` (development): an attempt whose value is a stream while the host is an `$event` throws, so the call rejects with it. `STREAM_HANDLER` (every build, since a generator handler has no meaning there): a stream attempt's handler that returns a generator object closes it unrun and fails the stream with the error. Before, it was `drive`n synchronously (a read was `READ_AFTER_ATTEMPT`, a wait `ASYNC_NOT_ALLOWED`, an event's write outside its transaction: the review's finding).
- **Twins (checked by their typecheck, which passes unchanged).** No twin's `$event` attempts a stream, and no twin has a generator or value-returning handler on a stream attempt. Nothing migrated.
- **Tests.** raise.type-tests "D-091" (a stream attempt's ops and result, transform and absorb; a promise of a stream waits too; a `$memo` takes one, an `$event` refuses one, and a promise of one; a promise attempt in an `$event` keeps its generator handler; a generator handler and a value-returning handler on a stream refused; a sync attempt keeps its generator handler). runtime "an $event does not attempt a stream: STREAM_IN_EVENT (D-091)" (development) and "a stream attempt's handler is a plain function: a generator handler fails the stream with STREAM_HANDLER (D-091)". raise.spec's D-078 stream test, which had an `$event` attempt two streams and a generator handler, is rewritten in an `$effect`'s effect phase with plain handlers: "a stream's failure, after the host's run: a plain handler's Error fails the stream, nothing ends it (D-091)".
- **Docs.** §1's `attempt` and events bullets, §3's table, refusals.md (the neighbours' table, both codes, both type messages).

## Branch log

| Date | Branch | Event |
| --- | --- | --- |
| 2026-10-04 | `blocks-lib` @ `b03535f6` (container) | Lost unpushed with the container (disk full). Contents: this file, the gate script and baseline, the v2 changeset, HANDOFF.md. |
| 2026-10-04 | `bl/bootstrap` off `dfe692cf` | Reconstruction of the lost commits from the handoff: `09fa9de5` changeset, `08d7a7d3` gate + baseline, `f26f5ca2` gitlink removal (D-022), then this file (`da03be74`); D-030…D-033 added after the design review. ff'd into `blocks-lib` and pushed to `fork` at `da03be74`; the review commit follows. |
| 2026-10-04 | `bl/tighten`, `bl/colors` (container) | Provisioned, no commits landed; recreated on demand. |
| 2026-10-04 | `bl/plugin` off `blocks-lib` + the 1B HANDOFF commit | Phase 2: `a6575ff8` package and fixture parity, `188a99fb` Vite plugin, `5770f1a5` twins and lazy module URLs, `013d20ce` D-043, then the docs and baseline commit. |
