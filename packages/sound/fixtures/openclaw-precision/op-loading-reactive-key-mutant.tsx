import { createSignal, createMemo, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [key] = createSignal("artwork");
  const read = createMemo(() => Promise.resolve("ready"));
  return <><Loading on={key()} fallback={<p>wait</p>}>{null}</Loading><p>{read()}</p></>;
}
render(() => <App />, document.body);
