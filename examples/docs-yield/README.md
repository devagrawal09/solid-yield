# Field Notes: content-site twin

A deliberately long documentation site, paired with `../originals/docs`. Routes
are `/` and `/docs/:slug`; `start` and `widgets` exist, and `missing` fails with
`NotFound`. Navigation, eight-section articles, on-this-page and related links,
a fixed reading appendix and footer come from delayed fake API functions.

Six widgets own their state: ThemeToggle, SearchBox, LikeButton (one instance per
article route), NewsletterForm, CommentList (with pending avatars per row), and
ImageCarousel. No application context or signal is shared. The router supplies
its own context. Only ThemeToggle has an effect, deliberately, to show D-104's
eager classification. Its theme class changes only its wrapper.

The fake server API runs in process in both apps, including the browser. Its
`"use server"` directives declare C1 provenance; this fixture does not set up an
RPC transport or claim that these bodies already disappear from a browser build.
Widget lookup and comment/avatar APIs are ordinary client promises. Errors use a
local `Failure(kind)` base factory because `solid-yield` exports the structural
`Failure` type, not a runtime class factory.

```sh
pnpm -C examples/docs-yield dev
pnpm -C examples/docs-yield test
pnpm -C examples/docs-yield typecheck
pnpm -C examples/docs-yield lint
node examples/harness/ssr-smoke/smoke.mjs --only docs-yield
node examples/harness/hydrate-smoke/hydrate.mjs --only docs-yield
node examples/harness/hydrate-smoke/hydrate.mjs --originals --only originals/docs
node packages/compiler-yield/src/report.js --json
```

`tests/script.ts` runs the same 28 steps on both apps, with a normalized DOM
snapshot after every step. It covers pending content and avatars, route changes,
local theme, successful/failing search, optimistic likes and rate limiting,
pending and successful/invalid newsletter submits, carousel and typed NotFound.
The assertions also check that widget actions leave article markup unchanged.
`stream/` supplies matching server/client entries; the hydration smoke claims the
server nodes and clicks theme/carousel. Runtime-cost and executed-byte runners use
the same script; the ordinary cost test is skipped unless the runner selects it.

See [the C1 finding](../../documentation/compiler-c1-report.md#docs-yield).
Most measured JSX is locally inert, but M6 merges independent async widgets
through their shared delay helper's U origin. Router ownership, route props,
boundaries and a rejected prop capture merge routed articles and likes. A separate
error-fallback group is not another widget. These are diagnostic candidates,
not emitted or proven independently hydratable roots.


# Field Notes: content-site twin

A deliberately long documentation site, paired with `../originals/docs`. Routes
are `/` and `/docs/:slug`; `start` and `widgets` exist, and `missing` fails with
`NotFound`. Navigation, eight-section articles, on-this-page and related links,
a fixed reading appendix and footer come from delayed fake API functions.

Six widgets own their state: ThemeToggle, SearchBox, LikeButton (one instance per
article route), NewsletterForm, CommentList (with pending avatars per row), and
ImageCarousel. No application context or signal is shared. The router supplies
its own context. Only ThemeToggle has an effect, deliberately, to show D-104's
eager classification. Its theme class changes only its wrapper.

The fake server API runs in process in both apps, including the browser. Its
`"use server"` directives declare C1 provenance; this fixture does not set up an
RPC transport or claim that these bodies already disappear from a browser build.
Widget lookup and comment/avatar APIs are ordinary client promises. On main,
typed errors extend the library's `Failure(kind)` base (D-110);
the original keeps its local factory and the messages are unchanged.

```sh
pnpm -C examples/docs-yield dev
pnpm -C examples/docs-yield test
pnpm -C examples/docs-yield typecheck
pnpm -C examples/docs-yield lint
node examples/harness/ssr-smoke/smoke.mjs --only docs-yield
node examples/harness/hydrate-smoke/hydrate.mjs --only docs-yield
node examples/harness/hydrate-smoke/hydrate.mjs --originals --only originals/docs
```

`tests/script.ts` runs the same 28 steps on both apps, with a normalized DOM
snapshot after every step. It covers pending content and avatars, route changes,
local theme, successful/failing search, optimistic likes and rate limiting,
pending and successful/invalid newsletter submits, carousel and typed NotFound.
The assertions also check that widget actions leave article markup unchanged.
`stream/` supplies matching server/client entries; the hydration smoke claims the
server nodes and clicks theme/carousel. Runtime-cost and executed-byte runners use
the same script; the ordinary cost test is skipped unless the runner selects it.

See [the C1 finding on proto/compiler](https://github.com/devagrawal09/solid-yield/blob/proto/compiler/documentation/compiler-c1-report.md#docs-yield).
Most measured JSX is locally inert, but M6 merges independent async widgets
through their shared delay helper's U origin. Router ownership, route props,
boundaries and a rejected prop capture merge routed articles and likes. A separate
error-fallback group is not another widget. These are diagnostic candidates,
not emitted or proven independently hydratable roots.

The compiler analysis stays on `proto/compiler`; run its report command there.


The article loader now returns six Markdown sources. A sibling derived memo
runs marked and highlight.js (TypeScript, JavaScript, shell), builds the TOC,
and formats the date. Both apps use identical sources and the same adapter.
The four added steps check code-heavy navigation, TOC navigation and highlighted
content. [C3b measurements](../../documentation/compiler-c3b-payload.md) compare
client execution and shipped bytes with the server-region output.
