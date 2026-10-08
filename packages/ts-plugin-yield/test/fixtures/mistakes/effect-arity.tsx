import { createSignal, createEffect } from "solid-js";
export function Counter() {
  const [count] = createSignal(0);
  createEffect(() => count());
  return <p>{count()}</p>;
}
