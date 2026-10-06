import { For, onCleanup } from "solid-js";
import { h } from "conformance";
export let setItems;
export function App() {
  const [items, si] = h.signal("items", [
    { id: 1, label: "a" },
    { id: 2, label: "b" }
  ]);
  setItems = si;
  return (
    <ul>
      <For each={items()}>
        {c => {
          h.run("setup " + c.label);
          const [open, setOpen] = h.signal("open " + c.label, true);
          onCleanup(() => h.run("cleanup " + c.label));
          const toggle = () => {
            h.run("toggle " + c.label);
            setOpen(!open());
          };
          // The view: rendered where the row is inserted, like a component's.
          return (
            <li class={"row r" + c.id} onClick={toggle}>
              {c.label}={open() ? "open" : "closed"}
            </li>
          );
        }}
      </For>
    </ul>
  );
}
