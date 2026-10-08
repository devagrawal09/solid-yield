import { createSignal } from "solid-js";
export function Counter() {
  const [count] = createSignal(0);
  const label = <p>{count()}</p>;
  return <div>{label}</div>;
}
