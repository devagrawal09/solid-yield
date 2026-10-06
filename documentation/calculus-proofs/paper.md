# Relative paper proofs

These proofs concern the explicit calculus below and its intended runtime
translation. They do not assume that TypeScript is sound. Failures of the
translation are listed in [findings.md](findings.md). Names beginning `P-` are
paper lemmas; Lean identifiers link through [the source](lean/YieldProofs.lean).

## Judgments and invariant (P-STATE)

Let a source store Σ map source identities to `(κ, state)`, where state is
`value(v)`, `pending`, or `failure(k)`. Required contexts have distinct identities;
failure identifiers denote actual failure instances of the matching class.
Let an owner tree O have an immutable parent pointer for each live node. A run
record is `(host, origin, continuation, yielded-ops, resumed, receipts)`. A memo
also has a generation number; an event has its own call record and saved bind
owner. Raw JavaScript values, expressions and scheduling are abstracted.

The **environment invariant** I is:

1. Every readable source value implements its declared source interface:
   `Σ(s)=(_,pending)` implies `p(s)=⊤`; `Σ(s)=(_,failure(k))` implies `k∈ε(s)`.
   Paths and props must preserve this property when unwrapping a value.
2. Every executed operation belongs to its routine's checked yield union.
   No ordinary expression performs an unrecorded operation. Each delegated
   child obeys its exported color. Foreign callbacks obey their edge contracts.
3. The runtime owner of each observation has the `Located` path induced by its
   creation/bind/read site. A runtime provider frame holds a non-unset value.
   Its identity and the failure matching relation agree with the static ones.
4. A typed event failure is branded and remains recognizable until handled.
   For an attempt's returned value, the static Error/non-Error classification
   agrees with runtime `instanceof Error`.

**This invariant is an independent premise.** C1–C7 of the original calculus do
not imply it (F02–F10, F13). Calling it well-typed does not prove it.

The source transition rules needed for simulation are:

```text
Σ(s)=value(v)                    Σ(s)=pending
-------------------- RD-V       ------------------------- RD-P
read(s,c) → v                    read(s,c) → pending@c

Σ(s)=failure(k)                  k∈ε(s)
-------------------- RD-F       ------------------------- COMMIT-F
read(s,c) → failure(k)@c          settle(s,k) → Σ[s:=failure(k)]

result is a value v              source permitted pending
-------------------- COMMIT-V   ------------------------- START
settle(s,v) → Σ[s:=value(v)]      start(s) → Σ[s:=pending]
```

A memo's body/failure handler must justify COMMIT-F; async eligibility or a
pending dependency must justify START. A seeded memo keeps its committed
initial value when later work starts. A superseded settlement is a stutter of
Σ. An event pending read becomes an internal wait, not a render pending output.
An effect compute pending read similarly produces no render output. These are
separate observation channels, not a subtraction of an enclosing view's effects.

**Simulation lemma.** If I holds and one of these rules, or a structural
construction rule below, occurs, it either stutters or gives a `Tick` with its
actual origin. Proof: RD-V/COMMIT-V/stale settlement produce no color observation.
RD-P/RD-F use I.1 and the corresponding `Fires` constructor. Raise uses its
failure identifier; a child uses I.2; context uses I.3. The route follows I.3
and S1–S3/S11. Deferred event/effect observations use P-SITES/P-EVENT. The
structural rules preserve `Located` by adding an ordinary frame or the relevant
boundary frame. Apply `owner_preservation`. Induction over a finite sequence
then yields `execution_preservation`; every prefix of an infinite execution
satisfies the same safety property.

This is a proof _given I and the rules_, not a proof that the JS implementation
always preserves I. It makes the missing refinement step reviewable.

## Folds and hosts (P-FOLD, P-HOST)

For each color channel x define `F(Y)(x) ≡ ∃o∈Y. color(o)(x)`.

```text
o∈Y   color(o)(x)                 ∀o∈Y. Ops(H)(o)
----------------- UNION          --------------------- HOST
F(Y)(x)                          H ⊢ routine : Y ▷ T
```

Distribution over union follows by splitting membership in `Y₁∪Y₂`.
Conversely choose the witness from either side. This proves `fold_append` and
all four projection folds; idempotence explains why an operation union loses
multiplicity. `Wait` contributes pending but not event data-pending. A `call`
contributes its P to data-pending and its A to async work. `Bind` contributes E
and W, never P. These are type-permission equations, not path-reachability facts.

`GeneratorOps(Y,never)=Y`: there is no returned value to contribute operations,
but all observations before non-return remain. For a normal returned value R,
its operations must be joined with Y. For a row returning a view, the correct
case is **Y ∪ VY ∪ HOps(VR)**; the implementation's general `GeneratorOps` drops
Y in this branch (F13). `RowOps` itself does retain Y.

Host admission is case analysis on the operation constructor and the table in
§1.3 (`Admits` in Lean). Setup admits create/cleanup/context, with “never reads”
meaning _never reads a source_, not never resolves context. JSX views admit
read/child/bind, h-views no yielded operations. Hole/hole-prop differ exactly as
the table says. Memo admits read/wait/raise/stream; compute omits wait; phase
admits only settled reads and synchronous calls, plus write/cleanup/raise/stream;
event admits read/write/wait/call/raise. `only_memo_event_wait`,
`phase_read_settled` and `event_no_stream` prove the restrictive cases.

The host table gives no temporal fact. In particular it cannot prove “read
before the first wait”: permuting operations leaves Y unchanged (F11). A JSX
hole position also requires a syntactic/lint premise. Under that premise the
transform puts the read in a render effect, and S1–S2 apply there. `runAs` saves
and restores the whole host state in `finally`; a nested run cannot overwrite
the outer run's restrictions. An attempt's generator handler is delegated,
not run in a new host, so its operations receive exactly these checks.

“Pure compute” here means _no admitted Write/Cleanup/EventCall_, not absence of
arbitrary JS mutation. Under I.2, a write can happen only by advancing a Receipt
iterator (or the separate refresh iterator). Its body checks the host in dev
then invokes the setter. Constructing a receipt never calls that setter;
production therefore also performs no undelegated receipt write. The receipt
list/development diagnostics supplement, rather than prove, the syntactic rule.

## Composition and positions (P-COMP, P-SITES)

The following rules use upper bounds, so they remain sound for branches not
taken, unread props and empty lists:

```text
s : Ysetup       v : κv
------------------------------------------------ COMP
component(s,v) : <pv, εv ∪ fails(Ysetup), wv, ρv ∪ req(Ysetup)>

child : κ       hole-props : Q           branch/source/row i : κi
------------------------------ CALL     --------------------------- FLOW
call(child,props) : κ ⊔ <0,∅,0,Q>         flow(...) : ⨆i κi
```

Proof of COMP: setup admits neither source read nor wait, so contributes no
render P; its created effects' failures and context reads occur at the calling
owner and must escape regardless of boundaries later built in v. Other setup
creations publish colored sources; they do not emit the source's later read
failures there. The view contributes its hole ops and returned HView/View ops.
Union introduction proves every case. COMP creates **no extra owner**.

Proof of CALL: the component is evaluated in the calling hole; its view's holes
are descendants. A literal hole prop is evaluated at the receiving child's
read, below every provider wrapping the call. Join its requirements Q at the
call. This is conservative if the child never reads it. A source forwarded as
a prop requires I.1; the local type no longer remembers an original hole's Q.
This proof therefore excludes loss of source contracts such as F03.

Proof of FLOW/ROW: a row's setup and view are under its mapping (S13), under the
holding hole. Apply COMP to each row, then union introduction to the source,
fallback, and every possible row/branch. Nothing is removed. Keyed persistence
changes how many times a row runs, not this bound. The claim of _exactly_ the
same requirements at runtime is false for untaken branches (F01).

**Origin lemma P-SITES.** `readOf` executes its accessor at the current observer.
By S2/S3 a pending or failed memo is rethrown there, so use the reader path,
regardless of where the memo was created. `bindEvent` captures `getOwner()` and
`boundaryAbove()` at binding; `reportError` uses that saved owner, so use the
bind path. `readContext` is executed by the setup under the calling hole, so
use the creation path. `$effect` is constructed in that same setup; its error
arm rethrows and its effect phase belongs there (S5), outside a boundary in the
returned view. Component/context lookups do not acquire a later child owner.
The three `routeAt` equations formalize these distinct choices, not their JS
implementation. Eager expressions must retain their early origins (F08).

## Boundaries and providers (P-BOUND, P-CONTEXT)

Write `t ⇑ x` for an observation escaping subtree t and `handles(b,x)` for a
boundary match. The complete routing rules are:

```text
t ⇑ x    ¬handles(b,x)            t ⇑ x    handles(b,x)
----------------------- PASS     ---------------------- TAKE
scope(b,t) ⇑ x                   deliver(x,b)

c ⇑ x                            f ⇑ x
-------------- LOAD-CHILD        ---------------- LOAD-FALLBACK
scope(L,c) ⇑ x if x≠pending       Loading(c,o,f) ⇑ x
```

The `on` branch is filtered for pending by the same L, as S8 states, even though
it is read beside the boundary. No assertion about visible fallback follows
from S8. All failures/markers/requirements pass L. An error boundary handles
`failure(k)` iff k is in its catch set; without catch its predicate is True.
It passes pending and contexts. Its fallback is always outside its filter.
A provider handles precisely a live requirement with equal context identity;
it passes all other observations. The Lean `discharge` equivalence proves both
directions of PASS; the specialized lemmas compute the three cases. TAKE's
input color follows from `boundary_position`. Applying PASS to every earlier
ancestor and TAKE to the first matching one proves `route_nearest`.

A static catch set matches the runtime `instanceof` set only under I.3.
Distinct kind literals distinguish ordinary instances but do not ensure that
an accepted value is an instance (F09). “An Errored never receives an excluded
class” must mean _its user's fallback never receives that class_. The Solid
boundary internally receives it and the library's fallback wrapper rethrows it.
The fallback wrapper is not the user's fallback position.

For context lookup, use S11 at the creation path. If the nearest matching frame
has a set value it supplies the read; if none exists a real default supplies
it; otherwise emit an unmet requirement. A source or generator object is a set
value even if a later read gives undefined. A raw undefined is not. This
justifies the provider filter only if its value is actually set; F04/F05 show
that TypeScript does not always enforce this condition.

Staging for eagerly created views uses two forms of obligation, `live(C)` and
`created(C)`. A provider being built removes only live(C). At the surrounding
view boundary, Settle moves created(C) to the surrounding component's requirement.
Thus `(Settle ρ) \ {C}` is not interchangeable with
`Settle(ρ \ {live(C)})`: for `ρ={created(C)}` the former is empty and the latter
is `{C}`. The h-provider overload uses the latter. R-h's shorthand “as R-Prov”
must preserve this order. A self-provider is below the setup read, so it cannot
supply it. Identity at runtime is a context object; static identity must agree
(C2's distinct-name/type restriction, plus I.3).

## Memos, attempts and events (P-MEMO, P-ATTEMPT, P-EVENT)

For an unseeded memo let `κs=<pend(Y)∨async(R), fails(Y),0,∅>`.
On its first run a value preserves I.1 immediately. A wait or a returned handled
stream justifies pending. A read failure, raise, or transformed attempt failure
is in fails(Y) by induction over delegated operations. The value/failure is
stored at the memo, not delivered at its creation. At each read apply RD-P or
RD-F and P-SITES. Async resumption does not remove operations from Y, so the
same color bound applies after a wait. `resume` has no stale-run cancellation
branch; it continues each generator. By S7 only the latest result updates Σ,
so a superseded result/failure changes no source state. This proves the
color part of O21–O23 under I, not arbitrary JS side-effect isolation.

For a seeded memo, one additional Solid contract is required: `{loadingValue:v}`
installs a committed value before a pending first computation and keeps a value
readable while work is in flight. Under that contract START retains the prior
value and P is false. S7 by itself does not specify this seeded behavior.

An attempt is a delimited call catcher, not a general catch around its host:

```text
fn → value(v)                       fn throws/rejects e
-------------------- ATT-V          ---------------------- ATT-H
attempt(fn,h) → v                    attempt(fn,h) → handle(h,e)

h(e) ⇒* returns Error(k)             h(e) ⇒* returns nonError(v)
----------------------- TRANSFORM   -------------------------- ABSORB
handle(h,e) → raise(brand(k))         handle(h,e) → v
```

For an event call, ATT-H additionally requires a brand and excludes
NotReadyError. A crash bypasses the handler. Plain sync throws and promise
rejections have handler input unknown; an event call's branded failure has its
call color as input **provided that color was preserved by the callee**.
`HandlerYields` is joined because each delegated handler operation runs in the
same driver/host. Its own raise escapes; a returned Error adds a Raise; an
absorbed value contributes to the result type. Conditional Error/non-Error
classification must match runtime (I.4): HandlerCheck does not guarantee that
for `unknown` (F02). Branding must succeed (F10). Under these premises the
TRANSFORM/ABSORB cases prove the claimed output bound.

A stream's future failure runs a plain handler: Error rejects the next result,
void closes the iterator with done=true. Generator handlers are rejected; event
hosts do not admit StreamAttempt. No synchronous stream operation waits just
because a future iterator can wait. A memo returning that stream gets pending
from its return type. This distinction matters for O1/O12's word “wait.”

For events each call allocates `rec`, `handled`, and the development receipt list
inside the call/action; none is shared with another call. `eventSteps` feeds a
wait promise to the action and resumes inside it. S6 supplies the write-holding
and nested-transaction properties. “Independent” means no supersession, not
isolated simultaneous transactions and not that nested calls are separate
transactions: S6 explicitly joins them.

On failure of a bound call there are three cases. If the call is handled,
its failure goes to the caller through the iterator/promise. Otherwise the
captured catch chain is scanned. If a match exists, `reportError` creates a
render computation at the bind owner; S1/S3 and `route_nearest` give the first
matching ancestor. If no match exists, `route` declines and the promise rejects.
No creation-site boundary is consulted. This proves O36/O37's branch selection
when a report computation is created; it does not prove display/liveness after
disposal of the captured owner. The advertised all-interleavings behavior needs
an owner-lifetime contract for that stronger claim.

## Root and foreign edge (P-ROOT, P-FOREIGN)

The root judgment is `p=⊥ ∧ ρ=∅`; it intentionally imposes no ε restriction.
Suppose a pending observation escapes. Preservation yields `p=⊤`, contradiction.
Suppose a context read has no provider: its requirement escapes, so preservation
yields membership in empty ρ, contradiction. A failure escaping to the root is
in ε; when ε is empty that too is a contradiction. Otherwise the outcome is
root rethrow/rejection, not successful settled content. Root acceptance alone
does not mean failure-free. These are `root_no_pending`,
`root_no_missing_context`, `root_failure_in_color`, and `settled_no_failure`.
For any inner boundary input/caller position apply the same argument to that
subterm and its input color. Internal pending in a memo, compute or event is
measured at that routine's channel; an effect/bind suppresses the _render_
channel, not the routine's declared permission. May-wait does not prevent a
view from being a settled Element.

For a foreign edge require:

```text
ε(C)=∅   ρ(C)⊆Q   Q⊆Providers(actual creation path)
p(C)=⊤ implies a Loading above every possible foreign read site
-------------------------------------------------------------- FOREIGN
foreign(C,{provided:Q}) is safe in this environment
```

There is no dynamic discharge construct here: `foreign` is identity, returns
C's original type, and ignores its options. The first premise prevents typed
failure crossing. The next two ensure actual context lookup succeeds
(`foreign_context`). The last supplies the pending destination lost when
foreign code erases colors. No static root proof can manufacture these
premises from a JSX tag. F06 records both missing contracts in §4.1.

## Lazy import, once effects, and the encoding (P-LAZY, P-ONCE, P-ENCODING)

A lazy wrapper adds pending plus ChunkError to the loaded view's colors. On
client rejection it constructs/branded a fresh ChunkError. A catch-chain match
causes the failed component to throw at the call site; otherwise the microtask
throws out of band and the failed call shows nothing. On the server the Solid
lazy/boundary contract contains the failure in its fragment. These branches
preserve the failure bound but do not all throw synchronously from render.
Reset creates another load attempt; the same bound holds. The phrase “otherwise
the loaded component's colors” must still include ChunkError before import
success, as D-100 requires. SSR containment needs the server contract; S4's
simple synchronous rethrow wording alone is insufficient.

An empty effect compute reads no source, so under Solid's dependency tracking
contract there is no dependency change to schedule another run of that effect
instance. Its phase admits only settled reads and is untracked (S5). The wrapper
registers its collected cleanups with Solid, reversing the local cleanup list.
To conclude “once after first render, delayed while its enclosing Loading is
pending, and on disposal cleans up” additionally assumes Solid's effect mount,
hold and disposal contract. O14's three tests distinguish boundary-local holding
from a global graph-settled claim. S5 does not state that contract in full.
Recreating a component creates a new effect instance; this is not global once.

TypeScript conditional types implement the _syntactic_ folds by union
distribution; `true extends P` treats boolean as may-pend. `never` is empty.
Readonly source/view fields support permission widening. Elements demand
P=false, E=never, R=never, with arbitrary W. Fragment rejection depends on C1's
JSX options and still permits an already-settled unyielded call; the syntactic
no-unyielded-call rule is lint's. `KindCheck` checks literal-kind shapes at the
named raise/handler/catch/Props entry points; it does not prove uniqueness,
prototype membership, or successful branding. T2/T4's existing exclusions and
F09/F10 are separate facts.

A compiler satisfying §7 must supply a translation preserving I, host admission,
color bounds and the three origin paths; then P-STATE and P-ROOT compose into a
safety theorem. It must not copy F02/F03/F07/F08/F13's erasure. It may change owner
layout only with a relation preserving nearest matching handlers and provider
availability. §4(d)'s general route-existence converse has no such proof: effect
unions forget reachability. No finite set of TypeScript examples, including the
existing type tests, establishes equivalence between tsc and this model.
