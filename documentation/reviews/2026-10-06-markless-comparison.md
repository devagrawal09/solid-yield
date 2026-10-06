# markless vs solid-yield — a read-only comparison

Date: 2026-10-06. Trees compared: `/private/tmp/markless` (fresh clone of `github.com/compiled-run/markless`, HEAD `7da890b`, release 0.5.0) and `/Users/devagr/solid-yield` (`main` at `048c7da`, v0.1 through D-099). Nothing in either tree was modified.

Citations are `path:line` relative to each repository's root. `ML:` marks a markless path and `SY:` marks a solid-yield path. Paragraphs marked **(speculation)** or **(inference)** are my reading and are not stated in either tree.

---

## 0. One-paragraph answer

markless is a whole framework. It has its own component language (TSRX, `.tsrx` files), its own compiler, runtime, bundler and router, and it renders to HTML and **resumes** in the browser. "Resuming" means the page never runs component code again in the browser: on a click, it downloads and runs just that click's handler and the text updates that depend on what the handler wrote.

Its central bet is the opposite of solid-yield's:
- markless has **zero markers**. Reads and writes are plain JavaScript (`count++`, `{count}`), and the compiler infers everything: what is async, what needs a boundary, what is captured, what ships.
- solid-yield has **maximal markers**. Every read and write is a `yield*`, and TypeScript itself carries pending, failure, may-wait and context-requirement colors.

The two projects meet on one claim: async reads must be guarded statically, and a compiler can find which parts of the UI are inert. On that claim markless is a working, measured reference for the compiler half of solid-yield's v0.2, and solid-yield's typed colors are the half markless lacks.

**Verdict: complements, not competitors.** Details and three questions for Dev are in §6.

---

## 1. What markless is, in its own terms

**Purpose and model.**
- The tagline is "A resumable UI framework for async-first apps" (ML:specs/framework/00-overview.md:9).
- The summary promises "SSR output is fully resumable (Qwik-level: zero app execution on load, closures lazy-loaded on first interaction) without any author-facing markers (no `$`, no `.value`, no `track()`…)" (ML:specs/framework/00-overview.md:13-17).
- It supports one language only, TSRX ("`.tsrx` files, `@{}` component blocks, first-class `@if`/`@for`, co-located `<style>`"). "JSX/TSX is explicitly **not** supported" (ML:specs/framework/00-overview.md:19-37).
- The README adds a multi-target pitch: DOM today, plus UIKit and AppKit proofs through JavaScriptCore (ML:README.md:7-62). The proofs live in `ML:poc/fixtures/proofs/{ios,macos}-native-rendering-target`.

**The organising idea** is that dataflow, not the component tree, is the boundary. "UI structure is a tree-shaped graph, but state dependencies are a general directed graph … the dataflow graph is the boundary. Components project graph nodes into DOM; events write back into graph nodes; async work derives graph nodes from awaited data; resumability serializes graph state and edges rather than re-entering component trees" (ML:specs/framework/00-overview.md:26-35).

**What the user writes.** The authoring API is `state`, `computed`, `shared`, `element` and `storage`, imported from `@markless/core`. These are stubs that throw unless the compiler rewrote them (ML:packages/core/src/framework-api.ts:56-91). Two examples:

```tsrx
export function App() @{
	let version = state(0);
	const level0 = computed(async () => settleLevel(0, version));
	<button onClick={() => version = version + 1}>Update root state</button>
	@try { <p>{level0.value}</p> } @pending { <p>Pending</p> } @catch { <p>Failed</p> }
}
```

(abridged from ML:demos/async-waterfall/fixture/app.tsrx)

```tsrx
const user = computed(async ({ signal }) => {
  const id = route.params.userId;            // reads before the first await = the dependency key
  const res = await fetch(`/api/users/${id}`, { signal });
  if (!res.ok) throw new Error("Failed to load user");
  return await res.json();
});
```

(ML:specs/framework/03-state-graph.md:191-211)

**Rules that shape everything else.**
- **No effects.** "There is no `effect()`/`task()` primitive and never will be … **The entire graph is demand-driven from the DOM.** … compiler-generated DOM update symbols are the only effects in the system" (ML:specs/framework/03-state-graph.md:94-104). The classic uses of an effect are rehomed: a derivation becomes `computed`, a stream becomes "event sources that write into state", and eager browser setup becomes `attach` behaviors and `onVisible` (ML:specs/framework/03-state-graph.md:106-122).
- **Async is graph state, checked at compile time.**
  - Reads before the first `await` form the dependency key. A reactive read after `await` is the compile error `MARKLESS_ASYNC_POST_AWAIT_READ` (ML:packages/compiler/src/passes/semantic-graph/diagnostics.ts:595-617).
  - A template read of an async, or async-dependent ("async-capable"), computed must sit inside `@try/@pending/@catch`. Otherwise it is the compile error `MARKLESS_ASYNC_BOUNDARY_REQUIRED` (ML:specs/framework/03-state-graph.md:259-262; ML:packages/compiler/src/passes/semantic-graph/collect-async.ts:216-230).
  - Async-capability is a compiler fixpoint over computed dependencies (ML:packages/compiler/src/passes/semantic-graph/collect-async.ts:68-100). Async cycles are compile errors (ML:specs/framework/03-state-graph.md:251-252).
  - Superseded runs are aborted through an `AbortSignal`, and stale resolutions are ignored (ML:specs/framework/03-state-graph.md:253-255).
  - "`@try` / `@pending` / `@catch` is the ONLY async status vocabulary … no `navigation.pending`, no `model.pending`" (ML:specs/framework/12-arm-rendering.md:125-129).
- **No context.** "There is no `context()` and no `store()`." `shared(() => …, { scope })` names a dataflow instance with scope `request | container | page | widget` and needs no provider (ML:specs/framework/03-state-graph.md:526-619).
- **The capture rule.** A closure the compiler extracts (a handler, a computed body, a DOM update) may capture only:
  1. graph references
  2. `element()` handles
  3. props and `shared` references
  4. module imports
  5. serializable constants

  Anything else is a compile-time diagnostic (ML:specs/framework/02-compiler-pipeline.md:215-233). This is what replaces Qwik's `$` marker.

**Runtime/compiler split.**
- The compiler does almost everything: state rewriting, template lowering, closure extraction into lazily loaded "symbols", splitting async keys from async runs, boundary lowering, capture analysis and diagnostics (ML:specs/framework/00-overview.md:79-91; ML:specs/framework/02-compiler-pipeline.md:199-213).
- The compiler transforms each module independently. The bundler then joins the module artifacts (component edges, prop kinds, locators, symbol ids) into one app graph (ML:specs/framework/10-render-architecture.md:290-341).
- The browser runtime is staged:
  - an inline resumer, with a 300–500 B gzip target and a 700 B hard budget (ML:specs/framework/06-runtime-resumer.md:194-200)
  - capability modules that run only when the payload declares a record kind *and* an action needs it (ML:specs/framework/06-runtime-resumer.md:208-268)
- Steady-state updates take the smallest tier the compiler can prove: value slots, then keyed rows, then branch flips, and only then "arm commit". Arm commit is the one tier that runs component code in the browser, and falling back to it must emit a diagnostic (ML:specs/framework/12-arm-rendering.md:16-46).

**Server/client.**
- There is "no standalone `server` package and no public two-sided deployment model" (ML:specs/framework/00-overview.md:113-118).
- SSR runs component bodies once. The browser decodes the payload, installs delegated listeners, and runs nothing until a trigger fires (ML:specs/framework/06-runtime-resumer.md:161-165). "'No hydration' forbids re-executing components over existing server HTML; it does not forbid rendering new content client-side" (ML:specs/framework/12-arm-rendering.md:36-39).
- Streaming SSR is the default (ML:specs/framework/12-arm-rendering.md:95).
- Server functions and RPC are **deferred**. A `module server {}` block is a fail-loud diagnostic today (ML:specs/framework/08-deferred-decisions.md:23, 156-188).

**Status and maturity.**
- **Release.** Version 0.5.0, with every package released in lockstep (ML:CHANGELOG.md:3-14). The changelog starts at 0.2.0.
- **History.** The clone is **shallow**: `git rev-parse --is-shallow-repository` returns `true`. It shows 114 commits, 2026-09-01 → 2026-09-25, all by Jack Shelton, so the total commit count is not knowable from this tree. `ML:docs/ci-process.md:3` cites "twelve weeks" of `main` history with 122 pushes, so the project is at least about three months old.
- **Size.** About 280k lines of non-test `.ts`/`.tsrx` under `packages/` (by `wc`). Per package:
  - compiler ≈ 56.5k
  - web ≈ 30k
  - bundler ≈ 30k
  - vitest-browser ≈ 20k
  - router ≈ 12k
  - the headless UI library ≈ 94k
  - runtime ≈ 2k
  - core ≈ 0.3k

  For comparison, solid-yield's three packages are ≈ 4.3k (runtime and types), 2.1k (lint) and 0.7k (transform).
- **Tests.** 862 test or spec files under `packages/` (compiler 290, vitest-browser 236, bundler 124, web 121, router 36), and about 5,450 `it(`/`test(` blocks across packages and demos (a crude grep).
- **Specs.** 4,940 lines across `specs/framework/00–14` and `specs/router/*`.
- **Demos.** 22 demo apps (`ML:demos/`), including js-framework-benchmark, dbmon, todomvc, streaming-ssr, chat-stream and a chained-async comparison against TanStack Start.
- **CI.** CI has many lanes (ML:.github/workflows/ci.yml). `pnpm ci:local` replays the workflow's own steps (ML:docs/ci-process.md:13-24).
- **Browser checks.** A browser "analyzer" turns runtime evidence into persisted invariant receipts (ML:packages/analyzer/README.md:1-95).
- **Size and performance guards.** Executed-bytes and size guards (ML:package.json:19-24).
- **Diagnostics catalogue.** A catalogue whose consistency CI checks (`docs:errors:check`, ML:package.json:12-13).
- **Spec maturity is uneven:**
  - Arm rendering is "DRAFT … implementation in progress" (ML:specs/framework/12-arm-rendering.md:3).
  - The resume cache is "SPECIFIED, NOT IMPLEMENTED" (ML:specs/framework/13-resume-cache.md:3).
  - Cross-container patches for shared state are not wired (ML:specs/framework/03-state-graph.md:751-762).
  - The progress ledger `specs/state.md`, which `ML:specs/framework/00-overview.md:6` points to, is missing from the tree.
  - `ML:docs/ci-process.md:3` records that `main` "was red 85% of the time" over twelve weeks, which prompted the current CI discipline.

---

## 2. Where they solve the same problem, and how differently

Both projects aim at the same thing: fine-grained reactive UI, with no virtual DOM and no re-renders, where **async data and failures are first-class and statically checked**, server rendering is native, and a compiler eventually decides what code runs where. They differ on almost every mechanism.

| Axis | markless | solid-yield |
| --- | --- | --- |
| **What the user writes** | Plain JS reads and writes in `.tsrx`: `count++`, `{count}`, `session.user = u`. No markers at all (ML:specs/framework/00-overview.md:51-56). | `function*` routines: every read and write is a `yield*`, with no escape hatches (SY:documentation/DECISIONS.md D-006). Setup creates and never reads (D-042). A view has no body (D-032). Components are called, not tagged (D-062). |
| **Host** | Its own language (TSRX, a third-party language with React/Solid/Vue targets; markless is one compile target, ML:specs/framework/00-overview.md:79-81) and its own runtime. | Userland on Solid 2's public API only (D-004). One syntactic transform (`yield*` in JSX → `perform`, D-003). Foreign Solid components stay tags (D-067). |
| **Effects** | None, by design: demand-driven graph, DOM updates are the only effects (ML:specs/framework/03-state-graph.md:94-104). | `$effect(compute, effect)` (D-079), `$settled` (D-053). Events are transactions (D-020, D-081). |
| **Events** | Plain closures, lazily loaded. Writes commit and are not rolled back on error (ML:specs/framework/06-runtime-resumer.md:79-81). Optimistic writes deferred (ML:specs/framework/08-deferred-decisions.md:19). | `$event` is a Solid `action`: one transaction, with `$optimistic` for in-flight UI (D-081, D-014). Binding is a typed op (D-072). A failure routes to the bind site (D-085). |
| **Async** | `computed(async ({signal}) => …)`. The key phase is the reads before the first `await`. A post-await read is a compile error. Superseded runs are aborted (ML:specs/framework/03-state-graph.md:214-255). | `$memo(function* () { …; return yield* attempt(fn, onError) })`. The lint `read-before-attempt` and the dev error `READ_AFTER_ATTEMPT`. A superseded run *runs to completion* and its result is discarded (D-080). |
| **Pending tracking** | Compiler fact (`asyncCapable` fixpoint), invisible to TypeScript: `computed<T>()` is typed `Awaited<T>` (ML:packages/core/src/framework-api.ts:1,60). | Type fact: `Source<T, E, P>`. The `P` flag flows through `yield*`, calls, holes and rows (SY:documentation/calculus.md §1.1–2). |
| **Boundary obligation** | Every async template read must be *dominated* by a `@try` (statically required, per read) (ML:specs/framework/03-state-graph.md:259-262). | "Permission, not duty" (D-040): pending reaches the nearest `Loading` anywhere above. Only the root must be settled (D-099). |
| **Failures** | Untyped. `@catch (err)` handles anything, and handler errors go to "the nearest framework error boundary or app-level error hook" (ML:specs/framework/06-runtime-resumer.md:79-81). The hook is not specified. | Typed by class with a literal `kind` (D-034), branded at run time (D-087). `attempt`/`raise`. `Errored` with `catch: [A, B]` narrows the type (yield-library §1). `try/catch` is refused (D-077). |
| **Context / DI** | `shared()` with a scope, no provider, no orphan-provider errors (ML:specs/framework/03-state-graph.md:526-628). | Named contexts. A setup's read without a default is a *requirement* color, discharged by `Ctx.provide`. The root refuses leftovers (D-098). |
| **Compiler vs runtime** | Compiler-heavy and whole-app at bundle time. The runtime is tiny and staged by capability (ML:specs/framework/06-runtime-resumer.md:208-304). | Runtime interpreter (generators, proxy paths, `perform` per hole). The cost is 1–16% on the twins and 11–27% on synthetic workloads, plus 3.9–5.2 KB gzip (SY:documentation/yield-library.md §8, :248, :358). The compiler is "v0.2" (SY:documentation/calculus.md:573). |
| **Server/client** | One unified render/resume model. Server functions deferred (ML:specs/framework/08-deferred-decisions.md:156-188). No RSC. | Solid SSR and server functions. No server components (D-058). One route per app (D-074). |
| **Hydration** | None. A TreeWalker builds DOM locators into side tables. "Deliberately not VDOM recovery" (ML:specs/framework/05-resumability-payload.md:208-235). | Solid hydration: "every hydrated component runs" (SY:documentation/yield-library.md:245). Keys are 2 characters longer per nesting level (D-082). |
| **What is static** | Compiler diagnostics with stable codes, `why` text, a fix and a docs URL (ML:specs/framework/07-diagnostics.md). TypeScript types stay plain. The TS plugin is editor integration (ML:specs/framework/00-overview.md:170). `pnpm run typecheck` runs TypeScript over each `.tsrx` mapped to virtual TSX through Volar, plus the compiler's own parse errors (ML:packages/typescript-plugin/src/typecheck.ts:1-40). There are also typed routes (ML:specs/router/typed-routing.md). | TypeScript *is* the static semantics (SY:documentation/calculus.md:7). Plus a lint plugin (the reference says "eighteen rules" at SY:documentation/yield-library.md:13, and its §4 table lists 19), dev errors and transform refusals (SY:documentation/refusals.md). The formal soundness statement is D-071 (SY:documentation/calculus.md §4). |
| **Interop** | None needed or offered: markless owns the stack. Imperative code enters through `attach` and `onVisible` (ML:specs/framework/04-events-symbols-behaviors.md:76-182). | Explicit edges: `foreign(Comp)` for hand-offs (D-088), foreign tags (D-067), and `no-foreign-reactive` keeps plain Solid primitives out of routine code (yield-library §4). |

**The deepest structural difference: where colors live.**
- In markless, "this read may be pending" is a node attribute in the compiler's semantic graph. It is derived by a fixpoint and checked against the lexical position of the template read.
- In solid-yield it is a phantom type parameter that TypeScript folds through `yield*`.

Consequences:
1. **markless needs no annotations; solid-yield needs `Props<{ x: Source<T, E, true> }>` declarations** (D-068), and generics spread from forwarding components to the components that read them (D-029: 7 generic components across the 8 twins).
2. **solid-yield's colors cross component calls by construction** (D-062 exists precisely so they do). markless's boundary check reads `graph.templateReads` and resolves each against computed bindings (ML:packages/compiler/src/passes/semantic-graph/collect-async.ts:216-230).
   - **(inference, not tested)** A child reading a prop resolves to a `prop` binding, not a `computed`. So an async value passed as a prop and read outside a `@try` in the child may not be diagnosed. markless's own example passes an async computed into `<Profile user={user} />` *inside* a `@try` (ML:specs/framework/03-state-graph.md:204-210). I found no cross-edge test. The diagnostic is emitted only from that per-module pass: a grep for `ASYNC_BOUNDARY_REQUIRED` finds only `collect-async.ts`, `diagnostics.ts`, `artifacts.ts` and two compiler tests, and nothing in the link passes. The nearest guard is at run time: the analyzer's `MLA-I3-BOUNDARY-MISSING` (ML:packages/analyzer/README.md:30-35).
3. **markless has no failure colors at all.** solid-yield's failure algebra has no counterpart there.

**Shared instincts.** These are places where the two projects converged independently:
- **Snapshot before you wait.** markless's dependency key is the reads before the first `await`, and a later read is a compile error. solid-yield has `read-before-attempt` and `READ_AFTER_ATTEMPT`.
- **A boundary is the only status vocabulary.** markless has no `.pending` (ML:specs/framework/12-arm-rendering.md:125-129). solid-yield removed the `save.pending` source (D-075, reverted A1) and keeps only `Loading`/`Errored` plus `isPendingOf`.
- **Dependents of a pending value pend without running** (ML:specs/framework/03-state-graph.md:234-240). Solid's async memos do the same.
- **Escalation is never silent** (ML:specs/framework/12-arm-rendering.md:41-46) is close in spirit to D-071, "the types say exactly what the runtime does": anything the runtime does must be visible statically.
- **Owner-ruled design with recorded alternatives.** markless's specs carry dated "owner ruling" entries, with alternatives recorded inline in the decision drafts (ML:specs/framework/08-deferred-decisions.md:114-188). solid-yield has DECISIONS.md.
- **Honest comparisons against a reference implementation.**
  - markless's chained-async comparison runs the same endpoints, delays and values against TanStack Start. Its "Honesty rules" require that no lane gets cached data, and it asserts the final DOM plus the exact request timeline (ML:demos/chained-async-comparison/README.md).
  - solid-yield's twins and conformance harness compare against handwritten Solid with nothing normalized away (D-039, D-045, D-069).

---

## 3. What solid-yield should learn from markless

| # | markless idea or mechanism | What it would change in solid-yield | Decisions touched |
| --- | --- | --- | --- |
| L1 | **Measure *executed bytes per action*, not wall time.** markless budgets the JS that V8 coverage says executed at load and per action, separately from bytes fetched (ML:specs/framework/06-runtime-resumer.md:216-221, 278-304; ML:packages/analyzer/README.md "Coverage lane", `MLA-I5-*`). This is deterministic across machines. | D-017 kept performance out of the gate *because* wall-time budgets "would be noisy across machines". Executed bytes are not noisy. A gate step measuring the twins' executed bytes at load and per parity step, against their originals, would make the interpreter's cost (and later, v0.2's savings) a gated number. | D-017, D-037, §8 |
| L2 | **Check the server payload's claims against what the client actually registered.** `MLA-S2-PAYLOAD-WIRING` compares the event claims in the served payload with runtime registrations. `MLA-S3-LOCATOR-RESOLUTION` requires every server locator to resolve to exactly one node of the expected shape. `MLA-I1` checks console and page errors (ML:packages/analyzer/README.md:21-80). These run in real browsers and persist receipts. | solid-yield's `twins:hydrate-smoke` (gate step 36) hydrates 16 server renders in **jsdom** and fails on Solid's "Hydration key miss" or a dev error (SY:documentation/yield-gate-baseline.md:55-75). A claims-vs-registrations check is strictly stronger: it would catch a key that hydrates silently onto the wrong node. A real browser lane would bring back what D-037 dropped. | D-037, D-045, D-082, D-092 |
| L3 | **The capture rule as the static gate for splitting code.** An extracted closure may capture only graph references, element handles, props and shared references, imports, and serializable constants. Anything else is a compile error at the variable (ML:specs/framework/02-compiler-pipeline.md:215-233). Serializer tiers say exactly what crosses (ML:specs/framework/05-resumability-payload.md:12-47). | v0.2's "independently hydratable roots" and "server-derived logic in server components" both move values across a server/client or root/root edge. solid-yield's colors say nothing about *serializability*. Props are "a source, a hole or a settled value" (D-065); a settled value crossing a server-component edge must also be serializable. That is a new obligation, best stated now in the calculus (§7's "what the compiler route must preserve"). | D-065, D-042, D-071, D-058, calculus §7 |
| L4 | **Effects are what break laziness.** markless removed effects *because* push-based self-waking code is "exactly what breaks resumability" (ML:specs/framework/03-state-graph.md:96-99). Eager browser work goes through `onVisible` and `attach`, which are triggered (ML:specs/framework/04-events-symbols-behaviors.md:76-182). | Under v0.2, a root containing an `$effect` (or `$settled`) must hydrate eagerly. A root with only holes and bound events can wait for interaction. solid-yield already records `Create<"effect">` in each setup's yield union (SY:documentation/calculus.md:38), so "this root is eager" is computable from types today. | D-079, D-053, D-090, D-035 |
| L5 | **Abort superseded async runs.** markless passes an `AbortSignal` to every async computed and aborts on a key change (ML:specs/framework/03-state-graph.md:253-255). | D-080 lets a superseded `$memo` run to completion and asks users to "put no side effects after an await". Passing a signal to `attempt`'s `fn` (`attempt(({ signal }) => fetch(u, { signal }), onError)`) keeps D-080's semantics (the result is discarded) but stops the wasted work. It is additive, and in Solid's API terms needs nothing private. **(speculation:** whether Solid's async memo exposes a supersession hook through the public API is not checked; if it does not, the library can tie the signal to its own run-id check.) | D-080, D-064, D-004 |
| L6 | **One diagnostic shape across layers: what happened, why, what to change, where to read more.** Stable codes, a fix with before/after text, `markless.dev/errors/<CODE>`, and a catalogue CI checks for consistency (ML:specs/framework/07-diagnostics.md:5-87; ML:package.json:12-13). | Both reviews call solid-yield's messages the weakest DX point: brand messages inside 260-character unions, errors at `view(` rather than the line (SY:documentation/reviews/2026-10-05-claude.md:221-226; calculus T7/T8). solid-yield already has the codes, spread across four layers (SY:documentation/refusals.md). A generated catalogue (code → layer → why → fix → example), checked in the gate, is cheap. Some messages could also become `[CODE] … see <url>`. | D-054, D-089, D-093, calculus §6.2 T7–T8 |
| L7 | **Pending is shown structurally and by deadline, never by status reads.** `@pending` shows only past a first-flush or client deadline. Re-settles hold the prior snapshot until the deadline, with a minimum display time (ML:specs/framework/12-arm-rendering.md:121-152). | solid-yield's `no-unshown-wait` fires 7 times in the twins, and there is "no library form" for showing an in-flight event (SY:HANDOFF.md:160; D-075). markless's answer, that the boundary owns the wait and timing decides, is a principled alternative to adding a status source. Because D-081 makes an event a transaction, "the region the event writes into stays on its prior value until settle or deadline" fits the model. **(speculation:** it would need Solid's transitions or a library `Loading` policy.) | D-075, D-081, D-099 |
| L8 | **Escalation is never silent.** When the compiler cannot use a fine update and falls back to re-running component code, it must emit a diagnostic with a restructure suggestion (ML:specs/framework/12-arm-rendering.md:41-46). | For the v0.2 compiler: when a region cannot become its own root, or cannot move to the server, say so at the source, with the reason (a `Bind`, an `$effect`, an unserializable prop). That is D-071's meta-rule applied to the compiler. | D-071, calculus §7 |
| L9 | **CI that reproduces itself.** `pnpm ci:local` reads `ci.yml` and runs exactly its steps. A job missing from its classification table is an error. Lane skips are checked against content hashes, and the workflow checker is tested with mutations (ML:docs/ci-process.md:13-24; ML:triage.md). | solid-yield's review found that "a step that turns SKIP is not counted red" (SY:documentation/reviews/2026-10-05-claude.md "Process"; Codex "baseline policy can hide a disappearing check"). markless's rule that a skipped lane needs a matching content hash, otherwise it is not success, is the fix pattern. | D-008, D-037 |
| L10 | **Async waterfalls are a measured property.** The chained-async demo asserts the *exact request timeline* (parallel starts within 25 ms) against two TanStack lanes. It found that markless's own non-streaming SSR serialised sibling boundaries (ML:demos/chained-async-comparison/README.md). | A twin-level request-timeline assertion would pin when solid-yield's routines start async work (setup/memo order, D-084's holes-before-children server order) against the original. It is a sharper oracle than DOM parity for async scheduling. | D-084, D-069, D-045 |

---

## 4. What solid-yield does that markless lacks

| # | solid-yield | markless today |
| --- | --- | --- |
| S1 | **Typed failures.** Error classes with a literal `kind` (D-034), branded at run time so only typed failures reach handlers (D-087). `attempt` handlers absorb, transform or retry (D-076–D-078). `Errored catch: [A]` removes `A` from the type (yield-library §1). The root accepts a failing app and re-throws (D-033). | `@catch (err)` is untyped and catches everything. The "app-level error hook" is named but unspecified (ML:specs/framework/07-diagnostics.md:111-113; ML:specs/framework/06-runtime-resumer.md:79-81). No exhaustiveness. |
| S2 | **Colors cross component edges.** A component's view type carries its holes' pending, failures, may-wait and requirements. Props declare accepted colors, checked at each call (§6, D-068, D-029). A forgotten boundary is a type error at the root (D-099), and a foreign hand-off must handle its own failures (D-088). | Async-ness is a per-module compiler fact checked per template read. **(inference)** It is not carried through prop types, so a component's async/failure signature is not part of its API. |
| S3 | **A formal core.** λ-yield (SY:documentation/calculus.md) states syntax, typing rules, dynamic semantics and a soundness theorem (D-071), with 52 proof obligations traced to code and tests (11 unevidenced). It also lists known unsound corners (§6.2 T2, T4, T5) and implementation findings F-1–F-3 (§6.3, two fixed). | The specs are a behaviour contract (ML:README.md "Status"), but there is no formal semantics and no stated theorem. The checks are diagnostics plus tests. |
| S4 | **Event transactions and optimistic writes.** Writes before a wait are held until settle; `$optimistic`/`$optimisticStore` show at once and revert (D-020, D-081, D-014). | "Errors do not roll back graph writes" (ML:specs/framework/06-runtime-resumer.md:79-81). Writable or optimistic computed is deferred (ML:specs/framework/08-deferred-decisions.md:19). |
| S5 | **Context requirements as a static check** (D-098): a missing provider is `[NO_PROVIDER]` at `render`, naming the context. | `shared()` removes providers entirely (ML:specs/framework/03-state-graph.md:528-619). This is a different trade-off, not an absence. There is nothing to check, but nothing models "this subtree assumes a session" either. |
| S6 | **Conformance against an independent oracle.** 12 scenarios in handwritten Solid versus the dialect, client/server/hydrate, trace by trace. Every difference is declared, nothing is normalized away, and mutants plant regressions (D-039, D-069). There are 8 parity twins against vendored originals (D-045). | Strong browser and invariant testing and benchmarks against other frameworks, but no second implementation of the *same* semantics to compare traces with. **(inference** from the tree layout; the closest thing is the jsfb benchmark and the TanStack comparison lanes.) |
| S7 | **Rides an ecosystem.** Solid's router, Solid's SSR and streaming, server functions, published RC drift as a canary (D-016, D-045). The no-JSX `h` flavor needs no build at all (D-012, D-046). | Owns language, compiler, bundler, router and runtime. Server functions are deferred (ML:specs/framework/08-deferred-decisions.md:23). Using it requires TSRX. |
| S8 | **The append-only decision log** (99 entries, alternatives and reasoning, amendments as new entries) plus a per-checkpoint HANDOFF. | Specs carry owner rulings inline (e.g. ML:specs/framework/12-arm-rendering.md:89, :121). The design thread is archived (ML:specs/framework/archive/design-thread.md), but there is no indexed decision log, and the progress ledger it references is missing (`specs/state.md`). |
| S9 | **Effects exist and are typed** (D-079 split compute/effect; D-073 an effect's raise joins its component's failures). | By design there are none (ML:specs/framework/03-state-graph.md:94). That is a strength for resumability, and a gap for code that must react to state it doesn't own ("deliberately unsupported", :120). |

---

## 5. Risks and opportunities in the frame of solid-yield's v0.2 compiler

The plan, as given: (a) split client logic into **independently hydratable roots**; (b) move **server-derived logic into server components**. Its anchors in the tree:
- D-058: "a future compiler finds inert regions and turns them into server components automatically, so the user never thinks about it".
- yield-library §7: no islands, no server components, no runtime tiers (SY:documentation/yield-library.md:243-247).
- calculus §7: what the compiler must preserve (SY:documentation/calculus.md:571-580).

### Where markless *informs* the plan

1. **Inertness can be found by demand analysis, not by marking components.** markless never asks "is this a server component". A component body runs on the server only, and what ships is just the symbols reachable from a trigger: handler chains, DOM updates of written paths, and async runs a visible boundary demands (ML:specs/framework/06-runtime-resumer.md:161-165, 237-245). That is D-058's "the user never thinks about it", already working. For solid-yield the inputs are already in the types:
   - `Bind` ops: which views are interactive.
   - `Write` ops and `Create<"signal"|"store"|…>`: which state can change.
   - `Create<"effect">`: which code is eager.
   - `P`: which regions need async data.

   The Claude review states the same point: "Inertness is already in the types" (SY:documentation/reviews/2026-10-05-claude.md:245).
2. **solid-yield's strictness is close to a resumability-ready shape.** markless's compiler has to *discover* a set of extraction kinds: handlers, behaviors, computed bodies, async runs, DOM updates, and component bodies (ML:specs/framework/02-compiler-pipeline.md:199-213). solid-yield's host table already *names* each of them, and D-042, D-032 and D-021 already make the user separate them:
   - setup / view / hole / memo / effect phase / event / row (SY:documentation/calculus.md §1.3)
   - setup creates and never reads (D-042)
   - a view is holes only (D-032)
   - writes happen only in events and effect phases (D-021)

   **(speculation)** A v0.2 compiler could lower solid-yield code to resumable symbols more easily than markless lowers plain JS, because the routine boundaries markless infers are explicit here.
3. **The colors give per-root manifests for free.**
   - `P` tells which roots need serialized async snapshots: markless serializes "async snapshots (id, key, version, status, value or error) so that resume doesn't refetch" (ML:specs/framework/05-resumability-payload.md:79-100).
   - `R` (requirements) tells which contexts a root needs at its edge. A hydratable root's requirements must be serialized or re-provided there, the same discharge rule as D-098 at a new edge.
   - `E` tells which roots need an `Errored` at their edge, the same rule as D-088's `foreign()`.
4. **The analyzer-style checks (L2) are what make split roots safe to ship.** Each root's server markup must claim exactly what its client registers.

### Where markless *contradicts* the plan

1. **Islands are not markless's unit, and hydration is not its mechanism.**
   - "A parent rendering a child component does not mean the child owns a separate resumable island by default. The normal result is one container with one composed payload" (ML:specs/framework/10-render-architecture.md:292-295).
   - Containers are islands only for microfrontends (ML:specs/framework/00-overview.md:127-132).
   - markless forbids re-running components over server HTML (ML:specs/framework/12-arm-rendering.md:36-39). "Independently hydratable roots" still re-run each root's setup and view on the client, so they sit *between* Solid's hydration and markless's resumption.

   The risk is that v0.2 pays for root splitting (payload per root, key schemes, root-edge typing) and still runs every interactive root's setup at load. markless's position is that the right unit is the *handler*, not the *root*.
2. **Server components are not markless's answer for server-derived data.** markless keeps async results on the client as serialized snapshots. They are not refetched on resume, and they can be revalidated client-side when keys change (ML:specs/framework/02-compiler-pipeline.md:249-253; ML:specs/framework/03-state-graph.md:267-270). Moving server-derived logic into server components removes the code, but then a key change requires a server round trip. markless's `MARKLESS_SERVER_DERIVE_UNREACHABLE` (ML:packages/compiler/src/passes/public-render/diagnostics.ts:279-299) shows the edge case it hit: a computed the server reaches but cannot derive. The trade-off is "ship the run function and revalidate locally" (markless) against "ship nothing and round-trip" (RSC), and v0.2 should decide it per region.
3. **Effects.** markless's founding argument against effects (ML:specs/framework/03-state-graph.md:96-99) implies that any root containing an `$effect` cannot be lazy. solid-yield keeps effects (D-079). The plan has to say what an effect does to a root: hydrate eagerly, or run on the server only, or be refused in lazy roots.
4. **Leaving Solid's client.** True resumability needs a client runtime that is not Solid's hydration. D-069 F6 already says "a future compiler route either adopts Solid's owner numbering or ships its own client". Hydratable roots on Solid keep D-004 intact. Resumability would not.

### Net

markless does not contradict v0.2's direction: find inert regions by compiler analysis, ship less. It contradicts v0.2's **granularity**, roots and server components, and suggests going one level finer: handlers and DOM updates, with async snapshots serialized. Whether that is reachable while staying on Solid's runtime is the real v0.2 question. **(speculation:** it probably is not without a solid-yield client runtime.)

---

## 6. Verdict and three questions for Dev

**Verdict: complements.** They are not competitors in practice:
- solid-yield's audience is Dev designing a model (D-002). Its product is the strict dialect plus a calculus, on Solid.
- markless is a full, self-hosted framework with its own language and a release train (0.5.0).

They are complementary in substance:
- markless is a measured existence proof for the compiler and runtime half of v0.2: demand-driven shipping, no hydration, executed-bytes budgets, payload/registration checks.
- solid-yield has the type-system half markless lacks: typed failures, colors across component edges, context requirements, and a soundness statement.

They overlap directly on one rule. "An async read needs a boundary, and reads after a wait are not tracked" is enforced by markless's compiler and by solid-yield's types and lint. They take opposite routes, and both work. Nothing in either tree is in conflict with the other, beyond the granularity disagreement in §5.

### Q1. What does v0.2 split the app into?

- **A. Hydratable roots on Solid's hydration** (the plan as written). This keeps D-004 and Solid's client, but each interactive root still runs its setup at load.
- **B. Resumable handlers and DOM updates, markless-style.** No hydration and the least JavaScript at load. It needs solid-yield's own client runtime, which leaves D-004 for the compiler route.
- **C. Roots first, under resumability-ready rules.** Ship A, but make the compiler enforce from day one the obligations B would need: a serializability (capture) rule at root edges (L3), effects marking a root eager (L4), and per-root payload claims checked in the gate (L2).

**Recommendation: C.** It delivers on Solid now, keeps D-004 for v0.2, and does not close the door on B. The obligations that cost the most to add later (what may cross an edge, what makes a root eager) get fixed while there are still only 8 twins to migrate.

### Q2. What does an `$effect` do to a split root?

- **A. Nothing special.** Every root hydrates eagerly.
- **B. A root whose setup has `Create<"effect">` or `Create<"settled">` hydrates eagerly, and other roots wait for interaction or visibility.** Expose this as a marker in the types, like may-wait (D-075), and as an "escalation is never silent" diagnostic (L8).
- **C. Move to markless's model.** Remove `$effect` in favour of triggered behaviors (`onVisible`/`attach`-like) and events.

**Recommendation: B.** It keeps D-079's semantics, which the twins rely on (31 sites were migrated to the split form, SY:HANDOFF.md:138). It uses facts the types already hold. And it makes the cost of an effect visible exactly where v0.2 pays for it. C is worth revisiting only if the eager-root counts across the twins turn out high.

### Q3. Should the gate measure what v0.2 is meant to save?

- **A. Keep D-017**: no performance in the gate, and run the manual wall-time harness.
- **B. Amend D-017.** Add executed-bytes-at-load and per-parity-step budgets for each twin against its original. Use V8 coverage, as markless's analyzer does (L1), because it is deterministic across machines.
- **C. B, plus a payload/registration check** on the hydrate smoke (L2) and a real-browser lane (amending D-037).

**Recommendation: C.** D-017's stated reason, noise across machines, does not apply to executed bytes. And v0.2's whole claim is "less code runs". Without this gate that claim, and every root-splitting change, would rest on manual measurement, which D-017 itself shows can silently measure nothing (the Phase 4 workloads "timed a list that never grew").

---

### Appendix: what I read

**solid-yield:**
- `README.md`
- `HANDOFF.md` (whole)
- `documentation/yield-library.md` (whole)
- `documentation/calculus.md` §1, §6, §7
- `documentation/DECISIONS.md`: index, D-001–D-009, D-016–D-017, D-023–D-024, D-037–D-039, D-056–D-071, D-099
- `documentation/getting-started.md` (rules table and first program)
- the two reviews' process and compiler-route sections
- `documentation/yield-gate-baseline.md` (hydrate smoke)
- package and test inventory: about 200 `it`/`test` blocks, ~139 `@ts-expect-error` type assertions, RuleTester tables, 12 conformance scenarios

**markless:**
- `README.md`, `CHANGELOG.md` (headings and 0.5.0)
- `specs/framework/00`, `02` (pipeline and capture), `03` (state, async, shared), `04` (events and sync policy), `06` (resumer and progressive execution), `07` (diagnostics), `08` (deferred), `10` (composition), `12` (arm rendering)
- a delegated full read of all specs, with its citations spot-checked against the files above
- `packages/core/src/framework-api.ts` and `index.ts`
- `packages/compiler/src/passes/semantic-graph/{collect-async,diagnostics}.ts` and their test
- `packages/analyzer/README.md`
- `docs/ci-process.md`, `triage.md`
- `demos/async-waterfall`, `demos/chained-async-comparison`

**Not verified:**
- the markless test count beyond a grep
- cross-component async-boundary behaviour in markless (flagged as inference in §2 and §4)
- markless's full commit history (shallow clone)
