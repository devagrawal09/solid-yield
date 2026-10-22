// D-131 reduction/control for mining gap 12. See origins.mjs.
import { createSignal, For } from "solid-js";
import { render } from "@solidjs/web";
function App() {
  const [rows] = createSignal(["A"]);
  return <For each={rows()} keyed={false}>{row => {
    const initial = row();
    return <p>{initial}</p>;
  }}</For>;
}
render(App, document.body);
