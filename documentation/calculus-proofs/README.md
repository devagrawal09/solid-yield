# Proofs of the λ-yield core

Audited source: `1da4d8218e5cebadba3387a43542b61c310607fb`, including D-102.
The status line and some rules in [the calculus](../calculus.md) describe older revisions.
No library code is changed here.

**Merged into main (2026-10-07).** This is the historical audit of the revision
above: **12 mechanized obligations / 26 paper proofs / 14 unprovable as worded**.
Main's later repairs supersede some findings. The runtime probes now supply the
required context names and expect frozen failures to be absorbed; their old
static witnesses are refused by main's repaired types. The historical
classifications are unchanged. See [verification.md](verification.md)
for the integration results and the original branch record.

**Native inference audit (2026-10-08, D-116).** [inference.md](inference.md)
re-reads all 52 obligations and all 15 paper lemmas against class-based throw
inference: 25 obligations held, 25 restated, 2 failed as native wording.
It specifies subclass coverage, unknown as top, recursive upper bounds and
safe catch removal. The additional `Yield.Inference` Lean namespace checks
those abstract failure rules; it does not verify the native compiler or wire
matching. Findings F16–F21 record the remaining premises and counterexamples.

**Sugar mode (2026-10-10).** [sugar.md](sugar.md) states the obligations the
native lowering adds: writes and event-phase hosting, setters in plain function
types, context hooks, props carrying their callers' colors (D-119), foreign
routers (F-S43), context members (F-S45), array-callback colors (F-S46),
requirements through generic wrappers (F-S49) and effect cleanup (F-S42).
[SugarProofs.lean](lean/SugarProofs.lean) proves them on top of `YieldProofs`,
each with a counterexample for the rejected alternative. They are **not yet
machine-checked**: this session's network policy refused the Lean toolchain
download. Run `lake build` in `lean/` to check them.

**Result:** the abstract effect/owner calculus has checked preservation, discharge,
and root-safety proofs. The theorem about **every TypeScript-accepted admissible
program** in calculus §4 is false as written. [Findings](findings.md) give small
counterexamples; [obligations](obligations.md) classifies all O1–O52. These are
findings for Dev to rule on, not proposed changes to the dialect.

## What is proved

[YieldProofs.lean](lean/YieldProofs.lean), checked by Lean 4.24.0 using only `Std`, proves:

- The four color components form a lattice, with union as join, intersection
  as meet, bottom below every color, and widening preserving safety.
- The operation vocabulary and each host's admission judgment; existential
  folds over operation unions; the separation of data-pending, async work,
  and the bind's may-wait marker; `Created` and `Settle` as requirement maps.
- Primitive/routine preservation, then preservation by induction over owner
  scopes. Each observation escaping a scope is allowed by its static color.
- Exact filtering of observations by `Loading`, selective or catch-all
  `Errored`, and a provider. Fallbacks sit outside their own boundary.
- Nearest matching ancestor routing, including an excluding `catch`;
  owner-tree paths connected to the syntactic tree by `Located`.
- Root safety for arbitrary finite schedules of abstract observations:
  pending and missing requirements cannot escape; an escaping failure is in
  the root's failure color. A failure-free position cannot leak a failure.
- The foreign-edge context result **with an actual-provider premise**.
  Listing a context installs no owner or provider. Pending at a foreign edge
  additionally needs a surrounding loading contract (`foreign_pending`);
  P-FOREIGN explains the runtime environment premise.

The important theorem names are `routine_preservation`, `preservation`,
`owner_preservation`, `discharge`, `route_nearest`, `execution_root`,
`settled_no_failure`, and `foreign_context`. `#print axioms` at the end reports
only Lean's standard logical axioms (`propext`, `Classical.choice`, `Quot.sound`),
with no project axioms or unfinished proof terms.

## What the mechanization means

`Color = Effect → Prop` is a powerset representation of the quadruple:
`pending`, `failure k`, `marker`, and `need q` are its four disjoint projections.
`parts` reconstructs the quadruple. Pending/marker propositions are two-point
permissions; they do not count suspensions. Failure/context identifiers are
natural numbers. Primitive sets are finite lists; arbitrary predicate colors
also admit widened interfaces. No proof relies on finiteness. Equality of
these identifiers models true class/context identity, not TypeScript's
structural approximation to it.

For D-116, the separate `Yield.Inference` model instead uses value predicates
and an explicit class relation. It admits unknown as the universal set and
subclass inclusion. Its connection to the older owner model remains the
P-STATE simulation premise; see [inference.md](inference.md#mechanization-and-limits).

`WellHosted H Y` is `∀ o ∈ Y, Admits H o`. It models only the yield-union check,
not JavaScript purity, positions inside JSX, order of operations, or whether
arbitrary callbacks secretly perform work. `Fires` specifies the observable
primitive steps. In particular, a source with `p = false` cannot emit pending
**in this model**; proving that a real source declared settled has that property
is a separate implementation obligation, invalidated in general by the probes.
`Fires.child` is an explicitly assumed interface for a separately checked child;
it is not evidence that every TypeScript `View` meets that interface.

`Term` has operations, union composition, and owner scopes. The derived
`loading`, `errored`, and `provide` constructors implement the discharge rules.
`both` allows an observation from either branch, including a fallback that may
never be reached in a concrete program. Thus exact discharge means “this filter
removes exactly the events it handles,” **not** “every static color has a
concrete execution.” The latter claim is refuted by F01.

An ancestor list is a zipper of an owner tree: nearest frame first. `Located`
constructs that path from `Term`; a scope appends an outer frame. Ordinary owners
pass everything. Provider frames represent a provider holding a non-unset value.
Read-site, bind-site, and creation-site routing have separate saved paths in
`Sites`; their three definitional lemmas document the choice of origin. Connecting
those paths to the TypeScript runtime is paper lemma P-SITES, not a kernel proof
of `getOwner()` or `runWithOwner()`.

`Tick` chooses one located primitive observation or stutters; `Execution` allows
any finite sequence. It abstracts promise order, event order, repeated renders,
and loops. Safety for an infinite execution means safety of every finite prefix.
It does **not** prove termination, fairness, DOM content, hydration, transaction
isolation, cancellation, or that an owner survives disposal. It contains no JS
heap or source-state machine. P-STATE spells out the separate simulation invariant
needed to use this abstraction for an actual runtime execution.

`Created` obligations cannot be discharged by the provider constructed in the
same expression. `provider_created` proves this. Moving those obligations to a
surrounding component by `Settle` is a paper staging step; arbitrary movement of
owners is not permitted by `Located`. In particular, early context or effect work
must not be retroactively moved beneath a later boundary.

## Paper proof plan and completed derivations

[paper.md](paper.md) gives explicit inference rules and case proofs for:

| Lemma      | Work covered                                                             |
| ---------- | ------------------------------------------------------------------------ |
| P-STATE    | Source/environment invariant, host runs, finite-prefix simulation        |
| P-FOLD     | Union folds, event flags, hole return and `never` cases                  |
| P-HOST     | Admission, view-position lint, pure compute, cleanup and stream hosts    |
| P-COMP     | Component, hole props, return colors, rows and flows                     |
| P-MEMO     | Memo source invariant, seeded values, superseded runs                    |
| P-SITES    | Read/bind/creation origins; effects outside a component's view           |
| P-BOUND    | Loading/on, selective errors, fallback scope and provider scope          |
| P-ATTEMPT  | Handling, delegation, transforms, stream termination, brand precondition |
| P-EVENT    | Bound versus handled calls and independent action records                |
| P-CONTEXT  | Provider values, context identity, defaults, `Created` staging           |
| P-ROOT     | Root/element judgments, every position, arbitrary finite prefixes        |
| P-FOREIGN  | D-102 actual environment contract; pending across foreign code           |
| P-LAZY     | ChunkError and client/server routes                                      |
| P-ONCE     | Empty-compute effect timing and disposal                                 |
| P-ENCODING | Exact scope of TypeScript checks, failure identity, compiler obligation  |

These are **relative proofs**. They state their premises, including premises
that the current implementation does not establish for all well-typed programs.
A row marked “unprovable as stated” in the mapping is not rescued by silently
adding such a premise. Model proofs remain useful for a repaired encoding or a
compiler that proves the missing correspondence.

## Trust boundary: Solid

The following are assumptions, not Lean axioms and not proved by tests. They are
exactly the external behavior relied on in calculus §3.6, separated by role:

| Assumption | Use                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1         | Owner parentage; current-owner context lookup; owner-based propagation. P-SITES connects this to the path model.                                           |
| S2         | A pending read throws `NotReadyError` at its reader; a render effect uses the nearest Loading; a memo transports pending to its readers.                   |
| S3         | Error propagation, memo error caching/rethrow, and fallbacks outside their own boundary.                                                                   |
| S4         | Unhandled synchronous/computation errors rethrow, possibly with the original as `cause`. Events and lazy imports have the explicit different routes below. |
| S5         | Compute pending waits silently; the error arm prevents logging-and-dropping; the effect phase is untracked and its errors go above its owner.              |
| S6         | An action runs to its first yield, holds ordinary writes until settlement, and a nested action joins its transaction.                                      |
| S7         | Promise-returning memos pend; only the latest run's promise lands.                                                                                         |
| S8         | Loading's `on` is read beside the boundary, with its pending absorbed by that boundary. This does not imply that its fallback becomes visible.             |
| S9         | Retired; no `onSettled` premise is used. D-101 removed `$settled`.                                                                                         |
| S10        | `createComponent`/`untrack` do not subscribe the creating computation to the untracked work.                                                               |
| S11        | A provider supplies descendants; undefined is unset, with default lookup before missing-context failure.                                                   |
| S12        | Hydration keys/order, server hole evaluation and pending-first-read retry. Only P-LAZY/P-ENCODING use server-specific claims.                              |
| S13        | A list row is owned by the mapping under its list and keyed rows persist with their items.                                                                 |

S1–S13 alone do not specify seeded memo behavior or the once-after-render timing
of an empty-compute effect. P-MEMO and P-ONCE name these additional contracts;
O14's tests evidence one, not a universal proof. Reports to a disposed bind owner
are also not modeled; P-EVENT proves the route when Solid creates the report
computation, not eventual display after disposal. A compiler refinement needs
these contracts specified if it claims the stronger behavioral obligations.

## Reproduce

From this worktree's root, after its dependencies are installed:

```sh
cd documentation/calculus-proofs/lean
ELAN_HOME=/private/tmp/elan /private/tmp/elan/bin/lake build
```

`lean-toolchain` pins 4.24.0. No mathlib/download is needed once Lean is installed.
`lake-manifest.json` has no packages. Tooling was installed in the foreground
using elan with `ELAN_HOME=/private/tmp/elan` and `--no-modify-path`; HOME and its
configuration were not changed. Neither Lean, Lake, Agda nor Coq was initially on
PATH. The toolchain became usable within the 20-minute tooling budget.

From the worktree root:

```sh
pnpm proofs # optional Lean build plus runtime probes; skips without Lake
node node_modules/vitest/vitest.mjs run --config documentation/calculus-proofs/probes/vite.config.mjs
PROOF_PRODUCTION=1 node node_modules/vitest/vitest.mjs run --config documentation/calculus-proofs/probes/vite.config.mjs
pnpm build
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

The historical probes deliberately asserted bad behavior; main now expects the
repaired frozen-failure absorption. The report-only `proofs` gate step runs the
Lean build and runtime probes without coverage thresholds. Lake lookup is `$LAKE`,
then PATH, then `/private/tmp/elan/bin/lake` with `ELAN_HOME=/private/tmp/elan`. If
none is available, the optional step reports SKIP and an elan install hint without
failing the gate. The toolchain file pins `leanprover/lean4:v4.24.0`. The production probe switches the library's `__DEV__` flag off, while
using Solid's development client build in both runs, as specified by its config;
it is not an SSR test or a minified distribution test. No probe changes the
library. The optional generated-program/fast-check suite was not added: random
examples cannot establish the missing TypeScript refinement, and deterministic
counterexamples already refute it.

To reproduce the original successful TypeScript and lint checks, use branch
commit `950a71b`; they are historical evidence, not current main checks.
See [verification.md](verification.md) for both records.
