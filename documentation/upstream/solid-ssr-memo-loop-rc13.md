> Status: **resolved in rc.14** (2026-10-08). Reproduces [#3815](https://github.com/solidjs/solid/issues/3815), fixed by [#3816](https://github.com/solidjs/solid/pull/3816); nothing to file.
> The exact repro completes in production/development with one setup (111/108 ms). The `046387b` workaround is removed in the working tree and its unchanged test plus `/profile` SSR pass; commit is blocked by the separate rc.14 Effect regression. See [retest](solid-rc14-retest.md). The rc.13 diagnosis below is retained as history.

# [2.0.0-rc.13] SSR stream never ends: after a hole retry re-creates a component, a cascading memo spins in microtasks on a shared serialization slot

## Summary

With `renderToStream`, a function hole that creates a component (`{() => <Page />}`) becomes the retry unit when what the component returns, the output of a `lazy()` component, is still pending. The retry runs the hole again, so `Page` is set up a second time, under the same owner ids. The second `user` memo is created while the first one's serialization slot is still pending, and it takes over that slot's deferred (`const deferred = slot ? slot.d : createDeferredPromise()`, `solid-js/dist/server.js:743`). It waits on its own promise but throws `NotReadyError(slot.d.promise)` (`:827`). When the first `user` resolves the slot, the second `info` memo (which reads `user()`) retries through `subscribePendingRetry`. It reads `user()` again and gets the same, already-resolved promise, so it retries again in the next microtask, and this never stops. The microtask queue never drains, so no timer fires: not the second `user`'s own `setTimeout` (the only thing that could end the loop), and not any other timer in the process. The stream writes nothing and never ends, and the Node process sits at 100% CPU. We found it in a library that compiles to this shape (a component call inside a hole). Handwritten Solid in the same shape loops the same way, as the reproduction below shows.

## Reproduction (plain Solid, no other libraries)

`repro.jsx`, compiled for SSR (`@solidjs/compiler` `transform(src, { generate: "ssr", hydratable: true })`, or `vite-plugin-solid` with `ssr: true`), then run with `node`:

```jsx
import { createMemo, lazy } from "solid-js";
import { renderToStream } from "@solidjs/web";

const delay = (value, ms) => new Promise(r => setTimeout(() => r(value), ms));

// a lazy component: pending until its "chunk" loads
const Profile = lazy(() => delay({ default: props => <h1>{props.user.name}</h1> }, 10));

let setups = 0, infoRuns = 0;
function Page() {
  console.log(`Page set up (${++setups})`);
  const user = createMemo(() => delay({ name: "Jon" }, 50));
  const info = createMemo(() => {
    if (++infoRuns % 1e6 === 0) console.log(`info memo ran ${infoRuns} times`);
    user(); // cascading load, as in examples/rendering's /profile
    return delay(["a", "b"], 50);
  });
  return <Profile user={user()} info={info()} />;
}

const t0 = Date.now();
setTimeout(() => console.log("200 ms timer fired"), 200); // never fires
renderToStream(() => <main>{() => <Page />}</main>, { manifest: {} }).pipe({
  write: html => console.log("html:", html),
  end: () => console.log(`ended after ${Date.now() - t0} ms; Page set up ${setups}x`)
});
```

(`{ manifest: {} }` is only there because the server `lazy()` throws "no asset manifest is set" without one.)

Output (killed by a 20 s alarm; production and `--conditions=development` builds behave the same):

```
Page set up (1)
Page set up (2)
info memo ran 1000000 times
info memo ran 2000000 times
…
info memo ran 29000000 times
<killed after 20 s: no "html:" chunk, no "ended", the 200 ms timer never fired>
```

What each part does (each variant checked with the same script):

| Change | Result |
| --- | --- |
| `<main><Page /></main>` (component created at template time, not inside a function hole) | Ends in ~105 ms. `Page` set up 1×, correct markup and serialized data. |
| `<main>{() => [<Page />]}</main>` (same hole, but the result is wrapped in an array) | Ends in ~106 ms. `Page` set up 1×. |
| No `info` memo (only `user`) | `Page` is still set up **2×**, but the render ends (~73 ms). The double setup happens either way; the cascading memo turns it into the hang. |
| No `lazy()` (`Profile` a plain component) | `Page` set up 1×. Ends. |
| `ProfileView` with a `<Loading>` whose `<For each={props.info}>` reads `info` | The `<Loading>`'s discovery spins too, and after 10,001 passes it throws `<Loading> boundary discovery did not converge after 10001 passes …`. That disposes the render, which also stops the memo loop. The stream then ends after ~96 ms **without writing any chunk**. (The unbudgeted memo loop above is the hang; the budget only hides it when a `<Loading>` happens to read the same source.) |
| `renderToString` | Not affected: it throws "This value cannot be rendered synchronously. Are you missing a boundary?" before any retry. |

**What was verified.** All of the above was run on macOS (arm64, Darwin 25.5.0) against the installed rc.13 packages, with each run under a 20 s `alarm`: production server builds, and the hang again with `--conditions=development`. The diagnosis (the second memo reuses the slot deferred, `NotReadyError` names that deferred, the retry goes through `subscribePendingRetry`) comes from reading `solid-js/dist/server.js` (`processResult` lines 717–827, `subscribePendingRetry` at 425, the server `createMemo` `update()`), and it matches the counters. **Not verified:** I did not instrument the owner ids to prove the second `user` gets the same id as the first (inferred from the slot lookup by `ownerId(owner)` succeeding). I did not test with Vite's SSR loader in this exact repro (the original finding was under `vite dev`). I did not test on any version other than rc.13, or check whether `main` has already changed this path.

## Expected vs actual

**Expected:** the stream ends after both async memos settle (about 100 ms), with `<main _hk=0><h1 _hk=30>Jon</h1></main>` and the serialized `user` and `info` data, the same as when `<Page />` is created at template time. Ideally `Page` is also set up only once. Even if a retry re-creates it, the second set of memos should either get their own slots or settle from the first set's values. They should never retry on a promise that has already resolved.

**Actual:** `Page` is set up twice. The second `info` memo re-runs tens of millions of times in microtasks (about 1.5 M/s here). No `setTimeout` callback ever runs again in the process, no chunk is written, and the stream never ends. Nothing is logged and no error is thrown. The only visible signs are a stuck request and a busy CPU.

## Versions

- `solid-js` 2.0.0-rc.13
- `@solidjs/web` 2.0.0-rc.13
- `@solidjs/compiler` 2.0.0-rc.13 (used to compile the repro for SSR)
- Node v24.18.0, macOS (Darwin 25.5.0, arm64)

## Workaround (solid-yield, commit 046387b)

On the server, solid-yield's `perform` (`packages/yield/src/runtime.ts`) now returns a view that is a function (a flow control's or a lazy component's output) wrapped in a one-element array (`[view]`) instead of returning it bare into the hole. Solid's server renderer then resolves and retries that function as its own node, so the hole that created the component is not re-run. The page is set up once and the shared-slot loop is never reached. The workaround avoids the trigger and leaves the Solid bug in place. In handwritten code the same move, `{() => [<Page />]}`, or creating the component at template time, avoids it too (both verified above).
