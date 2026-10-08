# Frames claim raw HTML links and settle refetch navigation before loaded content

Status: draft, not filed. Tested 2026-10-08.

Versions: `solid-js` and `@solidjs/web` 2.0.0-rc.13;
`@solidjs/router` 2.0.0-next.29; `@solidjs/vite-plugin` 3.0.0-next.35;
Vite 7.3.6, Node 24.18.0, jsdom 25.0.1, Vitest 4.1.11.

## 1. Raw HTML link state differs from ordinary hydration

Summary: server-rendered links inserted through `innerHTML` gain router state
attributes when a server-component frame adopts or materializes them. Ordinary
SSR plus hydration leaves those links without state attributes. Both paths
intercept clicks and navigate successfully. Navigation interception does not
mean an anchor was registered for link state; no `<A>` component is needed for
ordinary authored JSX anchors.

Repro, verbatim (render at `/page/a` inside `createRouter`):

```tsx
import { getOwner, onCleanup, runWithOwner } from "solid-js";
import { createFrame } from "@solidjs/web/frames";

export function RawLinks() {
  const owner = getOwner();
  const html = '<a href="/page/a">A</a><a href="/page/b">B</a>';
  const ordinary = <div innerHTML={html} />;
  const hosted = <div innerHTML={html} />;
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

Expected: attachment preserves ordinary raw HTML link state. Authored JSX
anchors keep normal router state, and raw links remain navigable.

Actual: Attach adds `data-active="" aria-current="page"` to hosted A only.
The complete SSR/hydration reproduction in `frames-links-check/` also tests
`dynamic`, `installServerComponents`, and `frameTransformDirectResult`;
the same difference occurs there and with an existing-element host. Every
variant retains its SSR article and intercepts a raw B click.

Cause: `@solidjs/web/frames/dist/client.dev.js:10,19–24` selects every
`a[href]` and `form[action]`, including raw HTML descendants. Its frame claim
callback at line 271 uses that sweep on adopted/materialized content.
`@solidjs/router/dist/claims.js:95` registers those anchors for state.
Ordinary compiled `innerHTML` does not claim its inserted descendants.

Suggested change: carry authored-element claim information with frame HTML,
or provide an opaque-HTML marker/claim filter. Preserve the navigation click
handler. No selective public frame claim option exists in the tested version;
router-wide `explicitLinks` changes authored link behavior too.

## 2. A streamed loading root commits the URL before its article is revealed

Summary: a reused ordinary async route retains its old article and URL until
the new article settles. The high-level server-component path settles once
its root loading HTML applies, before the article's later segment arrives.
This is separate from a consumer failing to wait for any root HTML.

Server component repro, verbatim:

```tsx
import { createMemo, Loading } from "solid-js";
import { Content } from "./content";

export async function region(slug) {
  "use server";
  return () => {
    const data = createMemo(async () => {
      if (globalThis.holdContent) await globalThis.holdContent;
      return slug;
    });
    return (
      <Loading fallback="Loading">
        <Content slug={data()} />
      </Loading>
    );
  };
}
```

Client route body:

```tsx
const Region = dynamic(() => region(props.params.slug));
return (
  <Loading fallback={<main>Loading</main>}>
    <Region />
  </Loading>
);
```

Use the attached plain app at `/page/a`, click its raw B link, hold the server
promise, let root HTML arrive, then resolve the promise. The driver separately
holds response headers/body to distinguish those phases.

Expected for parity with the ordinary reused async route: keep the old URL
and article until the destination article is ready, or document/provide an
option for this different streaming navigation policy.

Actual: high-level frames keep `/page/a` while only response headers have
arrived. After the loading root applies, URL is `/page/b`, article is absent,
and Loading is shown. After the segment arrives, article B appears. The
ordinary route keeps `/page/a` and article A until B is ready. An existing
host with the same root-readiness gate reproduces the high-level result.

Cause: `@solidjs/web/frames/dist/client.dev.js:2286–2293` releases the
component readiness gate on the first `onApply`, including root loading
HTML; `:299` invokes this hook for root/segment applications. Router history
commits at settlement in `@solidjs/router/dist/routers/factory.jsx:110–117`.
The later segment has its own reveal boundary and does not hold that initial
root gate. This report concerns reused-route refetches; first-route Loading
and already-retained frame content have different readiness conditions.

Full reproduction: use the unchanged files in `frames-links-check/`, symlink
`node_modules` with the versions above, then run:

```sh
node check.mjs ordinary
node check.mjs high
node check.mjs hosted
node check.mjs hosted-fixed
node check.mjs high inner
node check.mjs hosted-fixed inner
```

`hosted` deliberately has no root-readiness gate; `hosted-fixed` has it.
Each command runs SSR in a separate process, hydrates the saved HTML, holds
navigation work explicitly, asserts outcomes, and writes a JSON trace.
No dependency patch is used.
