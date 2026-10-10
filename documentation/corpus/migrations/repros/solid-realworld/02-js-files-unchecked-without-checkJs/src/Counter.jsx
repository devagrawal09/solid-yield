import { createSignal } from "solid-js";

export function Counter() {
  const [count, setCount] = createSignal(0);
  const n = count(); // READ_IN_SETUP: the snapshot never updates
  return <button onClick={() => setCount(count() + 1)}>{n}</button>;
}
