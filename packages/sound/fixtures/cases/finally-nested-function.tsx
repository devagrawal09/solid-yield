import { createSignal, createMemo, createStore, isPending, Errored, Loading } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [n] = createSignal(1);
  const m = createMemo(() => {
    let out = 0;
    try { out = JSON.parse(String(n())) as number; } catch { /* @yield-absorb: a number parses */ out = -1; } finally { const log = () => { return out; }; log(); }
    return out;
  });
  return <p>{m()}</p>;
}