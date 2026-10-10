import { createSignal, For } from "solid-js";
// A named handler (writes a signal, then calls a prop) invoked from an event in a <For> row.
export function Selector(props: { items: string[]; onChange: (selected: string[]) => void }) {
  const [selected, setSelected] = createSignal<string[]>([]);
  const toggle = (id: string) => {
    const next = selected().includes(id) ? selected().filter((x) => x !== id) : [...selected(), id];
    setSelected(next);
    props.onChange(next);
  };
  return (
    <For each={props.items}>
      {(id) => <button onClick={() => toggle(id)}>{id}</button>}
    </For>
  );
}
