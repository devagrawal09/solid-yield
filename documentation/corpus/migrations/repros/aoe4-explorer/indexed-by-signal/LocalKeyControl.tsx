import { createMemo, createSignal, For } from "solid-js";
export function LocalKeyControl() {
  const [view, setView] = createSignal<"a" | "b">("a");
  const data = createMemo(() => ({ a: ["x", "y"], b: ["z"] }));
  const items = () => {
    const key = view();
    return data()?.[key] ?? [];
  };
  return (
    <div>
      <button onClick={() => setView(view() === "a" ? "b" : "a")}>switch</button>
      <For each={items()}>{(item) => <span>{item}</span>}</For>
    </div>
  );
}
