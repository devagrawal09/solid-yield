import { createSignal } from "solid-js";
export function TodoStatus() {
  const [done] = createSignal(false);
  const label = done() ? "done" : "open";
  return <span>{label}</span>;
}
