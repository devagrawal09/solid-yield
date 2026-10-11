import { createContext, onCleanup, useContext } from "solid-js";

export class NoRuntime extends Error {}
export const Runtime = createContext<{ scale: number } | null>(null);

// Created, cleaned up and possibly failing where the provider computes its value.
export function createRuntime(scale: number) {
  const runtime = { scale };
  onCleanup(() => void runtime);
  if (scale < 0) throw new NoRuntime("negative scale");
  return runtime;
}

// Resolved at the reading computation, as Effect's runEffect resolves its runtime.
export function ticks(n: number): AsyncIterable<number> {
  const runtime = useContext(Runtime);
  return {
    async *[Symbol.asyncIterator]() {
      yield n * (runtime?.scale ?? 1);
    }
  };
}
