# Prototype B — dataflow: notes

## Whole-app noise round

See RESULTS-noise.md and noise-evidence/. All 2,669 roots are retained. The final
Node 24 run reports 11,926 diagnostics versus 11,214 before (11,569 in the first
noise commit); counts are not a precision rate. The first round's fixes use
existing bodies and declarations: keep local
runtime declarations distinct from type imports and TypeScript's shared unknown
alias symbol; analyze direct/aliased JSX helpers in their caller's scope.
Unresolved imports still warn and return worst-case values. Their calls now
retain missing failure/result facts instead of inheriting an unrelated component.
Thirteen local tests pair clean controls with pending, throwing and injected mutants.
Frozen fixtures/pins and other prototypes are unchanged. All 173 fixtures pass.

The follow-up fixes the confirmed scalar-helper FP generically: a declared scalar
parameter in a standalone JSX summary is an already evaluated value, not a props
bag. JSX callers, widened/object props, callback/unknown types, explicit throws
and reactive argument reads keep their obligations. A lexical coverage scan also
exposes the four reviewed missing onSettled/compute-signal/ref-array warnings in
unvisited bodies. It does not analyze their execution. Reached compute-form
signal tuple members retain worst-case facts; ordinary signal setup stays clean.
The refreshed 53-error review has 10 contract-valid findings and 43 unsure cases;
all 16 silence sites are locally justified, with the former gaps now explicit
boundaries. The resolved FP and original review remain archived. Returned
higher-order execution, derived signals and ref-array ownership remain unsupported.
Most downstream diagnostics lack retained causal provenance;
the aggregate classification labels those origins unresolved. No whole-app
soundness or noise-reduction claim is made.

## Scale pass

See RESULTS-scale.md and ../../scale/ for the measurements and parse-only driver.
The TypeScript 6 backend stays: measurement found the first heap failure during
program creation, before B constructed any facts. Moving the same import closure
to TS 7 would not address that cause; the existing TS 7 spike also timed out on
this app with about 6.5 GiB combined RSS.

- The oracle resolves declarations and checked roots. Other source imports become
  explicit opaque boundaries, rather than recursively loading unchecked workspace
  implementations. Each runtime import warns; using its values keeps worst-case
  pending/read/failure facts. Include those files as roots for more coverage. This
  is reduced coverage with warnings, not a declaration-generation substitute.
  Re-exports, namespace members and missing declarations also keep opaque values
  until consumption; an ordinary unknown method call is not a pending read.
  Installed declarations remain available; installed bodies are still excluded by
  ProjectBoundary. An installed source link listed as a root remains lookup-only.
- Local invocation maps do not copy the module map. bindingOf already falls back
  to moduleBindings. Invocation-local captured values remain separate.
- Locations, short text, symbols and Solid API lookups are cached within a program
  or analysis lifetime. Repeated identical component facts are retained once.
  Root reporting skips an already reported site before rebuilding its lookup and
  message. It keeps the same first diagnostic, not fewer obligations.
- An outer module/component activation shares a 20,000-operation / one-second
  budget with its nested calls and views. Cut-offs warn and retain unknown
  failures and pending/read obligations. Recursive/deep calls no longer return a
  silently safe constant. A recursive component cycle reuses the first activation
  only for unchanged primitive/forwarded-source prop facts and identical provider
  values. Aliases are followed without executing lazy props. Changed inputs,
  objects, callbacks and unsupported expressions keep the worst-case fallback.
  These are cooperative bounds: a synchronous TS oracle
  query cannot be interrupted, and several jobs can belong to one file. They are
  not a hard two-second wall-clock guarantee.
- update compares a conservative printed-syntax summary (SHA-256, plus exact shape
  equality), including private bodies, JSX text, ASI and reference directives.
  Unchanged syntax reuses results, relocates original-source locations and does
  not mutate earlier results. Unmappable locations force a real check.
- **Selective semantic invalidation is not implemented.** A changed summary still
  rebuilds the analysis of every checked root. Caller/callee prop facts therefore
  remain conservative in both directions, but semantic updates miss the requested
  incremental design. No summary hash is claimed to be an inferred exported API.

The createChecker/check/update/dispose contract is unchanged. Results add
invalidatedFiles, reanalyzedFiles, timings and programStats; update also adds summaryHash and
summaryChanges. Unchanged syntax invalidates the edited file's locations but
reanalyzes no files. Semantic changes list every root as reanalyzed; the metadata
never claims a selective recheck that did not happen. dispose releases retained
results and document text as well as the language service.


## Precision pass (D-133)

See RESULTS-precision.md for the full frozen score and timings. B now removes
all seven extra errors and eight extra warnings in openclaw-precision and
catches the class-method mutant. Its raw score is **14/15**, not 15/15: the
remaining exported-only pending mutant conflicts with the explicit SLICE root
rule. DISPUTES.md has two passing rc.17 runtime probes; the miss remains visible
in the score and its unchanged pin. Other groups have no added misses or extras.

- ProjectBoundary excludes installed paths, package link targets, declarations
  and TypeScript external-library files before component collection or body
  analysis, even with over-inclusive checked roots. Reporting has the same
  guard. TypeScript still loads dependencies as type information. Linked
  implementation tests verify that their bodies and component facts never leak
  into app analysis.
- Dependency calls and constructors keep unknown failures at the app site,
  regardless of a safe-looking installed body. Declared imperative results do
  not acquire Solid pending-read facts. Untyped results warn and retain worst
  facts until consumed; merely calling a method is not a proven pending read.
- Supported imperative classes have fresh instance members, captured locals,
  methods/getters, field initializers, constructor arguments and this receivers.
  Arrow fields retain lexical this; extracted methods are not silently bound.
  Native Error subclasses without a custom constructor stay plain. Other
  inheritance, decorators, missing bodies, replacement-object constructors and
  unsupported members warn and keep unknown failures/worst results.
- merge holds object/props layers lazily. A consuming member read walks them
  right-to-left and skips undefined. A later safe callback replaces a throwing
  default; an injected or optional override retains unknown failures. Props
  stay lazy through merge, rather than becoming setup reads or losing bodies.
  General merge/omit/spread rules in FUTURE.md remain deferred.
- Loading.on is evaluated as a tracking reset-key expression under the outer
  boundaries. Function-valued keys are held, never handlers. Reset ordering and
  lifetime rules remain deferred.
- Actual default-lib removeEventListener is a native contract, not a name-based
  exemption. Safe receiver operations hold callback arguments: removing a
  listener or adding it to a Set does not run it. Injected lookalikes and actual
  callback invocation still fail when uncaught. Existing focus-task isolation,
  ordinary member calls and safe held/ref forwarding already passed their pairs
  and remain unchanged.

Prototype-local tests cover these rules and their unsafe counterparts, including
linked installed source roots, unknown results, constructors and HMR updates.
Only B’s precision known-failure entries were tightened; no shared rules, frozen
fixtures, harness logic, other prototype or comparison document changed.

## Design

This remains an abstract interpretation of the authored TypeScript AST. The type
checker supplies symbols, declarations and Promise information; it does not check
a generated program. Source files ship unchanged. No user failure contracts are
accepted. Diagnostic severity comes from src/codes.mjs (D-130).

### Context and services

- Context identities originate at recognized createContext calls, including
  imported, local and namespace aliases. No printed-type matching is used.
  Defaults belong to that identity; a definitely undefined default is absent.
- Each render path carries a provider map. Entering a provider copies the map
  and replaces only its context binding. Leaving it restores the outer map.
  Consumers and synchronous lookup helpers use the caller's map, not a union of
  unrelated providers. A missing provider/default reports at useContext and
  does not invent downstream pending or failure facts.
- Object values have separate member and getter tables. Holding a service does
  not call its accessors. Destructuring preserves functions, signals and memos;
  getters execute in the reader's scope. Plain members stay plain.
- An analyzed factory gets a fresh binding map for each invocation. Functions
  and methods capture that map, so separate calls to one factory do not share
  signal/memo facts. This includes nested helpers, object arguments and returned
  object literals. Memo bodies run as computations, not setup.
- Method summaries are computed at calls: returned values, Promise rejections,
  synchronous failures and reactive reads. They are scope-sensitive and are not
  cached across service instances. A method reading a signal uses its caller's
  scope; setters keep their write checks when copied through object members.
- Unknown plain functions retain unknown failure facts. An opaque injected arm
  is retained beside an analyzed fallback, including synchronous APIs. A known
  failure-free method remains failure-free. Await/catch and Promise chains
  handle rejections; rendered Errored does not handle handler failures.
- Shared service objects carry an escape marker. Assigning one to module state
  or passing it to unknown code warns, then invalidates member facts for aliases
  of that object. Independent factory instances remain precise. Explicit object
  member mutations and dynamic provider choices also use warn plus worst case.

### Components, props and scopes

The old global component/prop fixpoint is replaced with per-render-invocation
analysis. A child's summary is returned to that particular caller, where Loading
and Errored discharge pending and failure separately. This avoids cross-provider
and cross-boundary contamination. Root summaries are snapshots for each root.

Props hold deferred expressions with their caller bindings/provider map. They are
only evaluated when consumed. Their collected facts are read at the child's
consuming site, with caller expressions in related locations; forwarding retains
the chain. Child boundaries apply first, caller element boundaries next. JSX
children are lazy as well. Setup and handler reads keep their own scope rules.

Scopes remain setup, tracking (JSX/memo/effect compute), handler and effect phase,
with an explicit untracked flag. D-131 adds setup-like For row bodies and a
separate ref scope: ref reads use setup rules, while failures remain callback
failures and ref write ownership remains partial. Default For items and
index-mode indices are held; key-function/index-mode items and default indices
are accessors. Returned row JSX tracks normally. Settled effect apply reads
are errors, including reads in synchronous helpers; compute inputs stay plain.
Named/aliased untrack callbacks run with read checks disabled, not failures or
writes disabled. Setup/effect prop errors keep their related caller locations.
Pending handler reads warn even inside a catch or rendered Loading; failure handling is checked independently. Helper bodies run
in the calling scope. Async bodies turn failures into rejection facts.

Platform contracts apply only to actual TypeScript default-lib declarations:
ordinary library calls are safe under the original slice rules, JSON.parse may
throw SyntaxError, Promise.reject carries its rejection, array callbacks run
synchronously and timer callbacks run detached. A project method with the same
name does not gain a platform contract. TypeScript's existing Promise oracle is
used through a narrow local signature, not a printed type name.

## Incremental checking

The LanguageService/document registry is unchanged. update bumps a document
version and reruns analysis on the reused program. It does not retain service
objects or provider maps from an earlier check. See RESULTS-context.md for the
measured cold, incremental and Vite results.

## Assumptions and known limits

- This is still a prototype, not a general JavaScript heap analysis. Named object
  members, the specified factory/closure shapes and direct service escapes are
  modeled; arbitrary containers and mutable closure-cell patterns are not a
  complete alias model. Explicit member mutation is conservatively invalidated.
- Branches and loop bodies are analyzed conservatively without evaluating numeric
  conditions. Local assignment joins and repeated mutable closure updates remain
  path-insensitive. The checker can over-report unreachable work.
- Recursive helpers/components use the first activation's facts, as in the
  original prototype, rather than a general recursive heap/argument fixpoint.
  Deep helper expansion is bounded. No universal soundness claim follows from
  zero misses in this finite shared corpus.
- The specified contexts have usable non-undefined defaults. Definitely undefined
  defaults are handled, but mixed/dynamic defaults need a fuller value model.
- An exported component with no reached renderer is analyzed with an empty
  provider map. There is no cross-project provider/owner metadata.
- Reads after await retain the caller's scope; the runtime's separate
  UNTRACKED_READ_AFTER_AWAIT rule is outside this slice. Unsupported class
  inheritance/dynamic shapes, generators, stores, derived createSignal functions, latest/isPending and
  effects created outside setup remain outside the supported model.

The earlier OpenClaw pass changed no fixture expectations, shared contracts,
harness code or other prototype; only dataflow OpenClaw score pins tightened.
RESULTS-openclaw.md and the historical ref section of DISPUTES.md retain that
pass’s measurements. The current frozen ref expectation already includes its
D-131 read error, so it is no longer a scored extra.
Ref ownership/cleanup/primitive creation and the FUTURE.md gaps remain deferred.
Added prototype-local tests cover provider
paths, factory instances, aliases, lazy props/children, forwarding locations,
escapes, pending handlers, injected functions and conservative member mutation.

## Emit-readiness

ComponentFacts still exposes read locations/scopes/source names, boundary sites,
pending/failure summaries and partial-check sites. Service members and captured
method environments are analysis facts rather than rewritten user code. An
optimized emitter would still need handler write sets, dependency edges between
memos and per-read initialization facts.
