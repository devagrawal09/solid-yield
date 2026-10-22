# C / oxc — precision results

macOS arm64; Node 24.18.0; pnpm 11.20.0; Solid 2.0.0-rc.17.
Branch: solid-sound-oxc-prec, starting at 82995c2. Oxc, own symbols, platform
table, annotation reader and graph are retained. No TypeScript is loaded.

## Outcome — one frozen expectation remains disputed

Precision improves from **13/15 hits, 22 extra errors and 24 extra warnings**
to **14/15 hits, zero extra errors and zero extra warnings**. All 15 negative
controls have no errors or warnings. No fixture gets worse than the starting
checker. Every other group keeps all its requirements, with no extras.

**The requested 15/15 and zero-soundness-failure target is not fully reached.**
The raw score retains one soundness failure and one missed mutant:
op-loading-reactive-key-mutant exports App but never renders or hands it off.
SLICE.md explicitly says that this is not an error: its pending obligation must
be COMPONENT_OBLIGATIONS_EXPORTED, at info level. The frozen fixture instead
expects an uncovered-root error. The obligation is retained, not silenced.

DISPUTES.md records passing compiled rc.17 runtime evidence: a caller's Loading
covers this same pending sibling. Static tests check export alone (info), direct
render root (required error at the read), and caller Loading (covered). The
existing frozen runtime probe mounts its version directly as a root; that
renderer is absent from the static fixture. No frozen expectation was edited.
The earlier ref-read dispute was already resolved in the starting revision.

The green suite checks a tightened exact pin. It does **not** mean this remaining
required error was hit. The miss stays visible below and in the saved scores.

## Every frozen group

Hits count expectation groups, not individual diagnostics. Warning hits include
all required warnings. All five required info findings also hit. Mutants include
the original and both OpenClaw groups.

| Group | Fixtures | Error hit/required | Miss | Warning hit/required | Extra error/warn | Soundness failures | Mutant hit/total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| all | 173 | 102/103 | 1 | 11/11 | 0/0 | 1 | 57/58 |
| cases | 81 | 41/41 | 0 | 8/8 | 0/0 | 0 | 0/0 |
| equipment | 1 | 3/3 | 0 | 2/2 | 0/0 | 0 | 0/0 |
| mutants | 27 | 27/27 | 0 | 1/1 | 0/0 | 0 | 27/27 |
| openclaw | 34 | 17/17 | 0 | 0/0 | 0/0 | 0 | 16/16 |
| openclaw-precision | 30 | 14/15 | 1 | 0/0 | 0/0 | 1 | 14/15 |

All 43 pre-precision mutants still fire; 14/15 precision mutants meet their
frozen error expectation: **57/58 overall**. There are no new misses or extra
errors/warnings in any group. No crashes, imprecise/unmapped locations, message
leaks or unknown codes were found. Equipment retains exactly ten errors and
two warnings, including all eight injected-API controls. Per-fixture scores,
including every negative and paired positive, are in precision-measurements.json.

## What each false-positive class needed

- **Loading reset keys:** evaluate on as a tracked value, never as a handler or
  an invocation of a held function. Genuine onClick failures still fire. Reset
  ordering and retry behavior remain deferred.
- **Imperative classes:** keep per-construction objects, methods, getters,
  fields, constructors and lexical receiver facts. Follow the actual bodies.
  The class positive's real pending memo read now fires in effect apply.
  Unsupported class shapes still warn and widen; class components are not added.
- **Unknown methods:** retain unknown failures and returned values without
  inventing a Solid accessor read at the method call. Exposing an opaque return
  through a memo still makes that accessor possibly pending.
- **Focus repair:** Array.find checks its predicate and returns element facts,
  not the predicate result. Native DOM elements and known absent optional arms
  stay distinct. Earlier caught injections do not leak into the task; the
  injected predicate inside the queued task still fails.
- **Native APIs:** document/window listener methods and native Set receivers
  retain their contracts. Injected lookalikes remain unknown. A method name
  alone never earns a platform exemption.
- **Held callbacks and refs:** preserve known bodies through forwarding and
  lazy props. A supplied throwing body still fails. An annotation is not a
  safety promise; the existing body-wide callback failure rule remains.
- **Merge defaults:** keep lazy prop reads and real override order, including
  nested and absent/undefined overrides. No-op defaults do not erase supplied
  unknown callbacks. Public optional inputs keep their injectable arm even when
  a local renderer omits them; known supplied safe bodies remain precise. A
  paired test also protects Equipment's public-input D-129 contract.

## D-133 installed-package boundary

Installed bodies are excluded before interpretation, not filtered out of a
finished diagnostic list. Original node_modules paths, canonical package roots,
linked real paths and over-inclusive installed roots keep the boundary. App
imports are resolved before linked extra roots. Installed implementations are
not read or parsed. Calls use declarations, including adjacent declaration
files. Declaration initialization cannot create body closures, even when a
permissive parser accepts a body in a declaration file.

Without declarations, unknown failure/result facts and a partial warning stay
at the app call. A local catch handles failure; removing it still fails there.
An unknown returned value retains worst-case obligations, without pretending
that an ordinary unknown method is itself a pending accessor.

Independent tests cover linked/unlinked packages, declarations/no declarations,
extra checked roots, declaration body distrust and HMR updates. They verify that
implementation/probe files are never read and diagnostics stay in the app. Both
frozen dependency pairs now have no internal findings or extra app findings.
Neither installed package implementations nor copied OpenClaw sources ran.

## Inference-needed and worst-case sites

These are per-check counts, not dynamic invocation counts. Requests are distinct
file/start/reason pairs; inference locations deduplicate those requests. Worst
sites are distinct spans where failure/result facts are widened, including
annotation-only calls and partial boundaries. Partial sites count
UNANALYZED_BOUNDARY warnings: not every unknown failure requires that warning.
Declaration-only functions still need failure inference under D-129.

| Group | Inference locations | Requests | Worst-case sites | Partial sites |
|---|---:|---:|---:|---:|
| all | 58 | 62 | 59 | 8 |
| cases | 18 | 21 | 18 | 8 |
| equipment | 13 | 13 | 12 | 0 |
| mutants | 12 | 13 | 12 | 0 |
| openclaw | 0 | 0 | 0 | 0 |
| openclaw-precision | 15 | 15 | 17 | 0 |

The 15 precision inference locations are legitimate injected/dependency calls.
Their unknown failures, catches and handler obligations remain. They do not
create extra warnings merely because declarations supply no failure guarantee.

## Timings

Five fresh checker instances per fixture, with parser/checker modules already
loaded. Sums are sums of per-fixture medians, not process-start/full-sweep times.

| Group | Median fixture cold ms | Sum of cold medians ms |
|---|---:|---:|
| all | 0.31 | 59.67 |
| cases | 0.32 | 26.16 |
| equipment | 7.46 | 7.46 |
| mutants | 0.36 | 9.36 |
| openclaw | 0.32 | 10.71 |
| openclaw-precision | 0.21 | 5.98 |

The required shared harness used three cold runs. Its group medians and
trivial/semantic Equipment update times are saved in precision-validation.json.
The separate five-run Vite measurement reported:

- [oxc] cold vite build (median of 5): plain 25 ms; with sound plugin 13 ms (check itself 8 ms; 10 errors, 2 warnings)
- [oxc] strict build FAILED on errors (as the policy says); report-only build completed in 30 ms
- [oxc] dev server: entry transform 24 ms; HMR re-check of EquipmentRow.tsx median 4.2 ms over 5 edits (10 errors after the edit)

Strict failure is expected because Equipment contains deliberate errors. Its
early-stop time is not a full-build comparison. Report-only completes, and HMR
keeps all ten errors. These fixture timings do not establish full OpenClaw
scalability or a speed improvement over the other prototype.

## Size, checks and reproduction

Checker plus standalone Vite source: **1,799 → 2,002 physical lines (+203)**,
including comments/blank lines. New tests: 267 lines; measurement driver: 89
lines, separate from the checker count. No dependency, TypeScript capability,
suppression, user failure contract or fixture-specific rule was added.

Setup passed: pnpm install --frozen-lockfile --prefer-offline.
After the final code change, these ran sequentially in packages/sound:

1. node harness/run.mjs — exit 0; C's raw miss remains visible.
2. node harness/vite-measure.mjs oxc --runs 5 — exit 0.
3. pnpm test — **286 passed, 16 files, zero failed**.

The suite includes 15 new precision tests, the compiled rc.17 dispute probe,
and a TypeScript-blocked child process checking all 173 frozen fixtures and
loading C's standalone Vite wrapper. The static TypeScript import scan passes.
Only oxc's precision pins were tightened (18 fixtures). Other pins, frozen
sources, harness, specs, decisions, other prototypes and COMPARISON.md were not
edited. results/latest.* is not committed. Debug files were removed.

Reproduce detailed scores and inference locations with
node prototypes/oxc/measure-precision.mjs. It writes precision-measurements.json.
precision-validation.json records required command outcomes, shared timings,
Vite summaries, source delta and the no-regression comparison.
