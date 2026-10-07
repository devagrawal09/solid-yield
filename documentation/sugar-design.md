# Sugar mode: a spelling of the library route

**Current direction (2026-10-08): see [Native mode](#native-mode).** Native source uses Solid APIs; virtual-code typing is decided. The earlier sections record the directive-sugar experiment.

Prototype, 2026-10-07, branch `proto/sugar`, based on `28ff9bb`.
This is the requested follow-up to D-108's C0 Q6 (“sugar after C3”). It does not
restart the parked server-region compiler in D-114, change the runtime, or decide
how authors' source files should be typed.

**Result:** todos can be written without `function*`, `yield*`, `component(…)`, or
`view(…)`. The prototype reconstructs the existing library code. Its generated
code is checked by the existing TypeScript declarations and recommended lint.
The three routine modules match the handwritten twin after the narrow
normalization described below. This is a working transform experiment, **not a
finished TypeScript/editor integration**. Room is a second, harder source design,
with remaining transform gaps recorded below; it is not a verified second twin.

## 1. Surface

A file opts in with `"use yield";` as its first directive, after optional comments.
Unmarked modules retain their existing meaning. The Vite plugin already recognizes
this directive; there is no global default that would reinterpret dependencies.
Use separate files for sugar and explicit routines. This safe default lets them
coexist in the same app and keeps ordinary I/O modules ordinary JavaScript.

A **top-level PascalCase function returning JSX** is a component. Both a named
function declaration and a function/arrow bound to a PascalCase variable work.
Exporting is not the marker: private components work, exported noncomponents stay
helpers. Anonymous default exports and lowercase JSX factories require a name
(`[SUGAR_COMPONENT]`). Tags remain DOM/foreign Solid components; call yield
components, preserving D-065/D-067. Supporting `<Card />` is a separate choice,
not part of “remove generators”.

The conservative component rule avoids inferring that every JSX-returning
callback is a component. An event callback can return a value, an Errored fallback
can be plain Solid code, and a router owns its own callback contract.

### Todos, in full

The complete source is in [todos-sugar/src](../examples/todos-sugar/src), paired
with [todos-yield/src](../examples/todos-yield/src) and
[the original](../examples/originals/todos/src). Its mock API, markup, optimistic
layer, error side-channel, retries, bulk writes, filter effect, and boundaries
are retained. A short excerpt:

```tsx
"use yield";
const TodoItem = function TodoItem(props: Props<{ todo: Todo }>) {
  const { toggleTodo, removeTodo, retryTodo } = useTodos();
  const toggle = $event(function (e: Input) {
    toggleTodo(props.todo.id, e.currentTarget.checked);
  });
  // retry and remove are ordinary $event callbacks too
  return (
    <li class={["todo", { completed: props.todo.completed }]}>
      <input type="checkbox" checked={props.todo.completed} onInput={toggle} />
      <label>{props.todo.title}</label>
    </li>
  );
};
```

`count()` reads a signal/memo; `props.todo.title` reads a path; `TodosContext()`
looks up the context. A bare `count` passes its source. A bare `props.todo` directly
in a component/control prop literal also forwards its source. An expression such
as `Card({ title: count() + " todos" })` becomes a hole prop, evaluated by the
child's read, not eagerly in the caller. This is the D-065 distinction, not a
JavaScript getter installed at run time. An event held in a prop/context is read
before it is called or bound; its failures and may-wait marker still propagate.

The library calls keep their existing names: `$event`, `$effect(compute, effect)`,
`$memo`, `Loading`, `Errored`, `attempt`, `raise`, `refresh`, `readStore`,
`Ctx.provide`, and the root/foreign wrappers. This branch does not invent a
separate `bind`, `on`, or `effect` API. `onClick={save}` reconstructs the existing
Bind operation. `save(args)` reconstructs Call; those are different operations.
The special plain `reset` in an Errored fallback stays plain.

`Props<T>` and explicit `Source<T,E,P>`/`Handler<…>` contracts remain in this
prototype. They describe the virtual library code. The todos `Returned` type
still refers to `Generator` when inspecting an inferred helper's result; that
is a type-layer seam, not authored generator control flow. Replacing these with
ordinary prop/return types is part of the editor facade in §3, not silently
solved by suppressing the source's errors.

### Harder example: room

[room-sugar/src](../examples/room-sugar/src) spells the complete UI modules from
[room-yield](../examples/room-yield/src) in sugar: the app, document, identity
provider, live room route and wire-status component. It retains required identity,
router `foreign(…, { provided: [IdentityCtx] })`, live sources, optimistic sending,
per-row rendering, typed errors, reconnect status, and the streamed summary.
The re-exported, unchanged server I/O modules still contain **async iterable producers**;
they are unmarked foreign I/O, not sugar routines. Eliminating those JavaScript
stream producers would require a different API and is outside this UI transform.

For example, the identity provider becomes:

```tsx
"use yield";
export const IdentityProvider = function IdentityProvider(props: Props<{ children: Element }>) {
  const [me, setMe] = $signal<Identity | null>(null);
  $effect(
    function () {},
    function () {
      if (!isServer) setMe(mint());
    }
  );
  return (
    <>
      {IdentityContext.provide({
        value: me,
        children: function () {
          return <>{props.children}</>;
        }
      })}
    </>
  );
};
function useIdentity() {
  return IdentityContext();
}
```

This example exposes F-S1/F-S4 below: opaque transport callbacks, lazy router
edges, reactive source aliases, and generator-style Errored row fallbacks need
more information than “this callback returns JSX”. **Do not run room-sugar as a
verified app.** Its README lists these specific unsupported sites; todos is the
acceptance target for this prototype.

### Inference, hosts, and refusal rules

A routine is inferred from operations, not just from its name. Seed known library
callback hosts, then propagate routine-ness through calls until stable. Any helper
that reads a source, creates state, delegates a routine, calls an event, or writes
is a routine at **every** call site. Calling it from both an event and a memo does
not produce two implementations. Its operation set must be admitted by both
hosts, so a helper that writes cannot be called by a memo. Host admission is still
checked on the generated library code.

Resolve bindings, import aliases, re-exports, source paths and handler signatures
before applying this rule. A plain callback passed to `map`, a timer or foreign
code is not an implicit routine host. Turning it into a generator would return
an unconsumed iterator, so known reads there are refused at that read. A named
helper must also have a valid calling edge; merely giving a callback a name is
not permission to hand a routine to foreign code. The production design must
check escaping routine references; the prototype's limits are F-S1/F-S3.

For recursion, compute strongly connected call groups, union operations/colors
within each group, then propagate to callers. Read/write sets and finite class /
context sets admit a least fixed point. Polymorphic recursion, unconstrained
higher-order calls and expanding type instantiations require a declared contract
or a diagnostic; `any` is never “no colors”. TypeScript cannot infer every
recursive generator signature. The prototype has a 24-pass convergence guard,
but does not yet implement that full recursive analysis (F-S3).

| Form                                                                   | Rule and diagnostic                                                                                                                                                                                 |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `return <p>{enabled() ? count() : 0}</p>`                              | Allowed. The conditional stays inside the same JSX computation; only its chosen arm runs. No read is hoisted. The static color is a conservative union of both arms (D-112).                        |
| `const n = count(); return <p>{n}</p>` in component setup              | Refused by generated `no-read-in-setup` / SetupOp check. Sugar is not a promise to rerun a component body. Write a memo or read in the JSX hole.                                                    |
| `items.map(() => count())`                                             | `[SUGAR_CALLBACK] … no routine host; use a memo, event, or hole`. A plain selector over already-read values remains plain.                                                                          |
| `for`, `while`, `if`, `return` inside memo/event/helper                | Preserve order and early returns. All operations still need the host's admission. Event loops/early returns have transform tests. Do not turn a component-body reactive `if` into a dynamic branch. |
| Static setup branch returning JSX                                      | Wrap each JSX return with a view. Returning a non-JSX value on another branch is `[SUGAR_RETURN]` in the prototype.                                                                                 |
| `async () => …` as a routine                                           | `[SUGAR_ASYNC]` or `[SUGAR_HOST]`; use synchronous routine code plus `attempt`. A plain async I/O function passed to `attempt` stays plain.                                                         |
| Reactive class/object method                                           | `[SUGAR_HOST]`. Preserving receiver, inheritance, construction and lexical `super` needs a separate rule. Plain data/API methods stay ordinary JavaScript.                                          |
| A routine arrow capturing `this`/`arguments`                           | `[SUGAR_LEXICAL]` for seeded callbacks. Do not change lexical bindings merely to print a generator. General helper arrows are still F-S1.                                                           |
| `throw`, `try/catch`, writes in a memo, async waits in effect phase    | Existing generated lint/type errors. Sugar does not relax these rules.                                                                                                                              |
| Reactive `ref`, JSX spread, spread child                               | Existing one-rule refusal (`YIELD_IN_REF`, `YIELD_IN_SPREAD`, `YIELD_IN_SPREAD_CHILD`).                                                                                                             |
| Authored generator in marked file                                      | `[SUGAR_EXPLICIT]`. Move explicit routines / async iterable I/O to an unmarked module.                                                                                                              |
| Names `component` / `view` already bound in a generated component file | `[SUGAR_NAME]`; prototype reserves its inserted imports instead of shadowing a binding. A production emitter should use fresh aliases.                                                              |

## 2. Transform and correctness

The output is **the library dialect**, before its existing one-rule transform.
It is not the eager-islands or R emitter. Vite then runs the unchanged rule
`yield* e` in a JSX hole → `perform(e)`, followed by Solid's own JSX compiler.
No runtime code or failure branding was changed.

The implementation is in
[packages/vite-plugin-yield/src/sugar.js](../packages/vite-plugin-yield/src/sugar.js).
It builds virtual project snapshots, asks TypeScript about **generated** signatures,
and repeats delegation insertion until stable. This TypeScript query is for
operation recognition, not a decision that source files should use typing route 1.
It follows import/re-export identities across the provided project. It neither
executes user modules nor reads output from the handwritten twin.

The existing analyzer remains the source of ownership, cross-module reach and
provenance facts. [sugar-facts.js](../packages/compiler-yield/src/sugar-facts.js)
passes the reconstructed IR through its `analyzeInstances`/`Analysis` pipeline;
`sugar-check.mjs` saves the live report as `.generated/analyzer.json`. We reuse
that graph rather than making a parallel provenance or boundary implementation.
**Limit:** the existing analyzer expects generators; its S/U/C provenance lattice
is not a pending/failure/wait/context checker. The prototype adds a front end to
recognize sugar operations, then reuses the analyzer on the reconstructed form.
It does not pretend that today's analyzer already infers all four colors.

Rules over resolved routine, read, bind, call, row, hole and boundary facts:

1. Component fact `C(props) { setup; return jsx }` →
   `const C = component(function* C(props) { setup′; return view(function* () { return jsx′ }); })`.
   Keep setup statements once and in order. Do not move effect creation into a hole.
2. Known callback-host fact → generator callback at the same host. Rows with a
   value parameter return `view(function* …)`; zero-argument lazy children return
   JSX directly. Plain Errored accessor fallbacks remain plain.
3. Source-read fact `s()` → `yield* s`; path-value fact `props.x` → `yield* props.x`.
   A context lookup contributes its own requirement; reading its result contributes
   the result source's colors. Do not collapse those two reads.
4. Routine-call / receipt fact `f(args)` → `yield* f(args)`. A source containing
   a handler adds the inner source read before the outer event call. `readStore`
   remains one selector read under the driver, not `select(store())`.
5. Event-bind fact in an event attribute → `yield* handler`. This preserves
   D-085's bind-site boundary and D-075's `w`, not `p`, on the view.
6. Direct source prop fact → retain source; computed prop-read fact → zero-arg
   generator hole. JSX `children` / `fallback` values become lazy callbacks.
   Boundary/provider calls retain their lazy children and original position.
7. Keep all control flow and ordinary calls in order. Refuse unresolved host changes
   rather than quietly running the whole component as a computation.

**Correctness criterion:** generated and explicit routines have the same operation
trace, owner/bind tree, hole granularity, failure branding/routing, context lookup
position, transaction boundaries, setup count, and SSR/hydration behavior. Equal
final text on one screen is insufficient. D-033 permits failing roots; D-087's
attempt over a call catches only branded failures; D-110 uses nominal Failure
instances; D-098 requirements discharge only at the right provider. All survive
because the same operations reach the same driver.

### Reproducible evidence

Run from the root after installing and building:

```sh
pnpm build
node scripts/sugar-check.mjs
pnpm -C examples/todos-sugar typecheck
pnpm -C examples/todos-sugar lint
pnpm -C examples/todos-sugar test
node examples/harness/ssr-smoke/smoke.mjs --only todos-sugar
node examples/harness/hydrate-smoke/hydrate.mjs --only todos-sugar
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

`generate` writes ignored `.generated/src` files. Typecheck and lint operate on
those files, never pretend the authored sugar typechecks. The diff check independently
reads the handwritten twin, joins/sorts `solid-yield` import specifiers, strips
comments, normalizes JSX text with Babel’s standard JSX whitespace rules and prints compact
Babel syntax. It does **not** remove yields, wrappers, calls, types or meaningful
JSX text. All five source modules compare equal, including the three routine
modules `app.tsx`, `todos.ts`, `filter.ts`. A future edit to either twin must keep
this equality or change the acceptance test explicitly.

The existing todo parity script compares each step with the original; the sugar
suite also runs the seven behavior tests. It passes with the existing optional
runtime-cost test skipped. Generated lint has zero errors and the same three
may-wait warnings as todos-yield. The new string SSR smoke renders the actual app
with deterministic adapters for the browser-only mock API. Hydration runs the
real server bootstrap, retains server roots, reports no hydration error, and
adds an optimistic todo with the hydrated event. This is jsdom, not a claim of
real-browser or streamed-todo parity. The harder room app is not part of this
passing evidence.

The gate now discovers todos-sugar as the tenth twin and adds its test/typecheck/
lint plus a separate generated-parity step; existing SSR/hydration steps also
include it. The baseline is not loosened to conceal failures. See the final
verification note for the exact gate result and whether new steps were added to
the baseline.

### Findings: unsupported does not mean semantically weakened

| Finding                                            | Sugar source / site                                                                                                                                           | Why it is not solved                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F-S1: unknown and escaping callbacks               | `setTimeout(() => count(), 0)`; named `const read = () => count(); xs.map(read)`; room `status-pill.tsx` transport `src.onstatus = (state, err) => report(…)` | Anonymous known reactive reads are refused. Full escape analysis, higher-order contracts and lexical arrow captures are not complete. A generator callback would return an iterator to foreign code. Room needs an explicit foreign-event callback classification; don't just delegate it.                                                 |
| F-S2: mapping and editor support                   | `const n = count()` reported at generated setup wrapper                                                                                                       | The prototype prints generated files and returns no sugar source map. No LS plugin, mapped lint locations, completion or color hover ships here. A mapping alone would still leave overload errors attached to a component; provenance-based related locations are needed.                                                                 |
| F-S3: recursion and unknown types                  | `function a() { return b(); } function b() { return flag() ? a() : 0; }`                                                                                      | A bounded iteration is not an SCC color solver; recursive return inference can become `any` before the operation set is known. No theorem claim for such programs. Production must reject unresolved recursive colors or require checked contracts.                                                                                        |
| F-S4: room's callback distinctions                 | `Errored({ fallback: (err, reset) => … })` where the original fallback was a row; `const deaths = props.wire.deaths` aliases a source in setup                | Plain accessor fallback versus row is not recoverable from arity alone. The prototype preserves plain fallbacks, so cannot reproduce every room fallback. Path aliases need a declared source-reference spelling or use analysis; treating this alias as a value read would violate setup admission. Room remains a source design fixture. |
| F-S5: source type facade                           | todos `Returned<typeof createTodos>`, `Props<{ todo: Todo }>`; a component return annotation `: JSX.Element`                                                  | Runtime syntax is plain, but existing annotations target the generated library code. Ordinary sugar return/prop types need a virtual facade (route 1) or a distinct value-only declaration surface (route 2). Explicit component return annotations are not rewritten by this prototype.                                                   |
| F-S6: project/package boundary                     | A sugar helper outside the supplied tsconfig graph or a prebuilt package exporting an unmarked source-shaped function                                         | Vite snapshots the current tsconfig project. It has no project-reference build protocol or published sugar metadata format. Vite reuses an identical project snapshot and clears that cache on watched changes; it does not incrementally update inference. Add checked summaries; do not guess a missing module's effects are zero.       |
| F-S7: exact historical 34-probe corpus unavailable | reviewer 3 §“Deliberate-mistake probe”                                                                                                                        | The log survived, the 34 verbatim files did not. §4 records all 34 slots, including unknown identities. It does not invent missing probes or claim either unbuilt typing route was run.                                                                                                                                                    |

## 3. Typing: worked comparison, not a decision

Suppose `Row` looks up required `SessionCtx`, reads an async memo whose attempt
returns `LoadError`, and binds an event reading that memo and raising `SaveError`.
Its static color is

`κ(Row) = ⟨true, LoadError | SaveError, true, SessionCtx⟩`.

Wrapping the call in `Loading`, `Errored({ catch: [LoadError] })`, then
`SessionCtx.provide` gives `⟨false, SaveError, true, never⟩`. The library root
**accepts it** and a SaveError rethrows at the root. `foreign(Wrapper)` refuses it
until SaveError is handled. An Errored in Row's own view cannot erase an earlier
effect or setup failure. A provider in that view cannot provide Row's setup.
An event's own async attempt alone contributes `A`, not a may-wait `P`; don't
warn about `w` just because there is any asynchronous I/O.

### Route 1: virtual library code, checked by TypeScript

Create a Volar-style language plugin whose virtual file is the reconstructed
library program. The same virtual project drives `tsc` in CI and the editor;
a TS language-service plugin by itself does not make ordinary CLI `tsc` transform
files. Emit declarations from that checked project for mixed explicit/sugar users.
Keep source identifiers/ranges mapped through every pass; generated wrapper
spans map to their source component, and diagnostic origins attach to the read,
bind, effect or call that supplied the rejected color.

[Volar's language-plugin API](https://volarjs.dev/reference/languages/) exposes
virtual code, and its [first-server guide](https://volarjs.dev/guides/first-server/)
shows using it with language services. This is an architecture reference, not a
claim that a solid-yield integration exists.

The author sees `count(): number`, plain prop values and ordinary callback
parameters on source hovers; hovering `Row` additionally shows “pending; fails
LoadError | SaveError; may wait; requires SessionCtx”. A missing Loading points
to the escaping pending read with a related location at the root. The root
SaveError is displayed as a color, not a compile error. Foreign handoff gets
`[FOREIGN_HANDOFF] Handle SaveError before handing Row to plain Solid` with the
originating bind listed. The present prototype shows these types only in the
explicit generated file and keeps raw TS/lint messages there.

**Theorem:** C1 becomes “the generated program typechecks”, C2 applies to authored
contracts and all entering values, C3 to the complete lint of the generated
program (mapped back for the author). C4–C7 remain. Add a lowering-preservation
lemma and trusted mapping/invalidation rules. The existing folds, nominal failure
checks, strict root/foreign checks and runtime proofs remain applicable to the
output. This does not finish the historical proof gaps in calculus §6, and the
todos twin's inherited `any`/assertions mean the twin itself is parity evidence,
not a proof of C2.

**Cost/risk:** one source-to-virtual mapping system, whole-project dependency
invalidation, generics/overloads, declarations, code actions and a source-facing
type facade. The current five full TS passes are a prototype, not acceptable
editor latency. Existing lint rules can be reused on virtual code; running them
on raw sugar would incorrectly report missing yields or miss host checks.
Error locality needs analyzer origin paths as well as position maps: TS cannot
always identify a read from a union rejected at `component(…)`.

### Route 2: compiler-owned colors, ordinary TypeScript values

Give TypeScript a value-only sugar surface; source reads return `T`, components
return JSX. Extend the existing analyzer with the full four-color algebra:
source signatures and operation admission, pending attempts/streams, branded
failure classes, handler return absorption, event bind/call distinction, effect
failures, lazy ChunkError, rows, generic props, context identities and positional
boundary discharge. Solve recursive call groups conservatively. Unknown external
code needs a checked summary or an “unknown color” refusal, not today's S/U/C
provenance value relabeled as an effect.

Expose **one** checker through build, ESLint, and the same LS integration. TS
handles value mistakes. Compiler diagnostics handle `[PENDING_ROOT]`,
`[NO_PROVIDER]`, `[FOREIGN_HANDOFF]`, host/order refusals, and the may-wait warning.
The editor shows exactly the worked color above, but as a compiler annotation,
not a TypeScript return type. A root SaveError remains legal; “unhandled failure”
is information at that edge, an error only at an edge that forbids it. Effect
failure paths can point directly from effect compute to the foreign handoff.

**Theorem:** replace C1's TS color premise with TS value correctness **plus**
sound compiler color/host checking. C2 and C4–C7 still apply. C3's whole recommended
rule set must be either retained on the generated code or reproduced by the
checker, with an explicit equivalence audit. Prove the new fold/discharge/host
implementation against calculus §2 and its 52 obligations, plus lowering. The
runtime theorem is the same; its static witness changes. Current provenance and
reach analysis alone do not prove “typed failures are complete”. Route 2 is not
implemented or validated by this prototype.

**Cost/risk:** stronger control over local messages, but a second implementation
of every library color rule and generic contract, plus cross-package summaries
and versioning. A facade declared `save(): void` loses typed failures unless the
compiler separately sees and checks its summary. Existing type-aware lints that
inspect `Source`, `EventCall`, `[MAY_WAIT]` or `ComponentView` stop working on source
and need virtual-code checking or replacements. Widening all unknowns to “safe”
would violate D-033/D-098 and the theorem; rejecting unknowns increases friction.

### Route 3: make ordinary calls carry colors in TypeScript alone

**Not possible for the requested general surface in stock TypeScript.** A branded
return can carry a color only while the value and its brand remain in the type.
A discarded call, arithmetic, string interpolation, or returning JSX can erase
it. For example:

```ts
declare const colored: (() => number) & { readonly fails: "load" };
function readsThenReturnsZero() {
  colored();
  return 0;
}
function justReturnsZero() {
  return 0;
}
// Both inferred signatures are () => number. No enclosing-call effect union.
```

Changing `colored()` to return `number & Color<LoadError>` still loses the brand
at `return 0`; branding `number` also does not make `+` join effect sets.
`ReturnType` extracts a function's return type, not the effects of statements
inside its body ([TypeScript utility types](https://www.typescriptlang.org/docs/handbook/utility-types)).
An explicit result monad, builder, generator delegation, callback combinators, or
manual color annotations would change the requested surface. Generating those
annotations moves back to route 1 or 2. Stop this route here; it is not a third
viable implementation of “ordinary plain calls, unchanged semantics”.

### Historical recommendation (decision superseded on 2026-10-08)

Recommend **route 1 first**, with compiler provenance used for local messages and
color hovers. It keeps TypeScript's existing color folds as the authority and adds
one main semantic obligation: faithful lowering. Keep route 2 as a serious later
option if editor performance or source-facing generic types prove unacceptable.
Do not ship sugar with only runtime tests and a value-only `.d.ts` facade.

**Decision, 2026-10-08:** Dev chose virtual-code typing for native mode. The
comparison above is retained as design history. There is no remaining request
to fund or choose a compiler-owned checker; the current questions are in Native mode.


## 4. DX evidence and the 34 mistakes

The [corpus inventory and 34-slot table](reviews/sugar-dx.md) separates automatic
repairs, inherited checks, runtime-only outcomes, proposed local messages, and
missing historical evidence. Neither editor/typing route has been implemented,
so its route-specific outcomes are design predictions, not measured pass counts.

## 5. Verified run

[Gate record](sugar-verification.json), 2026-10-07: **50 pass / 0 fail / 0 skip
in 148 seconds**, GREEN against `yield-gate-baseline.json`. All 46 existing steps
passed; the four added steps are todos-sugar test, generated typecheck, generated
lint, and generated-parity. **The baseline was not regenerated or changed.**
`pnpm build` and the sugar production Vite build also passed. The report's `head`
is the base commit because it tested the working tree before the local commits.

The machine's global pnpm launcher incurred registry/version-resolution delays.
The final checks used the already-cached **pnpm 11.1.1**, the repository's pinned
version, on PATH. No dependency versions or checks were relaxed for that workaround.
The final code includes 12 sugar transform tests, generated TS/lint checks, exact
normalized todo-source comparison, the reused analyzer report, original-vs-sugar
DOM parity, SSR, and interactive hydration. No LS implementation or room runtime
parity is claimed. The 34-probe evidence limit remains F-S7.

## Native mode

**2026-10-08 result: a working, deliberately limited native front end; the requested
native todos acceptance target is NOT achieved.** Twenty-one of 37 small fixtures pass
transformed TypeScript and recommended lint. A native counter matches a plain
Solid control in SSR and hydrated clicks, retaining the server button. All nine
original-to-twin inputs are refused. This is a feasibility result, not nine
working native apps or a replacement for the passing directive-sugar todos.

The 2026-10-08 direction supersedes §1's authored library API and §3's open typing
choice. **Virtual-code typing is decided. There is no compiler-owned color checker.**
The editor plugin, value-facing hovers, source maps and related-location messages
remain planned. This prototype runs ordinary TypeScript and the existing lint on
emitted library code. Those type/lint locations are still generated locations;
only native preflight diagnostics currently use authored positions. A later
SUGAR_* diagnostic can also refer to an intermediate position. We do not call
these diagnostics “mapped back” yet.

### Selection and native syntax

No directive, marker or library import appears in a selected source file:

```tsx
import { createSignal, createMemo } from "solid-js";
export function Counter() {
  const [count, setCount] = createSignal(1);
  const twice = createMemo(() => count() * 2);
  const increment = () => setCount(count() + 1);
  return <button onClick={increment}>{twice()}</button>;
}
```

Select a closed source set with the same plugin, before Solid's plugin:

```js
solidYield({
  mode: "native",
  include: file => file.startsWith(appSourceDirectory + "/") && /\.tsx?$/.test(file)
});
```

`appSourceDirectory` must be an absolute normalized path. `include(file)` is an
explicit predicate, not a new glob package; callers may supply their own glob
matcher. Native mode without it is `[NATIVE_INCLUDE] Native mode requires an
explicit include(file) predicate.` Existing `filter` still bounds all processing.
Unselected files keep explicit/directive behavior. Dependencies are excluded by
the default filter. The nearest tsconfig supplies selected project modules; Vite
caches whole source snapshots and invalidates on changes. Do not exclude a module
merely to hide an unsupported routine or failure from the check.

The installed **solid-js 2.0.0-rc.13** declares `createContext<T>(defaultValue?,
options?)`, `useContext(context)`, and a context provider used as
`<Context value={value}>`. Its client declarations explicitly say there is no
context call form. `createEffect` has separate compute and effect phases; `For`
has three different keyed callback shapes. These facts were checked in the
installed `types/client/core.d.ts`, `types/client/flow.d.ts`, and re-exports in
`types/index.d.ts`; this design does not assume Solid 1 APIs.

### Mapping table

“Implemented” describes this prototype; other entries are required design work,
not silent fallbacks to native reactive state inside a library routine.

| Native source | Library output / contract | Prototype |
| --- | --- | --- |
| `createSignal(v)` / getter `count()` / setter `set(v)` | `$signal(v)` / `yield* count` / `yield* set(v)` | Implemented; option/value compatibility checked on output |
| `createMemo(() => expression)` | `$memo(function* () { return expression′; })` | Synchronous and async producers use inferred `attempt`; async reactive reads remain refused |
| `createEffect(compute, effect)` | `$effect(compute′, effect′)` (the actual export is `$effect`, not `effect`) | Two synchronous function phases; bundle/cleanup-return overloads incomplete |
| `onCleanup(fn)` | `$cleanup(fn)` | Same owner position; generated host checking still required |
| Inline `onClick={e => …}` and other `onX` props | `yield* $event(function* (e) { … })` at binding site | Implemented for intrinsic tags; event parameter receives its DOM type |
| Local synchronous `onClick={fn}` | `yield* $event(function* (...args: Parameters<typeof fn>) { return fn′(...args); })` | Implemented; calls to a reactive helper delegate; unresolved/property handlers refused |
| `createContext<T>()` | `createContext<T, ID>(undefined, { name: ID })` | Compiler-generated module-and-binding identity; no author name marker |
| `<Ctx value={v}>children</Ctx>` | `Ctx.provide({ value: v′, children: function* () { … } })` | Local and directly imported selected contexts; same provider location |
| `useContext(Ctx)` | `yield* Ctx`, followed by source reads where its value is used | Implemented; requirement checked at root; no provider insertion |
| Plain typed `props.x` | Generated `Props<T>` plus path reads | Simple identifier parameter; destructured parameters refused |
| `<Child p={v}/>` | `yield* Child({ p: v′ })` | Local/direct selected imports; foreign tags need a boundary contract |
| `For` / `Show` / `Loading` / `Errored` etc. | Same library calls with lazy children, row views and bound events | Basic forms; default For row-value mapping; nondefault keyed modes refused; complex fallback forms remain limited |
| `render` / `hydrate` from `@solidjs/web` | Library `render` / `hydrate` | Direct named component form; generated root checking required |
| `throw X` | `raise(nativeFailure([class IDs or "unknown"], X))` | Implemented for synchronous routine hosts; see Failure inference |
| Async/server-function memo | `attempt(() => f(), e => nativeFailure(inferredSet, e))` | Async producers and Promise-returning calls; server calls add `ChunkError` |
| `action`, optimistic stores, projections, `onSettled`, `latest`, `isPending`, router/lazy edges | Dedicated library mappings with transaction, selector, owner and foreign-boundary checks | Not implemented; `[NATIVE_API] Solid API NAME has no verified native lowering.` |

### Failure inference

**Dev's ruling, 2026-10-08: option A is implemented as a prototype.** Source files
still import only Solid. Failure inference supplies types to generated `raise`
and `attempt`; it is not a second checker for component admission, pending,
may-wait, requirements, or boundary discharge. Those remain generated TypeScript
and the existing recommended lint. The editor/virtual-code plugin is planned.

`nativeFailures` reuses the compiler analyzer's parsed modules, scopes, module
identities and directives. TypeScript resolves selected call targets, aliases,
re-exports and the types of throw expressions. A worklist-equivalent monotone
iteration unions callee sets until no set changes; recursive groups have no
arbitrary inference iteration limit. This differs from the older sugar emitter's
24-pass guard. Calls outside the selected graph contribute `unknown`, except
selected `"use pure"` contracts. Native primitive callbacks and memo reads carry
their producer's set. This analysis is conservative: opaque router calls, browser
APIs and data-method calls often produce `unknown`; it does not infer package
purity from a familiar function name.

- `throw new X(...)` or `throw value` whose TS type is a class instance adds X's
  declaration identity. Class unions add all members. Constructors, inherited
  constructors and instance field initializers also contribute their failures.
- `throw e` with unknown/any, a string or an object literal adds `unknown`.
  Unknown is accepted, not a transform refusal, and does not erase known members.
- Direct rethrow of a catch binding retains the incoming set. A handling catch
  removes it. Using the binding as unknown and rethrowing widens to `unknown`.
  The analysis also covers Promise `.catch` and `try`/`await`; `finally` adds its
  own failures. General JavaScript catches in reactive routines are **still
  refused by `NATIVE_CATCH`** because their control-flow lowering is unfinished.
  Inference tests do not establish that a refused catch transforms correctly.
- A `"use server"` function's rejection set is its inferred set plus `ChunkError`
  (D-100). An async server producer wraps its rejection before serialization;
  its client call is generated behind `attempt` with that declared set. A
  nonmatching transport rejection becomes the existing `ChunkError`. Opaque
  server I/O still adds `unknown`; there is no invented Promise rejection type.

External/structural class witnesses remain F-S18; the following checked adapter
path covers registered selected classes and built-in Errors.

The generated mechanism is a **wrapper**, not mutation of the author's Error.
Each selected class is registered under `relative module#class@declaration`, so
same-named classes in different scopes/modules are distinct. Built-in errors use
IDs such as `global:Error`. `NativeFailure<ID>` extends the existing private-brand
`FailureInstance<ID>` and retains the original thrown value. A literal-kind union
is a union of these wrapper types. `raise` and `attempt` therefore keep their
existing `KindCheck`, failure branding and driver behavior. Unexpected values
outside the compiler witness raise `[NATIVE_FAILURE_CONTRACT] A rejection is
outside the inferred failure set.` They are never mislabeled as a known class.
Class IDs currently depend on source positions and must come from the same build
on both sides; they are not a stable public wire schema.

An ordinary Errored fallback receives the unwrapped value. In the **same realm**,
`caught instanceof X` remains true, including a frozen author Error. Across the
stream, the wrapper's kind and safe message survive; the original custom
prototype does **not** get revived, so `caught instanceof X` is false for a custom
class. The client reconstructs the typed wrapper from the wire's kind. It does
not invoke user constructors or pretend to restore private fields. This is a
remaining native equivalence limit (F-S14), not an implemented class reviver.
A public root currently rethrows the generated wrapper; boundary unwrapping does
not yet cover arbitrary external catches (F-S15).

D-115 is preserved: the wrapper's base calls `markSafeError`. Both the server suite
and `NODE_ENV=production node scripts/native-serialization.mjs` verify that the
production stream contains `NativeFailure`, its class ID and public message.
This is serialization evidence, **not** end-to-end RPC transport parity. Selective
`Errored catch={[X]}` also needs generated class-specific matching; the single
wrapper constructor does not implement that contract yet (F-S14).

D-033 is unchanged. At a library root, a declared failure may escape and is
re-thrown/rejected. At a foreign handoff it must be handled. The executed
`class-memo` and `unknown-memo` bridge probes both produce TS2345 with
`[FOREIGN_HANDOFF]`. Unknown is not an exemption. Full-original diagnostics below
are transform blockers, not fabricated unhandled-failure errors for code that
never reached the generated checker.

The theorem “typed failures are complete” is **not newly proved for native
source**. Its existing hypotheses apply to accepted generated code. Re-read:
C1 (generated typechecking), C2 (distinct kinds/no erasure), C3 (generated lint),
C4 (one runtime/route), C6 (foreign/server edges), C7 (typed/brand premise), and
§2's class vocabulary. The affected implementation obligations include O2
(`FailsOf` union), O6 (always-raising holes), O11–O13 (memo/wait/effect admission), O16 (attempt handlers), O17–O21 (propagation and
memo coloring), O22–O29 (memo routing/cancellation, boundaries and fallback subtraction), O35–O40 (events
and handling), O41–O43 (effects, roots and foreign checks), O45 (transport), and
O52 (kind checks). In particular re-read T4's `Exclude`/`instanceof` mismatch.
New obligations are sound call resolution and fixpoints, catch subtraction,
unknown coverage, class-ID injectivity, constructor/producer wrapping, and
wire encode/decode with matching identities. No proof files changed.

### Routine rule and current limits

The target rule is still the closure over a component's reachable call graph:
any function that reads a reactive source (or creates/writes/delegates) is a
routine at every call site. Calling the same helper from a memo and an event
must retain both hosts' admission checks. A conditional or loop remains in its
original position; its operations are not hoisted. Components are top-level
PascalCase JSX-returning functions; native tags become calls, unlike historical
§1. No callback becomes a routine merely because it is nested in a component.

The front end changes native imports, component props, context/value reads,
event bindings and JSX contracts before reusing `lowerSugarProject`. Its
cross-module TS fixed point inserts operations into the reconstructed files.
The **existing** compiler analyzer consumes that explicit IR through
`sugarFacts` for provenance/reach; no second ownership or color checker was
introduced. The additional failure pass supplies generated type witnesses. Direct selected component imports are tested. Imported function
contracts such as native `Accessor`, re-exports of context/component tags,
recursive groups and generic return-type facades are not fully implemented.
The 24-pass guard is not a proof of recursive inference. These are implementation
gaps, not claims that ordinary Solid disallows those programs.

### Disagreements and executable fixtures

Every snippet below has an executable counterpart in the native transform tests or
[scripts/native/fixtures.mjs](../scripts/native/fixtures.mjs). The full source and
actual messages are preserved in [native-verification.json](native-verification.json).
The report distinguishes transform refusals from generated type/lint errors.
A refusal in this table may reflect an unfinished prototype mapping, rather
than a fundamental incompatibility.

| Native case (tiny fixture) | Outcome | Actual diagnostic / observation |
| --- | --- | --- |
| `count() > 0 ? count() : 0` in JSX; event loops/early returns | Faithful lowering on tested forms | `conditional`, `loop`: generated TS/lint pass |
| `createMemo(() => [1].map(() => count()))` | Refusal | `SUGAR_CALLBACK`: “A reactive read in an unknown callback has no routine host; use a memo, event, or hole.” |
| `onClick={() => Promise.reject("failed")}` | Transform | `promise-event` passes generated TS/lint; failure is `unknown` |
| `createMemo(async () => count())` | Refusal | `SUGAR_HOST`: “Reactive operations in async functions or methods are unsupported.” |
| `throw new Error("oops")` / `throw e` with `e: unknown` | Transform | `throw-error`, `unknown-throw` pass generated TS/lint; fails `Error` / `unknown` |
| `try { set(1) } catch { set(2) }` | Refusal | `NATIVE_CATCH`: “JavaScript catch handles arbitrary throws; attempt handles declared failures. This catch needs a checked failure contract.” |
| `useContext(C)` with no provider at root | Transform, then diagnostic | TS2345 includes `[NO_PROVIDER] the root requires the contexts this property names…` |
| Unhandled failure at a library root | **Allowed by D-033 once nominally typed** | The native root fixture passes. The class/unknown foreign bridge probes fail `[FOREIGN_HANDOFF]`. |
| `const n = count(); return <p>{n}</p>` | Transform, then diagnostic | TS2769; lint `[READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.` |
| `const x = <p>{count()}</p>` in setup | Transform, then diagnostic | `jsx-only-in-view`: “JSX in a setup: elements are built by the view it returns…” |
| `createMemo(() => { set(1); return count() })` | Transform, then diagnostic | TS2345: generated `Write` is not admitted by `MemoOp` |
| `createEffect(() => memo(), n => { set(n + 1) })` where memo reads that signal | Transform; **cycle not diagnosed** | `feedback` passes TS/lint. No termination guarantee; no runtime execution of this deliberate infinite feedback fixture. |
| `createEffect(() => {})` | Refusal | `NATIVE_EFFECT_PHASES`: “createEffect needs a tracked compute and an untracked effect phase.” This is also invalid under the installed native two-phase signature. |
| Async effect phase | Refusal | `SUGAR_ASYNC`: “Use attempt inside a synchronous routine; async functions are not routines.” |
| `{ read() { return count() } }` | Refusal | `SUGAR_HOST`: “Reactive operations in async functions or methods are unsupported.” |
| State creation in JSX hole | Refusal in this prototype | `SUGAR_CALLBACK` while reconstructing the nested call; no claim of reaching the host-type check |
| `<button {...attributes}/>` / `<button ref={fn}/>` | Refusal | `NATIVE_SPREAD` / `NATIVE_REF`: hidden bindings and ref ownership need verified contracts |
| Event handler using `this` | Refusal | `NATIVE_RECEIVER`: “An event handler using this needs a verified receiver-preserving binding.” Tested in `native.test.js`. |
| Named synchronous local handler | Faithful lowering on tested form | `named-event`: generated TS/lint pass; counter hydration exercises it |
| `createEffect(compute, {effect: fn})` | Refusal in this implementation | `SUGAR_CALLBACK`; native effect bundles still need a dedicated mapping |

A native effect compute can also fail through a plain throw. The library deliberately
routes effect failures differently from Solid's log-and-skip path (runtime.ts,
D-073). “Map createEffect” therefore needs an explicit failure-semantics agreement,
not just renaming the call.

### Nine original-to-twin results

**F-S9 acceptance is now parity against the original itself**, including SSR and
hydration. The handwritten twin diff is information only. There are seven
original directories and nine original-to-twin inputs; the `-h` targets reuse
todos and sierpinski. The audit reruns all nine. None emits a checked complete
app, so original parity, hydration and SSR are blocked, not failed or passed.
The diff distance is undefined for every refused output.

These are **source call-graph estimates**, not checked generated component colors.
Unknown is retained alongside named failures. `∅` means no inferred failure in
this scan, not proof of purity for arbitrary JavaScript. All current diagnostics
are blockers; zero complete apps reached the unhandled-failure check.

| Original / twin target | Status | Parity / SSR / hydration | Inferred fails per component (grouped) | Diagnostics |
| --- | --- | --- | --- | ---: |
| docs-yield | Refused | Blocked | Home/DocPage/ArticleContent/ReadingGuide → {ChunkError, NotFound, unknown}; App → {ChunkError, NotFound, SearchError, unknown}; SiteNav/SiteFooter → {ChunkError, unknown}; ArticleBody/ThemeToggle/ImageCarousel → {∅}; Shell/LikeButton/NewsletterForm/CommentList → {unknown}; SearchBox → {SearchError, unknown} | 8 |
| effect-yield | Refused | Blocked | LogPanel/App/Checkout/Results/Typeahead → {unknown} | 19 |
| hackernews-spa-yield | Refused | Blocked | App/Stories/Story/User → {unknown}; Comment/Nav/Story/Toggle → {∅} | 3 |
| rendering-yield | Refused | Blocked | InnerBoundaryItem/OuterBoundaryItem/ErrorStream/Home/AsyncCard/RevealPage/Settings/Shell/Skeleton/Stream → {unknown}; Profile/FeedCard → {∅}; Link → {Error} | 18 |
| room-yield | Refused | Blocked | Document/App/StatusPill/IdentityProvider/Home/Panel/Composer/Live/Header/Chat/Transcript/Directory/DirectoryEntry/Card/Summary/SummaryText/Archive → {unknown}; Chaos → {∅} | 30 |
| sierpinski-yield | Refused | Blocked | TriangleDemo/Triangle → {unknown}; Dot → {∅} | 1 |
| sierpinski-yield-h | Refused | Blocked | TriangleDemo/Triangle → {unknown}; Dot → {∅} | 1 |
| todos-yield | Refused | Blocked | Header/TodoItem/MainSection/Footer/App → {unknown} | 14 |
| todos-yield-h | Refused | Blocked | Header/TodoItem/MainSection/Footer/App → {unknown} | 14 |

The report lists each component's file and line, including duplicate local names.
Route examples an author could read in a future hover:

- docs `DocPage`: **fails NotFound | ChunkError | unknown**.
- docs `App`: **fails NotFound | SearchError | ChunkError | unknown**.
- todos `App`: **fails unknown** (opaque action/store/I/O calls).

The named class IDs resolve to the original `docs/src/errors.ts` declarations;
there are no author imports from the library. These hovers are proposed display
text for actual inferred sets; no editor plugin was built.

Actual refusal messages (every source position is in the JSON evidence):

- `NATIVE_API`: Solid API markSafeError has no verified native lowering.
- `NATIVE_API`: Solid API HydrationScript has no verified native lowering.
- `NATIVE_API`: Solid API createOptimistic has no verified native lowering.
- `NATIVE_API`: Solid API action has no verified native lowering.
- `NATIVE_GENERATOR`: Solid action/stream generators need a separate suspension and rejection mapping.
- `NATIVE_CATCH`: JavaScript catch handles arbitrary throws; attempt handles declared failures. This catch needs a checked failure contract.
- `NATIVE_API`: Solid API createOptimisticStore has no verified native lowering.
- `NATIVE_API`: Solid API createStore has no verified native lowering.
- `NATIVE_API`: Solid API refresh has no verified native lowering.
- `NATIVE_API`: Solid API isPending has no verified native lowering.
- `NATIVE_API`: Solid API latest has no verified native lowering.
- `NATIVE_API`: Solid API Component has no verified native lowering.
- `NATIVE_API`: Solid API lazy has no verified native lowering.
- `NATIVE_API`: Solid API onSettled has no verified native lowering.
- `NATIVE_API`: Solid API Reveal has no verified native lowering.
- `NATIVE_API`: Solid API createUniqueId has no verified native lowering.
- `NATIVE_API`: Solid API Portal has no verified native lowering.
- `NATIVE_TYPE`: This Solid value contract needs a virtual routine/source type facade.
- `NATIVE_API`: Solid API createProjection has no verified native lowering.
- `NATIVE_API`: Solid API isServer has no verified native lowering.
- `NATIVE_API`: Solid API getRequestEvent has no verified native lowering.
- `NATIVE_API`: Solid API dynamic has no verified native lowering.
- `NATIVE_API`: Solid API until has no verified native lowering.
- `SUGAR_CALLBACK`: [SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole. (<root>/examples/originals/sierpinski/src/main.tsx:65:27)

No original was added as a passing app gate. Counter parity and the new production-failure serialization check are controls, not substitutes for todos parity.


### Further findings

| Finding | Source and reason |
| --- | --- |
| F-S8: superseded refusal policy | Original todos `reject`: `setTimeout(rej, time, "Failed to Save")`; store `async () => { const todos = await api.getTodos(); … }`. The rejected value can be a string or anything else. Raw `unknown` cannot satisfy nominal `Failure` (D-110); a generated wrapper now does. TS return types do not declare throws. Dev chose inference with an unknown floor. The adapter above removes NATIVE_FAILURE/NATIVE_REJECTION. Remaining identity/transport limits are F-S14/F-S15. |
| F-S9: handwritten target is not a transliteration | Todos Header has no signal/memo in the original; the yield twin adds unused `$signal`/`$memo`. Original calls `addTodo` then clears input; twin clears before delegated waiting. The twin changes the context tuple into an object, adds `TodoApp`, moves store creation/provider relative to Errored, and changes derived accessors into memos. These are categorized as extra operations, event order, data shape, owner/boundary placement and memoization. Whitespace/import normalization cannot erase them. A general compiler must not invent this source-specific rewrite to win a diff. |
| F-S10: unfinished native contracts | Todos `action(function*(){ try { yield request } catch { … } })`, `createOptimisticStore`, `refresh`, `onSettled`; room streams/foreign callbacks; native `Accessor`/Component annotations. Dedicated lowering, selector placement, external-call summaries and alias/re-export support remain. `[NATIVE_API]` is an implementation limit, not a claim of mathematical impossibility. Preflight still refuses authored catches in selected files; plain throws/rejections are no longer refused. |
| F-S11: static feedback limit | `feedback` passes generated TS/lint. The types check which phase may write, not whether repeated effects terminate. A separate optional feedback analysis needs provenance and a clear policy; it must not be confused with the typed-failure theorem. |
| F-S12: complete native proof not established | Only a small synchronous subset has behavioral evidence. Generated checks and counter parity do not establish lowering preservation across all native primitives. Source diagnostic mapping, stable public context IDs, package summaries and routine recursion facades remain; failure recursion has fixpoint tests. |
| F-S13: scheduling callbacks | Original sierpinski: `setInterval(() => setSeconds(s => (s % 10) + 1), 1000)` and `requestAnimationFrame(update)`. No checked owner/bind/disposal contract exists for these foreign callbacks. Actual refusal: `SUGAR_CALLBACK`. Supplying library type resolution for original directories exposed this earlier-hidden error; a previously emitted but untyped file was not a valid transform. |
| F-S14: wire/custom class matching | `class X extends Error {}; throw new X()` inside a server producer. Class ID/message survive production serialization, custom prototype/private slots do not. Selective native `catch={[X]}` has no generated wrapper matcher. Full original RPC and selective-catch parity remain unproved. |
| F-S15: external exception identity | `try { nativeRoot() } catch(e) { e instanceof X }`: the root currently rethrows NativeFailure, while native Errored fallback calls unwrap. An external root adapter is needed to preserve native exception identity without erasing typed identity inside the driver. |
| F-S17: production sanitization changes plain-Solid behavior | `FailureView.tsx`: `class Problem extends Error {}; throw new Problem("author failure")`. Under a production SSR Errored, the original renders `wrong identity` because Solid sanitizes the unmarked error. Native mode renders `author failure` because D-115 marks its generated wrapper safe and the fallback unwraps the original. This observed difference is pinned in `native-serialization.mjs`; it is not called parity. Dev's D-115 ruling requires this behavior, but strict parity for apps that inspect an unsafe error needs an explicit exception. |
| F-S18: class witnesses at structural/external edges | `class X { x = 1 }; const e: X = { x: 1 }; throw e`, or an instance whose class declaration is in an opaque package. TS may report a class type without a selected, registered runtime constructor. Inference lists X, but the runtime adapter can report NATIVE_FAILURE_CONTRACT. A sound native class contract needs generated witnesses for these edges; existing TypeScript structural typing alone does not prove the new nominal premise. This is a proof/coverage gap, not an unknown-throw refusal. |
| F-S16: prototype packaging | The native front end imports the private analyzer by workspace-relative path. The repository gate covers this checkout; publishing the plugin alone requires a shared analyzer package or bundled inference/index implementation. |

Under virtual-code typing, the theorem's premises apply to the **generated**
program (C1 and C3), with the same no-erasure/nominal/foreign/runtime assumptions
(C2, C4–C7) and an additional lowering-preservation obligation. The generated unknown wrapper meets the failure premise; it does not finish the
native lowering-preservation argument.
No compiler-owned checker or new theorem is claimed.

### Reproduce and remaining questions for Dev

```sh
node scripts/native-check.mjs           # exact diagnostic snapshot; includes generated TS/lint
node scripts/native-runtime.mjs         # counter SSR + hydrated parity control
# To deliberately update reviewed evidence:
node scripts/native-check.mjs --write
```

The 34-slot native DX ledger is appended to [sugar-dx.md](reviews/sugar-dx.md).
It runs reconstructions for the 27 named categories and marks the seven missing
historical identities unavailable. It does not invent seven successful tests.

The typing route, unknown floor, throw inference, and original-parity acceptance
are settled. Remaining questions for Dev:

1. Should native v1 revive registered custom prototypes after server transport,
   or explicitly keep a value/ID contract? Private fields and arbitrary
   constructors prevent a general transparent reviver. This also affects selective
   catches and public-root exception identity (F-S14/F-S15).
2. Confirm the next scope: implement todos' action/optimistic-store/onSettled and
   catch lowering, then its genuine original parity; defer unsupported router and
   timer callback contracts. No source edits or marker APIs should be required.
3. Does F-S17's required D-115 sanitization difference count as an intentional
   exception to original parity? The production fixture preserves the native
   public message while plain Solid replaces its unmarked Error.
4. Should opaque package calls remain conservatively `unknown` indefinitely, or
   may packages ship trusted `"use pure"`/failure summaries with a versioned
   contract? Class-ID stability needs the same build/version policy.

The editor plugin remains planned, not built here.

### Native verification and baseline

The [full gate record](native-gate-verification.json) covers the current native
failure implementation. `pnpm build` passed. The gate includes generated TS/lint
for 37 native fixtures (21 accepted), two strict foreign-edge probes, all nine
original audits, counter SSR/hydration, the production failure-serialization
control, six inference tests, and the existing library/plugin/analyzer/proof/twin
checks. Generated failure adapters have four runtime unit tests and a server
stream test. Native editor diagnostics remain unmapped; no editor plugin or
proof extension is claimed.

**This update regenerated the baseline only to add one passing step:**
`native:failure:production-serialization`. All 52 prior PASS entries remain.
The earlier update's six additions are already part of those 52; they were not
added again. No byte threshold, runtime admission rule, proof, or existing test
was relaxed. No complete original passed native transformation, so none was added
as a passing application. The nine-row table's parity status remains blocked.

Final verification (2026-10-08), code `2a230e6` plus the documentation
working tree: **53 pass / 0 fail / 0 skip in 131s**, GREEN against all 53
baseline entries. The preceding run was also GREEN (53/0/0 in 132 seconds),
with the single added step verified before regenerating the baseline.
