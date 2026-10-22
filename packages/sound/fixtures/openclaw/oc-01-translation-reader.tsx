// Reduced from i18n.ts:26–43 and context.ts:16–29 @09e09dcdf71; gap 01.
import { createSignal } from "solid-js";
import { render } from "@solidjs/web";
function makeLabels() {
  const [language] = createSignal("en");
  const [count] = createSignal(1);
  const translate = () => language() === "en" ? "Rows" : "Zeilen";
  return { get: () => `${translate()}: ${count()}` };
}
function App() {
  const service = makeLabels();
  return <p>{service.get()}</p>;
}
render(App, document.body);
