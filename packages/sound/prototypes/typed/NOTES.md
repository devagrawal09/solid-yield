# Prototype A — typed annotations: notes

## Design

TypeScript stays the checker. transform.mjs rewrites each file, in memory, into calls
of the virtual module `solid-sound-typed` (runtime.d.ts); a second LanguageService
type-checks the virtual program; the errors carry a `__CODE__` marker that index.mjs
maps to a solid-sound code and back to the original position (Output pieces).

- **Phantom types**: `Src<T, P, E>` (an accessor with pending / failure colors),
  `View<P, E>` (a rendered view and what it still carries), `Worst` (an unanalyzed
  value; members are `any` so the user's code keeps checking), `Fails<E>` (a failure
  set computed by the pre-pass and carried as a string-literal union type).
- **Syntactic scope**: setup reads become `__s.setupRead(src)` (error through
  `SetupReadable`), JSX becomes `host/el/loading/errored/flow/views` calls, JSX
  expression containers become `track(() => e, [deps], fails)`, memos become
  `memo(fn, [deps], fails)`, effects `effect(compute, [deps], fn, [deps], fails)`,
  event attributes `handler(fn, fails)`, roots `render / renderComponent / handoff`.
  **Dependency lists** are extracted syntactically (identifiers bound to sources /
  worst values, transitively through sync helpers, getters and IIFEs); TypeScript
  folds their colors (`PendingOf`, `FailsOf`) into views and up to the root.
- **Two pre-passes** supply what types cannot express: (1) failure sets — TypeScript has
  no throw types, so `failuresOf()` computes them (throws, awaited rejections,
  promise chains, unknown callees, callback props' callers) and hands them to the
  types; (2) which props are **reactive** — TypeScript checks a component body once,
  not per caller, so the callers are scanned and reactive props read in setup become
  `setupRead(propSrc(props.x))`. A prop's pending / failure colors are carried on the
  **caller's** side (`el(Comp, props, propViews)`): the caller's boundaries cover
  them (D-119's reading), the child never sees them.
- Non-type diagnostics (partial-check warnings, setter writes in owned scopes) are
  emitted by the transform directly.

## Subset vs SLICE.md

Supported: signals, memos (async too), effects, props (reactive classification from
callers, callback props with forwarding), Loading / Errored / Show / For, handlers
with the failure pre-pass, timers (`checked`), setup failures, hand-offs, exported
components (info from the virtual program's inferred `View` type). Partial: a
worst-case member stored in its own variable loses the color (it is `any`); recursive
components' views are `any` to TypeScript (one false positive at the root of
recursion-failing-prop); keyed-For items and render-callback parameters are `any`.
Not modeled: everything B does not model, plus anything the virtual program cannot
type (an unclassified TypeScript error becomes an UNANALYZED_BOUNDARY warning with
`data.unclassified` — 0 on the slice after switching `noImplicitAny` off in the
virtual program).

## Where the typed IR is weaker, by construction

- **Location**: pending / failure obligations surface where TypeScript checks them —
  the `render` / hand-off argument — not at the read (13 of 51 expectations are
  located imprecisely; B locates all 51 at the read, with the root as related
  information).
- **Failure sets and prop reactivity need a dataflow pre-pass anyway**; the type
  system only propagates them. The pre-pass is ~40 % of transform.mjs and duplicates a
  subset of B's logic less precisely (no interprocedural value flow: `failuresOf`
  cannot see that a value stored in a variable is a kept promise beyond one
  declaration).
- **Prop expression failures** are attributed to the caller's view (one extra error on
  m-injected-api-prop at the root) where B attributes them to the child's read.
- **Two programs** are held (original for resolution, virtual for checking): about 2×
  B's cold time and 4–5× its incremental time.
- **Fragility**: a construct the virtual encoding cannot type is a warning, not a
  refusal, but it is a warning about the checker, not about the program.

## Disputed expectations

None. The imprecise anchors (`atRoot` / `root`) were added to the fixtures so that a
root-located report counts as a hit *and* is counted separately.

## Numbers (results/latest.md, 3 runs)

51/51 expected errors, 13 imprecise, 0 soundness failures, 2 extra errors
(recursion-failing-prop: recursive view is `any` → worst case; m-injected-api-prop:
caller-side attribution), 12/12 warnings, 0 extra warnings, 5/5 info; cold: cases
11.3 s, Equipment 310 ms; incremental 103 / 110 ms. Vite: build 29 → 345 ms with the
plugin (check 309 ms); HMR re-check 88 ms.

## Emit-readiness

The virtual program's types tell, per component, whether its view is pending /
failing (`View<P, E>` on the inferred return type — the info diagnostic reads it
that way) and, per memo, its colors. They do not keep **which read** carries a color,
nor scopes per read beyond the syntactic transform's own tables (which are not an
exported IR). Driving an optimized emit would mean exporting the transform's
dependency lists and scope decisions — at which point the IR is the pre-pass, not the
types.
