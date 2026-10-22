// Reduced from ui/src/components/select-picker-view.tsx:137; ui/src/lib/reactive/context.ts:25–29 @09e09dcdf71
// Intentional untracking does not promise failure-free setup — control. See README.md and D-131 for the frozen scope.
import { createSignal, untrack } from "solid-js";
import { render } from "@solidjs/web";
function App() {
  const [value] = createSignal("x");
  const sample = () => { const text = value(); if (text) throw new Error("bad"); return text; };
  let initial = "";
  try { initial = untrack(sample); } catch {}
  return <p>{initial}</p>;
}

render(App, document.body);
