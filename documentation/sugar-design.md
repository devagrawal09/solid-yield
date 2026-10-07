# Sugar mode: a spelling of the library route

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

### Recommendation and question for Dev

Recommend **route 1 first**, with compiler provenance used for local messages and
color hovers. It keeps TypeScript's existing color folds as the authority and adds
one main semantic obligation: faithful lowering. Keep route 2 as a serious later
option if editor performance or source-facing generic types prove unacceptable.
Do not ship sugar with only runtime tests and a value-only `.d.ts` facade.

**Exact question:** “Should sugar v1 require a virtual-code TypeScript integration
(editor plugin plus matching CLI check), keeping the existing library types as
the authority for pending/fails/may-wait/requires, or should we fund a compiler-owned
color checker and its new soundness proof before shipping sugar? I recommend the
virtual-code route. Do you accept that tooling requirement?”

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
