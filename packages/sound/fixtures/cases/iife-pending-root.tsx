import { createSignal, createMemo, createEffect, createStore, untrack, Loading } from "solid-js";
import { render } from "@solidjs/web";
function App() {
  const p = createMemo(async () => 1);
  return <p>{(() => p() * 2)()}</p>;
}
render(App, document.body);