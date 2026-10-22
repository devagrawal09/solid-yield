import { createSignal } from "solid-js";
class Bad extends Error {}
async function risk(): Promise<number> { throw new Bad(); }
export function App() {
  const [n] = createSignal(1);
  const [out, setOut] = createSignal(0);
  risk().then(v => setOut(v + n()));
  return <p>{out()}</p>;
}