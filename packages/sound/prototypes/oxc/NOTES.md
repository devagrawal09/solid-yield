# C — oxc: notes

## Independence

C was written from the shared rules and fixture sources, not copied from A or B. No code is imported from either prototype or the generator packages. The only shared runtime dependency in the checker is the diagnostic table. The standalone Vite wrapper is also independent of TypeScript. The comparison harness itself still loads TypeScript to configure A/B; that is not a C dependency. A child-process test blocks TypeScript resolution while loading C, its Vite wrapper, and checking all 173 frozen fixtures. A source scan also rejects TypeScript imports.

Oxc packages installed without a minimum-release-age exception. The existing shared TypeScript dependency remains for A/B. C ignores compilerOptions rather than loading their implementation or library files.

## Important choices

- Provider and factory identities belong to invocations, not factory definitions. Lookup uses the current render path. Service objects keep accessors and methods as separate members.
- Prop expressions are lazy. Their pending/failure facts land at the child's read, with caller expressions related; boundaries from that child outward are preserved.
- Callback props carry the union of their body failures. Their literal arguments are widened for that purpose, as required by SLICE.md. This is deliberately broader than specializing a callback for one constant argument.
- Local closures retain lexical environments. Calls see state at that call; memo summaries are refreshed at reads and joined with earlier facts. Known scalar branches are pruned, other branches fork local cells and join. This is not a general path solver.
- Module paths are real paths, so macOS /var aliases and pnpm links do not create duplicate contexts or components. Updates and read overrides use the same identity.
- Promise rejections are separate from synchronous throws. Dropping a rejection does not let an enclosing synchronous catch handle it. Pending handler reads still warn under catches and rendered boundaries.
- Inference-needed counts are distinct location/reason pairs per check, not dynamic invocation counts. Annotation-only functions always count as needing failure inference and use unknown failures. Repeated calls at the same site count once. Partial-check widenings are included.

## OpenClaw / D-131

All 34 OpenClaw fixtures now meet every requirement without extra errors or warnings. For bodies run in setup-like read scopes; returned JSX tracks normally. Default For rows are plain with an accessor index; key-function rows use accessors; position mode uses an accessor row and numeric index. Array element facts are joined without needing type inference. Unknown key functions retain unknown failures, and unknown key modes warn and widen.

Ref reads use setup rules while failures remain detached-handler failures. DOM capture/assignment is supported; reactive writes and primitive creation in refs remain partial-check boundaries because their ownership rules are deferred. Effect apply/helper reads are untracked, but forwarded compute values are plain. Explicit undefined context defaults are missing (also inside an alternative); null and copied accessors are usable. Untrack forwards project failures at its call site and never acts as a catch. Promise branch handling and lazy unused props already worked and have regression checks.

The earlier ref-read dispute was resolved in the shared expectations before this precision pass. The current checker meets both its read error and deferred-ownership warning without extras. RESULTS-openclaw.md records the earlier measurement; DISPUTES.md now distinguishes that resolved case from the active export/root dispute.

## Precision / D-133

The historical precision pass improved the 30 fixtures from 13/15 error hits, 22 extra errors and 24 extra warnings to 14/15, zero extra errors and zero extra warnings. RESULTS-precision.md and DISPUTES.md record the then-unmounted reactive-key mutant and the export/root distinction. Parent commit 05df715 mounted that pair before this scale branch: the current suite now has all 15 precision hits and all 173 fixtures without soundness failures, missed mutants or extra errors/warnings. This scale pass changes no expectation or pin.

- Loading.on evaluates its reset input in tracking scope; it never invokes a held function as an event callback. Reset ordering remains deferred.
- Simple imperative classes have invocation-specific instances, receiver-bound methods/getters, fields and constructors. Methods follow their real bodies and preserve actual accessor reads. Unsupported class features still warn and widen. An unknown member call carries unknown failures/results, not an invented pending-accessor read.
- Array.find preserves its element facts and checks its predicate. Native document listener teardown keeps its receiver contract; injected lookalikes remain unknown. Optional calls skip known absent arms only. Native Set receivers remain separate from injected add methods.
- Solid merge keeps lazy prop bodies and real override order, including absent/undefined and nested sources. A no-op default does not discharge a supplied unknown callback. Known callback/ref bodies keep the existing body-wide failure rules.
- Installed implementations are never read or parsed. This includes checked roots, package dist, and linked package real paths. Resolution uses declarations and adjacent declaration sidecars; unknown package calls warn at app sites and keep unknown failures/returned values. Package source is not a fallback. Tests verify declarations/no-declarations, linked/unlinked packages, extra roots, and updates.
- Public optional inputs retain their injectable arm when a local root omits them. Known supplied callback bodies remain precise. Closed local merge inputs can use an actually absent override to select a default; a public/unknown override cannot be assumed absent.
- Results expose distinct worstCaseSites as well as inferenceNeeded requests. The precision measurement script reports unique locations, location/reason requests, worst-case call/boundary sites, and partial-warning sites per group. Annotation-only calls still need failure inference under D-129.

## Scale pass (OpenClaw)

See RESULTS-scale.md for measurements, including missed targets. The old precision
report above predates parent commit 05df715, which mounted the reactive-key pair;
the current frozen suite has 173 fixtures and C meets all their requirements.
No fixture, pin, shared harness, shared code or decision was changed in this pass.

- Source locations are cached, with a line-start index rather than repeatedly
  splitting each source prefix. Import resolution and package metadata are cached.
  Equal scalar alternatives join once; allocated objects keep separate identities.
- Functions have bounded context caches (32 entries, eviction means re-analysis,
  not omission). Keys include lexical cells, state revision, arguments, scope,
  boundaries, render path and providers. Only copyable return facts are cached;
  services, contexts, source allocations and closures remain invocation-specific.
  Cached failure/capture effects are replayed into the current caller, and promise
  handled flags are copied rather than shared. State writes invalidate call caches.
- Interpreter work is bounded at 5,000 steps per source file per analysis job,
  and 64 value alternatives. A job is a module initializer, render entry, hand-off
  or exported component. Existing recursive-call limits remain. Exhaustion emits
  UNANALYZED_BOUNDARY, returns worst case and routes possible reads/failures through
  the actual scope even when the return is unused. Captured assignment targets and
  mutable arguments are widened. These warnings mean incomplete coverage, not an
  application bug or a proof that the skipped body actually reads a Solid source.
- Initializer/render/component results are retained separately, including their
  dependencies and shared-state writes. Updates use a finite dependency worklist;
  invalidated activations are discarded before replacements are built. Unrelated
  jobs retain their diagnostics. Prop facts flow through render jobs in both
  directions, so changing a caller can change diagnostics at a child's read.
- Stable per-file hashes omit source positions. A comment/newline-only update is
  parsed and compared, then existing locations are moved without re-expansion.
  Semantic changes conservatively invalidate transitive importers plus jobs that
  consumed their components; shared module mutations add reverse dependencies.
  **This is not yet the requested output-summary-only propagation:** a changed
  function body still changes the conservative summary hash even when its final
  pending/failure facts would be identical. Widely imported semantic edits remain
  expensive. The cached jobs are not general parametric function summaries.

The interface is unchanged. Additive result fields are invalidatedFiles,
summaryChangedFiles and summaryHash on updates, and scale counters (checked/reused
jobs, cache hits/misses, bounded sites, loaded modules and slow jobs). A check with
no update reuses its current result. invalidatedFiles names the conservative
invalidated module set, not a claim that every function in those modules ran.
Cached source locations move in place; callers needing historical snapshots
should copy results. dispose releases jobs, modules and resolver lookup tables.

## Limits and assumptions

The shared 109-fixture result is evidence for this slice, not a proof for arbitrary JavaScript.

- The annotation reader handles structural members, aliases, interfaces, Promise returns, arrays, optional inputs and declared functions. It does not implement assignability, overload selection, conditional/mapped types, or general generic instantiation. Unavailable facts use unknown/worst case; user function declarations never guarantee safety.
- The resolver supports package exports, node_modules, pnpm links and source extensions. Custom tsconfig path mappings and a full ambient-global merge are not implemented.
- Branches preserve scalar-cell alternatives and local closures, not arbitrary heap correlations. Shared non-service object/array mutation is not a complete alias analysis. Service member mutation is a partial boundary and taints that service. Unknown calls taint escaped service objects, not independent invocations.
- Loops warn and widen changed outer cells; they are not a fixed-point loop analysis. Recursion beyond the activation budget warns and returns worst case. Known bounded component recursion can use constant scalar comparisons.
- The platform table models global receivers and known primitive/array/DOM shapes, not the whole browser library. Inferred receiver shapes outside those models need worst-case treatment.
- Memo summaries retain earlier possibilities after a captured binding changes. This favors safety over precision. Async work is analyzed statically, not scheduled; the post-await strict-read question remains outside the shared slice.
- Parsed modules are cached, but every update rebuilds the whole invocation analysis. There is no dependency-selective analysis cache yet.
- Facts expose reads and coarse component summaries; they are a starting point for an optimized emitter, not a production lowering plan.

The remaining production work is broader declaration coverage, heap/path correlation, more complete escapes and hand-offs, and explicit persistent graph invalidation. No fixture-specific rules, failure contracts, suppressions or TypeScript calls are used.
