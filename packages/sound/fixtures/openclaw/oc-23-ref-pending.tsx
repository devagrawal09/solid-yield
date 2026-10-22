// D-131 reduction/control for mining gap 23. See origins.mjs.
import { createMemo, Loading } from "solid-js";
import { render } from "@solidjs/web";
function App() {
  const read = createMemo(() => Promise.resolve("ready"));
  return <Loading><p ref={element => { element.title = "mounted"; }}>{read()}</p></Loading>;
}
render(App, document.body);
