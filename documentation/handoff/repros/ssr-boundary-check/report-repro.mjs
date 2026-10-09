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