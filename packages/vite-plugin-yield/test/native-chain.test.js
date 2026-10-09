import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { lowerNativeProject } from "../src/native.js";
import { parseProgram } from "../src/transform.js";
const file = resolve(import.meta.dirname, "fixtures/chain.tsx");
describe("native-chain compiler fixtures", { timeout: 30_000 }, () => {
  it.each([false, true])("keeps chained call arguments in their event (async=%s)", asyncEvent => {
    const code = `import {createSignal,createStore} from 'solid-js';
 declare function place(items:{n:number}[],decline:boolean):Promise<void>;
 export function App(){const [cart]=createStore([{n:1}]);const [decline]=createSignal(false);
 return <button onClick={${asyncEvent ? "async()=>{await Promise.resolve();return " : "()=>"}place(cart.map(item=>({...item})),decline()).catch(()=>{})${asyncEvent ? "}" : ""}}/>;}`;
    const result = lowerNativeProject(new Map([[file, code]]));
    expect(result.diagnostics).toEqual([]);
    const out = result.files.get(file);
    expect(out).toContain("const _receiver = place(");
    expect(out).toContain("yield* __nativeReadStore(cart");
    expect(out).toContain("yield* decline");
    // Only the receiver reads; the function-literal argument keeps the call's own form.
    expect(out).toContain("_receiver.catch(() => {})");
    expect(out).not.toContain("__nativeInvoke");
    parseProgram(out, file).traverse({
      Function(q) {
        if (q.node.generator) return;
        q.traverse({
          Function(inner) {
            inner.skip();
          },
          CallExpression(read) {
            expect(["decline", "__nativeReadStore"]).not.toContain(read.node.callee.name);
          }
        });
      }
    });
  });

  it("keeps a writing continuation in its lexical host when the receiver reads (review 3 #07)", () => {
    const code = `import {createSignal} from 'solid-js';
 declare function place(items:number[]):Promise<void>;
 export function App(){const [items]=createSignal([1]);const [status,setStatus]=createSignal('');
 return <button onClick={()=>{place(items().map(i=>i)).then(()=>setStatus('ok'))}}>{status()}</button>;}`;
    const result = lowerNativeProject(new Map([[file, code]]));
    expect(result.diagnostics).toEqual([]);
    const out = result.files.get(file);
    expect(out).toContain("const _receiver = place(");
    expect(out).toContain("_receiver.then(__nativeLexicalCallback(");
    expect(out).toContain("yield* setStatus(");
    expect(out).not.toContain("__nativeInvoke");
  });

  it("preserves plain Promise chains without splitting their generic method", () => {
    const code = `import {createMemo} from 'solid-js';export function App(){const value=createMemo(()=>Promise.reject(new Error('bad')).catch(()=>1));return <p>{value()}</p>}`;
    const result = lowerNativeProject(new Map([[file, code]]));
    expect(result.diagnostics).toEqual([]);
    expect(result.files.get(file)).not.toContain("__nativeInvoke");
  });
});
