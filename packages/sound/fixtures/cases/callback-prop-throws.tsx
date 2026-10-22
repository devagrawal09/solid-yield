import { createSignal } from "solid-js";
function Child(props: { onBump: () => void }) {
  return <button onClick={() => props.onBump()}>+</button>;
}
export function App() {
  const [n, setN] = createSignal(0);
  return <Child onBump={() => { if (n() > 3) throw new RangeError("big"); setN(n() + 1); }} />;
}