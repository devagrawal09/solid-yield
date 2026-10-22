# The shared vertical slice

Both prototypes check exactly this subset of plain Solid 2 (solid-js / @solidjs/web
2.0.0-rc.17), on the same fixtures (`fixtures/`), emitting the codes in
`src/codes.mjs`. Everything outside the subset is a partial-check boundary: a
`UNANALYZED_BOUNDARY` warning at the construct, and every value flowing out of it
is the worst case (possibly pending, possibly failing with `unknown`). Never trust
it, never go silently green.

## Inside the subset

**Components.** A function (declaration, const arrow, or `Component<P>`-typed
arrow) that returns JSX (an element, fragment, `null`, a ternary / `&&` of them, or
a call to a flow control) and is either exported or rendered from the same
project. Its *setup* is the body before the return; its *view* is the returned
JSX. `render(() => <App />, el)` / `render(App, el)` from @solidjs/web is the
render root.

**Signals and memos.** `createSignal`, `createMemo`, `createAsync` (rc.17's
`createAsync` and an async memo `createMemo(async () => …)` are both "async
sources"). A getter call is a *reactive read*; a setter call is a *write*.
`untrack(fn)` makes reads inside untracked and is not reported.

**Props.** `props.x` where `props` is the component's parameter. A prop is
*reactive* when some caller passes a reactive expression for it (a getter call, a
memo read, another reactive prop, a JSX expression containing a read) and
*held* when every caller passes a constant (a literal, a plain function, a
non-reactive local). A read of a reactive prop in setup is
`STRICT_READ_UNTRACKED`; a held prop may be read anywhere. Destructuring
`props` in the parameter list or in setup is a setup read of every destructured
reactive prop. A prop carrying a possibly-pending / possibly-failing value
carries that obligation into the child (D-119): the child's reads obligate a
Loading / Errored boundary in the child **or** in the caller above the child.
Callback props (`onSelect: (id: string) => void`) are held functions. Calling one
fails with the union of the failure sets of the functions its callers pass
(`setSelected` never fails; `() => { throw new RangeError() }` fails with
RangeError), transitively through forwarding (`onSelect={props.onSelect}`);
when any caller is unanalyzable (a spread, a component handed out as a value, no
caller in the program) the set is `unknown`.

**Scopes.**
- *setup*: the component body outside memos/JSX/handlers; also the body of a
  sync helper function that is called from setup.
- *tracking*: a JSX expression container, a memo / createAsync compute, an
  effect's compute (`createEffect(compute, effect)` first argument), the
  render-prop callbacks of `Show` (`when` / children-as-function) and `For`
  (`each` / row callback), and a sync helper called from one of those.
- *handler*: a function passed to a JSX `on*` attribute (lower- or camel-case),
  or passed as a callback prop, or an async helper called from a handler; also
  the handler-like callbacks that run on their own later — a promise
  continuation (`.then`/`.catch`/`.finally` callback), a timer callback
  (`setTimeout`, `setInterval`, `queueMicrotask`, `requestAnimationFrame`), a
  `ref` callback. Reads there are not reported as untracked; failures escaping
  them are `UNHANDLED_HANDLER_FAILURE`.
- An object literal's getter is a sync helper: reading `o.double` runs the getter
  in the reader's scope.
- *effect*: an effect's effect function (`createEffect`'s second argument).
- Nested functions: a sync local helper runs in the scope it is called from; an
  async helper runs as a handler-like scope (its reads are not reported as
  untracked in this slice — see "Not decided" below).

**Pending.** An async source is possibly pending. A memo whose compute reads a
possibly-pending value is possibly pending. A JSX expression reading one needs a
`<Loading>` ancestor within the component's view, else the component is pending;
a pending component rendered by a caller needs a `<Loading>` ancestor there, and
so on to the render root, where the obligation becomes
`ASYNC_OUTSIDE_LOADING_BOUNDARY` (reported at the read, with the root as a
related location). `Show` / `For` are transparent to pending and failure.
A possibly-pending read in setup is `PENDING_ASYNC_UNTRACKED_READ` (reported
instead of, not in addition to, `STRICT_READ_UNTRACKED`). A possibly-pending
read in an effect's effect function is `PENDING_ASYNC_FORBIDDEN_SCOPE`.

**Failures.** A `throw` reachable in a memo / JSX / async compute, a call to a
project function whose body may throw (inferred transitively through analyzable
bodies), an `await` of a possibly-rejecting promise, or a call with no failure
information (unknown) makes the rendered work possibly failing; it needs an
`<Errored>` ancestor, else the component is failing; at the render root the
obligation is `ERROR_OUTSIDE_ERRORED_BOUNDARY`. The set of failure types is
reported where known (`Error`, a class, `unknown`). A handler (sync or async)
that may throw / reject with nothing catching it inside the handler is
`UNHANDLED_HANDLER_FAILURE` (at the attribute binding). `try/catch` catches
everything in its block (a catch that rethrows does not); `try/finally` catches
nothing; `.catch(fn)` handles a promise's rejection; `await` inside `try`
catches the rejection. Setter calls, platform DOM property reads/writes,
`event.preventDefault()`, string / array / Math methods, `Promise.resolve`,
`console.*` do not fail. Any other platform / package call is unknown
(worst case), *and* so is any call through a value with no analyzable body
(a prop callback, a context value's method, an injected API).

**Writes.** A setter call in a memo compute or a JSX expression or the setup
body is `REACTIVE_WRITE_IN_OWNED_SCOPE`. Setters in handlers and effect
functions are fine.

**Promises without a body.** A call whose declared return type is `Promise<T>`
and whose body is not analyzable (a platform API such as `fetch`, an injected
function, a context method) does not throw synchronously; its failure is a
rejection (`unknown`) carried by the promise: `.catch(fn)` or `await` inside a
`try/catch` handles it, a bare `await` or a dropped promise lets it escape.
Solid APIs in the subset never fail: setters, `Errored`'s fallback `reset`,
`untrack`, `event.preventDefault()`.

**Boundaries.** `<Loading fallback=…>` discharges pending below it;
`<Errored fallback=…>` discharges failure below it. Both from solid-js rc.17.

**Roots and hand-offs.** `render(…)` from @solidjs/web is a root. A component
that escapes as a value (`{ component: Page }`, an argument to a non-project
function, an exported object holding it) is a hand-off and is treated as a
root: its undischarged obligations are reported at the read, with the hand-off
as a related location. A component that is merely exported and never rendered
or handed off in the program is NOT an error: the checker emits the info-level
`COMPONENT_OBLIGATIONS_EXPORTED` (structured channel only) and the facts travel
with the component (its renderers are checked where they are).

## Outside the subset (warn + worst case)

`useContext` / context providers (next area: "context/services"), reactive
state created outside a component (state factories such as
`createEquipmentService(api)` — warned at the call site, its result worst case;
module state), stores
(`createStore`, `createOptimisticStore`), `createEffect` beyond the two-argument
form, `createResource`-era APIs, JSX spreads (`{...props}`), dynamic components
(`<Dynamic>`, `props.children` calls), `lazy`, `Portal`, refs, generics on
components, class components, recursion through unanalyzable calls, any
construct a prototype does not model. The warning's message names the construct
and what is assumed of it.

## Not decided here (prototypes make a call and record it in their NOTES.md)

- Whether a read of a possibly-pending value inside an **event handler** is
  reported. rc.17 serves the stale value while refreshing and throws only while
  uninitialized; the slice does **not** report it (an "initialized" fact is
  needed). Record if your prototype differs.
- How a component's pending / failing summary is attached (phantom type on the
  return type vs. a side table) — that is what the prototypes differ on.
- Reads inside an async helper after an `await` (runtime
  `UNTRACKED_READ_AFTER_AWAIT`): not in the slice.

## Fixtures (see fixtures/index.mjs)

Three groups, identical for both prototypes:
1. `cases/` — single-file cases from `scripts/native/fixtures.mjs` and the
   native test suites, copied byte-identically; each has today's legacy
   expectation (code + line) and the slice expectation (sound codes + line).
2. `equipment/` — the Equipment Checkout app's `src/` (10 files, byte-identical,
   read-only reference). `EquipmentRow.tsx` is the HMR-timed component.
3. `mutants/` — negative controls derived from in-subset positives by deleting a
   boundary or a catch, or moving a read into setup. **Each must be reported**;
   a miss is a soundness failure the harness prints prominently.

Severity policy (Vite): errors show the dev overlay but the server keeps
serving; `vite build` fails on errors; warnings (including
`UNANALYZED_BOUNDARY`) never fail anything; info is structured-channel only.
