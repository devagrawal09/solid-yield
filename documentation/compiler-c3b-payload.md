# C3b: a realistic server-derived article pipeline

**Terminology (2026-10-08).** Dev corrected the earlier use of “islands”: C2 (seven-root and single-root modes) is **static extraction + eager root split**. Every root remains a full client component, and the article still renders in the browser. Islands in the Astro/Marko sense are server-rendered content with small interactive leaves: **C3–C3c are islands, i.e. server components with client slots** such as LikeButton and copy-code. Dev’s measured summary: “static extraction and root splitting never pay; islands (server components with client slots) pay above ~25 KB gzip of server-derivable code and scale.” The `eagerIslands` pass name predates this correction and is unchanged; read older branch reports with this distinction.

2026-10-07, `proto/compiler`. This follows option B and the small-template
[C3 control](compiler-c3-server-components.md). No production code or baseline
from another twin was changed. The original 24 docs steps remain in order;
four new steps navigate to the code-heavy article, wait for it, follow its
heading-derived TOC, and check a highlighted TypeScript token, table and date.

## Fixture and library cost

Both docs apps contain identical API data, six Markdown files and the same
`renderArticle` implementation. Each source is 4,847–4,870 bytes (29,180 total),
with headings, lists, internal links, four fenced blocks (TypeScript,
JavaScript and shell), and a table. They share a guide structure and much of
the prose, so the corpus compresses well. No existing widget was removed.

`ArticleContent` owns a pipeline memo beside its `getArticle(slug)` loader memo;
`ArticleBody` consumes their results.
The pipeline creates a fresh `Marked` renderer and a fresh highlight.js registry,
registers only `ts`, `js` and `sh`, renders highlighted HTML, derives heading IDs
and a TOC during parsing, and formats the stored publication date using `en-US`
and UTC. Duplicate headings get distinct IDs scoped to the article. This is
repository-authored Markdown, not an untrusted-content sanitizer. There is no
clock, browser state, remote grammar download or shared mutable registry in the
adapter. The original and library run this on the client at hydration and after
article changes; the R output runs it on the server.

Pinned packages: **marked 18.1.0; highlight.js 11.12.0**. Marked is ESM and
synchronous; highlight.js has a synchronous core and separately imported
languages. [Standalone minified production bundles](compiler-c3b-libraries.json),
excluding app, Solid and frame code:

| Payload | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| Marked | 45,647 | 13,691 |
| highlight.js core + TypeScript/JavaScript/shell | 38,756 | 12,753 |
| Combined libraries | 84,611 | 26,325 |
| highlight.js all languages, comparison only | 978,924 | 315,130 |

The combined gzip is compressed as one bundle, not the sum of separately
compressed libraries. The small language set avoids 940,168 raw / 302,377 gzip
bytes versus the full highlighter. The actual single-root app attributes
84,622 minified bytes to these libraries and 946 to the adapter; standalone
and app bundles differ slightly through names, glue and compression context.

## Placement and shipping proof

The [C1 rerun](compiler-c1-report.md#c3-server-recomputable-provenance-2026-10-07)
and [analysis](compiler-c3-analysis.json) cover all nine twins. Docs now has
**59 S / 19 R / 54 client holes, total 132**, and **59 S / 15 R / 37 client JSX
sites, total 111**. These counts are smaller because Markdown replaces the
old repeated JSX sections; they are not byte savings. The other eight twins'
analysis records are unchanged.

Home's article and ReadingGuide are S with `[]`. DocPage's entire article is
R with **`[props.params.slug]`**, lowered to `routeRegion(slug)`. Its loader,
Markdown rendering, highlighting, TOC and date are inside that region. The
three pipeline memos are **S / R / S**. Eleven C1 groups remain;
the emitted R app has one eager hydration owner and a keyed LikeButton slot.
The router and all existing widgets remain client-owned.

**F-C12 — external pipeline purity needs an explicit contract.** The analyzer
cannot infer the behavior of opaque package calls. The bounded prototype now
recognizes only the reviewed `renderArticle` export at its exact docs path,
with a SHA-256 check of the complete adapter and exact installed package
versions. The adapter uses only its argument and fresh local state. This is a
manual, checked contract, not a general proof of arbitrary Markdown packages.
A changed adapter fails the contract and the R emitter refuses extraction.
Tests show that R input produces R, unknown input remains U, event-written
input remains C, and changed source is not accepted. Without the same contract
in C1, opaque shared imports also conservatively join the article and guide,
preventing the existing eager split. No broad package whitelist was added.

The minified production shipping check inspects **every client chunk's module
IDs**, rejecting `marked`, `highlight.js`, `article-pipeline` and Markdown source
modules in R, alongside the existing article-string checks. It passes. The
other three builds contain the libraries. Raw Markdown accounts for 28,886
mapped minified bytes in each control and zero in R. Since this fake API is
in-process, embedded data removal must not be confused with code removal; the
separate ablations below remove that advantage from the calculation.

## Three-run measurements

[All observations, phase counts, client module lists, source-map attribution
and RPC bodies](compiler-c3b-bytes.json). Node v24.18.0, Solid rc.13, production
conditions, completed SSR in a separate process, all roots hydrated eagerly.
**All 116 phases have zero run-to-run byte drift.**

| Variant | Executed at load | Executed over 28 steps | Shipped raw | Shipped gzip |
| --- | ---: | ---: | ---: | ---: |
| Original | 714,548 | 2,687,935 | 265,045 | 83,086 |
| Library | 747,726 | 2,838,073 | 280,029 | 87,683 |
| Compiled single-root, islands only | 770,260 | 2,846,309 | 279,169 | 87,600 |
| Compiled single-root + R | 628,086 | 2,746,612 | 239,978 | 83,744 |

Execution counts V8 executed UTF-8 source ranges, reset at every checkpoint.
The step column excludes load and sums those checkpoints; it is neither CPU
time nor unique executed code over the whole visit. This is the same Vite
module-runner harness as C3, including installed `*.dev.js` runtime modules.
The coverage selector now also includes `marked` and `highlight.js`, including
both the ESM entry and CommonJS core. The browser module runner needs an
export-only adapter for highlight.js's standalone CommonJS core; real production
builds use Vite's normal CommonJS handling. All four controls use that same
harness. Server execution runs outside the coverage process.

Shipping comes from separate minified production builds, with gzip summed per
chunk; it excludes HTML, CSS, source maps and RPC bodies. Therefore execution
counts are not coverage of those minified browser bundles.

Against islands-only, R saves **142,174 load bytes (18.46%)**, **99,697 step
bytes (3.50%)**, **39,191 shipped raw bytes (14.04%)**, and **3,856 gzip bytes
(4.40%)**. Against the library it saves **119,640 load (16.00%)**, **91,461 step
(3.22%)**, **40,051 raw**, and **3,939 gzip (4.49%)** bytes. Against the original,
it saves 86,462 load bytes but executes 58,677 more step bytes and ships 658
more gzip bytes. It does not beat every control on every metric.

### Navigation and response data

Phase indices are zero-based and exclude load. The TOC step changes the hash;
it makes no region RPC.

| Step | Original executed | Library executed | Islands executed | R executed |
| --- | ---: | ---: | ---: | ---: |
| 4: navigate to start | 215,085 | 229,512 | 229,900 | 257,469 |
| 5: start settles | 213,985 | 220,443 | 220,997 | 84,944 |
| 22: navigate to missing | 164,387 | 167,602 | 167,712 | 171,510 |
| 23: failure settles | 134,561 | 138,155 | 138,980 | 194,450 |
| 24: navigate to pipeline | 164,438 | 167,653 | 167,763 | 172,104 |
| 25: pipeline settles | 258,127 | 264,769 | 265,295 | 195,771 |
| 26: follow TOC | 129,363 | 129,363 | 129,399 | 136,290 |

R makes exactly three RPCs, one per changed slug, and zero on hydration or TOC
navigation. There is no ReadingGuide refetch. Successful results carry rendered
HTML, highlighted spans and slot inputs. Request bodies are the strings
`start`, `missing`, `pipeline`, respectively 5, 7, 8 bytes.

| Slug | Frame response raw | HTML fields raw | Equivalent JSON raw | Frame gzip | JSON gzip |
| --- | ---: | ---: | ---: | ---: | ---: |
| start | 10,147 | 9,234 | 5,290 | 3,314 | 2,379 |
| missing | 915 | 285 | 52 | 409 | 72 |
| pipeline | 10,196 | 9,280 | 5,303 | 3,313 | 2,376 |

**The library actually fetches zero HTTP JSON bytes:** `getArticle` is still
the explicitly in-process fake API. JSON here is `JSON.stringify` of that same
result, measured in the separate worker; the failure uses an explicit
`{kind,message}` envelope. Frame raw bytes are observed Request/Response body
bytes transported intact over IPC. Gzip columns are an offline compression
comparison, not observed content encoding. A real data RPC adds its own codec
and headers. There is no network-latency claim.

R adds **4,857 / 863 / 4,893 raw response bytes** versus those JSON references,
or **935 / 337 / 937 gzip bytes**. Thus the 3,856-byte initial gzip saving versus
islands would be consumed after roughly **five successful article navigations**
if both responses used comparable gzip, without caching. The code-only saving
below is smaller and would be consumed after roughly two. Those are hypothetical
real-data-RPC tradeoffs, not measured HTTP totals for this in-process fixture.

## Marginal cost and break-even

To separate code from the fake API's embedded corpus, `docs-payload.mjs` makes
three additional **shipping-only ablations**. These are not parity variants:
all Markdown imports become empty strings; one control additionally substitutes
a trivial `{html: article.markdown, toc: [], date: article.published}` derivation.
The normal component shell, widgets, runtime and build configuration remain.
R gets the same empty-data transform. No ablation changes the four measured
rows or their executed-byte observations.

| Controlled build, empty embedded corpus | Raw | Gzip |
| --- | ---: | ---: |
| Islands with full pipeline | 249,912 | 84,998 |
| Islands with trivial derivation | 163,907 | 58,086 |
| R | 239,940 | 83,711 |

The removable pipeline contributes **86,005 raw / 26,912 gzip bytes** in this
bundle context. The net fixed R integration cost against the trivial client
control is **76,033 raw / 25,625 gzip bytes**. That includes frame/RPC code and
changed shell/slot/template code; it is not an isolated measurement of just
`@solidjs/web/frames`. It is consistent with C3's roughly 72 KB raw / 25 KB gzip
frame-runtime tax. Whole-bundle gzip differences are marginal measurements,
not sums of source-file gzip sizes.

For an additional `P` bytes of exclusively server-derivable shipped code at this
boundary, the raw marginal model is **net saving = P − 76,033**: about **1 KB
removed from the client per 1 KB of removable minified code**, before the fixed
cost. Measured against the 84,611-byte standalone library bundle, the complete
86,005-byte removal is 1.016 KB per library KB; the small extra is adapter and
bundle packing. The observed pipeline compression ratio is 26,912 / 86,005,
about 31.29%.

**Break-even: 76.033 KB raw, or 25.625 KB gzip of removable code.** At this
pipeline's observed compression ratio, the gzip threshold corresponds to about
**81.892 KB raw**. These are decimal KB. Source size alone is not a universal
threshold: tree shaking, compression, existing shared dependencies and different
frame/runtime choices change it. The current code-only pipeline exceeds the
threshold by **9,972 raw / 1,287 gzip bytes**. It therefore pays even after
removing the fake corpus advantage, but only narrowly on compressed shipping.
The full fixture's larger 39,191 / 3,856-byte saving also includes embedded
Markdown and its compression context. Small differences in the ablation R
bundle (38 raw / 33 gzip bytes) are retained, rather than forcing its packing
to equal the full fixture.

## Parity limits and validation

Original, library, seven-root islands and single-root islands pass all **28
exact normalized DOM comparisons**. Direct start/missing SSR and hydration
retain the server nodes. Tests also keep likes, the rate-limit message and
LikeButton identity through the existing failing navigation.

For R, [the diagnostic record](compiler-c3b-parity.json) reports **0/28 exact
matches; 28/28 authored-content matches** after explicitly accounting for the
differences below. The ordinary parity normalizer is unchanged.

- **F-C11 remains:** public `solid-frame` wrappers and the first navigation's
  pending template alter the DOM. The initial empty interval before the first
  RPC frame also remains. Step 4 waits for that first frame. Settled steps 5,
  23 and 25 explicitly wait for the returned content: the larger rendering
  pipeline can exceed the old fixed 100 ms wait. These checks establish settled
  content, not identical pending-state timing.
- **F-C13 — frame and ordinary HTML link claims differ:** frames claim links
  inside Markdown `innerHTML`, adding router-owned `data-active`/`aria-current`
  attributes that ordinary hydration does not add. TOC active attributes also
  differ when the article mounts after the missing-route fallback. The separate
  diagnostic removes only router-owned attributes on Markdown and TOC anchors
  from both sides, in addition to the already recorded frame nodes. It preserves the exact snapshot hashes and does not claim exact parity. TOC targets, actual
  hash navigation, article text, highlighted tokens, tables and widget state
  are still checked. This remains a limit of this public-frame lowering.

- **F-C14 — generic frame discovery can recreate a downstream memo:** with
  the pipeline memo inside `ArticleBody`, beneath the loader's Loading view,
  the generic frame probe hit “boundary discovery did not converge after 10001
  passes.” Ordinary streamed SSR and the earlier settled-data R wrapper did
  not expose it. Hoisting the derivation beside the loader in both authored
  apps gives that memo a stable setup owner; the R lowering now mirrors those
  two setup memos. The generic success/failure probe, direct hydration and
  28-step comparisons pass with this arrangement. This is a recorded placement
  constraint, not a claim that the general nested-memo frame issue was fixed
  upstream. No scheduler or library runtime was changed.

`pnpm build` passes. The required full gate is **GREEN: 53 pass / 0 fail /
0 skip in 110 seconds**, with no regression against the unchanged gate baseline.
The docs script grew from 24 to 28 steps, so **only docs entries** were regenerated
in `executed-bytes.json`, plus the docs-only `docs-hydrated-bytes.json` baseline
(three runs). The other eight twins' baseline objects compare byte-for-byte
as JSON to their previous values. `yield-gate-baseline.json` was not changed.
No pushes were made.

```sh
node packages/compiler-yield/src/recomputable-report.js --write
C3_PARITY_RECORD=documentation/compiler-c3b-parity.json node --test packages/compiler-yield/test/server-components.test.mjs
node examples/harness/executed-bytes/docs-payload.mjs --record documentation/compiler-c3b-libraries.json
node examples/harness/executed-bytes/hydrated-docs.mjs --regions --runs 3 --record documentation/compiler-c3b-bytes.json
pnpm build
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

**Answer.** Moving this realistic article pipeline to the server pays against
the library and islands controls, but the compressed-code win is modest:
3,856 gzip bytes (4.40%) versus islands in the full fake-data fixture, and
1,287 gzip bytes when the embedded Markdown advantage is removed. It reduces
load execution by 18.46% and 28-step execution by 3.50% versus islands. The
code-only break-even is 25.625 KB gzip, about 81.892 KB raw at this pipeline's
compression ratio, and the pipeline barely clears it. Successful markup
responses cost about 0.94 KB gzip more than equivalent Markdown JSON, so a
reader visiting several articles can spend the initial byte saving on response
data. It is not an across-the-board win over the original app, and F-C11/F-C13
still prevent a claim of exact R DOM parity.
