import { createSignal } from "solid-js";
export function Counter() {
  const [count, setCount] = createSignal(0);
  const add = () => {
    const [step] = createSignal(1);
    setCount(count() + step());
  };
  return <button onClick={add}>{count()}</button>;
}
