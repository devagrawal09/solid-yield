# Blocks gate — reference run (baseline)

The gate is `scripts/blocks-gate.mjs` (`pnpm gate`). This file records the
reference run used as the baseline; the machine-readable copy is
[`blocks-gate-baseline.json`](./blocks-gate-baseline.json). CI runs the same gate
against this file (`.github/workflows/gate.yml`).

**Reference summary: `34 pass / 0 fail / 0 skip in 26s`** (34 steps, `--jobs 3`,
every step under `TZ=UTC`). Run on the staged tree of Phase 4's commit 1 (the conformance
harness), so the JSON's `head` is that commit's parent (`84521e5`).
Environment: Node v24.18.0, pnpm 11.1.1, darwin/arm64.

**Solid under test: the published packages** — `solid-js`, `@solidjs/web`, `@solidjs/h`
declared `^2.0.0-rc.11` (what the fork declared), resolved on the registry to
**`2.0.0-rc.13`** (`@solidjs/compiler` / `@solidjs/babel-plugin` rc.13 through
`@solidjs/vite-plugin@3.0.0-next.35`, `@solidjs/router@2.0.0-next.29`). In the fork
the same 30 steps ran against its local rc.11 workspace packages and its pristine
upstream compiler build. All 30 pass on rc.13 too: nothing in the public API the
library and the twins use moved between rc.11 and rc.13 (D-016's canary is quiet).

**Phase 4 added one step** (34 now): `pkg:blocks:conformance` (D-039), the conformance
harness (`packages/blocks/test/conformance`): 12 scenarios, handwritten Solid against the
library dialect, on the client, the server and in hydration; the library route against the
compiler route's frozen server output; and a lint of the scenarios' library sources.

**Extraction commit 4 added three steps** (33 now): `pkg:blocks:exports`, `pkg:vite-plugin-blocks:exports`,
`pkg:eslint-plugin-blocks:exports` — the exports-conditions matrix of each published package
(`scripts/exports-matrix.mjs`: every subpath under development / default / browser / node and
their combinations, resolved by esbuild, Node and TypeScript from a consumer's `node_modules`).
`repo:prettier` now also checks `scripts/*.mjs` and `packages/*/test/*.mjs`.

**The other 30 are the fork's last baseline's** (`013d20ce`, 30 steps, 30 pass):
the twins' `test` / `typecheck` / `lint`, `pkg:blocks:test`,
`pkg:eslint-plugin-blocks:test`, `pkg:vite-plugin-blocks:test` / `:typecheck`,
`repo:prettier`, `repo:oxlint`. One test inside `pkg:vite-plugin-blocks:test` now
skips by design: "differential no-op" ran the plugin over the 683 fixture files of
Solid's own compilers (`packages/babel-plugin/test`, `packages/compiler/…`), which
stay in Solid (D-043).

## What "green" means

A commit is **green** iff no step that is `PASS` in this reference run is `FAIL`
on it, and no step this run lacks is `FAIL`:

```sh
pnpm install --frozen-lockfile
pnpm build                       # the gate never builds
node scripts/blocks-gate.mjs --baseline documentation/blocks-gate-baseline.json
```

With `--baseline` the gate prints `new reds` (PASS → FAIL, or FAIL on a step the
baseline does not have; any of these makes it red), `fixed` (FAIL → PASS) and
`unchanged`, and exits 0 iff there are no new reds. A step that is `SKIP` on a
later run and wasn't here doesn't count as a new red, so look at it by hand. When the
step list changes, regenerate the baseline
(`--json documentation/blocks-gate-baseline.json`) in the commit that changes it.

## Timezone pin

The gate sets `TZ=UTC` in every step's environment, whatever the host timezone
(along with `FORCE_COLOR=0`, `NO_COLOR=1`, and `CI=1` unless `CI` is already set),
so results depend on the commit, not on the machine's clock locale (D-027).
`examples/effect-blocks` makes this necessary: its saga test fixes the clock at
12:00 UTC and then formats the time in local time.

## Steps

| Step | Result | Duration |
| --- | --- | --- |
| `twin:effect-blocks:test` | PASS | 1.5 s |
| `twin:effect-blocks:typecheck` | PASS | 1.3 s |
| `twin:effect-blocks:lint` | PASS | 1.7 s |
| `twin:hackernews-spa-blocks:test` | PASS | 1.9 s |
| `twin:hackernews-spa-blocks:typecheck` | PASS | 1.4 s |
| `twin:hackernews-spa-blocks:lint` | PASS | 1.7 s |
| `twin:rendering-blocks:test` | PASS | 3.2 s |
| `twin:rendering-blocks:typecheck` | PASS | 1.4 s |
| `twin:rendering-blocks:lint` | PASS | 1.6 s |
| `twin:room-blocks:test` | PASS | 1.3 s |
| `twin:room-blocks:typecheck` | PASS | 1.4 s |
| `twin:room-blocks:lint` | PASS | 1.7 s |
| `twin:sierpinski-blocks:test` | PASS | 10.9 s |
| `twin:sierpinski-blocks:typecheck` | PASS | 1.0 s |
| `twin:sierpinski-blocks:lint` | PASS | 1.2 s |
| `twin:sierpinski-blocks-h:test` | PASS | 10.9 s |
| `twin:sierpinski-blocks-h:typecheck` | PASS | 1.7 s |
| `twin:sierpinski-blocks-h:lint` | PASS | 1.9 s |
| `twin:todos-blocks:test` | PASS | 1.2 s |
| `twin:todos-blocks:typecheck` | PASS | 1.0 s |
| `twin:todos-blocks:lint` | PASS | 1.3 s |
| `twin:todos-blocks-h:test` | PASS | 1.1 s |
| `twin:todos-blocks-h:typecheck` | PASS | 1.8 s |
| `twin:todos-blocks-h:lint` | PASS | 2.0 s |
| `pkg:blocks:test` | PASS | 7.4 s |
| `pkg:eslint-plugin-blocks:test` | PASS | 1.4 s |
| `pkg:vite-plugin-blocks:test` | PASS | 1.4 s |
| `pkg:vite-plugin-blocks:typecheck` | PASS | 1.1 s |
| `pkg:blocks:conformance` | PASS | 4.1 s |
| `pkg:blocks:exports` | PASS | 1.1 s |
| `pkg:vite-plugin-blocks:exports` | PASS | 0.9 s |
| `pkg:eslint-plugin-blocks:exports` | PASS | 0.9 s |
| `repo:prettier` | PASS | 1.6 s |
| `repo:oxlint` | PASS | 0.0 s |
