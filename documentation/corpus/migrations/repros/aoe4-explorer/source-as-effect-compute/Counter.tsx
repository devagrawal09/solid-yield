import { createEffect, createSignal } from "solid-js";
// A signal passed directly as the effect's compute function.
export function Counter() {
  const [count, setCount] = createSignal(0);
  createEffect(count, (n) => {
    document.title = String(n);
  });
  return <button onClick={() => setCount(count() + 1)}>{count()}</button>;
}
