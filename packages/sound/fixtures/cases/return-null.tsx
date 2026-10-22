import { createSignal, createMemo, createContext, useContext, Errored } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const [n] = createSignal(1);
  if (Math.random() > 2) return null;
  return <p>{n()}</p>;
}