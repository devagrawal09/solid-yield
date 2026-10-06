# λ-yield: the core calculus of solid-yield

Status: a description of the implementation at `b153f04` (v0.1, through D-099), not a proposal. It states the soundness theorem the library claims (D-071) and lists the obligations a proof must discharge, each with the code that implements it and the tests that currently evidence it. Nothing here is proved. Read it with `yield-library.md` (the reference) and `DECISIONS.md` (the rulings). Implementation sites are `file:line` under `packages/yield/` at `b153f04`; test names are quoted as the test files write them.

Vocabulary is the library's (D-096). A **routine** is a `function*` body the runtime drives. Its **host** is the kind of routine it is. A **hole** is a reactive position of a view. A **color** is what reading a value may do besides returning it. A **yield component** is a `component(…)`; a **foreign component** is plain Solid.

Places where the model depends on Solid's behaviour rather than on code in this repository are marked **[S*n*]** and collected in §3.6. TypeScript's checker with the library's declarations _is_ the static semantics. When this document and the code disagree, the code is what is described and the disagreement is listed in §6.3.

---

## 1. Syntax

### 1.1 Colors

A color is a quadruple κ = ⟨p, ε, w, ρ⟩.

| Component | Meaning                                                                 | Domain                                                                        | Phantom key (`types.ts`) |
| --------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------ |
| p         | the value may be **pending** (a read may suspend)                       | 𝔹 = {⊥, ⊤}; TypeScript's `boolean` means "may be", and the folds read it as ⊤ | `[PENDING]` (24)         |
| ε         | the **failures** a read may raise                                       | finite sets of failure classes 𝒦 (§1.4)                                       | `[FAILS]` (38)           |
| w         | the **may-wait** marker: the view binds a handler that may wait (D-075) | 𝔹; not a color in the strict sense, see §4 (X1)                               | `[MAY_WAIT]` (31)        |
| ρ         | the **requirements**: contexts read without a provider yet (D-098)      | finite sets of required contexts 𝒞 (§1.4)                                     | `[REQUIRES]` (36)        |

The order ⊑ is pointwise: ⊥ ⊑ ⊤ on p and w, ⊆ on ε and ρ. The join ⊔ is pointwise ∨ / ∪. The bottom ⟨⊥, ∅, ⊥, ∅⟩ is **settled**. "Settled ⊂ pending, never ⊂ E" (D-023) is the statement that every type constructor below is monotone in κ.

### 1.2 Operations

Each operation is a phantom interface whose fields are color components. TypeScript collects a routine's operations into its generator's yield union Y. The left column is this document's notation; the brief's names are kept where they differ.

| Op                                  | Implementation (`types.ts`)   | Fields     | Produced by                                                                                                                           |
| ----------------------------------- | ----------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| rd(p, ε)                            | `Read<P, E>` (69)             | p, ε       | `yield* s` for a source, path or prop                                                                                                 |
| wait                                | `Wait` (75)                   | (pending)  | an async `attempt` / `until`                                                                                                          |
| raise(ε)                            | `Raise<E>` (79)               | ε          | `yield* raise(e)`; an attempt whose handler returns an `Error`                                                                        |
| wr                                  | `Write` (84)                  | —          | `yield* setX(v)`, `yield* refresh(s)`                                                                                                 |
| call(p, a, ε)                       | `EventCallOp<P, A, E>` (92)   | p, a, ε    | `yield* h(x̄)`, a call of an `$event` handler                                                                                          |
| bind(w, ε)                          | `Bind<W, E>` (110)            | w, ε       | `yield* h`, the un-called handler (D-072). The brief writes `Bind<W,E,R>`: the implementation has no ρ, since `ContextRead ∉ EventOp` |
| new_k(ε)                            | `Create<K, E>` (134)          | ε          | `$signal`, `$store`, `$memo`, `$effect`, `$settled`, … (ε ≠ ∅ only for `effect` / `settled`, D-073)                                   |
| cleanup                             | `Cleanup` (140)               | —          | `yield* $cleanup(f)`                                                                                                                  |
| ctx(ρ)                              | `ContextRead<C>` (148)        | ρ          | `yield* Ctx` (ρ = {Ctx} without a default, ∅ with one)                                                                                |
| child(κ) — "ComponentCall⟨P,E,W,R⟩" | `ChildView<P, E, W, R>` (158) | p, ε, w, ρ | `yield* v` for a view `v`, so `yield* C(a)` (a view's iterator yields it: `View`, 561)                                                |
| stream                              | `StreamAttempt` (123)         | —          | an `attempt` whose `fn` returns a stream (D-091)                                                                                      |

`AnyOp` (171) is the union. "HoleCall" is not an operation: it is the call type of a non-generic component (§2.6).

### 1.3 Routines and hosts

```
r  ::= function* (x̄) { s̄ }                      a routine (never async function*: refused by overloads)
s  ::= const x = yield* o | yield* o | return e | (JavaScript statements)
       — no try/catch (D-077, lint no-try-catch), no throw (D-019, lint no-throw)
o  ::= any value of type Yieldable<Y, T>        the operand of yield*: an op of Y, evaluating to T
```

A host H fixes the set Ops(H) of operations its routines may yield. The judgement

**H ⊢ r : Y ▷ T** iff r's yield union is Y, its return type T, and Y ⊆ Ops(H)

is how the constructors are typed: each constrains its type parameter `Y extends XOp`. This is the §3 table of `yield-library.md` as a judgement:

| Host H                        | Constructor / position                                                            | Ops(H)                                               | `types.ts`                       | Runtime host (`runtime.ts`)                                         |
| ----------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| setup                         | `component(function* (props) {…})`; a row's body                                  | new, cleanup, ctx                                    | `SetupOp` 185                    | `SETUP` (`runSetup` 1710)                                           |
| view (JSX)                    | `view(function* () { return <…/> })`                                              | rd, child, bind — the yields of its holes (D-051)    | `ViewOp` 195                     | `VIEW` (`renderView` 1724)                                          |
| view (`h`)                    | a view returning `h` output                                                       | ∅                                                    | `HViewOp` 200                    | `VIEW`                                                              |
| JSX hole                      | `{yield* e}` → `perform(e)` (the transform's one rule)                            | the view's: rd, child, bind                          | `ViewOp`                         | the hole's own render effect (`perform` 471)                        |
| `h` hole, flow-control source | a bare zero-arity `function*` given to `h` or to `when` / `each` / `count`        | rd, raise, stream                                    | `HoleOp` 246                     | `HOLE` (`runHole` 1650, `holeOf` 1662)                              |
| hole prop                     | a zero-arity `function*` given as a prop (D-065), or `children` (D-066)           | rd, child, raise                                     | `HoleProp` 462                   | read where the child reads it (`readPath` 584 → `throughHole` 1682) |
| memo                          | `$memo`, `$projection`, `$optimisticStore`'s body                                 | rd, wait, raise, stream                              | `MemoOp` 202                     | `MEMO` (`memoCompute` 1248)                                         |
| effect compute                | `$effect(compute, ·)`                                                             | rd, raise, stream                                    | `ComputeOp` 219                  | `COMPUTE` (1356)                                                    |
| effect phase                  | `$effect(·, effect)`                                                              | rd(⊥, ·), wr, cleanup, raise, call(⊥, ⊥, ·), stream  | `EffectPhaseOp` 228              | `EFFECT` (`runEffect` 1370)                                         |
| settled                       | `$settled(body)`                                                                  | rd, wr, cleanup, raise, call(⊥, ⊥, ·), stream        | `EffectOp` 207                   | `SETTLED` (1394)                                                    |
| event                         | `$event(body)`                                                                    | rd, wr, wait, call, raise                            | `EventOp` 239                    | `EVENT` (`eventSteps` 1510)                                         |
| row                           | the render callback of `For` / `Repeat` / `Show` / `Match`, an `Errored` fallback | setup: as setup; view: as view                       | `RowRoutine` 714, `RowCheck` 719 | `runRow` 1920                                                       |
| lazy view                     | a zero-arity `function*` as `children` / `fallback`                               | as view                                              | `LazyView` (flow.ts 106)         | `lazyView` (flow.ts 343)                                            |
| attempt handler               | `attempt(fn, function* (e) {…})`                                                  | Ops(H′) of the enclosing host H′; not a host (D-078) | `HandlerYields` (runtime.ts 826) | delegated inside the attempt (`handle` 781)                         |

Two hosts are not separate at run time. A JSX hole is checked as part of its view (D-051: TypeScript types a `yield*` in JSX as the view's own yield). An attempt's generator handler is checked as part of its host (`AttemptOps` folds `HandlerYields` into the attempt's yields, which the host's constraint then checks).

### 1.4 Values

- **Failure classes** 𝒦: `Error` subclasses with a literal `readonly kind` (D-034). `Failure` and `KindCheck` are at `types.ts:748–763`, and are checked at `raise`, `attempt`, `until`, `Errored`'s `catch` and a `Props` declaration (`PropsCheck`, 414). A class is identified by its structure, which D-034 makes unique by its `kind`.
- **Sources** `Source⟨T, ε, p⟩` (`types.ts:332`): an iterable whose iterator yields rd(p, ε) and returns T. They are not callable. **Paths** `Path⟨T, ε, p⟩` (359) are sources with keys; a key holding a source joins its color (`PathThrough`, 374). `constant(v) : Source⟨T, ∅, ⊥⟩` (`runtime.ts:432`).
- **Event handlers** `EventHandler⟨Args, ε, R, p, a⟩` (`types.ts:659`). Calling one gives an `EventCall` (637), which yields call(p, a, ε). Iterating the handler itself yields bind(p, ε) and returns `BoundEvent⟨Args⟩` (679), the only value an event attribute takes (`Bound`, 684, through the vendored JSX namespace).
- **Views** `View⟨p, ε, w, ρ⟩` (550) yield child(κ) and return `SettledView`. A component's view is `ComponentView` (570), a view with the `[COMPONENT]` brand. `h` output is `HView` (615). **Elements** (`element.ts:39`) are DOM nodes, text, and _settled_ views or `h` outputs: p = ⊥, ε = ∅, ρ = ∅, any w.
- **Contexts** (`context.ts`). `RequiredContext⟨T, N⟩` (99) comes from `createContext<T, N>()` and contributes ρ = {itself}. `YieldContext⟨T, N⟩` (96) comes from `createContext(default)` and contributes ∅. A required context's identity is (N, T): `[CONTEXT]` holds `(value: T) => T`, which makes T invariant, together with the literal N. An unnamed required context is refused (`UnnamedContext` 108, `[UNNAMED_CONTEXT]`).
- **Components** `Component⟨D, p, ε, w, ρ⟩` (585) is a plain function type. `HoleCall⟨D, p, ε, w, ρ⟩` (503) is the type of a non-generic component's call, generic in its props literal.
- **Props** `Props⟨D⟩` (405) maps each declared field to a read: a bare `T` becomes `Path⟨T⟩`, so it reads rd(⊥, ∅); `Source⟨T, E, P⟩` reads rd(P, E). `children` becomes a `Source`.
- **Elements and tags**: DOM tags and foreign components only. `TagType` (`element.ts:60`) refuses a function returning a `ComponentView` (D-062, D-067).

### 1.5 Program forms

```
view body  ::= return <tag a…>{yield* e}…</tag>          JSX flavour (holes are the only yields)
             | return h(tag | C, props, …children)         h flavour (yields nothing)
call       ::= yield* C(props)                              a yield component, in a hole: call form only
props      ::= { n: value | source | hole-prop, …, children: lazy-view | row }
boundary   ::= yield* Loading({ fallback?, on?, children }) | yield* Errored({ catch?, fallback, children })
flow       ::= yield* For({ each, fallback?, children: row }) | Show | Match | Switch | Repeat
provide    ::= yield* Ctx.provide({ value, children })
root       ::= render(code, el) | hydrate(code, el) | renderToString(code) | renderToStream(code)
handoff    ::= foreign(C)
```

A yield component is never a tag (D-062, D-067). The JSX namespace refuses one (`TagType`), and the lint `no-component-tag` reports it. In call form a prop is a value, a source or a hole (D-065), and `children` / `fallback` are lazy views or rows (D-066, D-094: `[LAZY_VIEW]` refuses a JSX element there).

---

## 2. Static semantics

### 2.1 Colors are phantom components

Every color component is a `declare const … : unique symbol` field (`types.ts:23–60`). None exists at run time ("Nothing here exists at runtime", `types.ts:20`). The runtime never reads a color. Its routes are a consequence of Solid's owner tree (§3), and the theorem (§4) states that the phantoms and the routes agree.

### 2.2 The folds

For a yield union Y (a union of ops, read as a set):

| Fold      | Definition                                          | Implementation                 |
| --------- | --------------------------------------------------- | ------------------------------ |
| pend(Y)   | ⊤ iff ∃o ∈ Y: o = wait, or ⊤ ∈ o.[PENDING]          | `PendingOf` `types.ts:250–258` |
| fails(Y)  | ⋃ { o.[FAILS] : o ∈ Y }                             | `FailsOf` 260                  |
| mw(Y)     | ⊤ iff ∃o ∈ Y: ⊤ ∈ o.[MAY_WAIT]                      | `MayWaitOf` 282–292            |
| req(Y)    | ⋃ { o.[REQUIRES] : o ∈ Y }                          | `RequiresOf` 267               |
| settle(ρ) | unwrap `Created⟨C⟩` to C                            | `Created` 278, `Settle` 280    |
| ev-p(Y)   | ⊤ iff ∃o ∈ Y: ⊤ ∈ o.[PENDING] (wait does not count) | `ReadsPendingOf` 294–303       |
| ev-a(Y)   | ⊤ iff wait ∈ Y, or ∃o: ⊤ ∈ o.[ASYNC]                | `WaitsOf` 308–315              |

We write κ(Y) = ⟨pend(Y), fails(Y), mw(Y), settle(req(Y))⟩.

Three refinements read values rather than ops:

- **`HOps(R)`** (`types.ts:604`) is the color of what a view _returns_: child(κ) for `h` output or a view, nothing for a JSX element. A JSX element is settled by construction.
- **`OpsOfHole(V)`** (`holes.ts:56–75`) is the color of a value given to `h` or to a flow control: a handler gives bind, a source rd, an `HView` / `View` child (an eagerly created view's ρ is marked `Created`, D-098), and a generator its `GeneratorOps`.
- **`GeneratorOps(Y, R)`** (`holes.ts:83–87`) is Y ∪ `OpsOfHole(R)`, with R = never as its own case, so a hole that always raises keeps its raise (D-070 F3). `Ops(V)` (`flow.ts:75`) dispatches between them.

### 2.3 Variance

- `Source⟨T, ε, p⟩` is covariant in ε and p: the phantoms are `readonly`. `PropsInput⟨D⟩` (`types.ts:440–450`) is what a call may pass for a declared prop:
  - for `Source⟨T, E, P⟩`: `T`, `Source⟨T, E, Widen P⟩` or `HoleProp⟨T, E, Widen P⟩`;
  - for a bare `T`: `T`, `Source⟨T⟩` or `HoleProp⟨T, ∅, ⊥⟩`; anything else is the `[SETTLED_PROP]` refusal.

  `Widen` (452) lets a declared pending prop take a settled argument. Settled ⊂ pending and never ⊂ E follow.

- A view is an element only at ⟨⊥, ∅, w, ∅⟩. `Loading` and `Errored` are the only constructs that lower p or ε, and `provide` is the only one that lowers ρ (§2.5).
- A required context is invariant in its value type and nominal in its name. A provider of another (N, T) discharges nothing (context.type-tests "a provider of another context does not discharge it").

### 2.4 Typing rules

The rules are written Γ ⊢ e : τ ! Y, read "e has type τ and yields Y". Only the color-bearing rules are listed; JavaScript's own typing is TypeScript's.

```
(R-Read)    s : Source⟨T, ε, p⟩                         ⊢ yield* s : T ! rd(p, ε)
(R-Prop)    props : Props⟨D⟩, D(n) = Source⟨T,E,P⟩      ⊢ yield* props.n : T ! rd(P, E)
            props : Props⟨D⟩, D(n) = T (bare)            ⊢ yield* props.n : T ! rd(⊥, ∅)
(R-Raise)   e : E, E ∈ 𝒦                                ⊢ yield* raise(e) : never ! raise(E)
(R-Write)                                               ⊢ yield* set(v) : U ! wr        (also refresh)
(R-New)                                                 ⊢ yield* $signal(v) : [Source⟨T⟩, Setter⟨T⟩] ! new_signal(∅)
(R-Memo)    memo ⊢ b : Y ▷ R,  R ∌ unhandled promise/stream (SyncReturn)
            ⊢ yield* $memo(b) : Source⟨V(R), fails(Y), pend(Y) ∨ async(R)⟩ ! new_memo(∅)
            — with { loadingValue }: p = ⊥                     (runtime.ts:1173, 1189–1201)
(R-Effect)  compute ⊢ c : Yc ▷ V,  phase ⊢ e : Ye ▷ void
            ⊢ yield* $effect(c, e) : void ! new_effect(fails(Yc) ∪ fails(Ye))
            — no pending component: an effect holds no boundary (D-090)   (runtime.ts:1348–1352)
(R-Settled) settled ⊢ b : Y ▷ void      ⊢ yield* $settled(b) : void ! new_settled(fails(Y))   (1389)
(R-Ctx)     C : RequiredContext⟨T,N⟩    ⊢ yield* C : ContextValue⟨T⟩ ! ctx({C})
            C : YieldContext⟨T,N⟩       ⊢ yield* C : ContextValue⟨T⟩ ! ctx(∅)      (context.ts:67–80)
(R-Event)   event ⊢ b : Y ▷ R           ⊢ $event(b) : EventHandler⟨Args, fails(Y), R, ev-p(Y), ev-a(Y)⟩  (1571)
(R-Call)    h : EventHandler⟨A, ε, R, p, a⟩   ⊢ yield* h(x̄) : R ! call(p, a, ε)
(R-Bind)    h : EventHandler⟨A, ε, R, p, a⟩   ⊢ yield* h : BoundEvent⟨A⟩ ! bind(p, ε)
            — a is dropped: a view does not wait for a call (D-072); p goes to w, never to pending (D-075)
(R-Attempt) fn : () → T,  onError : Caught(T) → H,  HandlerCheck(H), StreamHandlerCheck(T, H)
            ⊢ yield* attempt(fn, onError) : Result(T, H) ! W(T) ∪ S(T) ∪ Yields(H) ∪ X(H)
            where  W(T) = call(p, a, ∅) if T = EventCall⟨R,ε,p,a⟩;  wait if T is a promise;  ∅ otherwise
                   S(T) = stream if T is (a promise of) a stream;   Caught(T) = ε for an event call, else unknown
                   R_H  = H's return (a generator's return value, else H);  X(H) = raise(R_H) if R_H ⊑ Error, else ∅
                   Result = Attempted(T) if R_H ⊑ Error, else Attempted(T) ∪ Absorbed(R_H)
            HandlerCheck refuses an R_H that is an Error on some paths only ([ATTEMPT_ABSORBS]);
            StreamHandlerCheck refuses a generator or value-returning handler on a stream ([STREAM_HANDLER])
                                                                   (runtime.ts:799–921; until: 1162)
(R-View)    view ⊢ f : VY ▷ R            ⊢ view(f) : ViewFn⟨VY, R⟩,   κ_view = κ(VY ∪ HOps(R))
            — an h view must have VY = ∅ ([HVIEW_READ], NoJsxViewRule runtime.ts:1905)
(R-Comp)    setup ⊢ body : Y ▷ ViewFn⟨VY, R⟩
            ⊢ component(body) : HoleCall⟨D, p, ε, w, ρ⟩      (runtime.ts:1792–1805)
              p = pend(VY ∪ HOps R)            ε = fails(VY ∪ HOps R) ∪ fails(Y)
              w = mw(VY ∪ HOps R)              ρ = settle(req(VY ∪ HOps R)) ∪ req(Y)
            — fails(Y) picks up effect / settled failures (D-073); req(Y) picks up the setup's reads (D-098).
              A generic setup fails the first overload and gets Component⟨…⟩ instead (1777–1791).
(R-CallC)   C : HoleCall⟨D, κ⟩,  a : A,  A ⊑ PropsInput⟨D, unknown⟩,  Undeclared(A, D) = ∅
            ⊢ yield* C(a) : SettledView ! child(κ ⊔ ⟨⊥, ∅, ⊥, HoleRequires(A)⟩)     (types.ts:473–512)
(R-HoleP)   HoleProp⟨T, E, P, Q⟩ = () → Generator⟨rd(P,E) | child(P,E,·,Q) | raise(E), T⟩    (462)
(R-Row)     setup ⊢ s : Y ▷ ViewFn⟨VY, R⟩, args       contributes RowOps = VY ∪ HOps(R) ∪ Y      (flow.ts:90)
(R-Flow)    For / Repeat / Show / Match / Switch(…)  : ComponentView⟨κ(Ops(W) ∪ Ops(F) ∪ RowOps | Ops(C))⟩
            — every color joins; nothing is discharged (FlowView, flow.ts:84)
(R-Load)    Loading({ fallback: F, on: O, children: C })
            : ComponentView⟨pend(F), fails(C ∪ F ∪ O), mw(C ∪ F ∪ O), settle(req(C ∪ F ∪ O))⟩   (flow.ts:411–420)
(R-Err)     Errored({ fallback: F, children: C })
            : ComponentView⟨pend(C ∪ F̂), fails(F̂), mw(C ∪ F̂), settle(req(C ∪ F̂))⟩
            Errored({ catch: K, fallback: F, children: C })
            : … with ε = (fails(C) ∖ K) ∪ fails(F̂)                                    (flow.ts:472–514)
            where F̂ = F's yields if F is a lazy view (FallbackYields) or RowOps if F is a row;
                  F̂ = ∅ if F is content or a render function  — see §6.3 F-1
(R-Prov)    Ctx : …Context⟨T, N⟩ discharging Q,  v ⊑ ProvidedValue⟨T⟩
            ⊢ Ctx.provide({ value: v, children: C })
            : ComponentView⟨pend(C), fails(C), mw(C), settle(req(C)) ∖ Q⟩                     (context.ts:82–91)
(R-Lazy)    T's view : View⟨·, ε, w, ρ⟩   ⊢ lazy(f) : (props) → ComponentView⟨⊤, ε ∪ {ChunkError}, w, ρ⟩     (lazy.ts:52–62; D-100)
(R-h)       h(tag, attrs, …c) : HViewOf(attrs ∪ c)                        (holes.ts:90; h.ts:73–85)
            h(C, props, …c)   : HView⟨κ(C's view) ⊔ κ(c)⟩, c's eagerly built views' ρ as Created (h.ts:146–155)
            h(Loading | Errored | Ctx.provide, …): as R-Load / R-Err / R-Prov over OpsOfHole   (h.ts:91–139)
(R-Root)    code : () → View⟨⊥, any, ·, ρ⟩ ∨ () → Element,   ρ = ∅  (RootCheck)
            ⊢ render(code, el), hydrate(code, el), renderToString(code), renderToStream(code)   (render.ts:36–121)
(R-Foreign) C : (…) → View⟨·, ε, ·, ρ⟩,  ε = ∅,  ρ = ∅    ⊢ foreign(C) : C     (ForeignCheck, foreign.ts:41–65)
(R-Elem)    v : View⟨p, ε, w, ρ⟩ is an Element (a JSX child, a fragment child, a plain slot)
            iff p = ⊥ ∧ ε = ∅ ∧ ρ = ∅          (element.ts:36–49; fragments: D-086, with D-093's tsconfig)
(R-Attr)    an event attribute of the JSX namespace takes Bound⟨H⟩ only; Errored's reset : Reset = BoundEvent⟨[]⟩
```

### 2.5 Discharge

Only these constructs lower a color component. All other constructs (calls, holes, rows, flow controls, binds, `h`) are joins.

| Construct                    | p                                | ε                                                                      | w                             | ρ                                     |
| ---------------------------- | -------------------------------- | ---------------------------------------------------------------------- | ----------------------------- | ------------------------------------- |
| `Loading`                    | discharges children's and `on`'s | passes (children, fallback, `on`)                                      | passes                        | passes                                |
| `Errored`                    | passes (children, fallback)      | discharges children's (all, or the classes in `catch`)                 | passes                        | passes                                |
| `Ctx.provide`                | passes                           | passes                                                                 | passes                        | discharges {Ctx} of its children only |
| `attempt`                    | —                                | absorbs or transforms what `fn` throws / rejects / the call fails with | —                             | —                                     |
| root (`render` …)            | demands ⊥                        | accepts any (re-thrown, D-033)                                         | any                           | demands ∅                             |
| `foreign(C)`                 | accepts any                      | demands ∅                                                              | any                           | demands ∅                             |
| `$memo(…, { loadingValue })` | ⊥ (commit #0 is a value)         | passes                                                                 | —                             | —                                     |
| `$effect`, `$settled`        | dropped by design (D-090)        | joins the component (D-073)                                            | —                             | —                                     |
| nothing                      | —                                | —                                                                      | w is never discharged (D-075) | —                                     |

### 2.6 Components and the two call types

A non-generic setup gets `HoleCall` (`types.ts:503–512`). Its call is generic in the props literal A, and its view adds `HoleRequires(A)`: the requirements of A's generator-typed members (473–480). A generic setup (D-029) cannot be inferred against that overload and gets the plain `Component` type, which keeps its type parameters but carries no hole-prop requirement. `lazy` and `h(C, props)` read a `HoleCall` through `PlainCall` (529), so their hole props carry none either. See §6.2 T1.

---

## 3. Dynamic semantics

### 3.1 Configurations

A configuration is ⟨𝒪, σ, Π⟩:

- **𝒪** is Solid's owner tree **[S1]**. Its node kinds are: root, hole (a render effect created by `insert` or `h`), memo, effect, settled callback, flow-control internals (including `For`'s per-row mapping), `Loading`, `Errored⟨K⟩`, `Provider⟨C, v⟩`, and _report_ (the render effect `reportError` creates, `runtime.ts:1519`).
- **σ** is the host state (`HostState`, `runtime.ts:233–272`): host, cleanup sink, resumed flag, and the development-only view name, JSX flag, routine name, receipt list and starting observer. `runAs` (280–314) replaces it whole for each run and restores it after. A run nested in another starts from its own state.
- **Π** is the set of event calls in flight: each an `action` promise with its call record and route.

**A yield component has no owner node of its own.** `component`'s function (`runtime.ts:1836–1854`) runs `runSetup` then `renderView` in whatever owner is current. In call form that is the hole whose compiled getter evaluates `perform(C(a))`, so the component's setup runs in the calling hole and its view's holes are created as that hole's children. D-097 removed the untrack that used to wrap them. The docstring at 1742 says so ("in the hole that calls it"; it said "under the component's owner" until F-5 was fixed). Every "above the component" below means "above the hole that called it".

### 3.2 Where each host runs and what it creates

| Host / construct                | Runs                                                                                                                                                                                                                               | Creates                                                                                              | Site (`runtime.ts` unless noted)                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| setup                           | once per instance, synchronously, `drive` (a wait is `ASYNC_NOT_ALLOWED`), in the caller's owner                                                                                                                                   | its `$memo` / `$effect` / `$settled` / … as children of that owner; `$cleanup` on that owner         | `runSetup` 1710, `component` 1807                          |
| view                            | once, synchronously, as `VIEW`                                                                                                                                                                                                     | one render effect per JSX hole (compiled `insert`), or per `h` hole                                  | `renderView` 1724                                          |
| JSX hole                        | in its render effect, every time it re-runs. `perform` reads a source, passes a `VIEW_MARK` value as content (in a one-element array on the server), binds an `EVENT_MARK` handler, calls a function, drives an iterable as `HOLE` | whatever the call it evaluates creates                                                               | `perform` 471–508                                          |
| `h` hole / flow source          | as `HOLE`, in the computation reading it                                                                                                                                                                                           | —                                                                                                    | `runHole` 1650, `throughHole` 1682, `propRead` flow.ts 208 |
| hole prop                       | where the child reads the prop (a path runs it), in the child's hole                                                                                                                                                               | the components it calls, under that hole                                                             | `readPath` 584–595                                         |
| memo                            | in Solid's memo; its first step as `MEMO`. On a `wait` the compute returns `resume`'s promise **[S7]**, and later steps run as `MEMO` with `resumed` set (dev: `READ_AFTER_ATTEMPT`)                                               | —                                                                                                    | `memoCompute` 1248, `resume` 1280–1330                     |
| effect                          | Solid's `createEffect(compute, { effect, error })`: the compute as `COMPUTE`, the phase as `EFFECT` with a cleanup sink; the error arm re-throws **[S5]**                                                                          | —                                                                                                    | `$effect` 1348–1368, `runEffect` 1370                      |
| settled                         | `onSettled(untrack(…))`, once, as `SETTLED` **[S9]**; a read that pends there re-runs the whole body when it lands (F-6)                                                                                                           | —                                                                                                    | `$settled` 1389–1396                                       |
| event call                      | a Solid `action` **[S6]**; each step as `EVENT` sharing one receipt list; a `wait` is the action's yield; a pending read waits (`eventRead`)                                                                                       | nothing (an event does not create)                                                                   | `$event` 1571–1636, `eventSteps` 1510, `eventRead` 398     |
| row                             | untracked, per item / shown branch, inside the flow control's mapping: `runSetup` then `renderView`                                                                                                                                | the row's computations, under the flow control, under the holding hole **[S13]**                     | `runRow` 1920–1941; `adapt` flow.ts 180                    |
| lazy view                       | untracked `renderView`, where and each time the control shows it                                                                                                                                                                   | its holes, inside the control / boundary / provider                                                  | `lazyView` flow.ts 343                                     |
| flow control, boundary, provide | created untracked (`untrack` + `flowControl`), output marked a view. `Errored` wraps its children in `BOUNDARY = true`; `provide` is `createComponent(ctx, { value, children })`                                                   | the Solid control / boundary / provider node and, inside it, its children's lazy view **[S10, S11]** | flow.ts 554–561, 536–541, 570–583                          |
| attempt handler                 | synchronous failure, call failure or rejection: `handle` delegated inside the attempt, so under the same driver and host. Stream failure: `runAs(host, …, resumed)` per failure, after the host's run                              | —                                                                                                    | `Attempt` 676–753, `handle` 781, `mapStream` 1211          |
| root                            | `rootOf(code)` builds an element thunk where the root is written, then `@solidjs/web`'s renderer                                                                                                                                   | the root owner                                                                                       | render.ts 72–121                                           |

### 3.3 Steps

```
(D-Read)   readOf(s) in computation c:  v                       — the value
                                       | throw NotReadyError     — s pending            [S2]
                                       | throw f                 — s failed (a memo caches f) [S3]
           In host EVENT, NotReadyError ⇒ yield Wait(until(() => read(s)))     (eventRead 398–409)
(D-Raise)  yield* raise(e) ⇒ throw brand(e)        — FAILURE symbol, every build (D-087)   (923–932, 127–137)
(D-Write)  yield* receipt ⇒ checkWrite(host) ; write          — held by the enclosing action [S6]  (941–978)
(D-New)    yield* new_k ⇒ checkCreate (dev: host = SETUP) ; make()                       (998–1016)
(D-Ctx)    yield* C ⇒ useContext(C) at getOwner()  — value ⇒ path over it
                                                  — unset or undefined ⇒ ContextNotFoundError [S11]
                                                    ⇒ dev: [NO_PROVIDER]                      (1425–1444)
(D-Call)   h(x̄) ⇒ run action; promise r marked EVENT_CALL.  yield* r ⇒ finished ? return/throw : Wait(r)  (1593–1626)
(D-Bind)   yield* h ⇒ bindEvent(h): w = wrapper(owner := getOwner(), route := BOUNDARY ? report(owner) : none)
           DOM calls w ⇒ call with route; an unhandled rejection with a route ⇒ reportError(owner, f)   (1469–1501)
(D-Wait)   only the memo and event drivers accept Wait; drive() elsewhere throws ASYNC_NOT_ALLOWED      (651–664)
(D-Attempt) as R-Attempt at run time: a synchronous throw, a rejection, or an event call's *branded* failure
           ⇒ handle(onError, e): returns an Error ⇒ throw brand(it); anything else ⇒ the attempt's value.
           An event call's unbranded failure or a NotReadyError ⇒ re-thrown past the handler (D-087)  (676–789)
```

### 3.4 Propagation

For a computation c, let ↑Loading(c) be the nearest `Loading` ancestor in 𝒪. Let ↑Errored(c, K) be the nearest `Errored` ancestor whose `catch` lists K or that has no `catch`; one that does not list K re-throws past itself (`flow.ts:533–538`). Either is ⊥ when there is none.

**(P-Pend) A pending read suspends to the nearest `Loading` above the READ.**

| Read in                                   | Route                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| hole, or a flow control's own computation | ↑Loading(c) shows its fallback until the read settles **[S2]**                                                                             |
| memo                                      | the memo is pending; each reader's read throws in the reader, so the route is the reader's (above the READ, not above the memo's creation) |
| effect compute                            | the effect waits; no boundary is notified (D-090) **[S5]**                                                                                 |
| event                                     | the call waits (the event's p); no boundary                                                                                                |
| `$settled`                                | admitted (`EffectOp`); no boundary is notified, and Solid re-runs the body from its start when the source lands (F-6)                      |
| effect phase                              | refused statically (rd(⊥, ·) only)                                                                                                         |
| `on` of a `Loading`                       | read beside the boundary; its pending is that `Loading`'s own **[S8]**                                                                     |

**(P-Fail) A failure routes to the nearest `Errored` above the READ** (views, holes, memos), above the BIND (events, D-085), or **re-throws at the root** (D-033).

| Failure raised in                                               | Route                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| hole, flow source, row                                          | ↑Errored(c, K) **[S3]**                                                                                                                                                                                                                                                                                                                                                                                                  |
| memo                                                            | the memo holds f; each reader re-throws at its read, so ↑Errored(reader, K)                                                                                                                                                                                                                                                                                                                                              |
| effect compute                                                  | the error arm re-throws, so ↑Errored(effect's owner, K) = above the hole that called the component (D-073) **[S5]**                                                                                                                                                                                                                                                                                                      |
| effect phase, `$settled`                                        | ↑Errored(owner, K), likewise                                                                                                                                                                                                                                                                                                                                                                                             |
| event, a handled call (`yield*`, `.then`, an `attempt` over it) | the caller: at `yield*` the failure is thrown into the caller's routine                                                                                                                                                                                                                                                                                                                                                  |
| event, an unhandled call through a bind wrapper                 | when some `Errored` above the bind site takes f (the chain `BOUNDARY` gives, walked from the nearest: no `catch`, or a listed class f is an instance of), `reportError(bindOwner, f)`, a render effect under the bind site that throws f, so ↑Errored(bind site, K) (D-085). When none does (no `Errored` above, or only ones whose `catch` excludes f), the call's promise rejects and nothing is reported (F-7, fixed) |
| event, an unhandled call of the bare handler                    | the promise rejects                                                                                                                                                                                                                                                                                                                                                                                                      |
| a `lazy` component's import (D-100)                             | the rejection is a branded `ChunkError` (`lazy.ts:21–36`). Client: the import resolves to `Failed`, rendered in each call's place (`lazy.ts:110–136`); when some `Errored` above the call takes it (the `BOUNDARY` chain, as at a bind site), `Failed` throws it there, so ↑Errored(call, K); when none does, it is re-thrown out of band (a microtask: an uncaught exception) and the call renders nothing. A re-run of the failed call (an `Errored`'s reset) loads again. Server: Solid's `lazy`'s own route (a `Loading` above contains it in its fragment, which the client renders again) |
| setup (reachable only through a cast)                           | thrown out of `runSetup` into the calling hole, so ↑Errored(calling hole, K)                                                                                                                                                                                                                                                                                                                                             |
| ↑Errored = ⊥                                                    | D-033 **[S4]**: re-thrown out of `render` / `flush`. A computation re-throws Solid's error with f as `cause`; a setup throws f; an event's call rejects; a `lazy` call's `ChunkError` is thrown out of band (D-100). raise.spec's host table pins each form                                                                                                                                                                                                                          |
| a fallback of a boundary                                        | above that boundary: a fallback is rendered outside its own boundary's handling **[S3]**                                                                                                                                                                                                                                                                                                                                 |

**(P-Ctx) Context resolves at the component's creation.** `yield* Ctx` is only admitted in a setup (`CONTEXT_OUTSIDE_SETUP` in development). The setup runs in the calling hole, so the read resolves from that hole up. `Ctx.provide({ value, children })` builds its lazy view inside Solid's provider. So a component called in a hole of `children` is created below the provider and reads `value`. A provider in the reader's own view is below the calling hole and does not give the reader's setup anything (D-098, Solid's own rule). A hole prop runs where the child reads it, which is below the child's call and so below any provider wrapping that call (D-098 amended). This is what makes `HoleRequires` sound.

**(P-Row) A row's colors are the list's (D-059, D-063).** A row's setup and view run inside the flow control's mapping, which is under the hole holding `For(…)`. A row's pending, failure, effect failure or requirement takes the routes above from there. These are the same boundaries the holding view's other holes reach.

**(P-Attempt).** A handler that returns an `Error` fails the attempt with it, branded. A handler that returns anything else absorbs, and the attempt gives that value. A generator handler's ops run under the attempt's own driver, so a write is inside the event's transaction and a wait is the memo's resumption (D-078). A stream's failures arrive after the host's run: the plain handler's `Error` fails the stream and nothing ends it (D-091). Over an event call, only a branded failure reaches the handler (D-087).

### 3.5 Run-level invariants

- **Receipts (D-021, D-028).** A setter returns a receipt, and the write happens at `yield*`. In development, a receipt not delegated to by the end of its run is `UNYIELDED_WRITE`. An `$event` call shares one list across its steps, checked when the body ends. A setter called with no routine running is `SETTER_OUTSIDE_RUN` (`runtime.ts:941–996`). Production writes nothing for an undelegated receipt.
- **Superseded memo runs continue (D-080).** `resume` steps every run to its end. Solid keeps only the latest run's promise **[S7]**, so a superseded run's value or failure never lands. Its reads after the attempt are untracked.
- **Events are independent (D-064).** Every call is its own action, with no supersession. Writes are held until the call settles (D-081) **[S6]**.
- **One host state per run (`runAs`).** The development checks (`READ_IN_SETUP`, `READ_IN_VIEW`, `JSX_IN_SETUP`, `WRITE_IN_REACTIVE`, `CREATE_OUTSIDE_SETUP`, `UNTYPED_THROW`) read only σ and `getObserver()`. Production calls neither check.
- **Server order (D-084).** On the server a view's holes are read before its children; the markup is unaffected **[S12]**.

### 3.6 Solid assumptions

| #   | Assumption (Solid `^2.0.0-rc`, pinned by the twins' parity and the conformance oracle)                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Owner tree.** A computation created while another runs is that one's child. `useContext` resolves from the current owner upward. Pending and error propagation walk the same tree.                                                                                                                 |
| S2  | **Pending.** Reading a pending source throws `NotReadyError` in the reading computation. A render effect so suspended is held by the nearest `Loading` ancestor. A memo whose read pends is itself pending to its readers.                                                                           |
| S3  | **Errors.** A computation's throw is delivered to the nearest `Errored` ancestor. A memo caches its error and re-throws it at every read. An `Errored`'s or `Loading`'s fallback is rendered outside that boundary's own handling.                                                                   |
| S4  | **No boundary.** An error that escapes every boundary is re-thrown from `render` / `flush`, wrapped with the original as `cause` for a computation (D-070's matrix).                                                                                                                                 |
| S5  | **Effects.** A `createEffect` compute waiting on `NotReadyError` notifies no boundary. Without an `error` arm a compute failure is logged and skipped (hence the arm). The effect phase runs with no observer, and its throw reaches the nearest `Errored` above the effect's owner.                 |
| S6  | **Actions.** Calling an action runs its generator synchronously to its first yield. Writes inside are held until it settles. A nested action joins the outer transaction.                                                                                                                            |
| S7  | **Async memos.** A compute returning a promise makes the memo pending. Only the latest run's promise lands.                                                                                                                                                                                          |
| S8  | **`Loading`'s `on`** is read beside the boundary, and its pending is absorbed by that `Loading`.                                                                                                                                                                                                     |
| S9  | **`onSettled`** runs once, after the graph settles. A callback whose read throws `NotReadyError` (a source still pending that nothing else waits for) is re-run from its start when the source lands (obl:160, F-6).                                                                                 |
| S10 | **`createComponent` / `untrack`.** A component or control created untracked subscribes nothing in the creating computation.                                                                                                                                                                          |
| S11 | **Providers.** Solid's provider (`createRoot` + `setContext`) gives its value to everything created inside it and passes pending and errors through to the boundaries above it. A provided `undefined` reads as _unset_: `getContext` falls back to the default, then throws `ContextNotFoundError`. |
| S12 | **Hydration and SSR.** Hydration keys are owner ids, and a node is claimed by key (D-074, D-092). The server reads a view's holes before its children (D-084). A server hole calls a function it returns, and a server memo retries a pending first read (F7, D-082).                                |
| S13 | **Lists.** A `For` row's computations are owned by the row's mapping under the `For`. A keyed row persists while its item does.                                                                                                                                                                      |

---

## 4. The theorem (D-071 made precise)

### 4.1 Preconditions

A program P is **admissible** when:

- **C1 Well-typed.** `tsc` accepts P against the library's declarations. The tsconfig is `strict` and sets `jsxImportSource: "solid-yield"`, `jsxFactory: "jsx"` and `jsxFragmentFactory: "Fragment"`; without the last two a fragment's children are unchecked (D-086, D-093).
- **C2 No escape hatches.** No `any`, type assertion or `@ts-expect-error` / `@ts-ignore` in routine code, nor in the types of values that enter it (props, contexts, handlers, server values). Every failure class has its own `kind` literal (D-034). Every required context has its own (name, value type) (§6.2 T2).
- **C3 Lint.** The `recommended` rules the types cannot carry report nothing: `no-read-in-view-body` (D-051), `yield-in-jsx-hole`, `no-throw`, `no-try-catch`, `no-foreign-reactive`, `no-unyielded-write`, `component-call-yielded`, `no-unchecked-foreign-handoff`.
- **C4 Public API, one runtime, one route.** The runtime uses only Solid's public API (D-004). One copy of the runtime is loaded (`DUPLICATE_RUNTIME`). The server and the client are built with the same route (D-074).
- **C5 Solid.** S1–S13 hold for the Solid version in use.
- **C6 Edges.** A yield component reaches plain Solid only through `foreign(…)` or the library's root. Foreign components have no colors (D-067), and their own failures are outside the theorem.
- **C7 Typed failures.** The statements about failures concern **typed failures**: values branded by `raise` or by an attempt's handler (D-087). An untyped throw is a bug (D-019). It still routes (`UNTYPED_THROW` in development, itself in production, to the nearest `Errored` or re-thrown), but no color claims it.

### 4.2 Positions

A **position** is where a runtime route ends, paired with the static color the types give it:

| Position π                                                   | ε(π), p(π), ρ(π)                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| an `Errored` b                                               | κ of b's `children` (and `catch` K)                                                   |
| a `Loading` l                                                | κ of l's `children` ⊔ `on`                                                            |
| a caller of an event call (`yield* h(x̄)`, `attempt` over it) | the call's ε (`Caught`)                                                               |
| the root                                                     | κ of the root view (p and ρ are ⊥ / ∅ by R-Root)                                      |
| a foreign edge `foreign(C)`                                  | κ of C's view (ε and ρ are ∅ by R-Foreign)                                            |
| a routine run (memo, event, compute)                         | its own fold: the memo's `Source⟨…, ε, p⟩`, the handler's ⟨ev-p, ε⟩, the compute's Yc |

### 4.3 Statement

**Theorem (λ-yield soundness).** Let P be admissible. In every execution of P (every interleaving of promise settlements, user events and writes):

- **(a) No failure arrives where its color is excluded.** If a typed failure of class K is delivered to a position π, then K ⊑ ε(π) (structurally; with C2's distinct kinds, nominally). In particular:
  - a root whose view has ε = ∅ never re-throws a typed failure;
  - an `Errored` with `catch` K never receives a class outside K;
  - nothing typed crosses a `foreign(C)` edge;
  - an `attempt` over an event call never hands its handler a class outside `Caught`.
- **(b) No pending read where pending is ⊥.** If a read pends in computation c, then the routine containing the read has p = ⊤ in its fold, through rd(⊤, ·) or wait. If c is a hole, a row's or a flow control's computation, then ↑Loading(c) ≠ ⊥. The root never pends. A read that pends in an effect compute holds no boundary, and the type says so (D-090). A read that pends in an event makes the call wait, and the event's p and the binding view's w say so.
- **(c) No context read without a provider.** No `yield* Ctx` of a context created without a default executes without a provider of Ctx above the creating hole: `NO_PROVIDER` / `ContextNotFoundError` never fires.
- **(d) No over-statement.** Conversely, for every ⊤ in p, every class in ε and every context in ρ of an _inferred_ type in P, some environment drives the runtime along a route of §3.4 that delivers that color to that position, except in the cases X1–X6 below.

**Known over-statements (exceptions to (d)).**

| #   | Exception                                                                                                                                                                                                                                     | Kind                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| X1  | **The may-wait marker w (D-075)** has no runtime route by ruling: no boundary handles it and the runtime never suspends a view for a call. It is a lint signal (`no-unshown-wait`) carried by the types.                                      | model rule               |
| X2  | **A declared color is permission, not a duty (D-040).** A prop declared `Source⟨T, E, true⟩` colors its readers' views pending and failing whatever a caller passes. Only the generic form (D-029) is exact per caller.                       | model rule               |
| X3  | **A provider inside a holder's own view, around `props.children`** (D-098 amended). It is above the hole at run time, but the holder's type does not say what it provides, so the requirement still reaches the call and the root refuses it. | TS / encoding (§6.2 T11) |
| X4  | **`HoleRequires` unions every hole prop of the literal**, including one the child never reads. The requirement is then never resolved at run time.                                                                                            | encoding                 |
| X5  | **Erased generics.** `h(GenericComp, props)` reads `ReturnType`, which erases type parameters to their constraints (`boolean`, `unknown`) (§7 of the reference).                                                                              | TS                       |
| X6  | **Annotations wider than inference** (a handler typed `P: boolean` that reads nothing pending, D-072's twin note). (d) is stated for inferred types.                                                                                          | user-written             |

Each exception errs towards safety: it adds a boundary or refuses a program, and never drops a route.

**Known under-statements.** These are violations of (a)–(c) that the implementation has today. §6.2 T2 and T4 list them (F-1, F-2, F-3 and F-7 are fixed; F-6 contradicts the run count of §3, not a color). Every one either is excluded by a precondition (C2) or is a finding.

### 4.4 Proof shape

Define the **escape set** of an owner node n: the pending reads, typed failure classes and context requirements that can leave n's subtree upward. The core lemma is **color preservation**: for every node n that the runtime creates for a syntactic construct s, escape(n) ⊑ κ(s), where κ(s) is s's static color with the discharges of §2.5 applied. Its converse, **route existence**, is (d).

The proof is by induction on 𝒪 as it is built:

- **Base cases** are the operations (§1.2) with their dynamic steps (§3.3).
- **Inductive cases** are the constructs (R-Comp, R-CallC, R-Row, R-Flow, R-Load, R-Err, R-Prov, R-Attempt, R-Bind, R-Effect, R-Memo, the root and `foreign`). Each case is one obligation of §5, together with the assumptions of §3.6 it uses.
- **(a)–(c)** follow at the positions of §4.2 from preservation and the demands of R-Root and R-Foreign.

---

## 5. Proof obligations (traceability matrix)

Each obligation states the agreement between a type rule and the runtime route of §3. "Type" and "Runtime" name the tests that evidence each half:

- `jsx` = `test/jsx.type-tests.tsx`, `nojsx-t` = `test/nojsx.type-tests.ts`, `raise-t` = `test/raise.type-tests.tsx`, `ctx-t` = `test/context.type-tests.tsx`, `root-t` = `test/root.type-tests.tsx`;
- `rt` = `test/runtime.spec.tsx`, `obl` = `test/obligations.spec.tsx` (one `describe` per obligation that had no runtime test), `raise` = `test/raise.spec.tsx` (run in development, production and server configurations), `nojsx` = `test/nojsx.spec.ts`, `ssr` = `test/server/ssr.spec.tsx`, `thunk` = `test/render-thunk.spec.tsx`, `conf` = `test/conformance` (scenario names).

**Gap** marks an obligation with a half that no test evidences.

### 5.1 Folds

| #   | Obligation                                                                                                            | Implementation            | Type evidence                                       | Runtime evidence                                                                          | Status |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| O1  | `PendingOf` is ⊤ whenever an op of Y can pend at run time (rd(⊤), wait), and ⊥ only if none can                       | types.ts:250–258          | jsx:239, 262, 294, 325; nojsx-t:76–87               | rt:115 "an async memo suspends to Loading…"                                               | ok     |
| O2  | `FailsOf` is the union of the classes any op of Y can throw                                                           | types.ts:260              | raise-t:65–166 (the op, a hole, a memo, two raises) | raise:311 "reaches the nearest Errored, as itself" (every host)                           | ok     |
| O3  | `MayWaitOf` folds bind's w and children's, and is never part of `PendingOf`                                           | types.ts:282–292, 110–114 | raise-t:530–588                                     | — (types only by ruling, X1)                                                              | ok     |
| O4  | `RequiresOf` and `Settle` / `Created`: every ctx read and every child's ρ, with `Created` unwrapped where a view ends | types.ts:267–280, 599     | ctx-t:55–158, 672–702                               | rt:1073 "read with no provider above: NO_PROVIDER…" (direct and through a call)           | ok     |
| O5  | The event colors: `ReadsPendingOf` = the call may wait for data, `WaitsOf` = the call does async work                 | types.ts:294–315          | jsx:881–931 "events carry two colors"               | rt:1322 "an event that reads a pending source waits for its data", rt:1247                | ok     |
| O6  | `GeneratorOps`: a hole that always raises keeps its raise                                                             | holes.ts:83–87            | raise-t:105–125                                     | raise host "hole (a flow control's source)" (raise.spec:116)                              | ok     |
| O7  | `OpsOfHole`: an `h` hole's color is what it reads, binds or renders                                                   | holes.ts:56–75, 90–95     | nojsx-t:76–150, 182–240; raise-t:613                | nojsx:54 "measured case: runs once, suspends, fine-grained…"                              | ok     |
| O8  | `HoleRequires`: a call carries exactly what its literal's hole props require                                          | types.ts:473–480, 503–512 | ctx-t:392–614                                       | rt:1085 "a requirement out of a hole prop: the provide around the holder's call gives it" | ok     |

### 5.2 Hosts (admission ⇔ run-time behaviour)

| #   | Obligation                                                                                                                     | Implementation                                       | Type evidence                             | Runtime evidence                                                                                                                               | Status                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| O9  | A setup creates and never reads, writes or builds JSX: `SetupOp`                                                               | types.ts:185; runtime.ts:346, 475, 973               | jsx:84; raise-t:70–80                     | rt:500 READ_IN_SETUP, rt:584 JSX_IN_SETUP, rt:548, rt:2556                                                                                     | ok                            |
| O10 | A view only reads in holes, never creates or writes: `ViewOp` / `HViewOp`                                                      | types.ts:195–200; runtime.ts:353; NoJsxViewRule 1876 | jsx:105, 131, 637; nojsx-t:59–70, 152–160 | rt:166 READ_IN_VIEW, rt:2659, rt:511; ssr:116                                                                                                  | ok (JSX half: D-051, §6.2 T3) |
| O11 | A memo reads, waits and raises, and does not write; it reads before its first attempt                                          | types.ts:202; runtime.ts:358, 973                    | jsx:120                                   | rt:511, rt:653 READ_AFTER_ATTEMPT                                                                                                              | ok                            |
| O12 | Only a memo and an event wait                                                                                                  | `drive` runtime.ts:651–664                           | jsx:170; jsx:924, 931                     | rt:548 "operations in the wrong host"                                                                                                          | ok                            |
| O13 | The effect compute is pure and tracked; the effect phase writes and reads settled sources untracked (D-079, D-083)             | types.ts:219, 228; runtime.ts:1348–1378              | raise-t:371–470                           | rt:342 "reads track where the host tracks…"; rt:254, 287                                                                                       | ok                            |
| O14 | `$settled` admits rd(p, ·) for any p (`EffectOp`), so a read that may be pending must not pend when `onSettled` fires **[S9]** | types.ts:207–213; runtime.ts:1389–1396               | —                                         | obl:131 (read under a `Loading`: once, after it lands), obl:160 (a pending source nothing else waits for: pends silently, the body runs twice) | **violated** (§6.3 F-6)       |
| O15 | An event does not attempt a stream; a stream handler is a plain function (D-091)                                               | types.ts:239; runtime.ts:726–751, 863–873            | raise-t:991–1175                          | rt:1644 STREAM_IN_EVENT, rt:1658; raise:871                                                                                                    | ok                            |
| O16 | An attempt's generator handler runs as its host's routine code (D-078)                                                         | runtime.ts:781–789, 826, 835–839                     | raise-t:283–370                           | raise:784–870 (transform, absorb, retry, raise inside, a write in the transaction)                                                             | ok                            |

### 5.3 Constructs

| #   | Obligation                                                                                                                                                             | Implementation                                                                 | Type evidence                                                                                                         | Runtime evidence                                                                                                                                                                                                                                                    | Status                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| O17 | R-Comp: a component's κ is its view's plus its setup's effect failures and context reads                                                                               | runtime.ts:1792–1835                                                           | jsx:230–232; raise-t:167–240; ctx-t:68–96                                                                             | raise:415 "D-073: an effect's failure is its component's"                                                                                                                                                                                                           | ok                                                |
| O18 | R-CallC: `yield* C(a)` moves κ into the holding view, and the routes are the calling hole's (§3.1)                                                                     | types.ts:561; runtime.ts:471–508, 1836                                         | jsx:288–294 "Parent inherits Fallible's…"                                                                             | rt:2567 "D-097: a component runs in its caller's computation"; raise:311                                                                                                                                                                                            | ok                                                |
| O19 | An effect's failure goes to the `Errored` above the _calling hole_, not to one inside the component's own view                                                         | runtime.ts:1348–1368, 1836                                                     | raise-t:167–240 (the component's top-level ε)                                                                         | obl:199 (the compute's and the phase's failure, with an `Errored` inside the component's own view); raise:415                                                                                                                                                       | ok                                                |
| O20 | Props and variance: settled ⊂ pending, never ⊂ E; a pending or failing hole does not pass a settled prop                                                               | types.ts:405–466                                                               | jsx:1206–1472; nojsx-t:182–231                                                                                        | rt:2355 "a hole prop is read in the child, as a source is…"; rt:715                                                                                                                                                                                                 | ok                                                |
| O21 | A memo is `Source⟨V, fails(Y), pend(Y) ∨ async(R)⟩`; with `loadingValue` it never pends                                                                                | runtime.ts:1170–1204, 1248–1273                                                | jsx:204–225                                                                                                           | rt:115, rt:144; rt:1694 "a memo's raise reaches Errored"                                                                                                                                                                                                            | ok                                                |
| O22 | A memo's pending and failure route above the READ, not the memo's creation, where the two differ                                                                       | §3.4; **[S2, S3]**                                                             | (by R-Read at the reader)                                                                                             | obl:250 (failure), obl:282 (pending): the creation's and the read's boundaries differ                                                                                                                                                                               | ok                                                |
| O23 | A superseded memo run continues and lands nothing (D-080)                                                                                                              | runtime.ts:1248–1330                                                           | —                                                                                                                     | rt:3139, rt:3185; conf async-flights                                                                                                                                                                                                                                | ok                                                |
| O24 | R-Load: `Loading` discharges its children's and `on`'s pending; their failures, w and ρ pass                                                                           | flow.ts:411–430; h.ts:91–100                                                   | jsx:262; raise-t:858–897                                                                                              | rt:115; rt:434 "Loading's on: its pending is the Loading's own, its failure passes above"; rt:2746; thunk:163                                                                                                                                                       | ok                                                |
| O25 | A `Loading`'s fallback's own pending and failure pass above it                                                                                                         | flow.ts:415–419                                                                | raise-t:858–897; jsx:1587                                                                                             | obl:319 (failure → the `Errored` above), obl:352 (pending → the `Loading` above)                                                                                                                                                                                    | ok                                                |
| O26 | R-Err without `catch`: discharges every class of its children; pending, w and ρ pass                                                                                   | flow.ts:496–513, 514–549                                                       | jsx:941–1053                                                                                                          | raise:311, rt:1458, rt:2783                                                                                                                                                                                                                                         | ok                                                |
| O27 | R-Err with `catch` K: discharges K structurally while the runtime matches with `instanceof` (sound under D-034)                                                        | flow.ts:471–495, 533–538; types.ts:748–763                                     | jsx:941–1053, 1063–1134                                                                                               | rt:1483, rt:1519; raise:345                                                                                                                                                                                                                                         | ok                                                |
| O28 | An `Errored`'s fallback's own colors pass above it: lazy view and row                                                                                                  | flow.ts:445–447, 471–513                                                       | raise-t:701–784, 824–831                                                                                              | obl:423 (lazy view), obl:430 (row)                                                                                                                                                                                                                                  | ok                                                |
| O29 | An `Errored`'s fallback's own colors pass above it: render function and content (`h` output)                                                                           | flow.ts:445–447, 471–513 (`Ops<F>`); h.ts:106–125                              | raise-t:786–856 (each form, call form and `h`)                                                                        | obl:439 (render function), obl:444 (`h` output), obl:449 (with `catch`), obl:473 (pending → the `Loading` above)                                                                                                                                                    | ok (F-1 fixed)                                    |
| O30 | R-Flow and R-Row: a list's or a branch's κ is the join of its source, fallback and rows (setup included), and a row's routes are the holding view's (D-059, D-063)     | flow.ts:84–90, 225–338; runtime.ts:1949–1970                                   | jsx:386–504, 505–575, 576–633; raise-t:471–498, 636–662                                                               | rt:1830, rt:1880; raise host "row"; conf yield-row-list, -recursive, -keyed-store                                                                                                                                                                                   | ok                                                |
| O31 | R-Prov: `provide` discharges {Ctx} for the components called in its children, and only theirs                                                                          | context.ts:82–94; flow.ts:575–588; h.ts:130–139                                | ctx-t:159–271, 314–391, 672–702                                                                                       | rt:1148, rt:1189; nojsx:167                                                                                                                                                                                                                                         | ok                                                |
| O32 | A provider in the reader's own view does not discharge the reader's setup read                                                                                         | §3.1, §3.4 (P-Ctx)                                                             | ctx-t:272–296                                                                                                         | rt:1127 "a provide in the reader's own view does not give its setup"                                                                                                                                                                                                | ok                                                |
| O33 | A requirement propagates through flow controls, rows and `h` exactly as it resolves at run time                                                                        | flow.ts:84, 90; holes.ts:56–95                                                 | ctx-t:111–158                                                                                                         | obl:520 (`For` row), obl:542 (`Show` branch), obl:562 (`h` row inside `h(Ctx.provide, …)`), obl:576 (no provider: `NO_PROVIDER`); rt:1085, rt:1148                                                                                                                  | ok                                                |
| O34 | `provide`'s value: a provided value is never _unset_ at run time (S11: `undefined` is unset)                                                                           | context.ts:49–73 (`Exclude<T, undefined>`, `[PROVIDE_UNDEFINED]`); flow.ts:582 | ctx-t:183–220 (value, source, hole); ctx-t:704–751 (undefined refused, call form and `h`; null and a source admitted) | obl:614 (null provided), obl:619 (undefined: refused by the type, read as no provider at run time)                                                                                                                                                                  | ok (F-3 fixed)                                    |
| O35 | R-Bind: a bound handler's ε joins the binding view; its p is w, never pending (D-072, D-075)                                                                           | types.ts:110–114, 659–672; runtime.ts:1499–1517                                | raise-t:499–635, 663–700; nojsx-t:234–240                                                                             | rt:3241, rt:3271                                                                                                                                                                                                                                                    | ok                                                |
| O36 | D-085: an unhandled bound call's failure reaches ↑Errored(bind site); with none, the call rejects                                                                      | runtime.ts:1452–1532, 1625–1655; flow.ts:541–546                               | (as O35)                                                                                                              | rt:3287–3418; nojsx:305; conf error-routing                                                                                                                                                                                                                         | ok                                                |
| O37 | D-085 under an `Errored` whose `catch` excludes the failure: the bind reports it only when an `Errored` in `BOUNDARY`'s chain takes it, and otherwise the call rejects | runtime.ts:1452–1486, 1499–1517, 1632; flow.ts:519, 542                        | —                                                                                                                     | obl:676 (an `Errored` above: it shows the failure), obl:690 (none above: the call rejects, Solid does not halt, a later write updates the DOM), obl:707 (`catch` covers it), obl:714 (no `catch`), obl:728 (the nearest that covers it), obl:754 (a crash: rejects) | ok (§6.3 F-7, fixed)                              |
| O38 | R-Call: `yield* h(x̄)` joins call(p, a, ε); a failure is thrown at the `yield*`                                                                                         | types.ts:92–101, 637–645; runtime.ts:1625–1655                                 | jsx:881–931                                                                                                           | rt:1277, rt:1296, rt:1347, rt:1375                                                                                                                                                                                                                                  | ok                                                |
| O39 | R-Attempt (promise / sync): transform raises R_H, absorb removes the failure and adds `undefined` or V                                                                 | runtime.ts:676–753, 781–921                                                    | raise-t:193–282                                                                                                       | raise:452–556; rt:1558, rt:1599                                                                                                                                                                                                                                     | ok                                                |
| O40 | R-Attempt over an event call: `Caught` is exact; an unbranded failure goes past the handler (D-077, D-087)                                                             | runtime.ts:695–706, 824, 127–143                                               | raise-t:898–990                                                                                                       | raise:557–783 (669, 698, 730)                                                                                                                                                                                                                                       | ok                                                |
| O41 | R-Effect, R-Settled: either half's failure joins the component (D-073); a compute's wait holds no boundary (D-090)                                                     | runtime.ts:1348–1396                                                           | raise-t:167–240, 371–470, 1088–1115                                                                                   | raise:416 (both phases); raise host "$settled"; rt:392 (D-090)                                                                                                                                                                                                      | ok                                                |
| O42 | R-Root: the four renderers take a settled root requiring nothing; a failure re-throws (D-033, D-099)                                                                   | render.ts:36–121                                                               | root-t:37–61; jsx:315–325, 1434; ctx-t:297–312; nojsx-t:87–96                                                         | rt:1435 "a failing view with no Errored re-throws (D-033)"; raise:377; thunk:149–190; ssr:334–372                                                                                                                                                                   | ok                                                |
| O43 | R-Foreign: a handed-over component fails with nothing and requires nothing (D-088)                                                                                     | foreign.ts:41–65                                                               | raise-t:1116–1175; ctx-t:305                                                                                          | — (the identity; the twins' routes)                                                                                                                                                                                                                                 | ok                                                |
| O44 | R-Lazy: pending while its chunk loads, otherwise the loaded component's colors (D-047)                                                                                 | lazy.ts:52–62, 81–148; runtime.ts:1923–1933                                            | jsx:834–875                                                                                                           | rt:2303, rt:2245                                                                                                                                                                                                                                                    | ok                                                |
| O45 | A lazy component's chunk-load failure is `ChunkError` (D-100): it reaches the nearest `Errored` above the call that takes it, or is re-thrown (D-033) | lazy.ts:21–36, 52–62, 81–148; runtime.ts:1480 (`takes`) | raise-t:1179–1236; jsx:835–870; root-t:63–66 | obl:800 (an `Errored` above: a kinded, branded `ChunkError`, `cause` the rejection; development and production), obl:827 (`specifier`), obl:840 (`catch: [ChunkError]`, past one that lists another class), obl:865 (a reset loads again), obl:894 (none: re-thrown as an uncaught `ChunkError`, the call renders nothing, the fallback goes, no halt, a later write updates the DOM), obl:934 (only an excluding `catch`: as none); ssr:375 | ok (§6.3 F-2, fixed) |
| O46 | R-Elem: only settled views are elements; an unyielded call in a fragment is refused (D-086)                                                                            | element.ts:36–49; jsx/jsx-runtime.d.ts                                         | jsx:239, 1473–1526                                                                                                    | —(static only)                                                                                                                                                                                                                                                      | ok                                                |
| O47 | Lazy children and fallbacks are built inside their control (D-066, D-094), so their routes are the control's                                                           | flow.ts:132–176, 345–397                                                       | jsx:1527–1624                                                                                                         | rt:2391, rt:2432, rt:2476, rt:2821 BOUNDARY_CONTENT_BUILT; conf loading-fallback-hydration                                                                                                                                                                          | ok                                                |
| O48 | Context resolves at creation: a setup's read resolves from the calling hole (D-097, D-098)                                                                             | runtime.ts:1425–1444, 1739–1746, 1836                                          | ctx-t:272–296                                                                                                         | rt:1052, rt:1073, rt:1127, rt:2567                                                                                                                                                                                                                                  | ok                                                |
| O49 | `h`'s `Created`: a component called directly in `h`'s arguments is not discharged by a provider in the same expression                                                 | types.ts:278–280; holes.ts:70, 94; h.ts:130–139                                | ctx-t:682–702                                                                                                         | obl:847 (`Reader()` in the arguments: `NO_PROVIDER`), obl:861 (`h(Reader, {})`: inside the provider)                                                                                                                                                                | ok                                                |
| O50 | Receipts: every write is a delegated receipt in a host that admits wr (D-021, D-028)                                                                                   | runtime.ts:941–996                                                             | jsx:120, 131                                                                                                          | rt:743, rt:819, rt:846, rt:865                                                                                                                                                                                                                                      | ok                                                |
| O51 | Events are independent runs, each one transaction (D-064, D-081)                                                                                                       | runtime.ts:1603–1665                                                           | —                                                                                                                     | rt:1410, rt:1247, rt:881; conf async-event                                                                                                                                                                                                                          | ok                                                |
| O52 | `KindCheck` (D-034) at every entry point of a failure type                                                                                                             | types.ts:748–763, 414–420; runtime.ts:850–856, 930                             | jsx:1063–1134, 1351–1355                                                                                              | —(static only)                                                                                                                                                                                                                                                      | ok                                                |

**Count.** 52 obligations, none without evidence. One is violated by the runtime as tested:

```
O14  $settled admits a pending read; when one pends, the body runs again from its start when the source lands (F-6).
```

---

## 6. Known unsoundness and limits of the encoding

### 6.1 Model rules (deliberate; not defects)

These are what the model says. A proof states them as part of the semantics, not as exceptions.

- **w is not a color** (D-075). No runtime support and no boundary: a lint warning.
- **Permission, not duty** (D-040). A declared color creates no obligation. Pending reaches a `Loading` and a failure an `Errored` wherever they are.
- **An effect holds no boundary** (D-090). Its compute's wait is silent, so `Create` has no p.
- **A provider in its reader's own view is ineffective** (D-098). This is Solid's resolution, at creation.
- **No implicit root boundary** (D-033). A failure with no `Errored` re-throws. The root must be settled (D-099): a pending app is wrapped, `Loading({ children: App })`, and the stream is not held (D-099 amended).
- **Foreign edges handle their own failures** (D-088). Pending may cross, through the app's `Loading`.
- **Streams** are consumed by reactive routines only, and their handlers are plain (D-091).
- **Superseded memo runs** run to completion (D-080). **Events** are independent runs and one transaction each (D-064, D-081).
- **Server read order** (D-084): holes before children.
- **Crashes are not failures** (D-019, D-087). An untyped throw routes but has no color.

### 6.2 TypeScript limitations (the encoding; not the model)

| #   | Limitation                                                                                                                                                                                                                                                                                                                                                                                                                                              | Effect on §4                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| T1  | **Generic in type parameters or in the props literal, not both.** TypeScript passes a generic argument's type parameters on only into a result with one non-generic call signature (D-029, D-068). A generic setup therefore takes `component`'s plain overload, and its hole props carry no requirement: such a program is refused, and the user provides inside the hole. The same holds for `lazy` and `h(C, props)` through `PlainCall`.            | Incompleteness: safe programs are refused. Not unsound.                                      |
| T2  | **Same-name, same-type contexts.** A requirement's identity is (name, value type): TypeScript cannot mint a fresh type per call. Two contexts given the same name and value type are one requirement, so a provider of one discharges the other in the types while the runtime throws `NO_PROVIDER`.                                                                                                                                                    | **Unsound for (c)**; excluded by C2.                                                         |
| T3  | **D-051: the JSX no-body rule is not type-level.** A `yield*` in JSX and one in a statement are typed alike, and the former is how a JSX view's color is its holes'. A top-level read is `READ_IN_VIEW` (development) and `no-read-in-view-body` (lint). Its color _is_ in the view's type, so (a)–(c) hold. In production the read subscribes the calling hole, which re-creates the component on change: a semantic difference the colors do not see. | Structural rule outside the types; excluded by C3.                                           |
| T4  | **Structural `Exclude` against nominal `instanceof`** (D-034). `Errored`'s `catch` and an `attempt`'s typed handler remove classes by shape, while the runtime matches by prototype. A literal `kind` makes shapes distinct, but nothing stops two classes declaring the same `kind`. Then `catch: [A]` erases B from the type while the runtime re-throws B.                                                                                           | **Unsound for (a)**; excluded by C2 (one kind per class).                                    |
| T5  | **Fragments are checked only with `jsxFactory` / `jsxFragmentFactory`** (D-086, D-093). Without them a fragment's children are `any`, and an unyielded call drops its colors.                                                                                                                                                                                                                                                                           | Unsound without C1's options; `require-jsx-factory` warns, `component-call-yielded` reports. |
| T6  | **`h(GenericComp, props)` erases type parameters** to their constraints (D-029).                                                                                                                                                                                                                                                                                                                                                                        | Over-statement (X5).                                                                         |
| T7  | **Error locality.** TypeScript does not check a `yield*` operand against a contextual yield type, so a view's mistake is reported at `view(` (D-054, D-089) and a setup's at `component(`, where the second overload repeats it (D-098 amended).                                                                                                                                                                                                        | Diagnostics only.                                                                            |
| T8  | **Messages cannot name the component or the variable** (`[SETTLED_PROP]`, `[FOREIGN_HANDOFF]`, `[NO_PROVIDER]` print the prop, the kinds or the context's name).                                                                                                                                                                                                                                                                                        | Diagnostics only.                                                                            |
| T9  | **A generator `Errored` fallback's parameters are not inferred** (overload inference); they are annotated.                                                                                                                                                                                                                                                                                                                                              | Ergonomics only.                                                                             |
| T10 | **Phantoms are erasable.** `any`, a cast or `@ts-expect-error` removes any color.                                                                                                                                                                                                                                                                                                                                                                       | Excluded by C2.                                                                              |
| T11 | **A component's type cannot say what it provides to its holes.** The fold has no "provides" component, so the D-098 amended conservative case is refused (X3).                                                                                                                                                                                                                                                                                          | Over-statement / incompleteness (X3).                                                        |

The reference's §7 also lists runtime detections that a compiler would make statically (a row routine recognized by its function kind, `READ_IN_VIEW` at run time) and the costs of the userland route. They are not soundness limits.

### 6.3 Implementation findings while formalising (contradictions with the rules)

- **F-1: `Errored`'s render-function and content fallbacks drop their colors in the call form** (D-071 under-statement). **Fixed:** the call form's overloads read every fallback form with `Ops<F>`, as `Loading`'s do. `h`'s `Loading` / `Errored` overloads now match a phantom `[BOUNDARY_KIND]` instead of `typeof Loading`: comparing the two overload sets was TS2589 in the `h` twins once the colors were carried. Evidence: O28, O29. As found (sites at `23a329c`): in `flow.ts:442–447` and 480–511, `FallbackYields⟨F⟩` reads only a zero-arity generator, and the docstring says so ("Only a lazy view's colors are carried"). Yet `ErroredFallback` accepts a render function returning a `View⟨⊤, ε⟩` (`Rendered` includes `View`) and content including colored `h` output. At run time such a fallback's pending reads and failures go to the boundary above, as D-072's note and the `Errored` docstring (458–460) say. The `h` overloads (`h.ts:106–125`) do carry them (`OpsOfHole⟨R⟩`, `OpsOfHole⟨F⟩`), so the two flavours disagree.

  Probe (tsc against the package's tsconfig): `Errored({ fallback: (_e, _r) => Bad({ s: pendingFailing }), children })` and `Errored({ fallback: h("p", null, pendingFailing), children })` both type as ⟨⊥, never⟩, whereas `Loading({ fallback: h("p", null, pendingFailing), … })` carries `ApiError`.

- **F-2: a `lazy` component's chunk-load failure is in no type.** **Fixed (D-100):** `lazy` is colored `ChunkError` (`kind: "chunk"`, `cause` the import's rejection, `specifier` the module URL when the build gives one), and the rejection is branded (D-087). It routes like any failure: the nearest `Errored` above the call that takes it (a `catch` listing `ChunkError`, or none), else re-thrown (D-033). On the client, Solid would route the rejection from the pending memo by the owner graph, where nothing above the call can decline it, so the failed import resolves to a component rendered in the call's place that asks the `Errored` chain above the call (the bind site's `BOUNDARY`, F-7): it throws the `ChunkError` into one that takes it, and with none re-throws it out of band and renders nothing; the `Loading`'s fallback goes and Solid does not halt. A re-run of the failed call (an `Errored`'s reset) loads again, as Solid's `lazy` forgets a rejected import. On the server, Solid's `lazy` route is unchanged (a `Loading` above contains it in its fragment). Evidence: O45. As found (sites at `53b664a`): `LazyComponent` (`lazy.ts:24–29`) gave ε = the loaded component's. A rejected `import()` reaches the nearest `Errored`, or is re-thrown, through Solid's `lazy` **[S3, S4]**. It is not branded, so by C7 it is a crash. But it is not a program bug, and D-071 says a failure the runtime routes is in the type. This needs a ruling: a typed `ChunkError` color on `lazy`, or a statement that chunk failures are crashes.

  The route today (obl:781, 811; development and production alike) is not quite the one above. With an `Errored` above, the import's own `Error` reaches it (unbranded, no `kind`). With none, nothing is re-thrown out of `render` or `flush` (S4 does not hold here): the `Loading`'s fallback stays, Solid logs `[REACTIVITY_HALTED]` and stops processing updates, and the import's rejection is unhandled.

- **F-3: `provide({ value: undefined })` discharges a requirement the runtime then reports missing** (violates (c)). **Fixed:** `ProvidedValue⟨T⟩` excludes `undefined` from the value (a source or a hole is still admitted whatever it reads: Solid holds the source, which is set), and, when the context's type admits `undefined`, its expected type prints `[PROVIDE_UNDEFINED] a provided undefined reads as no provider: provide null, or a source`. A context that may carry nothing models it inside the value. Evidence: O34. As found (sites at `23a329c`): `ProvidedValue⟨T⟩` (`context.ts:50–55`) accepts `undefined` when `T` includes it, and `provideView` passes it on (`flow.ts:577`). Solid's provider stores `undefined`, and `getContext` treats `undefined` as unset: it falls back to the default, then throws `ContextNotFoundError` (`@solidjs/signals` `getContext`; `solid-js` `createContext`) **[S11]**. `readContext` turns that into `NO_PROVIDER` in development (`runtime.ts:1436`).

  Probe: `createContext<string | undefined, "MaybeUser">()`, `MaybeUser.provide({ value: undefined, children })` around a reader, and `render(App, el)` type-checks, while the same reader without the provider is refused `[NO_PROVIDER] … "MaybeUser"`. For a context with a default, a provided `undefined` reads the default rather than `undefined`.

- **F-4 (comment): `renderToStream`'s docstring contradicts D-099 as amended.** **Fixed** (the docstring says the stream is not held). As found: `render.ts:111–115` says a fallback-less root `Loading` "holds [the response] as Solid holds a pending root's". D-099's amendment and §7 of the reference record that the stream is **not** held: the shell is sent with the boundary's placeholder.
- **F-5 (comment): "the setup runs once, under the component's owner"** (`runtime.ts:1771`). **Fixed** ("in the hole that calls it (`component` creates no owner)"). `component` creates no owner. The setup runs in the calling hole's owner (§3.1), and D-073's "the `Errored` above the component" and D-098's "resolved where that component was created" both depend on that. This is not a contradiction of a rule, only of the comment.
- **F-6: a `$settled` body that reads a pending source runs more than once** (O14; contradicts S9 and §3.2's "once"). `$settled` admits rd(p, ·) for any p (`EffectOp`, `types.ts:207–213`), where the effect phase refuses one (D-083). When the source is pending because something else waits for it (a view under a `Loading`), Solid's `onSettled` fires only after it lands, and the body runs once with the value (obl:131). When nothing else waits for it (a memo no view reads yet), `onSettled` fires at once. The read throws `NotReadyError` out of the body (`drive` cannot wait in `SETTLED`), no boundary is told and nothing is logged. Solid then re-runs the callback when the source lands, so the body runs again **from its start**: everything before the read (a write, a call) happens twice (obl:160). Either the type refuses a pending read in `$settled` (rd(⊥, ·), as the effect phase), or the model states the re-run (a `$settled` is an effect that waits, not "once"). Not fixed: a ruling.
- **F-7: an unhandled bound call under an `Errored` that does not catch its failure, with no `Errored` above, halts Solid instead of rejecting** (O37; contradicted D-085 and §3.4). **Fixed:** `BOUNDARY`'s value is the boundary itself: its `catch` list (`null` when it has none: it takes every failure) and the `Errored` above it (`runtime.ts:1452–1486`; `Errored` builds it as it is created, `flow.ts:519`, and provides it to its children, 542). At the failure, the bind wrapper's route walks that chain from the nearest: when some boundary takes the failure (no `catch`, or an `instanceof` match against a listed class), it is reported at the bind site as before (`reportError`), and Solid's own propagation passes it through the boundaries below that one, whose fallback getters re-throw it; when none takes it, the route declines and the call's promise rejects, exactly as with no `Errored` above, so nothing leaves Solid's flush (`runtime.ts:1499–1517`, 1632). The brand (D-087) is untouched: the chain is asked about the failure as thrown. Evidence: obl:690 (none above: the call rejects, no uncaught error, no `[REACTIVITY_HALTED]`, a later write updates the DOM; development and production), obl:754 (a crash, which no class covers: rejects), obl:707 (the `catch` covers it: shown, the call resolves), obl:714 (no `catch`: shown), obl:728 (the nearest that covers it, past one that does not and under one that would), obl:676 (another `Errored` above: it shows there, unchanged). As found (sites at `6046ce5`): `bindEvent` routed a failure to `reportError(owner)` whenever `BOUNDARY` was true, and `BOUNDARY` was true under _any_ `Errored` (`runtime.ts:1469–1486`, `flow.ts:536–541`). The `Errored`'s `catch` (`flow.ts:528–533`) re-threw the class it did not list, and with nothing above it the throw left Solid's scheduled flush as an uncaught exception, Solid logged `[REACTIVITY_HALTED]` and stopped all updates, and the call's promise **resolved** `undefined`. The types were not wrong: the view's ε keeps the class, so `render` admits it as a root failure (D-033).

---

## 7. What the compiler route must preserve

The compiler route (v0.2: the same model lowered by a compiler, as on `experiment/iterable-signals`) may change everything §3 says about _how_: owner shapes, hydration keys (D-074), hole granularity, the interpreter, the run-time detections. It must preserve this document's **§4 theorem** with the same static semantics (§2: the ops, the folds, the discharge table) and the same positions (§4.2).

1. A pending read suspends to the nearest `Loading` above the read, never because of a call (D-075) or an effect (D-090).
2. A typed failure reaches the nearest `Errored` above the read, above the bind (D-085) or above the calling site for an effect (D-073), or re-throws at the root (D-033).
3. A context resolves where the reading component is created, and a provider gives what is created under it (D-098).
4. Rows route as their list (D-059, D-063).

The obligations of §5 are the compiler's conformance suite. Where the userland route needed a run-time detection (§6.2 T3, a row recognized by its function kind) the compiler should make it static. The gaps and findings of §5 / §6.3 should be closed in the model before they are copied into a second route.
