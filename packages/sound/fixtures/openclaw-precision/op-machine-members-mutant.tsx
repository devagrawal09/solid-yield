import { createEffect, createMemo } from "solid-js";
export function App() {
  const read = createMemo(() => Promise.resolve("open"));
  const context = { get: (_key: string) => read() };
  const state = { hasTag: (tag: string) => tag === "open" };
  const computed = (name: string) => name === "placement" ? "bottom-start" : "";
  createEffect(() => 0, () => {
    context.get("layer");
    state.hasTag("open");
    computed("placement").split("-")[0];
  });
  return <p>machine</p>;
}
