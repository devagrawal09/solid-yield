import { createSignal } from "solid-js";
export function Counter() {
  const [count] = createSignal(0);
  const value = count();
  return <p>{value}</p>;
}
