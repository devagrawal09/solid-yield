import { createSignal, createMemo, Loading } from "solid-js";
export function App() {
  const [key] = createSignal("artwork");
  const read = createMemo(() => Promise.resolve("ready"));
  return <Loading on={key()} fallback={<p>wait</p>}><p>{read()}</p></Loading>;
}
