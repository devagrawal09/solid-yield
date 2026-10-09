import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { lowerNativeProject } from "../src/native.js";

// F-S41: only a component that places props.children under a provider is a provider wrapper.
const file = resolve(import.meta.dirname, "fixtures/native-provider-wrappers.tsx");

describe("native provider wrappers (F-S41)", { timeout: 60_000 }, () => {
  it("does not treat a component that renders its own provider as a wrapper", () => {
    const result = lowerNativeProject(
      new Map([
        [
          file,
          `import {createContext} from 'solid-js';import type {JSX} from '@solidjs/web';
const Ctx = createContext<string>();
export function Wrapper(props: {children: JSX.Element}) { return <Ctx value="a">{props.children}</Ctx>; }
export function App(props: {url?: string}) { return <Wrapper><p>{props.url}</p></Wrapper>; }
export function Shell() { return <Ctx value="b"><p/></Ctx>; }`
        ]
      ])
    );
    const provides = name => result.inference.functions.find(f => f.name === name).provides;
    expect(provides("Wrapper").some(id => id.endsWith("#Ctx"))).toBe(true);
    expect(provides("App")).toEqual([]);
    expect(provides("Shell")).toEqual([]);
    const code = result.files.get(file);
    // App keeps its declared props: no wrapper children are added.
    expect(code).not.toMatch(/App\(props: Props<Omit</);
  });
});
