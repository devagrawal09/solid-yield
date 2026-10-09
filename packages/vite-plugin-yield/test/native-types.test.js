import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { lowerNativeProject } from "../src/native.js";
import { parseProgram } from "../src/transform.js";
import { lowerNativeTypes, nativeTypeDiagnostics } from "../src/native-types.js";
import { printMapped } from "../src/positions.js";
import ts from "typescript";
const file = resolve(import.meta.dirname, "fixtures/native-types.tsx");
const imports = `import type {Accessor as Read, Setter, Signal, Component, ParentComponent, VoidComponent, ParentProps, JSX} from "solid-js";`;
const lower = source => {
  const p = parseProgram(
    source,
    source.includes("<Read<number>>") ? file.replace(/tsx$/, "ts") : file
  );
  const diagnostics = nativeTypeDiagnostics(p, file);
  lowerNativeTypes(p);
  return { code: printMapped(p.parent ?? { type: "File", program: p.node }), diagnostics };
};
const checked = (code, target = file) => {
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
  host.readFile = path => (path === target ? code : read(path));
  return ts
    .getPreEmitDiagnostics(ts.createProgram([target], options, host))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
};
describe("native type positions", () => {
  it.each([
    ["interface members", `interface Filters { range: Read<string>; setRange: Setter<string> }`],
    ["alias members", `type Filters = { range: Read<string>; setRange: Setter<string> }`],
    ["nested generics", `type Nested = Map<string, Array<Read<number>>>`],
    ["constraints and defaults", `type Box<T extends Read<number> = Read<number>> = T`],
    ["function parameters", `declare function consume(range: Read<string>): void`],
    ["function results", `declare function obtain(): Read<string>`],
    ["satisfies", `const value = input satisfies Read<number>`],
    ["as casts", `const value = input as Read<number>`],
    ["angle casts", `const value = <Read<number>>input`],
    ["tuples and unions", `type Fields = [Read<number>, Read<string> | null]`],
    [
      "mapped and conditional types",
      `type Fields<T> = {[K in keyof T]: T[K] extends Read<infer V> ? Read<V> : never}`
    ],
    ["interface extension", `interface Readable extends Read<number> {}`],
    ["type assertions in calls", `consume<Read<number>>(input)`]
  ])("rewrites %s through its import", (_name, annotation) => {
    const { code, diagnostics } = lower(
      imports +
        `declare const input:Read<number>; declare function consume<T>(value:T):T;` +
        annotation
    );
    expect(code).toContain("Source as Read");
    expect(code).toContain('from "solid-yield"');
    expect(code).toContain("NativeSignal as Signal");
    expect(diagnostics).toEqual([]);
    expect(checked(code, _name === "angle casts" ? file.replace(/tsx$/, "ts") : file)).toEqual([]);
  });
  it("maps tuple, component families and JSX with their real library types", () => {
    const { code } = lower(
      imports +
        `type Types = [Signal<number>, Component<{n:number}>, ParentComponent, VoidComponent, ParentProps, JSX.Element];`
    );
    expect(code).toContain("NativeParentComponent as ParentComponent");
    expect(code).toContain("NativeVoidComponent as VoidComponent");
    expect(code).toContain("NativeParentProps as ParentProps");
    expect(code).toMatch(/Element as _NativeElement/);
    expect(code).toContain("_NativeElement");
    expect(code).not.toContain("JSX.Element");
    expect(checked(code)).toEqual([]);
  });
  it("supports type namespaces and inline import types", () => {
    const { code, diagnostics } = lower(
      `import type * as Solid from 'solid-js'; type A = Solid.Accessor<number>; type B = import('solid-js').Setter<number>; type E = import('@solidjs/web').JSX.Element;`
    );
    expect(code).toContain("Source as _NativeSource");
    expect(code).toContain("Setter as _NativeSetter");
    expect(code).toContain("Element as _NativeElement");
    expect(code).not.toContain("Solid.Accessor");
    expect(code).not.toContain('import("solid-js").Setter');
    expect(diagnostics).toEqual([]);
    expect(checked(code)).toEqual([]);
  });
  it("visits qualified contracts in every nested type position", () => {
    const { code, diagnostics } = lower(`import type * as Solid from 'solid-js';
import type {JSX} from '@solidjs/web';
interface Fields extends Solid.Accessor<number> {read: Solid.Accessor<number>; element: JSX.Element}
type Nested<T extends Solid.Accessor<number> = Solid.Accessor<number>> = {
  [K in keyof T]: T[K] extends Solid.Accessor<infer V> ? [Solid.Signal<V>, Solid.Setter<V>] : never
};
declare function consume<T>(value: T): T;
declare function read(value: Solid.Accessor<number>): Solid.Accessor<number>;
declare const input: Solid.Accessor<number>;
const a = input satisfies Solid.Accessor<number>;
const b = input as Solid.Accessor<number>;
const c = consume<Solid.Accessor<number>>(input);
type Components = [Solid.Component, Solid.ParentComponent, Solid.VoidComponent];`);
    expect(code).not.toMatch(
      /Solid\.(Accessor|Setter|Signal|Component|ParentComponent|VoidComponent)/
    );
    expect(diagnostics).toEqual([]);
    expect(checked(code)).toEqual([]);
  });
  it("does not erase pending or failure colors behind an Accessor annotation", () => {
    const { code } = lower(`import type {Accessor} from 'solid-js';
import type {Source} from 'solid-yield';
declare const colored: Source<number, Error, true>;
const settled: Accessor<number> = colored;`);
    const diagnostics = checked(code);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toContain("not assignable to type 'Source<number, never, false>'");
  });
  it.each(["type ", ""])(
    "retains unmapped contracts through a %simport",
    kind => {
      const result = lowerNativeProject(
        new Map([
          [
            file,
            `import ${kind}{Owner} from 'solid-js';
type Kept = Owner;
export function App() {return <p/>}`
          ]
        ])
      );
      expect(result.files.get(file)).toContain('import type { Owner } from "solid-js"');
      expect(result.diagnostics.map(d => [d.code, d.line, d.column])).toEqual([
        ["NATIVE_TYPE_UNMAPPED", 2, 13]
      ]);
      expect(checked(result.files.get(file))).toEqual([]);
    },
    30_000
  );
  it("supports a type-only use of a normal namespace import in native mode", () => {
    const result = lowerNativeProject(
      new Map([
        [
          file,
          `import * as Solid from 'solid-js';
type Read = Solid.Accessor<number>;
export function App() {return <p/>}`
        ]
      ])
    );
    expect(result.files.get(file)).toContain("Source as _NativeSource");
    expect(result.diagnostics).toEqual([]);
    expect(checked(result.files.get(file))).toEqual([]);
  }, 30_000);
  it("preserves unknown Solid types and warns at every authored annotation", () => {
    const source = `import type {Store as S, JSX} from 'solid-js';\ntype A = S<number>;\ntype B = JSX.IntrinsicElements;\ntype C = import('solid-js').Store<string>;`;
    const { code, diagnostics } = lower(source);
    expect(code).toContain("Store as S");
    expect(code).toContain("S<number>");
    expect(diagnostics.map(d => [d.code, d.line, d.column])).toEqual([
      ["NATIVE_TYPE_UNMAPPED", 2, 10],
      ["NATIVE_TYPE_UNMAPPED", 3, 10],
      ["NATIVE_TYPE_UNMAPPED", 4, 10]
    ]);
  });
  it("does not rewrite a shadowed type name", () => {
    const { code } = lower(
      `import type {Accessor} from 'solid-js'; function plain<Accessor>(value: Accessor) {return value}`
    );
    expect(code).toContain("value: Accessor");
  });
  it("checks context values and props using the lowered signal getter", () => {
    const result = lowerNativeProject(
      new Map([
        [
          file,
          `import {createContext, createSignal, useContext, type Accessor, type Setter, type JSX} from 'solid-js';
interface Filters {range: Accessor<string>; setRange: Setter<string>}
const Context = createContext<Filters>();
function Child(props:{range:Accessor<string>}) {return <p>{props.range()}</p>}
export function App() {const [range,setRange]=createSignal('24h'); return <Context value={{range,setRange}}><Child range={range}/></Context>}`
        ]
      ])
    );
    const code = result.files.get(file);
    expect(code).toContain("Source as Accessor");
    expect(code).toContain("yield* props.range");
    expect(code).toContain("value: {");
    expect(result.diagnostics).toEqual([]);
    expect(checked(code)).toEqual([]);
  }, 30_000);
  it.each(["Component as C", "ParentComponent as C", "VoidComponent as C"])(
    "keeps inferred colors for an aliased %s declaration",
    spec => {
      const code = lowerNativeProject(
        new Map([
          [
            file,
            `import type {${spec}, JSX} from 'solid-js'; export const App:C<{n:number}> = props => <p>{props.n}</p>;`
          ]
        ])
      ).files.get(file);
      expect(code).toContain("component(function*");
      expect(code).toContain("n: number");
      expect(code).not.toContain("App: C");
    },
    30_000
  );
  it("accepts a JSX.Element return annotation and infers its routine colors", () => {
    const code = lowerNativeProject(
      new Map([
        [
          file,
          `import type {JSX} from '@solidjs/web'; export function App(): JSX.Element {return <p/>}`
        ]
      ])
    ).files.get(file);
    expect(code).toContain("component(function* App");
    expect(code).not.toContain("function* App():");
  }, 30_000);
});
