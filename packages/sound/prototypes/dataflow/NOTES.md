# Prototype B — dataflow: notes

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
with an explicit untracked flag. Pending handler reads warn even inside a catch
or rendered Loading; failure handling is checked independently. Helper bodies run
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
  UNTRACKED_READ_AFTER_AWAIT rule is outside this slice. General classes,
  generators, stores, derived createSignal functions, latest/isPending and
  effects created outside setup remain outside the supported model.

No fixture expectations, shared contracts, harness code or other prototype were
changed. No disputes were found. Added prototype-local tests cover provider
paths, factory instances, aliases, lazy props/children, forwarding locations,
escapes, pending handlers, injected functions and conservative member mutation.

## Emit-readiness

ComponentFacts still exposes read locations/scopes/source names, boundary sites,
pending/failure summaries and partial-check sites. Service members and captured
method environments are analysis facts rather than rewritten user code. An
optimized emitter would still need handler write sets, dependency edges between
memos and per-read initialization facts.
