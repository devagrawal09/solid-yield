# Semantic conformance harness (D-039)

A deterministic oracle for the library route. Each scenario is one program written twice: once in handwritten Solid (`sources/<name>.reference.jsx`, the oracle) and once in the library's strict dialect (`sources/<name>.library.tsx`). Both run through the same steps. The harness compares their observable traces: recorded events, not output snapshots or runtime internals.

The harness is ported from the Solid fork (`packages/web/test/conformance` on `experiment/iterable-signals`). There it judged the `$`-block proposal and yield components through a yield compiler. Here it judges `solid-yield` alone.

- The coverage matrix, the declared differences and the route findings are in [COVERAGE.md](./COVERAGE.md). It is generated, so it cannot drift from what runs.
- Each difference is a finding, recorded in `documentation/DECISIONS.md` (D-039, D-069).

## Running

```sh
# from packages/yield; this is the gate's pkg:yield:conformance step
pnpm run test:conformance
```

That runs four things, in order:

1. `vite.config.conformance-server.mjs`: the server environment (node, the `node` condition, `__SERVER__`). It writes `__artifacts__/`.
2. `vite.config.conformance-hydrate.mjs`: the hydrate environment (jsdom). It reads `__artifacts__/`.
3. `vite.config.conformance.mjs`: the client environment (jsdom). It covers fresh render, the self-tests, the route comparison and the matrix.
4. `test/conformance/lint.mjs`: the library sources, linted with the twins' lint (the `recommended` rules plus no explicit `any`, with type information).

The library sources are also type-checked by `pnpm test-types`: `tsconfig.json` includes `test/`, and maps `conformance` to `harness/scenario-api.ts`.

After an intentional change, update the goldens, the artifacts and the matrix with `vitest run --config <config> -u` (server first), then review the diff. The goldens and the reference artifacts are the specification.

## What runs

```
scenario (sources + steps + per-mode expectations)        scenarios/index.ts, scenarios/declared.ts
   │  mode.source picks the reference or the library source
   ▼
reference: @solidjs/compiler transform()                  harness/module.ts
library:   vite-plugin-solid-yield transform() (the yield rule), then @solidjs/compiler transform()
   │  TypeScript strips types; imports bound to the environment's solid-js / @solidjs/web / solid-yield
   ▼
runner: mount | stream SSR | hydrate, then drive steps    harness/runner.ts
   │  instrumented through `import { h } from "conformance"` (harness/trace.ts)
   ▼
trace: ordered strings, one observable event each
   ▼
judge(expectation, oracle trace, candidate trace)          harness/compare.ts
```

- **Real compiler output only.** The library route is the two steps an app's Vite config takes (`solidYield()`, then `solid()`), run with the published `@solidjs/compiler`. The evaluator rewrites only the import/export lines the compilers emit, and fails loudly on anything else.
- **Environments.** Each environment resolves `solid-js`, `@solidjs/web` and `solid-yield` to a different build: the development client builds, the server builds, or the hydrating client. Compiled scenario code is evaluated against exactly those modules.
- **Modes.** There are six:
  - `client/reference` and `client/library`;
  - `server/reference` and `server/library`;
  - `hydrate/reference` and `hydrate/library`. Each hydrates its paired server mode's pinned output.
- **Oracles.** The three `*/reference` modes run the handwritten source on published Solid. Each is pinned to a golden trace (`golden/<scenario>.<env>.trace`). A change in Solid's own semantics shows up there and is reviewed as Solid's, not as a library regression.
- **Server artifacts.** Every server mode's complete streamed output is pinned under `__artifacts__/<scenario>.<mode>.html` (`toMatchFileSnapshot`). The hydrate environment reads those files. `*.server-reference.html` is plain Solid and is the oracle. `*.server-library.html` is the library route.
- **The compiler route.** `__artifacts__/compiler-route/*.server-yield-compiled.html` is the fork's blocks-compiler server output for the three row scenarios, frozen. `routes.spec.ts` compares it with `server/library`. Any difference must be declared exactly in `scenarios/declared.ts` (`routeFindings`): both key lists, and the markup only one route emits. Nothing is normalized beyond that.

### Expectations

By default a candidate is `equivalent`: its trace must equal the oracle's exactly, in order and multiplicity. Anything else is declared per scenario and mode in `scenarios/declared.ts`, with a reason and a decision:

| status | meaning |
| --- | --- |
| `differs` | An intentional, reviewed difference. The exact expected trace is given, either in full or as exact edits of the oracle's. |
| `known-defect` | A defect the scenario isolates. The mode must keep diverging; when it stops, the test fails and asks for the entry to be flipped. |
| `not-applicable` | The scenario cannot be expressed in the mode. |

Two files check that the comparator catches real regressions. `self-test.spec.ts` plants a missing cleanup, a duplicate event write, a stale async commit and an owner mismatch in real scenario sources. `hydrate-self-test.spec.ts` plants a hydration-key mismatch, checks that the library client cannot hydrate the compiler route's markup, and plants a call-form fallback written as JSX in loading-fallback-hydration: built with the holding view, it claims a key the server never rendered (D-092; `server.spec.ts` pins that mutant's own server output). `harness/mutate.ts` requires every edit to match exactly once, so a self-test cannot pass vacuously.

`CONFORMANCE_DUMP=1` prints both traces side by side on a divergence. `CONFORMANCE_DUMP=json` prints the candidate's trace as JSON, for declaring a `differs`.

## Adding a scenario

1. Write `sources/<name>.reference.jsx` in plain Solid and `sources/<name>.library.tsx` in the library dialect. The library source must type-check and lint clean.
   - Instrument with `import { h, NotFound } from "conformance"`. `h.signal` / `h.$signal` trace reads and writes. There are also `h.run`, `h.log`, `h.owner`, `h.task`, `h.value`, `h.caught`, and `h.peek`, an untraced read for a row's trace label.
   - Export what the steps drive as live bindings (`export let setX`). In the library source these are `$event`s, since a setter writes only inside a routine (D-028).
2. Add the `Scenario` to `scenarios/index.ts`. Pick its `entry` and its `steps`, and add `ssr: {}` to run the server and hydrate environments too.
3. Run with `-u` and read the goldens: they are the specification.
4. If the library route diverges, decide whether the divergence is intended or a defect. If intended, declare it as `differs` with a precise reason and a DECISIONS entry. If a defect, fix it, or pin it as `known-defect`. Never change the oracle to make the library pass.
