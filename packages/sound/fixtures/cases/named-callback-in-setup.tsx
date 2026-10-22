import { createSignal } from "solid-js";
export function App() {
  const [n] = createSignal(2);
  const scale = (x: number) => x * n();
  const doubled = [1, 2].map(scale);
  return <p>{doubled.join()}</p>;
}