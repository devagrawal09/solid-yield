import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// F-S49: a wrapper the lowering makes generic (D-119) still carries what its
// hole props require, inferred per call, so a child that reads a context
// passes through it to the provider above.
const file = resolve(import.meta.dirname, "fixtures/native-hole-requirements.tsx");
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
const parts = `import {createContext, useContext, createMemo, Errored, Loading} from 'solid-js';
import {render, type JSX} from '@solidjs/web';
const Theme = createContext<{tone: string}>();
function useTheme() {
  const theme = useContext(Theme);
  if (!theme) throw new Error('no theme');
  return theme;
}
function Panel(props: {title: string; children: JSX.Element}) {
  return <section><h2>{props.title}</h2>
    <Errored fallback="!"><Loading fallback="…">{props.children}</Loading></Errored></section>;
}
function Rows() {
  const theme = useTheme();
  const rows = createMemo(async () => [theme.tone]);
  return <p>{rows().join()}</p>;
}`;

describe("native hole requirements (F-S49)", { timeout: 60_000 }, () => {
  it("a widened wrapper takes a requirement parameter", () => {
    const code = lower(`${parts}
export function App() {
  return <Theme value={{tone: 'dark'}}><Panel title="rows"><Rows/></Panel></Theme>;
}
render(() => <App/>, document.body);`);
    expect(code).toMatch(/function\* Panel<_E_children, _P_children extends boolean, _R = never>/);
    expect(code).toContain("}> & __NativeRequiring<_R>");
    expect(checked(code)).toEqual([]);
  });

  it("the requirement still reaches the root without a provider", () => {
    const code = lower(`${parts}
export function App() {
  return <Panel title="rows"><Rows/></Panel>;
}
render(() => <App/>, document.body);`);
    expect(checked(code).join("\n")).toMatch(/NO_PROVIDER[^]*Theme/);
  });

  it("each call carries its own holes' requirements", () => {
    const code = lower(`${parts}
function Plain() { return <p>plain</p>; }
export function Free() {
  return <Panel title="plain"><Plain/></Panel>;
}
export function App() {
  return <Theme value={{tone: 'dark'}}><Panel title="rows"><Rows/></Panel><Free/></Theme>;
}
render(() => <Free/>, document.body);
render(() => <App/>, document.body);`);
    expect(checked(code)).toEqual([]);
  });
});
