import Std

/- An abstract effect-and-owner semantics, not a formalization of TypeScript
   or Solid. All runtime refinement assumptions are listed in ../README.md. -/
namespace Yield

inductive Requirement where
  | live : Nat → Requirement
  | created : Nat → Requirement
  deriving DecidableEq

inductive Effect where
  | pending
  | failure : Nat → Effect
  | marker
  | need : Requirement → Effect
  deriving DecidableEq

/-- A powerset presentation of the four-component color lattice. -/
abbrev Color := Effect → Prop

def parts (p : Prop) (e : Nat → Prop) (w : Prop) (r : Requirement → Prop) : Color
  | .pending => p
  | .failure k => e k
  | .marker => w
  | .need c => r c

def bottom : Color := fun _ => False
def join (a b : Color) : Color := fun x => a x ∨ b x
def meet (a b : Color) : Color := fun x => a x ∧ b x
def below (a b : Color) : Prop := ∀ x, a x → b x

theorem below_refl (a : Color) : below a a := fun _ h => h
theorem below_trans {a b c : Color} (h : below a b) (g : below b c) : below a c :=
  fun x hx => g x (h x hx)
theorem below_antisymm {a b : Color} (h : below a b) (g : below b a) : a = b := by
  funext x; exact propext ⟨h x, g x⟩
theorem bottom_below (a : Color) : below bottom a := by intro x h; exact h.elim
theorem join_lub (a b c : Color) : below (join a b) c ↔ below a c ∧ below b c := by
  constructor
  · intro h; exact ⟨fun x hx => h x (.inl hx), fun x hx => h x (.inr hx)⟩
  · rintro ⟨h, g⟩ x (hx | hx)
    · exact h x hx
    · exact g x hx
theorem meet_glb (a b c : Color) : below c (meet a b) ↔ below c a ∧ below c b := by
  constructor
  · intro h; exact ⟨fun x hx => (h x hx).1, fun x hx => (h x hx).2⟩
  · rintro ⟨h, g⟩ x hx; exact ⟨h x hx, g x hx⟩
theorem join_comm (a b : Color) : join a b = join b a := by
  funext x; exact propext Or.comm
theorem join_idem (a : Color) : join a a = a := by
  funext x; exact propext ⟨fun h => h.elim id id, Or.inl⟩

inductive Op where
  | read (p : Bool) (errors : List Nat)
  | wait
  | raise (errors : List Nat)
  | write
  | call (p a : Bool) (errors : List Nat)
  | bind (w : Bool) (errors : List Nat)
  | create (kind : Nat) (errors : List Nat)
  | cleanup
  | context (requirements : List Requirement)
  | child (color : Color)
  | stream

def opColor : Op → Color
  | .read p e => parts (p = true) (· ∈ e) False (fun _ => False)
  | .wait => parts True (fun _ => False) False (fun _ => False)
  | .raise e => parts False (· ∈ e) False (fun _ => False)
  | .call p _ e => parts (p = true) (· ∈ e) False (fun _ => False)
  | .bind w e => parts False (· ∈ e) (w = true) (fun _ => False)
  | .create _ e => parts False (· ∈ e) False (fun _ => False)
  | .context r => parts False (fun _ => False) False (· ∈ r)
  | .child c => c
  | _ => bottom

/-- Existential folding is union folding: duplicates and order do not matter. -/
def fold (ops : List Op) : Color := fun x => ∃ o ∈ ops, opColor o x
def PendingOf (ops : List Op) := fold ops .pending
def FailsOf (ops : List Op) (k : Nat) := fold ops (.failure k)
def MayWaitOf (ops : List Op) := fold ops .marker
def RequiresOf (ops : List Op) (q : Requirement) := fold ops (.need q)

def readsPending : Op → Prop
  | .wait => False
  | o => opColor o .pending

def waits : Op → Prop
  | .wait => True
  | .call _ a _ => a = true
  | _ => False

def ReadsPendingOf (ops : List Op) := ∃ o ∈ ops, readsPending o
def WaitsOf (ops : List Op) := ∃ o ∈ ops, waits o

theorem fold_append (a b : List Op) : fold (a ++ b) = join (fold a) (fold b) := by
  funext x
  apply propext
  simp only [fold, join, List.mem_append]
  constructor
  · rintro ⟨o, ha | hb, hx⟩
    · exact .inl ⟨o, ha, hx⟩
    · exact .inr ⟨o, hb, hx⟩
  · rintro (⟨o, ha, hx⟩ | ⟨o, hb, hx⟩)
    · exact ⟨o, .inl ha, hx⟩
    · exact ⟨o, .inr hb, hx⟩

theorem fold_member {o : Op} {ops : List Op} (h : o ∈ ops) : below (opColor o) (fold ops) :=
  fun _ hx => ⟨o, h, hx⟩
theorem bind_not_pending (w : Bool) (es : List Nat) : ¬ opColor (.bind w es) .pending := by
  simp [opColor, parts]
theorem wait_two_colors : ¬ readsPending .wait ∧ waits .wait := ⟨id, True.intro⟩

def settleReq : Requirement → Nat
  | .live c | .created c => c

def Settle (r : Requirement → Prop) (c : Nat) := ∃ q, r q ∧ settleReq q = c

theorem settle_created (r : Nat → Prop) (c : Nat) :
    Settle (fun q => ∃ k, r k ∧ q = .created k) c ↔ r c := by
  constructor
  · rintro ⟨q, ⟨k, hk, rfl⟩, heq⟩; cases heq; exact hk
  · intro h; exact ⟨.created c, ⟨c, h, rfl⟩, rfl⟩

inductive Host where
  | setup | view | hview | hole | holeProp | memo | compute | phase | event
  deriving DecidableEq

def Admits : Host → Op → Prop
  | .setup, .create .. | .setup, .cleanup | .setup, .context .. => True
  | .view, .read .. | .view, .child .. | .view, .bind .. => True
  | .hole, .read .. | .hole, .raise .. | .hole, .stream => True
  | .holeProp, .read .. | .holeProp, .raise .. | .holeProp, .child .. => True
  | .memo, .read .. | .memo, .wait | .memo, .raise .. | .memo, .stream => True
  | .compute, .read .. | .compute, .raise .. | .compute, .stream => True
  | .phase, .read false _ | .phase, .write | .phase, .cleanup
  | .phase, .raise .. | .phase, .call false false _ | .phase, .stream => True
  | .event, .read .. | .event, .write | .event, .wait
  | .event, .call .. | .event, .raise .. => True
  | _, _ => False

/-- H ⊢ Y: every possible operation in the routine's yield union is admitted. -/
def WellHosted (h : Host) (ops : List Op) := ∀ o ∈ ops, Admits h o

theorem only_memo_event_wait {h : Host} (ha : Admits h .wait) : h = .memo ∨ h = .event := by
  cases h <;> simp_all [Admits]
theorem phase_read_settled {p : Bool} {es : List Nat} (ha : Admits .phase (.read p es)) :
    p = false := by cases p <;> simp_all [Admits]
theorem event_no_stream : ¬ Admits .event .stream := id

/-- Primitive observable steps. Child is an explicit interface assumption:
    a separately checked child's observations respect its exported color.
    A marker is never an observable runtime effect. -/
inductive Fires : Op → Effect → Prop where
  | readPending : Fires (.read true es) .pending
  | readFailure : k ∈ es → Fires (.read p es) (.failure k)
  | wait : Fires .wait .pending
  | raise : k ∈ es → Fires (.raise es) (.failure k)
  | callPending : Fires (.call true a es) .pending
  | callFailure : k ∈ es → Fires (.call p a es) (.failure k)
  | bindFailure : k ∈ es → Fires (.bind w es) (.failure k)
  | createFailure : k ∈ es → Fires (.create kind es) (.failure k)
  | context : q ∈ qs → Fires (.context qs) (.need q)
  | child : c e → e ≠ .marker → Fires (.child c) e

theorem primitive_preservation {o e} (h : Fires o e) : opColor o e := by
  cases h <;> simp_all [opColor, parts]
theorem routine_preservation {h ops o e} (_host : WellHosted h ops)
    (member : o ∈ ops) (step : Fires o e) : fold ops e :=
  fold_member member e (primitive_preservation step)

/-- A frame is one owner node. Ordinary nodes pass every effect. -/
inductive Frame where
  | ordinary (id : Nat)
  | loading (id : Nat)
  | errored (id : Nat) (caught : Nat → Prop)
  | provider (id context : Nat)

def Handles : Frame → Effect → Prop
  | .loading _, .pending => True
  | .errored _ caught, .failure k => caught k
  | .provider _ c, .need (.live d) => c = d
  | _, _ => False

def remove (b : Frame) (c : Color) : Color := fun e => c e ∧ ¬ Handles b e

/-- Terms describe owner placement, not JS values. `both` is an upper-bound
    choice/sequence/parallel composition, so unreachable branches may remain. -/
inductive Term where
  | atom (op : Op)
  | both (left right : Term)
  | scope (frame : Frame) (body : Term)

def color : Term → Color
  | .atom o => opColor o
  | .both l r => join (color l) (color r)
  | .scope f t => remove f (color t)

def loading (id : Nat) (children on fallback : Term) : Term :=
  .both (.scope (.loading id) (.both children on)) fallback

def errored (id : Nat) (caught : Nat → Prop) (children fallback : Term) : Term :=
  .both (.scope (.errored id caught) children) fallback

def provide (id c : Nat) (children : Term) : Term := .scope (.provider id c) children

/-- An observation escaping a subtree: independent inductive propagation rules. -/
inductive Emits : Term → Effect → Prop where
  | atom : Fires o e → Emits (.atom o) e
  | left : Emits l e → Emits (.both l r) e
  | right : Emits r e → Emits (.both l r) e
  | pass : Emits t e → ¬ Handles f e → Emits (.scope f t) e

theorem preservation {t e} (run : Emits t e) : color t e := by
  induction run with
  | atom h => exact primitive_preservation h
  | left _ ih => exact .inl ih
  | right _ ih => exact .inr ih
  | pass _ h ih => exact ⟨ih, h⟩

/-- Exact discharge of *observations*, not a claim that every static color occurs. -/
theorem discharge {f t e} : Emits (.scope f t) e ↔ Emits t e ∧ ¬ Handles f e := by
  constructor
  · intro h; cases h with | pass run miss => exact ⟨run, miss⟩
  · rintro ⟨run, miss⟩; exact .pass run miss

theorem both_emits {l r e} : Emits (.both l r) e ↔ Emits l e ∨ Emits r e := by
  constructor
  · intro h; cases h with
    | left h => exact .inl h
    | right h => exact .inr h
  · intro h; exact h.elim Emits.left Emits.right

theorem loading_pending (id c o f) : Emits (loading id c o f) .pending ↔ Emits f .pending := by
  simp [loading, both_emits, discharge, Handles]
theorem loading_failure (id c o f k) :
    Emits (loading id c o f) (.failure k) ↔
      (Emits c (.failure k) ∨ Emits o (.failure k)) ∨ Emits f (.failure k) := by
  simp [loading, both_emits, discharge, Handles]
theorem errored_failure (id ks c f k) :
    Emits (errored id ks c f) (.failure k) ↔
      (Emits c (.failure k) ∧ ¬ ks k) ∨ Emits f (.failure k) := by
  simp [errored, both_emits, discharge, Handles]
theorem errored_pending (id ks c f) :
    Emits (errored id ks c f) .pending ↔ Emits c .pending ∨ Emits f .pending := by
  simp [errored, both_emits, discharge, Handles]
theorem provider_requirement (id c t d) :
    Emits (provide id c t) (.need (.live d)) ↔ Emits t (.need (.live d)) ∧ c ≠ d := by
  simp [provide, discharge, Handles]
theorem provider_created (id c t d) :
    Emits (provide id c t) (.need (.created d)) ↔ Emits t (.need (.created d)) := by
  simp [provide, discharge, Handles]

/-- A path is an owner-tree zipper, nearest ancestor first. Sibling subtrees
    cannot affect routing. Appending a frame puts it outside the subtree. -/
def Escapes (path : List Frame) (e : Effect) := ∀ f ∈ path, ¬ Handles f e

theorem escapes_append (a b : List Frame) (e : Effect) :
    Escapes (a ++ b) e ↔ Escapes a e ∧ Escapes b e := by
  simp only [Escapes, List.mem_append]
  constructor
  · intro h; exact ⟨fun f hf => h f (.inl hf), fun f hf => h f (.inr hf)⟩
  · rintro ⟨h, g⟩ f (hf | hf)
    · exact h f hf
    · exact g f hf

noncomputable def route (path : List Frame) (e : Effect) : Option Frame := by
  classical
  exact match path with
  | [] => none
  | f :: fs => if Handles f e then some f else route fs e

theorem route_none_iff (path : List Frame) (e : Effect) : route path e = none ↔ Escapes path e := by
  classical
  induction path with
  | nil => simp [route, Escapes]
  | cons f fs ih =>
    by_cases h : Handles f e
    · simp [route, h, Escapes]
    · simp [route, h, Escapes] at ih ⊢
      exact ih

/-- Captures nearest-handler routing, including skipped catch lists. -/
theorem route_nearest (inner outer : List Frame) (f : Frame) (e : Effect)
    (miss : Escapes inner e) (hit : Handles f e) :
    route (inner ++ f :: outer) e = some f := by
  classical
  induction inner with
  | nil => simp [route, hit]
  | cons g gs ih =>
    have hg : ¬ Handles g e := miss g (by simp)
    have hgs : Escapes gs e := fun x hx => miss x (by simp [hx])
    simpa [route, hg] using ih hgs

/-- An operation's origin in the tree, before any routing. -/
inductive Located : Term → List Frame → Op → Prop where
  | atom : Located (.atom o) [] o
  | left : Located l path o → Located (.both l r) path o
  | right : Located r path o → Located (.both l r) path o
  | scope : Located t path o → Located (.scope f t) (path ++ [f]) o

theorem located_emits {t path o e} (atSite : Located t path o)
    (step : Fires o e) (esc : Escapes path e) : Emits t e := by
  induction atSite with
  | atom => exact .atom step
  | left _ ih => exact .left (ih step esc)
  | right _ ih => exact .right (ih step esc)
  | scope _ ih =>
    have h := (escapes_append _ _ _).mp esc
    exact .pass (ih step h.1) (h.2 _ (by simp))

theorem owner_preservation {t path o e} (atSite : Located t path o)
    (step : Fires o e) (unhandled : route path e = none) : color t e :=
  preservation (located_emits atSite step ((route_none_iff _ _).mp unhandled))

/-- Root acceptance does not demand an empty failure set. -/
def RootOK (t : Term) := ¬ color t .pending ∧ ∀ q, ¬ color t (.need q)
def Settled (t : Term) := RootOK t ∧ ∀ k, ¬ color t (.failure k)

theorem root_no_pending {t path o} (ok : RootOK t) (loc : Located t path o)
    (step : Fires o .pending) : route path .pending ≠ none := by
  intro hn; exact ok.1 (owner_preservation loc step hn)
theorem root_no_missing_context {t path o q} (ok : RootOK t) (loc : Located t path o)
    (step : Fires o (.need q)) : route path (.need q) ≠ none := by
  intro hn; exact ok.2 q (owner_preservation loc step hn)
theorem root_failure_in_color {t path o k} (loc : Located t path o)
    (step : Fires o (.failure k)) (hn : route path (.failure k) = none) :
    color t (.failure k) := owner_preservation loc step hn
theorem settled_no_failure {t path o k} (ok : Settled t) (loc : Located t path o)
    (step : Fires o (.failure k)) : route path (.failure k) ≠ none := by
  intro hn; exact ok.2 k (owner_preservation loc step hn)

/-- Every delivery to a boundary is in its input color; selective delivery
    additionally satisfies the catch predicate. -/
theorem boundary_position {t f e} (arrival : Emits t e) (hit : Handles f e) :
    color t e ∧ Handles f e := ⟨preservation arrival, hit⟩

/-- D-102 is an environment contract, not an installed provider. No term or
    owner is inserted by `foreign`. `provided` must hold at the actual site. -/
def ForeignCheck (c : Color) (provided : Nat → Prop) :=
  (∀ k, ¬ c (.failure k)) ∧
  (∀ q, c (.need q) → ∃ n, q = .live n ∧ provided n)
def ProvidedAt (provided : Nat → Prop) (path : List Frame) :=
  ∀ n, provided n → ∃ f ∈ path, Handles f (.need (.live n))

theorem foreign_no_failure {t provided k} (ok : ForeignCheck (color t) provided) :
    ¬ Emits t (.failure k) := fun run => ok.1 k (preservation run)
theorem foreign_context {t provided path q} (ok : ForeignCheck (color t) provided)
    (actual : ProvidedAt provided path) (run : Emits t (.need q)) :
    route path (.need q) ≠ none := by
  intro hn
  obtain ⟨n, rfl, hp⟩ := ok.2 q (preservation run)
  obtain ⟨f, hf, hit⟩ := actual n hp
  exact (route_none_iff path _).mp hn f hf hit

/-- A foreign consumer must supply Loading at each possible pending read path.
    This is an environment contract, not a property of the identity wrapper. -/
def LoadingAt (path : List Frame) := ∃ f ∈ path, Handles f .pending

theorem foreign_pending {t path} (ambient : color t .pending → LoadingAt path)
    (run : Emits t .pending) : route path .pending ≠ none := by
  intro hn
  obtain ⟨f, hf, hit⟩ := ambient (preservation run)
  exact (route_none_iff path _).mp hn f hf hit

/-- Routing starts at the saved site, not at the producer's owner. -/
inductive Origin where
  | read | bind | creation
  deriving DecidableEq
structure Sites where
  reader : List Frame
  binder : List Frame
  creator : List Frame

def start (s : Sites) : Origin → List Frame
  | .read => s.reader
  | .bind => s.binder
  | .creation => s.creator

noncomputable def routeAt (s : Sites) (o : Origin) (e : Effect) := route (start s o) e

theorem memo_read_site (s : Sites) (e : Effect) : routeAt s .read e = route s.reader e := rfl
theorem event_bind_site (s : Sites) (k : Nat) :
    routeAt s .bind (.failure k) = route s.binder (.failure k) := rfl
theorem context_creation_site (s : Sites) (q : Nat) :
    routeAt s .creation (.need (.live q)) = route s.creator (.need (.live q)) := rfl

/-- Subsumption: widening a permission cannot lose an observation. -/
theorem subsumption {t e c} (run : Emits t e) (wide : below (color t) c) : c e :=
  wide e (preservation run)
theorem remove_monotone {a b : Color} (wide : below a b) (f : Frame) :
    below (remove f a) (remove f b) :=
  fun e h => ⟨wide e h.1, h.2⟩

theorem loading_color (id c o f) :
    color (loading id c o f) .pending ↔ color f .pending := by
  simp [color, loading, join, remove, Handles]
theorem errored_color (id ks c f k) :
    color (errored id ks c f) (.failure k) ↔
      (color c (.failure k) ∧ ¬ ks k) ∨ color f (.failure k) := Iff.rfl
theorem provide_color (id c t d) :
    color (provide id c t) (.need (.live d)) ↔
      color t (.need (.live d)) ∧ c ≠ d := Iff.rfl

/-- A machine tick: choose a routine's saved origin and perform one primitive
    observation. No scheduler order is imposed. Non-observable work stutters.
    Creation/recomputation uses a new Located derivation in the same skeleton.
    This abstracts time, values, graph disposal, and source-state refinement. -/
structure Observation where
  effect : Effect
  destination : Option Frame

inductive Tick (t : Term) : Option Observation → Prop where
  | silent : Tick t none
  | fire (loc : Located t path op) (step : Fires op e) :
      Tick t (some ⟨e, route path e⟩)

inductive Execution (t : Term) : List (Option Observation) → Prop where
  | nil : Execution t []
  | cons : Tick t x → Execution t xs → Execution t (x :: xs)

theorem tick_observation {t obs} (tick : Tick t (some obs))
    (unhandled : obs.destination = none) : color t obs.effect := by
  cases tick with
  | fire loc step => exact owner_preservation loc step unhandled

theorem tick_preservation {t e} (tick : Tick t (some ⟨e, none⟩)) : color t e :=
  tick_observation tick rfl

theorem execution_preservation {t xs} (run : Execution t xs) :
    ∀ e, some ⟨e, none⟩ ∈ xs → color t e := by
  induction run with
  | nil => simp
  | cons tick _ ih =>
    intro e member
    rcases List.mem_cons.mp member with eq | tail
    · subst eq; exact tick_preservation tick
    · exact ih e tail

theorem execution_root {t xs} (ok : RootOK t) (run : Execution t xs) :
    (some ⟨.pending, none⟩ ∉ xs) ∧
    (∀ q, some ⟨.need q, none⟩ ∉ xs) ∧
    (∀ k, some ⟨.failure k, none⟩ ∈ xs → color t (.failure k)) := by
  exact ⟨fun h => ok.1 (execution_preservation run _ h),
    fun q h => ok.2 q (execution_preservation run _ h),
    fun k h => execution_preservation run _ h⟩

-- Kernel trust audit. There are no project axioms, sorrys, or native_decide proofs.
#print axioms preservation
#print axioms owner_preservation
#print axioms root_no_pending
#print axioms root_no_missing_context
#print axioms settled_no_failure
#print axioms execution_root
#print axioms foreign_context
#print axioms foreign_pending
end Yield
