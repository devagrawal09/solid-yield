import { createSignal } from "solid-js";
export function App() {
  const [n] = createSignal(1);
  return n() > 1 ? <b>big</b> : <i>small</i>;
}