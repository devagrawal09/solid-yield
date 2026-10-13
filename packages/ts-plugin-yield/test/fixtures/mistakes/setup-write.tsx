import { createSignal } from "solid-js";
export function App() {
  const [n, setN] = createSignal(1);
  setN(2);
  return <p>{n()}</p>;
}
