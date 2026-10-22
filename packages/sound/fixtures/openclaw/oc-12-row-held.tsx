// D-131 reduction/control for mining gap 12. See origins.mjs.
import { For } from "solid-js";
import { render } from "@solidjs/web";
function App() {
  return <For each={[{ label: "plain" }]}>{row => {
    const initial = row.label;
    return <p>{initial}</p>;
  }}</For>;
}
render(App, document.body);
