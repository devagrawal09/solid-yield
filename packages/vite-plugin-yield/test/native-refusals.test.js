import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { lowerNativeProject } from "../src/native.js";

// Every native refusal the lowering raises, each at its authored position
// (scripts/native-coverage.mjs checks that each code has a test). Three
// refusal branches have none: SUGAR_LEXICAL (Babel's arrow conversion hoists
// `this` and `arguments` first, so a routine arrow keeps their meaning),
// NATIVE_HOST (every JSX value has a statement parent) and NATIVE_ACTION (a
// call argument is an expression or a spread).
const file = resolve(import.meta.dirname, "fixtures/native-refusals.tsx");
/** @type {[code: string, at: string, what: string, source: string][]} */
const cases = [
  [
    "NATIVE_API",
    "1:10",
    "an API with no verified lowering (Index)",
    'import { Index } from "solid-js";\nexport function Rows(props: { rows: string[] }) {\n  return <ul><Index each={props.rows}>{row => <li>{row()}</li>}</Index></ul>;\n}'
  ],
  [
    "NATIVE_ASYNC_SETUP",
    "5:19",
    "an async reactive helper called in setup",
    'import { createContext, useContext } from "solid-js";\nconst Base = createContext(1);\nasync function current() { const base = useContext(Base); await Promise.resolve(); return base; }\nexport function Total() {\n  const pending = current();\n  return <p>{String(pending)}</p>;\n}'
  ],
  [
    "NATIVE_CHILD",
    "4:10",
    "a spread child as a provider's only child",
    'import { createContext } from "solid-js";\nconst Ctx = createContext("a");\nexport function Spread(props: { items: string[] }) {\n  return <Ctx value="b">{...props.items}</Ctx>;\n}'
  ],
  [
    "NATIVE_CONTEXT",
    "2:19",
    "a context with no named declaration",
    'import { createContext, useContext } from "solid-js";\nconst contexts = [createContext("a")];\nexport function Pick() {\n  const value = useContext(contexts[0]);\n  return <p>{value}</p>;\n}'
  ],
  [
    "NATIVE_CONTEXT_TYPE",
    "2:15",
    "a defaultless context with no value type",
    'import { createContext, useContext } from "solid-js";\nconst Theme = createContext();\nexport function Themed() {\n  const theme = useContext(Theme);\n  return <p>{String(theme)}</p>;\n}'
  ],
  [
    "NATIVE_CONTROL_TRANSFER",
    "4:69",
    "a return from a finally",
    'import { createSignal } from "solid-js";\nexport function Retry() {\n  const [n, setN] = createSignal(0);\n  const run = () => { try { setN(1); } catch { setN(2); } finally { return; } };\n  return <button onClick={run}>{n()}</button>;\n}'
  ],
  [
    "NATIVE_HANDLER",
    "6:27",
    "a reassigned event handler",
    'import { createSignal } from "solid-js";\nexport function Toggle() {\n  const [n, setN] = createSignal(0);\n  let onClick = () => setN(1);\n  onClick = () => setN(2);\n  return <button onClick={onClick}>{n()}</button>;\n}'
  ],
  [
    "NATIVE_IMPORT",
    "1:8",
    "a namespace import of solid-js",
    'import * as Solid from "solid-js";\nexport function Count() {\n  const [n] = Solid.createSignal(0);\n  return <p>{n()}</p>;\n}'
  ],
  [
    "NATIVE_LIBRARY",
    "1:1",
    "a solid-yield import in native source",
    'import { $signal } from "solid-yield";\nexport function Count() { return <p>1</p>; }'
  ],
  [
    "NATIVE_NAME",
    "2:7",
    "a binding with a generated import's name",
    'import { createSignal } from "solid-js";\nconst __nativeAttempt = 1;\nasync function load() { return 1; }\nexport function Count() {\n  const [n] = createSignal(__nativeAttempt);\n  const save = async () => { await load(); };\n  return <button onClick={save}>{n()}</button>;\n}'
  ],
  [
    "NATIVE_PATTERN",
    "4:11",
    "a context destructured with a default",
    'import { createContext, useContext } from "solid-js";\nconst Size = createContext({ width: 1, height: 2 });\nexport function Area() {\n  const { width = 0, height } = useContext(Size);\n  return <p>{width * height}</p>;\n}'
  ],
  [
    "NATIVE_PATTERN",
    "4:18",
    "a context destructured with a rest (was dropped)",
    'import { createContext, useContext } from "solid-js";\nconst Size = createContext({ width: 1, height: 2 });\nexport function Area() {\n  const { width, ...rest } = useContext(Size);\n  return <p>{width * rest.height}</p>;\n}'
  ],
  [
    "NATIVE_PROVIDE_SETUP",
    "5:33",
    "a creating provider value under a conditional",
    'import { createContext, createSignal, Show, type ParentProps } from "solid-js";\nconst Counter = createContext<() => number>();\nfunction counter() { const [n] = createSignal(0); return n; }\nexport function Maybe(props: ParentProps<{ on: boolean }>) {\n  return <>{props.on ? <Counter value={counter()}>{props.children}</Counter> : props.children}</>;\n}'
  ],
  [
    "NATIVE_RECURSION",
    "2:11",
    "a recursive component's defaulted prop snapshot",
    "export function Tree(props: { depth: number }) {\n  const { depth = 0 } = props;\n  return depth > 0 ? <Tree depth={depth - 1} /> : <i>leaf</i>;\n}"
  ],
  [
    "NATIVE_RETURN_TYPE",
    "1:8",
    "a component return annotation other than JSX.Element",
    "export function Label(): unknown {\n  return <span>label</span>;\n}"
  ],
  [
    "SUGAR_COMPONENT",
    "1:8",
    "a top-level JSX function without a PascalCase name",
    "export function row() {\n  return <li>row</li>;\n}"
  ],
  [
    "SUGAR_NAME",
    "1:7",
    "a binding named view, the generated import",
    'const view = "list";\nexport function Named() {\n  return <p>{view}</p>;\n}'
  ],
  [
    "SUGAR_READ_ARGS",
    "4:14",
    "a source read given arguments",
    'import { createSignal } from "solid-js";\nexport function Read() {\n  const [n] = createSignal(0);\n  return <p>{n(...([] as []))}</p>;\n}'
  ]
];

describe("native refusals, each at its authored position", { timeout: 60_000 }, () => {
  for (const [code, at, what, source] of cases)
    it(`${code}: ${what}`, () => {
      expect(() => lowerNativeProject(new Map([[file, source]]))).toThrow(
        new RegExp(`^\\[${code}\\][^]*:${at}\\)`)
      );
    });
});
