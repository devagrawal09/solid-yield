# C3: server-recomputable docs regions

**Terminology (2026-10-08).** Dev corrected the earlier use of “islands”: C2 (seven-root and single-root modes) is **static extraction + eager root split**. Every root remains a full client component, and the article still renders in the browser. Islands in the Astro/Marko sense are server-rendered content with small interactive leaves: **C3–C3c are islands, i.e. server components with client slots** such as LikeButton and copy-code. Dev’s measured summary: “static extraction and root splitting never pay; islands (server components with client slots) pay above ~25 KB gzip of server-derivable code and scale.” The `eagerIslands` pass name predates this correction and is unchanged; read older branch reports with this distinction.

2026-10-07, `proto/compiler`, after merging main at `c797bb3` (merge
`85931f6`). **R emission, refetch, slots and measurement are implemented for
the docs fixture. Exact DOM parity is not achieved:** the public frame API adds
transport nodes. The 24 authored-content comparisons and direct-route
SSR/hydration checks pass; the exact differences are recorded below. This is a
bounded prototype, not a general server-component compiler.

## Rule and region list

C0 §§1.2, 1.3 and 1.6 define R. A memo that attempts a declared server function
with serializable S/U arguments produces server data. With U inputs its result
is R; with no U inputs it is S. Pure downstream memos, holes and settled values
follow that result. A C-cell read, event/effect write, unrelated U read or
unproved capture keeps the affected work client. The argument vector consists
of the distinct external U inputs in first-read order; their producers remain
client. A change causes one region RPC returning markup and serialized slot
inputs, rather than returning article data for client rendering. No caching,
debouncing or batching saving is assumed.

The [nine-twin C1 rerun](compiler-c1-report.md#c3-server-recomputable-provenance-2026-10-07)
and [analysis data](compiler-c3-analysis.json) retain before/after fractions and
all candidate argument vectors. Docs holes change from **124 S / 0 R / 119
client** to **133 S / 56 R / 54 client**, of 243. JSX sites change from **148 S /
0 R / 101 client** to **151 S / 61 R / 37 client**, of 249. The other eight twins
find no R sites: their relevant dependencies are event-written cells, unknown
async/query/live adapters or unproved inputs. Room's refused inputs are recorded
in the analysis. These are site counts, not byte savings.

The emitted docs regions are:

- **Home's article**, S: logical arguments `[]`, fixed slug `overview`. Its
  `<main>` is emitted by the shared `routeRegion("overview")` function. There
  is no article-list component in this Home.
- **DocPage's article**, R: arguments `[props.params.slug]`, emitted by
  `routeRegion(slug)`. Slug defaulting, `getArticle`, ArticleBody, eight chapter
  sections, table of contents and related links run on the server.
- **ReadingGuide**, S: arguments `[]`, emitted by `guideRegion()`, with fixed
  slug `widgets` and no client slot.
- **SiteNav and SiteFooter**, already S: arguments `[]`, no slots. They retain
  the existing server-only eager-islands output and need no refetch stub.

Home and DocPage place their authored sibling **LikeButton** inside the emitted
`<main>` through the markup slot `like#route-like`, with serialized `{slug}`.
The fixed site key preserves its node/state when DocPage's slug changes; the
router's Home/DocPage ownership still controls remounts between route types.
No function or Error instance is passed as slot data. ThemeToggle, SearchBox,
NewsletterForm, CommentList and avatars, ImageCarousel, LikeButton and the
router shell remain client. The eleven C1 dependency groups are preserved as
the analysis result; the application has one eager hydration owner plus the
public frame slot ownership below it.

## Emit and F-C10 resolution

`src/server-components.js` follows `eagerIslands({roots:"single"})`. It emits
`"use server"` functions returning templates, using the installed public server
function transform and frame codec. SSR calls the same functions in a request
scope. The client gets the small `dynamic` refetch stubs and the frame/RPC
runtime. The production shipping check rejects article template/data strings
in client chunks; the old article API export is also removed from the browser
module slice. Both islands-only single-root and the default seven-root mode
remain working.

This lowering verifies the supported setup/wrapper shapes and reruns R analysis
before editing. Changed shapes or a newly client-dependent article/guide are
refused, rather than silently dropped. ArticleBody and the authored fallback
markup are extracted from source. This is deliberately narrower than automatic
lowering of every R candidate in an arbitrary program.

**F-C10 is resolved, not an upstream or calculus finding.** Main's D-115
(`96a567b`) marks nominal library failures safe through public `markSafeError`.
The separate [generic frame probe](compiler-c3-frame-finding.json) now carries
`No article: missing`, rather than `Internal Server Error`. A generic frame
error record still is not the authored nominal error boundary. The integrated
emitter therefore retains that boundary on the server: its loader records a
settled success/failure, then raises the same `NotFound` through the library's
`raise`/safe-error path inside a fresh `Errored` boundary after suspension.
The authored fallback becomes a frame fragment containing both `not-found`
and `No article: missing`. No plain Error rethrow or client class reconstruction
is involved. The loader remains under the authored Loading boundary.

The production-mode tests verify the typed fallback after an RPC to `missing`
and after direct `/docs/missing` hydration. The normal library/compiled smokes
use main's corrected criterion (`8a5f2b8`): streamed typed error data followed
by the hydrated `.not-found` fallback. There is no `renderToString` workaround;
that draft was withdrawn by `c797bb3` and D-099 remains synchronous.

## Parity and findings

[Recorded comparison](compiler-c3-parity.json): **24/24 authored-content
comparisons pass; 0/24 exact normalized DOM snapshots match.** The ordinary
parity normalizer is unchanged. A separate diagnostic comparison identifies
the differences rather than hiding them. Original, library, seven-root and
islands-only single-root still match all 24 exact snapshots.

**F-C11 — frame transport changes the DOM.** Each R region uses a public
`<solid-frame data-fid="…" style="display:contents">` container. Both containers
are present in all 24 R snapshots. The first navigation's pending snapshot also
contains `<template id="pl-0010"></template>`. Thus this output does not meet a
strict DOM-identical compiler contract, even though the content, controls and
state match. The test explicitly asserts and records these differences. It is
not reported as a passing exact-parity run or an upstream theorem failure.

The first navigation initially has an empty route until the RPC's first frame
arrives; then it displays the authored `Loading article…` and LikeButton. The
comparison waits for that first frame, marking step 4 **server-refetched**.
Steps 5 and 23 settle after the streamed response. Step 22 preserves the old
content while DocPage refetches, matching the library's stale-content behavior.
The initial empty interval is an additional pending-state limitation, not an
identical synchronous Loading fallback. No transport-node stripping is applied
to the stored snapshots. Removing these differences requires further lowering
work; the current public high-level frame integration does not satisfy that
remaining acceptance criterion.

Both direct `/docs/start` and `/docs/missing` SSR/hydration smokes pass with
server nodes retained. Hydration makes **zero RPCs**. Navigation makes exactly
two, with no guide refetch. LikeButton is eagerly attached; its `Like: 1`,
rate-limit message and node survive the `start` → `missing` refetch. The
extracted-root conformance lane also passes; it exercises the existing extracted
library roots, while the new docs test covers R transport/slot behavior.

## Measured execution and shipping

Three fresh runs of all four variants in the same merged checkout, Node
v24.18.0 / Solid rc.13. All **100 phases have zero run-to-run byte drift**.
[Raw observations, payloads and chunk attribution](compiler-c3-bytes.json).

| Variant | Executed at load | Executed over 24 steps | Shipped raw | Shipped gzip |
| --- | ---: | ---: | ---: | ---: |
| Original | 556,430 | 2,051,203 | 152,527 | 54,345 |
| Library | 591,236 | 2,193,437 | 167,560 | 58,953 |
| Compiled single-root, islands only | 613,587 | 2,200,717 | 166,757 | 58,695 |
| Compiled single-root + R | 628,086 | 2,242,673 | 239,978 | 83,745 |

Execution means V8 executed UTF-8 source ranges, reset at each checkpoint;
“24 steps” excludes load and sums those checkpoints. It is not CPU time or a
count of unique bytes across the whole script. This uses the existing
production-mode Vite module-runner harness; its installed runtime modules
resolve to `*.dev.js`. Shipped sizes come from the separate minified production
build, gzip summed per chunk, excluding HTML/CSS/maps/RPC responses. These are
harness execution counts, not coverage of a production browser bundle.

The coverage selector now includes nested `@solidjs/web/server-functions/dist`
and `@solidjs/web/frames/dist` paths. Leaving those out would undercount the new
runtime. All four controls were rerun with that correction and merged main;
the older branch's load/shipping numbers must not be subtracted from this row.
The existing checked-in gate baselines were not regenerated.

Navigation execution, including the server-refetched checkpoint timing:

| Step (zero-based) | Original | Library | Single-root | Single-root + R |
| --- | ---: | ---: | ---: | ---: |
| 4: navigate to `/docs/start` | 224,025 | 239,744 | 240,132 | 257,469 |
| 5: article settles | 122,428 | 129,679 | 130,209 | 85,048 |
| 22: navigate to `/docs/missing` | 164,536 | 167,718 | 167,763 | 171,510 |
| 23: typed failure settles | 133,135 | 136,729 | 137,554 | 194,509 |

RPC response bodies are **4,121 bytes** for `start` and **915 bytes** for
`missing`. Their HTML/fragment fields total **3,437** and **285 bytes**;
the remaining bytes carry framing, slot inputs, digests and reveal records.
Request bodies are the slug strings, 5 and 7 bytes. These are uncompressed
HTTP Request/Response body bytes transported intact over the test worker's IPC
carrier, not a network-latency benchmark. RPC handling runs in a separate
process and is excluded from client coverage.

The library fixture explicitly uses an in-process fake API: it fetches **zero
network JSON bytes**. For a meaningful data-size reference, the worker also
measures `JSON.stringify` of the same API result: **2,581 bytes** for `start`,
and **52 bytes** for an explicit `{kind,message}` missing-article error envelope.
These are equivalent JSON sizes, **not invented library HTTP observations**.
Against those data sizes, the R response adds 1,540 and 863 bytes respectively.
A production data-RPC codec could have its own envelope cost.

**Savings answer.** On this docs fixture, moving server-derived logic to the
server saves no total client execution or shipping with this implementation.
Versus islands-only single-root it adds **14,499 load bytes (2.36%)**, **41,956
bytes over the 24 steps (1.91%)**, **73,221 shipped raw bytes (43.91%)** and
**25,050 gzip bytes (42.68%)**. Versus the library it adds **36,850 load bytes
(6.23%)**, **49,236 step bytes (2.24%)**, **72,418 raw bytes (43.22%)** and
**24,792 gzip bytes (42.05%)**. The successful article-settle phase is cheaper,
but transport/slot work and the new frame/RPC runtime outweigh that removal
at this scale. Each navigation now costs one markup RPC, 4,121 bytes for the
successful article or 915 for its typed failure, with the pending-state and
DOM differences described above.

## Validation and reproduction

`pnpm build` passes. The required full gate is **GREEN: 53 pass / 0 fail /
0 skip in 127 seconds**, with no baseline regeneration. No dependency was installed and no commit was pushed. The test gate
checks the explicit C3 findings; green does not mean exact R DOM parity passed.

```sh
node packages/compiler-yield/src/recomputable-report.js --write
C3_FRAME_RECORD=/tmp/c3-frames.json node --test packages/compiler-yield/test/server-region.test.mjs
C3_PARITY_RECORD=/tmp/c3-parity.json node --test packages/compiler-yield/test/server-components.test.mjs
node examples/harness/executed-bytes/hydrated-docs.mjs --regions --runs 3 \
  --record /tmp/c3-bytes.json
pnpm build
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```
