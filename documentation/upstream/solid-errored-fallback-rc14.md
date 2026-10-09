# [2.0.0-rc.14] A separate isPending reader hides an async memo rejection from Errored

Status: **filed 2026-10-09 as solidjs/solid#3957** (drafted 2026-10-08).

## Summary

A client memo first returns an empty array, then an async iterable whose next()
rejects. Beneath Errored, one render reader displays latest(data).length and a
separate render reader observes isPending(data). On rc.13 the rejection renders
the error fallback once. On rc.14 the DOM stays at 0 and the fallback is never
called. Removing the isPending reader makes rc.14 render the error correctly.

The reproduction uses only public Solid APIs and jsdom. No JSX, compiler,
router, Effect package, Show, Loading, hydration or SSR is involved. A promise
in place of the async iterable also reproduced the failure in the reduction.

## Reproduction

In a fresh directory, install one version pair:

```sh
npm install --save-exact solid-js@2.0.0-rc.13 @solidjs/web@2.0.0-rc.13 jsdom@25.0.1
# Then repeat in a separate directory with both Solid packages at rc.14.
node --conditions=browser repro.mjs
node --conditions=browser --conditions=development repro.mjs
```

Save this exact tested source as repro.mjs:

```js
import { JSDOM } from 'jsdom';
const { window } = new JSDOM('<div id="app"></div>');
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement'])
  globalThis[key] = window[key];
const { createMemo, createSignal, createRenderEffect, Errored,
  latest, isPending, flush } = await import('solid-js');
const { render, insert } = await import('@solidjs/web');
let start, reject, fallbackCalls = 0;
const root = document.getElementById('app');
const dispose = render(() => {
  const [running, setRunning] = createSignal(false);
  start = setRunning;
  const data = createMemo(() => running() ? {
    [Symbol.asyncIterator]() {
      return {
        next: () => new Promise((_, fail) => { reject = fail; }),
        return: async () => ({ done: true })
      };
    }
  } : []);
  return Errored({
    fallback: error => { fallbackCalls++; return 'ERROR: ' + error().message; },
    get children() {
      const p = document.createElement('p');
      insert(p, () => latest(data).length);
      createRenderEffect(() => isPending(data),
        pending => { p.dataset.pending = String(pending); });
      return p;
    }
  });
}, root);
start(true);
flush();
reject(new Error('Search failed'));
await new Promise(resolve => setTimeout(resolve, 10));
flush();
console.log(JSON.stringify({ text: root.textContent, fallbackCalls }));
dispose();
window.close();
```

## Expected / actual

**Expected:** the rejected memo reaches Errored and displays ERROR: Search
failed. isPending is only another observer; it must not suppress another
reader's error. This is the rc.13 behavior and the rc.14 behavior with that
observer removed.

**Actual:** rc.14 displays the previous value's length, 0, and never invokes
the fallback. The promise rejection is consumed; the process exits normally.

| Version | Conditions | Output |
| --- | --- | --- |
| rc.13 | browser / production | {"text":"ERROR: Search failed","fallbackCalls":1} |
| rc.13 | browser + development | {"text":"ERROR: Search failed","fallbackCalls":1} |
| rc.14 | browser / production | {"text":"0","fallbackCalls":0} |
| rc.14 | browser + development | {"text":"0","fallbackCalls":0} |

The same source was run against separate package trees for each version,
linked to the retained published packages. No runtime patch was present in
these four runs. Remove the createRenderEffect call that observes isPending
for a control: both versions render the error. Combining the two reads into
one render-effect compute also allowed rc.14's fallback in a larger reduction.

## Cause and source comparison

Paths and lines below refer to the published development dist files.

- solid-js/dist/solid.dev.js:1536 (rc.13) and :1488 (rc.14): Errored's wrapper
  is byte-identical. It delegates to createErrorBoundary and invokes the
  supplied fallback. @solidjs/web re-exports it from solid-js; there is no
  changed web-specific Errored implementation.
- @solidjs/signals/dist/dev.js:10124 (rc.13) calls createCollectionBoundary;
  :8798 (rc.14) calls the new createBoundary. The boundary implementation
  changed, but this does not by itself locate the lost error.
- rc.13's latest path goes through latestRead (:1435) and its shadow memo
  (getLatestValueComputed, :1382). rc.14 replaces it with verdictValue
  (:1155); latest and isPending install that same read dispatcher (:1086,
  :1099).
- rc.14 verdictValue checks CONFIG_HELD at :1205 and returns the committed
  value before its STATUS_ERROR throw at :1270. The held-value returns are
  :1223 and :1234. Its own comment at :1154 says an errored derivation throws
  for every reader, which this path fails to do.

**Verified cause in this reproduction:** a diagnostic copy of rc.14 logged
this memo during the latest read with STATUS_ERROR (flags 2), CONFIG_HELD set,
error message Search failed and committed value []. The held branch returns
that array without reaching the error check. A scratch-only guard that checks
STATUS_ERROR for a non-probing read before the held branch restores
{"text":"ERROR: Search failed","fallbackCalls":1}. The installed packages
were left unchanged. This isolates the error-check ordering; it is not a
proposed complete fix for the scheduler's other cases.

## Release-note check and classification

Neither the installed solid-js package nor its files include a release
changelog. The published [Solid rc.14 release](https://github.com/solidjs/solid/releases/tag/solid-js%402.0.0-rc.14)
and [signals rc.14 release](https://github.com/solidjs/solid/releases/tag/%40solidjs%2Fsignals%402.0.0-rc.14)
were checked. They describe changes to held reads, latest/isPending and
boundary timing; I found no declared change allowing an async rejection to
skip Errored's fallback. Together with the stated error-read rule, the A/B
result and the diagnostic guard, this is a **client regression**, rather than
a demonstrated intentional change in error handling.

## Versions

- solid-js and @solidjs/web: 2.0.0-rc.13 versus 2.0.0-rc.14.
- @solidjs/signals: corresponding rc.13 / rc.14, resolved through solid-js.
- jsdom: 25.0.1; Node: v24.18.0; macOS arm64.
- Both production and development browser conditions tested.
- No issue was filed and no maintainer confirmation is claimed.
