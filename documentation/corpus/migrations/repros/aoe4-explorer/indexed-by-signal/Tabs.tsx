import { createMemo, createSignal, For } from "solid-js";
// A memo's value indexed by another signal: data()?.[view()]
export function Tabs() {
  const [view, setView] = createSignal<"a" | "b">("a");
  const data = createMemo(() => ({ a: ["x", "y"], b: ["z"] }));
  return (
    <div>
      <button onClick={() => setView(view() === "a" ? "b" : "a")}>switch</button>
      <For each={data()?.[view()] ?? []}>{(item) => <span>{item}</span>}</For>
    </div>
  );
}
