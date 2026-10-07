import { createSignal } from "solid-js";
export function AsyncReads() {
  const [count, setCount] = createSignal(0);
  async function load() {
    const before = count();
    await Promise.resolve();
    return before + count() + 1;
  }
  return <button onClick={async () => setCount(await load())}>{count()}</button>;
}
