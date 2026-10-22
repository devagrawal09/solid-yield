import { createSignal, createMemo, createEffect, createStore, untrack, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const items = createMemo(async () => [1, 2, 3]);
  const total = createMemo(() =>
    items().reduce((a, x) => {
      if (x < 0) throw new RangeError("negative");
      return a + x;
    }, 0)
  );
  return <Loading fallback={<p>…</p>}><p>{total()}</p></Loading>;
}
render(App, document.body);