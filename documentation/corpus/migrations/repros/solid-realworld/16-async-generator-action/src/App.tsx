import { action, createSignal } from "solid-js";

async function save(n: number): Promise<number> {
  return n + 1;
}

export function App() {
  const [count, setCount] = createSignal(0);
  // The form Solid's own action() docs show: await for a typed result, then a bare yield
  // to re-enter the transaction before writing.
  const increment = action(async function* (n: number) {
    const next = await save(n);
    yield;
    setCount(next);
  });
  return <button onClick={() => increment(count())}>{count()}</button>;
}
