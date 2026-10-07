# C2 tier 1: eager docs roots and a blocking failure finding

**Terminology (2026-10-08).** Dev corrected the earlier use of “islands”: C2 (seven-root and single-root modes) is **static extraction + eager root split**. Every root remains a full client component, and the article still renders in the browser. Islands in the Astro/Marko sense are server-rendered content with small interactive leaves: **C3–C3c are islands, i.e. server components with client slots** such as LikeButton and copy-code. Dev’s measured summary: “static extraction and root splitting never pay; islands (server components with client slots) pay above ~25 KB gzip of server-derivable code and scale.” The `eagerIslands` pass name predates this correction and is unchanged; read older branch reports with this distinction.


## Current result: partial, blocked by F-C9

Dev's 2026-10-07 option A authorizes eager islands only. The experimental
`eagerIslands` Vite pass now emits the docs twin, using the unchanged library
runtime. All seven physical roots are imported statically and hydrated
synchronously, in document order. There is no observer-based hydration, delayed
import, replay scheduler or private hydration reset.

**The `/` route passes the existing 24 interactions after complete streamed SSR.**
Original, library and compiled snapshots match at every step, with no new DOM
normalization. The same is true of direct SSR/hydration at `/docs/start`.
Per-root `cy1-` through `cy7-` keys are unique, every keyed server node remains
connected after hydration, and the inert navigation/footer keep their identity
through all interactions. All seven roots are active, including route navigation,
optimistic likes, typed client failures, search, newsletter, theme and carousel.

**Direct `/docs/missing` does not pass.** Its server HTML has no `.not-found`
paragraph and includes `ssrSanitizeError`'s `Internal Server Error`. Hydration
rejects. The original and library versions fail the same check. This is F-C9,
not an allowed difference or a successful smoke. The edge-preservation claim in
C0 §4 requires failures to keep their class; this execution does not meet it.
It does not establish a compiler-only theorem counterexample, but it prevents
claiming the required theorem for this generated page. Implementation stopped
at this finding. The prototype is retained for review and measurement, not
promoted as complete tier 1.

## C1 groups versus physical roots

C1 reports **11 dependency groups: 1 eager, 5 visible, 5 lazy**. These labels
still describe their causes; they do not schedule tier-1 hydration. A foreign
owner does not merge independent children in C1. Its lifetime still prevents
moving them out of a route that can be removed and recreated. C2 also keeps a
boundary with its nonserializable error accessor. These are explicit expansions,
not a new C1 merge or a claim that there were only seven dependency groups.

| Physical root / key | C1 groups | Reason |
| --- | --- | --- |
| ThemeToggle / cy1- | 1 | Effect, binds and reads stay together |
| SearchBox / cy2- | 2 | Query, async results and failure boundary |
| Router / cy3- | 3–7 | Foreign route lifetime; `props` capture at app.tsx:23:45; Home article error + LikeButton and the DocPage subtree remain inside it |
| NewsletterForm / cy4- | 8 | Form, action and failure boundary |
| CommentList / cy5- | 9 | Async list and avatars |
| ImageCarousel / cy6- | 10 | Image src/alt and counter belong to the changing root |
| ReadingGuide / cy7- | 11 | `err` at content.tsx:145:17 and :145:31 is a local function; retain the defining article/error boundary |

SiteNav and SiteFooter render only on the server under `NoHydration`. Their
component bodies, loading strings and site data do not ship. Article content
inside the Router/ReadingGuide fallbacks still ships. No slot extraction or
C3 server-component transport is claimed.

## Edges, modules and source maps

The supported shell has direct named yield-component calls with empty inputs,
plus the existing foreign Router in a sole-child container. The browser entry
must be `App({})`. Each root gets its own public-serializer input record; the
seven browser records are `{}`. The server-only request URL stays a server hint,
matching the authored browser entry. Public `Hydration({id})` and
`hydrate(...,{renderId})` own the keys. The full shell is not hydrated.

Captures of functions, unsettled promises and class-losing errors are refused.
A proposed nonempty/unproved shell input falls back to the unchanged whole-App
library entry, with a diagnostic at its variable. C1's rejected route `props`
and the guide's `err` cause a client-wide defining subtree. A zero/one-root plan
also returns the unchanged entries: no loader, markers or code edits. The edge
guard checks the actual accepted input record again before server output.
This narrow empty-input implementation is not a general capture lowerer.

Each physical root has a library-runtime module and a production JS chunk.
Imported local slices share one module per original file, preserving failure
class identity. MagicString maps retained spans back to authored files; the
yield, Solid and Vite passes chain those maps. A thrown emitted frame is pinned
at `emission-source.tsx:5:9`. No application code is evaluated by analysis.

F-C7 and F-C8 were emitter bugs found by strict parity and corrected before the
F-C9 stop. The loader registers inert native elements through public
`claimElementTree`, in document order, so router link attributes match. A
MutationObserver registers later inserted nodes; it never schedules hydration.

## Validation and its limits

Final workspace validation on 2026-10-07: `pnpm build` passed; the required
`node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json`
was **GREEN: 50 pass, 0 fail, 0 skip (97 seconds)**. The original gate baseline
was not modified. The final production docs build emitted all seven island
chunks with source maps. F-C9 remains an expected-failure finding in this gate.

- 59 C1 definition fixtures, including pure promises, foreign ownership,
  computed/template reads and overlapping error holes.
- Four emission/edge fixtures: public codec; selected source dependencies;
  chained maps; diagnostic fallback and byte-identical one-root entries.
- The docs test runs each route in a fresh process. It uses the authored 24
  steps after complete SSR, with real timer advances. It does not call the CSR
  driver's DOM-replacing `install()`. Initial pending-state timings therefore
  differ from the separate existing CSR parity test; all three hydrated routes
  use the same schedule.
- Extracted root bodies pass the existing conformance suite: **11 server,
  13 hydrate, 43 client tests**, plus 15 linted library sources. This lane applies
  actual source extraction before the yield/Solid transforms. It checks
  within-root semantics; docs parity checks the multi-root placement. The old
  frozen compiler artifacts are not evidence for these new roots.
- F-C9 has an expected-failure reproduction on all three routes. A green gate
  means the finding still reproduces, not that this route now passes hydration.
- Production shipped-code validation rejects navigation/footer template/data
  strings in any client chunk. Source maps are excluded from shipped sizes.

Reproduce:

```sh
pnpm --dir examples/docs-yield run build:compiled
node --test packages/compiler-yield/test/emission.test.mjs packages/compiler-yield/test/eager-docs.test.mjs
YIELD_C2_ROOTS=1 pnpm --dir packages/yield run test:conformance
# F-C9: this command must currently fail; the parent test pins that finding.
C2_DOCS_MODE=compiled C2_SMOKE=1 C2_URL=/docs/missing node --test packages/compiler-yield/test/eager-docs.test.mjs
node examples/harness/executed-bytes/hydrated-docs.mjs --runs 3 --record /tmp/docs-bytes.json
```

The build configuration is `examples/docs-yield/compiled/vite.config.mjs`.
Measurements, including negative savings, are in
[compiler-benchmarks.md](compiler-benchmarks.md#docs-yield-eager-tier-1).

---

## F-C5: delayed hydration replaces the second server root on rc.13

**Historical status: reproduced.** Dev's 2026-10-07 ruling removes delayed hydration from tier 1; F-C5 no longer blocks eager roots. The delayed fixture remains a finding.

C0 §3.1 requires namespaces that independent `hydrate(..., { renderId })` calls
claim, and says “If it does not, that is a finding (D-004), and C2 waits for Dev”.
Dev's Q1-C ruling also requires per-root claims, including delayed roots.

The fixture server-renders two library-runtime counters under public
`NoHydration` / `Hydration({ id })`, with an inert heading between their shell
and the document. Each root's button has its own namespace. It uses the public
hydration script and the library's `hydrate` entry with the matching `renderId`.

| Schedule | First server button retained | Second server button retained | Warnings | Interaction after setup |
| --- | --- | --- | --- | --- |
| Hydrate both synchronously | yes | yes | none | both increment independently |
| Hydrate first; await one timer turn; hydrate second | yes | **no** | **none** | replacement button increments |

The delayed case fails the per-root claim invariant even though the final DOM
looks right. The old second button is disconnected. This rules out treating a
clean console or matching final markup as sufficient evidence of hydration.
No click on the first root is needed to trigger it.

Diagnosis from the installed rc.13 implementation: Solid's
`drainHydrationCallbacks` schedules the page-wide `_$HY.done = true` flag after
the first hydration completes. Web's `hydrate` then takes its plain-render path
when that flag is true. The reproduction observes node identity; it does not
read or modify private runtime state. No private reset or forced eager hydration
has been added as a workaround.

Reproduce: `node --test packages/compiler-yield/test/hydration-namespace.test.mjs`.
The two schedules run in separate processes. The delayed test **pins the finding**
with a failed identity claim; it is not a passing delayed-hydration test. A future
fix that preserves the second node will make that test fail until the finding is
updated deliberately. Source: `test/fixtures/roots.tsx` in the compiler package.

Tier 1 does not attempt delayed hydration. The eager implementation and its new blocking finding are recorded above.

---

# C2: delayed Solid hydration is not the v0.2 path

The public-API namespace spike on proto/compiler preserved both independent server buttons when both roots hydrated synchronously. After a timer turn, a second hydrate replaced its button without a warning. Its test pins node identity, not just markup or interaction. See [solidjs/solid#3845](https://github.com/solidjs/solid/issues/3845).

**D-111: withdrawn before implementation.** Dev considered resetting Solid's private _$HY.done flag; the maintainer says the guard is deliberate because delayed hydration cannot safely preserve event replay, serialized-data lifetime and DOM claims. No reset was implemented.

v0.2 ships eager islands only, on Solid hydration under D-103's capture rule, effects-make-eager and per-root claim checks. Lazy and visible are report classes. This replaces the prototype's earlier "C2 blocked waiting for delayed hydrate" conclusion. The prototype's delayed test remains evidence of Solid's deliberate behaviour, not a supported attachment path.

v0.3's lazy builder will attach by key without Solid's hydrate: its own delegated event queue and serialized payload, validated claims and render fallback. No such builder or C2 codegen is emitted on main by this docs/type-repair work.


D-115 and main's corrected streamed-failure smoke supersede the old F-C9 stop above. The merged compiler harness checks the typed fallback after hydration.
