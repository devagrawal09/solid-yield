# yield-gate — reference run (baseline)

The gate is `scripts/yield-gate.mjs` (`pnpm gate`). This file records the
reference run used as the baseline; the machine-readable copy is
[`yield-gate-baseline.json`](./yield-gate-baseline.json). CI runs the same gate
against this file (`.github/workflows/gate.yml`).

**Reference summary: `37 pass / 0 fail / 0 skip in 36s`** (37 steps, `--jobs 3`,
every step under `TZ=UTC`). Re-recorded when `pkg:yield:dist-fresh` was added, on the
working tree of that commit (the JSON's `head` is its parent, `3c14584`); the other 36
steps are unchanged, all PASS.

**The stale-build check added one step** (37 now): `pkg:yield:dist-fresh`
(`scripts/dist-fresh.mjs`, also in `--fast`). The gate never builds (D-008), so a change
to `packages/yield/src` could pass the gate against an old `dist/` and then fail the
twins' typecheck after a rebuild (it happened once: an inferred type named an unexported
`HoleCall`). The step fails when `packages/yield/dist/` is missing or any file in it is
older (by mtime) than the newest of `src/`, `scripts/` and `tsconfig.build.json`, and
it tells you to run `pnpm build`. The plugins ship `src/` unbuilt, so they have no output
to check. Touching `src/index.ts` turns it red, and `pnpm build` turns it green again.

The 36-step baseline was re-recorded for D-096 (the rename to `solid-yield`: the gate script, the
package directories and the twins moved, so did the step names) on the staged tree of that commit, so
the JSON's `head` is its parent (`8abef3f`). Same 36 steps, all PASS before and after.
Environment: Node v24.18.0, pnpm 11.1.1, darwin/arm64.

**Solid under test: the published packages** — `solid-js`, `@solidjs/web`, `@solidjs/h`
declared `^2.0.0-rc.11` (what the fork declared), resolved on the registry to
**`2.0.0-rc.13`** (`@solidjs/compiler` / `@solidjs/babel-plugin` rc.13 through
`@solidjs/vite-plugin@3.0.0-next.35`, `@solidjs/router@2.0.0-next.29`). In the fork
the same 30 steps ran against its local rc.11 workspace packages and its pristine
upstream compiler build. All 30 pass on rc.13 too: nothing in the public API the
library and the twins use moved between rc.11 and rc.13 (D-016's canary is quiet).

**The review fixes added one step** (36 now): `twins:hydrate-smoke`
(`examples/harness/hydrate-smoke/hydrate.mjs`). Each of the server-render smoke's 16 renders
is hydrated in jsdom by the twin's own client entry. One Vite server per case, with the
twin's config plus a runnable `hydrate` environment (consumer `client`): the SSR environment
renders as the smoke does, `hydrate` compiles the client entry for the DOM (hydratable) and
runs it in the same process. jsdom's window is put on Node's global as Vitest's jsdom
environment does (`populateGlobal`), so the server's inline scripts (`_$HY`, the streamed
chunks) and Solid's client share it. rendering's `client.tsx` is the entry; room's and
hackernews' generated entries are the document's module script. A case fails on a
development error or a hydration complaint (Solid's "Hydration key miss" …), an unhandled
rejection that nothing handles later, a server root element the client replaced, or a failed
interaction (rendering's `/settings`: the portal's close button). Vite's HMR client is
stubbed in `hydrate`; a hydrating page's lazy-module preload (`import(http://localhost/…)`)
is served by the dev server. **The network is held:** `fetch` never settles, because server
functions are served by Vite's middleware, which needs a listening server (local port
binding is refused in the sandbox this was built in), so room's live sources and posts are
not exercised past hydration. `--originals` runs the same cases against the originals (a
diagnosis aid, not gated). The script's `KNOWN_FAILURES` lists a case expected to fail, with
its message: a known case must keep failing with it, and one that starts to pass fails the
step until it is removed from the list. The step was added with five (rendering `stream`
`/profile`, `/stream`, `/error-stream`, room `/live`, hackernews' story, each a "Hydration
key miss" on a `Loading` fallback, where the originals hydrate 16 / 16). All five were one
cause, a call-form fallback written as JSX: it is built with the holding view, and while
hydrating it claims a server node that the server never rendered (D-092: the lint
`component-children-generator` makes it a lazy view, and the twins are migrated). The list is
empty since; all 16 cases pass. Planting a client-only
`<p>` in rendering's stream client fails `/settings` with a key miss. `repo:prettier` now
also checks `examples/harness/hydrate-smoke/*.mjs`.

**Phase 5 added one step** (35 then): `twins:ssr-smoke`
(`examples/harness/ssr-smoke/smoke.mjs`). Every twin with a server entry renders each of its
routes on the server through Vite's SSR loader (development builds, as `vite dev` serves
them), each render in its own process, killed after 30 s. That is rendering-yield's `string`
(`renderToString`) and `stream` (`renderToStream`, awaited to its end) entries for all 7
routes (`/`, `/profile`, `/settings`, `/stream`, `/error-stream`, `/reveal`,
`/skeleton`), room-yield's `/live` and hackernews-spa-yield's `/stories/30186326`, the
last two through @solidjs/vite-plugin's generated `virtual:solid-ssr-handler`: 16 renders.
hackernews' feed and user routes read the live HN API, so only the story it serves from its
checked-in capture is rendered (the gate has no network). Nothing is compared: a render fails
on a throw, a non-200 response, an empty document, a development error (a `[CODE]` message
logged with `console.error` / `console.warn`, raised as an unhandled rejection or written
into the document), or no end within 30 s. It was added after D-082's measurement found two
streamed pages that no step rendered: `/stream` (a false server `READ_IN_VIEW`) and
`/profile` (never ended). Run against the runtime before those fixes, it fails both, as
`development error: [READ_IN_VIEW] <MemoList2>: …` and `no end after 30 s`.
`repo:prettier` now also checks `examples/harness/ssr-smoke/*.mjs`.

**Phase 4 added one step** (34 then): `pkg:yield:conformance` (D-039), the conformance
harness (`packages/yield/test/conformance`): 12 scenarios, handwritten Solid against the
library dialect, on the client, the server and in hydration; the library route against the
compiler route's frozen server output; and a lint of the scenarios' library sources.

**Extraction commit 4 added three steps** (33 now): `pkg:yield:exports`, `pkg:vite-plugin-yield:exports`,
`pkg:eslint-plugin-yield:exports` — the exports-conditions matrix of each published package
(`scripts/exports-matrix.mjs`: every subpath under development / default / browser / node and
their combinations, resolved by esbuild, Node and TypeScript from a consumer's `node_modules`).
`repo:prettier` now also checks `scripts/*.mjs` and `packages/*/test/*.mjs`.

**The other 30 are the fork's last baseline's** (`013d20ce`, 30 steps, 30 pass):
the twins' `test` / `typecheck` / `lint`, `pkg:yield:test`,
`pkg:eslint-plugin-yield:test`, `pkg:vite-plugin-yield:test` / `:typecheck`,
`repo:prettier`, `repo:oxlint`. One test inside `pkg:vite-plugin-yield:test` now
skips by design: "differential no-op" ran the plugin over the 683 fixture files of
Solid's own compilers (`packages/babel-plugin/test`, `packages/compiler/…`), which
stay in Solid (D-043).

## What "green" means

A commit is **green** iff no step that is `PASS` in this reference run is `FAIL`
on it, and no step this run lacks is `FAIL`:

```sh
pnpm install --frozen-lockfile
pnpm build                       # the gate never builds
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

With `--baseline` the gate prints `new reds` (PASS → FAIL, or FAIL on a step the
baseline does not have; any of these makes it red), `fixed` (FAIL → PASS) and
`unchanged`, and exits 0 iff there are no new reds. A step that is `SKIP` on a
later run and wasn't here doesn't count as a new red, so look at it by hand. When the
step list changes, regenerate the baseline
(`--json documentation/yield-gate-baseline.json`) in the commit that changes it.

## Timezone pin

The gate sets `TZ=UTC` in every step's environment, whatever the host timezone
(along with `FORCE_COLOR=0`, `NO_COLOR=1`, and `CI=1` unless `CI` is already set),
so results depend on the commit, not on the machine's clock locale (D-027).
`examples/effect-yield` makes this necessary: its saga test fixes the clock at
12:00 UTC and then formats the time in local time.

## Steps

| Step | Result | Duration |
| --- | --- | --- |
| `pkg:yield:dist-fresh` | PASS | 0.0 s |
| `twin:effect-yield:test` | PASS | 1.7 s |
| `twin:effect-yield:typecheck` | PASS | 1.4 s |
| `twin:effect-yield:lint` | PASS | 1.7 s |
| `twin:hackernews-spa-yield:test` | PASS | 2.2 s |
| `twin:hackernews-spa-yield:typecheck` | PASS | 1.5 s |
| `twin:hackernews-spa-yield:lint` | PASS | 1.7 s |
| `twin:rendering-yield:test` | PASS | 3.2 s |
| `twin:rendering-yield:typecheck` | PASS | 1.4 s |
| `twin:rendering-yield:lint` | PASS | 1.6 s |
| `twin:room-yield:test` | PASS | 1.6 s |
| `twin:room-yield:typecheck` | PASS | 1.4 s |
| `twin:room-yield:lint` | PASS | 1.7 s |
| `twin:sierpinski-yield:test` | PASS | 11.0 s |
| `twin:sierpinski-yield:typecheck` | PASS | 1.0 s |
| `twin:sierpinski-yield:lint` | PASS | 1.3 s |
| `twin:sierpinski-yield-h:test` | PASS | 11.1 s |
| `twin:sierpinski-yield-h:typecheck` | PASS | 1.7 s |
| `twin:sierpinski-yield-h:lint` | PASS | 1.9 s |
| `twin:todos-yield:test` | PASS | 1.5 s |
| `twin:todos-yield:typecheck` | PASS | 1.0 s |
| `twin:todos-yield:lint` | PASS | 1.3 s |
| `twin:todos-yield-h:test` | PASS | 1.3 s |
| `twin:todos-yield-h:typecheck` | PASS | 1.9 s |
| `twin:todos-yield-h:lint` | PASS | 2.3 s |
| `twins:ssr-smoke` | PASS | 7.6 s |
| `twins:hydrate-smoke` | PASS | 10.6 s |
| `pkg:yield:test` | PASS | 9.4 s |
| `pkg:eslint-plugin-yield:test` | PASS | 1.6 s |
| `pkg:vite-plugin-yield:test` | PASS | 1.4 s |
| `pkg:vite-plugin-yield:typecheck` | PASS | 1.1 s |
| `pkg:yield:conformance` | PASS | 4.2 s |
| `pkg:yield:exports` | PASS | 1.2 s |
| `pkg:vite-plugin-yield:exports` | PASS | 0.9 s |
| `pkg:eslint-plugin-yield:exports` | PASS | 0.9 s |
| `repo:prettier` | PASS | 1.7 s |
| `repo:oxlint` | PASS | 0.1 s |
