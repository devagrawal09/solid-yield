import { createStore, For } from "solid-js";
import { h } from "conformance";
const comments = [
  { id: 1, text: "a" },
  { id: 2, text: "b" },
  { id: 3, text: "c" }
];
export function App() {
  const [closed, setClosed] = createStore({ 1: false, 2: false, 3: false });
  return (
    <ul>
      <For each={comments}>
        {c => {
          const toggle = () => {
            h.run("toggle " + c.id);
            setClosed(s => {
              s[c.id] = !s[c.id];
            });
          };
          return () => (
            <li class={"c" + c.id} onClick={toggle}>
              {c.text}:{closed[c.id] ? "closed" : "open"}
            </li>
          );
        }}
      </For>
    </ul>
  );
}
