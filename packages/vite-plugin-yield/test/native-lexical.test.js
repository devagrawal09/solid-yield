import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { lowerNativeProject } from "../src/native.js";
const file = resolve(import.meta.dirname, "fixtures/lexical.tsx");
const source = body => `import {createSignal,createEffect,createMemo,createStore} from 'solid-js';
declare function consume<T>(callback:()=>T):T;
export function App(){const [n,set]=createSignal(1);const [state,write]=createStore({n:0});
${body}}`;
describe("native-lexical compiler fixtures", { timeout: 30_000 }, () => {
  it.each([
    ["store updater", `return <button onClick={()=>write(c=>{c.n=n()})}/>;`],
    [
      "array callbacks",
      `return <button onClick={()=>[1].filter(()=>n()).forEach(()=>set(n()+1))}/>;`
    ],
    ["Promise callback", `return <button onClick={()=>Promise.resolve().then(()=>set(n()+1))}/>;`],
    [
      "async Promise callback",
      `return <button onClick={()=>Promise.resolve().then(async()=>{await Promise.resolve();set(n()+1)})}/>;`
    ],
    [
      "deferred nested arrow",
      `return <button onClick={()=>Promise.resolve().then(()=>()=>n()).then(read=>read())}/>;`
    ],
    ["nested arrows", `return <button onClick={()=>consume(()=>consume(()=>n()))}/>;`],
    ["effect compute", `createEffect(()=>consume(()=>n()),value=>{});return <p/>;`],
    ["effect phase", `createEffect(()=>n(),value=>{consume(()=>set(n()+value))});return <p/>;`],
    ["memo callback", `const value=createMemo(()=>consume(()=>n()));return <p>{value()}</p>;`]
  ])("keeps %s in its lexical host", (_name, body) => {
    const result = lowerNativeProject(new Map([[file, source(body)]]));
    expect(result.diagnostics).toEqual([]);
    expect(result.files.get(file)).toContain("__nativeLexicalCallback");
    expect(result.files.get(file)).toContain("yield* n");
  });
  it.each([
    ["child", `return <p>{()=>n().toFixed(2)}</p>;`],
    ["attribute", `return <p title={()=>n().toFixed(2)}/>;`],
    ["conditional", `return <p>{n() ? (()=>n().toFixed(2)) : (()=>n())}</p>;`],
    ["returned function", `return <p>{()=>()=>n().toFixed(2)}</p>;`],
    ["generated failure producer", `return <p>{n().toFixed(2)}</p>;`]
  ])("keeps a JSX %s function in its hole host (F-S35)", (_name, body) => {
    const result = lowerNativeProject(new Map([[file, source(body)]]));
    expect(result.diagnostics).toEqual([]);
    expect(result.files.get(file)).toContain('return yield* __nativeLexicalCallback("hole"');
    expect(result.files.get(file)).toContain("yield* n");
  });
  it("reports an opaque setup callback at the original read", () => {
    expect(() =>
      lowerNativeProject(new Map([[file, source(`const value=consume(()=>n());return <p/>;`)]]))
    ).toThrow(/SUGAR_CALLBACK.*:4:25/);
  });
});
