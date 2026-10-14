# Sugar mode: a spelling of the library route

**Current direction (2026-10-08): see [Native mode](#native-mode).** Native source uses Solid APIs; virtual-code typing is decided.

**What ships (D-120, 2026-10-10):** native files ship as written, as plain Solid. The lowering is the checker's model (`solid-yield check`, the editor plugin); the Vite plugin emits it only with `emit: "lowered"`, which the parity harnesses use to run the model against the original. Rewriting returns when it lowers all the way to an optimized output. The earlier sections record the directive-sugar experiment.

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

## Typing: implemented

The `proto/sugar-ls` follow-up implements D-116's virtual-code route in
[ts-plugin-solid-yield](../packages/ts-plugin-yield/README.md): the standard
TypeScript language-service plugin and `pnpm solid-yield check <dir>` share the
Vite native/sugar lowering and its composed generated-to-source position tables.
The library's generated types remain the authority for pending, failures,
may-wait and required contexts; the adapter maps and explains those errors.
[The typing report](sugar-typing.md) records ten recoverable review slots at their
offending authored lines, three component hovers, a real tsserver protocol test,
and remaining limits. The two native original gate typechecks now use the CLI.
Earlier “no editor plugin” and F-S2 statements below are historical checkpoints;
editor UI behavior, full mapped editing features and Vite runtime sourcemap
composition remain unverified or unimplemented as recorded in that report.

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
| `items.map(() => count())`                                             | Callbacks inside a known routine keep its lexical host. An opaque callback from setup reports `SUGAR_CALLBACK` at its read.                                                                          |
| `for`, `while`, `if`, `return` inside memo/event/helper                | Preserve order and early returns. All operations still need the host's admission. Event loops/early returns have transform tests. Do not turn a component-body reactive `if` into a dynamic branch. |
| Static setup branch returning JSX                                      | Wrap each JSX return with a view. Returning a non-JSX value on another branch is `[SUGAR_RETURN]` in the prototype.                                                                                 |
| `async () => …` as a routine                                           | `[SUGAR_ASYNC]` or `[SUGAR_HOST]`; use synchronous routine code plus `attempt`. A plain async I/O function passed to `attempt` stays plain.                                                         |
| Reactive class/object method                                           | Checked (D-124): a method that reads is a generator method its callers delegate to (receiver kept); a getter hands back a source over its body (`nativeGetter`). A constructor or a setter that reads still reports `[SUGAR_HOST]`. |
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

**Latest bounded-mode follow-up:** see [the native audit](native-bounded-report.md).
The option-C line is settled below; implementation and complete-original
acceptance remain incomplete. The following result counts are historical.

**2026-10-08 result: a working, deliberately limited native front end; the requested
native todos acceptance target is NOT achieved.** Twenty-one of 37 small fixtures pass
transformed TypeScript and recommended lint. A native counter matches a plain
Solid control in SSR and hydrated clicks, retaining the server button. All nine
original-to-twin inputs are refused. This is a feasibility result, not nine
working native apps or a replacement for the passing directive-sugar todos.

The 2026-10-08 direction supersedes §1's authored library API and §3's open typing
choice. **Virtual-code typing is decided. There is no compiler-owned color checker.**
At this historical checkpoint the editor plugin, hovers and related-location
messages were planned. The TS plugin now implements these (see sugar-typing.md);
composed runtime source maps remain incomplete. This prototype runs ordinary TypeScript and the existing lint on
emitted library code. Those type/lint locations are still generated locations;
only native preflight diagnostics currently use authored positions. A later
SUGAR_* diagnostic can also refer to an intermediate position. We do not call
these diagnostics “mapped back” yet.


### Native mode: the core surface

**Dev's decision, 2026-10-08, option C ("definitely C").** Native mode is bounded.
The following is the required line, not a claim that every lowering below already
passes. The evidence table and findings distinguish implemented cases from gaps.
The earlier import-mapping table is historical; an import rename is not proof.

A generator passed directly as the first argument to a core API is core and is lowered. In Solid 2 rc.13 these APIs are `action` (sync/async generators), and the async-iterable producers of `createSignal`, `createMemo`, `createOptimistic`, `createEffect`, `createRenderEffect`, `createStore`, `createProjection`, and `createOptimisticStore`. Other author generators, including Effect programs and custom iterators, are opaque and keep their own protocol. The compiler inserts no delegated operations into its body and rewrites none of its reads. Calls to it are foreign values (provenance C, failures unknown). A reactive read inside it reports `READ_IN_OPAQUE_GENERATOR` at the read: read the signal outside and pass the value in, or make the read a memo.

Callback hosts are lexical. A callback at any depth inside an event, either effect phase, a memo, or a hole belongs to that host, including store updaters, array callbacks, Promise continuations, and nested arrows. Reads keep that host and its admission rules. A timer callback declared in a memo therefore cannot write; its generated host check reports the write rather than treating it as a fresh event. `SUGAR_CALLBACK` is reserved for a callback passed to an opaque API from setup whose host cannot be determined. An event keeps its body and async continuations as its host: reactive arguments, including arguments in a chained Promise receiver, are evaluated in that event and in source order before a plain producer uses their captured values.

Module-level reactive state is outside the core. A `createSignal`, `createStore` or `createMemo` declaration at module level has no component owner, so the compiler keeps it Solid and treats it as foreign (provenance C, failures unknown). `MODULE_STATE` points at the declaration: create the state inside a component and provide it via context, or keep it foreign and handle failures at its uses. The compiler does not move state or change its lifetime.

Inside the line:

- Signals and memos; both tracked compute and untracked effect phases.
- Context creation, provision and reads, retaining the provider's position.
- Props and JSX holes; destructuring only when its one-time snapshot is preserved.
  `splitProps` and `mergeProps` belong here when used by an original (neither is
  imported in the current original corpus).
- JSX events; `For`, `Show`, `Switch`, `Match`, `Index`; `Loading` and `Errored`,
  including their fallbacks.
- Actions with compiler-owned callbacks; basic stores, optimistic signals and
  optimistic stores; server functions with their transport failure contribution.
- Throw/catch inference follows the existing ruling: known class identities plus
  an unknown floor, with catches subtracting only failures they actually handle.
- A ref callback is an event invoked by Solid when it supplies the DOM element.
  Its reads are untracked, its writes run in the event, and its failures must be
  registered at the binding edge. A ref assignment retains assignment order.
- A JSX spread of a reactive object is a hole. Evaluate it at the spread's
  position; preserve property order, getter reads and event/ref binding contracts.
- Timer/listener callbacks created from setup whose returned value is ignored
  are events. Callbacks lexically inside an event, effect, memo or hole keep
  that host, including timer/listener callbacks. Naming a callback does not change its host. Do not hand an iterator to
  the scheduler. The seven reported Sierpinski callback sites are implementation
  gaps, not grounds to exclude timers from the core.
- An async helper called from an event belongs to that event; one called from a
  memo belongs to that memo's attempt. Reads before and after each await retain
  that host and its cancellation/failure rules. A setup-time async reactive read
  is refused with its source location. Shared helpers must satisfy every host.

Outside the line, kept as plain Solid at a declared foreign boundary:

- `Portal`, `Reveal`, `lazy`, `until`, projections, custom directives and class
  components; remaining runtime APIs not listed above.
- Any rendered result from a package module without a `"use pure"` contract,
  including calls whose result reaches JSX through a local binding.
- Entry `render`, `hydrate`, `renderToStream` and `HydrationScript` remain foreign
  handoffs. They retain D-099 pending-root checks and D-033 failure rules.

The compiler must choose the smallest enclosing JSX/value boundary, retain
provenance C and unknown foreign failures, and apply the existing capture rule.
It must check every yield component handed back to Solid with `foreign()`;
`foreign` is an identity checker, not an error handler. No failure union may be
cast away and no fallback may be invented. Each boundary reports the foreign
operation, source location, and how to bring it inside (use a core operation,
select its source, or supply a checked pure package contract). Unhandled failures
at a handoff report what the author must handle there. An outside API is never
itself a transform refusal. Refusals are for inside-core model violations or
unresolved reactive hosts, including setup-time async reads.

A selected component handed to an opaque package's `component` slot receives
plain Solid props with provenance C. The generated `NativeProps` facade makes
those values settled paths, retaining unknown value types and the original plain
call signature through the `nativeC` identity adapter. Its return type keeps the
component's pending, failure and context types unchanged; `foreign()` still
checks every handoff. Unknown route data is neither changed to `void` nor allowed
to hide a colored library source at a core call.

**F-S29 — native mode finds an unhandled failure in originals/hackernews-spa.**
In `examples/originals/hackernews-spa/src/lib/hn.ts:31–38`, the fetch and body read
precede the catch; only JSON parsing is handled:

```ts
  const response = await fetch(url, { headers: { "User-Agent": "chrome" } });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`Received from API: ${text}`);
    return { error: e };
  }
```

The unchanged routes `stories.tsx:19`, `story.tsx:15`, and `user.tsx:12` read
those requests in memos without an `Errored`. Their foreign handoffs are at
`app.tsx:25`, `app.tsx:28`, and `app.tsx:29`. The Router boundary at
`app.tsx:35:5` reports, verbatim:

```text
[NATIVE_FOREIGN_BOUNDARY] Router (createRouter from @solidjs/router) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
```

Each route retains `NativeFailure<"unknown">`; all three handoffs reject with
this TypeScript diagnostic property, verbatim:

```text
readonly "[FOREIGN_HANDOFF] a yield component handed to plain Solid may fail with the failure kinds this property lists: handle them inside, or wrap it in an Errored, first": "unknown";
```

[The exact snapshot](../examples/harness/native-hackernews/expected-diagnostics.json)
records the complete three TypeScript errors at generated `app.tsx:14:37`,
`app.tsx:18:37`, and `app.tsx:22:37`. The expected-diagnostics gate requires exactly
that boundary and those three failures; any extra error, missing rejection, or
changed failure set fails. This is the model finding an unhandled failure in the
original, not a native lowering blocker. The separate
[author patch](../examples/harness/native-hackernews/author-fix.patch) adds only an
`Errored` import and wrapper to each route, with a fallback reading an Error's
message (Solid's accessor is unknown, so the fallback checks `instanceof Error`).
The original stays byte-identical. Fixed native output must separately pass
transform, typecheck, lint, happy-path client/hydrated parity against the original,
a rejected-fetch state against the patched Solid version, and SSR smoke of the
cached 1,406-comment story. The oracle's handlers also work, but their structure
and `ApiError` mapping are not copied into this patch.

This section supersedes the previous request to decide native scope. Scope is
settled; incomplete lowering and missing parity remain implementation findings.

**F-S30–F-S32 — bounded scope fixes applied; effect still stops.** Authored
Effect/custom generators now stay opaque, with unknown foreign failures; both
plain and generated isolated Effect programs typecheck (F-S30). Module signals,
stores and memos retain their Solid declarations and lifetimes, with
`MODULE_STATE` at the declaration and unknown failures at owned reads (F-S31).
The shared position-map fix `b2f75f1` was cherry-picked as `7ddd803`; later refusals
now use authored positions, including the original checkout index read at
`checkout.tsx:141:25` (F-S32). The old `api.ts:177` refusal no longer occurs.

**F-S33 — Promise-chain arguments lose their event host.** After only moving the
two checkout index reads out of store updaters into their click events, the
compiler puts the order's reactive arguments inside a plain attempt producer.
The original `cart.map(...)` is inside an event; the generated read is inside
`() => placeOrder(...).catch(...)`, which cannot drive it. The mapped refusal is
at patched `checkout.tsx:187:19` (original line 185). It is a compiler host failure,
not a justified new author diagnostic. Both effect acceptance halves fail;
hydrated effect parity and SSR have not run. No native effect gate step or gate
baseline regeneration is claimed. [The side-by-side report](native-effect-blocker.md)
and [reproducible probe](../scripts/native-effect-blocker.mjs) record the stop.

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
| Local synchronous `onClick={fn}` | `yield* $event(function* (...args: NativeArguments<typeof fn>) { return fn′(...args); })` | Implemented; calls to a reactive helper delegate; unresolved/property handlers refused |
| `createContext<T>()` | `createContext<T, ID>(undefined, { name: ID })` | Compiler-generated module-and-binding identity; no author name marker |
| `<Ctx value={v}>children</Ctx>` | `Ctx.provide({ value: v′, children: function* () { … } })` | Local and directly imported selected contexts; same provider location |
| `useContext(Ctx)` | `yield* Ctx`, followed by source reads where its value is used | Implemented; requirement checked at root; no provider insertion |
| Plain typed `props.x` | Generated `Props<T>` plus path reads | Simple identifier parameter; destructured parameters refused |
| `<Child p={v}/>` | `yield* Child({ p: v′ })` | Local/direct selected imports; foreign tags need a boundary contract |
| `For` / `Show` / `Loading` / `Errored` etc. | Same library calls with lazy children, row views and bound events | Basic forms; default For row-value mapping; nondefault keyed modes refused; complex fallback forms remain limited |
| `render` / `hydrate` from `@solidjs/web` | Local selected component roots use the library renderer with `RootCheck`; imported entry roots use `foreign(Component)` | Pending and requirements are checked at the root; foreign handoffs also check failures |
| `throw X` | `raise(nativeFailure([class IDs or "unknown"], X))` | Implemented for synchronous routine hosts; see Failure inference |
| Async/server-function memo | `attempt(() => f(), e => nativeFailure(inferredSet, e))` | Async producers and Promise-returning calls; server calls add `ChunkError` |
| `action` (including generators), `createStore`, `createOptimistic`, `onSettled`, `latest`, `isPending` | `$event`, `$store`, `$optimistic`, `$effect`/`$cleanup`, `latestOf`/`isPendingOf` + read | Focused generated checks pass; see the API inventory for overload limits |
| `createOptimisticStore`, `createProjection`, `refresh`, `until`, `lazy` | Corresponding library primitive imports | Import mapping implemented; producer, selector, generic and foreign-edge contracts remain incomplete |

### Native type annotations (2026-10-09)

Solid type imports lower with their values. Local import aliases keep their
names. The type visitor covers interface and alias members, nested generics,
constraints/defaults, function parameters/results, tuples/unions, mapped and
conditional types, interface extensions, call type arguments, `satisfies`, and
`as`/angle assertions. Type namespaces and inline `import(...).Type` work too.
The fixtures in `native-types.test.js` check the mapped contracts with TypeScript.

| Solid spelling | Generated library contract |
| --- | --- |
| `Accessor<T>` | `Source<T>` |
| `Setter<T>` | `Setter<T>` (returns the library's write receipt) |
| `Signal<T>` | `[Source<T>, Setter<T>]` |
| `Component<P>` | `Component<P>` |
| `ParentComponent<P>` | `Component<P & { children?: Element }>` |
| `VoidComponent<P>` | `Component<P & { children?: never }>` |
| `ParentProps<P>` | `P & { children?: Element }` |
| `JSX.Element` (Solid or web import) | `Element` |
| Other Solid types | Retain the Solid import and annotation; report `NATIVE_TYPE_UNMAPPED` at each use |

An accessor's contract is settled, matching the lowered signal getter. It does
not erase a memo's pending/failure colors: assigning a colored memo to this
settled contract is rejected. Unannotated producers retain inferred colors.
Making a Source callable would hide a read in the explicit library dialect,
so this change leaves the runtime unchanged. Component declaration annotations
supply props (including parent/void children); generated bodies infer their
actual colors instead of widening them to `Component`'s defaults. A component's
`JSX.Element` return annotation similarly becomes an inferred view signature;
plain function return annotations use the mapped element/value type.

This repairs dashboard F-S36's provider value contract. The provider
relationship through `useFilters()` in component setup was the F-S37 stop, fixed
below ([native context hooks](#native-context-hooks-f-s37-2026-10-09)). No native
dashboard runtime acceptance or final colors are claimed.

A selected local component passed to native `render` or `hydrate` uses the library renderer with `RootCheck` and `foreign`. This entry is a foreign handoff: residual failures, including unknown, are errors. D-033 allows failures at explicit library roots, not at native Solid entry handoffs. In a self-recursive component, fixed numeric prop snapshots may become path reads in holes when every local JSX caller supplies fixed numeric expressions; pure numeric assignments are substituted in source order, and an early JSX return selects `Match` rows that own their branch setup. Recursive component types carry the pending and failure types inferred from memo reads and prop edges, and generated TypeScript checks the full body against that type. Timer and frame callbacks retain the existing rule: reads and writes run as component-owned events, with their result ignored by the scheduler.

Native Todos now needs the D-116 two-half acceptance rule too. The unchanged
original reports `EVENT_REJECTS` at `app.tsx:82` and `:121`: the bulk actions and
the allCompleted argument read failing state before their API catches. The test
copy uses `author-fix.mjs` to widen the two action catches and catch the argument
read, returning false on failure. Its checker must be clean, the fallback is
executed against a throwing state read, and client/hydrated/SSR parity remains
against the byte-identical original. `native:todos:events:snapshot` is the added
gate step; the existing typecheck stage checks the minimally edited copy.

### Failure inference

**Dev's ruling, 2026-10-08: option A is implemented as a prototype.** Source files
still import only Solid. Failure inference supplies types to generated `raise`
and `attempt`; it is not a second checker for component admission, pending,
may-wait, requirements, or boundary discharge. Those remain generated TypeScript
and the existing recommended lint. The TS plugin and matching CLI check virtual code and map diagnostics to native source; real editor UI remains unverified.

`nativeFailures` reuses the compiler analyzer's parsed modules, scopes, module
identities and directives. TypeScript resolves selected call targets, aliases,
re-exports and the types of throw expressions. A worklist-equivalent monotone
iteration unions callee sets until no set changes; recursive groups have no
arbitrary inference iteration limit. This differs from the older sugar emitter's
24-pass guard. Calls outside the selected graph contribute `unknown`, except
selected `"use pure"` contracts and explicit native/platform contracts. The
platform list now covers unshadowed standard clock/scheduler calls and typed
array callbacks; callback failures still flow. Primitive-array `join` is checked
separately. Opaque packages and shadowed globals retain `unknown`. Native primitive callbacks and memo reads carry
their producer's set. This analysis is conservative: opaque router calls, browser
APIs and data-method calls often produce `unknown`; it does not infer package
purity from a familiar function name.

- `throw new X(...)` or `throw value` whose TS type is a class instance adds X's
  declaration identity. Class unions add all members. Constructors, inherited
  constructors and instance field initializers also contribute their failures.
- `throw e` with unknown/any, a string or an object literal adds `unknown`.
  Unknown inferred failures are retained and do not erase known members; literal primitive throws are refused below.
- Catch transfer follows the main proof audit's I3 rule: `E_out ⊇ (E \ G) ∪ H ∪ F`.
  G includes only values consumed on every handler path; H includes handler failures
  and F includes finalizer failures. Branches narrow a tracked, unmodified binding
  at `instanceof`, and an early return ends that path. A base-class guard covers
  its subclasses by the TS class hierarchy, never by structural assignability.
  A sibling stays in the output. Partial/unguarded rethrows retain the incoming
  class. Mutation widens the binding to unknown; unproved paths retain a safe
  upper bound. Named Promise handlers conservatively keep the incoming set.
- Unknown is top. A selective class guard leaves unknown; only a genuine
  consuming catch-all at that position removes it, while keeping H/F. A promise
  returned without await can reject after a synchronous catch has ended; its
  rejection remains. Ordinary async I/O keeps native JavaScript completion, so
  returning an Error is a value, not a replacement throw (F21).
- Silent absorption is an author rule in addition to the failure-set rule:
  `CATCH_SWALLOWS` flags empty, bare-return and logging-only catches when the input
  may fail. Returning a fallback value or writing a fallback to state (including a member assignment) counts
  as handling. Rethrowing keeps the failure. A comment `/* @yield-absorb: reason */`
  inside the catch explicitly declares intentional absorption. The reviewer’s
  `catch { return [] }` is legitimate handling and stays clean.
- JSX event handlers (inline, named, async or returning a Promise) are checked
  by projecting FAILS from their generated Bind operations, independently of
  rendered boundaries. This uses the same library types as component admission,
  including context-provided actions; it does not trust an unresolved source alias
  as failure-free. `EVENT_REJECTS` is placed at the handler
  if its inferred set is nonempty, even beneath Errored. Catch in the handler;
  rendered Errored cannot handle a later event rejection. Native declaration of
  an escaping event failure is not yet a supported author syntax; the explicit
  dialect's event contract remains available outside native files.
- Generators proved to yield plain primitive data stay JavaScript. During
  reconstruction an unresolved generator yield type is conservatively treated
  as a routine; arbitrary object/unknown data generators remain a precision gap. Module state is refused at its declaration with
  `MODULE_STATE`. Unshadowed Promise construction and primitive-only resolve
  callbacks are platform contracts; executor throws/reject calls still contribute.
- Findings retained: synchronous nativeTry reconstruction can over-approximate a
  selective rethrow, so generated typing may retain more failures than source
  inference. Structural/external class witnesses and arbitrary alias/mutation
  flow still need I1/I2/I4 proof (F16/F19). Literal primitive throws are refused
  with `NATIVE_THROW`, including async helpers: this bounded refusal differs from
  F21's fully admitted primitive-throw lowering; it never assigns them an empty
  failure set. Selective Errored matching and transported prototype revival
  remain F-S14/F-S15, despite D-116's requirement that the client restore them.
  This change does not claim the unrestricted native theorem or wire equivalence.
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
| `createMemo(() => [1].map(() => count()))` | Transform | The array callback keeps its enclosing memo host. |
| `onClick={() => Promise.reject("failed")}` | Transform | `promise-event` passes generated TS/lint; failure is `unknown` |
| `createMemo(async () => count())` | Refusal | `SUGAR_HOST`: “Reactive operations in async functions or methods are unsupported.” |
| `throw new Error("oops")` / `throw e` with `e: unknown` | Transform | `throw-error`, `unknown-throw` pass generated TS/lint; fails `Error` / `unknown` |
| `try { set(1) } catch { set(2) }` | Transform | `nativeTry` delegates in the same host/transaction. The `catch` fixture passes generated TS/lint; rejection/write behavior has hydrated parity evidence. |
| `useContext(C)` with no provider at root | Transform, then diagnostic | TS2345 includes `[NO_PROVIDER] the root requires the contexts this property names…` |
| Unhandled failure at a library root | **Allowed by D-033 once nominally typed** | The native root fixture passes. The class/unknown foreign bridge probes fail `[FOREIGN_HANDOFF]`. |
| `const n = count(); return <p>{n}</p>` | Transform, then diagnostic | TS2769; lint `[READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.` |
| `const x = <p>{count()}</p>` in setup | Transform, then diagnostic | `jsx-only-in-view`: “JSX in a setup: elements are built by the view it returns…” |
| `createMemo(() => { set(1); return count() })` | Transform, then diagnostic | TS2345: generated `Write` is not admitted by `MemoOp` |
| `createEffect(() => memo(), n => { set(n + 1) })` where memo reads that signal | Transform; **cycle not diagnosed** | `feedback` passes TS/lint. No termination guarantee; no runtime execution of this deliberate infinite feedback fixture. |
| `createEffect(() => {})` | Refusal | `NATIVE_EFFECT_PHASES`: “createEffect needs a tracked compute and an untracked effect phase.” This is also invalid under the installed native two-phase signature. |
| Async effect phase | Refusal | `SUGAR_ASYNC`: “Use attempt inside a synchronous routine; async functions are not routines.” |
| `{ read() { return count() } }` | Checked (D-124) | a generator method; `o.read()` is delegated where it is called |
| State creation in JSX hole | Refusal in this prototype | `SUGAR_CALLBACK` while reconstructing the nested call; no claim of reaching the host-type check |
| `<button {...attributes}/>` / `<button ref={fn}/>` | Checked (D-124) | a DOM spread goes through `nativeSpread` (its sources' colors to the view, its events bound; a namespaced attribute on a component still reports `NATIVE_SPREAD`); a ref callback is an event |
| Event handler using `this` | Refusal | `NATIVE_RECEIVER`: “An event handler using this needs a verified receiver-preserving binding.” Tested in `native.test.js`. |
| A component declared inside another and used as a tag | Refusal | `NATIVE_COMPONENT` at its declaration: “Declare X at module level; a component declared inside another function has no native lowering.” Tested in `native.test.js`. |
| `useContext(createContext<T>())` | Refusal | `NO_PROVIDER` at the read: a defaultless context created in its own read can never be provided. Tested in `native-context.test.js`. |
| Named synchronous local handler | Faithful lowering on tested form | `named-event`: generated TS/lint pass; counter hydration exercises it |
| `createEffect(compute, {effect: fn})` | Refusal in this implementation | `SUGAR_CALLBACK`; native effect bundles still need a dedicated mapping |

A native effect compute can also fail through a plain throw. The library deliberately
routes effect failures differently from Solid's log-and-skip path (runtime.ts,
D-073). “Map createEffect” therefore needs an explicit failure-semantics agreement,
not just renaming the call.

### Nine original-to-twin results

**The follow-up remains incomplete: zero complete originals pass.** Seven source
trees supply nine twin targets (the two `-h` targets reuse source). Sierpinski
now emits code, but its generated checks fail. No complete original is counted
as accepted, and no application parity or SSR success is claimed. Acceptance
remains parity against the original, not the handwritten twin.

The fails-sets below are the analyzer's **source call-graph estimates**, not
checked colors of a complete generated app. File/line identities and full,
actual diagnostics are in [native-verification.json](native-verification.json).
Refused rows count the first lowering blocker, not all latent errors.
A refused file has no diff distance. Emitted code with failed checks is not a
basis for a semantic twin comparison; those distances remain unmeasured.

| Original / twin target | Status | Original parity / SSR | Inferred fails per component (grouped) | Diagnostics |
| --- | --- | --- | --- | ---: |
| docs-yield | Refused | Not run | Home/DocPage/ArticleContent/ReadingGuide → {ChunkError, NotFound, unknown}; App → {ChunkError, NotFound, SearchError, unknown}; SiteNav/SiteFooter → {ChunkError, unknown}; ArticleBody/ThemeToggle/ImageCarousel → {∅}; Shell/LikeButton/NewsletterForm/CommentList → {unknown}; SearchBox → {SearchError, unknown} | 1 |
| effect-yield | Refused | Not run | LogPanel/App/Checkout/Results/Typeahead → {unknown} | 1 |
| hackernews-spa-yield | Refused | Not run | App/Stories/Story/User → {unknown}; Comment/Nav/Story/Toggle → {∅} | 1 |
| rendering-yield | Refused | Not run | InnerBoundaryItem/OuterBoundaryItem/ErrorStream/AsyncCard/RevealPage/Settings/Shell/Skeleton/Stream → {unknown}; Home/Profile/FeedCard → {∅}; Link → {Error} | 1 |
| room-yield | Refused | Not run | Document/App/StatusPill/IdentityProvider/Home/Panel/Composer/Live/Header/Chat/Transcript/Composer/Directory/DirectoryEntry/Card/Summary/SummaryText/Archive → {unknown}; Chaos/Chaos → {∅} | 1 |
| sierpinski-yield | Generated, checks fail | Not run | TriangleDemo/Triangle → {unknown}; Dot → {∅} | 22 |
| sierpinski-yield-h | Generated, checks fail | Not run | TriangleDemo/Triangle → {unknown}; Dot → {∅} | 22 |
| todos-yield | Refused | Not run | Header/TodoItem/MainSection/Footer/App → {unknown} | 1 |
| todos-yield-h | Refused | Not run | Header/TodoItem/MainSection/Footer/App → {unknown} | 1 |

Remaining first blockers are implementation gaps: `NATIVE_FOREIGN` for
rendering and room; `SUGAR_CALLBACK` at still-unlowered value/foreign call
combinations for docs, effect, hackernews and todos; generated prop/recursion/owner
checks for Sierpinski. The API-name, catch and generator preflight refusals no
longer hide these later failures. Full messages are recorded rather than
replaced with a claim that plain Solid disagrees with the model.

No original was added to the gate. The existing native controls now include
SSR and hydrated parity for a generator action whose promise rejects and whose
catch writes state. This is focused evidence, not todos parity. **The gate
baseline is unchanged in this follow-up.**

### Further findings

| Finding | Source and reason |
| --- | --- |
| F-S8: superseded refusal policy | Original todos `reject`: `setTimeout(rej, time, "Failed to Save")`; store `async () => { const todos = await api.getTodos(); … }`. The rejected value can be a string or anything else. Raw `unknown` cannot satisfy nominal `Failure` (D-110); a generated wrapper now does. TS return types do not declare throws. Dev chose inference with an unknown floor. The adapter above removes NATIVE_FAILURE/NATIVE_REJECTION. Remaining identity/transport limits are F-S14/F-S15. |
| F-S9: handwritten target is not a transliteration | Todos Header has no signal/memo in the original; the yield twin adds unused `$signal`/`$memo`. Original calls `addTodo` then clears input; twin clears before delegated waiting. The twin changes the context tuple into an object, adds `TodoApp`, moves store creation/provider relative to Errored, and changes derived accessors into memos. These are categorized as extra operations, event order, data shape, owner/boundary placement and memoization. Whitespace/import normalization cannot erase them. A general compiler must not invent this source-specific rewrite to win a diff. |
| F-S10: unfinished native contracts | Primitive import mapping is broader, and catch/generator-action fixtures pass. Full optimistic-store selectors, generic inference, accessor/context facades and higher-order components remain implementation gaps; no blanket NATIVE_CATCH or NATIVE_GENERATOR refusal remains. |
| F-S11: static feedback limit | `feedback` passes generated TS/lint. The types check which phase may write, not whether repeated effects terminate. A separate optional feedback analysis needs provenance and a clear policy; it must not be confused with the typed-failure theorem. |
| F-S12: complete native proof not established | Only a small synchronous subset has behavioral evidence. Generated checks and counter parity do not establish lowering preservation across all native primitives. Source diagnostic mapping, stable public context IDs, package summaries and routine recursion facades remain; failure recursion has fixpoint tests. |
| F-S13: scheduling callbacks — original blocker removed | `setInterval(() => setSeconds(s => (s % 10) + 1), 1000)` and `requestAnimationFrame(update)` now lower their reactive callbacks to `$event`. Sierpinski emits code; remaining prop/recursive component errors are F-S20. |
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

At this historical checkpoint the editor plugin was not built; sugar-typing.md
records the later TS plugin implementation.

### Native verification and baseline

The previous failure-inference update passed the gate described here; the
[full gate record](native-gate-verification.json) now records the latest follow-up. `pnpm build` passed. The gate includes generated TS/lint
for 37 native fixtures (21 accepted), two strict foreign-edge probes, all nine
original audits, counter SSR/hydration, the production failure-serialization
control, six inference tests, and the existing library/plugin/analyzer/proof/twin
checks. Generated failure adapters have four runtime unit tests and a server
stream test. At this historical checkpoint native editor diagnostics remained unmapped; no editor plugin or
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


### Native follow-up: catches, callback hosts and API inventory

The requested host rule is: callbacks whose result is ignored by a non-reactive
host become events; callbacks supplying rendered or memo values stay reactive.
The implementation recognizes timer/frame/idle/listener hosts and ignored
expression-statement calls, including named callbacks shared by such hosts.
It wraps them in `$event`. A typed array `map` callback delegates through
`nativeMap`, preserving order, array length and holes. JSX child callbacks become
holes. A callback returning reactive values through an unresolved opaque call is
still refused. General callback escape/use inference is unfinished; the remaining
`SUGAR_CALLBACK` sites are not all genuine model disagreements.

`nativeTry` delegates its body, handler and finalizer without opening another
host or transaction. It masks immediate read/raise/event-call failures handled
by the catch, retains other operation colors, and never swallows pending or
unbranded driver errors. Creation/binding failures that can arrive later remain
in the color. Direct rethrows keep the branded value; an authored catch binding
is unwrapped for ordinary use, and a subsequent unknown throw is branded as
unknown. Returns from the body/catch use completion records. Plain I/O helpers
stay plain; only routine callers use `attempt`. Promise handlers/ordinary async
try-await keep their JavaScript behavior and inferred rejection sets.

These compiler-only helpers add preservation and failure-discharge obligations.
The existing calculus proofs have not been changed and do not establish these
new rules. Runtime tests check failure identity, handler/finalizer order, operation
delegation and sparse map behavior. Generated fixtures check the resulting
colors. An actual SSR catch and hydrated rejecting generator action match their
plain Solid controls.

Entry-only files are excluded from routine reconstruction. Direct renderer
handoffs receive `foreign(Component satisfies RootCheck<typeof Component>)`
while retaining the `@solidjs/web` import;
combined component/entry files also retain the Solid renderer. Type/lint checks
on the generated root/foreign edge report pending roots, unhandled failures or requirements rather
than refusing an entry API name. Complex renderer callbacks still need more
complete edge rewriting.

[The complete import inventory](native-api-inventory.json) is reproduced below.
There are 40 module/API pairs across the original source trees. No `produce`
import occurs. “Mapped” is a lowering status, **not** full overload coverage or
application acceptance.

| Module | API | Status | Lowering / remaining limit |
| --- | --- | --- | --- |
| @solidjs/web | `dynamic` | refused-with-reason |  — NATIVE_FOREIGN: child colors need a checked foreign component adapter. |
| @solidjs/web | `getRequestEvent` | mapped | pass-through |
| @solidjs/web | `HydrationScript` | excluded-as-entry | Solid entry API + foreign(component) at direct handoffs |
| @solidjs/web | `isServer` | mapped | pass-through |
| @solidjs/web | `JSX` | mapped | JSX.Element -> solid-yield Element - Other JSX contracts are retained with NATIVE_TYPE_UNMAPPED. |
| @solidjs/web | `markSafeError` | mapped | pass-through |
| @solidjs/web | `Portal` | refused-with-reason |  — NATIVE_FOREIGN: child colors need a checked foreign component adapter. |
| @solidjs/web | `render` | excluded-as-entry | Solid entry API + foreign(component) at direct handoffs |
| solid-js | `Accessor` | mapped | type import -> solid-yield Source - Declaration bodies infer their colors; annotated contracts use the library defaults. |
| solid-js | `action` | mapped | $event |
| solid-js | `Component` | mapped | type import -> solid-yield Component - Declaration bodies infer their colors; annotated contracts use the library defaults. |
| solid-js | `createContext` | mapped | createContext |
| solid-js | `createEffect` | mapped | $effect |
| solid-js | `createMemo` | mapped | $memo |
| solid-js | `createOptimistic` | mapped | $optimistic |
| solid-js | `createOptimisticStore` | mapped | $optimisticStore — Primitive import is mapped; not every overload, selector, or callback contract is implemented. See application diagnostics. |
| solid-js | `createProjection` | mapped | $projection — Primitive import is mapped; not every overload, selector, or callback contract is implemented. See application diagnostics. |
| solid-js | `createSignal` | mapped | $signal |
| solid-js | `createStore` | mapped | $store — Primitive import is mapped; not every overload, selector, or callback contract is implemented. See application diagnostics. |
| solid-js | `createUniqueId` | mapped | pass-through |
| solid-js | `Errored` | mapped | Errored |
| solid-js | `For` | mapped | For |
| solid-js | `isPending` | mapped | isPendingOf — Primitive import is mapped; not every overload, selector, or callback contract is implemented. See application diagnostics. |
| solid-js | `latest` | mapped | latestOf — Primitive import is mapped; not every overload, selector, or callback contract is implemented. See application diagnostics. |
| solid-js | `lazy` | mapped | lazy — Primitive import is mapped; not every overload, selector, or callback contract is implemented. See application diagnostics. |
| solid-js | `Loading` | mapped | Loading |
| solid-js | `Match` | mapped | Match |
| solid-js | `onCleanup` | mapped | $cleanup |
| solid-js | `onSettled` | mapped | $effect + $cleanup |
| solid-js | `ParentComponent` | mapped | type import -> solid-yield/internal NativeParentComponent - Declaration bodies infer their colors; annotated contracts use the library defaults. |
| solid-js | `ParentProps` | mapped | type import -> solid-yield/internal NativeParentProps - Declaration bodies infer their colors; annotated contracts use the library defaults. |
| solid-js | `refresh` | mapped | refresh |
| solid-js | `Repeat` | mapped | Repeat |
| solid-js | `Reveal` | refused-with-reason |  — NATIVE_FOREIGN: child colors need a checked foreign component adapter. |
| solid-js | `RevealOrder` | mapped | retained type-only; NATIVE_TYPE_UNMAPPED at annotations - No native type mapping; original annotation retained. |
| solid-js | `Show` | mapped | Show |
| solid-js | `Store` | mapped | retained type-only; NATIVE_TYPE_UNMAPPED at annotations - No native type mapping; original annotation retained. |
| solid-js | `Switch` | mapped | Switch |
| solid-js | `until` | mapped | until — Primitive import is mapped; not every overload, selector, or callback contract is implemented. See application diagnostics. |
| solid-js | `useContext` | mapped | context source read |

| Finding | Source and reason |
| --- | --- |
| F-S19: reactive arguments inside opaque calls | Todos `toggleTodo(props.todo.id, e.currentTarget.checked)` and hackernews `getStories(type(), page())`. The generated attempt's plain producer cannot contain delegated reads. Argument evaluation must be lowered in order, preserving receivers, short-circuiting and failure handling. Making that producer a generator would return an iterator as a value: it is not a valid fix. |
| F-S20: prop snapshots and recursive component facades | Sierpinski `let {x,y,s}=props; if(s<=TARGET) return <Dot …/>; s=s/2; … <Triangle …/>`. Emitted paths still need snapshot/control placement and a recursive signature carrying pending/failure colors from children. The generated checks report TS7023, invalid source arithmetic and related host/prop errors. A broad cast or suppressing those checks is not acceptance. |
| F-S21: abrupt completion across catch helpers | `for(;;){try{break}catch{}}` and `try{return 1}catch{}finally{return 2}` need loop/finalizer completion records. Current diagnostic: `[NATIVE_CONTROL_TRANSFER] A catch crossing a loop/label needs completion lowering.` or `A return from finally needs completion lowering.` Catches without these transfers are accepted. |
| F-S22: foreign component adapters | Rendering `<Portal>…</Portal>` / `<Reveal>…</Reveal>`, room router components. The native child/prop colors must cross a checked adapter. Current diagnostic: `[NATIVE_FOREIGN] A foreign JSX component needs a checked boundary contract before library colors can cross it.` This is a missing adapter, not a model rejection of routers or portals. |

Current focused evidence: 48 source fixtures, 33 accepted by generated TS and
recommended lint; two additional strict foreign-handoff probes; seven inference
tests; five native-control runtime tests; SSR catch parity; hydrated generator
action rejection/write parity. No editor plugin was built. The requested complete
original app lowering and parity remain open work, not questions of permission.

A foreign callback's failure cannot disappear because its owner has no JSX bind.
The generated `nativeCallback` handoff checks the event's iterable binding color.
A failing callback gets a TypeScript error containing `[NATIVE_CALLBACK_FAILURE]
foreign callback failure registration is not implemented; handle failures inside
the callback`. `timer-callback-failure` verifies that exact diagnostic; an ambient
opaque function contributes unknown, without relying on a missing-module error.

**F-S23 — foreign callback failure registration:**
`setTimeout(() => { count(); opaque() }, 10)` becomes a checked event, but this
prototype has not placed its failure registration into a view/boundary. It emits
the diagnostic above rather than losing the failure. Reading a failing source
has the same limitation. Handled callbacks and callbacks with no failure color
pass. Completing the generated registration remains implementation work; this is
not a new rule that timer callbacks cannot fail.

Final follow-up verification (2026-10-08): `pnpm build` passed; the gate at code
`e5942d0` plus the checked evidence working tree finished **53 pass / 0 fail /
0 skip in 106s**, GREEN. The baseline was not regenerated: no complete original
passed native acceptance, so no original app step was added. No existing gate
check or baseline threshold was relaxed. All commits are local on `proto/sugar`.


### Bounded native follow-up (2026-10-08)

The required core line above is now recorded, with focused implementations for
async reactive helpers in events/memos, ref events, indexed For, method/argument
evaluation, checked foreign JSX tags/render callbacks and route handoffs.
`nativeInvoke` preserves method receivers even when a method overrides `.call`;
the generated method lookup remains inside an attempt. Async setup reads get
`NATIVE_ASYNC_SETUP`. Async iterable I/O producers remain ordinary JavaScript.
The callback registration failure check remains strict (F-S23).

The native audit now uses each original's dependency tree and source path aliases,
then checks its generated tree with its own TypeScript/ESLint project. JSON assets
remain the original files. A lint project configuration error is an audit failure,
not an application diagnostic. The originals were not edited; docs matches main.

**This does not complete bounded native mode.** F-S24 (spreads), F-S25 (native prop
color facades), F-S26 (general foreign value extraction and legacy outside-core
mappings), F-S27 (higher-order and remaining callback hosts), and F-S28 (native
provenance/capture acceptance) remain in [the full findings](native-bounded-report.md#remaining-findings).
F-S20's snapshot/recursive component problem still blocks Sierpinski. The report
contains the nine-row audit, every detected foreign JSX boundary, failure estimates,
the core evidence map, and verbatim hackernews/docs diagnostics. No full original
has passed generated checks plus hydrated parity and SSR; none was added to the
gate. The baseline was not regenerated or relaxed.

Final bounded follow-up verification: `pnpm build` passed and the full gate
finished **53 pass / 0 fail / 0 skip in 176s**, GREEN. The run tested the working
tree subsequently committed as `1080e0c`; its recorded HEAD is the preceding
`979e7a4`. [The saved gate result](native-gate-verification.json) includes all
53 steps. Directive-sugar todos remains green. No native original passed, no
native app step was added, and the baseline was not regenerated. All commits
remain local on `proto/sugar`.


### Native effect after the three rule fixes (2026-10-08)

Core API generators remain core; other author generators stay opaque. Callback
hosts are lexical, and Promise-chain arguments stay in the event that reads them.
The checkout index reads (lines 141 and 152) and chained order arguments (line
185) now lower without an author edit. Native Todos again passes unchanged.

The unchanged Effect project then reaches **F-S34**: `createRuntime`'s setup
context read is captured inside `() => ManagedRuntime.make(layer, parent()?.memoMap)`.
The compiler refuses `parent()` at a generated span reported as the helper name
(`solid-effect.ts:50:17`), while the author reads `parent?.memoMap` at line 52.
This is a new compiler gap, not a correct author disagreement. The requested stop
rule applies: no extra lowering change or author workaround is attempted.

[The side-by-side stop report](native-effect-blocker.md) and
[reproducible evidence](native-effect-blocker.json) record both failed acceptance
halves and the empty author patch. The module-state note remains correctly at
`log.ts:20:7`. Native Effect is not added to the gate; the baseline is unchanged.


### Native dashboard: JSX hole fix, F-S36 repair and F-S37 stop (2026-10-09)

F-S35 is fixed: arrows and functions in JSX children or attributes keep their
hole host through parentheses, conditionals and returned functions. Native
failure lowering evaluates a method receiver in that host before creating its
plain failure producer, preserving receiver lookup, arguments and invocation
order; `totals().success.toFixed(2)` no longer captures `totals()` inside an
unhosted callback. The seven JSX-hole fixtures pin these forms. Dashboard lowering
returns only the Router boundary at `app.tsx:92:9`. F-S36's type-lowering repair
now maps `Filters`' Solid `Accessor` annotations to `Source`; both provider
fields at `filters.tsx:23` typecheck. The separate
`native:dashboard:type-contract` step checks that repair.

The first new structural reason is F-S37: `useFilters()` reads and raises during
generated component setup, which only admits setup operations. It maps to
`FilterBar` at `filters.tsx:32:17`. The requested stop rule applies. Both native
acceptance halves fail, the author patch is empty, and final panel/route colors
and native hydrated, SSR, AckFailed and NotFound comparisons are unavailable.
`native:dashboard:structural-stop` pinned F-S37 (now `native:dashboard:diagnostics`;
see [the dashboard record](native-dashboard.md)).

### Native failure rules after review 3

ECMAScript and DOM calls are recognized from TypeScript's platform declarations, so local names such as `Math` cannot borrow a built-in contract. Calls add no failure unless they appear in the explicit throwing list in `failure-inference.js`: examples include `JSON.parse` (SyntaxError), `new URL` (TypeError), URI decoding (URIError), and Intl construction (RangeError or TypeError). Valid literal numeric formatting options do not add RangeError. Callback bodies and arguments keep their own failures. Functions with visible bodies in this project are inferred across imports; opaque calls retain `unknown`. A module beginning with `"use pure"` is a trusted no-failure contract, including its helpers; it is an author assertion, not a proof.

Only async producers under `"use server"` add a transport failure (ChunkError) at their client call. Removing the directive removes that transport failure while retaining inferred application errors. Diagnostics and hover summaries use the public transport description rather than generated aliases.

Unhandled `.then` rejections belong to their lexical host: an event reports EVENT_REJECTS, a memo carries the failure set, and setup reports a setup failure. A synchronous catch around starting a promise cannot catch its later rejection. Async memos keep a pending boundary even without `await`; their attempts retain inferred rejection classes. `Promise.all` retains concurrency and tuple types and unions its member failures. A timer callback's throw contributes to the host's failure summary; catch inside the callback. The existing NATIVE_CALLBACK_FAILURE check still reports missing timer registration rather than promising that a surrounding Errored catches the timer.

A provider wrapper discharges a context only when the component summary proves it surrounds the children on every returned path. Other contexts and child failures remain. Lowercase JSX names are intrinsic tags, regardless of local variables with the same name.

Refusals use validated authored spans. Invalid or generated coordinates fall back to a routine span marked `[generated]`; they never reach TypeScript's unchecked line-position conversion. A refused file retains its original TypeScript view, while other selected files are retried and keep their checked hovers. Imports through the refused file can still lack complete summaries. Runtime source maps and general callback support remain incomplete.

### Native context hooks (F-S37, 2026-10-09)

`const value = useContext(Ctx); if (!value) throw …; return value` is the
ordinary Solid hook. Solid 2's provider sets its value once when it is created,
and `useContext` returns that value, so a consumer's setup cannot miss an update
by holding it. `useContext` also throws first when no provider and no default are
above it; that case is the context's requirement (`ContextRead<Q>`), refused at a
root or handoff that leaves it unprovided.

A context value used whole (a guard, a return, an argument) lowers to
`nativeUseContext(Ctx)`: the provided value itself, with the context read as its
only operation, so setup admits it. A value read only through its members (the
prelude's destructuring, as in Todos) keeps the path form.

A `throw` that is the whole body of `if (!value)`, `if (value == null)`,
`=== null` or `=== undefined` on such a value lowers to
`nativeContextGuard(value, failure)`. Its raise is typed from TypeScript's
narrowing of `value` in the guarded branch: a value type with no falsy (or
nullish) member narrows to `never` and the guard raises nothing; a type that
admits it (`User | null`) keeps the raise, and setup still refuses it. Failure
inference applies the same rule from the value's declared type, so hovers and
handoff summaries agree.

The native dashboard now passes F-S37 and reports 15 errors in seven groups:
one question for Dev (review slot T08: a pending value passed into a prop typed
as a plain value, inside the caller's own boundaries) and six compiler gaps,
F-S38–F-S43. See [the dashboard record](native-dashboard.md).

The same rule removes Effect's F-S34: `createRuntime` reads its context value
inside `() => ManagedRuntime.make(layer, parent?.memoMap)`, which is now the held
provided value rather than a path read captured in a callback. Effect lowering
then stops at a new, uninvestigated reason: `[SUGAR_ESCAPE] Routine placeOrder is
handed to an unknown consumer` (the `effectAction` bridge, `checkout.tsx`). The
evidence script `scripts/native-effect-blocker.mjs`, outside the gate, now fails
by design with "F-S34 no longer reproduces".

### Native props carry their callers' colors (D-119, 2026-10-09)

A plain-typed prop (`item: Item`, `children: JSX.Element`) may receive a value that
is pending or may fail. Solid reads a prop lazily, inside the child, so those colors
are the child's. After the sugar pass reaches its fixed point, any call whose prop
TypeScript refuses while the passed source or hole is pending or failing marks that
prop; the declaration is widened to `Source<T, E, P>` with fresh component type
parameters (D-029), and the pass runs again, so a prop forwarded to another
component widens that one too. A prop that only receives ready values keeps its
declaration, and its body is not checked against colors it never sees. A genuine
type mismatch is not a colored source or hole and stays an error.

Each call carries what it passes: a call inside `Loading`/`Errored` (the caller's,
or the child's own, as the dashboard's `Panel`) is covered; an uncovered one
reports at the originating read when rendered (`[PENDING_ROOT]`, review slot T08's
fixture now at `colored-prop.tsx:8:28`). A hole prop may bind events, as a view may
(D-072): `HoleProp` admits `Bind`, so pending children with a handler pass. The
explicit library dialect keeps D-065's `[SETTLED_PROP]`: only the native lowering
widens.

Effects on the corpus: the native `colored-prop` fixture (no root) is accepted; docs
loses its `article` settled-prop error; the dashboard drops five errors (T08 and
F-S38) to ten in five groups (F-S39–F-S43).


### Native dashboard acceptance (F-S39–F-S45, 2026-10-10)

The dashboard original now passes both acceptance halves with an empty author
patch ([record](native-dashboard.md)). Half A: lowering reports exactly the
Router boundary notice, and the generated program type-checks. Half B: 30-state
client parity, streamed SSR of three URLs and hydration all match the original.

**Foreign routers (F-S43).** Take a module-level component from a foreign
package, such as `createRouter(...)`. If every render of it sits under
providers, its `component:` values receive those contexts as provided:
`nativeForeignProvided(Page, witness)`, which discharges them as `foreign`'s
`provided` does. Providers are intersected across renders, so one render without
the provider keeps `NO_PROVIDER`. The native route handoff `nativeForeign` is
typed as the plain call: the router passes its route props, and a page that
declares none ignores them, as the author's Solid function did. The library
dialect's `foreign` keeps the component's own type (D-088). Library authors
declare the route props (`router.type-tests`).

**Context members (F-S45).** A call through a member of a context's value
(`filters.setRange(r)`) calls what every provider of that context put there.
The value can be `useContext(Ctx)` directly, or through constant bindings and
hooks whose every return is that value. The inference collects every
provider's `value` and the context's default:

- A member that is a function or method fails what it fails.
- A Solid setter fails nothing; its callback arguments are the caller's.
- A signal getter fails what its computation fails.
- Anything else stays `unknown`. That covers a provider value that is not an
  object literal, a spread, a member from a non-Solid producer, and a context
  that escapes (used other than as a provider tag or `useContext` argument).

A context's provider tag, `HydrationScript`, `NoHydration` and `markSafeError`
fail nothing.

**Setters in plain function types.** TypeScript accepts a library `Setter`
where `(range: Range) => void` is expected, and the receipt it returns would
write nothing. Where the native lowering finds a setter meeting a plain
(non-receipt) function type, it wraps it as `nativeWrite(setX)`. This applies to
an object property or a call argument. The wrapper writes when called, and the
runtime checks the write where it runs, as for every write (`SETTER_OUTSIDE_RUN`
with no routine running, `WRITE_IN_REACTIVE` in a view).

**Event-phase callbacks.** F-S40 hosts a writing callback prop in the event
that calls it. At runtime, an event-phase lexical callback now runs in the
calling event when an event calls it, rather than in the view that created it.

**Lazy children.** A provider's or control flow's single expression child
(`{props.children}`) lowers to a fragment hole, `<>{child}</>`: their children
are a lazy view, which has no body. A component's own children prop keeps its
declared type (Sierpinski's `children: number`). The setter adapter applies
only to a setter itself (`Setter`, `StoreSetter`), not to a callback that
returns a setter's receipt, which its lexical phase hosts (Todos' `hashchange`
listener).

**Effect elsewhere.** Docs' route handoffs (`Home`, `DocPage`) are now
accepted. Their `unknown` came from `markSafeError` in the failure classes'
constructor, and F-S45 knows it fails nothing. TypeScript now types both pages
as settled. Docs' root error at `main.tsx` remains (`native-verification.json`).

### Callback colors (F-S46, F-S44, F-S47; 2026-10-10)

**F-S46 (soundness).** A lexical callback keeps its host's admission rules
(§ callback hosts), but its operations were never delegated to that host. A
pending or failing read inside `items().map(item => …)` in a hole, or inside a
memo's `.filter(…)`, was missing from the routine's type. A root or handoff
check could then accept a program that may fail: `render(() => <List/>)` was
accepted although a read in its `.map` could raise `RangeError`.

An array method's lexical callback now delegates its operations to its host:
`yield* __nativeLexicalCallback(phase, fn)`, whose iterator yields the
callback's operations and gives back the callback. This covers `map`,
`flatMap`, `filter`, `find`, `findIndex`, `findLast`, `findLastIndex`, `some`,
`every`, `forEach`, `reduce`, `reduceRight`, `sort` and `toSorted`, on a
receiver TypeScript types as an array or tuple. Such a method calls its
callback synchronously in the host.

A hole callback goes through `nativeHoleColors`, which presents a raise as the
failure of the hole's read, as the view types it. Under `yield*` a callback
loses its contextual parameter types. The lowering writes the ones the
receiver method's slot gives (printed by TypeScript, with `import(…)` types
where needed) and waits a pass while any is still `unknown` or `any`.

Not delegated:

- a callback hosted elsewhere (F-S40's event callback props);
- a scheduled or foreign callback (`nativeCallback`);
- a deferred continuation (`.then`), whose colors reach the host through the
  promise it is chained on;
- a component's or control's prop.

**F-S44.** A hole callback may build JSX, as a view does. Its phase admits
child views and bindings, so `items().map(item => <Row label={item}/>)`
type-checks, and a `Row` that may fail carries that failure to the root.

**F-S47 (soundness, done).** A callback given to a function other than an
array method (`consume(() => pending())`) kept its host but was not delegated.
A pending read inside it was missing from the host's type, so a root without
`Loading` was accepted. (A failure was covered: the call's attempt types it
`unknown`.) The call sits in its attempt's plain thunk, where no `yield*` can
go. The callback is therefore hoisted into a binding just before its host's
statement, and delegated there:

```ts
const _callback = yield* __nativeLexicalCallback("memo", function* () { … });
return yield* __nativeAttempt(() => consume(_callback), …);
```

Hoisting crosses only parameterless thunks. It is skipped when the callback
uses a binding such a thunk declares (that callback stays undelegated, as
before). Parameters take the slot's types, as F-S46's do.

Delegating it exposed a staleness in the passes. Before its reads are lowered,
a callback returns its operations unevaluated (`return __nativeAttempt(…)`),
so a call it is given to (`consume(cb)`) looked like an operation.

- The first pass dropped that call's attempt, which lost the call's own
  `unknown` failure.
- It also delegated the call, which a later pass removed only while the
  callback stayed in place.

Neither decision is made now for a call given a lexical callback, in place or
hoisted (`bridgedCall`). After lowering, a callback never returns a raw
operation: its body delegates them.

Tests: `native-callback-colors.test.js` (F-S47 block: nested callbacks; pending
through a user function, with and without `Loading`; parameter types; the case
left in place; a non-array `map`).

### Remaining originals: Rendering, Effect, Room (F-S48; 2026-10-10)

**Anonymous default components (F-S48, done).** `export default () => <…/>`
or an anonymous `export default function () {…}` that returns JSX is a
component without a name, and a sugar component needs one. The prelude names
it after its file: an `index` file takes its directory's name, and a suffix is
added if the name is taken. It becomes `function Profile() {…}` exported by
default. Tests: `native-default-components.test.js`.

**Higher-order components (F-S48, done as F-S51 below).** Rendering's
`RouteHOC(Comp)` returns `(props = {}) => <RouterContext …><Comp/></RouterContext>`,
a component defined inside a function and closing over its argument. Native
mode lowered only top-level named components, so the inner arrow's reads had no
routine host (`SUGAR_CALLBACK` at `router.tsx:23`). The choice was between
lowering such factories and keeping them foreign behind a checked boundary.
They are lowered: a foreign boundary would leave the app's router, and every
page under it, outside the check. That choice is open to Dev's review.

**Effect (open, design).** `placeOrder = effectAction(function* (…) {…})` is
an authored generator driven by a hand-written Effect-TS bridge. It writes
Solid state between Effect steps, and its writes run inside the bridge's own
`action`. The lowering refuses it (`SUGAR_ESCAPE`: a routine handed to an
unknown consumer). A foreign generator bridge needs its own contract.

*Narrowed (2026-10-10).* The first refusal, at `placeOrder.interrupt()`, was
spurious: reading a member of a routine hands nothing over. The escape check
now accepts a member read, though not `call`, `apply` or `bind`
(`sugar.test.js`). The real stop is inside the bridge.

- `effectAction` returns `invoke`, which the lowering makes a routine because
  it calls the action. It returns it through the plain declared type
  `EffectAction<Args, R>`.
- The bridge drives the saga generator itself (`it.next`, `it.throw`) inside
  Solid's raw `action`, and the saga writes Solid state between its Effect
  steps.

*Probed past the refusal (2026-10-10).* With the escape check disabled, the
output shows three things. Solid's `action` compiles to the library's
`$event`, so the bridge's loop runs inside a library event. The saga is an
authored generator, left as written: its setter calls stay plain and would
be lost, and its `yield*` belongs to Effect, so they cannot be delegated
either. Performed on the spot (`nativeWrite`), they would run inside that
event, which the runtime admits; this is not yet tried. And the bridge's
`const it = genFn(...args)` was lowered to `yield* genFn(...args)`, driving
the saga through the library: any generator yielding something other than
plain data counted as a routine. A routine yields library operations, each
carrying the `KIND` brand; an authored generator yields its own values. A
generator yielding unbranded objects is now called and handed to its driver
(`native-owned.test.js`).

Supporting this needs a contract for writes made inside a transaction the
library does not own (today a setter's receipt is admitted only in an
`$event` or an effect's phase), and a typing for a bridge's returned
callable. Both are Dev's to rule; until then Effect stays refused.

**Room (open, out of the native scope so far).** Room's panels are server
components (`live(GET(async … => (props) => <…/>))`), the islands line's
shape, not plain client Solid.

### Wrappers, nested components and refusal positions (F-S49, F-S50; 2026-10-10)

Found by the `sugar-edges` mutation seed and the mutation triage.

**F-S49 (requirements through wrappers).** D-119 makes a wrapper with its own
boundaries generic in its children's colors (`Panel` around `Errored` and
`Loading`). A generic setup takes the plain call signature, whose hole props
require nothing (D-098 amended). So a child that reads a context could not pass
through such a wrapper, even with the provider above it. The generated call
failed with `GENERATED_TYPE`.

The widening now also adds one requirement parameter, `_R = never`, and
`& NativeRequiring<_R>` on the props. The plain-call overload threads it
(`HoleQ<TP>`):

- the props input admits holes that require `_R`;
- the call's view carries `_R`, which TypeScript infers per call from its
  holes.

Authored props never carry the phantom, so `HoleQ` is `never` for them and
every D-029 type test is unchanged. Without a provider the requirement still
reaches the root (`NO_PROVIDER`). Proof obligation S10
([sugar.md](calculus-proofs/sugar.md)). Tests:

- `native-hole-requirements.test.js` (each case fails without the parameter);
- the F-S49 block in `context.type-tests.tsx`.

**Context guard in a component.** `if (!value) throw …` inline in a component,
before its JSX, lowers to `return __nativeContextGuard(…) as never`. That is a
failure path, which `SUGAR_RETURN` now accepts, as it accepts `raise`.

**Nested components: `NATIVE_COMPONENT`.** A component declared inside another
function and used as a tag was lowered as a plain callback, then failed as a
generated `TS2554`. It is now refused at its declaration, once per component:
"Declare X at module level". A lowercase render helper called as a function is
unaffected. HOCs (F-S48) are a separate case: their component is a call's
result, not a declaration.

**A context created in its read: `NO_PROVIDER`.** In `useContext(createContext<T>())`,
a defaultless context created inside its own read can never be provided. It was
refused as `NATIVE_CONTEXT` ("needs a named declaration"). It is now
`NO_PROVIDER` at the read.

**Refusal positions.** A refusal raised while lowering carried its line in an
intermediate program, so it drifted from the source: a destructured prop was
reported a line late, an inline context several lines early. It now carries
`id` and `loc`, and `withPositions` maps it back to the authored position, as
it already did for sugar's own refusals. The two review expectations that had
recorded the drift now name the destructured parameter's line.

**F-S50 (done, 2026-10-10): author-generic components.** A plain Solid
component generic in a value type, `function Labeled<T extends string | number>(props: { value: T;
children: JSX.Element })`, had two problems:

- `Props<{ value: T }>` failed `PropsCheck`. A prop's checks are conditional
  types, which stay deferred while `T` is open, so its reads were `unknown`.
- Its children's requirements were dropped, as F-S49's were: a generic setup
  takes the plain call, whose holes require nothing.

Both are fixed in the lowering:

- A prop whose type mentions one of the component's own type parameters
  (`value: T`, `items: T[]`) is declared as the same bare contract spelled as a
  source, `Source<T, never, false>`, which the library resolves per
  instantiation. D-119 treats that form as bare, so a caller passing a pending
  or failing value widens it to `Source<T, E, P>` as any bare prop.
- The component also takes F-S49's requirement parameter
  (`_R = never`, `& NativeRequiring<_R>`), so a child that needs a context
  passes through.

Tests: `native-generics.test.js` (an open prop typed per instantiation; a
pending value widened, with a pending root refused; a context child carried,
with `NO_PROVIDER` at an unprovided root).

### Rendering through native mode (F-S51, F-S52; 2026-10-10)

Rendering's shared app now lowers without a refusal. What it needed:

**F-S51 (component factories).** A module-level function whose every return is
a function returning JSX is a component factory (`RouteHOC(Comp)`). In the
prelude:

- The returned function is named `<Factory>Component`, so every later stage
  treats it as a component. It takes the props of the factory's declared
  `Component<D>` and loses a default (`props = {}`): a component is always
  given a props object.
- Each `Component` parameter becomes generic in its colors,
  `Comp: Component<{}, P, E, W, R>` on the factory's own type parameters. The
  factory's component carries what its argument's does: pending, failures,
  waits and requirements.
- A component written inline as a module-level argument
  (`const App = RouteHOC(() => …)`) is declared before its binding, named
  after it (`AppComponent`).
- `window.onpopstate = () => setLocation(…)`: a callback assigned to an `on*`
  property is an event, hosted as `$event`.

Tests: `native-factories.test.js` (a factory generic in its component's colors;
an inline component; a consumer rendered outside the factory gets `NO_PROVIDER`
for the router).

**F-S52 (context facades).** Plain Solid declares a context's value with plain
function types, e.g. Rendering's
`RouterValue = [() => string, { setLocation: (value: string) => void; matches: (match: string) => boolean }]`.
Lowered, the provider puts a source, a setter and a routine there. Solid calls
an accessor or a reactive helper where it is used; the library reads a source
and drives a routine there, and neither is assignable to the declared function
type.

Each provided value is walked with the declared type, through aliases and
interfaces in the same file: tuples by position, objects by member. A declared
function type given a source or a routine it does not admit becomes that
value's type, so every consumer reads it or delegates to it, as D-119 widens a
prop. Several providers of one slot give the union of their types (a settled
signal in one, a pending memo in another). The escape check accepts a routine
in such a slot as given where a routine is expected. Tests:
`native-factories.test.js` (the value is typed as what is provided) and
`native-context-facades.test.js` (two providers; a pending provider's reader is
pending up to the root).

**Context members (F-S45, extended).** A tuple value is followed by position,
and a name destructured from a context's value
(`const [, { setLocation }] = useRouter()`) is followed through its pattern. A
call through it calls what every provider put there. Tests:
`native-context-members.test.js`.

**Typed creations.** `createMemo<T>(…)` and `createEffect<T>(…)` declare their
value type. The library's `$memo<Y, R>` and `$effect<YC, V, YE>` take their
operations first, and TypeScript cannot be given the value type alone. The type
moves onto the settled body's returns as `(x satisfies T) as T`, so a mismatch
is still an error. An async iterable of `T` (Stream's memo) is left to
inference, since its items are the value. A function's declared return type
also types the attempt thunk that wraps it. Tests:
`native-typed-values.test.js`.

**D-119 through `lazy`.** `lazy(() => import("./Page"))` of a native module is
a native tag. `LazyComponent<T>` drops the page's type parameters, so a lazy
target's widened props take the concrete union of colors its callers pass
(`Source<T, E, P>` with concrete `E` and `P`), not type parameters. Tests:
`native-lazy-props.test.js`.

**Failure inference (Rendering's rules).**

- An Errored fallback's `reset()` clears the boundary and re-runs its
  children. The call itself throws nothing.
- A Promise resolved with a value that has no `then` (an object literal, an
  array, a primitive) cannot adopt a rejection.
- With `@types/node` loaded, `setTimeout` is declared there rather than in the
  DOM library, and it schedules as the DOM's does.

Tests: the "Rendering's rules" test in `failure-inference.test.mjs`.

**A captured routine callee is not an escape.** The lowering captures a callee
before evaluating its arguments, in source order. A routine captured in a
`const` that is only ever called is still delegated.

Rendering then lowered with 14 diagnostics (`native-verification.json`). The
three setup reads (`createSignal(props.id)` twice in ErrorStream, and
`props.url` in the router; D-042) are correct, each with its `TS2769` at the
component. Stream and Skeleton still had type errors; they are F-S53.

### Stream and Skeleton (F-S53; 2026-10-10)

**Async iterable producers.** `createProjection<T[]>(async function* (state) {…}, [])`
became `$projection(function* () { return yield* attempt(async function* (state) {…}) })`,
so the draft was the attempt thunk's parameter, and the thunk was called with
none. An async producer's parameters now stay on the compute, and the producer,
which is the attempt's thunk, closes over them.

**A source as a key is read.** Solid's `Repeat` hands its child a number; the
library's index is a source (D-055). So `projItems[i]` became `projItems[yield* i]`.
More generally, a source used as a computed key is read, since a source is never
a valid key. Each other value use of a `Repeat` index inside the child's holes
(`{i}`, `i + 1`) is also a read. A use in the child's own setup stays a setup
read.

**Derived stores are projections.** `const [store] = createStore(fn, seed, options)`
is Solid's projection: the function computes into a draft of the seed. It
becomes `createProjection(fn, seed, options)`, which maps to `$projection`.
A derived store whose setter is used stays a store call, and TypeScript names
the mismatch.

**`isPending` and `latest` thunks.** `isPending(() => store.items)` and
`latest(() => feed())` take a thunk; `isPendingOf` and `latestOf` take the
source. A thunk that only reads one accessor or one store path becomes that
source (`isPendingOf(store.items)`), and the path given there is not read. Any
other thunk is left as written.

**`createSignal<T>()`.** Solid's overload holds `T | undefined` and starts
undefined; `$signal` always takes its first value. It lowers to
`$signal<T | undefined>(undefined)`.

**Failure inference: two precision fixes.**

- Babel keys a function by its body without parentheses. TypeScript's body for
  `() => ({ … })` is the parenthesized expression, so such an arrow (Skeleton's
  `placeholderFeed`) never resolved to its own summary and every call to it
  failed `unknown`. The lookup now unwraps parentheses. This affects any
  module-level arrow returning an object literal.
- Authored generators stay opaque (`unknown`): a foreign driver can `throw()`
  into one. A generator called as the iterable of a `for…of` or
  `for await…of` is driven by that loop alone, through `next()` and `return()`,
  so there its own body's failures are exact. That is how Stream's `getData()`
  fails nothing. A generator iterator that leaves its call (returned, or bound
  first) stays `unknown`.

Tests: `native-streams.test.js`, plus two tests in `failure-inference.test.mjs`
(the parenthesized arrow; loop-driven generators).

With these, Rendering's shared app type-checks except for its three setup
reads. The author's minimal fix for those (a local override signal and a memo
over the prop, the twin's own pattern) type-checks and lints clean.

### Rendering accepted in two halves (2026-10-10)

**Half A** (`scripts/native-rendering-check.mjs`; gate steps
`native:rendering:diagnostics` and `:typecheck`). The unchanged original
(`shared/src` and all five entries: CSR, and the streamed and string servers
with their clients) lowers with five notices: the `RevealOrder`
type and four foreign boundaries (`Reveal` and `Portal` from Solid). It gives
exactly these findings, each at its authored position:

| Finding | At | Correct because |
| --- | --- | --- |
| `READ_IN_SETUP` (lint), with its `TS2769` at the component | `ErrorStream.tsx:21:36`, `:48:36` (`createSignal(props.id)`) | A setup creates; it does not read (D-042). Solid reads `props.id` once, so a later `id` prop is ignored. |
| the same | `router.tsx:22:25` (`props.url ?? …`) | The same, in the factory's component. |
| `PENDING_ROOT` | `csr/client.tsx:4:15` | The first route is a `lazy` page. Solid defers the mount, and says so itself (`ASYNC_OUTSIDE_LOADING_BOUNDARY`); the library asks for that root `Loading` to be written (D-099). |
| `FOREIGN_HANDOFF` | `csr/client.tsx:4:15` | A route chunk can fail to load (`ChunkError`), and nothing handles it. While the three components do not type, the list reads `unknown`. |
| the same two | `stream/client.tsx:7:5`, `stream/entry-server.tsx:6:17` | The streamed entries render the same pending, failing app under `Shell`. |
| `FOREIGN_HANDOFF` | `string/client.tsx:11:5`, `string/entry-server.tsx:12:17` | The string entries already wrap the app in a `Loading`, so only the unhandled `ChunkError` remains. |

The author's fix (`examples/harness/native-rendering/author-fix.json`, 14
edits in 7 files) type-checks and lints clean:

- Each setup read becomes a local override signal and a memo over the prop
  (`const [chosen, setId] = createSignal<string>(); const id = createMemo(() => chosen() ?? props.id);`),
  the twin's own pattern.
- Each entry's app is wrapped in an `Errored`, and the CSR and streamed ones
  also in a fallback-less `Loading` (the string ones already have theirs).

**Half B** (`examples/harness/native-rendering/check.mjs`; gate steps
`native:rendering:parity`, `:ssr`, `:hydrate`). It compares the original, the
fixed copy as plain Solid, and the fixed copy through native mode. The fixed
copy is written once as a project of its own, so native mode lowers it whole.
The checks:

- **Client:** the twin's 29-step script (`examples/rendering-yield/tests/script.ts`),
  identical at every step.
- **Streamed SSR:** all 7 routes give the same markup and the same Solid
  notices (`/error-stream`'s two contained render errors).
- **Hydration:** 4 routes keep the server's nodes and settle to the same page.

What it took, besides F-S51–F-S53:

- **A root tree is the entry's component.** `render(() => <Errored …><Loading><App /></Loading></Errored>, el)`
  wraps a yield component in Solid's own markup. An entry stays plain Solid,
  so `App` was refused there as a tag (`COMPONENT_TAG`). Such a tree, when the
  call is at module level and uses only module-level bindings, is now declared
  as `Root` before the call. The file is then lowered as a module, its render
  becomes the library's, and the root is checked (`RootCheck`). A bare
  `<App />` keeps the entry's existing handoff check. A tree inside a
  module-level function (`renderToStream(() => <Shell><App url={url} /></Shell>)`
  in `render(url: string)`) may use the function's typed parameters and typed
  constants. Each becomes a prop of `Root`, and the root code is bound and
  checked as a bare root is:
  `const __nativeRoot = () => Root({ url }); renderToStream(foreign(__nativeRoot satisfies RootCheck<typeof __nativeRoot>))`.
  The renderers fail nothing of their own in the inference, since the root
  check owns their root's failures, so `render(url)` stays a plain function.
  Tests: `native-entries.test.js`, and the renderer test in
  `failure-inference.test.mjs`.
- **`ParentProps` children widen (D-119).** `Shell(props: ParentProps<{ clientEntry: string }>)`
  received a pending, failing `App` as `children`. The widening only edited
  `Props<{ … }>` literals, so it refused the call (`SETTLED_PROP`) instead of
  letting the colors reach the root. `ParentProps<L>` (`NativeParentProps`) now
  counts as L's members plus a plain `children`.
- **A factory's result is a native tag.** An imported tag whose binding is a
  call to a selected component factory (`App = RouteHOC(…)`) was treated as
  foreign (`foreign(App)`). It is now a yield component.
- **Positions.**
  - A delegation the lowering adds around an authored expression
    (`yield* props.id`) now maps to that expression, not its routine's name.
    So a setup read is reported at the read.
  - The context facade (F-S52) spliced text and lost the file's position
    table; the router's diagnostics read `1:1`. It now replaces the type in
    the tree and prints mapped.

  Tests: `positions.test.js`.
- **Callback arity (runtime).** `nativeHostCallback` returned
  `(...args) => …`, whose `length` is 0. Solid's `Errored` logs what it
  catches when its fallback takes no parameters, so native Rendering logged
  the bad item's error that the original does not. A lexical callback now
  keeps its body's arity. Tests: `native-write.spec.tsx` (both cases fail
  without the fix).

### Found by the rendering-edges mutants (2026-10-10)

The mutation corpus's new `rendering-edges` seed left two silent survivors.
Both were real gaps, and fixing them exposed a third.

- **A kept promise stays a promise.** In an async routine,
  `const data = load(n())` (no `await`) holds a Promise in the original. The
  lowering attempted every promise-returning call where it was made, which
  awaits it. So the lowered program read `data.title` from the resolved value,
  where the original reads `undefined`, and TypeScript's error (no `title` on a
  Promise) was lost.

  A call to an `async` function whose promise is kept as a value (assigned or
  passed on; not awaited, returned or discarded) now stays a plain call. An
  `async` callee cannot throw synchronously, so the attempt lost nothing but
  the waiting. The promise is attempted where the code awaits it. A call to a
  non-`async` function that returns a promise can throw before returning it,
  so it keeps its attempt.

  Tests: `native-promises.test.js`. The mutation catalog's `remove-await` now
  also expects TS2339. Proof obligation: S15 (`calculus-proofs/sugar.md`).
- **A setter given a hoisted callback writes.** F-S47 hoists a lexical
  callback into a binding before its host's statement. Until the callback's
  reads are lowered, it does not delegate the call given it, because that
  call's type can follow the callback's. A setter's call was caught by the
  same rule: `onClick={() => write(c => { c.n = n(); })}` lowered to
  `return write(_callback)`, a receipt returned unperformed, so the write was
  dropped.

  A call to a library setter (the second element of `yield* $signal(…)`,
  `$store`, `$optimistic` or `$optimisticStore`) is now delegated regardless.
  Tests: `native-callback-colors.test.js`. This shipped with F-S47 in
  `31695cb`.
- **Nothing in an async producer is delegated.** F-S53 attempts a core
  async producer (`createMemo(async function* …)`, `createProjection`'s) as a
  stream: the attempt takes what it yields as the stream's values. The
  lowering still treated its body as a routine, so a read became `yield* n`
  and a setter's call `yield* setN(0)`, each yielding the operation into the
  stream as a value, and `yield n()` became `yield n` (a plain `yield` was
  taken for a delegation). No check fired: the second run's `memo-write`
  mutant at `rendering-edges/Feed.tsx:42` survived silently. A read there is
  now refused with `READ_IN_OPAQUE_GENERATOR`, as in any generator the
  lowering does not own, and a setter's call stays plain, where
  `no-unyielded-write` reports it. Only a `yield*` counts as a delegation
  already made. Tests: `native-owned.test.js` (async producers).
- **The lint sees aliased setters.** `solid-yield/no-unyielded-write`
  recognized a setter only when its creator was spelled `$signal` (or
  `$store`, …). Native output imports `$signal as createSignal`, so the rule
  never fired on lowered code. It now resolves the import. That is how it
  found the dropped write above, in the accepted `event-updater` fixture. It
  also reports a setter called inside an async iterable producer
  (`createMemo(async function* () { setVersion(0); … })`), which the lowering
  keeps as plain code (above), where the write would be dropped. Tests:
  `rules.test.js`.
- **An equivalent the catalogue cannot name.** `delete-loading` at
  `rendering-edges/Feed.tsx:56` survives silently. The root's `Loading` (in
  `main.tsx` and `server.tsx`, which the lazy page needs anyway) covers Feed,
  so removing Feed's own boundary moves the fallback; the program is still
  accepted, correctly. The catalogue's equivalence is per operator, so the
  report keeps it as a survivor.

### Effect through native mode (D-121; 2026-10-11)

Dev ruled the Effect bridge is modeled, not refused (D-121), and native mode
now checks plain Solid and ships it as written (D-120). Lowered past its
refusal, the Effect original reached 26 errors; it now reports two, both
findings the checker should make: `MODULE_STATE` at `log.ts:20:7` (a notice:
the fiber log is module state, written from Effect's scheduler) and
`EVENT_REJECTS` at `checkout.tsx:194:43` (`placeOrder.interrupt()` calls
`Effect.runFork`, an unanalyzed package, and nothing catches it). Each gap
below is general; the Effect original was the first to reach it. Tests:
`native-effect-model.test.js` (14 cases).

- **A saga driven inside an action writes there (S16).** A generator handed
  to a function whose every use of it is a direct call inside the generator
  given to Solid's `action` (checked through TypeScript, across files) runs
  inside that action. Its `yield*` belongs to its driver, so a setter call
  there is performed where it is made (`__nativeWrite(setPhase)("charging")`)
  and `refresh` is the library's, performed the same way. A write in a nested
  callback stays plain: it may run outside the action (`native-sagas.js`).
- **A kept action promise stays a promise.** An event call chained with
  `then`/`catch`/`finally`, or returned by a plain function handed out as a
  value (Effect's `invoke`), is not delegated: delegating waits for the result,
  where the original holds the promise and handles its rejection. Before this,
  `save(x).catch(() => {})` lowered to `.catch` on the action's result, and the
  action's failures leaked into the handler's.
- **A generator yielding its own values is called** (`8b5af4a`): only a
  generator yielding library operations (`KIND`-branded) is a routine.
- **A store's root is a path for `For`.** `each={cart}` passes the store, not a
  thunk returning it (which gave rows of `never`).
- **Read-only array methods read a store's value:** `reduce`, `includes`,
  `join`, `flatMap`, `at`, `findLast` and the rest join `map`/`filter`.
- **A routine keeps its declared result type** (`return value as T`): it types
  the returned callbacks' parameters (`resolveFork`'s `effect =>`) and gives
  callers `T`. An assertion, because the model's values can differ from
  Solid's there (an `$event`'s promise may resolve `undefined`, D-085). A
  declared `Promise<T>` gives `T` (the promise is attempted where it is made);
  `() => T` is Solid's accessor shape, a source in the model, and is left alone.
- **A captured method keeps its generics.** `nativeInvoke` is typed by its
  parameters and result, so `Effect.runPromise` is instantiated from its
  argument (it gave `Promise<unknown>`).
- **A type guard narrows through its attempt.** `if (Exit.isSuccess(exit))`
  lowers to `__nativeGuarded(exit, yield* attempt(() => Exit.isSuccess(exit)),
  Exit.isSuccess)`: the attempt runs the guard once, and `nativeGuarded`
  carries its narrowing.
- **A context with a default is read anywhere.** Its read requires nothing and
  cannot fail, so it is no operation; `runEffect` resolves its runtime inside a
  memo, as Effect's comment says it should.
- **A routine's stream returned from a memo is attempted** (D-091), as a plain
  function's is, with `unknown` failures: what its iterator raises is not
  inferred.
- **Accessor props (F-S54).** A prop declared `() => T` that callers pass a
  source (a memo or signal getter, as in Solid) is declared `T`; a call of it
  is a read, and `latest`/`isPending` take the source.
- **F-S39 for identifiers.** A member a source lacks is read through it for an
  identifier too (`w => w.length` over strings), once the source's value is
  known.

**Effect accepted in two halves (D-121, D-122; 2026-10-11).** Half A
(`scripts/native-effect-check.mjs`; `native:effect:diagnostics|typecheck`): the
unchanged original reports exactly `MODULE_STATE` (`log.ts:20:7`) and, in
`solid-yield check`, `EVENT_REJECTS` (`checkout.tsx:194:43`). The author's fix
is one edit: the cancel handler's call in a `try` whose `catch` is marked
`@yield-absorb`. It then checks clean but for the module state. Half B
(`examples/harness/native-effect/check.mjs`; `native:effect:parity`): the
original, the fix and its native model (`emit: "lowered"`) match at all 36
states of the twin's script, console output included.

- **A provider's value in the provider's own owner (D-122, S17).** Effect's
  `<RuntimeContext value={createRuntime(layer)}>` creates a runtime, registers
  its cleanup and may fail. Solid computes it once in the provider's root; the
  model computed it in the enclosing view, which may not own a cleanup (the
  model ran into `CLEANUP_OUTSIDE_OWNER`). `Ctx.provide` now takes `{ init,
  children }`: `init` runs there as a setup does and may fail, its failures
  the provider's. The lowering moves a value there when its operations are
  setup operations or a raise.
- **Lazy views are views.** A flow control's lazy children were typed
  `Generator<any, …>`, so a creation, a cleanup or a write there type-checked
  and the runtime refused it. They are `Generator<ViewOp, …>` now
  (`jsx.type-tests.tsx`); every twin and native original was unaffected.
- **`onCleanup` makes a routine for throw lowering too.** A helper whose only
  reactive call is `onCleanup` became a routine in the last pass, after its
  `throw` was left plain: an untyped failure. It is seeded as a routine like
  any Solid API call, but in a Promise executor, where `onCleanup` stays
  Solid's.
- **A defaulted context is read anywhere at run time too.** `readContextValue`
  skips the setup check for a context with a default, as its type does.
- **Module state does not block `emit: "lowered"`.** It stays plain Solid in
  the model, so the model still runs; the finding is reported.


**The survivors (2026-10-12, final).** The program run scores 72.85% (488
mutants; 279 killed, 105 equivalent, 104 survived; it was 65.97% this morning).
No survivor is silent and none reports a different code. Of the 104, 60 are
masked (49 bases refused by the transform, which stops at its first refusal;
11 bases already reporting the expected code) and 44 are detected outside the
mutated routine: a removed boundary is reported where the failure, pending
read or requirement starts, and at the root.

Eight mutants are site equivalents (Dev's ruling; `scripts/mutation/
equivalents.mjs`, each with its authored line): each was read against its
program and is correct to accept, because the edited site has nothing left to
do.

- `delete-catch` at `reviewer-m05_swallow/App.tsx:14`. The `Errored` around
  `List` takes the failure the deleted `catch` absorbed.
- `remove-await` at the same line. `return fetchItems()` in an `async`
  function has the awaited form's type, so no type error is lost; the rejection
  leaves the `try` unabsorbed and reaches the same `Errored`.
- `delete-errored` at `reviewer-m05_swallow/App.tsx:26`. `List`'s
  `try`/`catch` absorbs every failure under that boundary, so nothing reaches
  the root.
- `delete-provider` at `review-slots-context/App.tsx:8`. The program renders
  nothing: `App` and `Child` are exported, so their requirement of `C` is
  their callers', as for any library component.
- `delete-loading` at `review-slots-lazy-child/App.tsx:3`. The boundary held
  static text; nothing below it waits.
- `delete-catch` at `review-slots-catch/App.tsx:5`. The `try` held a
  setter's call, which cannot fail.
- `delete-loading` at `rendering-edges/Feed.tsx:56`. The root's `Loading`
  covers Feed (above).
- `callback-throw` at `hole-edges/App.tsx:23`. The throw is in the `total`
  memo's `reduce` callback; the memo is read only under the `Errored`, which
  takes it.

The last "different code" survivor, `destructure-props` at
`sierpinski/main.tsx:51`, is killed: the recursion lowering's snapshot
refusal keeps its code and points at the caller that broke the snapshot (below).

### Found by the non-core-cache survivors (2026-10-12)

Eighteen of the nineteen "different code" survivors were one operator,
`non-core-cache`, which replaces `createMemo` with an inline cache typed
`any`. The checker refused each mutant with `GENERATED_TYPE`, but the same
refusal hit a correct program: a synchronous function behind the same cache
was refused too. Reading why found three gaps.

- **A call that may fail, in a JSX hole, is the hole's.** `<p>{format(name())}</p>`
  with a `format` that may throw lowered to an attempt in the view itself, and
  a view cannot raise: `GENERATED_TYPE` for every such call, under an
  `Errored` or not. The attempt is now wrapped in `nativeHole`, which carries
  what it raises as a failing read of the view (`HoleViewOp`, as
  `nativeHoleColors` does for a hole callback). An `Errored` above takes it;
  a root without one reports `FOREIGN_HANDOFF` at the call; an exported
  component hands it to its callers. When the attempt resolves to a source or
  routine call (a callback prop, D-119), the wrapper goes with it. Tests:
  `native-hole-failures.test.js`.
- **`any` reads as `any`.** TypeScript leaves the members of an `any` value
  unchecked; the library's types turned it into `unknown` instead (an element
  of `any`, a key of `any`, a context of `any`, `[any] extends [Source<infer
  T>]`), and an attempt or a memo over `any` took it for a promise, an event
  call and a stream at once (`WRITE_IN_REACTIVE`, a pending root). Each now
  keeps `any`: a row, a store's key, a context, a memo and a method of `any`
  check as the original does. The lowering reads a source of `any` before its
  member (`(yield* row).name`, F-S39 extended to setup locals for `any` only),
  and lifts a row's read out of an attempt's thunk. A method of `any` is
  outside code: its failures are unknown, so it needs an `Errored` like any
  other. A prop of `any` is still refused (`PROP_TYPE`, calculus F03: it could
  hide a colored source). Tests: `jsx.type-tests.tsx` (`AnyRows`),
  `native-hole-failures.test.js`, `native-effect-model.test.js`.
- **What the cache mutants are now.** With `any` checked as TypeScript checks
  it, a cache typed `any` over an async memo is accepted: its `any` hides the
  cached promise from TypeScript and from the model alike. Dev's ruling: the
  operator's cache is generic in the cached value, as a hand-written cache is
  (a catalogue correction). Every `non-core-cache` mutant is now killed but
  the eight whose bases are refused. Over an async memo, the generic cache
  leaves a promise where its value was expected, and that found the next gap.
- **A promise given to `For` is the promise (S19).** Solid's `For` maps its
  list where it reads it; given a promise it fails (`t.slice is not a
  function`). The model's attempt awaited the call and mapped the resolved
  list: it accepted what the original fails on. A call that is the whole value
  of a `For`'s `each` and returns a promise is attempted boxed now
  (`attempt(() => ({ value: cached() })).value`): its synchronous failures are
  taken, the promise is not awaited. The library's `For` refuses an `each`
  that is not a list (`EachRule`, `[FOR_EACH]`), as Solid's `For` type does.
  A list read through a memo is the memo's value, as before. Tests:
  `native-hole-failures.test.js` (a promise given to For),
  `jsx.type-tests.tsx` (`PromiseEach`).
- **A multi-line diagnostic** (a TypeScript message chain) was dropped by the
  mutation worker's row parser; the one mutant it hid
  (`rendering-edges/Feed.tsx:42`'s TS2345) is killed now.
- **A source of `any` read in a plain function's callback** (`hole-edges`'s
  cache mutant: `once(() => rows.items.length)`) is `SUGAR_CALLBACK`, as a
  typed read is; it had been a raw TS2339. The read waits only in a callback
  that becomes a routine in a later pass (a row's, a hole's).
- **A component whose props are `any`** is refused at its callers
  (`PROP_TYPE`); a method call through one of its `any` props is reported in
  its body too (`SUGAR_CALLBACK`), since such a prop has no typed path to read.
  Typing the props, as `PROP_TYPE` asks, clears both.

### Every native refusal pinned (2026-10-12)

`scripts/native-coverage.mjs` (gate step `native:coverage`) lists every
diagnostic the native checker can emit: the lowering's refusals (`fail`,
`report`, `nativeRefusal`), the CLI catalog's codes and the library's type
brands (`"[CODE] …"`), 65 in all. It fails when a code has no test naming it.
Three refusal branches cannot fire and are listed with why: `SUGAR_LEXICAL`
(Babel's arrow conversion hoists `this` and `arguments` first, so a routine
arrow keeps their meaning), `NATIVE_HOST` (every JSX value has a statement
parent) and `NATIVE_ACTION` (a call argument is an expression or a spread).
The first run found seventeen refusals with no test;
`native-refusals.test.js` now pins each at its authored line and column (18
cases), and writing them found three gaps:

- **A refusal from a later stage lost its code and its line.** The effects,
  prelude, recursion and entry stages threw plain errors, which
  `solid-yield check` reported as `[TRANSFORM]` at 1:1 (sierpinski's
  `NATIVE_RECURSION` read so in the mutation report). They throw
  `nativeRefusal(file, node, code, message)` now, which `withPositions` maps
  to the authored position: `[NATIVE_ASYNC_SETUP]` at the call, not 1:1.
- **A context's rest binding was dropped.** `const { width, ...rest } =
  useContext(Size)` lowered without `rest`, so the model failed on a
  correct program ("Cannot find name 'rest'"). A rest element is refused as a
  default is (`NATIVE_PATTERN`: the value order must be explicit).
- **`SUGAR_NAME` pointed at the program**, not the declaration it reserves.

**Site equivalents (Dev's ruling).** The eight silent survivors read as
correct to accept (above) are marked equivalent in
`scripts/mutation/equivalents.mjs`, each with its reason and the authored line
it was read at; a changed line, or an entry matching no mutant or several,
fails the mutation run. The report lists them.

### The insertion, proved on a core and checked on the lowering (2026-10-13)

The calculus proofs covered every rule the lowering relies on (S1–S19) but
not the insertion itself: that putting `yield*` at the reads TypeScript types
as sources, and nowhere else, keeps the program's meaning. **S20**
(`SugarProofs.lean`, `Insertion`) proves it on a core of plain Solid
expressions (literals, source reads, plain calls, sums, conditionals,
`throw`). Run by the library's driver, the lowered routine gives what Solid's
direct evaluation gives: the same value, the same reads tracked in the same
order, the same suspension at a pending read and the same failure
(`insertion_preserves`). Its reads are exactly what the result depends on, so
Solid reruns it exactly when it must (`lowered_reads_are_dependencies`). A
value read once and kept is tracked by nothing (`snapshot_untracked`): the
setup read that `READ_IN_SETUP` refuses.

The proof assumes the lowering finds every source read. **`native:insertion`**
(`scripts/native-insertion/check.mjs`) checks that on the real lowering.
Seeded programs, each with twelve memos built from signal, store-path,
async-memo and earlier-memo reads, plain calls, sums, conditionals, `||` and a
helper that throws past a bound, run side by side as written and lowered
(`emit: "lowered"`) on one Solid runtime in jsdom. Each memo's value crosses a
child's prop (D-119) inside its own `Errored` and `Loading`. Every slot (value,
`Errored` fallback, `Loading` fallback) must match at mount and after each of
twelve writes. The gate runs seeds 1–8 (104 states in about 15 s); a sweep of
seeds 9–58 (650 states) found no difference. The harness asserts that the
native copies were lowered and the originals were not (a first draft compared
each program with itself), and that some slots changed, failed and suspended.
A copy given one different constant fails at mount.

**Found by probing new mutation operators.** A signal created in an event
handler, or in an effect's phase, was reported only as `GENERATED_TYPE`
("check this operation"). The CLI named `CREATE_OUTSIDE_SETUP` for a creation
in a memo, a hole or a view, but not in an event or a phase, whose hosts admit
writes. It does now. When the handler is bound by name (`onClick={add}`), the
lowering wraps it (`$event(function* (...args) { return yield* add(...args);
})`), and the rejected yield is that generated delegation: the CLI follows
the delegation into `add` and reports the creation at its authored line
(`locality.test.cjs` C01, C02).

**Two operators for mistakes no operator made yet.** `module-state` moves a
component's own signal or store (its initial value closing over nothing local)
to module scope, where every render shares it (`MODULE_STATE`).
`create-in-hole` creates a memo read once in JSX inside that hole
(`{createMemo(fn)()}`), where it is recreated on every run
(`CREATE_OUTSIDE_SETUP`).

**Found by `create-in-hole` (its first run left 11 of 18 alive):**

- **A flow control's value prop took any operation.** `<Show when={(setN(2),
  n() > 0)}>`, `<Show when={createMemo(…)()}>` and `<For
  each={createMemo(…)()}>` checked clean: a prop given as a hole kept only its
  colors (`FlowView<Ops<W>>`), and a write or a creation is no color. Solid
  runs that prop where the control reads it, as a memo. `For`'s `each`,
  `Repeat`'s `count`, `Show`'s and `Match`'s `when` and `Loading`'s `on` now
  check a hole that writes, creates or cleans up against `HoleOp`
  (`HoleCheck`, `flow.ts`; `jsx.type-tests.tsx` `HoleProps`).
- **The CLI named the wrong code, or none.** TypeScript reports such a hole at
  the whole call, under the last overload's message (`[LAZY_VIEW]`), and a
  write in a component's prop as `SETTLED_PROP`; a creation in a call in a
  hole surfaced at the boundary's generated lazy view. The CLI now looks in
  the call's hole props (and a parameterless `children`/`fallback`, a lazy
  view; a row's setup may create) and follows an inline wrapper
  (`__nativeHole(function* () { … })`) to the authored operation:
  `WRITE_IN_REACTIVE` or `CREATE_OUTSIDE_SETUP` at its line
  (`locality.test.cjs` C03–C06).
- **An async effect phase was accepted when it wrote local state.**
  `createEffect(() => count(), async n => { set(n); })` (review slot R07)
  checked clean: the lowering made every async function that touches Solid a
  routine and dropped `async`. Solid refuses an effect phase's promise (in
  development "invalid cleanup value"; in production it is called as the next
  cleanup). An async effect phase is now refused (`SUGAR_ASYNC`, as one that
  touched nothing already was), whatever its body does
  (`native-refusals.test.js`).

**Scoring (D-123).** A deleted boundary is caught when its expected code
appears anywhere the unmutated program did not report it, since the checker
reports the read the boundary covered. A reviewer program seeded with a
deliberate mistake that the checker reports is a check of that mistake only:
a second mistake on top could not show.

**The operator seed's base checks clean.** Its click handler rethrew
(`catch (e) { throw e; }`, a `swallow-catch` site), so the base reported
`EVENT_REJECTS` and held three checks back. It logs now, marked
`@yield-absorb`. Read against a clean base, those three are correct at their
sites and are site equivalents: a deleted catch that only rethrew, an
unawaited return inside that try, and a throw behind `if (false)` under an
`Errored`. `equivalents.mjs` is now part of the run's fingerprint, so editing
an entry invalidates a cached result.

**Result:** 100 % (236 killed / 0 survived / 62 equivalent; 298 mutants on 22
of 43 programs). The last two survivors were Todos' own: the original already
reports `EVENT_REJECTS` for the handler at `app.tsx:82`, and deleting the
catch at `todos.ts:144` or `:159` widens that report (`SyntaxError |
TypeError | unknown`) rather than adding one. Dev's ruling (D-123 §3): for the
deletion operators, a report that now lists more failure kinds is caught too.

**Over the language surface (2026-10-13).** The corpus gained the native
surface's 78 forms, each a program of its own (`mutationPrograms()`), whose
mutants are the operators' sites in the form and the boundaries around it;
two sites that make the same program are one mutant. **100 %** (728 killed /
0 survived / 89 equivalent; 817 mutants on 99 of 121 programs). Its
survivors were three checker gaps, fixed (see "What mutating it found"
under the surface check), and 17 sites the check rightly passes, each a site
equivalent with its reason: a throw that lands in the form's own `try`, a
promise kept as a value, a second throw under an `Errored`.

**Proofs S21 and S22.** S20's core gained props and events. A child whose prop
reads delegate to its caller's lowered getters computes what Solid computes
with the caller's expressions read where the child reads them (lowering is
compositional); a settled prop would be tracked by nothing. The lowered event
leaves the store Solid's event leaves; a computation none of whose tracked
reads an event wrote keeps its result, so Solid not rerunning it is right, and
a memo's cache stays Solid's outcome.

### Foreign APIs and the whole language surface (D-124; 2026-10-13)

**Foreign Solid APIs.** Per D-116 and Dev's ruling, a Solid API with no
native model stays as written: its value is Solid's type and its failures
are `unknown`, handled where it is used (`nativeForeignApi`). The common ones
are modelled: `untrack` (`nativeUntrack`: the host's reads, untracked;
settled only in a component's body), `merge`/`omit`/`mergeProps`
(non-throwing), `children` (a memo), `createRenderEffect` and
`createTrackedEffect` (effects), `Dynamic` (a foreign tag). Plain code given a
source gets Solid's accessor (`nativeAccessor`); a helper's `Accessor<T>`
parameter carries its callers' colors; a DOM spread reads its sources and
binds its events where Solid's spread does (`nativeSpread`).

**The surface check.** `scripts/native-surface` is the completeness check:
every JavaScript and TypeScript form a component is written in (71 forms),
placed in every host Solid runs code in (hole, attribute, memo, effect
compute, effect phase, event, component body), reading, writing, and reading
sources that are pending in a rendered app; the seven `await` and promise
forms in the event; and 40 JSX constructs (attributes, `class`/`style`
objects, SVG, children, lists, every flow control, components with props,
children and getter props, every event shape, inputs, refs). 1552 programs,
each with what plain Solid says about it, through the mutation program's
pipeline (transform, `solid-yield check`, generated lint). The pending
variant is the soundness half: a form that dropped a read's color would let
a suspension or a failure through unreported. All 1552 match
(`documentation/native-surface.json`); the gate runs it (`native:surface`),
reusing a result for the same sources.

**What it found.** Gaps in common Solid code, all fixed and each
pinned by a vitest case (`native-forms.test.js`, `native-foreign-apis.test.js`)
or a ts-plugin case (C07–C09):

- `store.list.map(…)`/`filter(…)` chains failed to type: the structural read
  was given the list already read.
- An IIFE, or an array callback, in a component body was refused
  (`SUGAR_CALLBACK`) instead of `READ_IN_SETUP`; in a hole an IIFE ran as a
  callback of its own, so a pending read in it went unreported. An IIFE is
  now an inline routine (in a hole, a thunk through `nativeHole`, since JSX's
  contextual typing widened a `try` in it to `any`).
- A local function only ever called (`const get = () => n(); get() + 1`)
  ran as a lexical callback: its colors were dropped. It is a routine now, as
  a reader a function hands back is.
- An object's getter or method that reads was refused (`SUGAR_HOST`); a
  class declared inside a memo or a handler was refused (`SUGAR_LEXICAL`,
  `NATIVE_RECEIVER`), its own `this` taken for the arrow's.
- Nested `await`s were attempted inside a thunk; `await r.json()`, a promise
  of `any`, was typed as a stream (`STREAM_IN_EVENT`).
- An effect phase returning `void` (`v => console.log(v)`) failed to type in
  the cleanup lowering.
- `onClick={props.onClick}` and Solid's `onClick={[handler, data]}` were
  refused (`NATIVE_HANDLER`); a callback prop's unannotated parameters lost
  the child's declared types.
- `import type { JSX } from "@solidjs/web"` was dropped (Babel does not count
  a qualified type name as a reference); an unmapped type-only import was
  emitted twice.
- A write in a component body was reported as `JSX_IN_SETUP`
  (`WRITE_IN_REACTIVE` now); a pending read in an effect phase as
  `GENERATED_TYPE` (`PENDING_IN_EFFECT`, new); a failure inside a generator
  declared in a handler twice (handler and root).
- The type-checking service looped forever when the lowering crashed without
  naming a file: it blamed a file already dropped, so nothing was dropped.

**What mutating it found.** The mutation program runs over the surface too
(`scripts/mutation/corpus.mjs`): each form in a memo of a rendered app (an
event's in its handler), its sources pending, shown under a Loading when it
reads one and an Errored when it may throw; the operators' sites in the form,
and the boundaries around it. Its survivors were three more gaps, each now a
form of the surface and a vitest case:

- An array method's callback that reads nothing (`items().every(x => …)`,
  `reduce`, a store list's `map`, a sort comparator) ran as plain code: what
  it threw never reached the memo's Errored or the root. In a host, such a
  callback that may fail is a routine now, its throw a typed raise the host
  takes, as a reading callback's is.
- A callback in a hole's IIFE lost its host once the IIFE was bound before
  the view (`nativeHole`): its reads and failures did not color the hole.
- A promise an event kept as a value (`const request = fetch(url)`, a
  receiver, an argument) was awaited by the model, so `request.status` typed
  and `request.then(…)` did not. It stays a promise; a platform function's
  (`fetch`, which rejects rather than throws) stays plain, another's
  attempt takes only what it throws before returning. Its rejection reaches
  the `await` on it and a continuation chained on it (`request.then(…)`).

### Unreached paths probed; events as Solid types them; D-125 (2026-10-14)

**Measuring what is exercised.** The surface check says every form is
handled; it does not say every path of the checker is reached. Coverage
was measured across the whole test system at once (each package's suite,
the surface corpus, the example apps' native gate steps and the mutation
run), with the checker's sources loaded as written so V8's counts map onto
them line for line. Each unreached line was then probed with a program that
should reach it: either the program found a gap (fixed, and the program
became a test) or the line could not be reached (removed). What it found:

- **Events.** A handler's parameter was `Event` beyond key, input and mouse
  events: `e.pointerId`, `e.submitter`, `e.deltaY`, `e.relatedTarget`,
  `e.dataTransfer`, `e.clipboardData` failed to type, and a destructured
  parameter (`({ currentTarget }) => …`) was `unknown`. It is now the type
  Solid gives that element's attribute, read from a table generated from
  `@solidjs/web`'s own JSX types (`scripts/native-events.mjs` →
  `src/native-events.js`) and written `NativeHandlerEvent<E, tag, kind>`,
  which adds `currentTarget` and `target` as Solid does. A first version
  looked each attribute up through `JSX.IntrinsicElements` and made
  `solid-yield check` 50–80 % slower on apps with many handlers; the table
  costs nothing measurable ("Measured", below). An attribute the table lacks takes the
  lookup (`NativeEventOf`). `native-events.test.js` holds the table to the
  installed Solid's and the type to Solid's handler parameter, for every
  attribute of seven elements.
- **Jumps across a catch.** `break` or `continue` leaving a `try` with a
  `catch` inside a loop was refused (NATIVE_CONTROL_TRANSFER). It is a
  completion record the try's helper returns, the jump made where the try
  stood (`native-jumps.test.js`: the lowered functions compute what the
  originals do). A jump out of `finally` stays refused.
- **Components.** A component whose return was not a single JSX element
  (`return n() > 1 ? <b/> : <i/>`, `cond && <p/>`, an array) was not
  recognised as one and went unchecked: its body's reads were not
  reported. See D-125 below.
- **Callbacks.** A function of the file handed by name to an array method
  (`items().map(scale)`) was refused (SUGAR_ESCAPE) where the inline
  `items().map(x => scale(x))` was lowered. It is eta-expanded into an
  inline callback (`(...args: Parameters<typeof scale>) => scale(...args)`,
  the same calls) and lowered as one (S26). A generic, overloaded,
  reassigned or `this`-taking function stays refused, as any routine handed
  to an unknown consumer.
- **Contexts.** The surface had no context in it; probing the one
  unreached context path found that the common ways of reading one failed on
  correct programs:
  - a context's value read through its members without a guard
    (`const s = useContext(Ctx); s.count()`) or destructured
    (`const { count, bump } = useContext(Ctx)`, `const [count, { bump }]`)
    failed to type (TS2349) where its slot is an accessor: the destructured
    names were aliases the lowering read as sources before calling them. A
    name destructured from a context's value is now that member, read where
    the name is used (`count()` is `_context.count()`), as a value held
    whole is; failure inference resolves a call through such a name, or
    through a member chain off the value (`value[1].bump()`), to what each
    provider put there;
  - an action in a provider's value (`bump: () => setCount(…)`) was a write
    in the provider's view (WRITE_IN_REACTIVE): its consumers call it, not the
    provider's render, so a writing one is hosted by the event that calls it,
    as a writing callback prop is (F-S40); the runtime checks the write where
    it runs, as for every function handed to a child;
  - `useContext(Ctx)` read in a hole (`<p>{useContext(Ctx).count()}</p>`,
    a row's, a memo's) failed (GENERATED_TYPE): the requirement of a context
    without a default is the component's and a view takes none. Such a read
    is the component's: read once in the body and used where it was;
  - a handler (`onClick={() => … useContext(Ctx) …}`) runs with no reactive
    owner (Solid calls it from the DOM listener), where Solid 2's useContext
    throws NoOwnerError, default or not: refused (NATIVE_CONTEXT), with the
    fix;
  - a handler read off a context (`onClick={clearCompleted}` once it is a
    member) is called as it is: an action is an event call its handler waits
    for (a prop's stays `?.`, an optional prop leaving no listener);
  - a context called as a function (`Ctx({ value, children })`, review 3's
    `solid2-call`) was lowered after failure inference had wrapped it, so its
    component went unchecked (GENERATED_TYPE). The prelude now makes it its
    JSX form before anything else reads it: what it provides is that form's.
    The call evaluates its props before the context provides (an eager
    `children: props.children` is created first) where the JSX form defers
    them; the check reads them as the JSX form does, as review 3 asks. A key
    with no JSX form (computed, a method, a getter) is refused
    (NATIVE_CONTEXT). Solid 1's `<Ctx.Provider>` stays the context's
    provider (review 3's `provider-member`).
  - a provider's value holding a getter (`{ get count() { return n(); } }`)
    or a store, against a slot declared as their values (`count: number`,
    `[State, …]`), failed to type (LAZY_VIEW): the getter is a source over
    its body (D-124) and the store is one. Facades (F-S52) retype such a slot
    too, where the context names it (retyping the alias it names made the
    alias circular), and an action's parameters take the slot's declared
    types (they were `unknown`). Destructured, a getter-provided member is
    read once in the body, as Solid's destructuring reads it: READ_IN_SETUP,
    the lost-reactivity bug plain Solid has there; read through the value,
    it is the hole's read.
  - a context declared in one file and provided in another with a getter or
    a store failed to type (LAZY_VIEW): facades read only the declaring
    file's providers, and edited positions of the wrong file. They read every
    file's providers now and retype each slot in the file that declares it.
  The surface gains thirteen context constructs (a provider's accessor and
  action read through each form, a getter read through the value and
  destructured, a store, a default, the call form and its refused key);
  `native-paths.test.js` the probes.
- **Handlers an expression computes** (`onClick={make(2)}`,
  `onClick={n() > 3 ? down : up}`) stay refused (NATIVE_HANDLER: Solid runs
  the expression once, where the element is created); the message now says
  so and what to write instead.
- **Promise chains a body starts.** `fetch(url).then(setData)` in a
  component's body, a chain that cannot fail, was taken as the body waiting
  for it (NATIVE_SETUP_FAILURE), and its continuation as a bare event
  `.then` could not take (TS2769). A chain that cannot fail runs on after its
  host, as in Solid, and nothing waits for it (in any host); its continuation
  is an event's, a plain callback to `.then`. One that may reject still has
  no boundary in the body (NATIVE_SETUP_FAILURE, review 3).
- **A braceless return** (`if (…) return n() > 9 ? <b/> : <i/>;`) was split
  twice (D-125): wrapping it in a block revisited it, and the view itself was
  hoisted as a value (SUGAR_ESCAPE). A return made a view is not revisited.
- **Recursion.** A braceless early return (`if (d <= 0) return <i/>;`) is a
  guard as a braced one is; a snapshot write may use pure `Math` calls.
- **Positions.** A class expression's failure was named `__class`
  (`const NotFound = class extends Error {}`); an impure snapshot write and
  a reserved name were reported as TRANSFORM at line 1. Named by the
  variable, and at the node, now.
- **Lexical arrows.** An arrow component or row using `this` or
  `arguments` was refused (SUGAR_LEXICAL); Babel's conversion keeps their
  meaning, so it is lowered.
- **Removed as unreachable.** A duplicate literal-throw refusal (the
  inspection refuses first), raw-`await` checks in receiver and argument
  lifting (awaits are attempts by then), the NATIVE_ACTION and NATIVE_HOST
  guards, SUGAR_LEXICAL. `native-coverage.mjs` lists no unreachable code.
- **Plumbing.** The Vite plugin's `ImportExpression` form of `lazy`, its
  parse-error `id`s, its warnings under `emit: "lowered"` and its HMR cache
  clearing; the ts-plugin's tsserver entry (`plugin.test.cjs`); the lint
  plugin's autofix paths (a block-bodied child, a row's fix adding `view` to
  the import, named and view-call children, spreads, `$` holes in an `h`
  array, a row declared in a setup); each now tested.
- **Proof S27** (`sugar.md`): a name destructured from a context's value is
  the member Solid's destructuring holds; a getter's read stays at the
  destructuring (`inline_getter_unsound` is why).

**D-125 (Dev, 2026-10-14: "Keep D-041 in native").** JSX stays only a
view's, a hole's or a row's return: a module-level JSX helper
(SUGAR_COMPONENT), JSX held in a component's body and a local JSX arrow
(`jsx-only-in-view`) stay refused, each now a construct of the surface. A
function with JSX anywhere in what it returns (a ternary, a logical
operator, an array, parentheses) is a component; what the return computes
outside its JSX is computed in the body before the view, as in Solid (a
read there is READ_IN_SETUP); `return null` and `return;` render nothing.

**Measured** (2026-10-14, the code of `27761e6` plus the tests above; the
whole test system: each package's suite, the surface corpus, the native gate
steps and the mutation run, under V8 coverage). Each function's own lines:

| Package | Functions | Own-line coverage | CRAP > 30 | Mean CRAP |
| --- | --- | --- | --- | --- |
| vite-plugin-yield (the native checker) | 610 | 98.9 % (97.9 % before) | 13 | 6.2 |
| eslint-plugin-yield | 159 | 99.1 % (96.7 %) | 1 | 5.3 |
| ts-plugin-yield | 139 | 98.7 % (95.4 %) | 3 | 4.0 |
| yield (the library) | 328 | 92.5 % | 0 | 2.4 |
| compiler-yield | 530 | 89.6 % | 15 | 5.9 |
| all | 1766 | | 32 (1.8 %) | 5.2 |

Of the 32 functions over CRAP 30, 17 are fully covered (their CRAP is their
complexity: the lowering's large visitors, `delegate`, the effects pass's
`exit`, native's `exit`, failure inference's `evaluate`), and 12 of the rest
are the compiler package's experiments (analysis, semantic, reachability,
report), not sugar mode. In the native checker, two are not fully covered,
both at 98 % (`handler`, `coloredPropSites`). The surface mutation program:
817 mutants, 728 killed, 89 recorded equivalents, 0 survived (100 %); the full gate at `27761e6`: 101 pass, 0 fail, 0 skip.

**Checking time.** `solid-yield check` on the dashboard, interleaved across
every commit of this work (3 rounds each, medians): `28f969d` 19.0 s,
`71e790d` 18.9 s, `79e25b4` 18.8 s, `7d4e0fd` 19.8 s, `360cd1d` 18.5 s,
`27761e6` 19.2 s, `de4fadd` 19.1 s; the spread between runs of one commit is
about ±1.5 s, so no change is measurable. Paired against `28f969d`:
hackernews 13.4 → 13.5 s, rendering 26.3 → 26.7 s, effect 53.9 → 53.5 s,
docs 17.8 → 15.3 s (noisy). The helpers added here (context calls, named
callbacks, provider scans, facades across files) take under 0.1 s of the
dashboard's 20 s in a CPU profile; TypeScript's checking of the lowered
program dominates, as before. (This machine runs about twice as slow as the
2026-10-13 measurements, old and new alike.)

### The last unreached lines; provider values as TypeScript types them (2026-10-14)

**Re-measured.** The section above reported the native checker at 98.9 %
of its functions' own lines, two of its functions short of fully covered, 32
functions over CRAP 30, and its claim that every path was exercised went
further than that. The lines it left unreached were probed again, one
program each, under the same rule: a program that reaches the line either
finds a gap (fixed, and the program became a test) or the line is removed.
What it found:

- **A provider's value of the wrong type.** Three ways a correct check went
  wrong at `<Ctx value={…}>`:
  - a store or an accessor given for a slot it does not fit (`{ state }`
    where the context declares `state: () => number`; an accessor of a
    number for `() => string`) passed unreported. The facades (F-S52)
    retyped a slot to the value's lowered type whenever the declared type
    did not admit it. A slot is now retyped only when the value as plain
    Solid types it fits (a source's value, or an accessor of it; a
    routine's helper by its result): otherwise TypeScript's error stands;
  - a wrong value (`value={{ n: "x" }}` for `{ n: number }`) was reported
    as a generated `[LAZY_VIEW]` at the component's first line: TypeScript
    tries both forms of `provide` and reports the call. It is now
    TypeScript's TS2322 where plain TypeScript reports it, at the property
    that does not fit, with the types as plain Solid shows them;
  - a context typed through more than eight aliases was not followed, and a
    correct accessor slot failed (`Type '() => number' is not assignable to
    type '() => number'`). The chain is followed to its end; a circular one
    (TypeScript's TS2456) stops where it repeats.
- **An accessor an object literal holds.** `const api = { count }` and then
  `sample(api.count)` handed the helper a number (a generated TS2345), and
  `const get = api.count` read in the component's body: every source-typed
  member was read where it was named. In Solid `api.count` is the accessor,
  read only where it is called, and so it is now; a getter's member
  (D-124) and a store's key are still read where they are named.
- **Failure inference through contexts.** With Solid 1's `<Ctx.Provider>`,
  the closing tag counted as the context escaping, so every value read
  from it failed with `unknown`; a member called through a destructured
  name (`const { nested } = useContext(Ctx); nested.parse(s)`) was not
  followed. Both now name the failure (`Remaining: RangeError`).
- **Diagnostics TypeScript chains.** A TypeScript error with a message chain
  (TS2345 with its elaboration) crashed `solid-yield check`: the root and
  cascade filters read the message as a string.
- **Smaller.** JSX the body builds around a read is JSX_IN_SETUP at the JSX
  (review slot L05), not READ_IN_SETUP; a prop declared `any` or `unknown`
  is PROP_TYPE at its callers; a generator called where it stands is
  searched for the operation as an inline routine is; an arrow component
  handed to a foreign slot (`const Page = (props) => …` given to a router)
  was SUGAR_COMPONENT.
- **Removed as unreachable.** Failure inference's import resolver (it only
  parses through the analyzer; TypeScript resolves imports), a branch for a
  `NativeFailure` alias (it is a class), a declaration search by identifier
  in the origin finder (the lowering binds by calls).
- **The surface check** hashed its inputs by walking directories through
  `node_modules` links, out of a stale scratch directory and around the
  repository until it crashed. It now skips generated and installed
  directories.
- **The lint plugin** has 20 rules (18 errors, 2 warnings in `recommended`);
  `refusals.md` and the library's rule table had left out
  `no-read-in-setup`. Its shared helpers, metadata, docs table and each
  rule's edge shapes are tested (`routines`, `calls`, `rules-edges`).

The tests are in `native-paths.test.js` (25 more programs, and four checks of
the messages and positions they get), the ts-plugin's `cli`, `service` and
`hover` tests, and the lint plugin's three new files.
