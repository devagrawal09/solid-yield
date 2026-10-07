# Compiler prototype findings and remaining work

Branch: `proto/compiler`. Updated 2026-10-07 after Dev's option-A ruling.
C1 fixes are complete across nine twins. The docs emitter produces seven eager
physical roots from eleven dependency groups; `/` passes all 24 hydrated steps.
**C2 is partial and stopped at F-C9:** direct failed-route SSR/hydration loses
the typed failure on original, library and compiled routes. F-C5 is historical
and no longer blocks the eager-only ruling. No complete theorem-preservation
claim or compiler savings is made. See [the current C2 record](compiler-c2-finding.md).
The library runtime was not changed to conceal either finding.

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
  uses separate call-site environments and widened recursive families. The CLI and
  Vite pre-pass both use it. It remains diagnostic, not a codegen input.
- Inspector precise coverage over the existing parity scripts, plus production
  client chunk sizes. The benchmark document describes the measured scope and
  the baseline allowance. Compiler columns explicitly say not built.

## Validation and limits

Final validation on 2026-10-07: `pnpm build` passed, then
`node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json`
finished **GREEN: 42 pass / 0 fail / 0 skip** (118 seconds, no baseline changes).
A fresh report generation matched the checked-in report byte for byte.
An earlier gate run caught formatting in an in-progress test edit; the final
formatted tree passed the full gate, including the existing byte checks.
The analysis suite has 51 fixtures: 25 historical joined-engine tests and 26
instance-engine tests. The instance fixtures cover imported values composed
through expressions/helpers/cells, recursive generator and opaque props,
independent caller constants, foreign-owned slots, captures and timer reach.

These are **library-route** parity/conformance results. The existing conformance
harness's frozen compiler oracle predates this prototype and is not evidence of
C2 output. F-C5's delayed schedule passes its test only when it reproduces the
known replacement; the immediate schedule must retain both nodes.

The prototype has not delivered the requested two compiled twins, codegen,
chained maps, capture serialization, an eager type marker, compiled parity,
compiled smoke/conformance or compiled byte measurements. C1 now uses call-site instances, follows local helpers and
records foreign ownership. All eight analysed twins have a resolved *abstract*
span, but this is not a physical DOM claim test. Recursive rows are one widened
family; foreign owners and syntax-based colors remain conservative. Capture
checking is still syntax-based, not a serializer test. The report is diagnostic
only and is never consumed by a build for correctness.

The audit retained the three inherited uncommitted files and found additional
bugs with failing fixtures: composed imported data became S; an initially S
hole-generator prop hid a later recursive C input; recursive widening mutated
caller values shared by another instance. Instance-owned prop equations and
import-data propagation fix these. Further fixtures fixed effect reach omitting
a timer registered by an effect and a missing first-call prop leaving earlier
recursive holes at S. No fixture is evidence of general soundness for
all JavaScript. Unknown calls remain conservative U.

The previous report had 275 U entries; the audited pass has **37 named origins**:
**1 analysis blind spot, 36 genuine client dependencies**. Every origin has a
per-twin expression/location, construct, classification and rule in
[the report](compiler-c1-report.md). The remaining blind spot is Effect.runFork
passed through a conditional helper return: the function reference is module
code (S at the edge), but callable alternatives are not retained. It remains U;
fixing it does not eliminate the runtime owner or async adapter. Counts before
and after have different units, so the reduction is not an inert-UI or savings
percentage.

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

The audited pass applies SPAN_OVERLAP to equal abstract spans. Strictly nested
independent groups may become parent slots only if no client flow or foreign
owner can recreate them. Fixtures cover both an allowed nested independent root
and forbidden slots beneath foreign owners/client flows. S markup beneath a
foreign owner is locally inert but is **not** an extractable slot. Physical DOM
ranges and independent hydration claims remain unproved; these are candidate
spans and slots, not an extra C0 guarantee.

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
caller, although their syntax is in another module. The audited pass uses this explicit working rule:

- A literal native h tag creates an element site. Nonliteral prop/child positions
  create holes; onX props create binds even without yield* at the use site.
- Component/flow children are instantiated beneath their caller's DOM owner.
  Generator helpers execute in their caller's setup environment and create its
  cells/events/effects. Foreign owners conservatively absorb descendants.
- Plain literal values are inert. JSX expression positions are counted too,
  including structural component-call holes. Counts are reached call-site
  instances; a row/recursive family has one widened representative.

The report separates JSX elements from h elements. For h twins JSX 0/0 is not an
inertness claim; h is now measured separately (Sierpinski 0/2, todos 7/24).
These are operational C1 rules with fixtures, not edits to C0 §1.1. Exact mapping
from these abstract sites to physical DOM ranges is still a C2 task.

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

**Historical status: reproduced.** Superseded as a blocker by the eager-only ruling on 2026-10-07.

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

This spike originally stopped C2. Eager codegen and its new blocker are recorded below.

## Historical checklist before the eager ruling

Items 4–6 retain the original C0 checklist as historical context. Dev now rules
that v0.2 ships eager islands only; delayed scheduling is not a requirement of
this C1 audit. The F-C5 record above is unchanged.

1. C1 call-site instantiation and recursive widening are now implemented and
   audited. The remaining callable-alternative blind spot is named in the report;
   recursive families and foreign ownership still over-approximate runtime roots.
2. All twin groups now have abstract spans. Verify their physical DOM ranges and
   slot ownership before emission; an abstract span is not a claim proof.
3. Check edge values with the public serializer, including pending records,
   branded failures and class identity. The current capture list is conservative
   syntax checking, not a serializer round-trip test.
4. Implement and test the eager type marker and its propagation. This is a C2
   obligation; the analysis already emits effect diagnostics and reach reports.
5. Resolve F-C5 through public API support, then emit root modules and chained
   maps. Add per-root claims, lazy scheduling and the declared trace differences.
6. Run compiled twins through parity, both smoke lanes, the applicable conformance
   scenarios, the byte gate and the byte-identical one-eager-root fallback check.

## Historical premise assessment (before the docs twin and option A)

The audited corpus does **not support** “most UI is inert; apps split into small
roots” under the current C0 rules. None of the twins has a majority of locally
inert measured element sites. Each has one conservative group: seven eager,
one visible. Effects/timers, shared state/context, recreation, boundaries and
foreign ownership explain those groups; the report names what each eager cause
touches and pulls in. The small independent-counter fixtures do split.

This is not a universal disproof: the corpus favours stateful and async demos,
foreign ownership and syntax-based colors over-merge, and static call-site counts
are neither actual DOM counts nor bytes. Most importantly, locally S markup
under a foreign owner is not automatically a server slot. No codegen, capture
serialization, independent physical claims or compiler savings have been proved.
The historical F-C5 finding and benchmarks were not changed by this audit.

## 2026-10-07 tier-1 findings (docs twin)

- **F-C6, open: default codec loses custom Error prototypes.** Serializing a
  `NotFound` retains `kind`, but decoding it gives an ordinary `Error`.
  `Errored.catch` uses class identity. The new edge guard refuses this capture;
  the router and guide retain their whole defining subtrees. A codec round-trip
  fixture pins the loss, including a nested error. No class revival is invented.
- **F-C7, fixed emitter placement:** claiming a reactive-only Router root against
  `document` retained server nodes without warnings but did not activate route
  navigation or likes. Its existing sole-child parent is the supported mount.
  The emitter rejects a foreign root without that container. Full interaction
  parity, not just node identity, verifies it.
- **F-C8, fixed emitter integration:** server-only footer links initially missed
  `data-active` and `aria-current`. The router's public element-claim hook reaches
  outside its own subtree. The loader now calls public `claimElementTree` for
  inert ranges in document order and for subsequent inserted nodes, under a
  disposable owner. Their template/data code is absent from client chunks.
  Inert means no authored client render code; it does not mean native elements
  can bypass public platform registration. No parity normalization was changed.
- **F-C9, blocking: direct failed SSR loses the typed failure.** A fresh request
  to `/docs/missing` emits a sanitized `Internal Server Error`, no `.not-found`
  paragraph, and hydration rejects. This reproduces on the original, library
  and compiled routes. `/` followed by client navigation to the same URL works
  and passes step 24. The gate pins the direct-load failure as a finding, **not
  a passing SSR/hydrate smoke**. The required typed-failure edge preservation
  cannot be claimed. C2 implementation stopped here under Dev's instruction;
  no runtime patch, class rewrite, new normalization or approval of this
  difference is implied. See [the C2 record](compiler-c2-finding.md).


## F-C12 — the article payload needs a bounded purity contract

The C3b adapter's opaque marked/highlight.js calls cannot be proved pure by the
source graph. A checked contract covers only the reviewed docs renderArticle
export, exact adapter digest and pinned package versions. Fresh local renderer,
highlighter registry and heading counters depend only on the Article input.
Changed code stays unproved; tests retain U/C inputs and reject changed adapters.
This is a prototype contract, not a general third-party purity inference.
See [C3b placement and measurements](compiler-c3b-payload.md).

## F-C13 — frames and ordinary HTML claim article links differently

Frame morphing claims anchors inside Markdown innerHTML and adds router active
attributes that ordinary innerHTML hydration does not. TOC claim attributes
also differ when mounting after the missing-route fallback. Original/library
parity remains exact; R exact DOM parity fails in all 28 steps. Only a separate
diagnostic comparison removes those router attributes on Markdown/TOC anchors,
alongside F-C11's transport nodes. It preserves the exact comparisons and records their snapshot hashes.
See [C3b](compiler-c3b-payload.md) and [the record](compiler-c3b-parity.json).

## F-C14 — derived memo placement in generic frames

Creating the article pipeline memo inside ArticleBody below Loading caused the
generic frame probe to exceed 10001 discovery passes. Hoisting that memo beside
the loader in ArticleContent setup, identically in both apps, stabilizes its
owner. The R emitter mirrors the setup pair; its typed success/failure probe
and integrated parity checks pass. This records a placement constraint of the
current frame integration, not an upstream runtime fix or permission to ignore
an unbounded discovery loop. [C3b](compiler-c3b-payload.md) retains the limits.
