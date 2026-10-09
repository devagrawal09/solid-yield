import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// F-S37: a context hook read in setup, `const value = useContext(Ctx); if (!value) throw …`.
const file = resolve(import.meta.dirname, "fixtures/native-context.tsx");
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
  host.readFile = path => (path === file ? code : read(path));
  return ts
    .getPreEmitDiagnostics(ts.createProgram([file], options, host))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
};
const app = (valueType, provided) =>
  `import {createContext, createSignal, useContext, type Accessor, type JSX} from 'solid-js';
interface Filters {range: Accessor<string>; setRange: (range: string) => void}
const FilterContext = createContext<${valueType}>();
export function FilterProvider(props: {children: JSX.Element}) {
  const [range, setRange] = createSignal('24h');
  return <FilterContext value={${provided}}>{props.children}</FilterContext>;
}
export function useFilters() {
  const value = useContext(FilterContext);
  if (!value) throw new Error('Filters need a provider');
  return value;
}
export function FilterBar() {
  const filters = useFilters();
  return <p>{filters.range()}</p>;
}
export function App() {
  return <FilterProvider><FilterBar/></FilterProvider>;
}`;

describe("native context hooks (F-S37)", () => {
  it("holds the provided value in setup; a guard its type rules out raises nothing", () => {
    const result = lowerNativeProject(new Map([[file, app("Filters", "{range, setRange}")]]));
    const code = result.files.get(file);
    expect(result.diagnostics).toEqual([]);
    expect(code).toContain("yield* __nativeUseContext(FilterContext)");
    expect(code).toContain("yield* __nativeContextGuard(value,");
    // The value is held, not read as a path in setup.
    expect(code).not.toContain("yield* value");
    expect(code).toContain("yield* filters.range");
    expect(checked(code)).toEqual([]);
    // The inference agrees: the guard adds no failure to the hook or its callers.
    const summary = name => result.inference.functions.find(f => f.name === name);
    expect(summary("useFilters").fails).toEqual([]);
    expect(summary("FilterBar").fails).toEqual([]);
  }, 30_000);

  it("keeps the raise, and the setup refusal, when the declared type admits the value", () => {
    const result = lowerNativeProject(
      new Map([[file, app("Filters | null", "{range, setRange}")]])
    );
    const code = result.files.get(file);
    expect(code).toContain("yield* __nativeContextGuard(value,");
    const errors = checked(code);
    // A live raise in setup is still not a setup operation.
    expect(errors.some(e => e.includes("SetupOp"))).toBe(true);
    expect(result.inference.functions.find(f => f.name === "useFilters").fails).toEqual([
      "global:Error"
    ]);
  }, 30_000);

  it("leaves the destructured form a path, as todos reads it", () => {
    const result = lowerNativeProject(
      new Map([
        [
          file,
          `import {createContext, createSignal, useContext} from 'solid-js';
const Ctx = createContext<[() => number, {bump: () => void}]>();
export function Child() {
  const [count, {bump}] = useContext(Ctx);
  return <button onClick={() => bump()}>{count()}</button>;
}`
        ]
      ])
    );
    const code = result.files.get(file);
    expect(code).not.toContain("__nativeUseContext");
    expect(code).toContain("yield* Ctx");
  }, 30_000);
});
