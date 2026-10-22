import { createSignal, createMemo, createEffect, createStore, untrack, Loading } from "solid-js";
import { render } from "@solidjs/web";
import { Errored } from "solid-js";
export function App() {
  const items = createMemo(async () => [1, 2, 3]);
  const total = createMemo(() =>
    items().reduce((a, x) => {
      if (x < 0) throw new RangeError("negative");
      return a + x;
    }, 0)
  );
  return <Loading fallback={<p>…</p>}><p>{total()}{items().map(x => JSON.parse(String(x)) as number).join()}</p></Loading>;
}
render(App, document.body);
