import { createSignal, onCleanup } from "solid-js";
export function Clock() {
  const [t, setT] = createSignal(0);
  const h = setInterval(() => setT(t() + 1), 1000);
  onCleanup(() => clearInterval(h));
  return <small>tick {t()}</small>;
}
