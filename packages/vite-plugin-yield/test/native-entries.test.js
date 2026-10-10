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
  main = resolve(dir, "main.tsx");
const sources = Object.fromEntries([app, page].map(file => [file, readFileSync(file, "utf8")]));
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

  it("leaves a tree that closes over a local", () => {
    const { code } =
      lower(`import {renderToString} from '@solidjs/web'; import {Loading} from 'solid-js'; import {Plain} from './App';
export function page(id: string) { return renderToString(() => <Loading><Plain /><i>{id}</i></Loading>); }`);
    expect(code).not.toContain("const Root");
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
