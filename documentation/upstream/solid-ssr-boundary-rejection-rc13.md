# [2.0.0-rc.13] renderToString returns the Loading fallback before an async rejection

Status: **draft, not filed; narrowed to renderToString only** (2026-10-07).
This is a contract question, not a demonstrated async boundary defect: the
installed implementation is synchronous. Dev decides whether to file.

## Summary

An async memo created inside `Errored` rejects after 10 ms while its child
`Loading` is pending. `renderToString` returns `Loading article…` immediately,
with zero calls to the outer error fallback. Awaiting its result does not wait
for the rejection: its return value is already a string. Development and
production, with and without `markSafeError`, give the same result.

## Repro

Install `solid-js@2.0.0-rc.13` and `@solidjs/web@2.0.0-rc.13`. Save as
`repro.mjs`; run these four commands:

```sh
node repro.mjs
node repro.mjs safe
node --conditions=development repro.mjs
node --conditions=development repro.mjs safe
```

```js
import { createMemo, Errored, Loading } from "solid-js";
import { renderToString, ssrElement, markSafeError } from "@solidjs/web";

class NotFound extends Error { kind = "not-found"; }
let calls = 0;
let rejected = false;
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
          rejected = true;
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
const html = renderToString(App);
console.log({ type: typeof html, rejected, calls,
  fallback: html.includes('class="not-found"'), html });
```

## Expected / actual

The expectation under review was that a non-streaming render waits for all
async work and then contains the outer `Errored` fallback. If that contract
applies, the result should contain `not-found: No article: missing` when safe.

Actual in all four runs: `type: "string", rejected: false, calls: 0,
fallback: false`. The markup starts with `Loading article…`; it records the
pending boundary's fallback, with no error payload. The implementation instead
supports a synchronous, fallback-only contract. Please confirm that contract
before treating this observation as a bug.

## Cause

In the installed `@solidjs/web` bundles:

- `dist/server.js:1547` resolves the synchronous tree via `resolveSSRSync`;
  `:1552–1553` closes serialization, `:1563` returns the document and
  `:1567` disposes the root immediately.
- `dist/server.dev.js:1812` follows the same synchronous resolution path;
  `:1817–1818` closes serialization, `:1828` returns and `:1832` disposes.
- `dist/server.js:1506–1508` explicitly refuses serialization of async values.

No async wait exists in this renderer. Marking the error safe cannot change
when the renderer returns.

## Versions

`solid-js` and `@solidjs/web`: **2.0.0-rc.13**; Node **v24.18.0**;
macOS arm64. Both production (default Node exports) and development
(`--conditions=development`) tested on 2026-10-07. No newer version tested.
