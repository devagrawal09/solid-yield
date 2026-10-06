# solid-yield

Yield components for Solid 2 as a library: `component(function* (props) { setup; return view(function* () { view }) })`, interpreted at run time on Solid's public API, with strict types for every read, write, wait and failure.

**This is the strict dialect; the compiler route is the ergonomic one.** The same model is baked into Solid's compiler and core on the `experiment/iterable-signals` branch. This repository is the userland counterpart. It is a design lab (D-002): every read and write is a `yield*`, failures are typed, a view has no body, components are called and not tagged. Each of these rules is enforced by types, a development error or a lint rule. Where the model is awkward, the awkwardness is a finding and goes into [`documentation/DECISIONS.md`](documentation/DECISIONS.md), not behind an escape hatch. The types say exactly what the runtime does (D-071): a pending read or a failure the runtime routes somewhere is in the type at the same place.

**One route per app (D-074).** This library and the compiler route render the same markup but number hydration keys differently. A page rendered on the server by one cannot be hydrated by the other: build the server and the client with the same route.

## Packages

| Package                                                     | Directory                      | What                                                                                                                                 |
| ----------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| [`solid-yield`](packages/yield)                             | `packages/yield`               | the runtime interpreter, its types, flow controls, `render` / `hydrate`, the no-JSX `h` flavor, a JSX namespace for yield components |
| [`vite-plugin-solid-yield`](packages/vite-plugin-yield)     | `packages/vite-plugin-yield`   | the one JSX rule (`yield*` inside JSX becomes `perform(…)`), run before Solid's JSX compiler, plus the library `lazy`'s module URL   |
| [`eslint-plugin-solid-yield`](packages/eslint-plugin-yield) | `packages/eslint-plugin-yield` | the rules TypeScript cannot express                                                                                                  |

They depend on **published** Solid: `solid-js`, `@solidjs/web` and, for `h`, `@solidjs/h`, all at `^2.0.0-rc.11`. This resolves to `2.0.0-rc.13` today. There is no workspace link to Solid and no pinned RC (D-016).

## The twins: how drift from Solid shows up

`examples/` holds nine **twins**, real Solid apps rewritten with `solid-yield`:

- seven JSX twins: `docs-yield`, `effect-yield`, `hackernews-spa-yield`, `rendering-yield`, `room-yield`, `sierpinski-yield`, `todos-yield`;
- two no-JSX twins: `sierpinski-yield-h`, `todos-yield-h`.

`examples/originals/` holds seven original apps: six vendored apps and the new docs site, all runnable (the two `h` twins share their originals with the JSX twins). Each twin's parity test runs one script against the original and against the twin, both on the installed Solid, and compares the DOM after every step.

That test is the only check for Solid drift (D-045). If a Solid release changes the original and the twin the same way, parity still passes: the library followed Solid. If it breaks a twin, that is a finding about Solid's public API, not a reason to pin an RC. `examples/harness` is the twins' shared parity runner and lint config. The [content-site twin](examples/docs-yield) contrasts the interaction-heavy demos: delayed article content surrounds six widgets with local state.

## Working here

Node 24, pnpm 11.

```sh
pnpm install
pnpm build          # builds packages/yield (dist/, and regenerates its vendored JSX types)
pnpm gate           # = node scripts/yield-gate.mjs; add --fast while iterating
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

Each commit is gated (D-008). Green means no step that passes in [the baseline](documentation/yield-gate-baseline.md) fails. The gate's steps:

- `test`, `typecheck` and `lint` for each twin;
- the three packages' tests, and the conformance harness (`pkg:yield:conformance`, D-039): 12 scenarios in handwritten Solid and in the library dialect, compared trace by trace;
- the exports-conditions matrix of each package;
- `prettier` and `oxlint`.

CI ([`.github/workflows/gate.yml`](.github/workflows/gate.yml)) runs the same gate on Node 24 / pnpm 11. It also fails if building leaves the vendored JSX types out of date.

**When Solid moves**, the vendored JSX types need regenerating:

1. Update the lockfile (`pnpm update solid-js @solidjs/web @solidjs/h`).
2. Run `pnpm build`. It regenerates `packages/yield/jsx/` from `node_modules/@solidjs/web`.
3. Commit the regenerated `jsx/` files with the lockfile, then run the gate.

Changesets: `pnpm changeset`. The `.changeset/` entries are the packages' unreleased history since they were created in the Solid fork.

## Documentation

- [`documentation/getting-started.md`](documentation/getting-started.md): install, and the strict dialect on one page (setup, view, holes, call form, colors, failures), with a first program built rule by rule.
- [`documentation/refusals.md`](documentation/refusals.md): what you cannot write in a view, and every refusal code by layer (types, the transform, development errors, lint).
- [`documentation/yield-library.md`](documentation/yield-library.md): the reference. Covers what the library is, every rule and where it is enforced, the runtime cost, the limitations and the twins.
- [`documentation/calculus.md`](documentation/calculus.md): λ-yield, the core calculus. Syntax, static and dynamic semantics, the soundness theorem (D-071) stated, and its proof obligations traced to the code and the tests.
- [`documentation/DECISIONS.md`](documentation/DECISIONS.md): the decision log (D-001 onwards), with alternatives and reasoning.
- [`documentation/yield-gate-baseline.md`](documentation/yield-gate-baseline.md): what "green" means.
- [`HANDOFF.md`](HANDOFF.md): where the work stands and what comes next.

Extracted from the Solid fork `devagrawal09/solid` (branch `blocks-lib`, commit `6978eb83`) in Phase 3 (D-015). The git history stays in the fork.

## License

MIT, copyright (c) 2026 Dev Agrawal ([`LICENSE`](./LICENSE)). The vendored originals (`examples/originals/`), the files the twins copy from them unchanged, the JSX types generated from `@solidjs/web` and the compiler outputs kept as the plugin's oracle are Solid's, under its MIT notice: [`NOTICE`](./NOTICE) lists them.
