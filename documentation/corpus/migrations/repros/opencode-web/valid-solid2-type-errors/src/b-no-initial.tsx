import { createSignal } from "solid-js";
// createSignal<T>() with no initial value (T | undefined), valid Solid 2.
export function B() {
  const [draft, setDraft] = createSignal<string>();
  return <input value={draft() ?? ""} onInput={(e) => setDraft(e.currentTarget.value)} />;
}
