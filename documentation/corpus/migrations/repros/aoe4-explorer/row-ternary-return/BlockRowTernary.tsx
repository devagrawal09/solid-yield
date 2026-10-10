import { For } from "solid-js";
export function P12(props: { items: string[]; tech: boolean }) {
  return (
    <For each={props.items}>
      {(x) => {
        const up = x.toUpperCase();
        return props.tech ? <b>{up}</b> : <i>{up}</i>;
      }}
    </For>
  );
}
