# C3c: amortizing server components across a content site

**Terminology (2026-10-08).** Dev corrected the earlier use of “islands”: C2 (seven-root and single-root modes) is **static extraction + eager root split**. Every root remains a full client component, and the article still renders in the browser. Islands in the Astro/Marko sense are server-rendered content with small interactive leaves: **C3–C3c are islands, i.e. server components with client slots** such as LikeButton and copy-code. Dev’s measured summary: “static extraction and root splitting never pay; islands (server components with client slots) pay above ~25 KB gzip of server-derivable code and scale.” The `eagerIslands` pass name predates this correction and is unchanged; read older branch reports with this distinction.

2026-10-07, `proto/compiler`, continuing C3b. Main was not merged again. The
compiler remains an experiment on this branch; main's analyzer is unchanged.

## Site and levels

The two authored sites have identical data and pipeline sources, with exact
original/library DOM comparisons. `DOCS_LEVEL=S|M|L` selects a build-time
content set; L is the default, including in the gate. All builds start on the
same docs overview. Additional renderers are statically imported, as in the
SPA control: this measures an eager SPA, not a route-code-split SPA. Each
loader has a `"use server"` directive. Its memo result feeds one adjacent
pipeline memo, which dispatches by content type and stays **S / R / S** in
Home / DocPage / ReadingGuide. The changing region takes **[props.params.slug]**.

| Level | Enabled content | Rendering work |
| --- | --- | --- |
| S | Six docs articles | Marked, highlight.js with TypeScript/JavaScript/bash, heading-derived TOC and UTC date |
| M | S plus four blog posts | KaTeX math, Marked, nine highlight.js grammars: ts, js, bash, json, css, html/XML, python, rust, go |
| L | M plus one 20-entry API reference and one eight-release changelog | JSON Schema reference resolver and nested field tables; json-schema-to-zod generates highlighted validation examples; diff2html renders real unified diffs |

The API generator contains 6,644 bytes of adapter source and calls 28,600 bytes
of actual generator source across 23 modules. It handles local references,
objects, arrays, unions, constraints, defaults and generated validation code.
Unknown references and cycles fail explicitly. There is no padding, generated
code evaluation, full-highlighter import, or unused grammar collection. Tests
render every post, not just the one visited in the session. Content is authored
fixture data, not a sanitizer for untrusted input.

Versions: marked **18.1.0**, highlight.js **11.12.0**, KaTeX **0.19.0**,
json-schema-to-zod **2.8.1**, diff2html **3.4.56**. Package APIs:
[KaTeX renderToString](https://katex.org/docs/node),
[schema generation](https://github.com/StefanTerdell/json-schema-to-zod),
[diff2html](https://github.com/rtfpessoa/diff2html).

The theme, search, newsletter, carousel, comments and likes remain unchanged.
The existing keyed LikeButton is the client SLOT inside the server region;
its node survives refetch, including the failing route. No extra widget was
needed to demonstrate the client-leaf boundary. Blog, API and changelog use
the same `/docs/:slug` page owner, with separate navigation sections.

The first 28 checkpoints are retained. Twelve more browse docs → blog → API →
changelog → docs, with navigation, settled content and assertion checkpoints
for each visit. Assertions require a KaTeX node, an API cross-link with an
existing target and 20 entries, eight releases with an inserted diff line,
and a highlighted token after returning to docs. S substitutes routing,
testing and overview docs; M substitutes docs for API/changelog. Thus all
levels run 40 checkpoints and seven region navigations, but their available
content naturally differs.

## Purity contract and placement

F-C12 now uses a module-level **`"use pure"`** directive, defined in
[compiler-c0.md §1.2](compiler-c0.md#12-provenance). It is an author assertion:
exported functions depend only on arguments, including through their package
calls. The compiler does not prove or inspect their implementations for purity.
It joins their argument provenance; U stays U and event-written inputs stay C.
Without the directive, opaque package calls remain client-owned. There is no
adapter path, source hash or package-version whitelist. The existing SHA guards
on the bounded emitter's component *shapes* remain; these guard its lowering,
not pipeline purity.

The [analysis report](compiler-c3-analysis.json) lists six trusted modules:
`page-pipeline`, `article-pipeline`, `post-pipeline`, `api-pipeline`,
`changelog-pipeline`, and `pipeline-utils`. C1 also emits a diagnostic for each
marked module supplied to analysis. Provenance tests cover R, U and C inputs,
source edits under the assertion, and removal of the directive. Determinism and
non-mutation tests support the assertion but do not constitute a purity proof.
The theorem is conditional on truthful assertions; capture checks are unchanged.

Docs remains **59 S / 19 R / 54 client holes**, with **59 S / 15 R / 37 client
JSX sites**, eleven analysis groups, and one eager R hydration owner. Every
other twin's saved C3 analysis object is unchanged. No new capture failure or
theorem-breaking construct was encountered. F-C14's stable adjacent loader and
pipeline memo placement remains in use.

## Payload sizes

[Three production builds of each payload](compiler-c3c-payloads.json).
Libraries-only exports the APIs and language registry actually needed at that
level. Full pipelines adds the adapters, schema walker, HTML formatting and
TOC/date logic, but excludes the corpus, app and Solid runtime. Gzip is measured
on complete bundles, not summed per library. Sizes use bytes; KB below is decimal.

| Level | Libraries raw | Libraries gzip | Full pipelines raw | Full pipelines gzip |
| --- | ---: | ---: | ---: | ---: |
| S | 84,629 | 26,331 | 85,365 | 26,741 |
| M | 370,215 | 111,656 | 371,803 | 112,868 |
| L | 424,033 | 127,547 | 429,006 | 130,049 |

All payload and application shipping builds have zero size drift across their
three runs. S's libraries differ from C3b's 84,611 / 26,325 by 18 raw / 6 gzip
bytes because this standalone registry uses full language names; this is not
a change to the underlying packages.

## Three-run four-row results

Executed bytes count V8 UTF-8 source ranges, reset at each checkpoint. Session
execution sums the 40 checkpoints **excluding load**; it is not unique code
or CPU time. The tables use the largest observed load and complete-session
sum, rather than adding independent per-phase maxima. M/L have zero execution
drift. S's islands session varies by 93 bytes (4,563,852–4,563,945); its other
rows have zero drift. No run was discarded for drift.

Shipping is minified production JavaScript, gzip summed per chunk. It excludes
HTML, CSS/fonts, source maps and response bodies. KaTeX's CSS/fonts and diff CSS
are still needed with R; removing the JavaScript renderer does not remove
those visual assets. Client chunk module checks reject all pipeline libraries,
adapters and corpus modules in R, while allowing their required CSS imports.

The execution harness is the same completed-SSR, separate-process Vite browser
module runner as C3b, including installed development runtime modules under
production conditions. Its coverage selector now includes all new renderer
packages. highlight.js keeps its existing export adapter. diff2html's CommonJS
template dependency is bundled to ESM without minification only for the browser
module runner; production shipping uses Vite's ordinary package handling.
All controls use that same adapter. These are not coverage counts of the
minified production chunks, and not a browser performance benchmark.

### Level S

[All observations and chunks](compiler-c3c-S-bytes.json).

| Variant | Executed at load | Executed over 40 steps | Shipped raw | Shipped gzip |
| --- | ---: | ---: | ---: | ---: |
| Original | 716,517 | 4,364,028 | 265,247 | 83,137 |
| Library | 749,671 | 4,553,244 | 280,231 | 87,740 |
| Single-root islands | 772,259 | 4,563,945 | 279,209 | 87,627 |
| Single-root + R | 628,086 | 4,174,181 | 239,978 | 83,744 |

### Level M

[All observations and chunks](compiler-c3c-M-bytes.json).

| Variant | Executed at load | Executed over 40 steps | Shipped raw | Shipped gzip |
| --- | ---: | ---: | ---: | ---: |
| Original | 1,039,883 | 4,441,658 | 556,411 | 170,157 |
| Library | 1,073,017 | 4,631,127 | 571,415 | 174,438 |
| Single-root islands | 1,095,443 | 4,641,156 | 570,108 | 174,364 |
| Single-root + R | 628,086 | 4,174,076 | 239,978 | 83,744 |

### Level L

[All observations and chunks](compiler-c3c-L-bytes.json).

| Variant | Executed at load | Executed over 40 steps | Shipped raw | Shipped gzip |
| --- | ---: | ---: | ---: | ---: |
| Original | 1,096,058 | 4,366,734 | 627,380 | 189,329 |
| Library | 1,129,164 | 4,556,267 | 642,400 | 193,576 |
| Single-root islands | 1,150,804 | 4,566,492 | 640,952 | 193,435 |
| Single-root + R | 628,086 | 4,193,059 | 239,978 | 83,744 |

## Scaling curve

The reference threshold is C3b's **76,033 raw / 25,625 gzip bytes** of removable
code, measured with the embedded corpus removed against a trivial islands
pipeline. It is a historical code-only break-even estimate, not a fourth C3c
measurement or a universal threshold. The measured gains below compare R to
the **library** and include the fake API's embedded corpus. That difference in
control and compression context is retained explicitly.

| Point | Server-derivable libraries gzip KB | Shipped gzip saved vs library | Gzip gain | Load execution saved | Load gain |
| --- | ---: | ---: | ---: | ---: | ---: |
| C3b break-even estimate | 25.625 | ≈ 0 | — | not measured at this point | — |
| S | 26.331 | 3,996 | 4.55% | 121,585 | 16.22% |
| M | 111.656 | 90,694 | 51.99% | 444,931 | 41.47% |
| L | 127.547 | 109,832 | 56.74% | 501,078 | 44.38% |

```text
Shipped gzip saved (KB)
110 |                                                   L
 90 |                                             M
 60 |
 30 |
  4 |          S
  0 |          B
    +-----------------------------------------------------
    0         25        50        75        100       130
               Server-derivable libraries (gzip KB)
B = historical C3b code-only threshold; S/M/L = measured sites
```

**F-C15 — the fixed client cost is amortized, but response expansion remains.**
R ships exactly **239,978 raw / 83,744 gzip bytes** and executes **628,086 bytes
at load** at every size. The library grows with actual renderer code. S barely
pays; M and L show large gains. This is evidence for the scaling claim in an
eager SPA comparison, not evidence that any 26 KB package yields the same win.
A route-split SPA would pay some renderer downloads later; it was not measured.

## Per-navigation execution and response bytes

Each execution entry sums navigation and settled-content checkpoints; content
assertions execute no app code. The numbers below are maxima of the paired
checkpoint sums over the three runs. Phase numbers exclude load. The missing
route is included because error handling has a different cost. A repeated
pipeline visit remains a separate RPC; no cache or deduplication saving is assumed.

The frame columns are actual response-body bytes carried intact over IPC by
the public frame/RPC handler. Request bodies are the slug strings (3–12 bytes).
The library API remains the explicitly **in-process fake API** from C3b:
**observed library HTTP JSON bytes are zero**. JSON columns measure
`JSON.stringify` of the identical loader result in the server worker, including
an explicit failure envelope. They are an equivalent-data-RPC comparison, not
a claim that the library made HTTP requests. Gzip is offline compression, not
observed content encoding; headers and network latency are not measured.

### Level S: navigation

| Phases / slug | Original executed | Library executed | Islands executed | R executed | Frame raw / gzip | Equivalent JSON raw / gzip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 4+5 / start | 429,409 | 450,294 | 451,236 | 342,413 | 10,147 / 3,314 | 5,290 / 2,379 |
| 22+23 / missing | 299,031 | 305,840 | 306,775 | 365,960 | 915 / 409 | 52 / 72 |
| 24+25 / pipeline | 422,780 | 432,767 | 433,403 | 367,875 | 10,196 / 3,313 | 5,303 / 2,376 |
| 28+29 / routing | 419,096 | 428,898 | 429,404 | 366,765 | 10,170 / 3,313 | 5,289 / 2,382 |
| 31+32 / testing | 419,075 | 428,877 | 429,427 | 367,303 | 10,181 / 3,315 | 5,300 / 2,377 |
| 34+35 / overview | 418,626 | 428,428 | 428,978 | 347,807 | 10,174 / 3,326 | 5,281 / 2,388 |
| 37+38 / pipeline | 418,659 | 428,396 | 429,060 | 345,694 | 10,196 / 3,313 | 5,303 / 2,376 |

### Level M: navigation

| Phases / slug | Original executed | Library executed | Islands executed | R executed | Frame raw / gzip | Equivalent JSON raw / gzip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 4+5 / start | 429,436 | 450,184 | 451,262 | 342,413 | 10,147 / 3,314 | 5,290 / 2,379 |
| 22+23 / missing | 299,031 | 305,970 | 306,775 | 365,960 | 915 / 409 | 52 / 72 |
| 24+25 / pipeline | 422,936 | 432,923 | 433,429 | 367,875 | 10,196 / 3,313 | 5,303 / 2,376 |
| 28+29 / post-latency | 496,400 | 506,072 | 506,578 | 366,729 | 9,365 / 2,058 | 1,308 / 741 |
| 31+32 / testing | 419,101 | 428,903 | 429,453 | 367,223 | 10,181 / 3,315 | 5,300 / 2,377 |
| 34+35 / overview | 418,652 | 428,389 | 429,004 | 347,818 | 10,174 / 3,326 | 5,281 / 2,388 |
| 37+38 / pipeline | 418,685 | 428,422 | 428,993 | 345,694 | 10,196 / 3,313 | 5,303 / 2,376 |

### Level L: navigation

| Phases / slug | Original executed | Library executed | Islands executed | R executed | Frame raw / gzip | Equivalent JSON raw / gzip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 4+5 / start | 429,492 | 450,240 | 451,318 | 342,413 | 10,147 / 3,314 | 5,290 / 2,379 |
| 22+23 / missing | 299,031 | 305,970 | 306,775 | 365,960 | 915 / 409 | 52 / 72 |
| 24+25 / pipeline | 422,992 | 432,979 | 433,485 | 367,875 | 10,196 / 3,313 | 5,303 / 2,376 |
| 28+29 / post-latency | 496,272 | 506,074 | 506,580 | 366,729 | 9,365 / 2,058 | 1,308 / 741 |
| 31+32 / api | 400,304 | 410,106 | 410,656 | 367,187 | 69,113 / 4,454 | 12,385 / 1,713 |
| 34+35 / changelog | 363,712 | 373,514 | 374,129 | 366,837 | 28,764 / 1,975 | 3,483 / 679 |
| 37+38 / pipeline | 417,514 | 427,120 | 427,887 | 345,694 | 10,196 / 3,313 | 5,303 / 2,376 |

### The trade at L

| Content visit | Client execution saved vs library | Extra frame raw vs JSON | Extra frame gzip vs JSON |
| --- | ---: | ---: | ---: |
| Docs (start) | 107,827 | 4,857 | 935 |
| Blog | 139,345 | 8,057 | 1,317 |
| API | 42,919 | 56,728 | 2,741 |
| Changelog | 6,677 | 25,281 | 1,296 |

These are different units of work and transfer; executed source bytes are not
a byte-priced proxy for CPU. In particular, the changelog saves little execution
per visit, while its renderer still contributes to the initial shipping gain.

| Level | Frame responses gzip, 7 RPCs | Equivalent JSON gzip | Response premium | Initial JS gzip gain | Gain after equivalent JSON RPCs | Gain against actual zero-HTTP fake API |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| S | 20,303 | 14,350 | 5,953 | 3,996 | -1,957 | -16,307 |
| M | 19,048 | 12,709 | 6,339 | 90,694 | 84,355 | 71,646 |
| L | 18,836 | 10,336 | 8,500 | 109,832 | 101,332 | 90,996 |

The last two columns are compression comparisons, not observed HTTP transfer
with gzip enabled. They count only JS and navigation responses, excluding
initial SSR HTML and shared assets. At L, session execution saves **363,208
bytes (7.97%)**; load plus session saves **864,286 (15.20%)**. The failing
navigation executes **59,990 more bytes** with R, so it is not a win at every
checkpoint. Over unlimited uncached navigation the response premium accumulates;
this finite session does not make it disappear.

## Parity limits and validation

Original/library, seven-root islands and single-root islands pass **40 exact
normalized DOM comparisons at S, M and L**. At L, direct docs success/failure,
blog, API and changelog SSR/hydration retain their server nodes. The
[separate R diagnostic](compiler-c3c-parity.json) records **0/40 exact matches
and 40/40 authored-content matches**, preserving exact snapshot hashes.

- **F-C11:** public `solid-frame` wrappers and the first-navigation pending
  template still alter the DOM. The initial empty interval before the first
  frame remains; settled content checks await the returned selector.
- **F-C13:** frame handling claims links inside `innerHTML` and differs in TOC
  router attributes. Only the existing separate diagnostic removes those
  router-owned attributes and frame wrappers. The ordinary parity normalizer
  was not weakened. No exact R DOM-parity claim is made.
- **F-C14:** derivation stays beside its loader to avoid the previously recorded
  generic frame-discovery issue. This does not fix the upstream nested-memo case.

`pnpm build` passes. The full gate is **GREEN: 53 pass / 0 fail / 0 skip in 149 seconds**, with no
regression against the unchanged gate baseline.
Only docs records in `executed-bytes.json` and `docs-hydrated-bytes.json` were
regenerated because the script gained twelve checkpoints. The reachability
phase list gained those same steps. **`yield-gate-baseline.json` is unchanged**;
all other twins' executed-byte baseline objects and C3 analysis objects are
unchanged. Installs ran in the foreground. No push or main merge was performed.

Reproduce:

```sh
pnpm build
DOCS_LEVEL=S node examples/harness/executed-bytes/hydrated-docs.mjs --regions --runs 3 --record documentation/compiler-c3c-S-bytes.json
DOCS_LEVEL=M node examples/harness/executed-bytes/hydrated-docs.mjs --regions --runs 3 --record documentation/compiler-c3c-M-bytes.json
DOCS_LEVEL=L node examples/harness/executed-bytes/hydrated-docs.mjs --regions --runs 3 --record documentation/compiler-c3c-L-bytes.json
node examples/harness/executed-bytes/docs-scaling-payload.mjs
C3_PARITY_RECORD=documentation/compiler-c3c-parity.json node --test packages/compiler-yield/test/server-components.test.mjs
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

**Answer.** C3b placed code-only break-even near **25.6 KB gzip**. The measured
26.3 KB S payload remains marginal; the first clearly winning measured point is
M at **111.7 KB gzip**, saving **52.0%** of shipped JS gzip and **41.5%** of load
execution versus the library. At L's **127.5 KB** library payload, R saves
**109,832 gzip bytes (56.7%)** and **501,078 load-executed bytes (44.4%)**. Over
this 40-step session, markup adds **8,500 gzip bytes** versus equivalent JSON,
leaving **101,332 bytes** of the initial JS saving, while session execution is
**7.97% lower**. Against the fixture's actual zero-HTTP fake API, subtracting
all **18,836** compressed frame bytes still leaves **90,996 bytes**. S's small
initial advantage is consumed by navigation; M/L retain large savings here.
This supports better scaling for an eager content SPA, with per-navigation
response expansion and F-C11/F-C13 exact-DOM limits still explicit.
