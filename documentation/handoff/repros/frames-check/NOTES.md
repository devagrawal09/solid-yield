# Investigation notes

All files and changes are confined to `/private/tmp/frames-check`. `node_modules` is a symlink to the existing `@solidjs/web` pnpm installation's `node_modules` beneath `/Users/devagr/solid-yield/node_modules`; the root workspace's node_modules does not expose solid-js or @solidjs/web directly. Both packages resolve to rc.13. The repository was only read.

## Relation to the reference probe

Read `documentation/compiler-c3b-payload.md`, `documentation/compiler-findings.md` (F-C14), `packages/compiler-yield/test/server-region.test.mjs`, and `packages/compiler-yield/src/server-region.js` on the live `proto/compiler` branch. The probe calls `provideRequestEvent(..., async () => await renderServerComponent(await __serverRegion(...edge.value), {onError}))`. `emitServerRegion` declares an async `"use server"` function returning `() => __regionForeign(ArticleContent)({slug})`; `foreign` itself is identity.

The recorded failing placement had its async loader in ArticleContent setup and only the synchronous article derivation created in ArticleBody under Loading. The current source has already hoisted the derivation beside the loader. Plain Solid with a hoisted loader and a synchronous derived memo below Loading converges, including with Errored, markup read functions, and `frameTransformDirectResult` wrapping the returned template. Thus the exact claimed frames-only F-C14 behavior was NOT independently reproduced.

The confirmed plain failure nests the async memo creation itself in a returned Loading content function and reads it before returning markup. Ordinary streamed SSR of that identical tree also fails. A second tested failure uses a hoisted loader but makes the derived memo return a fresh Promise; that also fails in BOTH renderers and is not the recorded synchronous pipeline.

The reference probe additionally uses extraction, the generator runtime's component/view/perform wrappers, compiled SSR hole placement, typed source/path wrappers, and the Vite server-function transform. `perform` has server-only array wrapping for marked function views (runtime.ts:517 onward); LoadingYield adapts generator children to getters (flow.ts:420–436, 457–471). Those choices affect which function the SSR engine retains and retries. They are differences, not proof of a specific compiler error. Determining the exact F-C14 cause needs the emitted SSR output of the earlier failing placement; the supplied/current files do not contain that output. Public frame wrapping alone did not reproduce it.

`REPORT.md` is an issue draft for the narrower confirmed plain-Solid retry failure. It makes no claim to have reproduced the original frame-only distinction and mentions no project.

## Files and runs

- `repro.mjs`: requested nested tree, 10 ms async memo and synchronous derived memo; run with no flags for frames, `--stream` for ordinary SSR. Both complete with the convergence error after roughly 110 seconds.
- `minimal.mjs`: single Promise.resolve memo; no derived memo, server directive, request context, or Errored. Same frame error in roughly 100 ms.
- `repro.frames.json`, `repro.stream.json`, `minimal.frames.json`, `minimal.development.json`: unedited outputs.
- `check.mjs`: independent shape controls and invocation counts. Names encode options: `nested-loader` creates the async memo in the body; otherwise it is hoisted. `lazy-body` returns the body function rather than calling it in the children getter; `hole` gives ssrElement a separate read function in an array; `lazy-markup` returns a separate markup function; `sync` removes the promise; `no-derived`, `hoisted`, `stable-promise`, `errored`, `wrapped`, `promise-derived` apply their named changes.
- `matrix.mjs` / `matrix.json`: repeatable fast controls plus the saved full failure outputs.
- `inspect-ids.mjs` / `ids.json`: confirms increasing owner IDs and 10,001 child-factory calls.
- `no-loading.mjs` / `no-loading.frames.json` / `no-loading.stream.json`: bounded 100 ms observation, then abort. Neither mode completed; eight callback calls each. No boundary budget exists for that root path.

Initial counter runs of `nested-loader-lazy-body` used one loader per pass (10,001 calls) and 20,001 derived compute calls; removing the derived memo still made 10,001 loader calls and reached the same error. Both runs took about 110 seconds. Those terminal observations are also backed by the saved two-memo reproduction and minimal one-memo reproduction.
