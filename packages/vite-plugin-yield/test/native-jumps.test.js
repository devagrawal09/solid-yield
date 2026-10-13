import { describe, it, expect } from "vitest";
import ts from "typescript";
import { nativePrelude } from "../src/native-prelude.js";

// A `break` or `continue` that leaves a native `try` (the lowering runs its
// block and its `catch` as helpers of `nativeTry`) becomes a completion record
// the helper returns, and the jump is made where the `try` stood. Run before
// and after the lowering, each function computes the same thing (S25's loops
// and `try`).
const source = `
export function firstBad(items: string[]) {
  let total = 0;
  for (const s of items) {
    try { total += JSON.parse(s) as number; } catch { break; }
  }
  return total;
}
export function skipBad(items: string[]) {
  let total = 0;
  for (const s of items) {
    try { total += JSON.parse(s) as number; } catch { continue; }
    total += 100;
  }
  return total;
}
export function rows(table: string[][]) {
  let total = 0;
  outer: for (const row of table) {
    for (const s of row) {
      try {
        if (s === "stop") return -1;
        total += JSON.parse(s) as number;
      } catch {
        continue outer;
      }
    }
    if (total > 50) break outer;
  }
  return total;
}
export function switched(n: number) {
  let out = "";
  for (let i = 0; i < n; i++) {
    try {
      switch (i % 3) {
        case 0: out += "a"; break;
        default: out += JSON.parse(String(i));
      }
      if (i > 4) break;
    } catch {
      out += "?";
    }
  }
  return out;
}
export function whileBreak(items: string[]) {
  let i = 0, total = 0;
  while (true) {
    try {
      if (i >= items.length) break;
      total += JSON.parse(items[i]) as number;
    } catch {
      total -= 1;
    }
    i++;
  }
  return total;
}
`;
/** The module's functions, with the native try run as the library runs it. */
const load = code => {
  const js = ts.transpileModule(code.replace(/^import .*$/gm, ""), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  }).outputText;
  const drive = it => {
    let step = it.next();
    while (!step.done) step = it.next();
    return step.value;
  };
  const __nativeTry = (body, handler, finalizer) => {
    try {
      return drive(body());
    } catch (error) {
      return drive(handler(error));
    } finally {
      if (finalizer) drive(finalizer());
    }
  };
  const names = [...js.matchAll(/export function (\w+)/g)].map(m => m[1]);
  return new Function(
    "__nativeTry",
    "__nativeValue",
    js.replace(/export function/g, "function") + `\nreturn { ${names.join(", ")} };`
  )(__nativeTry, e => e);
};
const file = "/virtual/jumps.ts";
const original = load(source);
const lowered = load(nativePrelude(new Map([[file, source]])).get(file));

describe("break and continue across a native try (completion records)", () => {
  it("lowers every try in the module", () => {
    const code = nativePrelude(new Map([[file, source]])).get(file);
    expect(code).not.toMatch(/\btry\s*\{/);
    expect(code.match(/__nativeTry\(/g)).toHaveLength(5);
  });
  it.each([
    ["firstBad", [["1", "2", "x", "4"]]],
    ["firstBad", [["1", "2"]]],
    ["skipBad", [["1", "x", "3"]]],
    [
      "rows",
      [
        [
          ["1", "x", "9"],
          ["2", "3"]
        ]
      ]
    ],
    ["rows", [[["1"], ["stop"]]]],
    ["rows", [[["40"], ["20"], ["1"]]]],
    ["switched", [7]],
    ["whileBreak", [["1", "x", "3"]]]
  ])("%s(%j) computes what it did", (name, args) => {
    expect(lowered[name](...args)).toEqual(original[name](...args));
  });
});
