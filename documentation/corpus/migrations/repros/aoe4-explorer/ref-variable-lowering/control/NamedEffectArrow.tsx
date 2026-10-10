import { createEffect, createSignal } from "solid-js";
// A named plain function passed as the effect phase.
function applyTitle(title: string) {
  document.title = title;
}
export function NamedEffectControl() {
  const [title, setTitle] = createSignal("a");
  createEffect(() => title(), (t) => {
    applyTitle(t);
  });
  return <button onClick={() => setTitle(title() + "a")}>{title()}</button>;
}
