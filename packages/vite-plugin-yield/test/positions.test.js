import { describe, it, expect } from "vitest";
import babel from "@babel/core";
import { resolve } from "node:path";
import { lowerNativeProject, locate } from "../src/virtual.js";
describe("virtual positions", { timeout: 30_000 }, () => {
  it("keeps repeated reads distinct through every lowering pass and labels machinery", () => {
    const file = resolve(import.meta.dirname, "positions.tsx");
    const source = `import {createSignal} from 'solid-js';
export function Counter(){
 const [count]=createSignal(0);
 const text='😀';
 const a=count();
 const b=count();
 return <p>{a}{b}{text}</p>;
}`;
    const result = lowerNativeProject(new Map([[file, source]]));
    const code = result.files.get(file),
      table = result.positions.get(file);
    const ast = babel.parseSync(code, {
      filename: file,
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ["typescript", "jsx"] }
    });
    let nodeCount = 0;
    function count(node) {
      nodeCount++;
      for (const key of babel.types.VISITOR_KEYS[node.type] ?? []) {
        const value = node[key];
        for (const child of Array.isArray(value) ? value : [value]) if (child) count(child);
      }
    }
    count(ast.program);
    expect(table.length).toBe(nodeCount);
    const reads = [...code.matchAll(/yield\* count/g)];
    expect(reads).toHaveLength(2);
    for (const [i, m] of reads.entries()) {
      const at = locate(table, m.index + 7, 5);
      expect(at.generated).toBe(false);
      expect(at.sourceStart).toBe(
        i === 0 ? source.indexOf("count();") : source.lastIndexOf("count();")
      );
      expect(source.slice(at.sourceStart, at.sourceEnd)).toBe("count");
    }
    const generated = locate(table, code.indexOf("component("), 9);
    expect(generated.generated).toBe(true);
    expect(source.slice(generated.sourceStart, generated.sourceEnd)).toBe("Counter");
    expect(
      table.every(r => r.start >= 0 && r.end <= code.length && r.sourceEnd <= source.length)
    ).toBe(true);
  });

  it("maps a delegation the lowering adds to the expression it reads", () => {
    const file = resolve(import.meta.dirname, "positions-read.tsx");
    const source = `import {createSignal} from 'solid-js';
export function Item(props: {id: string}){
 const [id] = createSignal(props.id);
 return <p>{id()}</p>;
}`;
    const result = lowerNativeProject(new Map([[file, source]]));
    const code = result.files.get(file),
      table = result.positions.get(file);
    const read = code.indexOf("yield* props.id");
    expect(read).toBeGreaterThan(0);
    // The whole `yield* props.id` (where a READ_IN_SETUP is reported), not its routine.
    const at = locate(table, read, "yield* props.id".length);
    expect(source.slice(at.sourceStart, at.sourceEnd)).toBe("props.id");
  });

  it("keeps a context facade's file mapped", () => {
    const file = resolve(import.meta.dirname, "positions-facade.tsx");
    const source = `import {createContext, createSignal, useContext, type ParentProps} from 'solid-js';
type Value = { count: () => number };
const Ctx = createContext<Value>();
export function Provider(props: ParentProps){
 const [count] = createSignal(1);
 return <Ctx value={{ count }}>{props.children}</Ctx>;
}
export function Show(){
 const value = useContext(Ctx);
 if (!value) throw new Error("no provider");
 return <p>{value.count()}</p>;
}`;
    const result = lowerNativeProject(new Map([[file, source]]));
    const code = result.files.get(file),
      table = result.positions.get(file);
    expect(code).toMatch(/count: \(?import\("solid-yield"\)\.Source<number/);
    expect(table.length).toBeGreaterThan(1);
    const at = locate(table, code.lastIndexOf("<p>"), 3);
    expect(at.generated).toBe(false);
    expect(at.sourceStart).toBe(source.lastIndexOf("<p>"));
  });
});
