# The solid-yield compiler, C0: definitions, analysis, codegen, correctness claim, open decisions

Status: **a design for Dev to rule on**. Nothing here is decided. It records no decision, and the open questions in §5 are framed the way the project takes decisions (code, options, recommendation). Written 2026-10-06 against `main` at `61d2a65` (v0.1, through D-102).

Read with: `calculus.md` (its §4 theorem is the spec the compiler must preserve, and its §7 lists what the compiler route must keep), `DECISIONS.md`, `reviews/2026-10-06-markless-comparison.md` (cited as **ML-L*n*** for its §3 lessons and **ML-Q*n*** for its §6 questions), and `yield-library.md` §7–§8 (what the library route cannot do and what it costs).

Vocabulary is the project's (D-096): a **routine**, its **host**, a **hole**, a **color** κ = ⟨p, ε, w, ρ⟩, a **yield component**, a **foreign component**, the **library route** (the runtime interpreter plus the one-rule transform) and the **compiler route** (D-074). This document adds the words **provenance**, **inert region**, **client root**, **slot**, **edge**, **merge** and **capture**, and defines them in §1.

---

## 0. The plan

The plan (Dev, 2026-10-06), restated so that each part can be tested:

- **Where.** The compiler lives in this repository. It changes nothing in Solid: D-004 (Solid's public API only) holds for the compiler route as it does for the runtime. Its input is the yield dialect as it is today: any program that is admissible by calculus §4.1 (C1–C7). It has no dialect of its own until C4, and Q6 asks whether it ever should.
- **What it does.**
  1. It moves server-derived logic into **server components**: inert regions whose code never ships.
  2. It splits the remaining client logic into **independently hydratable client roots**.
- **Its fallback is the library route.** Anything the compiler cannot analyse compiles to "this region is a client root running the library runtime". That is always correct, because inside a root the program *is* the library route. In the limit (nothing analysable) the whole app is one eager root, which is today's output.
- **Sequencing**, in the style of D-057 (each step starts after the previous one has landed and been ruled on):
  - **C1** is a report and nothing else (§2.5).
  - **C2** emits client roots (§3.1).
  - **C3** emits server components (§3.2).
  - **C4** is the ergonomic layer: `$hoistedEffect` (D-079's note), and possibly Q6.

Three things the compiler is **not**:

- It is not a second semantics. calculus §7 already says the compiler route may change *how* (owner shapes, keys, granularity) and must preserve the §4 theorem.
- It is not a framework. There is no router, bundler or client runtime of its own (risk R10).
- It is not a correctness dependency. A wrong or stale analysis may only make the output less split, never different (§2.4).

---

## 1. Definitions

All definitions are over **static sites** (a syntactic occurrence in a module), summarised per component and instantiated at each call site (§2.3). Each definition is stated so that a C1 fixture can pin it: a source file plus the expected facts. Those fixtures are test oracles like the plugin's `rule.json` (D-043), not files the build reads.

### 1.1 Parts

A **part** is a site the analysis classifies. These are the parts:

| Part | Syntax (the dialect makes each one syntactic) | Host |
| --- | --- | --- |
| hole | `{yield* e}` and an attribute `a={yield* e}` in a view (D-032, D-050); a flow-control source (`when`, `each`, D-038); a hole prop `function* () {…}` (D-065) | view / hole |
| bind | `onX={yield* h}` (D-072) | view |
| cell | `$signal`, `$store`, `$optimistic`, `$optimisticStore`, `$projection` in a setup or row | setup |
| memo | `$memo(body)` | memo |
| effect | `$effect(compute, effect)`, including the run-once form with an empty compute (D-101) | compute / effect phase |
| event | `$event(body)` | event |
| context read | `yield* Ctx` in a setup (D-036, D-098) | setup |
| provide | `Ctx.provide({ value, children })` | call |
| call | `yield* C(props)` of a yield component, flow control or boundary (D-062) | hole |
| foreign | a foreign tag (D-067), `foreign(C)` (D-088), and any value from code the analysis does not read (§2.2) | — |

A cell is **written** when some setter receipt of it, or a `refresh` of it, is delegated to (`yield*`) in an event or an effect phase that the program can reach. These are the only hosts that admit a write (D-021, calculus §1.3). An unwritten cell is its initial value.

### 1.2 Provenance

Every value a routine reads has a **provenance** π ∈ {**S**, **U**, **C**}, ordered S < U < C, with join = max:

- **S, server-derived.** The server can compute it from the request and server functions alone, and it does not change on the client until the region is next rendered by the server.
- **C, client.** It can change in the browser: something written by an event or an effect phase, an event's arguments, or anything computed from those.
- **U, unknown.** The analysis cannot tell. U is placed exactly as C (it is never on the server), but it is reported apart. U is the **leak** metric (R1).

The base cases:

| Source | π |
| --- | --- |
| a literal, a module-level `const` of a serializable value, `constant(v)` | π(v); S for a literal |
| a cell | C if it is written (§1.1); otherwise π of its initial value |
| `$optimistic` / `$optimisticStore` | C (they exist to be written by events, D-014, D-081) |
| `$memo(body)` | the join of the reads before its attempt (the run's key, D-080) and its attempt's target: a **server function** (a `"use server"` module export or a function with the directive) called with arguments of π = S gives S; any other promise or stream gives U |
| an event's parameters, a DOM event | C |
| a value read in an event or an effect phase | not a provenance source: those hosts run on the client by definition. Their *writes* make cells C |
| a foreign value: a foreign component's output, a router's route props, `query(…)`, a module the analysis does not parse | U (§2.2, Q5) |

How provenance flows through each construct:

- **Through `Source`.** A path over a source has the source's π: `yield* story.title` has π(story).
- **Through `$memo` bodies.** A memo's π is the join described above. A memo is atomic: C2 does not split a memo whose branches mix S and C (R3). The whole memo is C.
- **Through props (call form, D-065).** At a call site `C({ x: v })`, the prop `x` has π(v): a source's π, a hole prop's join over its reads, or a settled value's π. Inside C, `yield* props.x` has the π of the call site's argument. A component therefore has a **summary** parameterised by its props' provenance, which each call site instantiates (§2.3).
- **Through context (D-098).** `yield* Ctx` has the join of the π of every `value` given by a `Ctx.provide` that can be above the reader, plus the default if the context has one. Statically, "can be above" is over-approximated as every `provide` of Ctx in the module graph. Across a `foreign(C, { provided: [Ctx] })` edge (D-102) the analysis cannot see the tree, so it uses all of Ctx's providers.
- **Through events.** An event is always client. A bind is always a client part. What the event writes becomes C; what it reads does not matter to provenance. An event that calls a server function is still client code: the call is an RPC.
- **Through effects.** Both halves run in the browser. The compute's reads do not change any provenance. The effect phase's writes make cells C.

A hole's π is the join of its reads. A call's π is the π of the called component's instance.

**Option A clarification, 2026-10-07.** Reads include computed property keys
(`pictures[yield* index]`) and every template interpolation, including attributes.
A template literal with interpolations is an expression, not a literal constant.
Both the receiver and the computed key contribute provenance; a dynamic key
must not change the stored equation of a statically selected field.

### 1.3 Inert region

A view subtree at a site is **inert** (for a given instantiation) when all of these hold:

1. Every hole in it, including attribute holes, flow-control sources and the hole props it passes, has π = S.
2. It contains no bind (so no `Errored` fallback that binds its `reset`, D-072's `Reset`).
3. No setup or row setup reached from it contains an `$effect` (D-101's run-once form included).
4. Every yield component called in it is inert under the call's props, recursively (a fixpoint for recursive components such as hackernews' `Comment`).
5. It contains no foreign tag and no `lazy` call whose specifier is not a string literal. Both are U.

So an inert region renders with props whose provenance is S (the "inert-prop sources" of the brief).

**Inert does not mean static.** An inert region may be pending (a server function's memo, under a `Loading` that is itself inert) and may fail (under an inert `Errored`). What it cannot do is change after the server has sent it. A `Loading` or `Errored` whose children and fallback are all inert is inert.

### 1.4 Client root

Let **G** be the undirected dependency graph over the non-inert parts. An edge joins:

- a hole, memo or effect compute to every cell or memo it reads;
- an event to every cell it writes and every event it calls (`yield* other(x)`);
- a bind to its event;
- a provide whose `value` is not S to every context read it can reach;
- a part to the parts of any value it shares through a U binding (two reads of the same unknown thing are assumed to share it).

A **client root** is a maximal connected component of G, after the merges of §1.5. Its **span** is the smallest view subtree containing all of its holes and binds; that subtree is what one `hydrate` call claims. Inside the span, a hole whose content contains none of the root's parts, and which the root never re-creates, is a **slot** (§1.6). Everything else in the span is rendered and hydrated by the root's code.

The calculus already holds the color facts the root needs. Inside a root, κ is unchanged: the root runs the library runtime. At the root's edge, κ must be what the edge can carry (§1.6, §4).

### 1.5 The merge rule

Two parts are put in one root when splitting them would cut a route of calculus §3.4 or create something twice. The rule is **correctness over granularity**: when in doubt, merge. A larger root is only less split; it is never wrong. Every merge is reported with its reason and the two sites that caused it.

| # | Merge reason | Why it must merge |
| --- | --- | --- |
| M1 | **Shared state.** Two parts read or write one cell or memo, including through props and contexts (the child reads the parent's cell). | A cell is created once, in its creator's setup. A lazy root could hydrate before the creator's setup has run (§1.7), and then it would read a cell that does not exist. |
| M2 | **An event writes state another part reads**, or calls another event. | The same as M1. Also, D-081 makes one call one transaction, and its held writes must land in every reader together. |
| M3 | **A provider spans roots.** A `provide` whose value is not S, with readers under it. | Context resolves at creation from the owner tree (D-098, S1). A reader in another root has no owner path to the provider. |
| M4 | **A boundary receives a part's color.** A part whose fold has p = ⊤, ε ≠ ∅ or ρ ≠ ∅ routes to a `Loading`, `Errored` or provider outside its component. The boundary, and everything client under it, joins the root. A bind with ε ≠ ∅ routes to the `Errored` above the **bind site** (D-085). | calculus §7 items 1–2: a pending read suspends to the nearest `Loading` above the read, and a failure goes to the nearest `Errored`. A boundary left in another root, or on the server, would cut the route. A part with κ = ⟨⊥, ∅, ·, ∅⟩ brings no boundary: the types say exactly when a boundary must come in (D-071). |
| M5 | **Re-creation.** A region inside the span that a flow control of the root can dispose and build again (a `Show` branch, a `For` row, a `Switch` arm) cannot be a slot. It joins the root. | Building it again needs its code. (Keeping the detached DOM instead is D-061's node migration. That is a later option, not C2.) |
| M6 | **Unknown sharing.** Parts that touch the same U binding. | The analysis cannot prove that they are independent. |

**M6 identity, option A.** Sharing code is not sharing a value. A helper that
creates no reactive state, reads no signal and captures no shared mutable or U
value does not connect its callers merely because its result is U. In particular,
separate fresh promises returned by `delay(ms)` have separate allocation identity;
their completion remains U, but the helper's source location is not a dependency.
Two readers of the *same* promise still join. Captured inputs and shared state
remain ordinary edges. Unknown calls whose independence has not been established
retain the conservative M6 merge.

The current proof is deliberately narrow: a `new Promise` executor may call its
own settlement parameters, known pure built-ins and timer functions. It may not
delegate, assign, update, allocate another instance or call an opaque function.
Its captured inputs are analysed and retained. A diagnostic counts the source
location once; dependency grouping distinguishes its separate proven allocations.
This is independence of reactive state, not a claim that scheduling is pure.

**Foreign ownership, option A.** Foreign ancestry alone adds no dependency edge.
Independent children of one foreign component remain separate groups. Actual
shared props, state, context, colors and unknown values still join them. Record
the foreign ancestor separately: it can dispose or recreate a child, so an
independent group is not by itself a stable server slot or an independently
claimable DOM range. Codegen must preserve that lifetime or fall back; it must
not infer a shared-state dependency from ownership alone.

**Overlapping spans.** Equal smallest DOM spans join as `SPAN_OVERLAP`, even if
there is no M1–M6 edge. The docs reading guide's `err().kind` and `err().message`
are both in the same `<p>`: two hydration calls cannot each claim that paragraph.
This merge is correct. It does not prove the error accessor can cross an edge,
or that the paragraph exists while the successful branch is showing.

### 1.6 The capture rule at a root edge

An **edge** is where a root's client code reads something defined outside the root. At C3 there is a second kind of edge, where a server component hands something to a slot. This is ML-L3 (markless's capture rule) stated for this model. Only these may cross:

| What crosses | How |
| --- | --- |
| a **serializable constant** | serialized by `@solidjs/web`'s serializer (its public `serialization` entry), not by a list of the project's own |
| an **S value** read by the root (an S memo, an S prop, an S context value) | its value is serialized at the edge, and on the client it is a `constant(v)`. If it is still pending at flush it is streamed as Solid streams an async memo, and the root's `Loading` waits for it (M4 put that `Loading` in the root). If it failed on the server, the failure is serialized and re-thrown at the client read, **as its own class and branded** (D-087), so that `catch: [K]`'s `instanceof` and `attempt`'s brand check still hold (R12) |
| a **prop** from a parent outside the root | an S value as above, or a hole prop whose reads are S (a constant). A hole prop whose body calls components crosses as a slot |
| an **element handle (a slot)** | server-rendered DOM that the root places and does not render (§1.4) |
| a **module import** | code, not a capture. Module-level mutable state is U |

Event handlers do not cross: a handler is created in a setup, so its creator is in the root (M2). **Anything else** — a closure over a setup-local non-source, an instance the serializer refuses, a function, a U value — cannot cross. The region that defines it is then client, and the analysis gives **a diagnostic at the variable** that names it and the reason (ML-L3, and ML-L8's "escalation is never silent"). In the C1 report that diagnostic is a *capture failure*.

### 1.7 Eager and lazy roots

**Tier 1 ruling, 2026-10-07: all emitted roots hydrate synchronously at load.**
The table below is a diagnostic classification only. No visible observer, event
replay or delayed hydration is emitted. The delayed claim failure F-C5 remains
recorded; it is not a blocker for this eager-only tier.

| A root is | When | It hydrates |
| --- | --- | --- |
| **eager** | some setup or row setup in it yields `Create<"effect">`, the run-once form included (D-079, D-101) | at load (ML-L4, ML-Q2-B) |
| **visible** | it has no effect, but it has a C or U source that changes without a bind: a memo whose attempt targets a non-server promise or stream, a foreign source | when its span becomes visible |
| **lazy** | every change in it starts at one of its binds | on the first event at one of its binds; the event is captured before hydration and replayed after it |

Laziness is sound in this dialect for a reason that is specific to it. A setup only creates (D-042: it never reads, writes or builds JSX). Effects are the only code that runs because a component exists (D-079), and they make the root eager. So deferring a lazy root's setups until its first event cannot be seen in the DOM. It *can* be seen in a conformance trace (the setup runs later), which §4 declares.

The fact "this component is eager" is already in each setup's yield union (`Create<"effect">`, calculus §1.2). Q2 asks whether to surface it as a marker on `ComponentView`, as may-wait is (D-075).

---

## 2. The analysis (C1)

### 2.1 Placement

The analysis is a Vite plugin pass in this repository, beside `vite-plugin-solid-yield`. Its packaging (a second export of the plugin, or a fourth package) is not a C0 question.

- It runs `enforce: "pre"`, **before** the one-rule transform, on the source as written. It needs `yield*` in JSX, which the rule turns into `perform(…)`.
- It parses with Babel and the plugin's `parserPlugins(filename)` (`transform.js`), the same dialects `@solidjs/vite-plugin` parses. oxc is an option if parse time matters (R9).
- It recognises routines by import binding from the yield module, as the lint already does (`eslint-plugin-yield` `routines.js` / `calls.js`), and reuses that classifier rather than writing a second one.
- **Per-file facts** come from the `transform` hook (C1 returns no code). **Cross-module provenance** is a fixpoint in `buildEnd`, over the summaries of every module in the graph. Imports are resolved with Vite's own resolver (`this.resolve`).

### 2.2 Per-file facts

For each module:

- **exports**: which bindings are components, contexts (with or without a default), events or server functions (a module-level `"use server"`, or a function directive);
- **for each `component(…)`**: its declared props; its setup's parts (cells and whether they are written, memos with their pre-attempt reads and attempt target, effects, events with their writes and calls, context reads); its view's holes, binds, calls (with their props literal), flow controls, boundaries and provides;
- **colors by syntax**: whether a part may pend (an async attempt or `until`, a pending read through a memo) or fail (a `raise`, an attempt whose handler returns an `Error`). This is a sound over-approximation of κ that M4 needs. The type checker would make it exact, and the C1 CLI report may use it (§2.5). The Vite pass does not.

What the dialect guarantees is what makes this syntactic:

| Guarantee | Decision |
| --- | --- |
| every read is a `yield*` | D-006 |
| a setup never reads | D-042 |
| a view has no body | D-032 |
| components are called | D-062 |
| a prop is a source, a hole or a settled value | D-065 |
| `children` is a generator | D-066 |
| a write is a delegated receipt | D-021 |
| an effect is split | D-079 |

markless has to discover its extraction kinds (ML §5, "informs" 2). Here the host table names them.

**Unknown is the fallback for everything the pass does not recognise.** That includes:

- a call of a non-routine function in a hole;
- a foreign tag, and a `foreign(…)` hand-off seen from inside;
- a value from a module the pass does not parse (`node_modules`, a file without `yield`);
- a dynamic `import()` with a non-literal specifier;
- a spread prop;
- a router's route props and `query(…)` wrapper (hackernews-spa's `getStory = query(hn.getStory, "story")`).

U is never S (§1.2).

### 2.3 Cross-module provenance

- **Summaries.** A component's summary maps its props' provenance vector to its facts: is it inert, which parts are client, and which props reach which parts. A call site instantiates the summary with its arguments' π.
- **Fixpoint.** A worklist runs over the module graph. The lattice has height 3, so it terminates. Recursion (hackernews' `Comment` calling itself in a row) is the fixpoint's ordinary case.
- **Bounded context sensitivity.** Each distinct provenance vector of a component is analysed once. Above a cap (proposed: 8 vectors per component), the vectors are joined, which is the most-client answer, and the report says so.
- **Contexts** join over all providers (§1.2), so a context read never needs the tree shape across modules.

### 2.4 No artifacts, no correctness dependence

**D-023's lesson.** The type linker's generated `solid-props.gen.d.ts` files were "the main source of twin drift". The analysis therefore writes **nothing into the repository** and **nothing the build reads back**. Summaries live in memory for one build (at most in Vite's cache, keyed by content). The C1 report is written to a git-ignored path or to stdout.

**Correctness does not depend on the analysis.** The analysis only decides *placement*. Every placement is correct by construction, provided the codegen is (§3, checked by §4):

- a region placed as client runs the library route;
- only S regions go to the server;
- U is placed as C.

A stale or wrong fact can therefore only lose splitting, or wrongly mark something S. The latter is the one dangerous direction, and the gate catches it, because a C value frozen on the server shows up as a DOM difference in the parity script (§4).

In development (C2+), a changed module invalidates its summary and its importers' summaries through Vite's module graph. Any doubt resolves to client.

### 2.5 The C1 deliverable: a report, and nothing else

For each twin, for the analysis's verdict on the twin's own entries:

| Field | Meaning |
| --- | --- |
| inert fraction | inert holes / all holes, and inert JSX element sites / all element sites, statically. The dynamic fraction (server DOM nodes inside inert regions) needs C2's markers, so it comes with C2 |
| roots | the number of roots, and for each one: its span (file:line), its parts, eager / visible / lazy and why, its slots |
| merge reasons | each merge, M1–M6, with the two sites that caused it |
| capture failures | each variable, file:line, and what it is (§1.6) |
| leaks | each U source and where it came from (an import, a foreign tag, `query`, route props), with the number of parts it made client |
| eager roots | each one, with the `$effect` that made it eager |

The report is JSON plus a Markdown table. Proposed gate step: **`compiler:report`**, which must finish for all 8 twins without a crash. Its numbers are printed and not compared, so the step guards against rot and nothing more (D-017 is untouched: these are not performance numbers).

**Predictions C1 will test** (hypotheses, not measurements):

- **hackernews-spa.** `Story` reads `props.params.id` from the router (U), so under a client-side router the route is one root. If navigation went through the server, the comment tree would be inert apart from one lazy root per `Toggle` (a cell, an event and three holes), with the nested comments as `Toggle`'s slot. `Toggle` hides with `display`, not `Show`, so M5 does not apply. That one case is where the plan pays most: `api.ts`'s own comment says the document "carries each story and comment twice".
- **sierpinski**: one eager root (timers).
- **todos / todos-h**: almost all client.
- **room**: its live sources are U, and its identity effect writes an app-wide context (Q2), so it is probably one eager root.
- **rendering**: mixed.

If C1 shows every twin as one root, the root half of the plan is moot and the compiler's value is server components alone. That outcome would be a finding, and Dev should hear it before C2.

---

## 3. Codegen (C2, C3): what is emitted and what is preserved

This section says what the output contains, not how it is built.

### 3.1 C2: client roots

**Server build.** The app renders as on the library route, with three additions:

- **Markers.** Each root's span is opened and closed by a marker carrying the root's id.
- **Inputs.** Each root gets an **input record**: the values that cross its edge (§1.6), serialized by Solid's serializer. Pending values are streamed and failures keep their class.
- **Keys.** **Hydration keys are reset per root.** This attacks D-082's cost: keys grow with nesting depth, and a root restarts the depth. The candidate mechanism is public. `solid-js` exports `NoHydration` and `Hydration({ id })`, and `@solidjs/web`'s `hydrate(fn, el, { renderId })` documents "hydrate one of multiple roots emitted by a server render that used the same id". The inert parts would render under `NoHydration`, and each root under `Hydration({ id })`. **C2's first spike** is to check that a `Hydration` nested in one server render gives a namespace that `hydrate(…, { renderId })` claims, on rc.13. If it does not, that is a finding (D-004), and C2 waits for Dev.

**Client build.** Each root becomes one chunk, whose entry hydrates the root's component with its inputs, using **the library runtime**, unchanged. So inside a root the semantics are the library route's by construction (R4). Inputs are rebuilt as follows:

- an S value as `constant(v)`;
- a streamed one as a source that pends until it lands;
- a failure re-branded as its class.

**A loader.** A small client entry, the only new client code, schedules the roots:

- eager roots at once, in document order;
- visible roots by `IntersectionObserver`;
- lazy roots on the first delegated event at their span, replayed after hydration. Solid's public `HydrationScript({ eventNames })` / `generateHydrationScript` already captures events that happen before hydration. That is to be verified per root, not assumed.

**What is preserved:**

| Preserved | |
| --- | --- |
| markup | identical to the library route's (DOM parity) |
| each root's behaviour | its trace equals the library route's for the same interactions, except for the declared differences in §4 |
| the theorem | §4 |
| not preserved | hydration keys: the compiler route is its own route (D-074), and the library client misses its markup, as `hydrate-self-test.spec.ts` pins for the fork's compiler route today |

**Degenerate output.** An app that is one eager root compiles to **exactly the library route's output**: no markers, no loader. This is the fallback in the limit, and it is a gate check (§4).

**Source maps.** The analysis edits nothing. Codegen edits spans with MagicString, as `transform.js` does. A root's chunk is a new module made of spans of the original file, and its map points back into that file. Vite chains every map with `solid()`'s. The bar is Phase 2's: **exact maps**, each pinned by a test that maps a frame in an emitted module back to its original line, as the plugin's source-map test does now (R8).

### 3.2 C3: server components

A maximal inert region that is not inside a root's span (a slot is outside, by §1.4) becomes a **server component** on Solid's **public** server-component API. In rc.13 that is `@solidjs/web/frames` (`createServerComponentHandler`, `Slot`, `AttributeSlot`, …) and `@solidjs/vite-plugin`'s `serverFunctions: { components: true }`, documented in `@solidjs/web`'s `skills/server-components/SKILL.md`.

- **Emitted.** A `"use server"` function returning the region's template. Its S memos run inside it, and their values never ship: only the markup does. For hackernews' story page, that is the end of "each story and comment twice".
- **Client parts inside it become slots, as Solid defines them:**
  - a root placed in server markup is a **markup slot** (`Slot`);
  - a client hole at an attribute, `class`, `style`, event or `ref` position of a *server* element is an **attribute slot** (`AttributeSlot`), whose fill the compiler generates from the root's code;
  - a client **text** hole is a markup slot, because Solid's guide says "text is not a bindable position yet".

  The guide's rule, "an element lives where the data that creates it lives", matches §1.3: an element whose existence is S is server markup.
- **Inert boundaries render their fallbacks on the server.** An `Errored` with a bound `reset` is client (§1.3 item 2).
- **Public API only.** A capability the compiler needs and Solid's public API lacks is a **finding** recorded for Dev, never reached for (D-004). The candidates already visible:
  - a text slot;
  - a nested hydration namespace (C2's spike);
  - a slot whose DOM survives a client re-creation (M5).
- **The route.** The compiler route is one route: server and client are both built by it (D-074). A page is never served by one route and hydrated by the other.
- **D-058 was the note, and this is its execution.** The user never writes a server component: server components are a compiler concern, not a model concern. The twins that were removed for being server-component demos stay removed. The 8 twins are the test bed, and their originals are their DOM oracle.

### 3.3 C4: the ergonomic layer

C4 comes only after C3 and only as sugar that desugars to the dialect before the analysis runs (Q6). `$hoistedEffect` is D-079's reserved name for a merged effect form that the compiler splits statically.

---

## 4. The correctness claim

**Claim.** For every admissible program P (calculus §4.1), **the library route of P ≡ the compiler route of P**.

**Observed equivalence.** After every step of every parity script and every interaction:

- the same DOM;
- the same conformance traces, except for the declared differences below.

**Declared differences** (each one pinned in `declared.ts`, as D-069's were, so that a change in either direction turns the gate red):

1. **Hydration keys** (D-074).
2. **A lazy root's setups run at its first event, not at load.** This is unobservable in the DOM by D-042 and D-101 (§1.7). It is observable only in a trace that logs setup runs.
3. **On the server, an inert region's server-component render order**, which D-084 already rules unobservable.

**The theorem holds for compiled output.** calculus §4 (a)–(d) holds at the positions of §4.2 for P compiled. The obligation the compiler adds is a lemma, **edge preservation**:

> No route of calculus §3.4 crosses a root edge or a server/client edge, except through a value whose color the edge carries.

Concretely:

| Route | Preserved by |
| --- | --- |
| a pending read and its `Loading` | being in one root, or the read is an S value resolved on the server (M4) |
| a typed failure and its `Errored` (above the read, D-033; above the bind, D-085; above the calling hole for an effect, D-073) | being in one root, or the failure is serialized and re-thrown at the read as its class (§1.6) |
| a context read and its provider (D-098) | being in one root, or the value is S and serialized (M3) |
| rows (D-059, D-063) | their list's root (M5) |

calculus §7's four items are the cases of this lemma. Its §5 obligations become the compiler's conformance suite (calculus §7 already says so).

**How the gate grows** (D-057-style sequencing; each step is added in the commit that makes it pass, and the baseline is re-recorded):

| Stage | Gate steps added |
| --- | --- |
| C1 | `compiler:report` (it runs, numbers printed); the analysis's fixture tests (a new package step; not `pkg:compiler:test`, the name D-043 removed with Solid's compiler) |
| C2 | Every twin's parity test runs **both ways**. The conformance scenarios gain a compiler-route mode. (`*/yield-compiled` is taken by the fork's frozen artifacts, so a new name is needed.) `obligations.spec` and `raise.spec` run through the compiler route. `twins:ssr-smoke` and `twins:hydrate-smoke` run both ways, and the hydrate smoke gains ML-L2's check (each root's server claims equal its client registrations; a root that hydrates silently onto the wrong node fails). The degenerate check: a one-root app's output equals the library route's, byte for byte. |
| C3 | Server-component output in the SSR and hydrate smokes. A check that an inert region's code is absent from the client chunks (its module ids are in no client chunk). |
| C4 | Desugaring fixtures: each sugared program and its dialect form, same report, same output. |

Measuring what v0.2 saves is Q3.

---

## 5. Open decisions for Dev

### Q1. What does v0.2 split the app into? (ML-Q1)

```tsx
// hackernews-spa-yield/src/components/toggle.tsx (abridged)
const Toggle = component(function* Toggle(props: Props<{ children: Element }>) {
  const [open, setOpen] = yield* $signal(true);
  const toggle = $event(function* () { yield* setOpen(o => !o); });
  return view(function* () {
    return (<>
      <div class={["toggle", { open: yield* open }]}>
        <a onClick={yield* toggle}>{(yield* open) ? "[-]" : "[+] comments collapsed"}</a>
      </div>
      <ul class="comment-children" style={{ display: (yield* open) ? "block" : "none" }}>
        {yield* props.children}
      </ul>
    </>);
  });
});
```

- **A. Hydratable roots on Solid's hydration.** `Toggle` is a lazy root, and its `children` are a slot. This keeps D-004. Each root still runs its setup when it hydrates.
- **B. Resumable handlers and DOM updates, as markless does.** A click loads `toggle`'s body and the three updates of `open`, and runs no setup. This needs a solid-yield client runtime, so the compiler route leaves D-004.
- **C. A now, under rules that B would need.** The capture rule (§1.6, ML-L3), effects making a root eager (§1.7, ML-L4), and per-root claims checked in the gate (§4, ML-L2) apply from C2 on.

**Recommendation: C.** It ships on Solid and keeps D-004. The rules that are expensive to add later get fixed while there are 8 twins to migrate.

### Q2. What does an `$effect` do to a root? (ML-Q2)

```tsx
// room-yield/src/lib/identity.tsx: mints the tab's identity on the client (D-101)
const [me, setMe] = yield* $signal<Identity | null>(null);
yield* $effect(
  function* () {},
  function* () { if (!isServer) yield* setMe(mint()); }
);
return view(function* () {
  return <>{yield* IdentityContext.provide({ value: me, children: … })}</>;
});
```

Under §1, `me` is a written cell (C) provided above the whole app. M3 puts every reader in this root, and the effect makes it eager. So room is one eager root unless its readers are few and local. C1 will say which.

- **A.** Nothing special: every root hydrates at load.
- **B.** A root with `Create<"effect">` in any of its setups is **eager**, and the others are lazy or visible (§1.7). The fact is surfaced in two places:
  - **as a marker in the types**: a phantom `[EAGER]` on `ComponentView`, folded like may-wait (D-075). It is not a color, has no boundary and is never discharged, so a component's eagerness is visible at its call;
  - **as a diagnostic** in the report and in the build, at the effect, naming the root it made eager (ML-L8).
- **C.** Remove `$effect` in favour of triggered behaviours, as markless does (no effects, `onVisible` / `attach`).

**Recommendation: B.** It keeps D-079 and D-101 (4 run-once sites migrated). The fact is already in the types. And it makes an effect's cost visible exactly where v0.2 pays for it. Revisit C only if C1's eager-root counts are high.

### Q3. Should the gate measure what v0.2 is meant to save? (ML-Q3)

```sh
# proposed step: executed bytes (V8 coverage), twin vs original, at load and per parity step
node examples/harness/executed-bytes/measure.mjs --baseline documentation/executed-bytes.json
```

- **A.** Keep D-017: no performance in the gate.
- **B.** Amend D-017 for **executed bytes** only (ML-L1). These are V8 coverage's bytes of JS run at load and per parity step, for each twin against its original. They are deterministic across machines, and that removes D-017's stated reason ("noisy across machines"). Wall time stays manual.
- **C.** B, plus per-root payload and registration checks and a real-browser lane (amending D-037).

**Recommendation: B now, C with roots (C2).** v0.2's whole claim is "less code runs", and §8 shows that a manual measurement can silently measure nothing ("timed a list that never grew"). The per-root checks only mean something once roots exist.

### Q4. Provenance annotations at leaks

```ts
// a claim, D-102-style: the author states what the analysis cannot see
export const getStory = server(query(hn.getStory, "story")); // "this is server-derived"
```

- **A. None.** U stays U, and the report names the leak.
- **B. A claim the runtime checks.** `server(fn)` marks a value S. In development, the compiler route checks it where it can be wrong: the value is read on the client only through its serialized edge, and a client call is an error. This is like `foreign(…, { provided })`.
- **C. A trusted claim**, with no check (an escape hatch, against D-006).

**Recommendation: A until C1's report shows the need.** If the report shows that a few named sources (the router's `query`, route props) make most parts U, then B for exactly those, as D-029 waited for its count before `Inherit<T>`.

### Q5. A foreign-primitive bridge

```ts
// today: refused (no-foreign-reactive, D-006); a router param cannot enter routine code except as a prop
const id = foreignSource(() => useParams().id); // proposed: Source<string, unknown, boolean>
const story = yield* $memo(function* () {
  const v = yield* id;
  return yield* attempt(() => getStory(v), cause => new ApiError(cause));
});
```

The compiler will meet foreign primitives constantly: the router's params and `query`, and room's live sources.

- **A. No bridge.** `no-foreign-reactive` stands, and integrations are rewritten as routine code (the status quo, as for the todos data layer and the Effect saga driver).
- **B. `foreignSource(accessor)` typed `Source<T, unknown, boolean>`**, always U to the analysis, counted in the report. Its `unknown` failure is not a `Failure` (D-034). So a read of it is admitted only inside an `attempt` that gives the failure a kind, and its pending is "may" (`boolean`, read as ⊤ by the folds). That is honest per D-071: the runtime may pend or throw, and the type says so.
- **C. B with declared colors** (`foreignSource<T, E, P>(accessor, { fails: [E] })`), checked at run time by branding.

**Recommendation: B, as an edge and not an escape hatch.** It is the reactive counterpart of `foreign(C)` (D-088). It gives the analysis one named site per leak instead of a whole region of U. It amends `no-foreign-reactive`, so it is Dev's call against D-006. Take C only if C1 shows foreign failures that need kinds.

### Q6. Does the compiler route elide `yield*`, and are components plain functions there?

```tsx
// C4 spelling (sugar) …                          … desugars to the dialect before the analysis
const Card = (props: { todo: Todo }) =>            // const Card = component(function* (props: Props<{ todo: Todo }>) {
  <li class={{ done: props.todo.done }}>           //   return view(function* () {
    {props.todo.title}                             //     return <li class={{ done: yield* props.todo.done }}>{yield* props.todo.title}</li>;
  </li>;                                           //   }); });
```

D-098's rejected alternative was components as plain functions, with lazy context handles resolved at the read. It made a requirement *positional*: a provider in the component's own view would wrongly discharge a read resolved above it (the memo case). Dev rejected the three runtime fixes. **A compiler can do it safely**: it knows each read's position statically, so it can place a setup-level read (a memo, a context read) above the view's providers by construction. That is exactly what the runtime could not tell. The same goes for eliding `yield*`: the compiler knows which expressions are reads.

- **A. No.** The compiler route accepts exactly the dialect (D-005: one way per thing).
- **B. A C4 sugar** that desugars to the dialect before the analysis. The dialect stays the spec, every sugared program has a dialect form the compiler can print, and the theorem transfers. D-002's README line, "the compiler route is the ergonomic one", becomes true.
- **C. The compiler route gets its own semantics.**

**Recommendation: B, after C3, and only as desugaring.** C would put a second semantics behind D-074's "not mixed" wall for good.

---

## 6. Risks

| # | Risk | Where it comes from | Guard |
| --- | --- | --- | --- |
| R1 | **Provenance leaks through unknown or foreign code make every app one root.** The router, `query` and any `node_modules` value are U. | ML §5; §2.2 | C1 measures it before any codegen exists. Q4 and Q5 are the levers. The fallback is correct, only useless. |
| R2 | **Cross-module analysis brings back linker-style staleness.** | D-023 | No artifacts; in-memory summaries; any doubt resolves to client; correctness never depends on the analysis (§2.4); both-ways parity catches a wrong S. |
| R3 | **Memo branches mix server and client.** `$memo(function* () { return (yield* tab) === "a" ? yield* serverThing : 0; })` is C as a whole, and its server branch becomes an RPC from the client. | §1.2 | A memo is atomic in C2. The report counts mixed memos. Splitting a memo by branch is a later optimisation that needs its own ruling. |
| R4 | **D-069-class semantic drift between routes.** A second route copies behaviour imperfectly: F1–F8 were exactly this. | D-069 | Inside a root the runtime *is* the library's, so drift is confined to edges and the loader. The conformance scenarios and obligations run both ways. |
| R5 | **Shared state across roots.** Merges cascade into one root. | §1.5 M1/M2 | Measured in C1 as merge reasons. Multi-span roots (one reactive graph, several mount points) are a later option, not C2. |
| R6 | **Context across roots.** A `provide` above a foreign edge (D-102) is opaque, so the analysis assumes it reaches every reader. | §1.2, M3 | It is correct (over-merging). C1 counts how often it decides the root shape. |
| R7 | **The server-component protocol is at RC stage.** `@solidjs/web/frames` is rc.13. Slots, fills and the frame protocol may move. | D-016, D-004 | C3 is the most exposed step. The twins both ways are its canary (D-045). Nothing reads the protocol, only the API (D-099's amendment refused to read the stream format for the same reason). |
| R8 | **Source maps.** Root chunks and server components are new modules made from spans. | Phase 2's bar | Exact maps, one map test per pass (§3.1). |
| R9 | **Gate time.** The twins both ways roughly doubles the parity tests and the smokes (the gate takes about 36 s today). | D-008 | `--fast` keeps the library route only. The analysis parses once per module. |
| R10 | **Scope creep toward a framework.** A router, a bundler, a runtime of its own, resumability. | ML §5 "contradicts" 4 | C1 is a report only. Q1-C keeps Solid's client. The compiler adds a loader and nothing else. B (resumability) is a separate ruling, not drift. |
| R11 | **Partial hydration may not fit Solid's public hydration** (nested namespaces, event replay per root). | §3.1 | C2's first spike checks it. A gap is a finding (D-004), not a workaround. |
| R12 | **Failures crossing an edge must keep their class and brand,** or `catch: [K]` and `attempt` mis-handle them (calculus T4, D-087). | §1.6 | Failure classes are registered with the serializer by module id. A failure class that cannot be registered makes its region client (a capture failure). |
| R13 | **Deferred setups.** Code that relies on setup timing would break under lazy roots. | §1.7 | Ruled unobservable by D-042 and D-101 (setups only create; effects make a root eager). A trace difference is declared in §4. A development-only check can flag a setup that logs. |
