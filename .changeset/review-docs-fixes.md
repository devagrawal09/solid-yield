---
"solid-yield": minor
"eslint-plugin-solid-yield": patch
---

From a first-time-user review. `Handler<Args, E = never>`: the type to declare an event prop (or a context holding a handler) with — `EventHandler<Args, E, unknown, false, boolean>`, a handler that does not wait on pending data, so binding a call of it marks no view may-wait and `no-unshown-wait` stays quiet; a bare `EventHandler<[T]>` defaults to "may wait". A pending root is now refused with its own message, `[PENDING_ROOT] the root may be pending (a read under it has no Loading above): wrap the root, render(() => Loading({ children: App }), el), or put a Loading around the pending part`: before, `render` / `hydrate` / `renderToString` / `renderToStream` printed the `[NO_PROVIDER]` refusal for it (with `any`), though no context was missing. The lint's and the `READ_IN_VIEW` messages say `Show(…)` / `Match(…)` / `Switch(…)` in a hole, not the tag syntax the dialect refuses. Package READMEs link to the repository with absolute URLs (their relative links 404 on npm) and give the full, tested install line.
