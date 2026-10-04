# solid-blocks

Generator blocks for Solid 2 as a library: `$component(function* (props) { setup; return function* () { view } })`, interpreted at run time on Solid's public API, with strict types for every read, write, wait and failure.

**This is the strict dialect; the compiler route is the ergonomic one.** The same model is baked into Solid's compiler and core on the `experiment/iterable-signals` branch. This repository is the userland counterpart. It is a design lab (D-002): every read and write is a `yield*`, failures are typed, a view has no body, components are called and not tagged. Each of these rules is enforced by types, a development error or a lint rule. Where the model is awkward, the awkwardness is a finding and goes into [`documentation/DECISIONS.md`](documentation/DECISIONS.md), not behind an escape hatch. The types say exactly what the runtime does (D-071): a pending read or a failure the runtime routes somewhere is in the type at the same place.

**One route per app (D-074).** This library and the compiler route render the same markup but number hydration keys differently. A page rendered on the server by one cannot be hydrated by the other: build the server and the client with the same route.

## Packages

| Package | Directory | What |
| --- | --- | --- |
| [`solid-blocks`](packages/blocks) | `packages/blocks` | the runtime interpreter, its types, flow controls, `render` / `hydrate`, the no-JSX `h` flavor, a JSX namespace for blocks |
| [`vite-plugin-solid-blocks`](packages/vite-plugin-blocks) | `packages/vite-plugin-blocks` | the one JSX rule (`yield*` inside JSX becomes `perform(…)`), run before Solid's JSX compiler, plus the library `lazy`'s module URL |
| [`eslint-plugin-solid-blocks`](packages/eslint-plugin-blocks) | `packages/eslint-plugin-blocks` | the rules TypeScript cannot express |

They depend on **published** Solid: `solid-js`, `@solidjs/web` and, for `h`, `@solidjs/h`, all at `^2.0.0-rc.11`. This resolves to `2.0.0-rc.13` today. There is no workspace link to Solid and no pinned RC (D-016).

## The twins: how drift from Solid shows up

`examples/` holds eight **twins**, real Solid apps rewritten with `solid-blocks`:

- six JSX twins: `effect-blocks`, `hackernews-spa-blocks`, `rendering-blocks`, `room-blocks`, `sierpinski-blocks`, `todos-blocks`;
- two no-JSX twins: `sierpinski-blocks-h`, `todos-blocks-h`.

`examples/originals/` holds the six original apps, vendored and runnable (the two `h` twins share their originals with the JSX twins). Each twin's parity test runs one script against the original and against the twin, both on the installed Solid, and compares the DOM after every step.

That test is the only check for Solid drift (D-045). If a Solid release changes the original and the twin the same way, parity still passes: the library followed Solid. If it breaks a twin, that is a finding about Solid's public API, not a reason to pin an RC. `examples/harness` is the twins' shared parity runner and lint config.

## Working here

Node 24, pnpm 11.

```sh
pnpm install
pnpm build          # builds packages/blocks (dist/, and regenerates its vendored JSX types)
pnpm gate           # = node scripts/blocks-gate.mjs; add --fast while iterating
node scripts/blocks-gate.mjs --baseline documentation/blocks-gate-baseline.json
```

Each commit is gated (D-008). Green means no step that passes in [the baseline](documentation/blocks-gate-baseline.md) fails. The gate's steps:

- `test`, `typecheck` and `lint` for each twin;
- the three packages' tests, and the conformance harness (`pkg:blocks:conformance`, D-039): 12 scenarios in handwritten Solid and in the library dialect, compared trace by trace;
- the exports-conditions matrix of each package;
- `prettier` and `oxlint`.

CI ([`.github/workflows/gate.yml`](.github/workflows/gate.yml)) runs the same gate on Node 24 / pnpm 11. It also fails if building leaves the vendored JSX types out of date.

**When Solid moves**, the vendored JSX types need regenerating:

1. Update the lockfile (`pnpm update solid-js @solidjs/web @solidjs/h`).
2. Run `pnpm build`. It regenerates `packages/blocks/jsx/` from `node_modules/@solidjs/web`.
3. Commit the regenerated `jsx/` files with the lockfile, then run the gate.

Changesets: `pnpm changeset`. The `.changeset/` entries are the packages' unreleased history since they were created in the Solid fork.

## Documentation

- [`documentation/getting-started.md`](documentation/getting-started.md): install, and the strict dialect on one page (setup, view, holes, call form, colors, failures), with a first program built rule by rule.
- [`documentation/refusals.md`](documentation/refusals.md): what you cannot write in a view, and every refusal code by layer (types, the transform, development errors, lint).
- [`documentation/blocks-library.md`](documentation/blocks-library.md): the reference. Covers what the library is, every rule and where it is enforced, the runtime cost, the limitations and the twins.
- [`documentation/DECISIONS.md`](documentation/DECISIONS.md): the decision log (D-001 onwards), with alternatives and reasoning.
- [`documentation/blocks-gate-baseline.md`](documentation/blocks-gate-baseline.md): what "green" means.
- [`HANDOFF.md`](HANDOFF.md): where the work stands and what comes next.

Extracted from the Solid fork `devagrawal09/solid` (branch `blocks-lib`, commit `6978eb83`) in Phase 3 (D-015). The git history stays in the fork.

## License

MIT
