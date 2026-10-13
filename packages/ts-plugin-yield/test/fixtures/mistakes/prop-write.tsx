import { createSignal } from "solid-js";
function Label(props: { value: number }) {
  return <p>{props.value}</p>;
}
export function Counter() {
  const [count, setCount] = createSignal(1);
  return <Label value={(setCount(2), count())} />;
}
