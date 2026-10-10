import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// F-S50: a component generic in a value type. Its open props are declared as
// the bare contract the library resolves per instantiation, Source<T, never,
// false>; D-119 widens them as it widens any bare prop.
const file = resolve(import.meta.dirname, "fixtures/native-generics.tsx");
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
const labeled = `import { createContext, createMemo, createSignal, useContext, Errored, For, Loading, type JSX } from "solid-js";
import { render } from "@solidjs/web";
function Labeled<T extends string | number>(props: { value: T; items: T[]; children: JSX.Element }) {
  return <label>{props.value}: <For each={props.items}>{item => <i>{item}</i>}</For>{props.children}</label>;
}`;

describe("native author-generic components (F-S50)", { timeout: 60_000 }, () => {
  it("types an open prop per instantiation", () => {
    const code = lower(`${labeled}
export function Form() {
  const [name] = createSignal("a");
  return <Labeled value={name()} items={["b", "c"]}><b>x</b></Labeled>;
}`);
    expect(code).toContain("value: __NativeSource<T, never, false>");
    expect(code).toContain("items: __NativeSource<T[], never, false>");
    expect(code).toMatch(/Source as __NativeSource/);
    expect(checked(code)).toEqual([]);
  });

  it("widens an open prop to what its callers pass (D-119)", () => {
    const code = lower(`${labeled}
export function Form() {
  const total = createMemo(async () => 3);
  return <Errored fallback="!"><Loading fallback="…"><Labeled value={total()} items={[1]}><b>x</b></Labeled></Loading></Errored>;
}
export function Bare() {
  const total = createMemo(async () => 3);
  return <Labeled value={total()} items={[1]}><b>x</b></Labeled>;
}
render(() => <Bare />, document.body);`);
    expect(code).toMatch(/value: __NativeSource<T, _E_value\d*, _P_value\d*>/);
    const errors = checked(code).join("\n");
    // Form's boundaries cover it; Bare's root is pending.
    expect(errors).toMatch(/PENDING_ROOT/);
    expect(errors).not.toMatch(/SETTLED_PROP/);
  });

  it("carries its children's requirements", () => {
    const code = lower(`${labeled}
type Theme = { tone: string };
const ThemeContext = createContext<Theme>();
function Tone() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("no theme");
  return <i>{theme.tone}</i>;
}
export function Provided() {
  return <ThemeContext value={{ tone: "dark" }}><Labeled value="a" items={["b"]}><Tone /></Labeled></ThemeContext>;
}
export function Unprovided() {
  return <Labeled value="a" items={["b"]}><Tone /></Labeled>;
}
render(() => <Unprovided />, document.body);`);
    const errors = checked(code).join("\n");
    if (process.env.SHOW_ERRORS) console.log(errors);
    expect(errors).toMatch(/NO_PROVIDER/);
    expect(errors.split("\n").filter(line => /Provided\b/.test(line))).toEqual([]);
  });
});
