import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { lowerNativeProject, nativeFailures } from "../src/native.js";

// F-S45: a call through a member of a context's value calls what every
// provider of that context put there; Solid's provider tags and safe web APIs
// fail nothing.
const file = resolve(import.meta.dirname, "fixtures/native-context-members.tsx");
const fails = (source, name) => {
  const result = lowerNativeProject(new Map([[file, source]]));
  const fn = result.inference.functions.find(f => f.name === name);
  expect(fn, name).toBeTruthy();
  return fn.fails;
};
const prelude = `import {createContext, createSignal, useContext} from 'solid-js';
import type {JSX} from '@solidjs/web';
class Boom extends Error { readonly kind = 'boom'; }
interface Filters { range: () => string; setRange: (range: string) => void }
const Ctx = createContext<Filters>();
function useFilters() {
  const value = useContext(Ctx);
  if (!value) throw new Error('needs a provider');
  return value;
}
export function Bar() {
  const filters = useFilters();
  return <button onClick={() => filters.setRange('7d')}>{filters.range()}</button>;
}`;

describe("native context members (F-S45)", { timeout: 60_000 }, () => {
  it("a tuple value and destructured names (Rendering's router) resolve as members do", () => {
    const tuple = `import {createContext, createSignal, useContext} from 'solid-js';
import type {JSX} from '@solidjs/web';
class Boom extends Error { readonly kind = 'boom'; }
type Router = [() => string, { setLocation: (value: string) => void; go: () => void }];
const Ctx = createContext<Router>();
function useRouter() {
  const value = useContext(Ctx);
  if (!value) throw new Error('needs a provider');
  return value;
}
export function Provider(props: {children: JSX.Element}) {
  const [location, setLocation] = createSignal('index');
  const go = () => { throw new Boom(); };
  return <Ctx value={[location, { setLocation, go }]}>{props.children}</Ctx>;
}
export function Link() {
  const [location, { setLocation }] = useRouter();
  return <button onClick={() => setLocation('profile')}>{location()}</button>;
}
export function Go() {
  const [, { go }] = useRouter();
  return <button onClick={() => go()}>go</button>;
}`;
    const result = lowerNativeProject(new Map([[file, tuple]]));
    const callbacks = result.inference.functions.filter(f => f.name.startsWith("<callback:"));
    const at = line => callbacks.find(f => f.line === line);
    // Link's handler (line 18) calls a setter: nothing. Go's (line 22) calls go: Boom.
    expect([...at(18).fails]).toEqual([]);
    expect([...at(22).fails].some(k => k.includes("Boom"))).toBe(true);
    expect([...at(22).fails]).not.toContain("unknown");
  });

  it("a signal setter reached through a hook fails nothing", () => {
    const source = `${prelude}
export function Provider(props: {children: JSX.Element}) {
  const [range, setRange] = createSignal('24h');
  return <Ctx value={{range, setRange}}>{props.children}</Ctx>;
}`;
    expect(fails(source, "Bar")).toEqual([]);
    expect(fails(source, "Provider")).toEqual([]);
  });

  it("a function member fails with what its body throws", () => {
    const source = `${prelude}
export function Provider(props: {children: JSX.Element}) {
  const [range] = createSignal('24h');
  return <Ctx value={{range, setRange: (r: string) => { if (!r) throw new Boom(); }}}>{props.children}</Ctx>;
}`;
    expect(fails(source, "Bar").some(id => id.includes("#Boom@"))).toBe(true);
    expect(fails(source, "Bar")).not.toContain("unknown");
  });

  it("a function declaration member is its function", () => {
    const source = `${prelude}
function save(r: string) { if (!r) throw new Boom(); }
export function Provider(props: {children: JSX.Element}) {
  const [range] = createSignal('24h');
  return <Ctx value={{range, setRange: save}}>{props.children}</Ctx>;
}`;
    const bar = fails(source, "Bar");
    expect(bar.filter(id => id.includes("#Boom@"))).toHaveLength(1);
    expect(bar).not.toContain("unknown");
  });

  it("a method member is its function", () => {
    const source = `${prelude}
export function Provider(props: {children: JSX.Element}) {
  const [range] = createSignal('24h');
  return <Ctx value={{range, setRange(r: string) { if (!r) throw new Boom(); }}}>{props.children}</Ctx>;
}`;
    const bar = fails(source, "Bar");
    expect(bar.filter(id => id.includes("#Boom@"))).toHaveLength(1);
    expect(bar).not.toContain("unknown");
  });

  it("every provider counts: one unknown member keeps the call unknown", () => {
    const source = `${prelude}
declare const external: (r: string) => void;
export function A(props: {children: JSX.Element}) {
  const [range, setRange] = createSignal('24h');
  return <Ctx value={{range, setRange}}>{props.children}</Ctx>;
}
export function B(props: {children: JSX.Element}) {
  const [range] = createSignal('24h');
  return <Ctx value={{range, setRange: external}}>{props.children}</Ctx>;
}`;
    expect(fails(source, "Bar")).toContain("unknown");
  });

  it("a provider value that is not an object literal keeps the call unknown", () => {
    const source = `${prelude}
declare function makeFilters(): Filters;
export function Provider(props: {children: JSX.Element}) {
  return <Ctx value={makeFilters()}>{props.children}</Ctx>;
}`;
    expect(fails(source, "Bar")).toContain("unknown");
  });

  it("a spread in the provider value keeps the call unknown", () => {
    const source = `${prelude}
declare const base: Filters;
export function Provider(props: {children: JSX.Element}) {
  const [range, setRange] = createSignal('24h');
  return <Ctx value={{...base, range, setRange}}>{props.children}</Ctx>;
}`;
    expect(fails(source, "Bar")).toContain("unknown");
  });

  it("a spread attribute on the provider keeps the call unknown", () => {
    const source = `${prelude}
declare const extra: {value: Filters};
export function Provider(props: {children: JSX.Element}) {
  const [range, setRange] = createSignal('24h');
  return <Ctx value={{range, setRange}} {...extra}>{props.children}</Ctx>;
}`;
    // Native mode refuses the spread before inference (NATIVE_SPREAD); the
    // inference keeps it unknown on its own.
    const inference = nativeFailures(new Map([[file, source]]));
    expect(inference.functions.find(f => f.name === "Bar").fails).toContain("unknown");
  });

  it("a hook with a return that is not the context value keeps the call unknown", () => {
    const source = `${prelude.replace(
      "return value;",
      "if (Math.random() > 2) return other;\n  return value;"
    )}
declare const other: Filters;
export function Provider(props: {children: JSX.Element}) {
  const [range, setRange] = createSignal('24h');
  return <Ctx value={{range, setRange}}>{props.children}</Ctx>;
}`;
    expect(fails(source, "Bar")).toContain("unknown");
  });

  it("a context that escapes keeps the call unknown", () => {
    const source = `${prelude}
declare function register(ctx: unknown): void;
register(Ctx);
export function Provider(props: {children: JSX.Element}) {
  const [range, setRange] = createSignal('24h');
  return <Ctx value={{range, setRange}}>{props.children}</Ctx>;
}`;
    expect(fails(source, "Bar")).toContain("unknown");
  });

  it("a member from a producer that is not Solid's keeps the call unknown", () => {
    const source = `${prelude}
declare function useExternal(): [() => string, (r: string) => void];
export function Provider(props: {children: JSX.Element}) {
  const [range, setRange] = useExternal();
  return <Ctx value={{range, setRange}}>{props.children}</Ctx>;
}`;
    expect(fails(source, "Bar")).toContain("unknown");
  });

  it("a signal getter fails with its computation", () => {
    const source = `${prelude}
export function Provider(props: {children: JSX.Element}) {
  const [range, setRange] = createSignal(() => { if (Math.random() > 2) throw new Boom(); return '24h'; });
  return <Ctx value={{range, setRange}}>{props.children}</Ctx>;
}`;
    const bar = fails(source, "Bar");
    expect(bar.filter(id => id.includes("#Boom@"))).toHaveLength(1);
    expect(bar).not.toContain("unknown");
  });

  it("a value the hook does not return from the context stays unknown", () => {
    const source = `${prelude.replace("return value;", "return Math.random() > 0.5 ? value : other;")}
declare const other: Filters;
export function Provider(props: {children: JSX.Element}) {
  const [range, setRange] = createSignal('24h');
  return <Ctx value={{range, setRange}}>{props.children}</Ctx>;
}`;
    expect(fails(source, "Bar")).toContain("unknown");
  });

  it("the context default counts as a value", () => {
    const source = `${prelude.replace(
      "createContext<Filters>()",
      "createContext<Filters>({range: () => '24h', setRange: () => { throw new Boom(); }})"
    )}`;
    const bar = fails(source, "Bar");
    expect(bar.filter(id => id.includes("#Boom@"))).toHaveLength(1);
    expect(bar).not.toContain("unknown");
  });

  it("a provider tag, HydrationScript and markSafeError fail nothing", () => {
    const source = `import {createContext} from 'solid-js';
import {HydrationScript, markSafeError, type JSX} from '@solidjs/web';
const Theme = createContext<string>();
class Safe extends Error { constructor(m: string) { super(m); markSafeError(this); } }
export function Shell(props: {children: JSX.Element}) {
  return <html><head><HydrationScript/></head><body><Theme value="dark">{props.children}</Theme></body></html>;
}
export function make() { return new Safe('x'); }`;
    expect(fails(source, "Shell")).toEqual([]);
    expect(fails(source, "make")).toEqual([]);
  });
});
