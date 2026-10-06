# Compiler prototype findings and remaining work

Branch: `proto/compiler`, started at `1da4d82`. This is a partial implementation.
No compiled twin, compiler-route parity result, or compiler-route conformance
result is claimed. A separate public-API spike verifies immediate root claims
and records a failed delayed claim (F-C5 below). No counterexample to calculus
§4.3 has been established. C2 is stopped at the
public-API spike: C0 §3.1 explicitly says a failed claim is a finding and “C2
waits for Dev”. The library runtime was not changed to hide the failure.

The [per-twin C1 table](compiler-c1-report.md) contains candidate root sizes,
merge counts, named leaks, capture candidates and each effect's reach. The
[byte tables](compiler-benchmarks.md) contain load and every named parity step,
plus shipped JS and gzip bytes. Both state their actual measurement definitions.

## Implemented

- `foreignSource(accessor): Source<T, unknown, boolean>`. Its getter is read only
  through `yield* attempt(() => source, cause => new KindedError(cause))`. The
  attempt keeps tracking and pending, and brands mapped failures. The original
  accessor is not mutated. Bare reads fail in every build. Type tests require a
  kinded failure mapper, and the lint permits foreign primitives referenced only
  inside an accessor passed to the imported bridge (aliases work; shadowing does
  not grant permission).
- A private analysis package, with a Vite pre-pass that emits no code. It resolves
  import bindings, builds monotone provenance equations, computes connected
  groups, and reports effects, unknown sources and candidate capture failures.
  The CLI visits all eight twins through Vite's resolver. The report explicitly
  describes its reduced precision and unresolved spans. It is not yet complete C1.
- Inspector precise coverage over the existing parity scripts, plus production
  client chunk sizes. The benchmark document describes the measured scope and
  the baseline allowance. Compiler columns explicitly say not built.

## Validation and limits

The full gate has 42 passing steps after `pnpm build`. This includes the eight
twins' existing parity tests, the library's SSR and hydration smoke lanes, and
the existing 12-scenario conformance harness. It also includes 25 small analysis
fixtures, the eight source-graph reports, both namespace-spike schedules, three
coverage-counter fixtures, and all 16 original/library byte runs. The byte
baseline was also checked in a separate repeat run.

These are **library-route** parity/conformance results. The existing conformance
harness's frozen compiler oracle predates this prototype and is not evidence of
C2 output. F-C5's delayed schedule passes its test only when it reproduces the
known replacement; the immediate schedule must retain both nodes.

The prototype has not delivered the requested two compiled twins, codegen,
chained maps, capture serialization, an eager type marker, compiled parity,
compiled smoke/conformance or compiled byte measurements. C1 itself remains
partial: props are joined at cap 1 without separate call-site instances; helper,
foreign and h ownership is incomplete; spans/slots are unresolved in some
groups; capture checking is conservative syntax rather than a serializer check.
The report is diagnostic only and is never read by a build for correctness.

## C0 definitions that need more detail

### F-C1: independent dependency groups can overlap in the DOM

C0 §1.4: “A client root is a maximal connected component of G, after the merges
of §1.5. Its span is the smallest view subtree containing all of its holes and
binds; that subtree is what one hydrate call claims.”

Two independent signals can each have a text read and a button bind interleaved
under the same `<div>`. They share no source, event, provider, boundary,
re-creation or unknown binding, so none of M1–M6 joins them. Both spans are the
same `<div>`. Separate hydration claims would overlap.

The fixture `C0 gap: disjoint state can have overlapping spans` pins this case.
The prototype follows §1.5's general safety rule by merging overlapping spans.
It names the reason `SPAN_OVERLAP`; it does not misreport it as shared state.
This is an additional merge case for the design, not evidence that a compiler
with that conservative merge violates the calculus.

### F-C2: setup can start work without an effect

C0 §1.7: “Effects are the only code that runs because a component exists”.

Both Sierpinski twins call `setInterval(tick, 1000)` and
`requestAnimationFrame(update)` directly in `TriangleDemo`'s setup. Neither
setup contains `$effect`. Deferring this setup defers the timer registration.
The prototype makes unproved setup calls eager and reports them. It does not
rewrite the twins to conceal the case.

This also means that the presence of `Create<"effect">` alone cannot prove the
converse, “no effect implies safe to defer”. An eager marker based only on
`Create<"effect">` would describe effects, not every eager fallback.

### F-C3: the parts table needs the h dialect and helper ownership

C0 §1.1: “hole | `{yield* e}` and an attribute `a={yield* e}` in a view”. It
also lists flow sources and hole props. The two h twins
also bind event values directly in `h` props and pass source values as children.
They need equivalent parts without a `yield*` at the use site. Setup generator
helpers such as `hashFilter()` and `createTodos()` create state owned by their
caller, although their syntax is in another module. The prototype recognises
some h positions but does not recover all helper or foreign ownership. Its JSX
element fraction is therefore not an h element fraction; `0/0` means unmeasured.

### F-C4: executed-byte equality is not deterministic in this harness

C0 Q3-B: “They are deterministic across machines”.

The same original Sierpinski parity script, run in separate processes on this
machine during the first measurement pass, reported 124,542 versus 124,076 bytes
in one step and 123,325 versus 123,453 in another. The byte counter counts source
ranges with nonzero V8 coverage, not time or execution frequency. Different
runtime branches can still be covered. These are observations of the prototype
harness, not a claim about all browsers.

The recorded limit is the observation plus the larger of 2% and 1,024 bytes per
phase. Phase names and counts must match. A decrease is allowed. Inline source
maps are excluded: Vite appends them to evaluated source, and treating their
base64 metadata as executed code inflated an earlier draft measurement.

## F-C5: delayed hydration replaces the second server root on rc.13

**Status: reproduced; C2 blocked at the public-API spike.**

C0 §3.1 requires namespaces that independent `hydrate(..., { renderId })` calls
claim, and says “If it does not, that is a finding (D-004), and C2 waits for Dev”.
Dev's Q1-C ruling also requires per-root claims, including delayed roots.

The fixture server-renders two library-runtime counters under public
`NoHydration` / `Hydration({ id })`, with an inert heading between their shell
and the document. Each root's button has its own namespace. It uses the public
hydration script and the library's `hydrate` entry with the matching `renderId`.

| Schedule | First server button retained | Second server button retained | Warnings | Interaction after setup |
| --- | --- | --- | --- | --- |
| Hydrate both synchronously | yes | yes | none | both increment independently |
| Hydrate first; await one timer turn; hydrate second | yes | **no** | **none** | replacement button increments |

The delayed case fails the per-root claim invariant even though the final DOM
looks right. The old second button is disconnected. This rules out treating a
clean console or matching final markup as sufficient evidence of hydration.
No click on the first root is needed to trigger it.

Diagnosis from the installed rc.13 implementation: Solid's
`drainHydrationCallbacks` schedules the page-wide `_$HY.done = true` flag after
the first hydration completes. Web's `hydrate` then takes its plain-render path
when that flag is true. The reproduction observes node identity; it does not
read or modify private runtime state. No private reset or forced eager hydration
has been added as a workaround.

Reproduce: `node --test packages/compiler-yield/test/hydration-namespace.test.mjs`.
The two schedules run in separate processes. The delayed test **pins the finding**
with a failed identity claim; it is not a passing delayed-hydration test. A future
fix that preserves the second node will make that test fail until the finding is
updated deliberately. Source: `test/fixtures/roots.tsx` in the compiler package.

No C2 loader, generated twin, root source map or compiled benchmark is emitted.
A public way to hydrate later independent roots without losing their server
claims is needed before that work can satisfy the ruling.

## Work required before C2

1. Replace the joined cap-1 component summaries with call-site instantiation and
   explicit widening, including recursive components and helpers. The current
   report deliberately over-merges; it cannot establish the actual root count.
2. Resolve all proposed root spans and slots, including foreign ownership and
   context requirements. Do not emit a root with an unresolved span.
3. Check edge values with the public serializer, including pending records,
   branded failures and class identity. The current capture list is conservative
   syntax checking, not a serializer round-trip test.
4. Implement and test the eager type marker and its propagation. This is a C2
   obligation; the analysis already emits effect diagnostics and reach reports.
5. Resolve F-C5 through public API support, then emit root modules and chained
   maps. Add per-root claims, lazy scheduling and the declared trace differences.
6. Run compiled twins through parity, both smoke lanes, the applicable conformance
   scenarios, the byte gate and the byte-identical one-eager-root fallback check.

## Premise assessment

Not established. In this report, TodoMVC's store, context readers and actions
join the hash-change effect into one eager group; room's identity and live data
also join broadly. Sierpinski has setup timers. These cases do not currently
supply the requested two useful C2 splits, including todos. Hackernews and
rendering have candidates, but their foreign ownership and the joined analysis
prevent a reliable count of independently hydratable roots. Improve C1's
precision before deciding whether “most UI is inert; apps split into small
roots” holds for this corpus. No compiler savings have been measured.
