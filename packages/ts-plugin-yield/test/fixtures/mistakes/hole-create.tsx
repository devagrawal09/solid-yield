import { createSignal } from "solid-js";
export function Counter() {
  return <p>{createSignal(1)[0]()}</p>;
}
