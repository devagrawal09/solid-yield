# Two newcomer reviews: failure-check fixes

2026-10-08. Starting point: `fd0aed2`, `proto/sugar-ls`. The second review is
preserved byte-for-byte in [sugar-review-2.md](sugar-review-2.md). Its source,
config and lockfile are copied into `packages/ts-plugin-yield/test/fixtures/review2-app`;
installed dependencies and build output are excluded. The captured app currently
has Loading removed, unlike `cases/base.tsx`; it must report pending and the
uncaught submit handler. The first review's existing unchanged fixtures are reused.

## What the rerun checks

The TS service tests run both complete mistake sets and the additional boundary
and handler probes. Review 2 fixtures pin the public code and authored line,
assert one error per root, and reject related pointers into declaration files.
Additional copies cover empty/logged/intentional catches, subclass/base and sibling
matching, selective rethrow with/without an upstream boundary, residual unknown,
a Promise-returning handler, helper string throws, and unknown-hover provenance.
Original review cases are not edited to make assertions pass. Additional tests
check partial rethrow, finalizers, return-versus-await timing and Promise executors.

Native ESLint was rerun on all 18 first-review variants and 34 second-review
cases: **0 errors, 0 warnings** in each set. It remains an explicit/generated-code
lint tool; the TS plugin/CLI supplies the native checks. Vite shares the lowering
and refuses structural errors and silent catch absorption; a normal Vite build
does not run the TS event/type checks. CI must run `solid-yield check`.
The real tsserver suite remains in the gate; a real editor UI was not tested.
The current CLI also checks the saved apps directly, without editing them:
review 1's `myapp` has 3 files and 0 errors; review 2's `app` has 2 files and
2 errors (the submit handler at 30 and pending read at 18, related to render at
44). Related pointers to the same authored span are deduplicated as well.
The CLI prints each related pointer beneath its own error, rather than printing
all pointers after all errors; the two saved-app errors each relate to render.

## Review 1

| Slot | Current result | Line | Score |
| --- | --- | --- | --- |
| 1 setup read | READ_IN_SETUP | App:8 | 2 |
| 2 provider | NO_PROVIDER | App:15 | 2 |
| 3a string in setup | NATIVE_THROW | App:8 | 2 |
| 3b string in memo | NATIVE_THROW | App:8 | 2 |
| 3c event throw | EVENT_REJECTS | App:9 handler | 2 |
| 4 async rejection | EVENT_REJECTS | App:10 handler | 2 |
| 5 fallback return | Valid handling, correctly silent | — | N/A |
| 6 memo write | WRITE_IN_REACTIVE | App:8 | 2 |
| 7 timer read | Valid read, correctly silent | — | N/A |
| 8 Portal | NATIVE_FOREIGN_BOUNDARY warning | App:26 | 1 |
| 9 props destructuring | NATIVE_PROPS | App:11 | 2 |
| 10 conditional read | Valid, silent | — | N/A |
| 11 nested component | Still silent | — | N/A |
| 12 effect arity | NATIVE_EFFECT_PHASES | App:8 | 2 |

The published review says approximately **9/26**, but its scored table has
12 rows, or 24 points. The previous fixes report already records this arithmetic
mismatch. Under this task's explicit handling rule, both the fallback return and
the timer read are valid controls and excluded on both sides. The comparable
score is **9/20 before → 19/20 now**, using the review's lower async score;
using its upper score makes the before score 10/20. This is the same set of ten
actual error/foreign-boundary rows, not a new row invented to repair 26.
The separate For call and missing Loading/provider/Errored probes also pass their
regressions and are not added to the score.

## Review 2

| Slot | Current result | Line | Score |
| --- | --- | --- | --- |
| 1 fallback return | Valid handling, correctly silent | — | N/A |
| 2 string throw, including async helper | NATIVE_THROW | index:5 | 2 |
| 3 subclass caught by base | Valid handling, correctly silent | — | N/A |
| 4 selective catch of its only known failure | Valid handling, correctly silent | — | N/A |
| 5 event rejection | EVENT_REJECTS | index:6 handler | 2 |
| 6 provider | NO_PROVIDER, once | index:14 | 2 |
| 7 setup read | READ_IN_SETUP, no declaration-file pointer | index:7 | 2 |
| 8 Portal | NATIVE_FOREIGN_BOUNDARY warning | index:6 | 1 |
| 9 module state | MODULE_STATE at declaration | index:5 | 2 |
| 10 numeric generator spread | Valid JavaScript, correctly silent | — | N/A |
| 11 props destructuring | NATIVE_PROPS | index:6 | 2 |
| 12 effect arity | NATIVE_EFFECT_PHASES | index:7 | 2 |

Published score: **12/24**. Four purported mistakes are valid under the requested
contract and are excluded from both sides; the generator's old false-positive
point is removed too. On the same eight actual error/foreign-boundary rows:
**11/16 before → 15/16 now**. If correct silence earns two points in all four
control slots, the present all-slot score is 23/24, but that is not a claim that
four more errors were caught. Portal remains advisory and accounts for the lost
point in both reviews.

The missing Errored probe now reports FOREIGN_HANDOFF at `todos()` on index:18,
with render at index:44 related. The unchanged baseline's async submit handler
also reports EVENT_REJECTS at index:30; it was already unsafe and is not a clean
control. README's pending example prints one error at 11, related to render at 15.
A sibling fixture reports NotFound at the read; a selective residual reports
TypeError, and an opaque fetch residual still names unknown. The handler advice
never says to wrap in Errored. The hover regression says
`an unknown error (from fetch at api.tsx:2)`.

## Rules and limits

Catch output follows **E_out ⊇ (E \ G) ∪ H ∪ F**. Only paths that definitely
consume the incoming value contribute to G. Base classes cover subclasses by
nominal inheritance. Conditional rethrow retains the other classes; partial
handling retains the whole class. Unknown remains top after selective tests;
a genuine consuming catch-all may remove it while retaining H/F.

A returned fallback or a fallback state write is handling. An empty, bare-return
or logging-only catch gets CATCH_SWALLOWS unless an actual comment inside it says
`/* @yield-absorb: reason */`. Logging alone does not widen an unchanged binding.
JSX event failures are checked from the generated Bind failure types at their
handler; rendered boundaries cannot absorb a later event rejection. Native
render/hydrate is a foreign handoff even when the component is local. D-033's
explicit library-root allowance does not apply to that entry.

Two bulk handlers in the Todos original now have real event-failure diagnostics
at app:82 and app:121: their state/argument reads precede their API catches. The
original stays byte-identical. D-116 acceptance pins these diagnostics and checks
a copy with only wider catches returning false. The fallback is executed with a
throwing state read; client and hydrated parity still compare 27 states to the
original, and SSR compares the seeded output. The new gate snapshot step is
`native:todos:events:snapshot`; the existing typecheck stage checks the author fix.

Unfixed: runtime selective Errored matching and custom prototype revival across
the wire (F-S14/F-S15), despite the D-116 decision requiring revival; arbitrary
structural/external throw witnesses and dynamic alias coverage (F16/F19); precise
selective subtraction in reconstructed synchronous nativeTry (safe overestimate);
and arbitrary object/unknown-yield data generators. Literal primitive throws
are refused with NATIVE_THROW rather than fully admitted/wrapped as in F21.
These are explicit bounded-mode findings, not claims that the unrestricted
inference theorem is proved. A native syntax declaring an escaping event failure
is also not implemented; catch it in the native handler.
Prototype revival needs a runtime constructor registry and transport changes;
it cannot be repaired by class inference alone. External throw witnesses and
dynamic aliases need additional contracts/call tracking. Synchronous nativeTry
currently carries a combined failure type, so it safely overestimates selective
catches. Object-yield generators remain ambiguous with operation generators;
only proven primitive data yields are excluded from lowering here.

## Verification

The first focused rerun passed all **60** tests from both review files; the final
gate repeats them with the complete added probe list. The compiler inference
suite passes **9/9**, including the new control-flow and Promise contract cases.
Final build, full gate, commit hashes and baseline handling are recorded in the
completion response. The gate baseline is only extended for the added Todos
event snapshot step; failed old steps are not reclassified as passing.
