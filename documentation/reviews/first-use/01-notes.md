# solid-yield first-use log

Start: 22:42 (2026-10-06). Docs read: README.md, getting-started.md, refusals.md, 3 package READMEs.

## Setup

1. **[doc: missing] Routing.** The task is a 3-page app. No doc says how to route. refusals.md says the router's hooks are `no-foreign-reactive`, and that `defineRoute({ component })` needs `foreign(…)`, so a router *can* be used, but there is no example of a router, `foreign`, or how a yield component reads the URL. Workaround: decided to do routing with a `$signal` holding the page name and `Switch`/`Match` (also not documented beyond being named in refusals.md).
2. **[doc: missing] Testing.** No doc says how to render in jsdom/vitest. package.json `exports` sends `node` to `dist/server.js` — under vitest that may pick the server build (a real user only finds this by reading package.json). See later entries.
3. **[doc: ambiguous] Versions.** `@solidjs/vite-plugin` latest is `3.0.0-next.47` (needs vite ^8, solid-js ^2.0.0-rc.13). No doc says which `@solidjs/vite-plugin` / vite version pairs with the library. Took latest.
4. **[doc: missing] TypeScript version.** `pnpm add -D typescript` installs TS 7.0.2, which `@typescript-eslint/parser` 8 does not support (`>=4.8.4 <6.1.0`). The getting-started install line omits `typescript` and `eslint` altogether (eslint is a peer of the plugin). Pinned `typescript@~6.0`.
5. **[doc: missing] The install line** in getting-started omits `eslint`, `typescript`, and any test tooling; the solid-yield README's dev line also omits `@typescript-eslint/parser` that its own eslint config imports.

## Writing the pages

6. **[doc: missing] `For`, `Show` with a value, `Switch`/`Match`, `createContext`/`provide` signatures.** getting-started shows only `Show` with a boolean hole and lazy-view children. Guessed `For({ each, children: function* (note) { return view(…) } })` from "a row's setup returns its view" in refusals.md — it typed first try (nice; `note.title` is a typed path).
7. **[non-actionable type error] `Show` over a nullable source.** Wrote `Show({ when: failure, children: function* () { … {yield* failure.message} … } })` (failure: `$signal<BadTitle | null>`). Message:
   ```
   src/editor.tsx(44,64): error TS2339: Property 'message' does not exist on type 'Source<BadTitle | null, never, false>'.
   ```
   Fair enough (Solid habit). Then tried a lazy view taking the narrowed value, `children: function* (f) { return <p>{yield* f.message}</p>; }`. Message (abridged; full one is ~20 lines per call, twice):
   ```
   src/editor.tsx(41,17): error TS2589: Type instantiation is excessively deep and possibly infinite.
   src/editor.tsx(43,11): error TS2769: No overload matches this call.
     Overload 1 of 2 … Type 'Element' is not assignable to type 'ViewFn<unknown, unknown>'.
       Type 'undefined' is not assignable to type 'ViewFn<unknown, unknown>'.
         Type 'undefined' is not assignable to type '() => Generator<unknown, unknown, any>'.
     Overload 2 of 2 … Type '(f: ValuePath<…>) => Generator<Read<false, never>, Element, any>' is not assignable to type 'LazyView'.
         Target signature provides too few arguments. Expected 1 or more, but got 0.
   ```
   Neither overload says "a child that takes the value is a *row*: return `view(…)` from it". Overload 2's "too few arguments, expected 1 or more, got 0" reads backwards. And the TS2589 "excessively deep" is noise. **Opened `dist/types/flow.d.ts`** to find `children: RowRoutine<[value: ValuePath<W>]…>`. Fix: `children: function* (f) { return view(function* () { return <p>{yield* f.message}</p>; }); }`. ~10 min.
8. **[doc: missing] Event props.** refusals.md shows `yield* (yield* props.onSave)()` but never says what to *declare* the prop as. Declared `onTheme: (t: Theme) => void` →
   ```
   src/settings.tsx(16,12): error TS2488: Type 'void' must have a '[Symbol.iterator]()' method that returns an iterator.
   ```
   (Not actionable: doesn't say "declare an EventHandler".) **Opened `dist/types/index.d.ts` + `types.d.ts`** to find `EventHandler<Args, E, R, P, A>`.
9. **[lint surprised me] `no-unshown-wait` from a type default.** With `onTheme: EventHandler<[Theme]>`, lint said:
   ```
   src/settings.tsx
     25:33  warning  this view binds a handler that may wait on pending data; show its in-flight state (`pickLight`, D-075)  solid-yield/no-unshown-wait
     26:33  warning  this view binds a handler that may wait on pending data; show its in-flight state (`pickDark`, D-075)   solid-yield/no-unshown-wait
   ```
   The handler only calls a setter. The "may wait" comes from `EventHandler`'s default `P = boolean`. Fix: `EventHandler<[Theme], never, unknown, false, false>` — five positional generics to say "a sync event that takes a Theme". Also: the warning says "show its in-flight state" but no doc says *how* the lint decides the state is shown (what silences it legitimately). Conversely the editor's `save`, which really does wait 300 ms on the API, gets **no** warning (it's `A`, own async, not `P`) — so the rule fired on the instant handler and not on the slow one.
10. **[doc: ambiguous] Context holding a changing value.** Declared `createContext<Theme, "ThemeCtx">()` and provided `value: theme` (a `$signal` source). It type-checks and `yield* theme` in the readers types as a read. Docs only hint ("Provide `null`, or a source of `T | null`") that a source is an acceptable value. Unclear whether the context type should be `Theme` or `Source<Theme>`.
11. **[good] `[NO_PROVIDER]`.** `render(ThemeBadge, document.body)` without provider gives a long TS2345 but ending in `"[NO_PROVIDER] the root requires the contexts this property names: …": "ThemeCtx"` — actionable.
12. **[doc: missing] Form inputs.** Nothing on `value=`/`onInput` with an `$event` that takes the DOM event. Wrote `$event(function* (e: InputEvent & { currentTarget: HTMLInputElement }) {…})` bound with `onInput={yield* onTitle}`; typed fine. Also no word on whether `e.preventDefault()` inside an `$event` happens synchronously (the event is "a transaction" / "a Solid action").
13. **[doc: missing] In-flight state in an event.** "`$event` is a transaction" — does `yield* setSaving(true)` before an `attempt` become visible before the await, or only at the end of the transaction? Not documented; see test results.

## Running it (vitest + jsdom)

14. **[good, but undocumented] vitest + jsdom just worked** with the Vite config's `test: { environment: "jsdom" }`: the `browser`/`development` build was picked despite the `node` → `dist/server.js` export condition I worried about in (2). Nothing in the docs says so; I'd have liked one line ("tests: vitest with jsdom picks the client build").
15. **[BUG, non-actionable dev error, >15 min] A component whose view's root element is a `<form>` (or `<select>`) cannot be called in a hole.** `render(Editor, el)` worked; `{yield* Editor()}` inside the app crashed the whole app:
    ```
    [REACTIVITY_HALTED] An uncaught error halted the reactive system. No further updates will be processed. Handle errors with <Errored> or treat this as a crash. Error: [NOT_AN_OPERATION] a routine delegated to something that is not a routine operation (`yield*` a source, a store path, a prop, attempt, raise or a setter receipt).
        at devError (…/solid-yield/dist/internal.dev.js:138:16)
        at drive (…/solid-yield/dist/internal.dev.js:329:7)
        …
        at perform (…/solid-yield/dist/internal.dev.js:217:14)
        at /private/tmp/sy-review/app/src/app.tsx:47:62
    ```
    The source frame points at `{yield* Editor()}` in app.tsx, and every `yield*` in Editor *is* a source/receipt/event, so the message sent me looking for a wrong `yield*` that didn't exist. Bisected with probe components (~15 min): `<form onSubmit={yield* ev}>` as root fails, `<button onClick={yield* ev}>` as root works, compiled code is identical (checked via `vite.transformRequest`); a bare `view(function* () { return <form>x</form>; })` and `<select>…</select>` also fail; wrapping in a `<div>`/`<section>` works. My guess: `HTMLFormElement`/`HTMLSelectElement` are **iterable**, so the runtime mistakes the returned element for a generator/view and delegates into it. Workaround: `<section class="editor"><form …>…</form></section>`. This is a real bug a forms app hits on its first page, and the error names nothing about the form.
16. **[doc: missing] Event writes are not visible until the event's transaction ends.** With `const [saving, setSaving] = yield* $signal(false)` and `yield* setSaving(true)` before the `attempt`, the button **never** showed "Saving…": the whole event is one transaction. Same thing made `input` → immediate `submit` (no tick between) read the *old* title, because the `onInput` event's write was not yet committed when the submit event read it. Neither behaviour is documented. Guessed from Solid 2 knowledge that `$optimistic(false)` (mentioned only in refusals.md, as an overload error) is the in-flight tool: with `yield* $optimistic(false)` "Saving…" + `disabled` shows during the save and reverts after. The getting-started "Events" row and `no-unshown-wait` both say "show its in-flight state" but never say *how*; `$optimistic` deserves to be the documented answer (if it is the answer).
17. **[self-inflicted, minor] `String(cause)`** in the getting-started example yields `"Error: title too short"` in the UI; switched to `(cause as Error).message`. `cause` is `unknown` in the handler — expected, but the doc's example teaches `String(cause)`.

At 22:51: typecheck 0 errors, lint 0 problems, `vite build` ok, 5/5 vitest tests pass.

## Going further

18. **[good] The strict failure route works end to end.** `quick-save.tsx`: the `$event`'s `attempt` returns `new BadTitle(…)`, the event fails, the bound `onClick={yield* save}` gives the view the failure, and `Errored({ catch: [BadTitle], fallback: (err, reset) => … })` shows it; `reset` restores the form with the signal state intact. Typed first try. Small surprise: `<button onClick={reset}>` inside the `Errored` fallback type-checks even though "event attributes take only a bound handler" — I'd expected to need an `$event` there; not documented either way.
19. **[lint: excellent; types: not]** Deliberate mistakes in one file (`setN(1)` unyielded, `const doubled = (yield* n) * 2` in a view, `<NotesList folder="inbox" />`, `onClick={inc}`). Lint:
    ```
     7:5   error  `setN(…)` writes nothing until it is delegated to: `yield* setN(…)`, in an $event or an $effect's effect phase                                         solid-yield/no-unyielded-write
    10:22  error  a view does not read: read in a hole (`{yield* …}` in JSX, a bare `function*` in `h`), branch with <Show> / <Match>, derive with a $memo in the setup  solid-yield/no-read-in-view-body
    13:9   error  `<NotesList>` is a yield component: call it — `{yield* NotesList({ … })}` — so its pending and failures reach this view (D-062)                        solid-yield/no-component-tag
    14:26  error  `inc` is an `$event` handler given unbound: bind it, `onClick={yield* inc}`, so its failures and may-wait marker join this view's type (D-072, D-075)  solid-yield/no-unbound-event
    ```
    All four actionable. Two nits: `no-read-in-view-body` says "branch with `<Show>` / `<Match>`" — tag syntax, which is exactly what `no-component-tag` forbids; and messages cite D-numbers (D-062, D-072…) from a decision log that is not published with the packages.
    The same mistakes in TypeScript: the tag gives `'NotesList' cannot be used as a JSX component … Type 'ComponentView<…>' is not assignable to type 'NotAComponentView' … Types of property '[COMPONENT]' are incompatible. Type 'true' is not assignable to type 'undefined'.`; the unbound handler gives `Property '[BOUND]' is missing in type 'EventHandler<[], never, void, false, false>'`. Decodable only after reading refusals.md.
20. **[non-actionable type error] A read in a setup** (`const v = yield* n;` in the setup) is reported at `component(` (line 3, not line 5), as two 13-level overload chains ending in:
    ```
    Type 'Read<false, never>' is not assignable to type 'SetupOp'.
      Property 'kind' is missing in type 'Read<false, never>' but required in type 'Create<string, any>'.
    ```
    No lint rule covers it (refusals.md: lint "—"), so this message is all you get before running. The useful part ("Read is not a SetupOp") is 12 lines deep; the last line (`kind` missing on `Create`) is a red herring.
21. **[non-actionable / wrong code] Forgetting `Loading`.** Removing the `Loading` around the notes list gives the error at **main.tsx** (`render(App, …)`), not near the list, and the message's expected type prints the **`[NO_PROVIDER]`** refusal although no context is missing:
    ```
    src/main.tsx(4,8): error TS2345: Argument of type 'HoleCall<{}, true, never, false, never>' is not assignable to parameter of type 'Root & { readonly "[NO_PROVIDER] the root requires the contexts this property names: provide each above the components that read it (Ctx.provide({ value, children }) around their calls)": any; }'.
      …
            The types of '[PENDING]' are incompatible between these types.
              Type 'true' is not assignable to type 'false'.
    ```
    The real cause is the last line. The doc's own fix (`render(() => Loading({ children: App }), el)`, D-099) is not mentioned by the message.
22. **[doc: missing; types: false positive] A real router.** Installed `@solidjs/router@2.0.0-next.35` (`createRouter`, plain `<a href={paths.x}>`). Put `<Router>{props => props.children}</Router>` inside the yield App's view, *inside* `ThemeCtx.provide`, and each route `component: foreign(Page)`. Types + lint accepted the `Router` tag and its render-prop child. But `foreign(SettingsPage)` is refused:
    ```
    src/routed/router.tsx(28,45): error TS2345: Argument of type 'HoleCall<{}, false, never, false, RequiredContext<Theme, "ThemeCtx"> | RequiredContext<EventHandler<[Theme], never, unknown, false, false>, "SetThemeCtx">>' is not assignable to parameter of type '…'.
      Type '…' is not assignable to type '{ readonly "[NO_PROVIDER] a yield component handed to plain Solid requires the contexts this property names: provide them inside it (Ctx.provide around the calls that read them)": "ThemeCtx" | "SetThemeCtx"; }'.
    ```
    i.e. an app-wide context cannot be typed through a router: the dialect wants each route page to provide the theme itself, which defeats "the whole app provides it". At runtime the provider above the Router **does** reach the page (test `routed.test.tsx` passes: theme toggles in Settings and in the nav badge). Workaround: `foreign(SettingsPage as unknown as () => unknown) as never`. **Opened `dist/types/foreign.d.ts`** to confirm `foreign` is the identity and there's no escape hatch. Also had to put the theme *setter* in a second named context, since route components get no props from me.
23. **[doc: broken references]** Every doc defers to `yield-library.md` ("the reference"), `DECISIONS.md` and the getting-started program `packages/yield/test/docs/getting-started.tsx`, none of which ship with the packages; package READMEs link with repo-relative paths (`../../documentation/…`, `../yield`) that 404 on npm. The ~40 "D-0xx" citations in the docs and in lint/type messages are therefore dead ends for a user. The getting-started snippets are also formatted by prettier into `yield *` with a space and wrapped in bare `{ … }` blocks (sections 2, 3, 5), which reads like a different syntax.
24. **[env, not the library]** `vite` dev server can't listen in my sandbox (EPERM), so I never saw the app in a real browser; verified with `vite build` + jsdom tests only.

## Time
Wall-clock ~15 min of tool time (22:42 → 22:57), but as a human the bisect in (15), the `Show` row form (7), the in-flight transaction behaviour (16) and the router/context false positive (22) would each have been 15–45 min; I estimate ~2 h of human work total.

## Final state (22:57)
- `pnpm typecheck` — 0 errors. `pnpm lint` (recommended, `src/`) — 0 problems. `pnpm build` — ok. `pnpm test` — 7/7 (2 files).
- Workarounds in code: `<section>` wrapper around the editor's `<form>` (15); `$optimistic` for in-flight (16); `EventHandler<[Theme], never, unknown, false, false>` (9); cast at `foreign(SettingsPage)` in the router variant (22).
