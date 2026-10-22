import { createSignal, createMemo, createEffect, createStore, untrack, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [n, setN] = createSignal(0);
  return <button onClick={async () => {
    const request = fetch("/x");
    const r = await request;
    setN(r.status);
  }}>{n()}</button>;
}