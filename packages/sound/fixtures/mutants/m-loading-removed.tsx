import { createSignal, createMemo, createStore, isPending, Errored, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const m = createMemo(async () => {
    const twice = (x: number) => { return x * 2; };
    return twice(1);
  });
  return <p>{m()}</p>;
}
render(App, document.body);
