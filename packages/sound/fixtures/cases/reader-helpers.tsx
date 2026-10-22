import { createSignal, createMemo, createEffect, createStore, untrack, Loading } from "solid-js";
import { render } from "@solidjs/web";
const scaled = (factor: number) => (count: () => number) => () => count() * factor;
export function App() {
  const [n] = createSignal(1);
  const triple = scaled(3)(n);
  return <p>{triple()}</p>;
}