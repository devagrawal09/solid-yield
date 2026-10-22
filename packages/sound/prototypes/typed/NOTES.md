# Prototype A — typed annotations

## Context/services extension

TypeScript remains the checker. The original program resolves declarations; a
virtual program checks calls into runtime.d.ts. Neither program changes shipped
Solid code. No context type is recognized from its printed name.

The virtual declarations now carry a union of read obligations in View<Q> rather
than just two booleans. Each read records its source, scope, source-map key and
Loading/Errored coverage. A marker argument error carries the computed findings;
index.mjs reads its structured Check payload using TS properties and literal
types, so abbreviated error text cannot lose a read or its location.

- Context identities come from createContext declaration provenance. Lookup values
  carry typed member-path references. provide substitutes the nearest supplied
  value into descendant references; unresolved lookups use their own defaults or
  produce CONTEXT_PROVIDER_MISSING. A missing value invents no async/failure read.
- Factory bodies are transformed too. Their inferred return objects retain each
  signal/memo/method's colors. Explicit return annotations are omitted only in the
  virtual copy so those colors are not erased. Different invocations retain their
  different arguments and provider paths. Factory setup reads travel in __setup
  facts, separately from the returned members.
- Methods carry their closure dependencies, inferred failures, and setter sites.
  Promise-returning methods carry rejection facts, not memo pending facts. Plain
  injected functions always may fail with unknown; optional fallbacks do not
  promise that an injected arm is safe. No user failure contracts were added.
- Props carry lazy colored values. A child's typed prop reference is substituted
  at its caller only after the child's read boundaries have been applied. The
  primary site remains the child's read; caller expressions are related sites.
  Unconsumed props create no obligations. Forwarding preserves typed colors.
- Escapes warn and taint aliases. Typed taint facts resolve at the affected
  provider, making other consumers of that object worst case without tainting
  an independent provider. Alias collection reaches a fixed point.
- Recursive JSX edges become typed references, not inferred-any component calls.
  A virtual component registry lets TS unfold them until prop palettes and
  boundary/context state repeat. Eight changing recursive states are the limit;
  exceeding it warns and assumes worst case. Other palette expansion is bounded
  at sixteen steps and is conservative.
- Known Solid render-callback parameters retain the original checker's types and
  receive the library's settled/failure-free callback facts. This avoids losing
  their types when JSX is replaced by declaration calls. Printed types are only
  serialized for annotations, never matched to recognize an API or context.

context.mjs extends the original transform. The pre-pass still supplies scope,
symbol/alias provenance, dependency expressions and failures (TS has no throw
 types). Pending/failure composition, service-member substitution, provider
shadowing, prop substitution, recursion and boundary discharge happen in types.

## Rules and assumptions

- Diagnostic codes/severities come from src/codes.mjs (D-130). Proven findings are
  errors; partial-check boundaries and pending handler reads warn.
- Returning a service or giving it to a known provider is not an escape.
- Defaults in this slice are usable, non-undefined values.
- The original checker's non-null flow fact is preserved when a generated track
  closure would otherwise lose that fact; this does not trust an unchecked value.
- Both original and virtual programs are still held. Incremental checks rebuild
  the transform and reuse the language services; there is no per-component cache.

## Limits

This remains a prototype, not a general JavaScript interpreter. Dynamic providers,
classes, unsupported mutations/storage shapes and other unmodeled constructs use
partial-check warnings. Related prop locations conservatively include all known
callers of that member rather than only the one render path that fails. Failure
inference retains the original pre-pass's bounded helper/promise analysis. Escapes
inside detached callbacks do not yet share taint facts with sibling consumers;
local aliases still become worst case and the escape warns. Recursive environment
comparison uses member palettes rather than object identity.

Partial values keep their worst-case facts through members, aliases,
destructuring and call results. This also produces two additional pending-handler
warnings on the shared store examples, which are outside the supported subset.
Factory parameters retain the concrete argument types in the virtual program,
so a passed accessor keeps its pending/failure facts at each invocation.

Virtual-program errors that cannot be classified remain explicit analysis
warnings; none occur in the shared fixture set. They are not evidence that an
unsupported program is safe. No fixture-name/path/text tests or suppressions were
added. Shared files, fixtures and the other prototype are unchanged.

## Results

See RESULTS-context.md for the measured shared-fixture results, timing runs, test
status and line delta. The old two false positives (recursive view erasure and
caller-root prop charging) are removed. Primary locations are now read-specific.

## Disputes

None. No shared expectation was changed.
