import { createMemo, createEffect } from "solid-js";
export function App() {
  const id = createMemo(async () => 1);
  const name = createMemo(async () => "x");
  createEffect(
    () => id(),
    value => console.log(value, name())
  );
  return <p>x</p>;
}
