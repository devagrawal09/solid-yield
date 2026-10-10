import { createSignal } from "solid-js";

declare function createVirtualizer(o: { count: number; estimateSize: () => number }): { getTotalSize(): number };

// @tanstack/solid-virtual's documented usage: a reactive getter in the options object.
export function List() {
  const [items] = createSignal(["a", "b", "c"]);
  const v = createVirtualizer({
    get count() {
      return items().length;
    },
    estimateSize: () => 20,
  });
  return <div style={{ height: `${v.getTotalSize()}px` }} />;
}
