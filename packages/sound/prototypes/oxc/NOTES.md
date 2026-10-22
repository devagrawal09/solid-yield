# C — oxc: notes

## Independence

C was written from the shared rules and fixture sources, not copied from A or B. No code is imported from either prototype or the generator packages. The only shared runtime dependency in the checker is the diagnostic table. The standalone Vite wrapper is also independent of TypeScript. The comparison harness itself still loads TypeScript to configure A/B; that is not a C dependency. A child-process test blocks TypeScript resolution while loading C, its Vite wrapper, and checking all 143 fixtures. A source scan also rejects TypeScript imports.

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

One original out-of-subset fixture has a stale ref-read expectation. The checker retains its required partial warning and adds the real untracked read required by D-131. DISPUTES.md records runtime evidence. This causes one strict no-extra test failure; there are no required misses or in-subset extras. See RESULTS-openclaw.md. No frozen expectation or non-oxc pin changed.

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
