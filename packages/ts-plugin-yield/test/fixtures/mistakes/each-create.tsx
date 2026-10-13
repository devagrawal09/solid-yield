import { createMemo, createSignal, For } from "solid-js";
export function Names() {
  const [names] = createSignal(["a", "b"]);
  return (
    <ul>
      <For each={createMemo(() => names().slice())()}>{name => <li>{name}</li>}</For>
    </ul>
  );
}
