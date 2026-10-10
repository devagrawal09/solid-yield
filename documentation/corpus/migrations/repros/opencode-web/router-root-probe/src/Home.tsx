import { createSignal, For } from "solid-js";

export function Home() {
  const [ids] = createSignal(["a", "b"]);
  return <For each={ids()}>{(id) => <a href={`/session/${id}`}>{id}</a>}</For>;
}
