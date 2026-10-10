import { createSignal, Loading } from "solid-js";

async function load(id: string) {
  return `item ${id}`;
}

export function App() {
  const [id, setId] = createSignal("a");
  // Solid 2 writable memo: recomputes from id(), can be overwritten locally (createResource + mutate).
  const [item, setItem] = createSignal<string>(() => load(id()));
  return (
    <Loading fallback="loading">
      <button onClick={() => (id() === "a" ? setId("b") : setItem("edited"))}>{item()}</button>
    </Loading>
  );
}
