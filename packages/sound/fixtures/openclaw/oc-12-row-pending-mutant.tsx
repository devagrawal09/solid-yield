// D-131 reduction/control for mining gap 12. See origins.mjs.
import { createMemo, For, Loading } from "solid-js";
import { render } from "@solidjs/web";
function App() {
  const read = createMemo(() => Promise.resolve("ready"));
  return <Loading><For each={[1]} keyed={id => id}>{() => {
    const initial = read();
    return <p>{initial}</p>;
  }}</For></Loading>;
}
render(App, document.body);
