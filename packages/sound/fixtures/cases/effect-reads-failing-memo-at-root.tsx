import { createSignal, createMemo, createEffect } from "solid-js";
import { render } from "@solidjs/web";
function App() {
  const [n] = createSignal(1);
  const checked = createMemo(() => {
    if (n() > 5) throw new RangeError("big");
    return n();
  });
  createEffect(
    () => checked(),
    v => console.log(v)
  );
  return <p>{n()}</p>;
}
render(() => <App />, document.body);