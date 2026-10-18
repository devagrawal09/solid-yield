import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { lowerNativeProject } from "../src/native.js";

const id = resolve(import.meta.dirname, "fixtures/typed-context-consumer.tsx");
describe("native typed context regressions", { timeout: 30_000 }, () => {
  it("preserves authored context interfaces with known factory values", () => {
    const out = lowerNativeProject(
      new Map([
        [
          id,
          `import { createContext, createSignal, useContext } from "solid-js";
      interface Counter { count: () => number; inc: () => void; }
      function makeCounter() { const [count, set] = createSignal(0);
        return { count, inc: () => { set(count() + 1); } }; }
      const Counter = createContext<Counter>();
      function Button() { const c = useContext(Counter)!;
        return <button onClick={() => c.inc()}>{c.count()}</button>; }
      export function App() { return <Counter value={makeCounter()}><Button/></Counter>; }`
        ]
      ])
    ).files.get(id);
    expect(out).toContain("yield* c.inc()");
    expect(out).toContain("yield* c.count");
  });
});
