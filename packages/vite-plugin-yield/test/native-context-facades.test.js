import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// F-S52: a context slot declared as a plain function type takes the types its
// providers put there; several providers of one slot give their union.
const file = resolve(import.meta.dirname, "fixtures/native-context-facades.tsx");
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
    types: [],
    lib: ["lib.esnext.d.ts", "lib.dom.d.ts"]
  };
  const host = ts.createCompilerHost(options),
    read = host.readFile;
  host.readFile = path => (path === file ? code : read(path));
  return ts
    .getPreEmitDiagnostics(ts.createProgram([file], options, host))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
};
const lower = source => {
  const result = lowerNativeProject(new Map([[file, source]]));
  expect(result.diagnostics).toEqual([]);
  return result.files.get(file);
};
const providers = `import { createContext, createMemo, createSignal, useContext, Loading, type ParentProps } from "solid-js";
type Value = { count: () => number };
const Ctx = createContext<Value>();
function Fast(props: ParentProps) {
  const [count] = createSignal(1);
  return <Ctx value={{ count }}>{props.children}</Ctx>;
}
function Slow(props: ParentProps) {
  const count = createMemo(async () => 2);
  return <Ctx value={{ count }}>{props.children}</Ctx>;
}
function Show() {
  const value = useContext(Ctx);
  if (!value) throw new Error("no provider");
  return <p>{value.count()}</p>;
}`;

describe("native context facades (F-S52)", { timeout: 60_000 }, () => {
  it("joins the types several providers put in one slot", () => {
    const code = lower(`${providers}
export function App() {
  return <Loading fallback="…"><Fast><Show /></Fast><Slow><Show /></Slow></Loading>;
}`);
    expect(code).toMatch(
      /count: \(.*Source<number, never, false>\) \| \(.*Source<number, never, true>\)/
    );
    expect(checked(code)).toEqual([]);
  });

  it("a pending provider's slot makes its reader pending, up to the root", () => {
    const code = lower(`${providers}
import { render } from "@solidjs/web";
export function App() {
  return <Slow><Show /></Slow>;
}
render(() => <App />, document.body);`);
    expect(checked(code).join("\n")).toMatch(/PENDING_ROOT/);
  });
});
