import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// F-S39: a member a source lacks belongs to its value; path keys stay paths.
const file = resolve(import.meta.dirname, "fixtures/native-receivers.tsx");
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

describe("native method receivers (F-S39)", { timeout: 60_000 }, () => {
  it("reads a prop, a row value and a number before calling their methods", () => {
    const code = lower(`import {For, createMemo} from 'solid-js';
export function Panel(props: {title: string; n: number}) {
  const points = createMemo(() => [{value: 1.5}]);
  return <section>
    <h2>{props.title.toLowerCase()}</h2>
    <For each={points()}>{point => <i>{point.value.toFixed(0)}</i>}</For>
    <b>{props.n.toFixed(1)}</b>
  </section>;
}`);
    expect(code).toContain("(yield* props.title).toLowerCase()");
    expect(code).toContain("(yield* point.value).toFixed(0)");
    expect(code).toContain("(yield* props.n).toFixed(1)");
    expect(checked(code)).toEqual([]);
  });

  it("keeps a path key and an index-signature key as paths", () => {
    const code =
      lower(`export function Card(props: {item: {title: string}; tags: Record<string, string>}) {
  return <p>{props.item.title} {props.tags.main}</p>;
}`);
    expect(code).toContain("yield* props.item.title");
    expect(code).toContain("yield* props.tags.main");
    expect(code).not.toContain("(yield* props.item)");
    expect(code).not.toContain("(yield* props.tags)");
    expect(checked(code)).toEqual([]);
  });

  it("keeps Solid's parameter types on an Errored fallback that reads", () => {
    const code = lower(`import {Errored} from 'solid-js';
export function Panel(props: {title: string; children: any}) {
  return <Errored fallback={(error, reset) => (
    <div role="alert">
      <p>Could not load {props.title.toLowerCase()}: {String(error())}</p>
      <button onClick={reset}>Try again</button>
    </div>
  )}>{props.children}</Errored>;
}`);
    expect(code).toContain("error: () => unknown");
    expect(code).toContain("reset: __NativeReset");
    expect(checked(code)).toEqual([]);
  });
});
