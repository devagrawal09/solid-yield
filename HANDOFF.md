# STOP 2026-10-09 — handoff for the next agent (read this first)

Orchestration stopped on Dev's instruction after four server restarts in one day. Every branch is pushed; every worktree was clean or its state was committed as a `wip:` commit (gate NOT verified for those). Nothing is running. Start from this section; the sections below it are the detailed historical record.

## 1. What this project is (one paragraph)

`solid-yield` is a userland library + compiler for Solid 2 that gives apps **typed failures**: every component's color (pending / fails X|Y / may-wait / requires Ctx) is known and checked. v0.1 (the explicit library, generator routines) is complete and proven (Lean, gate-checked). The current headline is **v0.2 = sugar mode**: the author writes **plain Solid 2** (no library import); a Vite plugin reconstructs the routines, infers failures from throw sites, and a TypeScript language-service plugin + CLI maps diagnostics back to the author's lines. Decisions are numbered D-001…D-117 in `documentation/DECISIONS.md`; findings are F-xx (library), F-Cxx (compiler), F-Sxx (sugar), F-Txx (typing), F-Mxx (mutation), F-Kxx (soak).

## 2. Branch table (all pushed; shas verified against origin at stop)

| Branch | Head | State |
| --- | --- | --- |
| `main` | `9fdcf82` + this handoff commit | D-113…D-117 recorded; 10 originals (incl. dashboard); analyzer tool; calculus proofs merged + gate step; soak harness merged (report-only); D-117 (failures keep their class across the wire); pnpm 11.20.0; gate GREEN at `9fdcf82` (52 pass / 1 report-only skip). |
| `proto/sugar` | `3b3f167` | Native mode (bounded, option C). Passing originals: sierpinski, todos, hackernews (two-half acceptance). Effect pinned at F-S34. F-S35 fixed here; F-S36 pinned. `proto/sugar-ls` merged in at `f670cd9` (checker contract, ts-plugin, CLI) — but NOT its later commits (see below). Gate 77/77 at head. |
| `proto/sugar-types` | `e92a701` | Off `proto/sugar`. F-S36 repair: author Solid type annotations (Accessor/Setter/Signal/Component/JSX.Element) lowered alongside values (`packages/vite-plugin-yield/src/native-types.js`, `packages/yield/src/native-types.ts`). Dashboard then stops at **F-S37** (§3). Two `wip` commits; gate state per their messages. Two stashes from this branch exported to `documentation/handoff/stashes/`. |
| `proto/sugar-ls` | `451d2cd` | The TS plugin + `solid-yield check` CLI; checker contract (catch rule, subclass coverage, selective rethrow, @yield-absorb, EVENT_REJECTS, root handoff at origin); review-1/2/3 fixes. Scores: review 1 19/20, review 2 15/16, review 3 28/30. Gate 66/66. Commits after `ed90200` (`e215b7c`…`451d2cd`) are NOT yet merged into `proto/sugar`. The killed-worker patch items were audited: all covered (`documentation/reviews/sugar-review-3-fixes.md`). |
| `proto/sugar-mutation` | `e5db2b8` | Mutation gate step (program mutants; score baseline 35.65 % — see §6 caveat) + Stryker: ESLint plugin 66.04 %, TS plugin 48.07 %, compiler-yield/failure-inference.js 59.57 % (700 mutants), vite-plugin-yield native-effects+positions+transform 47.00 % (966 mutants, bounded run). Report: `documentation/mutation-report.md`. Based on `proto/sugar-ls@d88e31c` (old). |
| `proto/sugar-fs35-isolated` | `7381dd1` | Created by a resurrected session; one real commit (`a1c7adb` "keep native evidence independent of checkout paths") + a `wip:` preservation commit. Probably subsumed by `3b3f167`; verify by diff, then merge the one commit or delete. |
| `proto/compiler` | `620d62a` | Compiler experiments (measured; D-114): static extraction + root split (no gain); reachability; R = islands (server components with client slots) incl. the three-level docs fixture and the scaling curve; C4/C4b/C4c DOM parity (6/40 exact; remaining diffs are Solid frames'/router's); rc.13 adapter isolated in `src/solid-adapter.js` with a version guard + contract tests. Gated on upstream. |
| `proto/compiler-single-root` | `43bb41b` | Historical. |
| `proto/calculus-proofs` | `950a71b` | Merged into main. |
| `runtime/failure-wire` | `fcb74cc` | Merged into main (D-117). |
| `harness/soak` | `18e8d62` | Merged into main. |
| `examples/dashboard` | `432db86` | Merged into main. |
| `chore/rc14` | `a0b95aa` | Solid 2.0.0-rc.14 bump, HELD: fixes #3815 (workaround removed there) but regresses Errored (§5). Gate 44/46 (two allowed reds). Do not merge until resolved. |

Worktrees on the original machine (may not exist elsewhere): `/Users/devagr/solid-yield` (proto/compiler), `/private/tmp/sy-docs` (main), `sy-sugar`, `sy-types`, `sy-ls`, `sy-mut`, `sy-soak`, `sy-dash`, `sy-sugar-fs35-work`. Lean toolchain at `/private/tmp/elan` (the proofs gate step SKIPs without it; install hint in the step).

## 3. Where each line stopped — and the exact next action

1. **Sugar mode — dashboard original.** Stopped at **F-S37**: `useFilters()` reads and raises during generated component **setup** (`filters.tsx:32:17`, `FilterBar`), which the lowering only admits setup operations for. Side-by-side: `documentation/native-dashboard-blocker.md` on `proto/sugar-types`. Same class as F-S35/F-S36 — a core-line lowering gap (a context read at setup that can raise NO_PROVIDER must be admitted as a setup read carrying its `requires` color, not refused). Next: fix on `proto/sugar-types`, then the two-half acceptance (unchanged original → exact diagnostics; minimal author patch → parity + SSR; AckFailed/NotFound paths). Expected diagnostics: NATIVE_FOREIGN_BOUNDARY at `app.tsx:92` (+ real unhandled failures if any).
2. **Merge order** (full gate at each): `proto/sugar-ls@451d2cd` → `proto/sugar-types`; finish F-S37 there; `proto/sugar-types` → `proto/sugar`; `proto/sugar-mutation` → `proto/sugar` (then re-run the mutation step with the CORRECTED kill criterion, §6); resolve `proto/sugar-fs35-isolated`.
3. **Remaining originals through native mode** (one single-goal session each, two-half acceptance, stop rule): rendering, room, docs. Effect stays pinned at F-S34 (the hand-written Effect-TS↔Solid bridge helper reads a signal outside any host).
4. **Native todos needs the two-half rule now too**: with the checker contract the unchanged todos original reports `EVENT_REJECTS` at `app.tsx:82` and `:121` (bulk actions) — correct behaviour; add the snapshot half + the minimal patch half (noted in sugar-design.md on `proto/sugar-types`).
5. **Checker gaps still open** (review 3; the proofs' contract): refused imports can cause extra caller errors (incomplete checked summaries); timer registration and general callback support; runtime source maps (F-T5); editor UI unverified (F-T1). Wire matching is D-117's job — the native emit must call `registerFailure(Class, stableId)` on both peers and `prepareFailure` before transport; NOT yet wired into the sugar branch.
6. **Fourth first-time-user review** after the merges (reviewers 1–3's apps and mistake sets: `documentation/handoff/reviews/` and fixtures under `packages/ts-plugin-yield/test/fixtures/`).
7. **Compiler/islands line** (`proto/compiler`): no longer gated on the ~25 KB gzip frames client runtime (Dev 2026-10-09: unavoidable, size work is ongoing upstream, not a problem for the exploration; it stays the measured break-even). F-C18 (frames claim links in `innerHTML`) is an allowed difference (D-118): C4b counts 33/40 exact with it allowed, 6/40 strict; the branch's report still states the strict figure. The streamed-loading-root finding (draft §2) is withdrawn: Solid's own rule (D-118). If an islands emit moves a `Loading` that was an existing boundary in the original route into a server component, mid-navigation behavior changes; that is our emitter's to avoid, not upstream's. Still open: re-measuring C3b/C3c on rc.14 (runtime shrank 56–94 KB at load).
8. **rc.14**: held on `chore/rc14`. The Errored/isPending regression is **filed upstream** as [solidjs/solid#3957](https://github.com/solidjs/solid/issues/3957) (Dev 2026-10-09); re-test when Solid fixes it.

## 4. Open rulings for Dev

- **Upstream bundle — answered by Dev 2026-10-09:**
  1. rc.14 `Errored`/`isPending` regression — **filed** as [solidjs/solid#3957](https://github.com/solidjs/solid/issues/3957).
  2. Frames findings (draft `documentation/upstream/solid-frames-link-claim.md` on `proto/compiler`):
     - **§1 / F-C18, link claiming — ruled (D-118).** Frames claim links inside `innerHTML`, regular rendering does not. Upstream should decide which is intended, so it is asked as a question, not a bug. Until then it is an allowed difference: C4b counts 33/40 exact (the 7 left are F-C19). Filed by Dev as [solidjs/solid#3958](https://github.com/solidjs/solid/issues/3958) (text: `documentation/upstream/solid-frames-innerhtml-claims.md`, re-checked on rc.14 / router next.38).
     - **§2, streamed loading root — withdrawn.** Dev's rule: existing `Loading` boundaries hold a navigation, new ones show their fallback. Verified client-only on rc.13 and rc.14: a route whose component loads asynchronously and has its own inner `Loading` behaves exactly like the frames path. §2 compared it with a route whose boundary already existed. Nothing to file (D-118).
  3. Frames client fixed cost ≈ 25 KB gzip — **accepted**: unavoidable, size reduction ongoing upstream, not a problem for the exploration.
  4. F-K1 (Solid retains `_optimisticNodes`/`CollectionQueue`) — **parked**: not sure it is an issue right now. Nothing to file.
- ~~Public roadmap issue~~ — **posted** (Dev 2026-10-09).
- npm publish: parked ~1 month by Dev (credentials elsewhere); do not raise.
- Resolved 2026-10-08: production fallbacks show the real failure message (D-115; allowed difference); transported failure classes regain their prototype (D-117).

## 5. Upstream status

#3815 fixed upstream (#3816; in rc.14). #3845 closed by design. F-C9 withdrawn (both renderers by contract). F-C14 = #3815's class. rc.14 Errored/isPending regression — **filed** as #3957 (Dev, 2026-10-09). Frames link claiming (F-C18) — allowed difference (D-118); asked as #3958. Side observation from the rc.14 / router next.38 rerun, untriaged: a hash click no longer gives the fragment link `aria-current` in any mode, including plain Solid (next.29 did); the repro's last assertion now fails for that reason (F-C19 territory). Streamed loading root — withdrawn (Solid's existing-vs-new boundary rule; D-118). Fixed cost — accepted, nothing to file. F-K1 — parked.

## 6. Process rules (learned the hard way; keep them)

- **One worker per worktree.** Sessions presumed dead after a server restart have resumed later and worked concurrently with their replacement. Only a session whose execution reported *failed/cancelled* is dead; a "completed" transcript with zero assistant turns is NOT proof. If unsure, use a new worktree on a new branch.
- **Commit after every green step** (build + fast gate → commit); full gate before the final commit of a deliverable. Restarts lose everything uncommitted.
- **Keep subagent tool output short**; Codex sessions die at ~1 MB transcript. Fresh sessions briefed from repo state beat continuations. Begin briefs with "THERE IS NO EARLIER HANDOFF; run git status first" — a session once answered from stale context without running a command.
- **Single-goal implementation sessions** (Codex `sol#high`) got originals through native mode where multi-goal prototyping sessions (`astra#high`) did not. Reviews: Claude Sonnet, read-only worktree, writes only to an out dir.
- Gate: `pnpm build` then `node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json` (`--fast` acceptable for docs-only). Never block on CI; push only after local GREEN. DECISIONS.md edits via function-form string replacement (a `$`-pattern bug once corrupted it).
- **Mutation testing is a standing rule** (Dev). The mutation step's program score (35.65 %) UNDERCOUNTS: its kill rule demanded the expected code at the mutated line ±0, but a deleted Errored/Loading/provider is correctly reported at the origin read or the handoff with the deletion as related location. Next run: count a kill when the expected code's primary OR related location falls in the mutated routine; re-baseline. It also predates the checker contract.
- Two-half acceptance for originals (F-S9/D-116): unchanged original → exactly the recorded, correct diagnostics; minimally patched copy (patch applied at test time; original byte-identical) → parity + SSR vs the original.

## 7. External artifacts now inside the repo (`documentation/handoff/`)

`reviews/review1|2|3/` — the three first-time-user reviews' REVIEW.md, their apps and mistake variants (REVIEW.md copies also in `documentation/reviews/sugar-review-{1,2,3}.md`). `patches/` — the killed worker's extra patch + handoff note (all items confirmed covered by `proto/sugar-ls@451d2cd`). `stashes/` — the three repo stashes as patches with INDEX.txt (two `proto/sugar-types` restart backups — likely superseded by `cb4bcd3`/`e92a701`, verify by diff; one `proto/sugar` safety stash superseded by `3b3f167`). `repros/` — plain-Solid reproduction dirs (ssr-boundary, frames, rc14-effect, frames-links, rc13 control) without node_modules.

## 8. Numbers worth remembering

Compiler on the docs fixture (rc.13): static extraction + root split — seven roots +9.9 % executed, one root +3.8 % executed / −0.5 % shipped; islands (R) break-even ≈ 25.6 KB gzip of server-derivable code; at level L −44 % load executed / −57 % gzip vs the library, client bundle invariant (83,744 gzip; 80,698 after C4b). Reachability floor 348,751 B. Soak: no library leak; 57,263 + 10,800 parity checkpoints clean. Proofs: 50/52 obligations hold under inference (O27, O52 restated into the checker contract).

---

# HANDOFF — solid-yield (checkpoint 2026-10-09: through D-117)

This repository was extracted from the Solid fork `devagrawal09/solid`, branch `blocks-lib`, at commit **`6978eb83`** (D-015). Git history was not carried; the fork keeps it. The fork's own handoff at that commit (Phases 1A, 1B and 2, and its environment notes) is `git show 6978eb83:HANDOFF.md` in the fork.

> **Names (D-096, 2026-10-06).** The product is `solid-yield` (was `solid-blocks`), with `vite-plugin-solid-yield` and `eslint-plugin-solid-yield`; the unit is a **routine** (was "block"), the model is **yield components**. Package directories are `packages/yield`, `packages/vite-plugin-yield`, `packages/eslint-plugin-yield`; twins are `examples/*-yield(-h)`; the gate is `scripts/yield-gate.mjs`. Text below written before D-096 was updated to the new names, except quoted fork paths and the extraction's own history.

## Roadmap and compiler checkpoint (2026-10-09, D-116/D-117)

- **v0.1: done in code.** The library runtime, transform and lint are feature-complete; npm publication still awaits credentials.
- **v0.2: sugar mode (native, bounded), plus the editor plugin and matching CLI check.** Write plain Solid; the plugin reconstructs yield routines and checks their types. D-115’s serialization-safe typed failures remain included. **Sierpinski, todos and hackernews-spa pass** client/hydrated parity and SSR (11, 27 and 15 happy states + 1 failure respectively; hackernews uses the minimal author patch). **Effect is pinned at F-S34** under the stop rule after F-S30–F-S33 fixes; proto/sugar **7387a35** records **69/69 GREEN**, with todos green. **Dashboard native sugar is in progress; rendering/room/docs are queued.** The checker contract is implemented on proto/sugar-ls **ed90200**: comparable review 1 **9/20 → 19/20**, review 2 **11/16 → 15/16**. The third review scored **22/30**; fixes are dispatched on proto/sugar-ls. Mutation baseline on proto/sugar-mutation **035893f**: **35.65%**, with the counting caveat in D-116’s mutation-baseline amendment; the `mutation` gate score may not drop. D-117 landed on main at **2c577d4**: `registerFailure`, `prepareFailure` and `rehydrateFailure` preserve registered failure classes across streamed SSR/hydration and server-function RPC; runtime matching uses class identity. See [sugar-design.md](https://github.com/devagrawal09/solid-yield/blob/7387a35/documentation/sugar-design.md).
- **Dashboard:** the plain-Solid original and test harness from **examples/dashboard** are merged; native sugar acceptance is in progress. It exercises native sugar on plain Solid.
- **Then: islands (server components with client slots) productized — gated on upstream + adapter**, retaining the purity prerequisite below.
- **Then: the lazy builder on the library route.** resume(root), descriptors, keyed attachment and materialization on first interaction, with its own event queue/payload, validated claims and render fallback; keyed failure re-delivery remains a related target (D-109). D-116 supersedes the earlier v0.3 order.
- **Compiler: measured (D-114, C3c amendment); productized islands follow the dashboard (D-116).** **Islands: server components with client slots (R emit)** remain **gated on upstream + adapter** and the **purity directive's trust model**. C4 fixes the first `Loading` fallback and LikeButton identity; C4b uses authored-element frame hosts, removes F-C16 and reaches **6/40 exact DOM / 40/40 content matches**. C4c fixes our root wait; every remaining exact-DOM difference is frames/router behavior (raw-link over-claim, streamed-loading settlement and stale fragment-link state). The pinned rc.13 server/hydration adapter still needs replacement (session dispatched). C4b measures **621,864 load-executed / 80,698 shipped gzip bytes**; C4c **621,888 / 80,793**, both below C3c's **628,086 / 83,744**. It stays unmerged on proto/compiler. C2 is static extraction + eager root split: every root remains a full client component, and the article still renders in the browser. C3–C3c are islands with server-rendered content and small interactive client slots. The measured **rc.13** eager-SPA threshold is a wash near **25 KB gzip** of server-derivable code and a clear win from **~110 KB**, with a widening payload gap: S/M/L save **4.55%/51.99%/56.74% gzip** and **16.22%/41.47%/44.38% load execution** versus the library. R's load and shipping stay constant; response expansion remains (L: +8,500 gzip versus equivalent JSON over seven navigations, leaving 101,332 bytes saved; session execution excluding load −7.97%). See [compiler-c3c-scaling.md](https://github.com/devagrawal09/solid-yield/blob/ada81a8d3af2c1e3a783468ac820875fff1fb99d/documentation/compiler-c3c-scaling.md) and D-114 for controls, limits and recorded differences.
- **Full resumability with the library's own runtime:** horizon, preserving the same semantics.

| Read-only branch | Head | Role |
| --- | --- | --- |
| proto/sugar | **7387a35** | Sierpinski/todos/hackernews pass; recorded 69/69 GREEN. Effect pinned F-S34 after F-S30–F-S33 fixes; dashboard in progress; rendering/room/docs queued |
| proto/sugar-ls | **ed90200** | Checker contract implemented; review 1 9/20 → 19/20, review 2 11/16 → 15/16; third review 22/30; fixes dispatched; bounded gaps remain |
| proto/sugar-mutation | **035893f** | Mutation gate baseline 35.65% (128 killed / 231 survived / 57 equivalent); Stryker ESLint 66.04%, TS 48.07%; deferred packages now running |
| runtime/failure-wire | **de09fa9** | Merged into main at **2c577d4**; D-117 registered failure restoration and selective runtime matching |
| harness/soak | **18e8d62** | Merged into main at **c43fd5a**; manual/report-only soak harness, leak classification and harness fixes |
| examples/dashboard | **432db86** | Merged into main at **cba2bd0**; plain-Solid original and test harness, parity/SSR/hydration gates |
| chore/rc14 | **a0b95aa** | Solid rc.14 held: #3815 fixed, `/profile` workaround removed at d5d96aa; `Errored` regression in both Effect apps; 44/46 with two allowed failures on this branch only (D-082) |
| proto/compiler | **9b97cf2** | C1/C1b/R analysis and R islands experiments; [C4–C4c DOM parity](https://github.com/devagrawal09/solid-yield/blob/9b97cf2/documentation/compiler-c4-dom-parity.md): authored-element hosts, root wait fixed, 6/40 exact / 40/40 content; remaining differences upstream; rc.13 adapter replacement dispatched |
| proto/compiler-single-root | **43bb41b** | Single-root cost decomposition; historical F-C9 stop predates D-115 |
| proto/calculus-proofs | **950a71b** | Merged into main at **5d50680**; Lean proofs, paper proofs and probes; branch retained as history |

**Analyzer on main:** a clean port of the analysis passes and fixtures, without
emitters. Run `pnpm run analyze docs-yield` or omit the example for all nine;
`--json` prints full groups, eager causes, directed event reach, S/R/client
provenance and refused captures. The report imposes no thresholds. The branch's
historical byte-budget/phase reports remain there. Main now recognizes module-level
`"use pure"` author assertions and lists every marked module supplied to analysis;
implementations are not checked, and unmarked opaque calls stay U.
Graph reach is not measured savings and
groups are not physical-root claims. The EAGER type marker and foreignSource
runtime remain unmerged, rather than scheduled requirements of v0.2.

**Main corpus:** nine twins plus the merged plain-Solid dashboard original, docs' existing 24 parity steps, and the existing
library/original byte thresholds. C3c's S/M/L docs fixture and 40-step
script remain on proto/compiler. The analyzer's existing nine-twin reports and byte thresholds are unchanged by this documentation amendment.
The full main gate after the soak merge is **52 PASS / 0 FAIL / 1 SKIP GREEN**, including `proofs`, dashboard checks, D-117's failure-wire smoke and soak analysis tests. The sole SKIP is the manual/report-only soak; no baseline regressions.

**Gate snapshot rule (c03adbc).** In executed-byte mode, docs holds avatar promises until the named settled step and drains queued work at zero added fake time before each snapshot, keeping the pending fallback deterministic. Existing byte thresholds stay fixed. Only the library's `newsletter bad email` phase gets a measured tolerance: 801 bytes, from `max(2 × 91-byte observed spread, ceil(80023 × 0.01))`; all other phases get zero added tolerance. Remeasure after Node/Solid or snapshot-boundary changes. See [yield-gate-baseline.md](documentation/yield-gate-baseline.md).

**Native checker contract — implemented, with bounded gaps (D-116 latest amendment).** On proto/sugar-ls **ed90200**, catches remove only failures definitely handled on every path; base classes cover subclasses; selective rethrows retain the remainder; unknown requires a consuming catch-all. Fallback returns/state writes count as handling; empty, bare-return or logging-only catches require `/* @yield-absorb: reason */`. Event failures report at the handler; native render/hydrate failures report at the originating read, with render related. The native handoff remains foreign; D-033’s library-root allowance does not apply. External throw types, dynamic aliases, synchronous catch precision and object-yield generators remain gaps; native failure declarations are unsupported, primitive throws refused. **D-117 is merged at 2c577d4:** `registerFailure`, `prepareFailure` and `rehydrateFailure` restore registered failure classes across stream/RPC boundaries and support selective runtime matching. D-115’s real production-message fallback is an allowed recorded difference (Dev: “fine”).

### Candidates and progress

Sugar is **in progress** on proto/sugar: Sierpinski, todos and hackernews pass; Effect is pinned at F-S34 after F-S30–F-S33 repairs. Dashboard native acceptance is in progress; rendering/room/docs are queued. The checker contract is implemented on proto/sugar-ls, and the third review scored **22/30**, with fixes dispatched on that branch.
Mutation testing is a standing process requirement with its gate artifact and score baseline on proto/sugar-mutation; deferred Stryker packages are now running.
The dashboard original/test harness is merged; native dashboard, productized islands and lazy builder follow the order above. The **analyzer tool is done on main**; a public analyzer product is not scheduled.
Retiring the proofs branch into main is done at **5d50680**; it remains as history.

**Soak harness merged** from `harness/soak` at **c43fd5a**. Run `pnpm soak` (10 minutes per twin by default; `--minutes 60` for an hour), manually/report-only; the gate lists `twins:soak-report` as SKIP. The [report and classification](documentation/soak-report.md) cover all nine twins: **F-K1** is Solid transition retention (`_optimisticNodes → CollectionQueue → error stack`), with the same retaining path in the plain-Solid original; **F-K5/K6** are shared Solid store retention. **F-K2/K3/K4** were harness retention and are fixed. No library leak was found; **10,800 archived samples are parity-clean**, and disposal counters and classification fits were verified.

Unscheduled candidates: serializable color;
keyed re-delivery for rollback UI; static-markup skip in the resumer; public
roadmap issue.

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
- The upstream memo-loop report was filed as [solidjs/solid#3815](https://github.com/solidjs/solid/issues/3815); see Upstream.
- **λ-yield.** `documentation/calculus.md` states the soundness theorem (D-071) and its 52 proof obligations, each now evidenced (`test/obligations.spec.tsx` holds the runtime tests that were missing). §6.3's findings are all closed, and no obligation is violated as tested: F-1 (an `Errored` fallback's dropped colors) and F-3 (`provide({ value: undefined })`) fixed, F-4 / F-5 (comments) fixed, F-7 fixed (a bound call no `Errored` takes rejects, D-085 note), **F-2 fixed by D-100** (`lazy` fails with a typed `ChunkError`; with no `Errored` it is re-thrown and the call renders nothing, no halt; rendering's pages let it reach the root, as the original), **F-6 closed by D-101** (`$settled` removed; run once after mount is `$effect(function* () {}, function* () { … })`; the 4 twin sites migrated with parity, SSR and hydrate smoke green).
- Earlier open items below still stand unless a ruling above closed them: D-088's added boundaries now count 4 (hackernews-spa 3, room 1; rendering's went with D-099).

## Reviews (2026-10-07): kanban and chat

The first-time reviews built larger apps from published docs alone: kanban at `/private/tmp/sy-review-3/{log.md,app}`, chat at `/private/tmp/sy-review-4/{log.md,app}`. Both logs were read in full; those references were not modified. This follow-up started at `bd3716b`. The [reproduction notes](./documentation/review-reproductions.md) separate confirmed findings from reports that could not be reproduced.

The counts below group each log's **new product reports**, rather than counting each symptom or recounting overlapping historical items. Sandbox install, port, browser and jsdom warnings are excluded. Kanban's six are N1–N5 and D1; chat's seven are missing lazy docs, `any` handoff, array length, SSR compilation, hydration bootstrap, reconnect and keyed halt.

| Review | New reports in its log | Fixed / documented here | Still present | Not reproduced |
| --- | --- | --- | --- | --- |
| Kanban | 6 | 6 | 0 | 0 |
| Chat | 7 | 5 | 0 confirmed | 2 (A2, A3) |

- **A1: reproduced, setup error.** Client `generateHydrationScript()` returns an empty string. The script must come from the server build and execute before hydration. Missing it now gives development `[NO_HYDRATION_SCRIPT]`, with the recipe, instead of the undefined `done` TypeError. A one-element test and a separate SSR/Vitest test verify the real server script; the latter preserves and clicks the server button for both string and streamed output.
- **A2: not reproduced.** Removing the chat's outer catch-all in memory, using its own tsconfig and declarations, left zero type errors. Its stream fails with `TransportError`, its lazy call with `ChunkError`, and typed catches leave `never` at `foreign`. A type test pins those exact stages and no `any`. The earlier source producing `any` is not retained; no type fix was guessed.
- **A3: not reproduced.** The chat removed its keyed experiment. Both the library and plain Solid remount tests subscribe again without `[REACTIVITY_HALTED]`. An outer-boundary probe also did not halt. There is no evidence to assign the removed `insertBefore` failure to the library or Solid, so no failing upstream repro was invented.
- **N2 / D-085 F-8: reproduced, resolved by D-109.** An optimistic list move can dispose the event's bind row before its failure arrives. If its captured accepting boundary was disposed, the call now rejects with the original failure and development reports `[BOUNDARY_DISPOSED] <kind> arrived after its Errored was disposed — the event's own optimistic write removed it; absorb the failure in the event, or move the boundary above what the write can dispose`. A boundary above the disposable row still handles it. Tests pin all three modes in development and production. No live ancestor is selected after the captured boundary dies. Keyed re-delivery to a re-created row is a v0.3 target.

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

Those review commits followed `pnpm build` and the **full 37/37 GREEN gate** against the unchanged baseline; D-105 below expands the current gate to 39 steps. The separate documented hydration command also passes 2/2 tests. Commits are local on `main`; nothing was pushed. Remaining limits are the missing A2/A3 intermediate fixtures and real-browser lazy preload verification (the documented jsdom workaround is not that check).

## Proof audit and Dev rulings (2026-10-07)

D-103–D-112 are recorded with alternatives and reasoning in documentation/DECISIONS.md. The read-only proto/calculus-proofs findings F01–F15 guided the repairs; that branch was not changed.

- F02–F05, F07–F08 and F13 close the handler, prop, context, Fragment and h row/boundary type holes, each with its counterexample type test.
- D-109 rejects a failure arriving after its accepting captured boundary was disposed, with the specified development error; §7 states “handled while the boundary lives”.
- D-110 / F09 exports the one-line nominal base `class Boom extends Failure("boom") {}`. Structural errors are refused at raise/attempt/catch; selective runtime matching remains instanceof. **20 typed failure classes across 13 twin files** migrated. The saga interruption Error remains plain and is wrapped by the attempt handler into SagaError. F10 uses a WeakSet to route frozen failures and keeps the serialization property on extensible failures.
- F06 pins NO_PROVIDER at foreign child's creation and the accepted pending-without-Loading case's empty output. No new API was designed. F11/F12/F14/F15 correct the theorem's lint premises, fallback/provider equations and terminology, and state once-effect, seeded-memo and disposed-owner contracts with test evidence. D-112 removes the route-existence converse: colors are sound upper bounds, with no over-statement of discharge.
- D-105 adds V8 executed-range byte checks at load and each authored parity step for all eight twins and originals. The baseline allows 2% or 1024 bytes per phase, whichever is larger. Wall time stays manual. The full gate now has **39 steps**, still checked against the unchanged 37-step yield-gate baseline; both new steps must pass.

**Compiler scope.** D-114 supersedes the old static extraction + eager root split v0.2 plan. Main
contains the analyzer tool; emitters, foreignSource and the unimplemented EAGER
marker remain on proto/compiler. The compiler is measured; D-116 schedules productized R islands (server components with client slots)
after native sugar and the plain-Solid dashboard, gated on upstream + adapter
replacement and the directive's trust model (D-114's 2026-10-08 amendment). Bounded native sugar is in progress on
proto/sugar; other compiler designs remain branch experiments. Earlier proof/ruling
commits were pushed through c797bb3; this session
builds and runs the full GREEN gate before each local main commit and never pushes.

## Calculus proofs

The [proof audit](documentation/calculus-proofs/README.md) is merged into main:
**12 obligations mechanized in Lean, 26 paper proofs, and 14 unprovable as worded**
at the audited revision. These counts are the historical classification; later
main repairs supersede some findings. The abstract proofs do not prove the whole
TypeScript/runtime connection.

Run `pnpm proofs` from the root to build the Lean project and run the 11 runtime
probes. `lean-toolchain` pins `leanprover/lean4:v4.24.0`; install elan if needed.
Lake lookup is `$LAKE`, PATH, then `/private/tmp/elan/bin/lake` with
`ELAN_HOME=/private/tmp/elan`. The report-only `proofs` gate step runs the same
checks without coverage thresholds; absent Lake is SKIP with an install hint and
does not fail the gate. Lean rebuilt clean and the adapted main probes pass
11/11; runtime context names and frozen-failure absorption differ from the old
branch. See the [verification record](documentation/calculus-proofs/verification.md).

## Upstream

- **F-K1 — Solid transition retention (2026-10-09).** The plain-Solid original retains the same `_optimisticNodes → CollectionQueue → error stack` path as the twin. See the [soak classification and retaining paths](documentation/soak-report.md#f-k1-retaining-path). **No draft yet — pending Dev with the upstream bundle.**
- **Frames DOM parity (2026-10-08).** [solid-frames-link-claim.md](https://github.com/devagrawal09/solid-yield/blob/9b97cf2/documentation/upstream/solid-frames-link-claim.md) on `proto/compiler` at `9b97cf2`: **draft, not filed — pending Dev: one bundled conversation proposed**. It covers raw `innerHTML` link over-claim and committing a streamed loading root before its content arrives. Our root-wait bug is fixed; remaining exact-DOM differences are frames/router behavior. See D-114's amendment.
- **Frames client fixed cost / break-even.** Roughly **25 KB gzip** for frames/RPC client runtime plus changed shell/slot/template integration; C3b's code-only threshold is **76,033 raw / 25,625 gzip bytes**, not an isolated frames-runtime measurement. **No draft — pending Dev: one bundled conversation proposed**. These and C3b/C3c are rc.13 figures; rc.14 is held (D-082).
- **Solid rc.14 (2026-10-08) — held on `chore/rc14` at `a0b95aa`.** #3815 passes the plain-Solid repro; the `/profile` workaround was removed at `d5d96aa`. A separate `isPending` reader beside `latest(data)` prevents an async rejection from reaching `Errored`: the public-API/jsdom repro calls the fallback once on rc.13, never on rc.14, in both production and development. Both Effect apps lose their error fallback. Branch gate: **44/46**, with only `twin:effect-yield:test` and `twins:executed-bytes` allowed to fail there. Main stays on rc.13 until an upstream fix or a ruled workaround. The branch draft `documentation/upstream/solid-errored-fallback-rc14.md` is **draft, not filed — pending Dev: one bundled conversation proposed**. D-082 records the retest byte table; C3b/C3c and the 25.6 KB gzip break-even still need re-measurement on rc.14.
- [solidjs/solid#3815](https://github.com/solidjs/solid/issues/3815): rc.13 SSR memo/serialization-slot loop, **fixed upstream** by [#3816](https://github.com/solidjs/solid/pull/3816), merged into `next` on 2026-10-06 (`759a9b6`): a re-created memo that joins a pending slot adopts that slot's answer. The rc.14 retest passes and removes the `/profile` workaround (`046387b`) on `chore/rc14` at `d5d96aa`; the new `Errored` regression holds that bump (D-082).
- [solidjs/solid#3845](https://github.com/solidjs/solid/issues/3845): delayed second hydrate root replaces server nodes, **closed as by-design** (API checked 2026-10-07: closed/not_planned at 2026-10-06T21:49:30Z; closing comment confirms the deliberate completion guard for event replay, serialized-data lifetime and DOM drift). Tier 2 is rejected and the private reset was withdrawn (D-111). D-114 keeps eager emission on the branch; D-116 schedules productized islands after native sugar and the plain-Solid dashboard. The later lazy builder owns keyed attachment, its event queue and payload, with validated claims and render fallback.
- **F-C9 — withdrawn; nothing filed.** Streams carry the typed failure and the hydrated client renders its fallback; renderToString is synchronous by contract (D-099), so the string-render draft is withdrawn. D-115 fixes production sanitization on our side with public markSafeError. Historical compiler-C2/single-root reports still describe the earlier stop; the merged branch's README and C3 reports supersede it.
- **F-C14 — resolved; nothing to file.** The [plain-Solid rc.13 check](documentation/upstream/solid-frames-f-c14-check-rc13.md) recreates an async memo inside a `Loading` child on every SSR pass and fails under ordinary `renderToStream` too: it is [#3815](https://github.com/solidjs/solid/issues/3815)'s class, fixed by [#3816](https://github.com/solidjs/solid/pull/3816) on `next`. The actual F-C14 shape (hoisted loader, synchronous derived memo beneath `Loading`) converges. This is not frames-specific. Re-test at the next Solid RC bump together with the `/profile` workaround (D-082).


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

`solid-js`, `@solidjs/web` and `@solidjs/h` are declared `^2.0.0-rc.11`, the fork's declaration. Solid version: **rc.13 (rc.14 held: see D-082)** (`2.0.0-rc.13`), two RCs ahead of the fork's local rc.11. Through `@solidjs/vite-plugin@3.0.0-next.35` (pinned exact, as in the fork) the twins compile with `@solidjs/compiler` / `@solidjs/babel-plugin` rc.13. `@solidjs/router` is `2.0.0-next.29`. There are no workspace links to Solid.

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
- **One worker per worktree.** A server restart produced two concurrent workers in `proto/sugar-ls`; verify the transcript before re-dispatching a worker (D-116).
- There is no pre-commit hook. `repo:prettier` in the gate covers formatting; prettier is pinned to the fork's 3.8.1.
- Patch docs with function-form replacements (`s.replace(a, () => b)`). A string replacement expands `` $` `` and once pasted DECISIONS.md into itself (fork incident).
- **Never block on CI.** Run the required checks locally; CI does not replace the local gate.
- **Push only after local GREEN.** Run `pnpm build`, then the full gate against `documentation/yield-gate-baseline.json` before each commit. This documentation session commits locally and never pushes.
- **STANDING RULE — PROCESS (Dev, 2026-10-08): “plenty of mutation testing”.** The `mutation` gate step on **proto/sugar-mutation 035893f** supplies the native-corpus artifact: its **35.65% score baseline may not drop**, and per-operator site floors are checked. The baseline used exact-line kills and predates the review/checker fixes at `d88e31c`; the next run counts an expected code when its primary or related location falls within the mutated routine (D-116’s mutation-baseline amendment quotes the full caveat). Also run Stryker over checker source: ESLint **66.04%**, TS **48.07%**; the deferred larger packages are now running. This is a continuing process requirement.

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

Native sugar first-time-user reviews (Claude Sonnet, 2026-10-08):

- [Review 1](https://github.com/devagrawal09/solid-yield/blob/fd0aed2/documentation/reviews/sugar-review-1.md), against **d88e31c**, unchanged copy on proto/sugar-ls; verdict “not today”. [Fixes/rerun](https://github.com/devagrawal09/solid-yield/blob/fd0aed2/documentation/reviews/sugar-review-1-fixes.md) landed at **fd0aed2**: comparable **9/22 → 19/22**. The original 9/26 denominator is corrected there; the legal timer read is excluded on both sides. Remaining: no accidental-swallow warning (intentional absorption is valid), Portal internals unchecked, runtime source maps.
- [Review 2](documentation/reviews/sugar-review-2.md), against **fd0aed2**, copied unchanged from `/private/tmp/sy-review2-out/REVIEW.md`: install worked first time; README jsxImportSource/ESLint contradictions remain; **12/24**. Structural checks work well; swallowed/base-class/selective catches, onClick rejections and root failures were missed. Root diagnostics duplicate and some related locations enter library `.d.ts` files. Verdict: advisory CI for structural mistakes, not typed failures. Exact ten-line summary and the proof-contract priority/session are recorded in D-116’s later-still amendment.
- [Review 3](documentation/reviews/sugar-review-3.md), against **ed90200** (checker-contract state), copied unchanged from `/private/tmp/sy-review3-out/REVIEW.md`: failures-focused, **15 mistakes, 22/30**; tarball install worked first try. A ~200-line app needed ~40 CLI iterations because of refusals, wrong locations and a crash. Hovers were the best part, including a new server-side Banned throw appearing with no client change and exact instanceof/rethrow narrowing; one refusal blanks hovers project-wide. Verdict: advisory CI report or hover aid on a small, conventional codebase; not a CI gate. D-116 records the exact ten-line summary and fixes dispatched on **proto/sugar-ls**.

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

**Native newcomer reviews — latest checkpoint (2026-10-08).** [Review-2 fixes/rerun](https://github.com/devagrawal09/solid-yield/blob/ed90200/documentation/reviews/sugar-review-2-fixes.md) supersedes the historical native-review scores above: comparable **review 1 9/20 → 19/20**, **review 2 11/16 → 15/16**. The checker contract is implemented with the bounded gaps recorded above. **Third review: 22/30; advisory report/hover only, with fixes dispatched on proto/sugar-ls.**

## First-time-user review #2 (Codex, 2026-10-06)

A second first-time user (Codex) built a notes app from the published docs only (log and app outside the repository, `/private/tmp/sy-review-2/{log.md,app}`). Its classification against the first review, tallied: **fixed 6, still present 3, new 3**; 2 not re-tested.

- **Fixed (6):** F2, install and version advice (was 3/4/5); 1/22, real router and app-wide context (`foreign(Settings, { provided: [ThemeCtx] })`); 2/14, test setup and client build; 8/9, `Handler` and the wait warning's defaults (documentation); 17/18, error extraction and `reset` (documentation); 23, package-relative links and `yield *` spacing (the root README still links repository-relative).
- **Still present (3):** **F1**, event writes held until the transaction ends: *still present (behaviour); fixed (documentation)*. That is the model (an `$optimistic` written at the event's start shows the in-flight state, and the guide says so); no change. **F5**, row / view / context structure: still present (the rules); fixed (documentation). Sandbox network and port-binding failures: still present (environment, not the library).
- **New (3):** **F3**, a parameterized route did not typecheck as the recipe wrote it (`Props<RouteProps<"/notes/:mode">>` in a bare `{ path, component: foreign(Notes) }` object: TS2322). This is the router's contract: a bare route's `component` takes no params, and a plain Solid page fails the same way. Fixed in the recipe: it now registers the page with `defineRoute`. `router.type-tests.tsx` and `router.spec.tsx` pin it against `@solidjs/router` 2.0.0-next.35, now a devDependency of `packages/yield`. **F4**, the recommended lint extended to tests reported the guide's `import { flush } from "solid-js"`. Fixed in the rule, keeping one recommended config (D-005): the import is allowed, and only a `flush` used in a routine is reported. A lint test runs the recommended config over the guide's test block. jsdom's `scrollTo` "not implemented" warning under router navigation: new (environment); the router spec stubs it.
- **Not re-tested (2):** 15, form/select view roots (fixed since, `0007462`); 19/20/21, the deliberate-mistake diagnostics.
