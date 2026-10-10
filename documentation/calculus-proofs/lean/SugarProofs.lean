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
end Sugar
end Yield
