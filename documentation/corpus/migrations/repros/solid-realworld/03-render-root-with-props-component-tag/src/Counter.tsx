import { createSignal } from "solid-js";

export function Counter(props: { label: string }) {
  const [count, setCount] = createSignal(0);
  return <button onClick={() => setCount(count() + 1)}>{props.label} {count()}</button>;
}
