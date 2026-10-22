# Prototype B — dataflow: notes

## Design

A dedicated analysis over the TypeScript AST with the type checker as an oracle
(symbol resolution, "which Solid export is this", declared return types, default-lib
membership). One `Analysis` per program (analyze.mjs):

- **Bindings** keyed by TS symbol: signal getter / setter, memo (with its computed
  source facts), helper function (with a state-factory flag), component, props
  parameter, object literal (getters are sync helpers), caught-failure markers,
  values (`Value` lattice in values.mjs: reactive · pending · failures · promise
  rejections · callables · worst).
- **Scopes**: setup · tracking (JSX container, memo / effect compute, Show/For render
  callbacks) · handler (event attributes, callback props, promise continuations,
  timer / ref callbacks) · effect (the effect function) · an `untracked` flag. Sync
  helpers run in the caller's scope; async helpers keep the caller's scope for their
  synchronous prefix and turn throws into the promise's rejections.
- **Reads** route by scope: setup → STRICT_READ_UNTRACKED / PENDING_ASYNC_UNTRACKED_READ;
  tracking inside a computation → the computation's facts; tracking at a JSX position
  → a pending / failure **obligation** unless a Loading / Errored ancestor covers it;
  effect → PENDING_ASYNC_FORBIDDEN_SCOPE. `raise()` routes failures the same way.
- **Components** are summarized (uncovered obligations with the read's location and
  the owner path); a child's summary lands at its JSX position under the parent's
  boundaries; props flow parent → child as values (reactive / pending / failing /
  callables), callback props' failure sets are the union over callers, forwarding
  included. Whole-program fixpoint (≤ 6 passes; prop tables persist across passes).
- **Roots**: `render(App | () => <App/>)` and hand-offs (a component used as a value)
  report the undischarged obligations at the read, with the root as related location
  and the owner path (`<App> › <Inventory> › <EquipmentRow>`). Exported, never
  rendered components: info COMPONENT_OBLIGATIONS_EXPORTED.
- **Worst case**: useContext, stores, state factories, unmodeled Solid APIs, spreads,
  refs → UNANALYZED_BOUNDARY warning at the construct; the value is reactive,
  possibly pending, failing with unknown; calls through it have no failure
  information (Promise-typed → rejection, else sync unknown).
- **Platform contracts** apply only to callees declared in a TypeScript default lib
  (the review finding on b2dfebf): ECMAScript library calls never fail, DOM calls only
  through a small allowlist, `JSON.parse` → SyntaxError, `Promise.reject(x)` → x,
  timers run their callback detached, array methods run theirs synchronously. A
  project or package method named `get`/`set`/`map` is unknown.
- **Incremental**: a `ts.LanguageService` with a document registry; `update()` bumps the
  file version and re-runs the whole analysis on the reused program (per-file IR
  caching was not needed at this size: 20–25 ms for the Equipment app).

## Subset vs SLICE.md

Supported: everything in "Inside the subset", including object getters, destructured
props, IIFEs, sync array callbacks, promise chains (.then/.catch/.finally), dropped and
`void`-ed promises, try/catch/finally with rethrow, callback-prop forwarding, recursion
(first activation's facts stand), Show/For/Switch/Match/Loading/Errored (with the
fallback function's `error`/`reset`). Partial: closures see the last binding of their
free variables (path-insensitive); a getter stored off a worst-case object keeps the
worst case, but a plain value stored off a reactive expression is `derived` (facts
kept, shape dropped). Not modeled: effects created outside setup, generators,
classes, `createSignal(fn)` derived signals, `latest`/`isPending`.

## Known soundness holes / false positives

- Holes: a callable hidden in a data structure (`const h = { fn }; h.fn()`) is unknown
  (reported) — not a hole, but imprecise. Reads of pending values inside handlers are
  not reported by decision. Reads after `await` in async computes are treated as the
  compute's.
- False positives: worst-case rule noise on Equipment (18 vs 10 today), by decision;
  a value whose type is `any`-ish from an unanalyzed construct stays worst case
  forever.
- Disputed expectations: none; two expectations were *added* after this prototype
  found real obligations the legacy checker missed (EquipmentRow `onClick={edit}`,
  the second failing read in m-errored-removed).

## Numbers (results/latest.md, 3 runs)

51/51 expected errors, 0 imprecise, 0 soundness failures, 0 extra errors, 12/12
warnings, 5/5 info; cold: cases 5.4 s total (52 programs, ≈ 100 ms each, dominated
by TypeScript program creation), Equipment 131 ms; incremental EquipmentRow 24 /
21 ms. Vite: build 32 → 149 ms with the plugin (check 144 ms); HMR re-check 23 ms.

## Emit-readiness

Per component the analysis holds: every read with its scope and source name
(`ComponentFacts.reads`), the sources with pending / failure facts, boundaries with
locations, the component's own pending / failure summary and owner path, callback-prop
failure sets, unanalyzed constructs. An optimized emit (lakes / islands) needs exactly
these: which reads are tracked where, which values are settled, where boundaries sit.
Missing: write sets per handler, dependency edges between memos, and per-read
"initialized" facts.
