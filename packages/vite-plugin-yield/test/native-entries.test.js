import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// F-S53: a root render whose tree wraps the app in Solid's own Errored and
// Loading (D-099's shape for a pending app) is lowered as the entry's `Root`
// and checked; a component a factory returns renders as a native tag.
const dir = resolve(import.meta.dirname, "fixtures/native-entries");
const app = resolve(dir, "App.tsx"),
  page = resolve(dir, "Page.tsx"),
  shell = resolve(dir, "Shell.tsx"),
  main = resolve(dir, "main.tsx");
const sources = Object.fromEntries(
  [app, page, shell].map(file => [file, readFileSync(file, "utf8")])
);
const lower = entry => {
  const result = lowerNativeProject(new Map([...Object.entries(sources), [main, entry]]));
  return { result, code: result.files.get(main) };
};
const checked = files => {
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
  host.readFile = path => files.get(path) ?? read(path);
  host.fileExists = path => files.has(path) || exists(path);
  return ts
    .getPreEmitDiagnostics(ts.createProgram([...files.keys()], options, host))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
};

describe("native entries (F-S53)", { timeout: 60_000 }, () => {
  it("lowers a root tree of Errored and Loading as the entry's Root, and checks it", () => {
    const { result, code } =
      lower(`import {render} from '@solidjs/web'; import {Errored, Loading} from 'solid-js'; import {Plain} from './App';
render(() => <Errored fallback={error => <p>{String(error())}</p>}><Loading><Plain /></Loading></Errored>, document.body);`);
    expect(code).toContain("const Root = component(function* Root()");
    expect(code).toContain("foreign(Root satisfies RootCheck<typeof Root>)");
    expect(checked(result.files)).toEqual([]);
  });

  it("without the root Loading, the root may be pending (D-099)", () => {
    const { result } =
      lower(`import {render} from '@solidjs/web'; import {Errored} from 'solid-js'; import {Plain} from './App';
render(() => <Errored fallback={error => <p>{String(error())}</p>}><Plain /></Errored>, document.body);`);
    expect(checked(result.files).join("\n")).toMatch(/PENDING_ROOT/);
  });

  it("leaves a bare root to the entry's checked handoff", () => {
    const { code } = lower(`import {render} from '@solidjs/web'; import {Plain} from './App';
render(() => <Plain />, document.body);`);
    expect(code).toContain("__nativeForeign(Plain satisfies __NativeRootCheck<typeof Plain>)");
    expect(code).not.toContain("const Root");
  });

  it("lifts a tree that uses a typed parameter, as a prop of Root", () => {
    const { result, code } =
      lower(`import {renderToStream} from '@solidjs/web'; import {Errored, Loading} from 'solid-js'; import Shell from './Shell'; import {Plain} from './App';
export function render(url: string) {
  return renderToStream(() => <Shell title={url}><Errored fallback={error => <p>{String(error())}</p>}><Loading><Plain /></Loading></Errored></Shell>);
}`);
    expect(code).toMatch(/function\* Root\(props: Props<\{\s*url: string;\s*\}>\)/);
    // The entry function stays plain; the root is checked as a bare one is.
    expect(code).toContain("export function render(url: string)");
    expect(code).toContain("const __nativeRoot = () => Root({");
    expect(code).toContain("foreign(__nativeRoot satisfies RootCheck<typeof __nativeRoot>)");
    expect(checked(result.files)).toEqual([]);
  });

  it("refuses such a root when it may fail or be pending", () => {
    const { result } =
      lower(`import {renderToStream} from '@solidjs/web'; import Shell from './Shell'; import {Plain} from './App';
export function render(url: string) {
  return renderToStream(() => <Shell title={url}><Plain /></Shell>);
}`);
    // Shell's `children` (ParentProps) takes the colors its caller passes
    // (D-119), so the root, not the Shell, reports them.
    expect(result.files.get(shell)).toMatch(/children\?: __NativeSource</);
    const errors = checked(result.files).join("\n");
    expect(errors).not.toMatch(/SETTLED_PROP/);
    expect(errors).toMatch(/PENDING_ROOT/);
    expect(errors).toMatch(/FOREIGN_HANDOFF[^]*chunk/);
  });

  it("leaves a tree that uses an untyped local", () => {
    const entry = `import {renderToString} from '@solidjs/web'; import {Loading} from 'solid-js'; import {Plain} from './App';
export function page(id: string) { let label = id; return renderToString(() => <Loading><Plain /><i>{label}</i></Loading>); }`;
    let code = "";
    try {
      code = lower(entry).code;
    } catch {
      // refused as an unknown callback: not lifted either way
    }
    expect(code).not.toContain("function* Root");
  });

  it("renders a component a factory returns as a native tag", () => {
    const { result, code } =
      lower(`import {render} from '@solidjs/web'; import {Loading} from 'solid-js'; import {Framed} from './App';
render(() => <Loading><Framed /></Loading>, document.body);`);
    expect(code).toContain("yield* Framed({})");
    expect(code).not.toContain("foreign(Framed)");
    expect(checked(result.files)).toEqual([]);
  });
});
