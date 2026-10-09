import { createSignal, createMemo } from "solid-js";
export function Counter() {
  const [count, setCount] = createSignal(1);
  const twice = createMemo(() => count() * 2);
  const increment = () => setCount(count() + 1);
  return (
    <button onClick={increment}>{count() > 0 ? () => () => twice().toFixed(0) : () => "0"}</button>
  );
}
