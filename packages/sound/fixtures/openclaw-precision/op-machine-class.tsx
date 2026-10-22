import { createEffect, createMemo } from "solid-js";
export function App() {
  const pending = createMemo(() => Promise.resolve("ready"));
  class Machine {
    start() { return "started"; }
    subscribe(listener: (value: string) => void) { listener("open"); return () => {}; }
  }
  const service = new Machine();
  createEffect(() => 0, () => {
    service.subscribe(() => {});
    service.start();
  });
  return <p>machine</p>;
}
