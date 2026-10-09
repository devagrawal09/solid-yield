import { createMemo, Errored, Loading } from "solid-js";
import { renderToString, renderToStream, ssrElement, markSafeError } from "@solidjs/web";

class NotFound extends Error { kind = "not-found"; }
const mode = process.argv[2] ?? "stream";
const placement = process.argv[3] ?? "inside";
const error = () => process.argv.includes("safe") ? markSafeError(new NotFound("No article: missing")) : new NotFound("No article: missing");
let fallbackCalls = 0;
let fallbackError;
function App() {
  let answer;
  const memo = () => createMemo(() => mode === "sync"
    ? (() => { throw error(); })()
    : new Promise((_, reject) => setTimeout(() => reject(error()), 10)));
  if (placement === "outside") answer = memo();
  return Errored({
    fallback: err => {
      fallbackCalls++;
      fallbackError = { name: err().constructor.name, kind: err().kind, message: err().message };
      return ssrElement("p", { class: "not-found" }, `${err().kind}: ${err().message}`, true);
    },
    get children() {
      answer ??= memo();
      return Loading({ fallback: "Loading article…", get children() { return answer(); } });
    }
  });
}
const html = mode === "string" ? renderToString(App) : String(await renderToStream(App));
console.log(JSON.stringify({ mode, placement, fallbackCalls, fallbackError, hasFallback: html.includes('class="not-found"'), sanitized: html.includes("Internal Server Error"), html }, null, 2));
