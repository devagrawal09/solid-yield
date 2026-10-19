import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { lowerNativeProject } from "../src/native.js";

const file = resolve(import.meta.dirname, "fixtures/native-event-spreads.tsx");
const lower = source => lowerNativeProject(new Map([[file, source]])).files.get(file);

describe("effect hosts in DOM spreads", { timeout: 60_000 }, () => {
  for (const key of ["onClick", '"onClick"'])
    it("models an inline event with key " + key, () => {
      const code = lower(
        "export function App(){return <button {...{" + key + ':()=>JSON.parse("{}")}}/>;}'
      );
      expect(code).toContain('yield* __nativeAttempt(() => JSON.parse("{}")');
      expect(code).toContain("global:SyntaxError");
    });

  it("models events in a constant used only by DOM spreads", () => {
    const code = lower(
      'export function App(){const props={onClick:()=>JSON.parse("{}")};return <><button {...props}/><input {...props}/></>;}'
    );
    expect(code).toContain('yield* __nativeAttempt(() => JSON.parse("{}")');
  });

  for (const [name, source] of [
    [
      "ordinary spread values",
      'export function App(){return <button {...{format:()=>JSON.parse("{}")}}/>;}'
    ],
    [
      "computed event keys",
      'export function App(){return <button {...{["onClick"]:()=>JSON.parse("{}")}}/>;}'
    ],
    [
      "component callbacks",
      'function Child(props:{onClick:()=>unknown}){return <div/>;} export function App(){return <Child {...{onClick:()=>JSON.parse("{}")}}/>;}'
    ],
    [
      "component callbacks inside a view hole",
      'function Child(props:{onClick:()=>unknown}){return <div/>;} export function App(){return <div>{()=> <Child {...{onClick:()=>JSON.parse("{}")}}/>}</div>;}'
    ],
    [
      "constants also passed to components",
      'function Child(props:{onClick:()=>unknown}){return <div/>;} export function App(){const props={onClick:()=>JSON.parse("{}")};return <><button {...props}/><Child {...props}/></>;}'
    ],
    [
      "constants with ordinary reads",
      'export function App(){const props={onClick:()=>JSON.parse("{}")};void props;return <button {...props}/>;}'
    ]
  ])
    it("keeps " + name + " plain", () => {
      expect(lower(source)).not.toContain("__nativeAttempt");
    });

  it("leaves foreign callbacks plain inside an event", () => {
    const code = lower(
      'function invoke(callback:()=>unknown){return callback();} export function App(){return <button {...{onClick:()=>invoke(()=>JSON.parse("{}"))}}/>;}'
    );
    expect(code).toContain('invoke(() => JSON.parse("{}"))');
    expect(code).not.toContain('yield* __nativeAttempt(() => JSON.parse("{}")');
    expect(code).toContain("yield* __nativeAttempt(() => invoke(");
  });
});
