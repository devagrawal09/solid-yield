import { createSignal } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  const [out, setOut] = createSignal(0);
  Promise.resolve(2).then(v => setOut(v + n())).catch(() => {});
  return <p>{out()}</p>;
}