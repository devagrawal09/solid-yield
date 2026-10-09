# Issue draft: links inside `innerHTML` are claimed through frames but not in regular rendering

Status: **ready to file** on `solidjs/solid`, as a question, not a bug (Dev, 2026-10-09). Not yet filed: this session could not attach the upstream repository.
Re-checked 2026-10-09 on `solid-js` / `@solidjs/web` 2.0.0-rc.14, `@solidjs/router` 2.0.0-next.38, `@solidjs/vite-plugin` 3.0.0-next.35, Vite 7.3.6, jsdom 25.0.1 (`documentation/handoff/repros/frames-links-check/`, same result as the rc.13 / next.29 run).
Replaces §1 of the earlier `solid-frames-link-claim.md` draft on `proto/compiler`, which framed this as a frames bug.

---

**Title:** Frames claim links inside `innerHTML`; regular rendering doesn't — intended?

**Body:**

Not reporting a bug: navigation works either way. This is a question about a difference between the two rendering paths.

Links inside an `innerHTML` string get claimed (so the router adds `data-active` / `aria-current`) when the HTML arrives through a server component / frame. They don't get claimed when the same component renders normally, whether client-rendered or SSR'd and hydrated.

**Why they differ.** Regular rendering claims one element at a time, as the compiled code sets `href` / `action` (`setAttribute` → `claimElement`). Anchors that come from an `innerHTML` string never go through that path. The frames client instead runs `claimTree` over adopted, materialized and streamed HTML, which matches every `a[href], form[action]` underneath. The HTML carries no information about which anchors were authored as JSX and which came from a raw string.

**Minimal repro.** Render at `/page/a` inside a normal `createRouter` app. Before Attach, neither copy's links have state attributes. After Attach, only the frame-hosted copy's current-page link does.

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

After Attach:

```html
<div><a href="/page/a">A</a><a href="/page/b">B</a></div>
<div><a href="/page/a" data-active="" aria-current="page">A</a><a href="/page/b">B</a></div>
```

The full SSR + hydration path gives the same result. A route whose content comes from a `"use server"` component with `installServerComponents()` claims the raw links. The same content rendered by a regular component and hydrated leaves them unclaimed.

**Where we hit it.** We have a docs site whose article body is Markdown rendered to HTML and set with `innerHTML`. Moving the article into a server component changes the DOM: links inside the article body gain `data-active` / `aria-current`. Nothing else about the page changes. We noticed it only because we diff the DOM of the two versions.

**Question.** Which behavior is intended?

1. **Frames' behavior is intended.** Server HTML is claimed as a whole. Then regular rendering is the one that differs; `claimElementTree` is already exported, so an app could opt its own `innerHTML` content in. A note in the docs would settle it.
2. **Regular rendering's behavior is intended.** `innerHTML` content stays unclaimed. Then frames would need to know which elements the compiler would have claimed, for example by marking them in the server HTML, or by treating `innerHTML` subtrees as opaque.
3. **Either is fine, with a way to choose.** For example, an attribute that marks a subtree as opaque to claims, or that opts it in.

As far as we can tell there's no per-frame claim option today. The router-wide `explicitLinks` also changes authored links.

Versions: `solid-js` / `@solidjs/web` 2.0.0-rc.14, `@solidjs/router` 2.0.0-next.38, `@solidjs/vite-plugin` 3.0.0-next.35. Same on rc.13 / router next.29.
