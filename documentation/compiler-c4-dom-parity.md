# C4: docs frame DOM parity

**C4c update (2026-10-08): plain Solid confirms frames over-claim raw link
state. The authored-host binding now waits for root HTML before settling
fresh refetches. Exact DOM remains 6/40 at L. See C4c below for independent
probes, upstream drafts, and fresh three-run bytes; C4/C4b remain as history.**

2026-10-08, `proto/compiler`, starting at `a4ca329`. **Exact DOM parity remains
0/40 at level L; all 40 authored-content checks pass.** The first-navigation
empty route is fixed, including a LikeButton click before the first frame
arrives. The remaining differences are in the installed frame/router runtime.
This does **not** satisfy D-114's DOM-parity prerequisite for productized server
components with client slots.

No main merge, dependency change, install, push, or baseline regeneration was
made. Runtime versions remain Solid / `@solidjs/web` rc.13 and router next.29.
The conclusions below concern this installed high-level server-component path,
not an impossibility result for all uses of Solid's lower-level frame API.

## Exact comparison and separate diagnostics

[Per-step hashes, counts, and link-claim traces](compiler-c4-parity.json) retain
all 40 exact comparisons. The ordinary `examples/harness/src/index.ts`
normalizer is unchanged: only hydration keys and comments are removed.
Wrappers, template elements, and link attributes remain in exact snapshots.
The original plain-Solid app and the library app match **40/40**, rerun here.

The following columns are **diagnostic removals from recorded strings**, not
runtime fixes or a weakened parity test. Each row includes preceding removals;
router attributes are removed from both sides only in these diagnostics.

| Comparison                                            | Before | After |
| ----------------------------------------------------- | -----: | ----: |
| Exact normalized DOM                                  |   0/40 |  0/40 |
| Disregard frame wrapper elements                      |   6/40 |  6/40 |
| Also disregard pending template elements              |   6/40 |  6/40 |
| Also disregard router attributes on `innerHTML` links |  33/40 | 33/40 |
| Also disregard router attributes on TOC links         |  40/40 | 40/40 |

| Difference class            | Before                                  | After                                                                   |
| --------------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| Extra frame wrappers        | All 40 checkpoints                      | All 40; step 4 now has only the guide wrapper                           |
| Pending template            | Checkpoint 4, after waiting for a frame | No checkpoint; still present between 4 and 5 when the first frame lands |
| Immediate first route       | Empty, disagrees with library           | Exact `<main>` match, before any response                               |
| `innerHTML` link attributes | 30 checkpoints differ                   | Same 30                                                                 |
| TOC link attributes         | 7 checkpoints differ                    | Same 7                                                                  |

The old step-4 snapshot waited for the first frame. The new one is taken
immediately after the authored navigation step, as in the library. A separate
optional observation captures the intermediate frame without moving that
checkpoint. Thus removing the empty interval is a real fix; losing the
checkpoint's pending template is a timing correction, **not removal of the
streaming marker**. Later settle checks still wait for returned content, not
identical network latency. There are still seven region RPCs, none on hydration
and none for the TOC hash click.

## F-C16: the high-level boundary adds observable elements

`emitServerRegion` returns a server template; the integrated R emit uses
`dynamic`, `frameTransformDirectResult`, and `installServerComponents`.
On the server, `frames/dist/server.dev.js`'s `frameElementOpen` always emits
`<solid-frame data-fid="…" style="display:contents">`. On the client,
`boundaryComponent` always calls `createFrameElement`, which calls
`makeFrameElement`. Moving the extraction boundary from `<main>` to `<article>`
or `<section>` only moves that extra element. Passing a `host` does not select
a DOM node: `FrameOptions.host` is a `FrameHost` that routes frame records.
There is no existing-element option on this high-level pair.

**There is a lower-level escape hatch.** Public `createFrame(element, options)`
accepts an existing element. A separate probe adopted `<main><p>old</p></main>`,
applied an HTML chunk, and produced exactly `<main><p>new</p></main>`, retaining
the same main and adding zero wrappers. It does not change the high-level
server transform's wrapper output or its document adoption, slot hydration,
and `dynamic` binding. Using it in R would require replacing that integration
on both server and client, not changing a host option. The current payload
also includes its own main or section; an existing-root adapter must emit
only that root's children to avoid nesting a second main or section. That
adapter was not implemented in C4. C4b below implements it with an explicit
server adapter and a lower-level client binding. Removing wrappers from live
DOM without replacing that binding would break its parent and lifecycle contract.

[Chrome measurements](compiler-c4-layout.json), using checkpoint 5 and the
fixture's real CSS at a 1520 × 892 CSS-pixel viewport: both wrappers compute to
`display: contents`, have zero client rectangles and zero width/height. The
site, main, article, guide, and footer have identical widths and heights;
relative positions differ by less than 0.001 CSS pixels. This is one fixture
layout check, not a general layout-equivalence claim.

| Selector                      | Library matches | R matches |
| ----------------------------- | --------------: | --------: |
| `.layout > div > main`        |               1 |         0 |
| `.site > .reading-guide`      |               1 |         0 |
| `.reading-guide:nth-child(6)` |               1 |         0 |
| `.reading-guide:first-child`  |               0 |         1 |

The nodes therefore are observable even when their boxes disappear. A style
rule using one of these selectors can change appearance or layout.

**Proposed upstream API.** Let a server-component call use its authored root
as the frame boundary on both the server and the client. The compiler should
be able to name the existing main, article, or section, hydrate it in place,
and keep the same slot and cleanup behavior as `dynamic`. Keep the frame ID
outside authored attributes after hydration, so replacing the wrapper with a
permanent `data-fid` attribute does not merely create another exact-DOM
mismatch. For content with several roots, support a boundary between comments.

## F-C17: a transient streaming marker, not a settled leak

Solid's server `createLoadingBoundary` builds a
`<template id="pl-…"></template>` plus a closing comment when discovery finds
pending work. The article's authored Loading boundary produces it; the R emit
does not add it by hand. In this probe it is `pl-0020` (the ID depends on the
owner tree). Frame `#findPlaceholder`, `#showFallback`, and `#revealSegment`
use it to place the response. `#revealSegment` removes the template when the
content is revealed, including the path through its Loading reveal hook.

The intermediate first frame contains one marker. Checkpoint 5 and every
other settled route contain zero; the tests now assert that. It needs no
extra cleanup after settling. Deleting it while pending would remove the
response's insertion target. The ordinary library client navigation leaves
no equivalent template element; its pending Loading output matches authored
text and the LikeButton. Ordinary SSR can also use streaming placeholders,
but those are already resolved in the completed-SSR hydration harness.

**Proposed upstream change.** For client-applied frames, let pending content
use comment boundaries instead of a template element, carrying fallback data
in frame records. Preserve reveal ordering and slot readiness. This would
match client Loading's element tree while still giving incoming content a
stable insertion point; deleting the pending template from application code
is not a safe substitute.

## First navigation: fixed in the emitter

Home → DocPage creates a new route owner. Plain Solid and the library show
`<main>Loading article…<section class="widget like">…</section></main>` at
once. Keeping Home's old article would be the wrong behavior here. DocPage →
DocPage refetches keep their previous content, which the existing frame path
already does.

The emitted outer Loading fallback now contains the authored pending text,
main, and LikeButton. One memo owned by the route supplies the LikeButton to
both the fallback and the keyed frame slot. Its node and state survive the
handoff. The bounded lowering supplies the same normalized route slug as the
server slot; the server still carries its keyed slot and serialized inputs.
Besides the normal 40 steps and refetch identity checks, a separate test clicks
Like **before the first frame**, then verifies the same node and saved `Like:
1` after arrival. It also compares those six snapshots with the library.

## F-C18: frames over-claim links from `innerHTML`

The plain-Solid original and library both leave the Markdown, API, and diff
HTML's raw anchors without router state attributes. The compiler claims
explicit JSX anchors; assigning `innerHTML` does not claim the inserted tree.
Frames' `claimTree` instead sweeps every `a[href]` and `form[action]` under a
materialized or adopted region, including raw HTML and the reading guide.
That adds `data-active` and `aria-current="page"` to links the ordinary path
never registered. These are frame over-claims relative to the requested
plain-Solid behavior, not missing work in solid-yield. Link navigation still
works through event delegation without these state attributes.

**Proposed upstream change.** Preserve which elements the Solid compiler
would claim when sending server HTML. Frame adoption and updates should claim
those elements, while leaving an `innerHTML` subtree opaque unless the author
explicitly opts in. A blanket tree sweep cannot reproduce the ordinary app's
ownership. Do not repair this by stripping every active attribute after each
update: that would also remove valid state from authored links.

No fixture-wide extra claiming or attribute stripping was added to disguise
this difference. Aligning frames needs that ownership information in the
runtime/transport; neither the integrated binding nor `createFrame` exposes a claim filter.
C4b retains this difference with existing-element hosts.

### Minimal plain-Solid repro for F-C18

Render this component at `/b` inside a normal Solid router. Both links come
from `innerHTML`. Before clicking Attach neither link has router state
attributes. After clicking, the second link gains `data-active` and
`aria-current="page"`; the first does not. No solid-yield code is involved.

```tsx
import { getOwner, onCleanup, runWithOwner } from "solid-js";
import { createFrame } from "@solidjs/web/frames";

function RawLinks() {
  const owner = getOwner();
  const ordinary = <div innerHTML={'<a href="/b">B</a>'} />;
  const hosted = <div innerHTML={'<a href="/b">B</a>'} />;
  let frame;
  onCleanup(() => frame?.dispose());
  return (
    <>
      <button
        onClick={() => {
          frame ??= createFrame(hosted, {
            adopt: true,
            ownerScope: fn => runWithOwner(owner, fn)
          });
        }}
      >
        Attach
      </button>
      {ordinary}
      {hosted}
    </>
  );
}
```

The requested Solid change is to carry which links the compiler owns along
with the HTML, then claim only those links. Raw HTML should stay opaque by
default. Removing every active attribute in application code would also
remove correct state from authored links.

## F-C19: TOC state reads the previous browser URL

TOC anchors **are** explicit JSX and should be claimed. The trace proves a
separate router timing issue, not an over-claim of raw HTML. In both plain
Solid and the library, `#pipeline-plan-the-page` is claimed while
`document.baseURI` is still `/docs/missing`. Router `managedPath` resolves it
against that old URL, while `linkState` compares with the new router location.
Both active attributes stay absent until another navigation refreshes them.
The same occurs for blog, API, and changelog TOCs. A hash click at step 26
refreshes all the current page's TOC links, as expected: `aria-current="page"`
marks the page, not the currently scrolled heading.

Frames usually claim after the URL has changed, so their TOC attributes are
correct in these cases. On the final return to pipeline, the frame also claims
against the old `/docs/changelog` base and reproduces the missing attributes.
This rules out a simple “frames always add too much” diagnosis. The seven
mismatching checkpoints are 25, 29, 30, 32, 33, 35, and 36.

**Proposed upstream fix.** Refresh owned link state after the router commits
the browser URL, so fragment-relative links resolve against the same page
that the router is comparing. Keep authored `aria-current` values and base-URL
rules intact. Cover success, recovery from an error, and a returning frame in
the router's tests. The wrong side here is the installed router's ordinary
claim timing, also seen in plain Solid; removing correct attributes from
frames would encode that bug. No router dependency patch or upgrade was made,
so this correction remains upstream work, not a claimed local fix.

### Minimal plain-Solid repro for F-C19

Use this router, start at `/a`, and click B. Inspect Part immediately after
navigation settles, then click Part. In the affected path the first claim
resolves `#part` against `/a`, so it does not mark the link active for `/b`.
The hash navigation refreshes it. The C4/C4b trace records the same ordering
with the docs routes; it is the router's browser-URL timing, not a generator
or frame-wrapper problem.

```tsx
import { createRouter, defineRoute, defineRoutes } from "@solidjs/router";

export const Router = createRouter({
  routes: defineRoutes([
    defineRoute({ path: "/a", component: () => <a href="/b">B</a> }),
    defineRoute({
      path: "/b",
      component: () => (
        <>
          <a href="#part">Part</a>
          <h2 id="part">Part</h2>
        </>
      )
    })
  ])
});
```

The requested router change is to refresh owned links after committing the
browser URL. Resolve fragment links against that committed page, preserve
authored `aria-current`, and test both ordinary navigation and returned
frames. C4b does not patch the router or remove correct frame link state.

## Three-run level-L bytes

[Raw observations and chunk attribution](compiler-c4-L-bytes.json). All 164
executed phases and all shipping results have **zero run-to-run drift**.
The same production Vite module-runner measurement is used; executed bytes
are UTF-8 source ranges, not CPU time or production-bundle coverage. Shipping
is minified JavaScript, gzip summed per chunk, excluding HTML/CSS/RPC bodies.

| Variant               | Load executed | 40 steps executed | Shipped raw | Shipped gzip |
| --------------------- | ------------: | ----------------: | ----------: | -----------: |
| Original              |     1,096,058 |         4,366,734 |     627,380 |      189,329 |
| Library               |     1,129,164 |         4,556,267 |     642,400 |      193,576 |
| Single root without R |     1,150,804 |         4,566,492 |     640,952 |      193,435 |
| Single root + R       |       629,522 |         4,246,353 |     240,177 |       83,792 |

The requested R reference moves from **83,744 → 83,792 gzip (+48, 0.057%)**
and **628,086 → 629,522 load (+1,436, 0.229%)**. Thus there is a small byte
regression for the immediate fallback and shared LikeButton. R still saves
109,784 gzip and 499,642 load-executed bytes against the library at L.
Session execution rises 53,294 bytes from C3c; checkpoint 4 now measures the
immediate fallback instead of waiting for a frame, so individual navigation
phase totals also have a changed timing boundary. No baseline was raised to
accept these numbers.

## Validation and reproduction

Code commit: `4a01f15` (`fix(compiler): preserve initial docs fallback and client slot`).
Before that commit, `pnpm build` passed and the required full gate was
**GREEN: 53 pass / 0 fail / 0 skip in 293 seconds**. Before the evidence
commit, the build passed again and the full gate was **GREEN: 53 pass / 0 fail
/ 0 skip in 318 seconds**. All existing baselines remain unchanged; the new
regressions are inside the existing compiler test step.

Two earlier full runs were red: a five-second Hacker News test timeout
(passed on its standalone retry), and a race in the new short probe, where
content arrived before the RPC recorder received the end message. The probe
now waits for that end message before checking the completed-response count.
No test timeout, expectation, or baseline was relaxed. The pinned pnpm 11.1.1
was invoked through a temporary launcher to avoid repeated version-bootstrap
network waits from the machine's newer global pnpm; no dependencies changed.

```sh
pnpm build
DOCS_LEVEL=L C4_CAPTURE_CLAIMS=1 C4_OBSERVE_FIRST_FRAME=1 \
  C4_SNAPSHOTS=/tmp/c4-after.json \
  node --test --test-name-pattern='40 hydrated' packages/compiler-yield/test/server-components.test.mjs
node packages/compiler-yield/test/dom-parity-diagnostics.mjs \
  /tmp/c4-before.json /tmp/c4-after.json documentation/compiler-c4-parity.json
DOCS_LEVEL=L node examples/harness/executed-bytes/hydrated-docs.mjs \
  --regions --runs 3 --record documentation/compiler-c4-L-bytes.json
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

The before record was captured at `a4ca329` with observation-only additions
that saved the immediate first route before the old wait. Its per-step hashes
and counts are retained in the combined report; `/tmp/c4-before.json` is a
local reproduction input, not a required gate fixture. Optional claim tracing
and intermediate-frame observation were disabled for byte measurements.

## C4b: existing-element hosts

2026-10-08, starting at `495ce55`. **F-C16 is removed in the bounded docs R
emitter. Exact matches improve from 0/40 to 6/40 at L.** All 40 authored-content
checks still pass; the original plain-Solid app and the library still match
40/40. [Before/after hashes and per-step findings](compiler-c4b-parity.json)
use the unchanged exact normalizer. No wrappers, pending templates, or router
attributes are removed from the exact snapshots.

### Hosts, attachment, and slots

| R occurrence                   | Authored host                     | Synthesized wrapper finding |
| ------------------------------ | --------------------------------- | --------------------------- |
| Home article and LikeButton    | Home's `<main>`                   | None                        |
| DocPage article and LikeButton | DocPage's `<main>`                | None                        |
| Reading guide                  | `<section class="reading-guide">` | None                        |

The region cut includes each existing root; ArticleContent's possible loading,
success, and error children remain inside that root. No extra root is needed
in these three occurrences. The emitter still rejects changed authored shapes;
this is not a general multiple-root lowering. A future multiple-root region
needs its own smallest-wrapper finding rather than a silent wrapper.

`hosted-region-server.js` emits the chosen root with `data-fid` for document
attachment. Its children retain Solid's keyed slot comments and document slot
records (`sc:slot:<id>:<occurrence>`). The RPC template emits only those
children, so applying it cannot nest another main or guide section. The
article is created once per region render; recreating it inside the emitted
fragment caused an endless Loading retry in an early probe and was fixed.

`hosted-region-client.js` replaces `installServerComponents` for R. It indexes
the server's hosts, seeds primitive slot records, and calls
`createFrame(element, {host, id, adopt, slots})`. New route mounts create the
same authored root. Refetches rebind that frame and update its children; tests
assert the main and guide retain their node identity. The adapter removes the
attach-only `data-fid` after attachment **and rebind** (rc.13's `rebind` writes
it again). No live wrapper is stripped or reparented.

This is **not an entirely public-API-only integration**. Solid exports
`createFrame`, `createFrameHost`, and `createServerComponentHandler` on the
client, and `renderServerComponent`/`renderToFrameStream` on the server. Its
public document-slot serializer is still bundled into
`frameTransformDirectResult`. The server adapter reuses that helper's slot
encoding and replaces its fixed outer template, rejecting a changed output
shape. The client uses the pinned document registry and hydration context to
claim the existing slot nodes. It does not call the integrated client binding
or `createFrameElement`. This removes the wrapper while keeping the server
slot protocol; it is a tested rc.13 adapter, not a new supported Solid option.
Completed document SSR, the fixture's primitive slot arguments, and ordinary
RPC streams are covered. Incremental document attachment, nested server-JSX
slot inputs, and async slot inputs are outside this bounded emitter's proof.

The route-owned LikeButton memo still supplies both the immediate Loading
fallback and `like#route-like`. It keeps its node and saved state through the
first arrival, a click before that arrival, and later success/error refetches.
All five direct-route SSR/hydration tests retain every claimed server node and
perform zero hydration RPCs. The 40-step session performs seven region RPCs;
the TOC hash click performs none.

The docs fixture has **no copy-code widget**. A separate regression test places
Like and copy-code buttons in two keyed slots and compares `createFrame` on an
existing article with `createFrameElement`'s wrapper path. After a content
swap, reordered slots, and changed slot inputs, both retain the same buttons,
click counts, and handlers. That proves lower-level slot support; it does not
claim copy-code coverage in the 40-step docs session. There is no slot-support
blocker.

### Remaining differences by checkpoint

Checkpoint numbers are zero-based, as in the retained C4 record.

| Class                        | C4b checkpoints                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| Exact match                  | 0, 1, 2, 3, 23, 31                                                                   |
| F-C16 wrapper/host artifacts | None; zero wrappers and zero `data-fid` attributes at all 40 checkpoints             |
| F-C17 pending template       | None at checkpoints; one `pl-020` marker observed between 4 and 5, zero after settle |
| F-C18 raw-HTML link claims   | 4–22, 24–28, 32–34, 37–39 (30 checkpoints)                                           |
| F-C19 TOC URL timing         | 25, 29, 30, 32, 33, 35, 36 (7 checkpoints)                                           |

F-C18 and F-C19 overlap at 25, 32, and 33, leaving 34 differing checkpoints.
Both minimal plain-Solid repros above were run against the installed packages;
[their recorded DOM and URL trace](compiler-c4b-router-repros.json) show the
raw-HTML over-claim and the old `/a` base URL independently of solid-yield.
Neither dependency is patched. F-C17 already removes its template when the
segment settles. No private cleanup or unsafe deletion while pending is added.

### Three-run level-L bytes

[All runs and chunk attribution](compiler-c4b-L-bytes.json). There is zero drift
in all 164 executed phases and all shipping results. The measurement and
exclusions are the same as C4.

| Variant               | Load executed | 40 steps executed | Shipped raw | Shipped gzip |
| --------------------- | ------------: | ----------------: | ----------: | -----------: |
| Original              |     1,096,058 |         4,366,734 |     627,380 |      189,329 |
| Library               |     1,129,164 |         4,556,267 |     642,400 |      193,576 |
| Single root without R |     1,150,804 |         4,566,492 |     640,952 |      193,435 |
| Single root + R, C4b  |       621,864 |         3,927,152 |     231,539 |       80,698 |

Against C4, R drops **7,658 load-executed bytes** and **3,094 gzip bytes**.
Against the requested C3c reference (628,086 load / 83,744 gzip), it is now
**6,222 load bytes smaller and 3,046 gzip bytes smaller**. C4's +1,436 load /
+48 gzip cost is therefore more than recovered. Session execution falls
319,201 bytes from C4. No baseline was raised.

### Validation

Implementation commit: `e9a26d1` (`fix(compiler): host docs regions on authored elements`).
The seven route tests pass, including the early-click probe and five direct
SSR/hydration routes. The side-by-side two-slot swap test passes. Before the
implementation commit, `pnpm build` passed and the full gate was **GREEN:
53 pass / 0 fail / 0 skip in 208 seconds**. The before column retains C4's
recorded snapshots; the after column is a fresh C4b session. Before the
evidence commit, `pnpm build` passed again and the full gate was **GREEN:
53 pass / 0 fail / 0 skip in 307 seconds**. No dependencies,
baselines, main branch, or remote refs were changed. Both commits are local.

```sh
DOCS_LEVEL=L C4_CAPTURE_CLAIMS=1 C4_OBSERVE_FIRST_FRAME=1 \
  C4_SNAPSHOTS=/tmp/c4b-after.json \
  node --test packages/compiler-yield/test/server-components.test.mjs
node --test --test-name-pattern='C4b:' packages/compiler-yield/test/server-region.test.mjs
DOCS_LEVEL=L node examples/harness/executed-bytes/hydrated-docs.mjs \
  --regions --runs 3 --record documentation/compiler-c4b-L-bytes.json
pnpm build
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

## C4c: link claims and URL timing

2026-10-08, starting at `c1cf58e`. **Exact DOM remains 6/40 before and after;
all 40 authored-content checks pass.**
[Fresh per-step comparisons](compiler-c4c-parity.json) retain the unchanged
normalizer, the C4b baseline, original/library equality at 40/40, and response
header observations. No attributes are removed from live DOM or snapshots.

### Independent plain Solid check

The standalone app is in `/private/tmp/frames-links-check`, with
`node_modules` symlinked to the installed plain docs dependencies. Its
[complete reproducible source](upstream/frames-links-check/)
imports only Solid, its router, and test/build tools; it imports no compiler
or solid-yield code. SSR runs in a separate process. The driver hydrates the
saved HTML, verifies it retains the same article node, clicks a raw HTML
route link, pauses work explicitly, and records browser URL, article,
claims, frame applications, and `pushState` order.
[All six assertion-checked traces](compiler-c4c-solid-probes.json) include the
exact source hashes and installed versions. These are jsdom observations,
not a new Chrome layout measurement. The lower host uses the C4b binding's
protocol without slots; keyed slots remain covered by the seven actual R
route tests and C4b's separate two-slot test.

| Plain path                             | Raw SSR HTML after hydration                     | Raw B click | URL with headers but body held              | Article with body held |
| -------------------------------------- | ------------------------------------------------ | ----------- | ------------------------------------------- | ---------------------- |
| Ordinary SSR + hydration               | No router state attributes                       | Intercepted | `/page/a` while async data is held (no RPC) | A                      |
| Public high-level frames               | Active raw A gets `data-active` / `aria-current` | Intercepted | `/page/a`                                   | A                      |
| Lower authored host, C4b-style binding | Same extra raw-link state                        | Intercepted | `/page/b`                                   | A                      |
| Lower authored host with root wait     | Same extra raw-link state                        | Intercepted | `/page/a`                                   | A                      |

Every path retains its SSR article. A separate Attach click runs the minimal
raw-link repro in the draft: the ordinary raw A remains unchanged, while the
adopted raw A gains both attributes. The standalone source and draft contain
that repro verbatim.

### F-C18 verdict: frames' link-state over-claim

Plain Solid registers authored JSX anchors through compiler element claims;
no `<A>` wrapper or `link` marker is required with the default router.
`innerHTML` remains opaque to those claims. Separately, the router's delegated
click listener intercepts same-origin raw anchors, including Markdown links.
Thus **navigable does not imply registered for active state**. Inspection of
`examples/docs-yield/src/content.tsx` confirms its Markdown uses `innerHTML`,
while TOC anchors are authored JSX; the library matches ordinary Solid's
behavior, not an under-claim requiring extra registration.

Frames' `claimTree` selects every `a[href]` and `form[action]` under adopted
or materialized content. Both public high-level and lower authored-host paths
therefore add state that ordinary hydration omits. There is no selective
public claim filter/opaque-HTML option in rc.13. Router-wide `explicitLinks`
would also change authored navigation/state and require new `link` attributes;
it does not preserve this app's contract. No broad extra claiming, runtime
attribute stripping, dependency patch, or suppression workaround is added.

[Plain-Solid frames issue draft](upstream/solid-frames-link-claim.md), section 1,
is **draft, not filed**, with expected/actual behavior and installed
file:line causes.

### F-C19 verdict: our missing root wait, plus separate upstream behavior

The old statement that F-C19 contained no local emitter timing issue was too
broad. The plain high-level binding has a readiness promise released by
`onApply`; the C4b adapter returned its element immediately. When response
headers resolve `dynamic` before root HTML arrives, a fresh same-route
refetch could commit browser history while still showing the old root.

**Local fix:** `16a87b4` adds the same root-readiness wait to
`hosted-region-client.js`. New hosts and changed frame addresses wait for
root application; adoption and retained content can settle immediately.
The main and guide stay on their authored nodes, with the existing slot and
cleanup behavior. The lower plain probe now has the same root-application →
history-commit order as the public high-level binding.

The actual 40-step R regression pauses every response body for 30 ms after
headers, then checks history. Its observed paths are `/docs/start`,
`/docs/start`, `/docs/missing`, `/docs/pipeline`, `/docs/post-latency`,
`/docs/api`, `/docs/pipeline`. The middle five are fresh refetches and retain
the old URL until root HTML applies. The first new route can settle into its
authored outer Loading fallback; the final return can use retained pipeline
HTML before the new body. Treating either as a fresh, empty frame would give
a false failure. All seven route tests, including the early Like click and
zero-hydration-RPC checks, pass.

**Frames' separate streaming behavior:** when the server component itself
contains a delayed inner Loading boundary, public high-level frames apply
the loading root and commit `/page/b` before revealing article B. Article A
has been replaced by Loading. Ordinary reused-route async rendering keeps
`/page/a` and article A until B is ready. The fixed authored host matches the
public frame path, including this difference. Section 2 of the same frames
draft records it and requests a documented policy/option for ordinary-route
parity; it is not presented as a remaining C4b header-readiness bug.

**Router fragment-state defect:** ordinary Solid still refreshes `#part`
against the previous `document.baseURI` before history commits. Root-only
frame claims can do the same; later streamed-segment claims see the committed
URL and correctly add attributes. A hash click refreshes the stale ordinary
state. This independently explains the seven settled TOC differences.
[Plain router issue draft](upstream/solid-router-fragment-link-state.md) is
**draft, not filed**. No dependency patch or deliberate removal of correct
frame state is made.

### Remaining per-step differences

Zero-based checkpoints; overlaps at 25, 32, and 33 leave 34 differing steps.
The new root wait fixes URL order, but does not alter these settled element
attributes. No wrapper, `data-fid`, or pending template survives at any exact
checkpoint. The streaming placeholder between 4 and 5 still disappears.

| Result / cause                                                                                         | Checkpoints                |
| ------------------------------------------------------------------------------------------------------ | -------------------------- |
| Exact matches, before and after                                                                        | 0, 1, 2, 3, 23, 31         |
| F-C18: frames sweep raw Markdown/API/diff and guide HTML anchors                                       | 4–22, 24–28, 32–34, 37–39  |
| F-C19: ordinary TOC state resolves against old URL; later frame claims generally use the committed URL | 25, 29, 30, 32, 33, 35, 36 |

Diagnostic counts remain 6/40 exact, 33/40 after disregarding raw-link state,
and 40/40 after also disregarding TOC state. These removals only explain the
recorded differences and do not pass the exact parity test.

### Three-run level-L bytes

The client changed, so [three fresh runs](compiler-c4c-L-bytes.json) were
required. All 164 executed phases and shipped results have zero drift. The
measurement and exclusions remain those in C4/C4b; no baseline is raised.

| Variant               | Load executed | 40 steps executed | Shipped raw | Shipped gzip |
| --------------------- | ------------: | ----------------: | ----------: | -----------: |
| Original              |     1,096,058 |         4,366,734 |     627,380 |      189,329 |
| Library               |     1,129,164 |         4,556,267 |     642,400 |      193,576 |
| Single root without R |     1,150,804 |         4,566,492 |     640,952 |      193,435 |
| Single root + R, C4c  |       621,888 |         4,069,761 |     231,721 |       80,793 |

Against C4b, R adds **24 load-executed bytes**, **182 shipped raw bytes**,
**95 gzip bytes**, and **142,609 session-executed bytes**. The added readiness
work and changed settlement order are visible in the phase/chunk record.
Against the C3c reference, R remains 6,198 load bytes and 2,951 gzip bytes
smaller. Original, library, and non-R values are unchanged.

### Validation and reproduction

Before implementation commit `16a87b4`, build passed and the full gate was
**GREEN: 53 pass / 0 fail / 0 skip in 393 seconds**. Before the evidence
commit, build passed again and the full gate was **GREEN: 53 pass / 0 fail /
0 skip in 378 seconds**. The seven route tests also passed separately. The readiness regression was first written with
incorrect expectations for initial Loading and a cached return; it failed,
and was corrected using the public binding's measured behavior. No timeout,
existing baseline, or exact normalizer was relaxed.

```sh
DOCS_LEVEL=L C4_CAPTURE_CLAIMS=1 C4_OBSERVE_FIRST_FRAME=1 \
  C4_SNAPSHOTS=/private/tmp/c4c-after.json \
  node --test packages/compiler-yield/test/server-components.test.mjs
DOCS_LEVEL=L node examples/harness/executed-bytes/hydrated-docs.mjs \
  --regions --runs 3 --record documentation/compiler-c4c-L-bytes.json
pnpm build
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

For the independent app, copy `upstream/frames-links-check/` into
`/private/tmp/frames-links-check`, symlink its `node_modules` to installed
plain Solid dependencies at the recorded versions, and run the six commands
in the frames draft. No installation is needed for this checkout.

Both C4c commits are local on `proto/compiler`; no push, main change,
dependency install/patch, or baseline regeneration was made.
