import { For } from "solid-js";
const THEMES = ["light", "dark"] as const;
// Default (keyed) <For>: the row receives the item value; calling a string method on it.
export function C() {
  return <For each={THEMES}>{(t) => <option value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>}</For>;
}
