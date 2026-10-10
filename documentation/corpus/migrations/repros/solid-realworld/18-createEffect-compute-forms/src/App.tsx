import { createEffect, createSignal } from "solid-js";

export function App() {
  const [token, setToken] = createSignal<string | undefined>("t");
  const [tab, setTab] = createSignal("all");
  // A signal getter passed directly as the compute phase.
  createEffect(token, value => {
    value ? localStorage.setItem("jwt", value) : localStorage.removeItem("jwt");
  });
  return (
    <button onClick={() => (setToken(undefined), setTab("x"))}>
      {token()} {tab()}
    </button>
  );
}
