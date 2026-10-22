# Dataflow — precision results (D-133)

Measured on `solid-sound-dataflow-prec`, from `82995c2`, with Node 24.18.0,
macOS and Solid/@solidjs/web 2.0.0-rc.17. B remains an interpreter over the
TypeScript AST; the TypeScript checker supplies symbols, declarations and types.
No generated checking program or user failure contract was added.

## Outcome and remaining dispute

**Precision improved from 13/15 hits, 7 extra errors and 8 extra warnings to
14/15 hits, zero extra errors and zero extra warnings. The requested raw 15/15
and zero soundness failures were not reached.**

The sole miss is `op-loading-reactive-key-mutant`. It exports a pending App but
never renders it or hands it off. SLICE.md explicitly requires information, not
an error, for that situation. B retains COMPONENT_OBLIGATIONS_EXPORTED and its
pending component fact. Adding a real renderer reports the boundary error; an
outer Loading can discharge it. DISPUTES.md records the contract conflict and
two passing rc.17 runtime probes. No expectation was edited, filtered or counted
as passing. Its known-failure entry remains unchanged.

## Frozen suite

Hits below count expectation entries, not individual emitted diagnostics. The
first six rows are disjoint and cover all **173 fixtures**. Context cases are
separated from the original cases even though both use the harness cases group.

| Group | Fixtures | Error hits | Warning hits | Misses | Extra errors | Extra warnings |
|---|---:|---:|---:|---:|---:|---:|
| Context cases | 29 | 16 | 3 | 0 | 0 | 0 |
| Original cases | 52 | 25 | 5 | 0 | 0 | 0 |
| Equipment Checkout | 1 | 3 | 2 | 0 | 0 | 0 |
| Mutants group | 27 | 27 | 1 | 0 | 0 | 0 |
| OpenClaw | 34 | 17 | 0 | 0 | 0 | 0 |
| OpenClaw precision | 30 | 14 | 0 | 1 | 0 | 0 |
| **All** | **173** | **102** | **11** | **1** | **0** | **0** |

- Raw in-subset soundness failures: **1**, the disputed export above.
- Mutants: **57/58 detected**; **1 missed**, that same fixture. Old groups remain
  **43/43**; precision is **14/15**.
- The other **143 fixtures** retain zero misses, zero soundness failures and
  zero extra errors/warnings. A direct score comparison with the original B
  loaded from `82995c2` found **no regressions**, including required warnings.
- All **15 precision negative controls** emit zero errors and zero warnings.
- Installed dependency diagnostic locations and component facts: **zero**.
- Required info: **5/5**. Leakage, unmapped locations, unknown diagnostic codes,
  imprecise hits and crashes: **zero**.
- Thirteen B-only precision pin entries tightened. Other prototypes’ entries,
  all fixtures, shared contracts, harness code and COMPARISON.md are untouched.

### Every precision pair

Every control below has zero extra errors/warnings; every mutant also has zero
extras. Each mutant has one expected error.

| Pair (op- prefix) | Mutant hit | Mutant miss |
|---|---:|---:|
| loading-url | 1 | 0 |
| loading-reactive-key | 0 | 1 |
| focus-repair | 1 | 0 |
| machine-class | 1 | 0 |
| machine-members | 1 | 0 |
| held-callback | 1 | 0 |
| held-ref | 1 | 0 |
| native-listener | 1 | 0 |
| set-add | 1 | 0 |
| dependency-machine | 1 | 0 |
| dependency-string | 1 | 0 |
| e24-remove | 1 | 0 |
| e28-keydown | 1 | 0 |
| e30-select | 1 | 0 |
| e40-reselect | 1 | 0 |

## What each false-positive class needed

| Class | Model / evidence |
|---|---|
| Reset keys | Loading.on is a tracking key expression under outer boundaries, not a callback. Holding a throwing function as a key does not execute it. Pending keys and pending children are tested separately. Reset ordering remains deferred. |
| Imperative class machines | Fresh instance member tables, captured outer bindings, constructor arguments, fields, methods/getters and this receivers. Following start reaches the mutant’s real pending memo read in effect apply. Extracted methods are not bound; arrow fields retain their receiver. Unsupported inheritance/decorators/replacement constructors warn and keep unknown failures. |
| Ordinary get/hasTag/computed calls | Existing member-body analysis already passed both controls. No names acquire reactive-source facts; the real memo-read mutant still fires. |
| Held callback/ref bodies | Existing forwarding already preserved known safe and throwing bodies. The new merge model also preserves selected callbacks rather than losing their bodies. Ref ownership/cleanup remains deferred. |
| Focus repair | Existing scope separation already kept caught pre-task failures out of the queued task. Native Array/DOM operations stay native; the injected predicate inside the task remains an uncaught failure. |
| Native receiver operations | removeEventListener now has an actual default-lib contract. Safe receiver operations hold arguments: removing a listener or adding a function to a Set does not execute it. Injected lookalikes and direct callback invocation still fail. |
| Installed packages | Exclude installed paths, linked package targets, declarations and external-library files before collection/body analysis, with a reporting guard too. Over-inclusive installed roots produce no facts or diagnostics. Calls and constructors use declaration information and retain unknown failure at the app site, even when the installed body looks safe. |
| Unknown dependency results | Missing result shapes warn at the app call and keep worst-case values. A method call alone does not prove a pending read. Rendering an unknown result still carries its pending/failure obligations. Typed imperative results remain held. |
| E24/E28/E30/E40 defaults | merge keeps object/props layers lazy, reads right-to-left and skips undefined. A known safe supplied body replaces a throwing default. Optional/injected overrides still carry unknown failures; no-op defaults do not discharge D-129. All four controls lose their errors/warnings and all four mutants still fire. |

Native Error subclasses without custom constructors remain ordinary error
values. This avoids adding an unsupported-inheritance warning to an existing
throwing-error case. General heap mutation, dynamic class shapes and the other
FUTURE.md rules are not claimed as solved.

## Timing

The required commands ran sequentially, without modifying the fixtures:

```sh
node harness/run.mjs
node harness/vite-measure.mjs dataflow --runs 5
pnpm test
```

All three exited **0**. Harness exit 0 is not proof of zero misses: its report
explicitly lists the one raw soundness failure above. Tests accept that exact
unchanged pin, not a blanket expected failure.

Harness measurements use medians of three fresh checks per fixture:

| Check | ms |
|---|---:|
| Cases total (81 fixtures) | 8648.4 |
| Equipment cold | 162.4 |
| Mutants total | 2941.3 |
| OpenClaw total | 3802.1 |
| OpenClaw precision total | 3131.2 |
| Equipment incremental, trivial | 57.9 |
| Equipment incremental, semantic | 56.6 |

Equipment errors before/trivial/semantic remain **10/10/10**.

Vite, five runs: plain build **28 ms**, strict sound build **203 ms**; the last
strict checker itself took **172 ms**, reporting **10 errors / 2 warnings**.
Strict build failed on those expected errors; report-only completed in **189 ms**.
Dev entry transform: **24 ms**. HMR re-check median: **52.0 ms**, five edits,
**10 errors** after each edit. An additional JSON-recorded repeat measured
26/168 ms plain/strict and 49.7 ms HMR; these are host timing samples, not a
speedup claim.

## Tests and size

- `pnpm test`: **16 files, 285 tests passed**, including 12 new static precision
  tests and two new rc.17 runtime probes.
- The checker sources also pass TypeScript checkJs and `git diff --check`.
- Implementation delta: **+226 net lines**: analyze +142, values +11, solid 0,
  new project boundary +73.
- New prototype-local tests: **160 lines** (120 static, 40 runtime).
- Documentation and the B-only pin reduction are separate from that code delta.

This is finite fixture evidence, not a claim of general JavaScript soundness.
The remaining root-contract dispute is deliberately visible.
