# D-116: audit of inferred native failures

2026-10-08. Main audited at `4fb160d`; fetched `origin/proto/sugar` read-only at
`5e03328ec2fcd872f87228d4dac4f21bae9fb4c1`. Sources: [calculus](../calculus.md),
[obligations](obligations.md), [paper proofs](paper.md), D-110/D-112/D-115/D-116,
and the branch's [Failure inference](https://github.com/devagrawal09/solid-yield/blob/5e03328ec2fcd872f87228d4dac4f21bae9fb4c1/documentation/sugar-design.md#failure-inference).
This is a native-mode proof contract, not a compiler implementation or a claim
that branch fixtures prove it. F16–F21 below are new audit findings; F01–F15 and
the M/P/U counts in the historical audit retain their original meaning.

## Failure sets and identity

Keep κ = ⟨p, ε, w, ρ⟩. Only ε changes. Let V be the values that may be thrown
at an admitted native failure position, including primitives. Let C be runtime
class identities, not names, TypeScript shapes, or the common Failure base.
Write D ≤ B when D inherits from B, and `inst(v, B)` for genuine runtime class
membership. Require reflexivity/transitivity of ≤ and
`inst(v,D) ∧ D ≤ B ⇒ inst(v,B)`. This assumes ordinary, stable prototypes and
matching `instanceof` behavior; custom `Symbol.hasInstance`, proxies, changed
prototypes, cross-realm values and structural inputs need a checked contract,
conservative unknown handling, or refusal when reliable matching is required.

An inferred class entry B denotes **all possible B instances, including
subclasses**, not just values whose immediate constructor is B:

```text
⟦S⟧ = { v | ∃ B ∈ S, inst(v,B) }
⟦unknown⟧ = V                    ⟦never⟧ = ∅
ε₁ ⊑ ε₂ iff ⟦ε₁⟧ ⊆ ⟦ε₂⟧       ⟦ε₁ ⊔ ε₂⟧ = ⟦ε₁⟧ ∪ ⟦ε₂⟧
```

Thus `unknown` is **top**, not lattice bottom. D-116's “floor” describes the
fallback precision of inference. Keeping known IDs alongside an unknown token,
as the prototype does, is useful for diagnostics/wrapping, but semantically
`X ∪ unknown = unknown`. The wrapper `NativeFailure<"unknown">` is a runtime
tag for one representation case; it is not by itself a universal catch test.
Full value predicates form a lattice; a finite class-union-plus-top checker may
need to widen a difference back to unknown (or retain a whole class). It need
not represent arbitrary complements exactly.

A base catch covers subclasses. A subclass catch does not remove a whole base
permission: other base instances remain. Distinct class IDs prevent unrelated
classes with identical shapes from collapsing, but do not alone encode this
inheritance rule. Generated subtraction and runtime matching must use the same
coverage relation. D-110's wrapper brand proves that the wrapper is genuine;
it does not prove that its payload belongs to the claimed native class.

## Required hypotheses

These replace the failure-specific parts of C1–C7 and P-STATE. Context identity,
owner placement, pending, may-wait and S1–S16 remain separate requirements.

- **I1 — sound local inputs.** Each admitted throw, rejected promise, memo
  read, callback, getter, constructor (including inherited constructors and
  field initializers), and expression evaluation is covered. A class-typed
  operand has a genuine membership witness or is conservatively unknown;
  TypeScript structural assignability alone is insufficient. Evaluation of
  `throw expression` may itself fail before the explicit throw. External or
  unmodeled failure behavior contributes unknown. Any deliberately excluded
  internal crash must be named in the source contract; it must not hide an
  authored throw or an opaque callee's failure.
- **I2 — sound call closure.** Include every possible dynamic target, alias,
  override and callback/producer edge in its actual execution channel; unresolved
  targets contribute unknown. Pure/platform contracts must establish their
  promised bound, including callbacks. Solve recursive groups to a closed
  upper-bound solution; never publish a truncated, still-growing iteration.
- **I3 — safe catches.** Use the rule below. Prove removal from control flow and
  matching, include handler/finalizer failures, and preserve completion kind
  (`return`, `throw`, loop transfers and await/rejection).
- **I4 — faithful representation.** Class IDs are injective for distinct runtime
  constructors and consistent for aliases. Registration, wrapper payloads,
  prototype/subclass matching, unknown coverage and generated failure types
  agree. For dynamically re-evaluated class declarations a single declaration
  ID needs an additional identity contract or refusal. Every admitted native
  failure is wrapped/recognized before it reaches the library's brand filter,
  including frozen originals. Failed witness validation is not a proof of the
  source bound: rejecting a value with NATIVE_FAILURE_CONTRACT does not preserve
  the original failure's behavior.
- **I5 — faithful lowering and sites.** Generated code passes strict types and
  full recommended lint; it preserves source catch regions, evaluation order,
  host restrictions and read/bind/creation origins. Deferred children stay below
  their boundary; fallback/handler output stays outside that boundary's filter.
  Source catches must not absorb the internal pending/control signal. A native
  operation with no admitted host translation is refused or kept at a checked
  foreign edge, not assigned an empty effect.
- **I6 — edges and transport.** Every server rejection is in its inferred body
  set or the transport's ChunkError set. Wire encoding/decoding preserves the
  class coverage and matching contract, or supplies an explicit weaker contract
  that retains residual failures. Public messages (D-115) do not prove prototype
  restoration. Foreign handoffs require empty residual ε, including unknown;
  library roots accept residual ε and rethrow/reject it (D-033). C6's actual
  providers and ambient Loading still apply.

The theorem preconditions therefore read as follows for native input:

| Precondition | Native restatement |
| --- | --- |
| C1 | Strict generated-code checking plus I1–I6; successful generated typing cannot certify the inference that supplied its types. |
| C2 | Keep the ban on unchecked color erasure and the context-identity contract. Replace distinct author kinds by I4 class identities. Unknown/any throw operands contribute top; they are not grounds for dropping a failure. This does not grant arbitrary any-based erasure in the generated program. |
| C3 | Full recommended lint on generated code, including ordering/position rules. Authored throw/catch is permitted only through faithful lowering, not exempted in generated routines. |
| C4 | One runtime/route plus consistent class registration and wire IDs for both builds (I4/I6). |
| C5 | S1–S16 unchanged; failure inference supplies no new scheduling guarantee. |
| C6 | I6 foreign/server contracts, with actual providers and ambient Loading. Native opaque operations carry unknown at the declared edge. |
| C7 | Every admitted native failure, including non-Error values and opaque rejections, enters the represented failure channel. Original values need no Failure base; generated wrappers retain the library brand contract (I1/I4). |

### Why transitive inference is an upper bound

Let A(f) be the failures that can actually escape f and E(f) its inferred set.
For a union-only region, the equations are the union of local failures, opaque
unknown and all callee summaries. Every finite escaping call derivation starts
at a covered local failure (I1) and follows covered call edges (I2). Inducting
on that derivation proves `A(f) ⊆ ⟦E(f)⟧` for any solution closed under those
equations, even when the graph is recursive. Lean `call_postfix_sound` checks
this argument. Infinite calls without a finite failure observation add no
counterexample to this safety statement.

For complete functions, compose these union rules with the catch transfer
below, not a raw union of all calls irrespective of their enclosing catches.
Structural induction on an execution's finite derivation, using I3 at each
catch, proves the same bound. With a finite set of functions and class IDs plus
unknown, monotone transfers and inflationary union updates from empty stabilize.
A safe removal predicate is fixed independently of growing summaries, or the
checker must separately establish transfer monotonicity. Verify the final
post-fixpoint: every transfer result is included in its function summary.
Leastness improves precision but is not needed for safety. This does **not**
prove that call resolution, pure contracts or expression analysis in the
prototype meet I1/I2. F19 illustrates why a fixed point alone cannot do so.

### Exact catch rule required

For input bound E, choose G, a **lower bound on values definitely consumed** by
this catch at this position: for every incoming value in G, every possible
handler path consumes the original failure instead of forwarding it. Let H
bound every failure produced by evaluating the handler (including guards,
calls, awaited rejections and explicit throws), and F bound finalizer failures.
Then choose a representable output satisfying:

```text
⟦Eout⟧ ⊇ (⟦E⟧ \ G) ∪ ⟦H⟧ ∪ ⟦F⟧
G ⊆ {v | this catch definitely consumes v on all paths}
```

This is an upper-bound rule, not an exact-execution equality. Replacement
throws belong to H even when the original was consumed. Handler rethrows may
also be counted in H; duplicate coverage is harmless. A catch-all that consumes
everything has G = V; a direct rethrow permits G = ∅ and retains E. If the
binding escapes reliable identity tracking and is thrown, add unknown. Missing
proof of a guard's coverage means keep the incoming set, not remove it. For
`catch (e) { if (!(e instanceof X)) throw e; }`, G may be `inst(_,X)` only with
the I4 match guarantee; non-X values remain. Conservatively retaining **all E**
is also sound. If only some X instances are handled, keep the entire X entry
unless the checker has a finer value predicate. Finally may replace a pending
return/throw, but unioning its failures is a safe over-approximation; unsupported
completion rewrites must be refused. A synchronous catch does not handle a
later promise rejection unless that rejection is awaited or chained inside it.

Handling semantic unknown discharges everything below top **only** for a real
catch-all at the right owner/call position, with its own H/F retained. A
parameter annotation `e: unknown`, an unknown wrapper tag, an Error-only catch,
or a selective list is not that proof. Erasing all input failures for any of
those reasons violates D-112(d). A full catch-all's removal is consistent with
D-112: it removes only routes it actually handles, regardless of imprecision
in the input bound. A selective catch of X generally leaves unknown as unknown.

**Does the branch specification meet this rule?** Its “handling removes / direct
rethrow retains / unknown use widens” statements are compatible but incomplete:
they do not define definitely consumed paths, subclass coverage, or selective
unknown subtraction. Read-only inspection of `failure-inference.js` at `5e03328`
finds that `evaluate(TryStatement)` analyzes the handler with the incoming set
bound to the catch variable; any syntactic direct `throw e`, including the
conditional example above, reintroduces the full incoming set. Non-throw,
non-instanceof references widen that binding to unknown. This covers that
example conservatively, without proving precise X subtraction. It is not a
general control-flow, mutation/alias, promise-timing or completion proof.
The branch's `evaluate(JSXElement)` also drops Errored children without inspecting
its catch attribute; the design itself records selective wrapper matching as
unfinished (F-S14). That shortcut cannot justify selective removal. No branch
code was changed or branch test suite claimed as run here.

## O1–O52, re-read against inference

**Held** means the existing abstract/relative lemma needs no new
failure-specific hypothesis. It is not new proof of the implementation.
**Restated** means use the stated native hypothesis instead of the old
nominal/yield-only premise. **Failed** means the wording cannot carry over to
native source; the replacement and tiny counterexample are identified.
Main's §6.4 repairs are taken into account; historical U findings are not
silently reported as new native regressions.

Totals: **25 held / 25 restated / 2 failed**. Failed native readings are O27's
structural subtraction and O52's author-facing kind requirement.

| Obligation | Status | Native statement or reason |
| --- | --- | --- |
| O1 PendingOf | Held | Pending projection and I.1 source contract unchanged. |
| O2 FailsOf | Restated | Union denotes an upper bound on escaping values under I1–I3, not reachable exact classes. |
| O3 MayWaitOf | Held | Bind marker remains separate from pending. |
| O4 RequiresOf/Created | Held | Context fold and staging unchanged. |
| O5 event colors | Held | Data-pending and async-work permissions remain distinct. |
| O6 always-raising hole | Restated | Nonreturning native throw retains its inferred set after lowering; include operand failures (I1/I5). |
| O7 OpsOfHole | Restated | Hole/row/fragment joins retain inferred source and setup sets (I1/I5); F07/F13 repaired on main. |
| O8 HoleRequires | Held | Exact syntactic prop union, still no reachability converse. |
| O9 setup host | Held | Generated SetupOp admits no source read/write/raise; unsupported native setup work must be refused under I5. |
| O10 view host | Held | Generated reads remain at holes; admission and positional lint still required. |
| O11 memo order | Restated | Shared/async helper lowering must preserve host and read-before-wait order; union inference proves neither (I5). |
| O12 wait hosts | Restated | Every native await/delegated wait lowers to an admitted memo/event wait (I5). |
| O13 effect phases | Restated | Inferred failures join from both phases, without moving reads/writes or treating inference as a purity proof (I1/I5). |
| O14 once after mount | Held | S14 timing/disposal contract remains required. |
| O15 event/stream exclusion | Held | Same host exclusion and plain stream-handler premise. |
| O16 handler host | Restated | Lowered catch handler retains its enclosing host and H set (I3/I5). |
| O17 component composition | Restated | Join sound inferred setup-effect and view sets, preserving owners (I1/I2/I5). |
| O18 component call | Restated | Call transfers sound inferred interface at the calling hole (I2/I5). |
| O19 setup effect origin | Held | An inner returned boundary still cannot catch a setup effect. |
| O20 props/variance | Restated | Inclusion is semantic class coverage, with unknown top; unwrapping preserves the bound (I1/I4). |
| O21 memo colors/seed | Restated | Committed failures lie in inferred ε (I1–I5); seeded pending still needs S15. |
| O22 memo read routing | Held | Cache/rethrow starts at reader, independent of how ε was obtained. |
| O23 supersession | Held | Only source settlement is suppressed; no new side-effect/cancellation theorem. |
| O24 Loading | Held | Removes pending only; passes all failure values, including unknown. |
| O25 Loading fallback | Held | Fallback stays outside own filter. |
| O26 catch-all Errored | Restated | All admitted native values are recognized at this boundary; G=V, own fallback colors escape (I3–I5). |
| O27 selective Errored | Failed | Structural Exclude / exact-ID equality is not runtime class coverage; use I3/I4, F16. Prototype matching is unfinished. |
| O28 lazy/row error fallback | Held | Outside-filter rule is independent of failure identity. |
| O29 function/content fallback | Held | Same Ops/upper-bound join as repaired main; outside filter. |
| O30 flow/rows | Restated | Join every source/branch/row/setup inferred set without erasure (I1/I2/I5). |
| O31 provider | Held | Only matching live context requirements are removed. |
| O32 self-provider | Held | Cannot affect earlier setup lookup. |
| O33 requirements | Held | Faithful requirement join unchanged; main's F07/F13 repairs and D-112 apply. |
| O34 provided value | Held | Actual non-unset-value premise unchanged. |
| O35 bind colors | Restated | Bind joins inferred event ε, including unknown, while pending becomes marker only (I2/I5). |
| O36 bound destination | Restated | Match the inferred class relation; report only to live captured boundary, otherwise reject per D-109 (I4/I5). |
| O37 selective reporting | Restated | Same predicate must govern chain scan, actual boundary and static removal (I3/I4). |
| O38 delegated event | Restated | Inferred callee set bounds failures delivered at caller; caller catch uses I3 (I2/I5). |
| O39 transform/absorb | Restated | Native catch follows JS completion, not “returned Error means throw”; lower into explicit library operations (I3/I5), F21. |
| O40 Caught/brands | Restated | Caught is an upper bound; every admitted native failure, including unknown, is wrapped before the brand filter (I1/I4). |
| O41 effect colors | Restated | Both phases' inferred failures join component; compute still holds no Loading (I1/I5). |
| O42 root | Restated | P=false/R=empty; ε may be unknown and escape via D-033. Empty ε excludes failure only with I1–I6. |
| O43 foreign | Restated | Use main's D-102 contract: empty residual ε including unknown; actual providers and ambient Loading (I6). Historical “R=never” is obsolete. |
| O44 lazy colors | Restated | Preserve child ε plus ChunkError when lowering; outside-core lazy needs declared foreign contract (I6). |
| O45 ChunkError routing | Restated | Server rejects in inferred set ∪ ChunkError, matching wire IDs/routes; safe messages alone do not prove matching (I4/I6). |
| O46 Element/fragment | Restated | Empty semantic ε required; unknown is nonempty. Generated types/lint must retain this check (I4/I5). |
| O47 lazy construction | Held | Defer children; keep fallbacks outside their filter. |
| O48 context site | Held | Creation path unchanged. |
| O49 Created staging | Held | Provider cannot discharge an earlier eager lookup. |
| O50 receipts | Held | Generated writes still need admitted delegated receipts. |
| O51 independent events | Held | Same per-call state/action and nested-transaction contract. |
| O52 KindCheck | Failed | Author classes/unknown have no required kind or Failure base. Replace with I1/I4 plus KindCheck on generated wrappers only (F16/F21). |

## Every paper lemma

The original arguments remain historical. These rows give their native
replacements, including the hypotheses on which each case argument depends.

| Paper lemma | Status | Restatement / proof change |
| --- | --- | --- |
| P-STATE | Restated | Store failure(v), require v∈⟦ε⟧, I1–I6 and original owner/source invariant; throw/call/catch cases establish COMMIT-F, then finite-prefix simulation. |
| P-FOLD | Restated | Fold semantic denotations of inferred permissions; union proof unchanged, no reachability converse; nonreturning throws keep operand effects. |
| P-HOST | Restated | Generated code satisfies original hosts/order/lint, including every helper/await/catch path (I5); inference alone proves no host purity. |
| P-COMP | Restated | Join I1/I2 interfaces from native callbacks/props/rows; preserve setup effects and view holes under I5. Union case proof unchanged. |
| P-SITES | Held | Original read/bind/creation paths and no-retroactive-boundary argument unchanged under the existing faithful-translation premise. |
| P-BOUND | Restated | Use semantic matches including subclasses and top; replace subtraction equality with I3's safe bound unless matching is exact. Fallback remains outside. |
| P-CONTEXT | Held | Context identities, set values, defaults and Created staging do not depend on failure inference. |
| P-MEMO | Restated | I1–I3 justify every committed failure, including async producer rejection; source state/S15/latest-settlement proof unchanged. |
| P-ATTEMPT | Restated | Keep library TRANSFORM/ABSORB proof for generated operations; separately simulate native completion with I3/I4/I5 (F21). Unknown must enter the typed channel. |
| P-EVENT | Restated | I2 bounds each call and I4 matches wrappers; original live-bind/caller/rejection cases plus D-109 disposal behavior apply. |
| P-ROOT | Restated | Inferred membership replaces brand-kind membership; preservation still contradicts empty ε. Root acceptance does not demand empty ε (D-033). |
| P-FOREIGN | Restated | Empty semantic residual failure set, including unknown, plus actual environment premises; foreign() still supplies no handler. |
| P-LAZY | Restated | I6 supplies ChunkError and wire match contract; existing call-site/SSR routes remain conditional on Solid, not on message serialization. |
| P-ONCE | Held | S14 scheduling/cleanup and tracked empty compute remain required; no inference-specific change. |
| P-ENCODING | Restated | C1/C3 apply to generated output; replace C2 distinct author kinds and C7 brand-only source grammar with I1–I6. TypeScript checks wrappers, not soundness of inferred sets. |

No restated row is claimed fully mechanized. Native structural typing, dynamic
call resolution, lowering, Solid scheduling and transport remain paper
obligations. The old claim that KindCheck alone establishes native membership
fails (O52/F16); its generated-wrapper part is retained in P-ENCODING.

## Tiny counterexamples and new findings

These are source-level counterexamples to the indicated rule, not claims that
each is accepted by the bounded prototype. `opaque` denotes an outside function
with no trusted failure contract. JSX snippets use native Solid boundaries.

### F16 — class equality and structural shape are not coverage

```ts
class Base extends Error {}
class Sub extends Base {}
const e: Base = new Sub();
try { throw e; } catch (v) { if (!(v instanceof Base)) throw v; }
```

The throw contributes Base; an exact runtime-constructor set `{Base}` misses
Sub. Conversely a throw typed Sub is caught by Base at runtime, so exact-ID
subtraction would leave a safe but unnecessary residual Sub. A catch of Sub
cannot erase all Base values. The class relation and value denotation fix both.
For the unsafe structural O27 reading, no cast is needed:

```ts
class A extends Error {}
class B extends Error {}
const e: A = new B(); // structural TS permits this
try { throw e; } catch (v) { if (!(v instanceof A)) throw v; }
```

Inferring A from the annotation and removing A predicts empty; runtime rethrows
B. A payload witness/unknown is required (F-S18). Even declaration IDs need care:
`function make() { return class X extends Error {}; }` creates different runtime
constructors on repeated calls. One source-position ID is not injective for them.

### F17 — unknown top is not an unknown-tag catch

```ts
try { throw "offline"; }
catch (e: unknown) { if (!(e instanceof Error)) throw e; }
```

The annotation is unknown, but the string escapes. Erasing top for an Error
catch (or for a matcher that catches only unknown-tag wrappers) is unsafe.
A generated known-X wrapper may escape that latter matcher even though X≤top.
Full catch-all consumption is sufficient; it need not prove which class occurs.

### F18 — partial handling and catch timing

```ts
class X extends Error {}
class Y extends Error {}
function f(flag: boolean) {
  try { if (flag) throw new X(); throw new Y(); }
  catch (e) { if (!(e instanceof X)) throw e; }
} // Y escapes; keeping X|Y is safe, removing both is not
function partial(flag: boolean) {
  try { throw new X(); }
  catch (e) { if (flag) throw e; }
} // X must remain
async function later() { throw new Y(); }
function g() { try { return later(); } catch { return 0; } }
// g still rejects with Y; no await puts that rejection inside this catch.
```

Also `try { throw new X(); } catch {} finally { throw new Y(); }` retains Y.
These refute unconditional catch removal. The conditional direct-rethrow case
is conservatively retained by the branch analysis inspected above; the timing
and general completion cases need their own proof, not that example's success.

### F19 — a fixed point does not repair missing call targets

```ts
class X extends Error {}
function leaf() { throw new X(); }
function a(n: number): void { if (n === 0) leaf(); else b(n - 1); }
function b(n: number): void { a(n); }
function external() { opaque(); }
```

The recursive component needs X in both summaries; a one-pass traversal may
miss one. Opaque cannot start at empty. A further tiny case is
`const f: () => void = leaf; f();`: a declared void return says nothing about
failure. A correct monotone iteration over an incomplete graph is still unsafe.
This is a missing-premise finding, not an executed branch regression.

### F20 — wire labels/messages do not prove class matching

```ts
class X extends Error {}
async function server() { "use server"; throw new X("public"); }
try { await server(); } catch (e) { if (!(e instanceof X)) throw e; }
```

A client payload reconstructed without X's prototype can retain its ID/message
and fail this test. Static subtraction of X would then be unsafe. The branch
documents this limit (F-S14/F-S15), and selective wrapper matching is unfinished.
I6 requires a consistent generated matcher/wire contract or retention/refusal;
it does not quietly decide D-116's pending prototype-restoration question.

**Runtime follow-up (2026-10-08, D-117).** The library on `runtime/failure-wire` now has a shared
constructor registry with explicit wire IDs and prototype restoration before
`Errored` selection and `attempt` rejection handling. Selective attempts retain
unmatched classes, and runtime matching includes subclasses. Production streamed
docs and real RPC after hydration pin `instanceof` and same-kind sibling escape.
This supplies the wire/class mechanism under consistent registration and
serialization-safe own-data premises; native emit must call `registerFailure`
and `prepareFailure`, preserve the represented instance, and pass runtime class
lists. The sugar branch at `ed90200` has not adopted it here. I1/I2/I5 and O27's
structural membership gap remain separate obligations; this is not a proof of
the unrestricted inference theorem. JavaScript private slots are not wire data.

### F21 — native catch completion differs from attempt return classification

```ts
class X extends Error {}
function f() { try { throw 0; } catch { return new X(); } }
function g() { throw "offline"; }
```

f returns a value. Reusing that catch body directly as an attempt handler would
raise its returned Error instead. g's authored throw must contribute unknown
and be wrapped; C7 cannot exclude it merely because it lacks Failure(kind).
This also refutes imposing O52's author-facing kind check on native input.

## Mechanization and limits

The new `Yield.Inference` namespace leaves the historical owner calculus intact.
It parameterizes class membership by `Classes C V`, proves subclass inclusion
and base-catch discharge, unknown as top, catch-all removal and selective
unknown residuals. `catch_removal_sound` checks the crucial opposite directions:
actual inputs ⊆ inferred inputs, but guaranteed handling ⊆ actual handling.
`catch_output_sound` includes handler/finalizer output. `call_postfix_sound`
checks finite recursive call derivations; `server_sound` adds transport failures;
`empty_no_failure` supplies the failure-free contradiction. All are kernel
proofs, without project axioms, unfinished terms or native_decide.

The bridge to `Yield.preservation`/`execution_root` remains P-STATE: refine
each actual value/position into an observation whose permission contains it,
and use the same handler predicate and owner path. The older Nat/list `Op`
model has not been presented as a checked native-AST or infinite-top encoding.
No Lean proof of the compiler's call graph, fixpoint algorithm, JS heap/aliases,
promise timing, wire codec or `instanceof` implementation is claimed. The
class relation and membership law are explicit parameters/hypotheses, not
new trusted axioms. See [verification](verification.md) for actual build/gate
evidence; historical probes do not exercise the sugar compiler.

## Verdict

“Typed failures are complete” survives **as a conditional upper-bound safety
theorem**: every admitted native failure delivered at a position is covered by
that position's inferred ε, so empty ε cannot leak a failure. It requires I1–I6
and the existing source/owner/Solid contracts. The compiler must check or require
sound throw/value witnesses, all call and callback targets, recursive closure,
path-safe catch removal, class/subclass and unknown matching, faithful host/site
lowering, and matching server/wire bounds including ChunkError. Generated
TypeScript acceptance alone does not establish these facts. The prototype's
documented selective/transport gaps leave the unrestricted native theorem
unproved; subtracting mismatched classes would make it false. Unknown remains
a failure requiring handling at foreign edges or failure-free positions, while
a library root may rethrow/reject it under D-033. No reachability converse is
claimed, and D-112 forbids claiming discharge merely from a wide input type.
