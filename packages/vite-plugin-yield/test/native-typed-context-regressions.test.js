import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

const id = resolve(import.meta.dirname, "fixtures/typed-context-consumer.tsx");
// The generated program is type-checked, not only read: a facade that prints
// well but does not check would pass a text assertion.
const checked = code => {
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "solid-yield",
    types: []
  };
  const host = ts.createCompilerHost(options),
    read = host.readFile;
  host.readFile = file => (file === id ? code : read(file));
  return ts
    .getPreEmitDiagnostics(ts.createProgram([id], options, host))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
};
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
    expect(checked(out)).toEqual([]);
  });
});
