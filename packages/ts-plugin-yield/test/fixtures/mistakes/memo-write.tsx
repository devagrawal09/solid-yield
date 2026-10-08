import { createSignal, createMemo } from "solid-js";
export function Counter() {
  const [count, setCount] = createSignal(0);
  const twice = createMemo(() => {
    setCount(1);
    return count() * 2;
  });
  return <p>{twice()}</p>;
}
