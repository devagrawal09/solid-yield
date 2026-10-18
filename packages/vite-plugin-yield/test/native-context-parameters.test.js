import { expect, it } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

const id = resolve(import.meta.dirname, "fixtures/context-parameters.tsx");
const source = `import { createContext, createSignal, useContext } from "solid-js";
import { render } from "@solidjs/web";
interface Counter {
  count: () => number;
  setCount: (next: number) => void;
  change: (options: { value: number }) => void;
  reset: (next?: number) => void;
  sum: (...values: number[]) => void;
}
const Context = createContext<Counter>();
function makeCounter() {
  const [count, set] = createSignal(0);
  const counter: Counter = {
    count,
    setCount: next => set(next),
    change: ({ value }) => set(value),
    reset: (next = 1) => set(next),
    sum: (...values) => set(values.reduce((total, value) => total + value, 0))
  };
  return counter;
}
function Child() {
  const counter = useContext(Context)!;
  return <button onClick={() => {
    counter.setCount(1); counter.change({ value: 2 }); counter.reset(); counter.sum(1, 2);
  }}>{counter.count()}</button>;
}
function App() { return <Context value={makeCounter()}><Child /></Context>; }
render(() => <App />, document.body);`;

function diagnostics(source) {
  const files = lowerNativeProject(new Map([[id, source]])).files;
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
  host.readFile = file => files.get(file) ?? read(file);
  return ts.getPreEmitDiagnostics(ts.createProgram([id], options, host));
}

it("keeps contextual parameter types when hiding a void result", () => {
  const errors = diagnostics(source);
  expect(errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, "\n"))).toEqual([]);
});

it("does not widen the authored parameter contract", () => {
  const errors = diagnostics(source.replace("counter.setCount(1)", `counter.setCount("wrong")`));
  expect(errors.some(error => error.code === 2345)).toBe(true);
});
