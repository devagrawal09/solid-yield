# solid-sound (prototypes)

solid-sound checks plain Solid 2 code (solid-js / @solidjs/web **2.0.0-rc.17**) and
ships it as written. This package holds the two prototype checking IRs that replace
solid-yield's generator model, the shared vertical slice they are compared on, and the
harness that compares them. Nothing here depends on the generator runtime or lowering.

| | |
|---|---|
| `src/codes.mjs` | the one diagnostic code table (Solid's runtime `DiagnosticEvent` pattern; runtime codes reused verbatim; legacy mapping for comparison only) |
| `SLICE.md` | the shared subset: signals / memos / props, async + Loading, handler failures + Errored; partial check (warn + worst case) for everything else |
| `CONTRACT.md`, `src/types.d.ts` | the prototype interface (`createChecker → check / update / dispose`) |
| `fixtures/` | 52 byte-identical cases from the legacy tests, the Equipment Checkout `src/` (byte-identical), 15 negative mutants; `index.mjs` holds the slice expectation and today's measured output (`legacy-actual.json`, from `legacy-run.mjs`) |
| `harness/` | `run.mjs` (scoring + timing), `vite.mjs` (the Vite plugin wrapper), `vite-measure.mjs` (cold build + HMR re-check), `dump-virtual.mjs` (debug aid for A) |
| `prototypes/dataflow/` | prototype B — own dataflow analysis, diagnostics produced directly |
| `prototypes/typed/` | prototype A — typed annotations: a syntactic transform + a phantom-typed virtual module, TypeScript as the checker |
| `COMPARISON.md` | the per-criterion comparison with the measured numbers |

## Run

```sh
pnpm install                                  # once, at the repo root
cd packages/sound
node harness/run.mjs                          # both prototypes + the null prototype, all groups → results/latest.{md,json}
node harness/run.mjs --prototype dataflow --group mutants --verbose
node harness/vite-measure.mjs dataflow --runs 5   # vite build (strict / report-only) + dev-server HMR re-check timing
node harness/vite-measure.mjs typed
node fixtures/legacy-run.mjs                  # re-measure today's checker's output (writes fixtures/legacy-actual.json)
node fixtures/extract.mjs --write             # re-derive the cases from their origins
pnpm test                                     # vitest: fixture integrity, code table vs solid-js/diagnostics.json, both prototypes on the slice
```

## Scoring

An expectation is a code plus anchors (a substring's line / column span, or a line);
every diagnostic with that code at any anchor is consumed by it. A **miss on an
in-subset fixture is a soundness failure** and is printed in a banner. An anchor marked
`imprecise` (a root instead of the read) counts as a hit and is tallied separately.
Extra errors, warnings, info, generated-code leakage in messages (`_E_`, `yield`,
`Generator`, …), unmapped locations and codes outside the table are counted. The null
prototype always runs to show the harness flags misses.

## Severity policy (Vite)

Errors show the dev-server overlay but the server keeps serving; `vite build` fails on
errors; warnings (including the partial-check `UNANALYZED_BOUNDARY`) never fail
anything; info is structured channel only.
