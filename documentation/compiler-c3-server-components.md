# C3: server-recomputable regions — stopped at the typed-failure edge

2026-10-07, `proto/compiler`, based on `d9b94e7`. **C3 is incomplete.** The R
rule and nine-twin analysis are implemented. The single-root C2 mode is imported
from `proto/compiler-single-root`. The first generated article server function
passes a successful frame-render probe but loses its typed failure on the
`missing` input. Per Dev's instruction to stop on a theorem/capture failure,
client integration, slot refetch parity and R byte measurement stopped there.
No R speedup or completed server-component compiler is claimed.

## Rule and analysis

C0 §1.2 now distinguishes S, R, U and C. A memo whose attempt calls a declared
server function with serializable S/U inputs produces server data; a U argument
makes its result R. S is the zero-U case. Pure downstream memos, holes and
settled values follow that provenance. Any C-cell read, event/effect write,
unrelated U read or rejected capture keeps the affected computation client.
The producer of a U input remains client. C0 §§1.3/1.6 define the argument vector,
slot keys, capture checks, refetch behavior, typed-failure route and cost model.
One observed argument-vector change means one RPC returning markup plus slot
inputs. No cache or debounce saving is assumed.

`src/recomputable.js` computes R alongside the existing C1 facts. It preserves
the old grouping for comparison, rather than pretending the eleven docs groups
are eleven verified transport boundaries. The public codec must still check
actual inputs at emission. The analysis proves scalar call-edge shapes from
literal values or typed server-function parameters in a well-typed program;
unproved shapes are refused. An error accessor may follow its server boundary
only while it stays inside that boundary. A reset handler remains client.

The [nine-twin rerun](compiler-c1-report.md#c3-server-recomputable-provenance-2026-10-07)
and [machine-readable facts](compiler-c3-analysis.json) record all fractions,
regions and refused inputs. Docs changes from **124 S / 0 R / 119 client holes**
to **133 S / 56 R / 54 client**, out of 243. JSX changes from **148 S / 0 R /
101 client** to **151 S / 61 R / 37 client**, out of 249. The nine newly S holes
include structural sites and internal error fallback reads, not extra widgets.
The other eight twins gain no R sites: their relevant work uses client-written
state, unknown async/query/live adapters, or unproved input edges. Room's two
rejected candidate inputs are listed with their locations.

Docs region candidates (S is the constant-input case of R):

- **Home → ArticleContent**, `app.tsx:17`: S, argument vector `[]`, baked-in slug
  `overview`, slots `[]`. There is no article-list component in this Home.
- **DocPage → ArticleContent**, `app.tsx:27`: R, argument vector
  `[props.params.slug]`, slots `[]`. The loader, slug default, ArticleBody,
  eight chapter sections, table of contents and related links are eligible for
  server placement.
- **ReadingGuide**, `app.tsx:57`: S, arguments `[]`, baked-in slug `widgets`,
  slots `[]`. Its internal article error boundary is no longer a C-only accessor.
- **SiteNav / SiteFooter**, `app.tsx:49` / `:58`: already S, arguments `[]`,
  slots `[]`.

Home and DocPage each call LikeButton as a **sibling** of ArticleContent. A
larger server wrapper could include each as a slot, keyed by its route call-site
and LikeButton site, with serialized `{slug}` inputs; that wrapper and its slot
transport are unimplemented. The narrower candidates above do not claim slots
that the source does not contain. Client work remains ThemeToggle, SearchBox,
NewsletterForm, CommentList and its avatars, ImageCarousel, both LikeButton
instances, and the router/route shell. The old C1 “client input remains U” leak
rows describe those input producers; they no longer imply their server-function
results must also ship.

## F-C10: the generated article frame discards NotFound

`src/server-region.js` extracts ArticleContent and its template dependencies,
then emits a `"use server"` function returning that template. Its `slug` crosses
the public capture codec successfully. The test uses the installed Vite plugin
with `serverFunctions: {components: true}`, a public request scope, and
`renderServerComponent`. It retains the authored memo, Loading and Errored
inside the region; it does not write a replacement article implementation.

For `start`, the emitted frames contain the complete article, contents list and
related links, with no server errors. For `missing`, server `onError` observes
`{kind: "not-found", message: "No article: missing"}`. The outgoing frame
instead contains:

```json
{"type":"error","key":"01000000","error":{"message":"Internal Server Error"}}
```

Subsequent hole-error chunks also carry only `Internal Server Error`; neither
the original message/kind nor `.not-found` fallback markup is present. The
[recorded frames](compiler-c3-frame-finding.json) include both inputs. This is a
failed edge-preservation check: removing the server region's client code would
remove its authored error handling while the transport has discarded the data
needed to reproduce it. It is not a claim of a new Solid-wide theorem failure;
it is the concrete failure of this generated region on this branch.

The finding does **not** assume a flushed SSR region must print its fallback.
Main's D-115 and corrected `/docs/missing` smoke criterion were read without
changing main: typed error data may stream and the hydrated client must display
the typed fallback while retaining its server nodes. This compiler branch lacks
that D-115 implementation and still has the old F-C9 expected-failure harness.
In the new frame probe the failure information itself is gone, independently of
whether fallback markup appears in the initial stream. Safe-error marking and
preservation of a custom error class are distinct obligations: C0 §1.6's public
codec capture test also still refuses a custom Error whose prototype is lost.
A later resumption should bring the intended typed-failure path to this branch
and test actual frame application before proceeding. This run makes no private
runtime patch and does not replace the failure with successful markup.

## Measurements

Three fresh control runs in this checkout, Node v24.18.0 / Solid rc.13. All 100
phases across original, library, single-root and seven-root had zero drift.
The seven-root observations remain in the [raw record](compiler-c3-controls-bytes.json)
for reproducibility; the requested comparison is one table below. Steps exclude
load. Shipped sizes are minified production JS, gzip summed per chunk; HTML,
CSS, maps and response payloads are excluded.

| Variant | Executed at load | Executed over 24 steps | Shipped raw | Shipped gzip |
| --- | ---: | ---: | ---: | ---: |
| Original | 550,893 | 2,049,935 | 152,339 | 54,285 |
| Library | 584,641 | 2,189,856 | 166,658 | 58,755 |
| Compiled single-root, islands only | 606,992 | 2,197,136 | 165,855 | 58,482 |
| Compiled single-root + R | **not measured — F-C10** | **not measured** | **not measured** | **not measured** |

These fresh load controls differ from the other worktree's 549,717 / 583,325 /
605,662 because this harness counts path-bearing transformed module bytes.
Shipped sizes and step totals reproduce that branch. Do not subtract load
values from different checkouts. This is V8 executed source-range coverage,
reset at every checkpoint, not execution time or CPU instruction counts.

Navigation-step executed bytes, in original / library / single-root order:

- Navigate to `/docs/start`: **224,025 / 238,733 / 239,121**.
- Article settles: **122,428 / 129,679 / 130,209**.
- Navigate to `/docs/missing`: **164,536 / 167,718 / 167,763**.
- Typed error settles: **132,818 / 135,935 / 136,760**.

R navigation execution and RPC payload bytes are unavailable because its
refetch stub was not integrated. The existing library API is explicitly an
in-process fake; its `"use server"` directives are not transformed into RPCs by
the control configuration. Therefore those navigation controls fetch **zero
network payload bytes**; there is no measured library JSON response to compare.
The successful isolated frame probe contains 4,444 HTML bytes, or 6,088 bytes
as a JSON array of frame chunks. The failing probe contains 75 HTML bytes and
3,565 JSON-array bytes. These are probe outputs, **not measured HTTP navigation
responses**, and the failure payload is not behaviorally valid. They cannot
supply the requested markup-versus-JSON RPC comparison.

**Savings answer.** Moving server-derived logic to the server has no established
load or script saving on docs yet: the R variant stopped at a failed typed-error
edge before comparable execution and shipping measurements. The working
islands-only single-root variant saves 803 raw bytes (0.48%) and 273 gzip bytes
(0.46%) versus the library, but executes 22,351 more bytes at load (3.82%) and
7,280 more over the 24 steps (0.33%). The proposed R cost is one markup RPC per
observed input-vector change; neither its actual navigation cost nor its net
client-code saving is measured here.

## Validation and reproduction

`pnpm build` passed. The required full gate is **GREEN: 52 pass, 0 fail,
0 skip, 90 seconds**, with no baseline change. The analysis lane passes 65
fixtures (59 existing plus six R checks); the emission lane includes the new
frame-failure probe. Original, library, single-root and seven-root match all
24 hydrated snapshots and direct `/docs/start` smoke. The existing extracted-root
conformance lane passes. Direct `/docs/missing` remains the old F-C9 expected
failure in this branch's harness, not a passing corrected smoke.

The baseline is unchanged. Successful C2 checks do not establish C3 parity:
there is no R 24-step run, no R navigation marked `server-refetched`, and no R
slot hydration/conformance result. No DOM difference has been normalized away.

```sh
node packages/compiler-yield/src/recomputable-report.js --write
node --test packages/compiler-yield/test/recomputable.test.mjs
C3_FRAME_RECORD=/tmp/c3-frames.json node --test packages/compiler-yield/test/server-region.test.mjs
node examples/harness/executed-bytes/hydrated-docs.mjs --single --runs 3 \
  --record /tmp/c3-controls.json
pnpm build
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

The new analysis tests and frame-failure test are included in the existing
compiler gate steps. The frame test passing means F-C10 still reproduces;
it does not mean failed-region rendering is correct. No dependency was installed,
no baseline was re-recorded, and no commit was pushed.
