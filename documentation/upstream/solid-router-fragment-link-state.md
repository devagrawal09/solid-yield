# Fragment link state resolves against the previous browser URL during navigation

Status: draft, not filed. Tested 2026-10-08.

Versions: `solid-js` and `@solidjs/web` 2.0.0-rc.13;
`@solidjs/router` 2.0.0-next.29; `@solidjs/vite-plugin` 3.0.0-next.35.

Summary: ordinary client navigation can leave an authored fragment link
without `data-active` and `aria-current="page"` after the destination has
settled. A subsequent hash navigation refreshes the attributes. Server
components are not needed to reproduce it.

Repro, verbatim:

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

Start at `/a`, click B, inspect Part after navigation settles, then click Part.

Expected: once `/b` settles, Part has `data-active="" aria-current="page"`.
Its fragment resolves against the committed `/b` document. Preserve any
user-authored `aria-current` value.

Actual: Part first resolves against `/a`, so both attributes are absent on
`/b`. Clicking Part changes the URL to `/b#part` and adds both attributes.
The separate SSR/hydration driver in `frames-links-check/` reproduces the
same stale state on a reused ordinary async route and on returned frames.

Cause: `@solidjs/router/dist/claims.js:49` resolves raw href against
`document.baseURI`, while `:62` compares with router location. Its state
refresh at `:94` can run before the browser history commit at
`dist/routers/factory.jsx:110–117`. There is no guaranteed refresh after
that history commit. Frame segments claimed after the commit can therefore
have correct state while ordinary links still carry stale state.

Suggested change: refresh owned links after committing browser history, or
resolve fragment-only links against the same canonical page being compared.
Keep explicit base-URL behavior and authored accessibility values intact.
Cover ordinary navigation, streamed frame reveals, errors, and retained
frame returns. Do not remove correct frame attributes to match stale state.
