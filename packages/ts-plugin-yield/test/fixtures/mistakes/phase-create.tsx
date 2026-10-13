import { createEffect, createSignal } from "solid-js";
export function Mirror() {
  const [count, setCount] = createSignal(0);
  createEffect(
    () => count(),
    value => {
      const [copy] = createSignal(value);
      console.log(copy());
    }
  );
  return <button onClick={() => setCount(count() + 1)}>{count()}</button>;
}
