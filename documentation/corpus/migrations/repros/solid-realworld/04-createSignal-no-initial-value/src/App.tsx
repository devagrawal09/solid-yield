import { createSignal } from "solid-js";

export function App() {
  // Solid 2 rc.13 declares `createSignal<T>(): Signal<T | undefined>`.
  const [name, setName] = createSignal<string>();
  return <button onClick={() => setName("x")}>{name() ?? "none"}</button>;
}
