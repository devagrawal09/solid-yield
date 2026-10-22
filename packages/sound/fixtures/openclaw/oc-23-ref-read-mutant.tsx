// D-131 reduction/control for mining gap 23. See origins.mjs.
import { createSignal } from "solid-js";
import { render } from "@solidjs/web";
function App() {
  const [value] = createSignal("ready");
  return <p ref={element => { element.title = value(); }}>{value()}</p>;
}
render(App, document.body);
