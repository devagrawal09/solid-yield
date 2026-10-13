import YieldProofs

/- Sugar mode: native plain Solid lowered to yield routines. These are the
   obligations its lowering adds to the λ-yield core, stated in the same
   abstract model (YieldProofs). They check the rules the lowering relies on,
   not the compiler: ../sugar.md maps each theorem to its lowering, its tests
   and the premises the implementation must establish. -/
namespace Yield
namespace Sugar

/-! ## Writes (F-S40, `nativeWrite`)

Only an event or an effect's phase writes. A callback prop whose body writes
must be hosted by the event that calls it: the hole that creates it refuses
the write. -/

theorem write_admitted_iff (h : Host) : Admits h .write ↔ h = .phase ∨ h = .event := by
  cases h <;> simp [Admits]

/-- F-S40: a routine that writes is admitted only as an event or an effect phase. -/
theorem writing_routine_host {h ops} (hosted : WellHosted h ops) (w : Op.write ∈ ops) :
    h = .phase ∨ h = .event :=
  (write_admitted_iff h).mp (hosted _ w)

theorem hole_refuses_write {ops} (w : Op.write ∈ ops) : ¬ WellHosted .hole ops := by
  intro h; have := h _ w; simp [Admits] at this
theorem view_refuses_write {ops} (w : Op.write ∈ ops) : ¬ WellHosted .view ops := by
  intro h; have := h _ w; simp [Admits] at this

/-- The runtime host of a lexical callback: an event-phase callback runs in its
    caller's event when an event calls it, otherwise where it was created. -/
def runsAs (eventPhase : Bool) (created caller : Host) : Host :=
  if eventPhase = true ∧ caller = .event then .event else created

/-- An event-phase callback typed against the event's operations is admitted
    wherever it was created, once an event calls it. -/
theorem event_phase_runs_in_caller {ops created} (typed : WellHosted .event ops) :
    WellHosted (runsAs true created .event) ops := by
  simpa [runsAs] using typed

/-- Without that rule, a writing callback created in a view (F-S40's `reload`)
    and called from an event ran as the view, which refuses its write. -/
theorem created_host_refuses {ops} (w : Op.write ∈ ops) :
    ¬ WellHosted (runsAs false .view .event) ops := by
  simpa [runsAs] using view_refuses_write w

/-- A receipt is a deferred write: calling a library setter returns one and
    writes nothing; delegating to it (`yield*`) performs it. -/
structure Receipt (S : Type) where
  write : S → S

def delegate {S} (r : Receipt S) (s : S) : S := r.write s

/-- What a plain function type's caller does with the setter's result: nothing. -/
def plainCall {S A} (_setter : A → Receipt S) : A → S → S := fun _ s => s

/-- `nativeWrite setter`: the plain function the author's type expects. -/
def nativeWrite {S A} (setter : A → Receipt S) : A → S → S := fun a s => delegate (setter a) s

/-- A setter handed to a plain function type writes nothing (UNYIELDED_WRITE). -/
theorem plain_call_drops {S A} (setter : A → Receipt S) (a : A) (s : S) :
    plainCall setter a s = s := rfl

/-- `nativeWrite` performs exactly the write the setter's receipt describes. -/
theorem native_write_writes {S A} (setter : A → Receipt S) (a : A) (s : S) :
    nativeWrite setter a s = (setter a).write s := rfl

/-! ## Context hooks (F-S37)

Solid 2's provider sets its value once and `useContext` returns it, so the
value a consumer holds satisfies the context's declared type. `useContext`
throws first when no provider is above: that is the context's requirement. -/

/-- A guard `if (!value) throw …` never fires on a provided value whose
    declared type admits no falsy member. -/
theorem guard_never_fires {V} {T falsy : V → Prop} (narrowed : ∀ v, T v → ¬ falsy v)
    {v} (provided : T v) : ¬ falsy v :=
  narrowed v provided

/-- The hook's operations: the context read, and the guard's raise only when
    the declared type admits a falsy value. -/
def hookOps (admitsFalsy : Bool) (q : List Requirement) (ks : List Nat) : List Op :=
  if admitsFalsy then [.context q, .raise ks] else [.context q]

theorem hook_in_setup (q : List Requirement) (ks : List Nat) :
    WellHosted .setup (hookOps false q ks) := by
  intro o h; simp [hookOps] at h; subst h; simp [Admits]

theorem nullable_hook_refused (q : List Requirement) (k : Nat) (ks : List Nat) :
    ¬ WellHosted .setup (hookOps true q (k :: ks)) := by
  intro h; have := h (.raise (k :: ks)) (by simp [hookOps]); simp [Admits] at this

/-- The hook's requirement is routed to a provider in any accepted root. -/
theorem hook_requirement_provided {t path qs q} (ok : RootOK t)
    (loc : Located t path (.context qs)) (hq : q ∈ qs) : route path (.need q) ≠ none :=
  root_no_missing_context ok loc (.context hq)

/-! ## Props carry their callers' colors (D-119)

Solid reads a prop lazily, inside the child. The lowering types a plain prop
with the color its callers pass (`Source<T, E, P>`), so a read of it is a
`child c` operation at the child's own site. -/

/-- Replace every prop read's color. -/
def mapChild (g : Color → Color) : Term → Term
  | .atom (.child c) => .atom (.child (g c))
  | .atom o => .atom o
  | .both l r => .both (mapChild g l) (mapChild g r)
  | .scope f t => .scope f (mapChild g t)

/-- Widening props to their callers' colors only widens what a call reports. -/
theorem widen_monotone {g : Color → Color} (wide : ∀ c, below c (g c)) (t : Term) :
    below (color t) (color (mapChild g t)) := by
  induction t with
  | atom o => cases o <;> first | exact wide _ | exact below_refl _
  | both l r ihl ihr =>
    intro e h
    rcases h with h | h
    · exact .inl (ihl e h)
    · exact .inr (ihr e h)
  | scope f t ih => exact remove_monotone ih f

/-- A passed observation the child's own boundaries handle never reaches the
    caller (the dashboard's `Panel`). -/
theorem prop_handled_by_child {path : List Frame} {e : Effect}
    (f : Frame) (hf : f ∈ path) (hit : Handles f e) : route path e ≠ none := by
  intro hn; exact (route_none_iff path e).mp hn f hf hit

/-- One it does not handle is in the call's color: the callers' boundaries
    must cover it, and a root refuses it otherwise. -/
theorem prop_escapes_in_color {t path c e} (loc : Located t path (.child c)) (fires : c e)
    (hm : e ≠ .marker) (unhandled : route path e = none) : color t e :=
  owner_preservation loc (.child fires hm) unhandled

/-- Typing a passed pending value as settled (no widening) would lose it. -/
theorem settled_prop_unsound :
    ∃ (t : Term) (c : Color), Emits (mapChild (fun _ => c) t) .pending ∧
      ¬ color (mapChild (fun _ => bottom) t) .pending := by
  refine ⟨.atom (.child bottom), fun e => e = .pending, ?_, ?_⟩
  · exact .atom (.child rfl (by simp))
  · intro h; exact h

/-! ## Foreign routers (F-S43)

A route component is rendered by the foreign router wherever the router is
rendered. The lowering discharges only the contexts provided around every
render of the router. -/

/-- The contexts the frames on a path provide. -/
def providedOn (path : List Frame) (n : Nat) : Prop := ∃ f ∈ path, Handles f (.need (.live n))

/-- The lowering's witness: contexts provided on every render path. -/
def everyRender (paths : List (List Frame)) (n : Nat) : Prop := ∀ p ∈ paths, providedOn p n

theorem every_render_provided {paths p} (hp : p ∈ paths) : ProvidedAt (everyRender paths) p :=
  fun _ hn => hn p hp

/-- A route component checked against the intersection has each requirement
    routed to a provider at every render of its router. -/
theorem foreign_router_sound {t paths p q}
    (ok : ForeignCheck (color t) (everyRender paths)) (hp : p ∈ paths)
    (run : Emits t (.need q)) : route p (.need q) ≠ none :=
  foreign_context ok (every_render_provided hp) run

/-- A union across renders would be unsound: one render without the provider
    lets the requirement escape. -/
theorem render_union_unsound :
    ∃ (paths : List (List Frame)) (p : List Frame) (n : Nat),
      p ∈ paths ∧ (∃ p' ∈ paths, providedOn p' n) ∧ route p (.need (.live n)) = none := by
  refine ⟨[[.provider 0 7], []], [], 7, by simp, ⟨[.provider 0 7], by simp, ?_⟩, by simp [route]⟩
  exact ⟨.provider 0 7, by simp, by simp [Handles]⟩

/-! ## Context members (F-S45)

A call through a member of a context's value calls what the provider above put
there. The inference unions the member's failures over every provider's value
and the context's default; a context that escapes is unknown. -/

/-- Sound when every value the context can hold is among those collected. -/
theorem context_member_sound {P V : Type} {values : List P}
    {member inferred : P → Inference.Failures V}
    (each : ∀ p ∈ values, Inference.le (member p) (inferred p)) {held : P} (h : held ∈ values) :
    Inference.le (member held) (fun v => ∃ p ∈ values, inferred p v) :=
  fun v hv => ⟨held, h, each held h v hv⟩

/-- A held value outside the collection (a provider the inference missed, or an
    escaping context) can fail outside the union: hence unknown there. -/
theorem missed_provider_unsound :
    ∃ (values : List Bool) (member : Bool → Inference.Failures Nat) (held : Bool) (v : Nat),
      held ∉ values ∧ member held v ∧ ¬ ∃ p ∈ values, member p v := by
  refine ⟨[false], fun p v => p = true ∧ v = 0, true, 0, by simp, ⟨rfl, rfl⟩, ?_⟩
  rintro ⟨p, hp, h, _⟩; simp at hp; subst hp; cases h

theorem escaping_context_unknown {V : Type} (actual : Inference.Failures V) :
    Inference.le actual Inference.unknown :=
  Inference.below_unknown actual

/-! ## Callback colors (F-S46)

An array method's callback runs in its host, so its operations are the host's.
The lowering delegates them (`yield*`), folding them into the host's color. In
a hole, a raise is presented as the hole's failing read (`nativeHoleColors`). -/

/-- With delegation, every observation the callback makes is in the host's color. -/
theorem delegated_callback_colored {host callback : List Op} {o : Op} {e : Effect}
    (member : o ∈ callback) (step : Fires o e) : fold (host ++ callback) e := by
  rw [fold_append]; exact .inr (fold_member member e (primitive_preservation step))

/-- Without it, a failing read in the callback escapes the host's color. -/
theorem undelegated_callback_unsound :
    ∃ (host callback : List Op) (o : Op) (e : Effect),
      o ∈ callback ∧ Fires o e ∧ ¬ fold host e := by
  refine ⟨[], [.read false [3]], .read false [3], .failure 3, by simp, .readFailure (by simp), ?_⟩
  rintro ⟨o, h, _⟩; simp at h

/-- A raise has exactly the color of a settled read failing with the same failures. -/
theorem hole_raise_as_read (ks : List Nat) (x : Effect) :
    opColor (.raise ks) x ↔ opColor (.read false ks) x := by
  cases x <;> simp [opColor, parts]

/-! ## Requirements through generic wrappers (F-S49)

D-119 makes a wrapper with its own boundaries generic, and a generic setup's
plain call reports nothing its hole props require (D-098 amended). The hole
runs inside the wrapper's frames. The lowering gives the call a requirement
parameter inferred from its holes (`HoleQ`), so the call's color carries them. -/

/-- The wrapper's subtree: its hole under the wrapper's own frames. -/
def wrapped (frames : List Frame) (hole : Term) : Term := frames.foldr Term.scope hole

/-- A need the wrapper's subtree emits from its hole is one the hole emits. -/
theorem wrapped_need {frames hole q} (run : Emits (wrapped frames hole) (.need q)) :
    Emits hole (.need q) := by
  induction frames with
  | nil => exact run
  | cons f fs ih =>
    simp only [wrapped, List.foldr] at run
    exact ih (discharge.mp run).1

/-- The call's color with the requirement parameter: the wrapper's own color
    joined with its hole's requirements. -/
def withHoleQ (base : Color) (hole : Term) : Color :=
  join base (fun e => ∃ q, e = .need q ∧ color hole e)

/-- Every need the wrapper's subtree emits is in the call's color, so the child
    interface (`Fires.child`) holds for requirements and the caller's
    providers or root see each one. -/
theorem hole_requirement_carried {base frames hole q}
    (run : Emits (wrapped frames hole) (.need q)) : withHoleQ base hole (.need q) :=
  .inr ⟨q, rfl, preservation (wrapped_need run)⟩

/-- Without the parameter the plain call reports no hole requirement
    (`bottom`), yet a hole under an `Errored` (the seed's `Panel`) still emits
    its need: the reported color would break the child interface. -/
theorem dropped_requirement_unsound :
    ∃ (frames : List Frame) (hole : Term) (q : Requirement),
      Emits (wrapped frames hole) (.need q) ∧ ¬ bottom (.need q) := by
  refine ⟨[.errored 0 (fun _ => True)], .atom (.context [.live 7]), .live 7, ?_, fun h => h⟩
  show Emits (.scope (.errored 0 (fun _ => True)) (.atom (.context [.live 7]))) (.need (.live 7))
  exact .pass (.atom (.context (by simp))) (by simp [Handles])

/-! ## Effect cleanup (F-S42)

An effect function's returned cleanup registers through `onCleanup`, which runs
before the effect's next run and at disposal. `trace n` is the observable order
for `n` runs followed by disposal. -/

inductive Ev where
  | run (i : Nat)
  | clean (i : Nat)
  deriving DecidableEq

def trace : Nat → List Ev
  | 0 => []
  | n + 1 => trace n ++ [.run n, .clean n]

theorem clean_mem_iff (n i : Nat) : Ev.clean i ∈ trace n ↔ i < n := by
  induction n with
  | zero => simp [trace]
  | succ n ih => simp [trace, ih] <;> omega

theorem run_mem_iff (n i : Nat) : Ev.run i ∈ trace n ↔ i < n := by
  induction n with
  | zero => simp [trace]
  | succ n ih => simp [trace, ih] <;> omega

/-- Each run's cleanup comes right after it, before the next run. -/
theorem clean_before_next_run (n : Nat) :
    ∃ pre, trace (n + 1 + 1) = pre ++ [.run n, .clean n, .run (n + 1), .clean (n + 1)] :=
  ⟨trace n, by simp [trace]⟩

/-- Ignoring the returned cleanup (the gap F-S42 fixed) runs none of them. -/
def traceIgnoring : Nat → List Ev
  | 0 => []
  | n + 1 => traceIgnoring n ++ [.run n]

theorem ignoring_never_cleans (n i : Nat) : Ev.clean i ∉ traceIgnoring n := by
  induction n with
  | zero => simp [traceIgnoring]
  | succ n ih => simp [traceIgnoring, ih]

/-! ## Props through `lazy` (D-119 with F-S51)

`LazyComponent<T>` drops a page's type parameters, so a lazy page's widened
props cannot be generic per call. They take the union of the colors every
caller passes. -/

/-- The colors every collected caller passes, joined. -/
def callersColor (callers : List Color) : Color := fun e => ∃ c ∈ callers, c e

/-- Each collected caller's color is below the union, so S5's results apply to
    the union in place of the per-call color. -/
theorem lazy_union_bounds {callers : List Color} {c : Color} (h : c ∈ callers) :
    below c (callersColor callers) := fun _ he => ⟨c, h, he⟩

/-- A caller the collection missed can pass what the union lacks. -/
theorem missed_caller_unsound :
    ∃ (callers : List Color) (c : Color) (e : Effect),
      c ∉ callers ∧ c e ∧ ¬ callersColor callers e := by
  refine ⟨[], fun e => e = .pending, .pending, by simp, rfl, ?_⟩
  intro h; simp [callersColor] at h

/-! ## Context facades (F-S52)

A context's value declared with plain function types (`() => string`) holds,
lowered, a source or a routine. The lowering retypes such a slot to the
provided value's type, and TypeScript checks every provider's value against
the retyped context. -/

/-- With every provider's value checked against the slot, the slot's color
    bounds the held value's. -/
theorem facade_bounds_held {values : List Color} {slot held : Color}
    (checked : ∀ c ∈ values, below c slot) (h : held ∈ values) : below held slot :=
  checked held h

/-- Left as the declared plain function type, the slot reports no color while
    the held source may be pending. -/
theorem plain_slot_unsound : ∃ held : Color, held .pending ∧ ¬ bottom .pending :=
  ⟨fun e => e = .pending, rfl, fun h => h⟩

/-! ## Loop-driven generators (F-S53)

An authored generator is opaque to the failure inference: a foreign driver can
`throw()` into it, so it fails `unknown`. A generator called as the iterable
of a `for…of` (or `for await…of`) is driven by that loop alone, through
`next()` and `return()`, and what it raises there is what its own body
raises. -/

inductive Driver where
  | loop
  | foreign

/-- What driving a generator can raise: its body's failures, plus whatever a
    foreign driver injects with `throw()`. A loop injects nothing. -/
def observed {V : Type} (body inject : Inference.Failures V) : Driver → Inference.Failures V
  | .loop => body
  | .foreign => Inference.union body inject

/-- Driven by a loop, the body's failures bound what the generator raises. -/
theorem loop_driven_sound {V : Type} (body inject : Inference.Failures V) :
    Inference.le (observed body inject .loop) body := fun _ h => h

/-- A foreign driver can raise what the body never does: hence `unknown` there. -/
theorem foreign_driver_unsound :
    ∃ (body inject : Inference.Failures Nat) (v : Nat),
      observed body inject .foreign v ∧ ¬ body v :=
  ⟨Inference.empty, fun v => v = 0, 0, Or.inr rfl, fun h => h⟩

theorem foreign_driver_unknown {V : Type} (body inject : Inference.Failures V) :
    Inference.le (observed body inject .foreign) Inference.unknown :=
  Inference.below_unknown _

/-! ## Root renderers (F-S53)

The inference gives `render`, `hydrate`, `renderToString` and `renderToStream`
no failures of their own, so an entry function that renders stays plain. A
render raises its arguments' failures and whatever its root leaves unhandled.
The root is checked where it is rendered: a native root is a foreign handoff,
whose residual failures must be empty. -/

/-- What a render call raises: its arguments' failures and its root's residual ones. -/
def renderRaises {V : Type} (args residual : Inference.Failures V) : Inference.Failures V :=
  Inference.union args residual

/-- With the root's residual failures checked empty, the arguments bound the call. -/
theorem renderer_sound {V : Type} (args residual : Inference.Failures V)
    (checked : Inference.le residual Inference.empty) :
    Inference.le (renderRaises args residual) args := by
  intro v h
  rcases h with h | h
  · exact h
  · exact (checked v h).elim

/-- Unchecked, a root can raise what no argument does. -/
theorem unchecked_root_unsound :
    ∃ (args residual : Inference.Failures Nat) (v : Nat),
      renderRaises args residual v ∧ ¬ args v :=
  ⟨Inference.empty, fun v => v = 0, 0, Or.inr rfl, fun h => h⟩

/-! ## Kept promises (found by mutation)

In an async routine the lowering attempts a call that returns a promise where
the call is made, which awaits it. A promise the code keeps as a value (bound
or passed on, not awaited, returned or discarded) is not awaited there in the
original. A call to an `async` function then stays a plain call, and the
promise is attempted where the code awaits it. That loses no failure: an
`async` function's call raises nothing synchronously, and its rejection is
raised at the await. A function that is not `async` can throw before it
returns its promise, so its call keeps its attempt. -/

/-- A call that returns a promise: what making it raises, and what awaiting
    its promise raises. -/
structure PromiseCall (V : Type) where
  made : Inference.Failures V
  awaited : Inference.Failures V

/-- An `async` callee raises nothing where it is called. -/
def PromiseCall.fromAsync {V : Type} (c : PromiseCall V) : Prop :=
  Inference.le c.made Inference.empty

/-- What the original raises across the call and the await of its promise. -/
def keptRaises {V : Type} (c : PromiseCall V) : Inference.Failures V :=
  Inference.union c.made c.awaited

/-- What a plain call attempted only at the await accounts for. -/
def attemptedAtAwait {V : Type} (c : PromiseCall V) : Inference.Failures V := c.awaited

/-- An `async` callee's kept promise, attempted where it is awaited, loses no failure. -/
theorem kept_async_sound {V : Type} (c : PromiseCall V) (hasync : c.fromAsync) :
    Inference.le (keptRaises c) (attemptedAtAwait c) := by
  intro v h
  rcases h with h | h
  · exact (hasync v h).elim
  · exact h

/-- A callee that is not `async` can raise where it is called: hence its attempt. -/
theorem kept_sync_unsound :
    ∃ (c : PromiseCall Nat) (v : Nat), keptRaises c v ∧ ¬ attemptedAtAwait c v :=
  ⟨⟨fun v => v = 0, Inference.empty⟩, 0, Or.inl rfl, fun h => h⟩

/-! ## Sagas driven inside an action (D-121)

A generator handed to a function that calls it only inside an `action`'s
generator (Effect's `effectAction`) runs step by step inside that action: the
driver calls `next` and `throw` from the action's body, and Solid's `action`
is the library's `$event`. A setter call in the saga cannot be delegated, since
its `yield*` belongs to the driver; it is performed where it is made, and so
runs in its driver's host. -/

/-- The host a driven saga's code runs in: its driver's. -/
def sagaHost (driver : Host) : Host := driver

/-- Driven inside an action (an event), the saga's writes are admitted. -/
theorem driven_saga_write_admitted : Admits (sagaHost .event) .write :=
  (write_admitted_iff _).mpr (Or.inr rfl)

/-- Driven from a memo, the same write would not be: hence the check that every
    call of the saga is inside the action. -/
theorem memo_driven_saga_refused : ¬ Admits (sagaHost .memo) .write := by
  simp [sagaHost, Admits]

/-! ## A provider's value computed in its own owner (D-122)

Solid computes a provider's value once, in the provider's own owner. The
lowering gives it to the provider as an `init` run there as a setup is: it may
create, clean up and read a context, and it may fail. Its failures are the
provider's: the provider raises what its `init` raises and what its children
raise, for the boundary above. -/

/-- What a provider with an `init` raises. -/
def providerRaises {V : Type} (init children : Inference.Failures V) : Inference.Failures V :=
  Inference.union init children

/-- The init runs as a setup: it may create and clean up. -/
theorem init_admits_cleanup : Admits .setup .cleanup := by simp [Admits]

/-- The provider's color bounds both its init's failures and its children's. -/
theorem provider_bounds {V : Type} (init children : Inference.Failures V) :
    Inference.le init (providerRaises init children) ∧
      Inference.le children (providerRaises init children) :=
  ⟨fun _ h => Or.inl h, fun _ h => Or.inr h⟩

/-- Leaving the init's failures out of the provider's color misses one. -/
theorem init_dropped_unsound :
    ∃ (init children : Inference.Failures Nat) (v : Nat),
      providerRaises init children v ∧ ¬ children v :=
  ⟨fun v => v = 0, Inference.empty, 0, Or.inl rfl, fun h => h⟩

/-! ## A failing call in a JSX hole (2026-10-12)

A view cannot raise: a call that may fail, made in a JSX hole, is the hole's
work. `nativeHole` runs it where the view evaluates the hole and presents what
it raises as a failing read of the view (`HoleViewOp`): the raise becomes a
settled read with the same failures (`hole_raise_as_read`, S9), which the
boundary above takes. -/

/-- `HoleViewOp`: how the view sees a hole's operation. -/
def holeView : Op → Op
  | .raise e => .read false e
  | o => o

/-- What a hole admits, but a stream (whose failures reach its handler), the
    view admits once seen through `holeView`. -/
theorem hole_hosted_in_view {o : Op} (h : Admits .hole o) (hs : o ≠ .stream) :
    Admits .view (holeView o) := by
  cases o <;> simp_all [Admits, holeView]

/-- Without the wrapper the raise is in the view itself, which refuses it: the
    `GENERATED_TYPE` every such call met before. -/
theorem raise_in_view_refused (e : List Nat) : ¬ Admits .view (.raise e) := by
  simp [Admits]

/-! ## A promise given to For (2026-10-12)

Solid's `For` maps its list where it reads it: given a promise, it fails on
it. The lowering's attempt awaits what it attempts, so attempting a call that
returns a promise there would map the resolved list: the model would accept
what the original fails on. The call's value is boxed instead: the attempt
takes what making the call raises, and the list is the promise itself, which
`For`'s type refuses (`[FOR_EACH]`). -/

/-- The boxed attempt raises what making the call raises. -/
def boxedRaises {V : Type} (c : PromiseCall V) : Inference.Failures V := c.made

/-- It loses none of those failures. -/
theorem boxed_keeps_made {V : Type} (c : PromiseCall V) :
    Inference.le c.made (boxedRaises c) := fun _ h => h

/-- The boxed attempt's operations: a raise, no wait. -/
def boxedOps (e : List Nat) : List Op := [.raise e]

theorem boxed_no_wait (e : List Nat) : Op.wait ∉ boxedOps e := by simp [boxedOps]

/-- What `For` is given: the promise itself (boxed), or what awaiting it gives. -/
def forList {P : Type} (resolve : P → P) (boxed : Bool) (p : P) : P :=
  if boxed then p else resolve p

/-- Boxed, it is the original's list. -/
theorem boxed_list_is_original {P : Type} (resolve : P → P) (p : P) :
    forList resolve true p = p := by simp [forList]

/-- Awaited, it is another list wherever the promise is not its own value. -/
theorem awaited_list_unsound : ∃ (resolve : Nat → Nat) (p : Nat), forList resolve false p ≠ p :=
  ⟨fun p => p + 1, 0, by simp [forList]⟩

/-! ## The insertion itself (S20)

Native mode inserts `yield*` at the reads TypeScript types as sources and
leaves every other call plain. On a core of plain Solid expressions, the
lowered routine run by the library's driver computes what Solid's direct
evaluation computes, and its reads are exactly what the result depends on. -/

namespace Insertion

/-- Each source's state: settled with a value, or pending. -/
abbrev Store := Nat → Option Nat

/-- Plain Solid expressions: a literal, a read of what TypeScript types as a
    source (`s()`, a store path), a plain function of a value, a sum, a
    conditional (nonzero is true), a `throw`, and a read of the component's
    `i`-th prop (S21: a getter for the caller's expression). -/
inductive Expr where
  | lit (n : Nat)
  | read (s : Nat)
  | call (f : Nat → Nat) (e : Expr)
  | add (a b : Expr)
  | ite (c t e : Expr)
  | raise (err : Nat)
  | prop (i : Nat)

/-- How an evaluation ends: a value, suspended on a pending source (Solid's
    `NotReadyError`), or failed. -/
inductive Outcome where
  | done (v : Nat)
  | pending (s : Nat)
  | failed (err : Nat)
deriving DecidableEq

/-- Solid's direct evaluation: a source call returns its value and is tracked;
    a pending one is tracked and suspends the computation. The result is the
    outcome and the tracked reads, in order. -/
def eval (σ : Store) : Expr → Outcome × List Nat
  | .lit n => (.done n, [])
  | .read s =>
    match σ s with
    | some v => (.done v, [s])
    | none => (.pending s, [s])
  | .call f e =>
    match eval σ e with
    | (.done v, t) => (.done (f v), t)
    | r => r
  | .add a b =>
    match eval σ a with
    | (.done x, t) =>
      match eval σ b with
      | (.done y, t') => (.done (x + y), t ++ t')
      | (r, t') => (r, t ++ t')
    | r => r
  | .ite c th el =>
    match eval σ c with
    | (.done x, t) =>
      let r := if x ≠ 0 then eval σ th else eval σ el
      (r.1, t ++ r.2)
    | r => r
  | .raise err => (.failed err, [])
  -- a prop no caller gave; a rendered component's props are its caller's
  -- expressions put in place (`subst`, S21)
  | .prop _ => (.done 0, [])

/-- A lowered routine: done, a `yield*` of a source with its continuation, or
    a raise. -/
inductive Prog where
  | ret (v : Nat)
  | read (s : Nat) (k : Nat → Prog)
  | raise (err : Nat)

/-- Generator sequencing. -/
def Prog.bind : Prog → (Nat → Prog) → Prog
  | .ret v, k => k v
  | .read s k', k => .read s (fun v => (k' v).bind k)
  | .raise e, _ => .raise e

/-- The insertion: `yield*` at each source read and nowhere else. -/
def lower : Expr → Prog
  | .lit n => .ret n
  | .read s => .read s .ret
  | .call f e => (lower e).bind (fun v => .ret (f v))
  | .add a b => (lower a).bind (fun x => (lower b).bind (fun y => .ret (x + y)))
  | .ite c th el => (lower c).bind (fun x => if x ≠ 0 then lower th else lower el)
  | .raise err => .raise err
  | .prop _ => .ret 0

/-- The library's driver: a settled read returns the value and tracks the
    source; a pending one tracks it and suspends. -/
def run (σ : Store) : Prog → Outcome × List Nat
  | .ret v => (.done v, [])
  | .read s k =>
    match σ s with
    | some v => ((run σ (k v)).1, s :: (run σ (k v)).2)
    | none => (.pending s, [s])
  | .raise e => (.failed e, [])

/-- Sequencing: run `p`; when it is done, continue with `k` on its value. -/
def seq (r : Outcome × List Nat) (k : Nat → Outcome × List Nat) : Outcome × List Nat :=
  match r with
  | (.done v, t) => ((k v).1, t ++ (k v).2)
  | r => r

theorem run_bind (σ : Store) (p : Prog) (k : Nat → Prog) :
    run σ (p.bind k) = seq (run σ p) (fun v => run σ (k v)) := by
  induction p with
  | ret v => simp [Prog.bind, run, seq]
  | read s k' ih =>
    simp only [Prog.bind, run]
    cases h : σ s with
    | none => simp [seq]
    | some v =>
      simp only [ih v]
      cases run σ (k' v) with
      | mk o t => cases o <;> simp [seq]
  | raise e => simp [Prog.bind, run, seq]

/-- S20: the lowered routine computes what Solid computes: the same value, the
    same reads tracked in the same order, the same suspension and failure. -/
theorem insertion_preserves (σ : Store) (e : Expr) : run σ (lower e) = eval σ e := by
  induction e with
  | lit n => simp [lower, run, eval]
  | read s => cases h : σ s <;> simp [lower, run, eval, h]
  | call f e ih =>
    simp only [lower, run_bind, ih, eval]
    cases eval σ e with
    | mk o t => cases o <;> simp [seq, run]
  | add a b iha ihb =>
    simp only [lower, run_bind, iha, eval]
    cases eval σ a with
    | mk o t =>
      cases o with
      | done x =>
        simp only [seq, ihb]
        cases eval σ b with
        | mk o' t' => cases o' <;> simp [run]
      | pending s => simp [seq]
      | failed err => simp [seq]
  | ite c th el ihc iht ihe =>
    simp only [lower, run_bind, ihc, eval]
    cases eval σ c with
    | mk o t =>
      cases o with
      | done x =>
        simp only [seq]
        by_cases hx : x ≠ 0 <;> simp [hx, iht, ihe]
      | pending s => simp [seq]
      | failed err => simp [seq]
  | raise err => simp [lower, run, eval]
  | prop i => simp [lower, run, eval]

/-- Solid's tracked reads are what an evaluation depends on. -/
theorem eval_depends_on_trace (e : Expr) :
    ∀ σ σ' : Store, (∀ s ∈ (eval σ e).2, σ' s = σ s) → eval σ' e = eval σ e := by
  induction e with
  | lit n => intros; rfl
  | read s =>
    intro σ σ' h
    have hs : σ' s = σ s := h s (by simp only [eval]; cases σ s <;> simp)
    simp only [eval, hs]
  | call f e ih =>
    intro σ σ' h
    have : eval σ' e = eval σ e := ih σ σ' (by
      intro s hs; apply h; simp only [eval]
      cases hr : eval σ e with
      | mk o t => cases o <;> simp_all)
    simp only [eval, this]
  | add a b iha ihb =>
    intro σ σ' h
    have ha : eval σ' a = eval σ a := iha σ σ' (by
      intro s hs; apply h; simp only [eval]
      cases hr : eval σ a with
      | mk o t =>
        cases o with
        | done x =>
          rw [hr] at hs
          cases eval σ b with
          | mk o' t' => cases o' <;> simp_all
        | pending _ => simp_all
        | failed _ => simp_all)
    simp only [eval, ha]
    cases hr : eval σ a with
    | mk o t =>
      cases o with
      | done x =>
        have hb : eval σ' b = eval σ b := ihb σ σ' (by
          intro s hs; apply h; simp only [eval, hr]
          cases hb' : eval σ b with
          | mk o' t' => rw [hb'] at hs; cases o' <;> simp_all)
        simp only [hb]
      | pending _ => rfl
      | failed _ => rfl
  | ite c th el ihc iht ihe =>
    intro σ σ' h
    have hc : eval σ' c = eval σ c := ihc σ σ' (by
      intro s hs; apply h; simp only [eval]
      cases hr : eval σ c with
      | mk o t =>
        cases o with
        | done x => rw [hr] at hs; simp_all
        | pending _ => simp_all
        | failed _ => simp_all)
    simp only [eval, hc]
    cases hr : eval σ c with
    | mk o t =>
      cases o with
      | done x =>
        by_cases hx : x ≠ 0
        · have := iht σ σ' (by
            intro s hs; apply h; simp only [eval, hr]; simp_all)
          simp [hx, this]
        · have := ihe σ σ' (by
            intro s hs; apply h; simp only [eval, hr, hx]; simp_all)
          simp [hx, this]
      | pending _ => rfl
      | failed _ => rfl
  | raise err => intros; rfl
  | prop i => intros; rfl

/-- The reads the lowered routine performs are what its result depends on: a
    store that agrees on them gives the same run, so Solid, which reruns it when
    a tracked source changes, reruns it exactly when it must. -/
theorem lowered_reads_are_dependencies (e : Expr) (σ σ' : Store)
    (agree : ∀ s ∈ (run σ (lower e)).2, σ' s = σ s) :
    run σ' (lower e) = run σ (lower e) := by
  rw [insertion_preserves] at agree
  rw [insertion_preserves, insertion_preserves]
  exact eval_depends_on_trace e σ σ' agree

/-- Why every source read needs its `yield*`: a value read once and kept
    (a snapshot) is not tracked, so a write to its source never reruns it. -/
theorem snapshot_untracked (σ : Store) (s v : Nat) (settled : σ s = some v) :
    run σ (.ret v) = (.done v, []) ∧ eval σ (.read s) = (.done v, [s]) := by
  simp [run, eval, settled]


/-! ### Props are getters (S21, D-119)

A prop read in the child is a read of the caller's expression, where the child
reads it: the caller passes a getter, not a value. -/

/-- The caller's expressions put where the child reads its props. -/
def subst (args : Nat → Expr) : Expr → Expr
  | .lit n => .lit n
  | .read s => .read s
  | .call f e => .call f (subst args e)
  | .add a b => .add (subst args a) (subst args b)
  | .ite c t e => .ite (subst args c) (subst args t) (subst args e)
  | .raise err => .raise err
  | .prop i => args i

/-- The child lowered with each prop read delegating to a getter. -/
def lowerWith (props : Nat → Prog) : Expr → Prog
  | .lit n => .ret n
  | .read s => .read s .ret
  | .call f e => (lowerWith props e).bind (fun v => .ret (f v))
  | .add a b =>
    (lowerWith props a).bind (fun x => (lowerWith props b).bind (fun y => .ret (x + y)))
  | .ite c th el =>
    (lowerWith props c).bind (fun x => if x ≠ 0 then lowerWith props th else lowerWith props el)
  | .raise err => .raise err
  | .prop i => props i

/-- Lowering is compositional: the child lowered with the caller's lowered
    getters is the lowering of the child with the caller's expressions in place. -/
theorem lowerWith_subst (args : Nat → Expr) (e : Expr) :
    lowerWith (fun i => lower (args i)) e = lower (subst args e) := by
  induction e with
  | lit n => rfl
  | read s => rfl
  | call f e ih => simp [lowerWith, subst, lower, ih]
  | add a b iha ihb => simp [lowerWith, subst, lower, iha, ihb]
  | ite c t e ihc iht ihe => simp [lowerWith, subst, lower, ihc, iht, ihe]
  | raise err => rfl
  | prop i => rfl

/-- S21: the child, its prop reads delegating to the caller's lowered getters,
    computes what Solid computes with the caller's expressions read where the
    child reads them: the same value, tracked reads, suspension and failure. -/
theorem prop_reads_are_callers (σ : Store) (args : Nat → Expr) (e : Expr) :
    run σ (lowerWith (fun i => lower (args i)) e) = eval σ (subst args e) := by
  rw [lowerWith_subst, insertion_preserves]

/-- Why a prop is a getter: a value the caller read once and passed (a settled
    prop) is tracked by nothing in the child, while Solid's getter tracks the
    caller's read there. -/
theorem settled_prop_untracked (σ : Store) (s v : Nat) (settled : σ s = some v) :
    run σ (lowerWith (fun _ => .ret v) (.prop 0)) = (.done v, []) ∧
      eval σ (subst (fun _ => .read s) (.prop 0)) = (.done v, [s]) := by
  simp [lowerWith, run, subst, eval, settled]

/-! ### Events write; exactly the dependents rerun (S22)

An event computes values and writes them, in order; its reads subscribe to
nothing. After it, Solid reruns a computation when it wrote one of its tracked
reads. -/

/-- Write `v` to source `s`. -/
def write (σ : Store) (s v : Nat) : Store := fun t => if t = s then some v else σ t

/-- Solid's event: each write's value from its expression, in order; it stops
    at a value that is not done. -/
def evalEvent : Store → List (Nat × Expr) → Option Store
  | σ, [] => some σ
  | σ, (s, e) :: rest =>
    match (eval σ e).1 with
    | .done v => evalEvent (write σ s v) rest
    | _ => none

/-- The lowered event: each value from the lowered expression. -/
def runEvent : Store → List (Nat × Prog) → Option Store
  | σ, [] => some σ
  | σ, (s, p) :: rest =>
    match (run σ p).1 with
    | .done v => runEvent (write σ s v) rest
    | _ => none

/-- The lowered event leaves the store Solid's event leaves. -/
theorem event_preserves (σ : Store) (ev : List (Nat × Expr)) :
    runEvent σ (ev.map fun w => (w.1, lower w.2)) = evalEvent σ ev := by
  induction ev generalizing σ with
  | nil => rfl
  | cons w rest ih =>
    obtain ⟨s, e⟩ := w
    simp only [List.map, runEvent, evalEvent, insertion_preserves]
    cases (eval σ e).1 <;> simp [ih]

/-- An event changes only the sources it writes. -/
theorem event_untouched : ∀ (ev : List (Nat × Expr)) (σ σ' : Store),
    evalEvent σ ev = some σ' → ∀ t, t ∉ ev.map Prod.fst → σ' t = σ t := by
  intro ev
  induction ev with
  | nil => intro σ σ' h t _; simp [evalEvent] at h; rw [h]
  | cons w rest ih =>
    obtain ⟨s, e⟩ := w
    intro σ σ' h t ht
    simp only [List.map, List.mem_cons, not_or] at ht
    simp only [evalEvent] at h
    cases hv : (eval σ e).1 with
    | done v =>
      rw [hv] at h
      rw [ih (write σ s v) σ' h t ht.2]
      simp [write, ht.1]
    | pending _ => rw [hv] at h; simp at h
    | failed _ => rw [hv] at h; simp at h

/-- S22: after an event, a computation none of whose tracked reads it wrote
    keeps its result, so Solid leaving it alone is right; one it reruns
    computes Solid's result at the new store (`insertion_preserves`). -/
theorem untouched_keeps (σ σ' : Store) (ev : List (Nat × Expr)) (e : Expr)
    (done : evalEvent σ ev = some σ')
    (disjoint : ∀ s ∈ (run σ (lower e)).2, s ∉ ev.map Prod.fst) :
    run σ' (lower e) = run σ (lower e) :=
  lowered_reads_are_dependencies e σ σ' fun s h => event_untouched ev σ σ' done s (disjoint s h)

/-- A memo: a cached outcome read through a getter (S21 with the memo's
    definition). After an event that wrote none of its tracked reads, the cache
    is still Solid's outcome. -/
theorem memo_cache_consistent (σ σ' : Store) (ev : List (Nat × Expr)) (d : Expr)
    (done : evalEvent σ ev = some σ')
    (disjoint : ∀ s ∈ (eval σ d).2, s ∉ ev.map Prod.fst) :
    eval σ' d = eval σ d :=
  eval_depends_on_trace d σ σ' fun s h => event_untouched ev σ σ' done s (disjoint s h)

/-! ### Boundaries, lists and effects (S23)

The remaining constructs compose S20–S22: a boundary maps the outcome it is
given, a list runs its row once per item with the item as the row's prop, and
an effect computes a value and then writes as an event does. -/

/-- `Errored`: a failure becomes the fallback's value. -/
def errored (fb : Nat) : Outcome → Outcome
  | .failed _ => .done fb
  | o => o

/-- `Loading`: a suspension becomes the fallback's value. -/
def loading (fb : Nat) : Outcome → Outcome
  | .pending _ => .done fb
  | o => o

/-- A boundary sees the lowered routine's outcome as Solid's. -/
theorem boundary_sees_same (σ : Store) (e : Expr) (fe fl : Nat) :
    errored fe (loading fl (run σ (lower e)).1) = errored fe (loading fl (eval σ e).1) := by
  rw [insertion_preserves]

/-- A list's rows: the row with the item as its prop, once per item. -/
def rows (σ : Store) (items : List Nat) (row : Expr) : List (Outcome × List Nat) :=
  items.map fun x => eval σ (subst (fun _ => .lit x) row)

/-- The lowered list: the lowered row, its prop the item's value. -/
def loweredRows (σ : Store) (items : List Nat) (row : Expr) : List (Outcome × List Nat) :=
  items.map fun x => run σ (lowerWith (fun _ => .ret x) row)

/-- S23: each lowered row computes what Solid's row computes. -/
theorem rows_preserve (σ : Store) (items : List Nat) (row : Expr) :
    loweredRows σ items row = rows σ items row := by
  unfold loweredRows rows
  congr 1
  funext x
  have : (fun _ : Nat => Prog.ret x) = fun i => lower ((fun _ => Expr.lit x) i) := rfl
  rw [this, prop_reads_are_callers]

/-- Solid's effect: its compute's value, handed to a phase that writes. -/
def evalEffect (σ : Store) (compute : Expr) (phase : Nat → List (Nat × Expr)) :
    Option Store :=
  match (eval σ compute).1 with
  | .done v => evalEvent σ (phase v)
  | _ => none

/-- The lowered effect: the lowered compute, then the lowered phase. -/
def runEffect (σ : Store) (compute : Expr) (phase : Nat → List (Nat × Expr)) :
    Option Store :=
  match (run σ (lower compute)).1 with
  | .done v => runEvent σ ((phase v).map fun w => (w.1, lower w.2))
  | _ => none

/-- S23: the lowered effect leaves the store Solid's effect leaves. -/
theorem effect_preserves (σ : Store) (compute : Expr) (phase : Nat → List (Nat × Expr)) :
    runEffect σ compute phase = evalEffect σ compute phase := by
  unfold runEffect evalEffect
  rw [insertion_preserves]
  cases (eval σ compute).1 <;> simp [event_preserves]

end Insertion

/-! ### Untracked reads and inline routines (S24, D-124)

S20's core with two more forms. `untrack(() => e)`: Solid computes `e` and
tracks none of its reads (a pending read still suspends). An inline routine:
an IIFE, a local function only ever called, a getter or a method read where
it is called; Solid runs its body there, so its reads are the caller's. The
lowering makes the first `nativeUntrack` (each step run untracked) and the
second a generator delegated in place (`yield* (function* () { … })()`). -/
namespace Surface

open Insertion (Store Outcome seq)

inductive Expr where
  | lit (n : Nat)
  | read (s : Nat)
  | call (f : Nat → Nat) (e : Expr)
  | add (a b : Expr)
  | ite (c t e : Expr)
  | raise (err : Nat)
  | untrack (e : Expr)
  | inline (e : Expr)

/-- Solid's evaluation: `untrack` keeps the outcome and drops the reads; an
    inline routine is its body, evaluated where it is called. -/
def eval (σ : Store) : Expr → Outcome × List Nat
  | .lit n => (.done n, [])
  | .read s =>
    match σ s with
    | some v => (.done v, [s])
    | none => (.pending s, [s])
  | .call f e =>
    match eval σ e with
    | (.done v, t) => (.done (f v), t)
    | r => r
  | .add a b =>
    match eval σ a with
    | (.done x, t) =>
      match eval σ b with
      | (.done y, t') => (.done (x + y), t ++ t')
      | (r, t') => (r, t ++ t')
    | r => r
  | .ite c th el =>
    match eval σ c with
    | (.done x, t) =>
      let r := if x ≠ 0 then eval σ th else eval σ el
      (r.1, t ++ r.2)
    | r => r
  | .raise err => (.failed err, [])
  | .untrack e => ((eval σ e).1, [])
  | .inline e => eval σ e

/-- A lowered routine; `untracked p k` runs `p` with its reads untracked. -/
inductive Prog where
  | ret (v : Nat)
  | read (s : Nat) (k : Nat → Prog)
  | raise (err : Nat)
  | untracked (p : Prog) (k : Nat → Prog)

def Prog.bind : Prog → (Nat → Prog) → Prog
  | .ret v, k => k v
  | .read s k', k => .read s (fun v => (k' v).bind k)
  | .raise e, _ => .raise e
  | .untracked p k', k => .untracked p (fun v => (k' v).bind k)

def lower : Expr → Prog
  | .lit n => .ret n
  | .read s => .read s .ret
  | .call f e => (lower e).bind (fun v => .ret (f v))
  | .add a b => (lower a).bind (fun x => (lower b).bind (fun y => .ret (x + y)))
  | .ite c th el => (lower c).bind (fun x => if x ≠ 0 then lower th else lower el)
  | .raise err => .raise err
  | .untrack e => .untracked (lower e) .ret
  | .inline e => (lower e).bind .ret

/-- The driver: as S20's, and an untracked step keeps its outcome but tracks
    nothing. -/
def run (σ : Store) : Prog → Outcome × List Nat
  | .ret v => (.done v, [])
  | .read s k =>
    match σ s with
    | some v => ((run σ (k v)).1, s :: (run σ (k v)).2)
    | none => (.pending s, [s])
  | .raise e => (.failed e, [])
  | .untracked p k =>
    match (run σ p).1 with
    | .done v => run σ (k v)
    | o => (o, [])

theorem run_bind (σ : Store) (p : Prog) (k : Nat → Prog) :
    run σ (p.bind k) = seq (run σ p) (fun v => run σ (k v)) := by
  induction p with
  | ret v => simp [Prog.bind, run, seq]
  | read s k' ih =>
    simp only [Prog.bind, run]
    cases h : σ s with
    | none => simp [seq]
    | some v =>
      simp only [ih v]
      cases run σ (k' v) with
      | mk o t => cases o <;> simp [seq]
  | raise e => simp [Prog.bind, run, seq]
  | untracked p k' ihp ihk =>
    simp only [Prog.bind, run]
    cases h : (run σ p).1 with
    | done v => simp [ihk v, seq]
    | pending s => simp [seq]
    | failed e => simp [seq]

theorem seq_ret (r : Outcome × List Nat) : seq r (fun v => (.done v, [])) = r := by
  cases r with
  | mk o t => cases o <;> simp [seq]

/-- S24: the lowering of the extended core computes Solid's outcome and
    tracked reads, `untrack` and inline routines included. -/
theorem surface_preserves (σ : Store) (e : Expr) : run σ (lower e) = eval σ e := by
  induction e with
  | lit n => simp [lower, run, eval]
  | read s => cases h : σ s <;> simp [lower, run, eval, h]
  | call f e ih =>
    simp only [lower, run_bind, ih, eval]
    cases eval σ e with
    | mk o t => cases o <;> simp [seq, run]
  | add a b iha ihb =>
    simp only [lower, run_bind, iha, eval]
    cases eval σ a with
    | mk o t =>
      cases o with
      | done x =>
        simp only [seq, ihb]
        cases eval σ b with
        | mk o' t' => cases o' <;> simp [run]
      | pending s => simp [seq]
      | failed err => simp [seq]
  | ite c th el ihc iht ihe =>
    simp only [lower, run_bind, ihc, eval]
    cases eval σ c with
    | mk o t =>
      cases o with
      | done x =>
        simp only [seq]
        by_cases hx : x ≠ 0 <;> simp [hx, iht, ihe]
      | pending s => simp [seq]
      | failed err => simp [seq]
  | raise err => simp [lower, run, eval]
  | untrack e ih =>
    simp only [lower, run, ih, eval]
    cases (eval σ e).1 <;> rfl
  | inline e ih =>
    simp only [lower, run_bind, ih, eval]
    have : (fun v => run σ (Prog.ret v)) = (fun v => ((Outcome.done v), ([] : List Nat))) := by
      funext v; simp [run]
    rw [this, seq_ret]

/-- `untrack` tracks nothing and keeps the outcome: a pending read in it
    still suspends (it is not cast away, D-116). -/
theorem untrack_tracks_nothing (σ : Store) (e : Expr) :
    (run σ (lower (.untrack e))).2 = [] ∧
      (run σ (lower (.untrack e))).1 = (eval σ e).1 := by
  rw [surface_preserves]
  exact ⟨rfl, rfl⟩

/-- An inline routine's reads are its caller's: the host tracks them, and a
    pending one suspends the host. Run on its own (the earlier lowering's
    lexical callback), a read the host makes through it would be missing from
    the host's trace. -/
theorem inline_reads_are_hosts (σ : Store) (e : Expr) :
    run σ (lower (.inline e)) = eval σ e := by
  rw [surface_preserves]
  rfl

theorem inline_pending_suspends_host (σ : Store) (s : Nat) (h : σ s = none) :
    (run σ (lower (.add (.lit 1) (.inline (.read s))))).1 = .pending s := by
  rw [surface_preserves]
  simp [eval, h]

end Surface

/-! ### Statements: locals, sequencing, branches, loops, throw and try (S25, D-124)

The surface forms are statements as much as expressions: `const` and `let`
bindings, assignment (compound, increment, destructuring), `if`/`else`,
`switch`, loops (`for`, `for…of`, `for…in`, `while`, `do…while`, array
callbacks run in place), `throw`, and `try`/`catch`. A statement runs over
the locals (an environment) and S20's expressions, the locals they name put
in. Solid runs the statement where it stands; the lowering makes it a
routine whose expressions are S20's and whose `try` is `nativeTry`. The
lowered statement leaves the same locals, tracks the same reads in the same
order, and suspends or fails exactly where Solid does; a `catch` takes a
failure, never a suspension. -/
namespace Statements

open Insertion (Store Outcome)

abbrev Env := Nat → Nat

def update (ρ : Env) (x v : Nat) : Env := fun y => if y = x then v else ρ y

inductive Stmt where
  | skip
  | assign (x : Nat) (e : Env → Insertion.Expr)
  | seq (a b : Stmt)
  | ite (c : Env → Insertion.Expr) (th el : Stmt)
  | loop (count : Env → Insertion.Expr) (body : Stmt)
  | raise (err : Nat)
  | tryCatch (body handler : Stmt)

/-- How a statement ends: with the locals, suspended, or failed (with the
    locals at the throw, which the `catch` sees). -/
inductive Status where
  | ok (ρ : Env)
  | pending (s : Nat)
  | failed (err : Nat) (ρ : Env)

abbrev Res := Status × List Nat

def seqR (r : Res) (f : Env → Res) : Res :=
  match r with
  | (.ok ρ, t) => ((f ρ).1, t ++ (f ρ).2)
  | r => r

def expR (ρ : Env) (r : Outcome × List Nat) (f : Nat → Res) : Res :=
  match r with
  | (.done v, t) => ((f v).1, t ++ (f v).2)
  | (.pending s, t) => (.pending s, t)
  | (.failed e, t) => (.failed e ρ, t)

def iterR (f : Env → Res) : Nat → Env → Res
  | 0, ρ => (.ok ρ, [])
  | n + 1, ρ => seqR (f ρ) (fun ρ' => iterR f n ρ')

def catchR (r : Res) (h : Env → Res) : Res :=
  match r with
  | (.failed _ ρ, t) => ((h ρ).1, t ++ (h ρ).2)
  | r => r

/-- Solid's direct execution. -/
def exec (σ : Store) : Stmt → Env → Res
  | .skip, ρ => (.ok ρ, [])
  | .assign x e, ρ => expR ρ (Insertion.eval σ (e ρ)) (fun v => (.ok (update ρ x v), []))
  | .seq a b, ρ => seqR (exec σ a ρ) (fun ρ' => exec σ b ρ')
  | .ite c th el, ρ =>
    expR ρ (Insertion.eval σ (c ρ)) (fun x => if x ≠ 0 then exec σ th ρ else exec σ el ρ)
  | .loop c body, ρ =>
    expR ρ (Insertion.eval σ (c ρ)) (fun n => iterR (fun ρ' => exec σ body ρ') n ρ)
  | .raise err, ρ => (.failed err ρ, [])
  | .tryCatch b h, ρ => catchR (exec σ b ρ) (fun ρ' => exec σ h ρ')

/-- A lowered statement: a routine that ends with the locals; `handle` is
    `nativeTry` (its body, its handler given the locals at the failure, and
    what follows). -/
inductive SProg where
  | ret (ρ : Env)
  | read (s : Nat) (k : Nat → SProg)
  | raise (err : Nat) (ρ : Env)
  | handle (body : SProg) (handler : Env → SProg) (k : Env → SProg)

def SProg.bind : SProg → (Env → SProg) → SProg
  | .ret ρ, k => k ρ
  | .read s k', k => .read s (fun v => (k' v).bind k)
  | .raise e ρ, _ => .raise e ρ
  | .handle b h k', k => .handle b h (fun ρ => (k' ρ).bind k)

/-- S20's lowered expression inside a statement: its failure fails there. -/
def toS (ρ : Env) : Insertion.Prog → (Nat → SProg) → SProg
  | .ret v, k => k v
  | .read s k', k => .read s (fun v => toS ρ (k' v) k)
  | .raise e, _ => .raise e ρ

def iterS (f : Env → SProg) : Nat → Env → SProg
  | 0, ρ => .ret ρ
  | n + 1, ρ => (f ρ).bind (fun ρ' => iterS f n ρ')

def lowerS : Stmt → Env → SProg
  | .skip, ρ => .ret ρ
  | .assign x e, ρ => toS ρ (Insertion.lower (e ρ)) (fun v => .ret (update ρ x v))
  | .seq a b, ρ => (lowerS a ρ).bind (fun ρ' => lowerS b ρ')
  | .ite c th el, ρ =>
    toS ρ (Insertion.lower (c ρ)) (fun x => if x ≠ 0 then lowerS th ρ else lowerS el ρ)
  | .loop c body, ρ =>
    toS ρ (Insertion.lower (c ρ)) (fun n => iterS (fun ρ' => lowerS body ρ') n ρ)
  | .raise err, ρ => .raise err ρ
  | .tryCatch b h, ρ => .handle (lowerS b ρ) (fun ρ' => lowerS h ρ') .ret

/-- The driver: S20's for reads; `nativeTry` hands a failure to its handler
    and rethrows a suspension. -/
def runS (σ : Store) : SProg → Res
  | .ret ρ => (.ok ρ, [])
  | .read s k =>
    match σ s with
    | some v => ((runS σ (k v)).1, s :: (runS σ (k v)).2)
    | none => (.pending s, [s])
  | .raise e ρ => (.failed e ρ, [])
  | .handle b h k =>
    seqR (catchR (runS σ b) (fun ρ => runS σ (h ρ))) (fun ρ => runS σ (k ρ))

theorem seqR_assoc (r : Res) (f g : Env → Res) :
    seqR (seqR r f) g = seqR r (fun ρ => seqR (f ρ) g) := by
  rcases r with ⟨o, t⟩
  cases o with
  | ok ρ =>
    simp only [seqR]
    rcases hf : f ρ with ⟨o', t'⟩
    cases o' <;> simp [List.append_assoc]
  | pending s => rfl
  | failed e ρ => rfl

theorem seqR_ok (r : Res) : seqR r (fun ρ => (.ok ρ, [])) = r := by
  rcases r with ⟨o, t⟩
  cases o <;> simp [seqR]

theorem runS_bind (σ : Store) (p : SProg) (k : Env → SProg) :
    runS σ (p.bind k) = seqR (runS σ p) (fun ρ => runS σ (k ρ)) := by
  induction p with
  | ret ρ => simp [SProg.bind, runS, seqR]
  | read s k' ih =>
    simp only [SProg.bind, runS]
    cases σ s with
    | none => rfl
    | some v =>
      simp only [ih v]
      rcases runS σ (k' v) with ⟨o, t⟩
      cases o with
      | ok ρ => simp [seqR]
      | pending _ => rfl
      | failed _ _ => rfl
  | raise e ρ => rfl
  | handle b h k' _ _ ihk =>
    simp only [SProg.bind, runS, ihk, seqR_assoc]

theorem toS_run (σ : Store) (ρ : Env) (p : Insertion.Prog) (k : Nat → SProg) :
    runS σ (toS ρ p k) = expR ρ (Insertion.run σ p) (fun v => runS σ (k v)) := by
  induction p with
  | ret v => simp [toS, Insertion.run, expR]
  | read s k' ih =>
    simp only [toS, runS, Insertion.run]
    cases σ s with
    | none => rfl
    | some v =>
      simp only [ih v]
      rcases Insertion.run σ (k' v) with ⟨o, t⟩
      cases o with
      | done x => simp [expR]
      | pending _ => rfl
      | failed _ => rfl
  | raise e => rfl

theorem iter_run (σ : Store) (f : Env → SProg) (g : Env → Res)
    (h : ∀ ρ, runS σ (f ρ) = g ρ) : ∀ n ρ, runS σ (iterS f n ρ) = iterR g n ρ := by
  intro n
  induction n with
  | zero => intro ρ; rfl
  | succ n ih =>
    intro ρ
    simp only [iterS, iterR, runS_bind, h, ih]

/-- S25: a lowered statement leaves Solid's locals, tracks Solid's reads in
    order, and suspends or fails where Solid does. -/
theorem statements_preserve (σ : Store) (st : Stmt) :
    ∀ ρ, runS σ (lowerS st ρ) = exec σ st ρ := by
  induction st with
  | skip => intro ρ; rfl
  | assign x e =>
    intro ρ
    simp only [lowerS, exec, toS_run, Insertion.insertion_preserves]
    rfl
  | seq a b iha ihb =>
    intro ρ
    simp only [lowerS, exec, runS_bind, iha, ihb]
  | ite c th el iht ihe =>
    intro ρ
    simp only [lowerS, exec, toS_run, Insertion.insertion_preserves]
    congr 1
    funext x
    by_cases hx : x ≠ 0 <;> simp [hx, iht, ihe]
  | loop c body ih =>
    intro ρ
    simp only [lowerS, exec, toS_run, Insertion.insertion_preserves]
    congr 1
    funext n
    exact iter_run σ _ _ ih n ρ
  | raise err => intro ρ; rfl
  | tryCatch b h ihb ihh =>
    intro ρ
    simp only [lowerS, exec, runS, ihb, ihh, seqR_ok]

/-- A `catch` never takes a suspension: `nativeTry` rethrows it, as Solid's
    `NotReadyError` passes a `catch` the checker marks. -/
theorem catch_passes_pending (σ : Store) (b h : Stmt) (ρ : Env) (s : Nat) (t : List Nat)
    (hp : exec σ b ρ = (.pending s, t)) : exec σ (.tryCatch b h) ρ = (.pending s, t) := by
  simp [exec, hp, catchR]

/-- A `catch` takes the failure with the locals at the throw. -/
theorem catch_takes_failure (σ : Store) (b h : Stmt) (ρ ρ' : Env) (e : Nat) (t : List Nat)
    (hf : exec σ b ρ = (.failed e ρ', t)) :
    exec σ (.tryCatch b h) ρ = ((exec σ h ρ').1, t ++ (exec σ h ρ').2) := by
  simp [exec, hf, catchR]

end Statements

#print axioms write_admitted_iff
#print axioms event_phase_runs_in_caller
#print axioms hook_requirement_provided
#print axioms widen_monotone
#print axioms settled_prop_unsound
#print axioms foreign_router_sound
#print axioms render_union_unsound
#print axioms context_member_sound
#print axioms missed_provider_unsound
#print axioms clean_mem_iff
#print axioms delegated_callback_colored
#print axioms undelegated_callback_unsound
#print axioms hole_requirement_carried
#print axioms dropped_requirement_unsound
#print axioms lazy_union_bounds
#print axioms missed_caller_unsound
#print axioms facade_bounds_held
#print axioms plain_slot_unsound
#print axioms loop_driven_sound
#print axioms foreign_driver_unsound
#print axioms renderer_sound
#print axioms unchecked_root_unsound
#print axioms kept_async_sound
#print axioms kept_sync_unsound
#print axioms driven_saga_write_admitted
#print axioms memo_driven_saga_refused
#print axioms init_admits_cleanup
#print axioms provider_bounds
#print axioms init_dropped_unsound
#print axioms hole_hosted_in_view
#print axioms raise_in_view_refused
#print axioms boxed_keeps_made
#print axioms boxed_no_wait
#print axioms boxed_list_is_original
#print axioms awaited_list_unsound
#print axioms Insertion.run_bind
#print axioms Insertion.insertion_preserves
#print axioms Insertion.eval_depends_on_trace
#print axioms Insertion.lowered_reads_are_dependencies
#print axioms Insertion.snapshot_untracked
#print axioms Insertion.lowerWith_subst
#print axioms Insertion.prop_reads_are_callers
#print axioms Insertion.settled_prop_untracked
#print axioms Insertion.event_preserves
#print axioms Insertion.event_untouched
#print axioms Insertion.untouched_keeps
#print axioms Insertion.memo_cache_consistent
#print axioms Insertion.boundary_sees_same
#print axioms Insertion.rows_preserve
#print axioms Insertion.effect_preserves
#print axioms Surface.run_bind
#print axioms Surface.surface_preserves
#print axioms Surface.untrack_tracks_nothing
#print axioms Surface.inline_reads_are_hosts
#print axioms Surface.inline_pending_suspends_host
#print axioms Statements.runS_bind
#print axioms Statements.toS_run
#print axioms Statements.iter_run
#print axioms Statements.statements_preserve
#print axioms Statements.catch_passes_pending
#print axioms Statements.catch_takes_failure
end Sugar
end Yield
