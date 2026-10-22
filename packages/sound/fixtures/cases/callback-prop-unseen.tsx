import { createSignal } from "solid-js";
function Spread(props: { onBump: () => void }) {
  return <button onClick={() => props.onBump()}>+</button>;
}
function Handed(props: { onBump: () => void }) {
  return <button onClick={() => props.onBump()}>+</button>;
}
export const registry = { Handed };
export function App() {
  const [n, setN] = createSignal(0);
  const rest = { onBump: () => console.log("bump") };
  return <><Spread {...rest} /><Handed onBump={() => setN(n() + 1)} /></>;
}