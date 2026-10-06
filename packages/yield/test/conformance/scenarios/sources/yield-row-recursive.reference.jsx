import { For, Show } from "solid-js";
import { h } from "conformance";
const tree = [
  { id: 1, label: "a", kids: [{ id: 2, label: "a1", kids: [{ id: 3, label: "a1x", kids: [] }] }] },
  { id: 4, label: "b", kids: [] }
];
export function App() {
  const node = n => {
    const [open, setOpen] = h.signal("open " + n.label, true);
    const toggle = () => setOpen(!open());
    return (
      <li class={"n" + n.id}>
        <span>{n.label}</span>
        <Show when={n.kids.length}>
          <a class={"t" + n.id} onClick={toggle}>
            {open() ? "[-]" : "[+]"}
          </a>
          <ul style={{ display: open() ? "block" : "none" }}>
            <For each={n.kids}>{node}</For>
          </ul>
        </Show>
      </li>
    );
  };
  return (
    <ul class="tree">
      <For each={tree}>{node}</For>
    </ul>
  );
}
