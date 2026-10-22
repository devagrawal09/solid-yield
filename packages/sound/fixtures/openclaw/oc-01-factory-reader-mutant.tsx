// Reduced from ui/src/lib/reactive/i18n.ts:26–43; ui/src/app/app-root.tsx:96–110 @09e09dcdf71
// Setup-invoked service factory returns a live reader — mutant. See README.md and D-131 for the frozen scope.
import { createSignal } from "solid-js";
import { render } from "@solidjs/web";
function makeLabels() {
  const [count] = createSignal(1);
  return { label: () => `Rows: ${count()}` };
}
function App() {
  const service = makeLabels();
  const text = service.label();
  return <p>{text}</p>;
}

render(App, document.body);
