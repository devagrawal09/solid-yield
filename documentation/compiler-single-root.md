# Docs compiler: one eager root versus seven

**Terminology (2026-10-08).** Dev corrected the earlier use of “islands”: C2 (seven-root and single-root modes) is **static extraction + eager root split**. Every root remains a full client component, and the article still renders in the browser. Islands in the Astro/Marko sense are server-rendered content with small interactive leaves: **C3–C3c are islands, i.e. server components with client slots** such as LikeButton and copy-code. Dev’s measured summary: “static extraction and root splitting never pay; islands (server components with client slots) pay above ~25 KB gzip of server-derivable code and scale.” The `eagerIslands` pass name predates this correction and is unchanged; read older branch reports with this distinction.

Measured 2026-10-07, Node v24.18.0, Solid rc.13, on
`proto/compiler-single-root` from `6a3a417`. All values below are bytes.
[The recorded observations](compiler-single-root-bytes.json) contain three runs,
every named checkpoint, load coverage by module, chunk sizes/hashes, module
inventories, and the computed decomposition. All 100 phases (four variants ×
25 phases) had **zero drift** across the three runs.

| Variant | Executed at load | Executed over 24 parity steps (excluding load) | Shipped raw JS | Shipped gzip |
| --- | ---: | ---: | ---: | ---: |
| Original | 549,717 | 2,049,935 | 152,339 | 54,285 |
| Library | 583,325 | 2,189,856 | 166,658 | 58,755 |
| Compiled single-root | 605,662 | 2,197,136 | 165,855 | 58,482 |
| Compiled seven-root | 640,537 | 2,197,925 | 174,148 | 65,281 |

**Answer.** Unifying the roots makes the existing inert extraction pay a small
shipping dividend: **803 raw bytes (0.48%) and 273 gzip bytes (0.46%)** versus the
library. It does **not** save executed bytes at load: single-root remains
**22,337 bytes (3.83%) higher**. Moving from seven roots to one removes **34,875
executed bytes**, or **61.0% of the freshly measured seven-root load penalty**
(roughly three fifths of the earlier reported +9.9%). Most of that reduction is
repeated emitted app code and module packaging, not the six extra calls to
`hydrate`. The public input decoder still adds 30,367 executed bytes to both
compiled variants. Thus this extraction offers a small net download saving
once roots are unified, but the current eager bootstrap still prevents a load
execution saving.

## What stays the same

`eagerIslands({directory, roots: "single"})` uses the same C1 analysis and its
**eleven groups**, the same capture checks, and the same route/error-boundary
fallbacks as the default `roots: "per-group"`. It places the interactive parts
under App with one `hydrate()` call, one `cs-` key space, one serialized `{}`
record, and one application bundle. Hydration is synchronous at load. There is
no new route split: both authored routes are already statically imported by the
library. The single build has two chunks: the application and the existing
framework `serverForms` dynamic helper. The library has three, because its
serializer decoder is a separate dynamic chunk; single-root imports that decoder
eagerly, so Vite includes it in the application chunk. Seven-root has 14 chunks.

**Scope correction to the question:** the seven-root implementation did not
extract the article chrome. As documented in
[compiler-c2-finding.md](compiler-c2-finding.md), navigation and footer bodies
are server-only; ArticleContent/ArticleBody remain inside the Router and
ReadingGuide fallbacks. This experiment preserves those exact boundaries and
does not add C3 extraction. Both compiled builds reject nav/footer template and
site-data strings in client chunks. The unified App retains the small outer
shell template needed to place its children, whereas seven-root claims children
individually. That assembly change is included in the measured net difference.

On the server, `NoHydration` encloses each inert slot. On the client, its slot
helper registers existing native elements for router link handling in document
order, under the single root's owner. It keeps the existing observer for later
insertions; the observer does not schedule hydration. Both source-edit stages
retain maps back to the authored App.

## Decomposition

The controlled subtraction is **seven minus single**, holding the analysis,
interactive bodies and extracted regions fixed. It measures the combined effect
of root assembly, repeated module slices, and chunk packaging. It is not a pure
microbenchmark of calling `hydrate()` six more times: precise coverage counts
source ranges, not invocation frequency.

The current seven-root excess over the library is **57,212 executed load
bytes = 34,875 removed by root unification + 22,337 remaining**. Load coverage
splits the 34,875-byte difference into:

- **1,462 bytes:** entry/loader and inert-registration code (4,874 → 3,412).
- **32,935 bytes:** emitted app modules (87,356 → 54,421), including repeated
  local declarations, module wrappers, and the changed App assembly.
- **478 bytes:** net additional Solid/router/yield runtime paths.
- **0 bytes:** decoder difference; both compiled variants execute the same
  30,367 decoder/Seroval bytes.

The emitter currently slices each root independently. ReadingGuide's slice
contains ArticleContent and ArticleBody, while the Router imports another copy
through `content__compiler_dep`. Inspecting the production chunks confirms
`On this page`, `Related reading` and `Loading article` each occur in both
`island-ReadingGuide-CjfrDsy1.js` and `app-DouPVLJc.js`. Each occurs only once in
the unified `client-EzJfo1RO.js`. This is a concrete duplication cost, not inert
content that suddenly became removable in single mode.

The **shipped chunk diff is 8,293 raw / 6,799 gzip bytes**. Relative to the
library, seven-root's 7,490 raw-byte excess therefore decomposes as
**8,293 root-strategy bytes minus 803 bytes saved by the unified result**.
Likewise its 6,526 gzip-byte excess is **6,799 minus 273**. The recorded chunk
hashes and sizes come from both actual production outputs, not an estimate from
source-file lengths.

For a narrower bootstrap-versus-everything-else view, source-map spans partition
those same minified chunk bytes. Bootstrap/inert-registration spans are
**1,052 bytes in seven-root and 987 in single-root: +65 bytes**. The other
**8,228 bytes** comprise content **+3,026**, runtime **+1,121**, unmapped generated
code **+5,497**, App/router assembly **−577**, widgets **−47**, and app data/errors
**−792**. These sum exactly to 8,293 with the bootstrap difference. Unmapped
spans include generated templates, imports/exports, punctuation and source-map
reference comments; they must not all be called loader code. Mapping assigns
punctuation to adjacent source spans, so this is a reproducible byte partition,
not a unique semantic attribution. Gzip is compared for whole chunks because
compression savings cannot be assigned independently to source spans.

The **remaining single-root load cost** also reconciles exactly:
**+30,367 decoder +2,000 entry/slot registration +601 runtime −10,631 app code
= +22,337 bytes**. Unifying empty-input blocks saves six calls to the decoder,
but does not remove the decoder's initial module execution. The single-root
24-step total is 7,280 bytes (0.33%) above the library; seven-root adds another
789. This is a sum of fresh coverage ranges per step, not a page-wide union.

## Measurement limits and verification

The same harness performs complete streamed SSR in a separate process, starts
coverage before browser imports, hydrates eagerly, and runs the unchanged 24
steps. It measures transformed, unbundled UTF-8 source ranges; shipped sizes
measure all minified production JS chunks, including dynamic helpers. Gzip is
summed per chunk; CSS, HTML, server output and map files are excluded. The
serialized input blocks and key strings in HTML are therefore not download
bytes in this table.

The earlier report's load values (550,893 / 584,641 / 642,511) are not reused as
controls. This worktree's rerun produces 549,717 / 583,325 / 640,537, so its
seven-root load excess is 9.81%, rather than 9.90%. The counter includes
path-bearing transformed module source and is not invariant across checkout
locations. Production shipped sizes reproduce the old values exactly. All
subtractions above use the four fresh measurements from the same checkout.
The legacy counter is retained for comparability: despite the production Vite
mode, its observed module list includes `.dev.js` runtime files and 6,704 bytes
of the Solid Vite plugin. That fixed plugin contribution cancels in comparisons;
these are not measurements of executed minified production bundles.

Validation completed:

- All four variants match every hydrated parity snapshot on `/` and direct
  SSR/hydration on `/docs/start`. All keyed server nodes remain connected;
  nav/footer identities survive all 24 steps. Single-root asserts one input
  block, one key prefix, one hydration disposer, and eleven retained groups.
- Direct `/docs/missing` remains the pinned **F-C9 expected failure on all four
  variants**, with the same `Internal Server Error`/`ssrSanitizeError` evidence.
  It is not a successful smoke or a resolved C2 correctness finding.
- Emission tests cover mode selection, omitted inert imports, chained source
  maps and conservative fallback. The byte test checks mapped/unmapped UTF-8
  accounting. All nine targeted tests pass.
- `pnpm build` passes. The required repository gate is **GREEN: 50 pass,
  0 fail, 0 skip (92 seconds)**. Existing baselines are unchanged.

Reproduce the experiment and preserve the chunks for inspection:

```sh
C2_ROOTS=single pnpm --dir examples/docs-yield run build:compiled
node --test packages/compiler-yield/test/eager-docs.test.mjs
node examples/harness/executed-bytes/hydrated-docs.mjs --single --runs 3 \
  --record /tmp/compiler-single-root-bytes.json --chunks /tmp/compiler-single-root-chunks
pnpm build
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

`--single` adds the fourth variant without changing the existing three-variant
byte gate. `chunk-attribution.mjs` computes the decomposition from recorded
coverage modules and actual emitted chunk maps; the JSON retains its inputs.
