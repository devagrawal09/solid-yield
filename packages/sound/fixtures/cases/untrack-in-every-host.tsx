import { createSignal, createMemo, createEffect, createStore, untrack, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [a, setA] = createSignal(1);
  const [b] = createSignal(2);
  const once = untrack(() => a() + 1);
  const m = createMemo(() => a() + untrack(() => b()));
  createEffect(() => untrack(() => b()), v => console.log(v));
  return <p title={String(untrack(() => b()))} onClick={() => setA(untrack(() => a()) + 1)}>{m()}{once}{untrack(() => a())}</p>;
}