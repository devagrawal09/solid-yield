# Findings for Dev

Audited at `1da4d82`. Nothing in the library is fixed here. The runnable witnesses
are [counterexamples.tsx](probes/counterexamples.tsx); [runtime.spec.tsx](probes/runtime.spec.tsx)
asserts the current bad behavior. `tsc` accepts the whole probe with strict JSX
settings and without diagnostic suppression. The witness routines use no `any`
or type assertions. Test-harness const assertions only organize test cases.
The examples below omit imports; names are from `solid-yield` or `solid-yield/h`
unless explicitly stated.

Use this shared failure declaration:

```tsx
class Boom extends Error {
  readonly kind = "boom";
}
```

“Root accepted” below means the inferred view is assignable to
`View<false, never, false, never>` and the library's root check accepts it.
The [lint check](probes/lint.mjs) finds zero diagnostics from all eight rules
explicitly named in C3. With the full current recommended configuration, the
only diagnostic is the deliberate ReadAfterWait witness (F11). Thus the other
witness code also passes the full recommended rules. This still does not turn
an API counterexample outside another precondition (for example F10's failed
branding or F14's unyielded fragment) into an admissible-program counterexample.

## F01 — Exactness / route existence is false

**Rule:** §4.3(d), §4.4's converse; literal runtime readings of O2/O5/O8/O33.
**Counterexample:**

```tsx
const NeverFails = component(function* () {
  const n = yield* $memo(function* () {
    return yield* attempt(
      () => 1,
      () => new Boom()
    );
  });
  return view(function* () {
    return <b>{yield* n}</b>;
  });
});
```

The inferred failure set contains Boom, but `() => 1` cannot throw or reject.
No environment calls the unreachable handler. This uses neither widened
annotations nor a declared source color; X1–X6 do not cover it. Similarly a
constant-false branch can retain colors of never-executed code. Union folds are
upper bounds, not reachability proofs. `HoleRequires` is exactly a syntactic
union of literal members, but not exactly the requirements that execute (X4
already recognizes one instance). Do not claim a lower-bound/existence theorem
from union membership. Witness: `NeverFails` (typechecked; nonfailure follows
by the ATT-V rule, not by testing all environments).

## F02 — An unknown handler result hides a branded failure

**Rule:** R-Attempt; O39/O40; §4.3(a). `runtime.ts` HandlerCheck/AttemptOps/handle.
**Counterexample:**

```tsx
const handle = (): unknown => new Boom("hidden");
const App = component(function* () {
  const n = yield* $memo(function* () {
    return yield* attempt(() => BigInt("invalid"), handle);
  });
  return view(function* () {
    return <b>{String(yield* n)}</b>;
  });
});
render(App, el);
```

`Extract<unknown, Error>` is never, so HandlerCheck permits the handler as an
absorber and AttemptOps has no Raise. At runtime `handle` returns an Error,
which is branded and thrown. The root is typed never-failing but rethrows Boom.
Unlike an untyped crash, this failure is branded by the library itself (C7).
A return annotation of `unknown` is not an escape hatch listed in C2.
Witness: `WidenedHandler`; reproduced with library dev checks on and off.

## F03 — A broad bare prop accepts a colored source as a plain value

**Rule:** R-Prop, R-HoleP/variance; O20; §4.3(a), and (b) for a pending source.
**Counterexample:**

```tsx
const Child = component(function* (p: Props<{ value: unknown }>) {
  return view(function* () {
    return <b>{String(yield* p.value)}</b>;
  });
});
const App = component(function* () {
  const bad = yield* $memo(function* () {
    return yield* raise(new Boom());
  });
  return view(function* () {
    return <>{yield* Child({ value: bad })}</>;
  });
});
render(App, el);
```

`PropInput<unknown,...>` includes unknown, which accepts the failing Source as
a value. The child's read is statically `Read<false,never>`. `readPath` calls
`throughHole`, which unwraps that source and throws its Boom. Root accepted,
then typed failure at a failure-free root. The same overlap affects generic
“plain value or source” encodings whenever the plain value type includes a
colored source or generator. Witness: `UnknownProp`; both library modes.

## F04 — An undefined default can be typed as an always-present context

**Rule:** R-Ctx's defaulted branch, §1.4 contexts, O4/§4.3(c).
**Counterexample:**

```tsx
const C = createContext<string | undefined>(undefined);
const App = component(function* () {
  const c = yield* C;
  return view(function* () {
    return <b>{yield* c}</b>;
  });
});
render(App, el);
```

The default-value overload accepts this as YieldContext, contributing no
requirement. S11 treats undefined as no default: the setup fails with
NO_PROVIDER/context error. No context-name collision is needed. Witness:
`DefaultReader`; root accepted and missing context reproduced in both modes.

## F05 — The undefined provider exclusion fails for unknown

**Rule:** R-Prov's value premise, O34; the claimed closure of calculus F-3.
**Counterexample:**

```tsx
const C = createContext<unknown, "C">();
const Reader = component(function* () {
  const c = yield* C;
  return view(function* () {
    return <b>{String(yield* c)}</b>;
  });
});
render(() => C.provide({ value: undefined, children: Reader }), el);
```

`Exclude<unknown,undefined>` remains unknown. The refusal alternative in the
union cannot exclude undefined from that branch. The type discharges C but
Solid stores an unset value. This is distinct from a source whose _read_ gives
undefined: that source object really is present. Witness: `UndefinedProvided`;
both modes report missing context.

## F06 — Foreign edges need environment premises absent from §4

**Rules:** R-Foreign, §2.5, O43, §4.1 C6 and §4.3(b,c); D-102.

For context, the smallest handoff is:

```tsx
const page = foreign(Reader, { provided: [C] });
```

Render that page through a plain-Solid router with **no C provider**. This is
explicitly accepted by D-102, and the runtime read is explicitly allowed to
report `NO_PROVIDER` by that decision. The claim does not install a provider;
`foreign` ignores options and returns the original component/type. The exact
probe uses `Router() { return h(page, {}); }` and a yield root returning
`<Router />`. It is accepted and fails at Reader's creation (`ForeignRoot`).
C6 excludes a foreign component's _own_ failures, but this is the yield
component's context lookup after a sanctioned handoff. C1–C7 do not require the
provided claim to be true. R-Foreign/O43 still saying R=never is stale after D-102.

Pending has the analogous pre-existing gap:

```tsx
const Pending = component(function* () {
  const n = yield* $memo(function* () {
    return yield* attempt(
      () => new Promise<string>(() => {}),
      () => ""
    );
  });
  return view(function* () {
    return <b>{yield* n}</b>;
  });
});
const page = foreign(Pending); // permitted to pend
function Router() {
  return h(page, {});
}
const App = component(function* () {
  return view(function* () {
    return <Router />;
  });
});
render(App, el); // accepted, no Loading above Pending's read
```

The test pins the empty output while the source remains pending; the construction
shows there is no Loading ancestor. Root acceptance loses the foreign tag's P.
The required repair to the _theorem's premises_ is actual provider availability
and an ambient Loading contract at foreign reads. Whether to change the API is
Dev's decision. Witnesses: `ForeignRoot`, `ForeignPendingRoot`; both modes.

## F07 — h.Fragment erases all child colors

**Rule:** R-h/O7, R-Elem/O46 and root preservation.
**Counterexample:** with C and Reader as in F05 (Reader requires C):

```tsx
const App = component(function* () {
  return view(function* () {
    return h.Fragment({ children: h(Reader, {}) });
  });
});
render(App, el);
```

`YieldH.Fragment` accepts `Hole` but returns `HView<false,never,false,never>`
unconditionally. Its implementation is Solid's Fragment; the child's setup
still reads C without a provider. This is independent of the JSX fragment
compiler options. Failure and pending colors can be erased by the same signature.
Witness: `FragmentReader`; missing context in both modes.

## F08 — Eager h children can be discharged by a boundary they are outside

**Rule:** R-h “as R-Err”, O26/O27, §4.4 owner placement; analogous staging risk
for R-Load. **Counterexample:**

```tsx
const Child = component(function* () {
  yield* $effect(
    function* () {},
    function* () {
      yield* raise(new Boom("early"));
    }
  );
  return view(function* () {
    return <b>child</b>;
  });
});
const App = component(function* () {
  return view(function* () {
    return h(Errored, { fallback: "caught" }, Child());
  });
});
render(App, el);
```

Child is evaluated before the h thunk creates Errored. Its effect belongs to
the caller, not the later boundary. The h overload nevertheless removes its
failures and the root is typed never-failing. Development refuses the already
built content with BOUNDARY_CONTENT_BUILT; with library dev checks off the
effect's branded Boom reaches the root. The evidence is not that dev emits a
typed failure; the production observation is the failure-color contradiction.
`Created` guards requirements in h's provider overload, but does not guard
failure discharge for this case. Witness: `EagerEffect`; typechecked and both
mode outcomes pinned.

## F09 — Distinct kinds do not make structural values nominal instances

**Rule:** R-Err selective subtraction, O27, C2's claim that unique kinds make
structural matching nominal.
**Counterexample:**

```tsx
const e: Boom = { name: "Error", message: "shaped", kind: "boom" };
const Child = component(function* () {
  const n = yield* $memo(function* () {
    return yield* raise(e);
  });
  return view(function* () {
    return <b>{yield* n}</b>;
  });
});
render(() => Errored({ catch: [Boom], fallback: "caught", children: Child }), el);
```

Only one failure class/kind exists. The value is structurally Boom and passes
raise/KindCheck without a cast. Raise brands it, so C7 includes it. Exclude
removes Boom; `e instanceof Boom` is false, so the selective boundary rethrows
it. If §1.4 intends to admit only genuine instances, that is an extra grammar/
representation premise, not a consequence of the stated TypeScript semantics
or C2. Witness: `ShapeCaught`; root accepted, thrown object in both modes.
The test observes `[object Object]`, not a fabricated Error.message.

## F10 — Frozen raised failures are not branded

**Rule:** D-Raise/D-Attempt; D-087; O39/O40.
**Counterexample:**

```tsx
const inner = $event(function* () {
  yield* raise(Object.freeze(new Boom()));
});
const outer = $event(function* () {
  yield* attempt(
    () => inner(),
    () => {}
  );
});
outer();
```

`brand` skips non-extensible objects. The call's attempt sees an unbranded
failure and bypasses its absorbing handler. Outer is inferred never-failing
but rejects with Boom. C7's _brand-defined_ restriction excludes this object
from the main typed-failure theorem, so this alone is not a counterexample to
its restricted (a). It **is** a counterexample to “raise brands every failure”
and the unconditional attempt-discharge claim. Require successful branding
for the paper lemma; do not silently assume `Object.freeze` is a type assertion.
Witness: `frozenAbsorbed`; rejection in both modes.

## F11 — A yield union cannot enforce read-before-wait

**Rule:** O11, §3.2 memo/resumed check versus MemoOp/§4 C1–C3.
**Counterexample:**

```tsx
const n = constant(1);
$memo(function* () {
  yield* attempt(
    () => Promise.resolve(1),
    () => new Boom()
  );
  return yield* n;
});
```

Its union is Wait | Raise<Boom> | Read<false,never>, admitted by MemoOp.
Development throws READ_AFTER_ATTEMPT on resumption; production reads untracked.
No permutation-sensitive rule exists in the union. `ReadAfterWait` is a
positive tsc probe; the existing runtime test of READ_AFTER_ATTEMPT supplies
the runtime evidence. The paper host lemma proves only admission, not ordering.
The calculus's explicit C3 list omits `read-before-attempt`, but the current
full recommended lint configuration **does catch this witness**. The probe's
lint check verifies that exact diagnostic. Therefore this is a type/host-table
limitation and an ambiguity in C3's enumeration, not a demonstrated counterexample
to safety when the full recommended lint rules run.

## F12 — Written fallback and provider equations are stale/ambiguous

**Rule:** R-Err's `F̂=∅` for render-function/content fallbacks, despite fixed F-1.
**Small distinguishing program:**

```tsx
Errored({ fallback: h(FailingChild, {}), children: "never fails" });
```

R-Err as written assigns no fallback failure. `flow.ts` now uses Ops<F> and
carries FailingChild's failures even if the fallback is unreachable. O29 and
its existing type/runtime tests pin the corrected rule. This is a stale
specification, not a reappearance of the fixed implementation bug.

**Rule:** R-h's “as R-Prov” must not perform Settle before subtraction for an
eager child. Small distinguishing program (already in O49 evidence):

```tsx
h(C.provide, { value: "x" }, h("div", Reader()));
```

Its requirement is Created<C>. `Exclude<Settle<Created<C>>,C>` is empty, whereas
`Settle<Exclude<Created<C>,C>>` is C. The implementation's h overload uses the
latter order. R-h's text needs a staging distinction; Lean `provider_created`
and P-CONTEXT retain it. This is an equation ambiguity, not a new O49 defect.

## F13 — GeneratorOps drops a row setup's requirements and effect failures

**Rule:** §2.2's `GeneratorOps=Y∪OpsOfHole(R)`, R-h/O7, O30/O33 when generalized
to h-adapted rows. `holes.ts`'s row-return branch is `VY | OpsOfHole<VR>`,
**without Y**. Flow control call-form `RowOps` is a different helper and keeps Y.

Small executable shape, with C a required context:

```tsx
// Plain Solid host; no casts and no missing-provider behavior of its own.
function Rows(p: { children?: (item: number) => SolidElement }) {
  const row = p.children;
  return row ? SolidFor({ each: [1], children: row }) : null;
}
const App = component(function* () {
  return view(function* () {
    return h(Rows, {}, function* (_item: Source<number>) {
      const c = yield* C;
      return view(function* () {
        return h("b", c);
      });
    });
  });
});
render(App, el);
```

`SolidFor`/`SolidElement` are imported from `solid-js`; the complete fixture
uses exactly this adapter. `toHole` recognizes the one-argument generator and
calls runRow, whose setup reads C. The generic h output folds GeneratorOps,
loses that setup's ContextRead, and is typed settled/requiring nothing.
Both modes report missing context. Witness: `HRowLoss`.
A direct `h(For, {each:[1]}, row)` trial was **rejected** by tsc; it is not the
witness or evidence for this finding.

## F14 — “Settled” and “receives” need position-specific meanings

**Rules:** §1.1 bottom called settled versus R-Elem, and §4.3(a)'s catch wording.
A bound handler reading a pending source gives a view `<false,never,true,never>`.
That view is a settled Element by R-Elem but is not lattice bottom (W is true).
The smallest form is `<button onClick={yield* handler}>go</button>` where the
handler reads pending data. Use “all-zero bottom” separately from “render-settled.”

For receive-versus-handle, put a Child that raises B under
`Errored({catch:[A],fallback:"a",children:Child})`, with A and B distinct.
Solid's inner error boundary necessarily receives B so its library wrapper
can reject it. Only the user's fallback does not receive B. Define the position
as accepted delivery to the user fallback, not the internal interception.
Finally O46's blanket “an unyielded call in a fragment is refused” is too broad:

```tsx
const Child = component(function* () {
  return view(function* () {
    return <i />;
  });
});
const App = component(function* () {
  return view(function* () {
    return <>{Child()}</>;
  });
});
```

This settled call is an Element; the existing `SettledInFragment` type test
explicitly accepts it. C3's component-call-yielded lint can reject its syntax,
but that is distinct from R-Elem's color check. This is a counterexample to the
unqualified O46 wording, not a C3-admissible counterexample to root safety.
These are specification ambiguities, not additional runtime bugs.

## F15 — The Solid assumption list omits needed behavioral contracts

**Rules:** O14's once/after-render/hold/dispose claim, O21's seeded nonpending
claim, and all-interleavings delivery of O36.
Small programs exposing the missing premises are respectively:

```tsx
yield *
  $effect(
    function* () {},
    function* () {
      log.push("mounted");
    }
  );
yield * $memo(asyncBody, { loadingValue: "seed" });
// Bind a waiting event, remove its owner before it rejects, then settle it.
```

S5 specifies tracking and error/pending routes but does not specify initial
phase scheduling, “once,” boundary-local holding or disposal. S7 specifies
promise pending/latest result, not the initial committed value for loadingValue.
S1/S3 do not specify reports created under a disposed captured owner. A model
that repeats an empty-compute effect or discards a disposed-owner report still
satisfies the listed routing assumptions. Thus these stronger conclusions do
not follow from S1–S13 alone. P-ONCE/P-MEMO state the additional contracts;
P-EVENT limits its delivery result to a created report computation.
This is a missing-premise finding, **not an observed failure** of the mounted
once/seed behavior, and not a claim about what disposed reports actually do.

## D-116 follow-up — 2026-10-08

F16–F21 audit main `4fb160d` and read-only sugar `5e03328`. They concern the
native inference contract, not new failures of main's repaired library API.
[inference.md](inference.md) contains all 52 obligation classifications, all
15 paper-lemma restatements, full tiny witnesses and the Lean proof limits.

## F16 — Native class identity needs a matching coverage relation

**Rules:** O2/O20/O27/O52, T4; I1/I4 in the inference audit.
`class Sub extends Base {}` means a Base catch handles Sub. Distinct IDs alone
do not encode this. More seriously, `class A extends Error {}; class B extends
Error {}; const e: A = new B();` is structurally accepted: throwing e and
removing A for `instanceof A` loses the escaping B. Repeated evaluation of one
class declaration also creates distinct constructors under one declaration ID.
Require genuine class membership, sound subclass coverage and identity handling;
otherwise widen to unknown or refuse the unsupported match. The wrapper brand
does not prove its payload's native identity. The prototype documents structural
and selective-matching limits as F-S18/F-S14; no general refinement is proved.

## F17 — Unknown is top, not a universal wrapper-tag matcher

**Rules:** O26/O27/O40/O42/O43, D-112(d), I3/I4/I6.
`try { throw "offline"; } catch (e: unknown) { if (!(e instanceof Error)) throw e; }`
still throws. Neither the annotation nor handling only unknown-tag wrappers
discharges all of semantic top. A true catch-all consumes top and everything
below it, only at its actual position, with its own failures still included.
A selective catch usually leaves unknown. D-033 permits it at a library root;
foreign handoffs must handle it. This is a rule counterexample, not a reported
new main-runtime defect.

## F18 — A catch must remove only what it definitely consumes

**Rules:** O16/O26–O29/O38–O40; I3/I5.
`try { throw new X(); } catch (e) { if (flag) throw e; }` retains X.
`catch (e) { if (!(e instanceof X)) throw e; }` retains the non-X incoming part;
keeping the whole input set is sound. Add guard/handler/finalizer failures.
`try { return rejects(); } catch { return 0; }` does not absorb the returned
promise's later rejection. The branch's direct-binding rethrow traversal keeps
the full input for the conditional example, which is safe. Its short design
rule is incomplete for general flow, aliases, promise timing and completion.
The exact required rule is `Eout ⊇ (E \ G) ∪ H ∪ F`, with G a lower bound on
definitely consumed values and H/F upper bounds on handler/finalizer failures.

## F19 — Recursive inference needs sound inputs and a closed solution

**Rules:** O2/O6/O17–O21/O35/O38/O41, I1/I2.
`function a() { b(); } function b() { throw new X(); }` already defeats an
unfinished traversal; mutual recursion has the same need for closure.
`function f() { opaque(); }` requires unknown, not empty. All dynamic targets,
constructors, getters, callbacks and producer reads need coverage or explicit
contracts. Lean `call_postfix_sound` proves coverage for finite call derivations
given sound local sets and closed call edges, including recursive graphs. It
does not verify the prototype's call resolver or trusted pure/platform list.

## F20 — Safe serialization does not preserve native catch matching

**Rules:** O27/O37/O45, I4/I6; D-115 and D-116's pending wire question.
For `class X extends Error {}`, a server throwing `new X("public")` may arrive
with its label/message but without X's prototype. Client
`catch (e) { if (!(e instanceof X)) throw e; }` then rethrows. Removing X on the
strength of the wire label alone is unsafe. The prototype explicitly records
this as F-S14/F-S15 and leaves selective native wrapper matching unfinished.
Server bounds add ChunkError; matching still requires a checked wire/handler
contract. This audit does not decide whether user-visible prototypes must be
revived or assert end-to-end RPC parity.

## F21 — Native source needs a completion proof, not just KindCheck

**Rules:** O39/O40/O52, C2/C7, P-ATTEMPT/P-ENCODING; I3–I5.
`function f() { try { throw 0; } catch { return new Error(); } }` returns a value;
directly treating that catch body as a library attempt handler would raise it.
`function g() { throw "offline"; }` contributes unknown despite having no
Failure(kind) base. Generated nominal wrappers may pass KindCheck, but that
checks neither the original catch completion nor the completeness of inference.
O52 as an author-side native requirement is obsolete; its generated-wrapper
check remains useful. These are translation obligations, not evidence that all
bounded native forms are accepted or broken.
