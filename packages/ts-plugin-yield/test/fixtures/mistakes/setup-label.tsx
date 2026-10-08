import { createSignal } from "solid-js";
export function TodoLabel() {
  const [title] = createSignal("buy milk");
  const prefix = "Todo: ";
  const text = prefix + title();
  return <label>{text}</label>;
}
