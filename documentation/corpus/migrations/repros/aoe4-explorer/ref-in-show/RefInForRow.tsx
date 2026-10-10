import { createSignal, For } from "solid-js";
export function P9a() {
  const [parts] = createSignal([1, 2]);
  return (
    <div>
      <For each={parts()}>
        {(part) => {
          let partEl: HTMLDivElement | undefined;
          return <div ref={partEl}>{part}</div>;
        }}
      </For>
    </div>
  );
}
