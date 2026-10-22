# Typed annotations (A) vs own dataflow analysis (B) — the evidence

Measured on 2026-10-22 with `node harness/run.mjs --runs 3` and
`node harness/vite-measure.mjs <p> --runs 3` (Node 24, TypeScript 6.0.3, solid-js /
@solidjs/web 2.0.0-rc.17, Apple silicon). Selection criteria are the user's; this
file only reports.

## The shared slice

68 fixtures: 52 cases copied byte-identically from `scripts/native/fixtures.mjs` and
the legacy `native-paths` / `native-forms` test tables, the Equipment Checkout app
(10 files, byte-identical; `EquipmentRow.tsx` is the HMR-timed component), 15
negative mutants (a boundary or a catch deleted, a read moved into setup, a setter in
a memo, a reactive prop read in setup, pending through a prop, an effect function
reading an async memo, injected APIs with platform-sounding method names). 51 expected
errors, 12 expected partial-check warnings, 5 expected info findings.

## Per criterion

| criterion | A — typed | B — dataflow |
|---|---|---|
| expected errors hit | 51 / 51 | 51 / 51 |
| located at the read (vs. at the root / hand-off) | 38 precise, **13 imprecise** | 51 precise |
| soundness failures (in-subset misses) | 0 | 0 |
| mutants missed | 0 / 15 | 0 / 15 |
| extra errors | 2 (recursive component's view is `any` → worst case at the root; prop-expression failure attributed to the caller's root) | 0 |
| expected partial-check warnings | 12 / 12 | 12 / 12 |
| extra warnings | 0 (was 13 unclassified TypeScript errors before `noImplicitAny` was switched off in the virtual program) | 0 |
| info (exported components' colors) | 5 / 5 | 5 / 5 |
| generated-code leakage in messages | 0 | 0 |
| unmapped locations | 0 | 0 |
| messages | plain language from a per-code template; the construct is the text at the mapped position; failure sets parsed from the TS message | plain language naming the source, the scope, the failure set and the reason (`service.reload() has no failure information`); owner path `<App> › <Inventory> › <EquipmentRow>`; related location at the root |
| agreement with today's checker on the cases | both agree with today's 20 flagged cases (codes mapped); both add the slice's worst-case findings on out-of-subset cases | same |
| Equipment Checkout errors | 18 (today: 10; see fixtures/equipment/EXPECTATION.md: +8 from the worst-case service, +1 real hole today misses, −1 false positive) | 18 |
| cold check, 52 cases (fresh program each) | 11.3 s (≈ 215 ms / case) | 5.4 s (≈ 105 ms / case) |
| cold check, Equipment app | 310 ms | 131 ms |
| incremental, EquipmentRow trivial / semantic edit | 103 / 110 ms | 24 / 21 ms |
| Vite `build`, Equipment: plain → with plugin (check share) | 29 → 345 ms (309 ms) | 32 → 149 ms (144 ms) |
| Vite dev: HMR re-check of EquipmentRow.tsx | 88 ms | 23 ms |
| strict build fails on errors / report-only completes / warnings never fail | yes / yes / yes | yes / yes / yes |
| subset coverage | SLICE.md "inside" fully, with the pre-passes; worst-case member stored in a variable loses its color; recursive components need annotations | SLICE.md "inside" fully; path-insensitive closures |
| facts for an optimized emit | the inferred `View<P, E>` per component / memo; which read carries a color is not in the types — it is in the transform's syntactic tables | per component: reads with scope and source, sources with colors, boundaries, pending / failure summary with owner path, callback-prop failure sets, unanalyzed constructs (`ComponentFacts`) |

## What each approach cannot do (honest list)

**A — typed.** TypeScript has no throw types and checks a component body once, so
failure sets and per-caller prop reactivity come from a syntactic pre-pass that is a
less precise copy of B's logic; the type system only propagates colors. Obligations
surface where TypeScript checks them (`render`, the hand-off), not at the read.
Recursive components give `any` views (worst case, a false positive). A construct the
encoding cannot type yields a warning about the checker, not the program. Two
programs are held, hence 2× cold and 4–5× incremental time. The virtual program must
run with `noImplicitAny` off (worst-case members are `any`).

**B — dataflow.** Path-insensitive: closures see the last binding of free variables;
conditionals and loops are unions. A callable hidden in a data structure is unknown
(reported, not missed). Reads of pending values inside handlers are not reported by
decision (rc.17 serves the stale value). No per-file IR cache yet (whole analysis
reruns on the reused program; 20–25 ms on the Equipment app).

**Both.** Context / services are the next area: every `useContext` is a warning and
its value the worst case, which is where 8 of the 18 Equipment errors come from.
`latest` / `isPending`, stores, refs, spreads, `createSignal(fn)` are outside the
slice (warn + worst case).

## Review finding (b2dfebf) — before / after

Platform contracts were keyed by method name alone, so an injected object's
`api.get()` / `api.set()` was failure-free. Fixed in both prototypes: the tables
apply only to callees declared in a TypeScript default lib (and `Promise` / `JSON`
only when they are the lib globals). Two mutants were added (`m-injected-api-ambient`:
six handlers, `m-injected-api-prop`: three). On the pre-fix b2dfebf code,
`m-injected-api-ambient` **crashed** (scored as every expectation missed) and
`m-injected-api-prop` was already reported through a different path (its API comes
from an unknown-bodied `createApi()`); after the fix both report 6/6 and 3/3. The
Equipment Checkout count did not change (18 before, 18 after): its service is the
worst case through `useContext`, which never reached the name tables.
