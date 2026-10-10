import { createEffect, createSignal } from "solid-js";
// A named plain function passed as the effect phase.
function applyTitle(title: string) {
  document.title = title;
}
export function NamedEffect() {
  const [title, setTitle] = createSignal("a");
  createEffect(() => title(), applyTitle);
  return <button onClick={() => setTitle(title() + "a")}>{title()}</button>;
}
