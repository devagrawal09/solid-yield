import { createSignal, Show } from "solid-js";
export function P10b() {
  const [on] = createSignal(true);
  let el: HTMLDivElement | undefined;
  return (
    <Show when={on()}>
      <div ref={(e) => (el = e)}>x</div>
    </Show>
  );
}
