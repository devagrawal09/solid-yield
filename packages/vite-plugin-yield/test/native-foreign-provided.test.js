import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// F-S43: a foreign router rendered only under providers hands its route
// components those contexts.
const file = resolve(import.meta.dirname, "fixtures/native-foreign-provided.tsx");
const router = resolve(import.meta.dirname, "fixtures/native-foreign-router.d.ts");
const routerTypes = `declare module "foreign-router" {
  import type { JSX } from "@solidjs/web";
  export function createRouter(options: {
    routes: { path: string; component: (props: { params: Record<string, string> }) => JSX.Element }[];
  }): (props: { url?: string }) => JSX.Element;
}`;
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
    read = host.readFile,
    exists = host.fileExists;
  host.readFile = path => (path === file ? code : path === router ? routerTypes : read(path));
  host.fileExists = path => path === router || exists(path);
  return ts
    .getPreEmitDiagnostics(ts.createProgram([file, router], options, host))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
};
const lower = source => {
  const result = lowerNativeProject(new Map([[file, source]]));
  expect(result.diagnostics.filter(d => d.code !== "NATIVE_FOREIGN_BOUNDARY")).toEqual([]);
  return result.files.get(file);
};
const prelude = `import {createContext, useContext} from 'solid-js';
import type {JSX} from '@solidjs/web';
import {createRouter} from 'foreign-router';
const Theme = createContext<string>();
function ThemeProvider(props: {children: JSX.Element}) { return <Theme value="dark">{props.children}</Theme>; }
function Page() { const theme = useContext(Theme); return <p>{theme}</p>; }
const Router = createRouter({routes: [{path: '/', component: Page}]});`;

describe("native foreign providers (F-S43)", { timeout: 60_000 }, () => {
  it("discharges a context provided around every render of the router", () => {
    const code = lower(`${prelude}
export function App(props: {url?: string}) {
  return <ThemeProvider><Router url={props.url}/></ThemeProvider>;
}`);
    expect(code).toContain("component: __nativeForeignProvided(Page,");
    expect(code).toMatch(/RequiredContext<any, "[^"]*#Theme">/);
    expect(checked(code)).toEqual([]);
  });

  it("discharges a context provided directly by its provider element", () => {
    const code = lower(`${prelude}
export function App() {
  return <Theme value="light"><Router/></Theme>;
}`);
    expect(code).toContain("component: __nativeForeignProvided(Page,");
    expect(checked(code)).toEqual([]);
  });

  it("refuses a route component when the router is rendered without the provider", () => {
    const code = lower(`${prelude}
export function App() {
  return <Router/>;
}`);
    expect(code).not.toContain("__nativeForeignProvided");
    expect(checked(code).join("\n")).toContain("[NO_PROVIDER]");
  });

  it("refuses when one of the router's renders lacks the provider", () => {
    const code = lower(`${prelude}
export function App(props: {plain: boolean}) {
  return <section><ThemeProvider><Router/></ThemeProvider>{props.plain ? <Router/> : null}</section>;
}`);
    expect(code).not.toContain("__nativeForeignProvided");
    expect(checked(code).join("\n")).toContain("[NO_PROVIDER]");
  });

  it("does not discharge a context the provider around the router does not provide", () => {
    const code = lower(`${prelude}
const Other = createContext<number>();
export function App() {
  return <Other value={1}><Router/></Other>;
}`);
    expect(code).not.toMatch(/__nativeForeignProvided\(Page, [^\n]*#Theme"/);
    expect(checked(code).join("\n")).toContain("[NO_PROVIDER]");
  });
});
