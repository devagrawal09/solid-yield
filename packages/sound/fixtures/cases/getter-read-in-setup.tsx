import { createSignal, createMemo, createEffect, createStore, untrack, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [n] = createSignal(1);
  const o = { get double() { return n() * 2; } };
  const once = o.double;
  return <p>{once}</p>;
}