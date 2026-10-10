import { createComputed, createSignal } from "solid-js";

export function App() {
  const [count, setCount] = createSignal(0);
  createComputed(() => console.log(count()));
  return <button onClick={() => setCount(cuont() + 1)}>{count()}</button>;
}
