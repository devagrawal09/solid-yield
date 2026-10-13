import { createSignal } from "solid-js";
export function App() {
  const [text, setText] = createSignal("");
  const attrs = { onClick: async () => setText(await (await fetch("/x")).text()) };
  return <button {...attrs}>{text()}</button>;
}
