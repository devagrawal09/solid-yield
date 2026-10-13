import { createSignal, Show } from "solid-js";
export function Banner() {
  const [count, setCount] = createSignal(1);
  return (
    <Show when={(setCount(2), count() > 0)}>
      <p>shown</p>
    </Show>
  );
}
