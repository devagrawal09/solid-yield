import assert from "node:assert/strict";
import { createMemo, Errored, Loading } from "solid-js";
import { markSafeError, renderToString, ssrElement } from "@solidjs/web";

export function checkStringRejection(safe) {
  class NotFound extends Error {
    kind = "not-found";
  }
  let calls = 0;
  let rejected = false;
  function App() {
    let answer;
    return Errored({
      fallback: err => {
        calls++;
        return ssrElement("p", { class: "not-found" }, `${err().kind}: ${err().message}`, true);
      },
      get children() {
        answer ??= createMemo(
          () =>
            new Promise((_, reject) => {
              setTimeout(() => {
                rejected = true;
                const error = new NotFound("No article: missing");
                reject(safe ? markSafeError(error) : error);
              }, 10);
            })
        );
        return Loading({
          fallback: "Loading article…",
          get children() {
            return answer();
          }
        });
      }
    });
  }
  const html = renderToString(App);
  assert.equal(typeof html, "string");
  assert.equal(rejected, false, "renderToString returns before the rejection");
  assert.equal(calls, 0);
  assert.ok(html.startsWith("Loading article…"));
  assert.ok(!html.includes('class="not-found"'));
  return { bytes: html.length, calls, pending: true };
}
