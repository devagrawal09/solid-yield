# Context and services sub-slice (rc.17)

This extends SLICE.md for **both** prototypes; it does not choose an IR. D-129
sets the rules, with D-130 severity and D-131 scope clarifications. Native code ships unchanged. Fixtures are in context-sources.mjs
and context.mjs; their generated .tsx files are ordinary strict TypeScript.

## Values and providers

- Follow createContext<T>() and createContext(defaultValue) by symbol, including
  imports and aliases. In rc.17 the context itself is its provider:
  `<Context value={service}>…</Context>`. Track provider identity and value, not
  spelling. A consumer uses the nearest enclosing provider on its render path.
- Without a provider, use the default when supplied. With neither provider nor
  default, report CONTEXT_PROVIDER_MISSING at useContext (runtime throws). A
  default must supply a usable value: explicit `undefined` still means missing,
  while `null` is usable for an optional context (D-131).
  Do not invent pending/failure obligations from a definitely missing value.
- A plain object remains plain. A provider object containing signal accessors,
  memos (including promise-returning memos), and methods keeps each member’s
  facts separately. Passing the object does not read its accessors.
- Analyze a project factory called during component setup, including returned
  object literals, closures, nested helpers and arguments. State belongs to that
  invocation: two providers calling the same factory are not one service.
  Factory calls must not become blanket worst-case values. Creation of signals
  and memos in the factory is allowed; reading them in factory setup still has
  setup obligations. Do not execute memo bodies as setup.
- Nested providers shadow outer values, including defaults. Join values only
  over render paths that really reach a consumer. Preserve each path’s boundary
  stack; an unrelated provider or sibling boundary cannot cover a read.

## Consumers and members

- useContext in a component or a sync helper uses that call’s owner/provider
  path. Calling the helper in two provider paths must not merge their identities.
  Context lookup is not a reactive read and does not need a tracking scope.
- Destructuring/aliasing the service or a member preserves identity and facts:
  `const { count: read } = useContext(C)` copies an accessor, not its value.
  `const n = read()` is an actual read. Plain member snapshots stay plain.
- Calling a method follows its body in the caller’s scope, including signal or
  memo reads. A setup call reading a settled signal is STRICT_READ_UNTRACKED
  (error); a pending setup read is PENDING_ASYNC_UNTRACKED_READ (error). A
  setter in owned setup/memo/JSX is REACTIVE_WRITE_IN_OWNED_SCOPE (error).
- A pending JSX read needs Loading; an escaping rendered failure needs Errored.
  At a root, uncovered pending is ASYNC_OUTSIDE_LOADING_BOUNDARY (error), and
  uncovered failure is ERROR_OUTSIDE_ERRORED_BOUNDARY (error). A pending effect
  phase read is PENDING_ASYNC_FORBIDDEN_SCOPE (error).
- A pending read in an event handler is PENDING_ASYNC_IN_HANDLER (warn), even
  under Loading or try/catch: uninitialized reads can suspend/throw; stale reads
  can succeed. A failing read also requires a handler catch (independent error).
- Service methods returning Promises carry rejection facts, not memo pending
  facts. Handle with await inside try/catch or a handling .catch chain. A dropped
  rejecting promise and try/finally are not handled. Errored never catches a
  handler rejection. Known failure-free methods do not require a catch.
- Optional injected APIs, such as `api?: { save: () => Promise<void> }`, retain
  unknown failures wherever the injected arm is possible, even when the fallback
  has a safe body. A plain function type supplies no failure information. No
  user annotation/declaration can promise away failures; infer a body or assume
  unknown. This includes synchronous plain functions. Existing platform rules
  remain restricted to actual default-lib symbols, not method names.

## Prop reads and boundaries

For `<Child value={service.value()}/>` the value is consumed when Child reads
its prop. Report at that read, attach the caller’s prop expression in `related`.
First apply boundaries enclosing the read in Child; propagate remaining pending
and failure separately to the caller and apply boundaries enclosing `<Child>`.
Repeat up to each render root. A boundary inside Child can therefore discharge a
caller expression’s obligation. Do not additionally report at the expression or
root. Forwarding props preserves the chain of related caller locations. Setup
reads cannot be repaired by a rendered Loading/Errored. Lazy unconsumed props do
not create reads. Handler reads use handler rules, not rendered boundaries.

## Escapes and limits

Storing a context value in module state or passing it to an unknown function
produces UNANALYZED_BOUNDARY (warn) at the escape. The escaped alias and values
read through it become worst case (reactive, possibly pending, failing unknown;
callables may fail unknown). Unknown code may mutate a shared object: subsequent
uses of that same object also become worst case. Do not erase obligations, and
do not contaminate independent service instances. Unknown-call failure is still
reported in its scope unless caught. Merely returning a service from an analyzed
factory/helper or passing it to a known provider is not an escape. Dynamic
providers, unmodeled mutations, classes and storage shapes outside this spec
still use the partial-check rule. No new contracts or suppressions are allowed.

## New diagnostic codes

| code | kind | severity | meaning | runtime counterpart | legacy code |
|---|---|---|---|---|---|
| PENDING_ASYNC_IN_HANDLER | async | warn | Event-handler read can occur before initialization. | none (new static finding) | none |
| CONTEXT_PROVIDER_MISSING | owner | error | Lookup has neither provider nor default. | plain runtime throw, no diagnostic code | none |

Other findings reuse src/codes.mjs, including UNANALYZED_BOUNDARY for escapes.
Reused STRICT_READ_UNTRACKED, ASYNC_OUTSIDE_LOADING_BOUNDARY and
PENDING_ASYNC_FORBIDDEN_SCOPE now warn; PENDING_ASYNC_UNTRACKED_READ and
REACTIVE_WRITE_IN_OWNED_SCOPE stay errors, matching rc.17.

## Equipment Checkout

See fixtures/equipment/CONTEXT-EXPECTATION.md. Keep its src/ byte-identical. The
optional injected api arm stays unknown; commit catches its mutation failures.
reload/notice become precise; list and detail remain pending and possibly failing.
Both handler failure and pending warnings remain for item() reads in edit and
changeStatus. The eight API-control handlers still need catches for an injected API.
