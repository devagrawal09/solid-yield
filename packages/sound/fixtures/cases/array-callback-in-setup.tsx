import { createSignal, createMemo, createEffect, createStore, untrack, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [n] = createSignal(1);
  const [items] = createSignal([1, 2, 3]);
  const big = items().filter(x => x > n());
  return <p>{big.join()}</p>;
}