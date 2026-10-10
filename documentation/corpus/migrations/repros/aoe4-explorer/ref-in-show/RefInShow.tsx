import { createSignal, Show } from "solid-js";
export function P10() {
  const [on] = createSignal(true);
  let el: HTMLDivElement | undefined;
  return (
    <Show when={on()}>
      <div ref={el}>x</div>
    </Show>
  );
}
