import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { lowerNativeProject } from "../src/native.js";
import { parseProgram } from "../src/transform.js";
const file = resolve(import.meta.dirname, "fixtures/jsx-holes.tsx");
const source = body => `import {createSignal,createMemo} from 'solid-js';
export function App(){const [n]=createSignal(2);const totals=createMemo(()=>({success:n()}));${body}}`;
describe("native JSX function holes (F-S35)", { timeout: 30_000 }, () => {
  it.each([
    ["arrow child", `return <p>{()=>n()}</p>;`],
    ["function child", `return <p>{function(){return n()}}</p>;`],
    [
      "parenthesized conditional children",
      `return <p>{true?((()=>n())):((function(){return n()}))}</p>;`
    ],
    [
      "parenthesized conditional attribute",
      `return <p title={true?((()=>n().toFixed(2))):((function(){return n().toFixed(2)}))}/>;`
    ],
    [
      "functions returned from a hole",
      `return <p>{()=>true?(()=>n()):(function(){return ()=>n()})}</p>;`
    ]
  ])("keeps %s on the hole host", (_label, body) => {
    const result = lowerNativeProject(new Map([[file, source(body)]]));
    expect(result.diagnostics).toEqual([]);
    const out = result.files.get(file);
    expect(out).toContain('__nativeLexicalCallback("hole"');
    expect(out).toContain("yield* n");
    parseProgram(out, file).traverse({
      Function(q) {
        if (q.node.generator) return;
        q.traverse({
          Function(inner) {
            inner.skip();
          },
          CallExpression(call) {
            expect(call.node.callee.name).not.toBe("n");
          }
        });
      }
    });
  });
  // The platform contract: a literal toFixed option cannot throw, so the dashboard
  // expression needs no failure producer and its read stays in the hole.
  it.each([
    ["expression", "totals().success.toFixed(2)"],
    ["arrow", "() => totals().success.toFixed(2)"]
  ])("keeps the dashboard %s read in its hole with no failure producer", (_label, expression) => {
    const result = lowerNativeProject(
      new Map([[file, source(`return <dd>{${expression}}</dd>;`)]])
    );
    expect(result.diagnostics).toEqual([]);
    const out = result.files.get(file);
    expect(out).toContain("(yield* totals).success.toFixed(2)");
    expect(out).not.toContain("_receiver");
    parseProgram(out, file).traverse({
      Function(q) {
        if (q.node.generator) return;
        q.traverse({
          Function(inner) {
            inner.skip();
          },
          CallExpression(call) {
            expect(call.node.callee.name).not.toBe("totals");
          }
        });
      }
    });
  });
  // A computed option can throw RangeError: the receiver is read in the hole first.
  it.each([
    ["expression", "totals().success.toFixed(n())"],
    ["arrow", "() => totals().success.toFixed(n())"]
  ])(
    "evaluates a %s receiver in its hole before the failure producer",
    (_label, expression) => {
      const result = lowerNativeProject(
        new Map([[file, source(`return <dd>{${expression}}</dd>;`)]])
      );
      expect(result.diagnostics).toEqual([]);
      const out = result.files.get(file);
      expect(out).toContain("const _receiver = (yield* totals).success");
      expect(out).toContain("__nativeInvoke(_method, _receiver");
      parseProgram(out, file).traverse({
        Function(q) {
          if (q.node.generator) return;
          q.traverse({
            Function(inner) {
              inner.skip();
            },
            CallExpression(call) {
              expect(call.node.callee.name).not.toBe("totals");
            }
          });
        }
      });
    }
  );
});
