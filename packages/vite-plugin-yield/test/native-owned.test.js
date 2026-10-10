import { describe, it, expect } from "vitest";
import babel from "@babel/core";
import { resolve } from "node:path";
import { lowerNativeProject, nativeFailures } from "../src/native.js";
import { coreGenerator, generatorApis, markOpaqueGenerators } from "../src/native-owned.js";
import { parseProgram } from "../src/transform.js";
const file = resolve(import.meta.dirname, "fixtures/owned.tsx");
const lower = code => lowerNativeProject(new Map([[file, code]]));
function generators(code) {
  const bodies = [];
  parseProgram(code, file).traverse({
    Function(q) {
      if (q.node.generator)
        bodies.push(
          babel.transformFromAstSync(
            babel.types.file(
              babel.types.program([
                babel.types.expressionStatement(
                  babel.types.functionExpression(
                    null,
                    q.node.params,
                    q.node.body,
                    true,
                    q.node.async
                  )
                )
              ])
            ),
            undefined,
            { configFile: false, babelrc: false, comments: false }
          ).code
        );
    }
  });
  return bodies;
}
describe("bounded native ownership", { timeout: 30_000 }, () => {
  it.each([...generatorApis])("recognizes %s's direct generator producer", api => {
    const code = `import {${api} as core} from 'solid-js';core(async function*(){yield 1});`;
    expect(markOpaqueGenerators(new Map([[file, code]])).get(file)).not.toContain(
      "use native opaque"
    );
    parseProgram(code, file).traverse({
      Function(q) {
        expect(coreGenerator(q)).toBe(true);
      }
    });
  });
  it("lowers direct core action reads, including an import alias", () => {
    const result = lower(`import {action as save,createSignal} from 'solid-js';
export function App(){const [count,set]=createSignal(0);const run=save(function*(){yield Promise.resolve();set(count()+1)});return <button onClick={run}>{count()}</button>}`);
    expect(result.diagnostics).toEqual([]);
    expect(result.files.get(file)).toContain("yield* count");
    expect(result.files.get(file)).toContain("yield* __nativeAttempt");
  });
  it("recognizes a namespace core call but keeps a named generator opaque", () => {
    const code = `import * as Solid from 'solid-js';Solid.action(function*(){yield 1});
function* steps(){yield 1}Solid.action(steps);`;
    const marked = markOpaqueGenerators(new Map([[file, code]])).get(file);
    expect(marked.match(/use native opaque/g)).toHaveLength(1);
  });
  it("keeps Effect, async and custom generators opaque, including their nested callbacks", () => {
    const code = `import {Effect} from 'effect';
export const effect = Effect.gen(function* () { yield* Effect.sleep(1); return 1; });
export async function* sequence(){ yield await Promise.resolve(2); }
function* steps(){ yield 1; }
export const named = Effect.gen(steps);
export function foreignFactory(){ return steps(); }
export const custom = function*(){ try { yield Promise.reject('x'); } catch { return 3; } };`;
    const result = lower(code);
    expect(generators(result.files.get(file))).toEqual(generators(code));
    expect(result.files.get(file)).not.toContain("__nativeAttempt");
    expect(result.files.get(file)).not.toContain("yield* steps");
    expect(result.files.get(file)).not.toContain("function* foreignFactory");
    expect(result.files.get(file)).not.toContain("use native opaque");
    const report = nativeFailures(new Map([[file, code]]));
    expect(
      report.functions
        .filter(f => /sequence|custom|callback/.test(f.name))
        .every(f => f.fails.includes("unknown"))
    ).toBe(true);
  });
  it.each(["function*", "async function*"])(
    "reports the read in an opaque %s at its source line",
    kind => {
      const code = `import {createSignal} from 'solid-js';\nexport function App(){\n const [count] = createSignal(0);\n const program = ${kind}(){\n  return count();\n };\n return <p/>;\n}`;
      try {
        lower(code);
        throw Error("expected diagnostic");
      } catch (error) {
        expect(error.diagnostics).toEqual([
          {
            code: "READ_IN_OPAQUE_GENERATOR",
            message:
              "this signal is read inside a generator the compiler does not own; read it outside and pass the value in, or make the read a memo",
            file,
            line: 5,
            column: 10
          }
        ]);
      }
    }
  );
  it("locates an imported signal read inside an opaque generator", () => {
    const state = resolve(import.meta.dirname, "fixtures/state.ts");
    const code = `import {count} from './state';
export function* program(){return count();}`;
    expect(() =>
      lowerNativeProject(
        new Map([
          [file, code],
          [state, `import {createSignal} from 'solid-js';export const [count]=createSignal(0);`]
        ])
      )
    ).toThrow(/READ_IN_OPAQUE_GENERATOR.*:2:35\)/);
  });
  it.each(["createSignal", "createStore", "createMemo"])(
    "leaves module %s and its initializer Solid",
    name => {
      const declaration =
        name === "createMemo"
          ? "const value = make(() => foreignCall());"
          : "const [value,write] = make(0);";
      const code = `import {${name} as make} from 'solid-js';\n${declaration}`;
      const result = lower(code);
      expect(result.diagnostics).toEqual([
        {
          code: "MODULE_STATE",
          severity: "error",
          message:
            "reactive state created at module level has no owner; create it inside a component and provide it via context, or keep it foreign and handle failures at its uses",
          file,
          line: 2,
          column: 7
        }
      ]);
      expect(result.files.get(file)).toContain(`import { ${name} as make } from "solid-js"`);
      expect(result.files.get(file)).not.toContain("solid-yield");
      expect(result.files.get(file)).not.toContain("yield*");
    }
  );
  it("retains unknown failures at reads of module state", () => {
    const code = `import {createStore} from 'solid-js';
const [items] = createStore([1]);
export function App(){ return <p>{items.length}</p>; }`;
    const result = lower(code);
    expect(result.files.get(file)).toContain('__nativeFailure(["unknown"]');
    expect(result.files.get(file)).toContain("yield* __nativeAttempt");
    expect(
      nativeFailures(new Map([[file, code]])).functions.find(f => f.name === "App").fails
    ).toContain("unknown");
  });
  // F-S53 attempts a core async producer as a stream: what it yields is the
  // stream's values, so nothing inside it is delegated (found by mutation).
  it.each([
    ["createMemo", "async function* () {\n  yield count();\n }", "5:9"],
    ["createMemo", "async function* () {\n  const k = count();\n  yield k;\n }", "5:13"],
    [
      "createProjection",
      "async function* (state) {\n  state.n = count();\n  yield state;\n }",
      "5:13"
    ]
  ])("refuses a read in %s's async producer at its source line", (api, producer, at) => {
    const code = `import {createSignal,${api}} from 'solid-js';\nexport function App(){\n const [count] = createSignal(0);\n const all = ${api}(${producer}${api === "createProjection" ? ", { n: 0 }" : ""});\n return <p>{String(all)}</p>;\n}`;
    expect(() => lower(code)).toThrow(new RegExp(`READ_IN_OPAQUE_GENERATOR.*:${at}\\)`));
  });
  it("leaves a setter's call in an async producer plain, for the lint", () => {
    const code = `import {createSignal,createMemo} from 'solid-js';\nexport function App(){\n const [count, setCount] = createSignal(0);\n const all = createMemo(async function* () { setCount(1); yield 1; });\n return <p>{all()}{count()}</p>;\n}`;
    const out = lower(code).files.get(file);
    expect(out).toMatch(/async function\* \(\) \{\s*setCount\(1\);/);
    expect(out).not.toContain("yield* setCount");
  });
  // An authored generator yields its own values (Effect's YieldWrap): one a
  // parameter supplies is called and driven by hand, not delegated to.
  it.each(["{ readonly effect: string }", "number"])(
    "calls a generator a parameter supplies (yielding %s) for its caller to drive",
    yields => {
      const code = `import {action} from 'solid-js';\ntype Step = ${yields};\nexport function bridge<R>(steps: () => Generator<Step, R, never>) {\n return action(function* () {\n  const it = steps();\n  return it.next();\n });\n}`;
      const out = lower(code).files.get(file);
      expect(out).not.toContain("yield* steps()");
      expect(out).toContain("__nativeAttempt(() => steps()");
    }
  );
  it("maps a later callback refusal to the authored read", () => {
    const code = `import {createSignal,createMemo} from 'solid-js';\nexport function App(){\n const [count] = createSignal(0);\n const doubled = createMemo(()=>count()*2);\n foreignScheduler(()=>count());\n return <p>{doubled()}</p>;\n}`;
    expect(() => lower(code)).toThrow(/:5:23\)/);
  });
});
