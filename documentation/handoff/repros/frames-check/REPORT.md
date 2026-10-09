# Loading retries recreate a nested async memo until the 10,001-pass limit

## Summary

On Solid 2.0.0-rc.13, a `Loading` content function that creates an async memo and immediately reads it while building an `ssrElement` never settles. Its pending read makes the renderer retry the entire function, creating another pending memo. Both `renderServerComponent` and ordinary `renderToStream` fail. A derived memo is unnecessary.

This is specific to the returned content-function shape below. Creating a memo beneath `Loading` is not sufficient to cause failure: a children getter that builds the same tree directly succeeds, as does giving the pending read its own markup function. A loader created outside `Loading` with a synchronous derived memo inside also succeeds.

## Design intent checked

The installed server-component authoring guide, frame API comments, Solid cheatsheet, and reactivity diagnostics guide do not state that memos beneath `Loading` are unsupported. The [server-component design principles](https://github.com/solidjs/solid/blob/next/documentation/server-components/server-components-principles.md), A0, allow internal loading states and say frames share Solid's async model. The same document describes latching evaluations that create reactive scopes rather than continually sweeping them. I found no explicit prohibition on this content-function form; this does not establish that allocating memos in every rendering callback is intended.

The runtime's convergence error does require repeated reads to settle and suggests a stable promise. Returning the same promise across attempts works. The question is whether the child setup should be retained, or this callback form should be documented as requiring stable async identities.

## Versions

- `solid-js`: **2.0.0-rc.13** (installed package metadata verified)
- `@solidjs/web`: **2.0.0-rc.13** (installed package metadata verified)
- Node: **v22.23.2**, macOS arm64
- Node server exports; production/default conditions. The smaller reproduction also fails with `--conditions=development`.
- No router, JSX compiler, generator adapter, network request, or slot is needed.

## Reproduction

Install `solid-js@2.0.0-rc.13` and `@solidjs/web@2.0.0-rc.13`. Save this as `repro.mjs`:

```js
import { createMemo, Loading } from 'solid-js';
import { ssrElement, renderToStream } from '@solidjs/web';
import { renderServerComponent } from '@solidjs/web/frames';
import { provideRequestEvent } from '@solidjs/web/storage';

async function frame() {
  'use server';
  return () => Loading({
    fallback: 'Loading',
    children: () => {
      const data = createMemo(() => new Promise(resolve =>
        setTimeout(() => resolve('hello'), 10)));
      const derived = createMemo(() => data().toUpperCase());
      return ssrElement('p', {}, () => derived());
    }
  });
}

await provideRequestEvent({ request: new Request('http://localhost/'), locals: {} }, async () => {
  const template = await frame();
  const render = process.argv.includes('--stream') ? renderToStream : renderServerComponent;
  const errors = [];
  const result = await render(template, { onError: error => errors.push(error.message) });
  console.log(JSON.stringify({ errors, result }, null, 2));
});
```

Run:

```sh
node repro.mjs
node repro.mjs --stream
```

Each run takes approximately 110 seconds because it waits for 10,000 successive 10 ms promises. The `"use server"` directive is illustrative here; the returned template is passed directly to the public renderer without a compiler or RPC transform.

## Smaller reproduction

The second memo, 10 ms delay, request context, server-function declaration, and error boundary are unnecessary. An already microtask-resolving promise still fails:

```js
import { createMemo, Loading } from 'solid-js';
import { ssrElement } from '@solidjs/web';
import { renderServerComponent } from '@solidjs/web/frames';

const errors = [];
const result = await renderServerComponent(() => Loading({
  fallback: 'Loading',
  children: () => {
    const data = createMemo(() => Promise.resolve('hello'));
    return ssrElement('p', {}, () => data());
  }
}), { onError: error => errors.push(error.message) });
console.log(JSON.stringify({ errors, result }, null, 2));
```

Run `node minimal.mjs`; it reaches the error in roughly 100 ms.

## Expected

The finite async child renders `<p>HELLO</p>` after its promise settles. If allocating async memos in a returned content function cannot be supported, document that restriction and the required getter/separate-read form.

## Actual

`onError` receives:

```text
<Loading> boundary discovery did not converge after 10001 passes — an async source produces a new pending answer on every retry. Ensure repeated reads settle (e.g. return a stable promise or value for the same question).
```

The frame stream ends with an error chunk and no desired paragraph. Awaited ordinary `renderToStream` reports the same error and yields an empty string in this test. The default production frame error payload is sanitized; the full discovery error above is observed through `onError`.

## Reduction checks

| Shape/change | Frame result |
| --- | --- |
| Nested async memo + synchronous derived memo, immediate read in returned content function | Fails after 10,001 passes |
| Remove derived memo | Still fails; one async memo is enough |
| Replace timer promise with `Promise.resolve('hello')` | Still fails |
| Replace async memo answer with a synchronous string | Converges |
| Return the same promise from every recreated memo | Converges |
| Build content from `get children() { ... }` rather than return the setup function as content | Converges |
| Use `ssrElement('p', {}, [() => derived()])`, keeping the read as a separate function | Converges |
| Create loader outside `Loading`, synchronous derived memo inside | Converges |

Removing `Loading` removes this particular boundary-budget error, but the same deferred setup function still creates fresh pending memos: neither renderer completed within a 100 ms observation window (eight setup calls), after which the render was aborted. That limited check is not a claim about every root-without-boundary shape.

## Cause and source locations

Paths below are within the installed packages, default server build.

- `@solidjs/web/frames/dist/server.js:810` defines `renderServerComponent`; lines 816–819 install frame commits and live holes. **Line 848 calls ordinary `renderToStream`. There is no separate 10,001-pass loop in the frames module.**
- `@solidjs/web/dist/server.js:3182` calls an `ssrElement` function child eagerly. The pending read therefore escapes the child factory before it returns markup.
- `@solidjs/web/dist/server.js:2401` (`buildAsyncWrap`) preserves that whole factory as the retry function; line 2418 restores its owner but does not retain its local memo instances.
- `solid-js/dist/server.js:2207` starts discovery and counts the first pass at line 2212. In this reproduction the pending function is captured in the returned template's `p`/`h` arrays, so **the relevant loop is lines 2296–2302**: await pending promises, increment the pass counter, and render those function holes again. A pass is an initial discovery attempt or one subsequent wait-and-retry, not a frame chunk or a timer tick.
- `solid-js/dist/server.js:2195` (`resolveIn`) saves the increased child-owner count at line 2202 and reuses it on the next flattened retry. Re-entering the factory therefore allocates fresh memo IDs. A diagnostic run observed `00010`, `00011`, `00012`, …, `0001B7ps` on calls 1, 2, 3, …, 10,001.
- `solid-js/dist/server.js:717` checks the settled-answer cache by memo ID. The new IDs cannot reuse earlier settled slots. Every new promise is pending when immediately read, even when it is `Promise.resolve` of a constant. The loop never reaches an empty pending list.
- `solid-js/dist/server.js:2287` throws once the count exceeds 10,000. The other retry loop, lines 2289–2293, reruns complete discovery and resets owner counts; the children-getter control takes that path and converges.

The narrow cause is retrying a function that both creates and immediately consumes a fresh async memo. This evidence does not support a general ban on memos below `Loading`, or a frames-only defect.
