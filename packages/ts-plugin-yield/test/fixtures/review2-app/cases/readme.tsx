import { createMemo, createSignal } from "solid-js";
import { render } from "@solidjs/web";
async function loadCount() {
  return 42;
}
function App() {
  const [count, setCount] = createSignal(0);
  const remote = createMemo(() => loadCount());
  return (
    <button onClick={() => setCount(count() + 1)}>
      {count()} / {remote()}
    </button>
  );
}
render(() => <App />, document.body);
