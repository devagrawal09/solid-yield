# [2.0.0-rc.13] Streamed async rejection under Loading bypasses the outer Errored fallback

Status: **draft, not filed**.

## Summary

An async memo created inside `Errored` rejects while its child `Loading` is
pending. Completed `renderToStream` output has no error fallback; production
output serializes `Error("Internal Server Error")`. No router, loader, JSX
compiler or other library is involved. `Errored` is rc.13's error boundary.

## Repro

Install `solid-js@2.0.0-rc.13` and `@solidjs/web@2.0.0-rc.13`. Save as
`repro.mjs`; run `node repro.mjs`, then `node repro.mjs safe`.

```js
import { createMemo, Errored, Loading } from "solid-js";
import { renderToStream, ssrElement, markSafeError } from "@solidjs/web";

class NotFound extends Error { kind = "not-found"; }
let calls = 0;
function App() {
  let answer;
  return Errored({
    fallback: err => {
      calls++;
      return ssrElement("p", { class: "not-found" },
        `${err().kind}: ${err().message}`, true);
    },
    get children() {
      answer ??= createMemo(() => new Promise((_, reject) => {
        setTimeout(() => {
          const error = new NotFound("No article: missing");
          reject(process.argv.includes("safe") ? markSafeError(error) : error);
        }, 10);
      }));
      return Loading({
        fallback: "Loading article…",
        get children() { return answer(); }
      });
    }
  });
}
const html = String(await renderToStream(App));
console.log({ calls, fallback: html.includes('class="not-found"'),
  sanitized: html.includes("Internal Server Error") });
```

## Expected / actual

Expected: the outer error fallback appears in completed server output. With
`markSafeError`, it shows `not-found: No article: missing`.

Actual: `{ calls: 0, fallback: false, sanitized: true }`. With `safe`, the
message and kind survive serialization, but `calls: 0` and `fallback: false`
remain. Thus disabling sanitization does not restore the server fallback.

Controls run separately: moving the memo outside `Errored` gives the same
async result; replacing the async rejection with a synchronous throw inside
`Errored` calls the fallback once. `renderToString` returns `Loading article…`
without waiting, as expected; it is not an async rejection test.
`node --conditions=development` also skips the error fallback and reports
`[SSR_RENDER_ERROR_CONTAINED]`; its default error policy preserves the message.
This repro checks server output, not hydration.

## Cause

In the installed production bundles:

- `solid-js/dist/server.js:2133`: `runLoadingPhase` sends a retry's error to
  `done(undefined, err)` once a fragment exists (`:2137–2144`), bypassing
  `parentHandler` (`:2146`). `finalizeError` returns for that handled error
  (`:2153–2157`). `done` was registered at `:2270`.
- `@solidjs/web/dist/server.js:2054` and `:2095`: fragment rejection is
  sanitized for serialization / client handling.
- `solid-js/dist/server.js:1641`: an unmarked error becomes
  `Error("Internal Server Error")`. Sanitization is separate from the missing
  fallback, as the `markSafeError` control shows.

The current path explicitly hands the failure to the client. Is skipping the
outer server error fallback intended, or should this boundary shape render it?

## Versions

`solid-js` and `@solidjs/web`: **2.0.0-rc.13**; Node **v24.18.0**;
macOS arm64. Production and development server builds tested. No newer Solid
version tested.
