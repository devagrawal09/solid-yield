import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// A library setter where the author's types expect a plain function writes when
// called (nativeWrite); a provider's expression child reads in a hole.
const file = resolve(import.meta.dirname, "fixtures/native-plain-setters.tsx");
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

describe("native setters in plain function types", { timeout: 60_000 }, () => {
  it("adapts a setter placed in a context value's plain function member", () => {
    const code =
      lower(`import {createContext, createSignal, useContext, type Accessor} from 'solid-js';
import type {JSX} from '@solidjs/web';
interface Filters { range: Accessor<string>; setRange: (range: string) => void }
const Ctx = createContext<Filters>();
export function Provider(props: {children: JSX.Element}) {
  const [range, setRange] = createSignal('24h');
  return <Ctx value={{range, setRange}}>{props.children}</Ctx>;
}`);
    expect(code).toContain("setRange: __nativeWrite(setRange)");
    expect(code).not.toContain("range: __nativeWrite");
    expect(code).toContain('import { nativeWrite as __nativeWrite } from "solid-yield/internal"');
    expect(checked(code)).toEqual([]);
  });

  it("adapts a setter passed to a plain callback parameter", () => {
    const code = lower(`import {createSignal} from 'solid-js';
function register(onPick: (value: number) => void) { void onPick; }
export function Picker() {
  const [n, setN] = createSignal(0);
  register(setN);
  return <p>{n()}</p>;
}`);
    expect(code).toContain("register(__nativeWrite(setN))");
    expect(checked(code)).toEqual([]);
  });

  it("leaves a setter where a Solid Setter is expected", () => {
    const code = lower(`import {createSignal, type Setter} from 'solid-js';
function register(onPick: Setter<number>) { void onPick; }
export function Picker() {
  const [n, setN] = createSignal(0);
  register(setN);
  return <p>{n()}</p>;
}`);
    expect(code).not.toContain("__nativeWrite");
  });

  it("leaves a plain function that is not a setter", () => {
    const code = lower(`function register(onPick: (value: number) => void) { void onPick; }
export function Picker() {
  const log = (value: number) => console.log(value);
  register(log);
  return <p>picker</p>;
}`);
    expect(code).not.toContain("__nativeWrite");
  });
});

describe("native provider children", { timeout: 60_000 }, () => {
  it("reads an expression child in a hole of the provider's lazy view", () => {
    const code = lower(`import {createContext} from 'solid-js';
import type {JSX} from '@solidjs/web';
const Theme = createContext<string>();
export function ThemeProvider(props: {children: JSX.Element}) {
  return <Theme value="dark">{props.children}</Theme>;
}`);
    expect(code).toMatch(
      /children: function\* \(\) \{\s*return <>\{yield\* props\.children\}<\/>;/
    );
    expect(code).not.toMatch(/return yield\* props\.children;/);
    expect(checked(code)).toEqual([]);
  });

  it("keeps an element child and a text child as they are", () => {
    const code = lower(`import {createContext} from 'solid-js';
const Theme = createContext<string>();
export function A() { return <Theme value="dark"><p>inside</p></Theme>; }
export function B() { return <Theme value="dark">text</Theme>; }`);
    expect(code).toContain("return <p>inside</p>;");
    expect(code).not.toContain('<>{"text"}</>');
    expect(checked(code)).toEqual([]);
  });
});
