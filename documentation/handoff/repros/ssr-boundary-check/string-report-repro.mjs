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
