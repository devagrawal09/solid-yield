# Bounded native audit — 2026-10-08

**Partial implementation. No complete original passes native acceptance.**
The required line is recorded in [sugar-design.md](sugar-design.md#native-mode-the-core-surface).
Build passed. The [full regression gate](native-gate-verification.json) is GREEN:
**53 pass / 0 fail / 0 skip in 176s**. It tested the working tree subsequently committed as
1080e0c; the run records the preceding HEAD, 979e7a4.
47/61 focused fixtures pass generated TypeScript and recommended lint.
The counter, caught generator action, and async helper have SSR plus hydrated
interaction parity against plain Solid. The async helper reads both before and
after await; its server button survives hydration. These are fixtures, not app acceptance.

Seven unchanged original source trees supply nine JSX/h twin targets. The docs
source matches main. The audit runs Sierpinski, todos, hackernews, effect,
rendering, room, then docs. The baseline is unchanged; no native app step was
added because none passed. D-115's production message difference remains the
recorded, allowed difference in native-serialization.mjs.

The failure sets below are **source call-graph estimates**, not checked route
contracts. Counts are detected JSX boundaries, not a claim that all package
value boundaries have been extracted. Entry handoffs are separate. A transform
failure can leave a detected boundary unemitted. All native app parity and SSR
runs are blocked by their generated checks; the gate still runs the existing
handwritten twins and directive-sugar todos.

| Target | Status | Native parity / SSR | Detected JSX boundaries | Inferred failures per component | Diagnostics |
| --- | --- | --- | ---: | --- | --- |
| sierpinski-yield | fails (generated checks) | blocked / blocked | 0 | TriangleDemo, Triangle → {unknown}; Dot → {none} | TS7023, TS2365, TS2362, TS2322, TS7024, TS2363 |
| sierpinski-yield-h | fails (generated checks) | blocked / blocked | 0 | TriangleDemo, Triangle → {unknown}; Dot → {none} | TS7023, TS2365, TS2362, TS2322, TS7024, TS2363 |
| todos-yield | fails (transform) | blocked / blocked | 0 | Header, TodoItem, MainSection, Footer, App → {unknown} | SUGAR_CALLBACK |
| todos-yield-h | fails (transform) | blocked / blocked | 0 | Header, TodoItem, MainSection, Footer, App → {unknown} | SUGAR_CALLBACK |
| hackernews-spa-yield | fails (generated checks) | blocked / blocked | 1 | App, Stories, Story, User → {unknown}; Comment, Nav, Story, Toggle → {none} | TS2345, TS2769, TS2322, TS2344 |
| effect-yield | fails (transform) | blocked / blocked | 0 | LogPanel, App, Checkout, Results, Typeahead → {unknown} | SUGAR_CALLBACK |
| rendering-yield | fails (transform) | blocked / blocked | 11 | InnerBoundaryItem, OuterBoundaryItem, ErrorStream, Home, AsyncCard, RevealPage, Settings, Shell, Skeleton, Stream → {unknown}; Profile, FeedCard → {none}; Link → {global:Error} | SUGAR_COMPONENT |
| room-yield | fails (transform) | blocked / blocked | 2 | Document, App, StatusPill, IdentityProvider, Directory, DirectoryEntry, Card, Summary, SummaryText, Archive → {unknown}; Home, Panel, Composer, Live, Header, Chat, Transcript → {global:Error, unknown}; Chaos → {none} | SUGAR_CALLBACK |
| docs-yield | fails (generated checks) | blocked / blocked | 1 | Home, DocPage, ArticleContent, ReadingGuide → {ChunkError, NotFound, unknown}; App → {ChunkError, NotFound, SearchError, unknown}; SiteNav, SiteFooter → {ChunkError, unknown}; ArticleBody, ThemeToggle, ImageCarousel → {none}; Shell, LikeButton, NewsletterForm, CommentList → {unknown}; SearchBox → {SearchError, unknown} | TS2344, TS2769, TS2345, TS2322 |

## Boundary inventory

### sierpinski-yield

No foreign JSX boundary detected.


### sierpinski-yield-h

No foreign JSX boundary detected.


### todos-yield

No foreign JSX boundary detected.


### todos-yield-h

No foreign JSX boundary detected.


### hackernews-spa-yield

- <root>/examples/originals/hackernews-spa/src/app.tsx:35:5: Router (createRouter from @solidjs/router) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.

### effect-yield

No foreign JSX boundary detected.


### rendering-yield

- <root>/examples/originals/rendering/shared/src/components/App.tsx:45:13: Home (lazy from solid-js) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
- <root>/examples/originals/rendering/shared/src/components/App.tsx:51:13: Settings (lazy from solid-js) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
- <root>/examples/originals/rendering/shared/src/components/App.tsx:54:13: Stream (lazy from solid-js) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
- <root>/examples/originals/rendering/shared/src/components/App.tsx:57:13: ErrorStream (lazy from solid-js) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
- <root>/examples/originals/rendering/shared/src/components/App.tsx:60:13: RevealPage (lazy from solid-js) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
- <root>/examples/originals/rendering/shared/src/components/App.tsx:63:13: Skeleton (lazy from solid-js) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
- <root>/examples/originals/rendering/shared/src/components/Profile/index.tsx:29:10: Profile (lazy from solid-js) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
- <root>/examples/originals/rendering/shared/src/components/Reveal.tsx:98:9: Reveal (Reveal from solid-js) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
- <root>/examples/originals/rendering/shared/src/components/Reveal.tsx:112:9: Reveal (Reveal from solid-js) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
- <root>/examples/originals/rendering/shared/src/components/Reveal.tsx:115:13: Reveal (Reveal from solid-js) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
- <root>/examples/originals/rendering/shared/src/components/Settings.tsx:22:9: Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.

### room-yield

- <root>/examples/originals/room/src/app.tsx:15:7: Router (createRouter from @solidjs/router) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
- <root>/examples/originals/room/src/routes/home.tsx:78:7: Room (dynamic from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.

### docs-yield

- <root>/examples/originals/docs/src/app.tsx:47:11: Router (createRouter from @solidjs/router) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.

## Core evidence and gaps

| Core form | Current evidence / limit |
| --- | --- |
| Signals, memos, events and holes | counter, conditional, loop, inline-event; counter SSR/hydration |
| Effect compute and effect phases | feedback fixture checks both phases; no termination claim |
| Context creation/provision/read | context and missing-context fixtures; complex context value facades remain open |
| Props | props, tag, colored-prop; snapshot destructuring and recursion remain F-S20 |
| For / Show / Switch / Match | row, lazy-child, native-for-indexed, native-switch-match; only tested forms |
| Index | No Index export in installed Solid 2 rc.13; For keyed=false is checked. A separate Index lowering is not implemented |
| Loading / Errored / fallbacks | lazy-child, handled-catch, generator-action; complex fallback hosts remain open |
| Action and generator action | generator-action and hydrated rejecting action |
| Store / optimistic signal / basic optimistic store | native-store, native-optimistic, native-optimistic-store-basic |
| Server functions and throw/catch | server-rejection, class/unknown/catch fixtures; native-serialization production control |
| Refs | ref-event-reads; no async/failing-ref registration proof (F-S23) |
| Timer/listener callbacks | timer-callback and timer-callback-failure; unresolved callbacks still F-S1/F-S23 |
| Async reads | async-event-reads, async-memo-reads; async-setup-reads refuses setup; hydrated async helper |
| JSX spreads | Still refused; F-S24 |
| splitProps / mergeProps | Not imported by the originals; no implemented lowering claimed |

## Two originals: verbatim diagnostics

Boundary messages below are the Vite warning text plus authored position. Type
messages are the generated TypeScript diagnostics, including their generated
position; there is still no source mapping for those messages.

### hackernews-spa

```text
[NATIVE_FOREIGN_BOUNDARY] Router (createRouter from @solidjs/router) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
<root>/examples/originals/hackernews-spa/src/app.tsx:35:5
```

```text
packages/vite-plugin-yield/test/.native-generated/originals/hackernews-spa/app.tsx:14: [TS2345] Argument of type 'HoleCall<RouteSectionProps<unknown, Params>, true, NativeFailure<"unknown">, false, never>' is not assignable to parameter of type '(<A extends PropsInput<RouteSectionProps<unknown, Params>, unknown> = PropsInput<RouteSectionProps<unknown, Params>, never>>(props: A & NoInfer<Undeclared<...>>) => ComponentView<...>) & { ...; } & { ...; }'.
  Type 'HoleCall<RouteSectionProps<unknown, Params>, true, NativeFailure<"unknown">, false, never>' is not assignable to type '{ readonly "[FOREIGN_HANDOFF] a yield component handed to plain Solid may fail with the failure kinds this property lists: handle them inside, or wrap it in an Errored, first": "unknown"; }'.
```

### docs

```text
[NATIVE_FOREIGN_BOUNDARY] Router (createRouter from @solidjs/router) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
<root>/examples/originals/docs/src/app.tsx:47:11
```

```text
packages/vite-plugin-yield/test/.native-generated/originals/docs/app.tsx:35: [TS2345] Argument of type 'HoleCall<{}, false, NativeFailure<"unknown">, false, never>' is not assignable to parameter of type '(<A extends PropsInput<{}, unknown> = PropsInput<{}, never>>(props?: (A & NoInfer<Undeclared<A, {}>>) | undefined) => ComponentView<false, NativeFailure<"unknown">, false, HoleRequires<...>>) & { ...; } & { ...; }'.
  Type 'HoleCall<{}, false, NativeFailure<"unknown">, false, never>' is not assignable to type '{ readonly "[FOREIGN_HANDOFF] a yield component handed to plain Solid may fail with the failure kinds this property lists: handle them inside, or wrap it in an Errored, first": "unknown"; }'.
```

## Remaining findings

- **F-S19, partial:** direct calls and method arguments can read in the caller's host. Method lookup stays before argument evaluation; nativeInvoke preserves the receiver and ignores an overridden .call. Spread arguments and more complex receiver expressions still need coverage.
- **F-S20:** Sierpinski's one-time prop snapshots and recursive component colors remain unchecked. No cast or source rewrite was used to declare it passing.
- **F-S23:** failing timer/ref callbacks still report NATIVE_CALLBACK_FAILURE; registration at the owning boundary remains incomplete.
- **F-S24:** reactive JSX spreads still report NATIVE_SPREAD. Preserving DOM identity, getter order, and event/ref bindings needs a checked spread adapter.
- **F-S25:** ordinary native prop types do not yet infer pending/failure colors from every caller. Router RouteSectionProps includes unknown values rejected by PropsCheck; docs also exposes SETTLED_PROP. These are lowering gaps, not native-source type errors.
- **F-S26:** foreign JSX tags, render callbacks and route component handoffs are implemented, but automatic extraction of arbitrary rendered package values, projections, lazy/until, directives and class components is incomplete. Some legacy API mappings still run. Boundary counts are consequently incomplete for the full option-C surface.
- **F-S27:** higher-order components, remaining context/fallback callbacks, and foreign listener assignments can still stop at SUGAR_COMPONENT/SUGAR_CALLBACK/SUGAR_HOST. The model's unknown-host refusal must not hide unfinished host inference.
- **F-S28:** the warnings use C for foreign client ownership. The existing analyzer still gives unknown foreign data U and pins the owner to the client; a separate native provenance/capture acceptance check has not been added. Do not read the warning label as a new proof of capture safety.
- Earlier F-S14/F-S15/F-S18 limitations (transport/custom-class identity, external root exceptions, structural class witnesses), source maps and packaging remain. No new proof or editor integration is claimed.
