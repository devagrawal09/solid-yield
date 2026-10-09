import { describe, it, expect } from "vitest";
import { createRoot } from "solid-js";
import { createContext } from "../src/context.js";
import { nativeUseContext, nativeContextGuard } from "../src/native-context.js";
import { nativeFailure } from "../src/native-failure.js";

// F-S37: a native context hook holds the value its provider set once.
const run = (iterable: { [Symbol.iterator](): Iterator<unknown, unknown> }) =>
  iterable[Symbol.iterator]().next();

describe("native useContext", () => {
  it("returns the provided value itself, not a path over it", () => {
    const Ctx = createContext<{ n: number }, "Ctx">(undefined, { name: "Ctx" });
    const provided = { n: 1 };
    let seen: unknown;
    createRoot(() => {
      const out = (Ctx as any)({
        value: provided,
        get children() {
          seen = run(nativeUseContext(Ctx)).value;
          return null;
        }
      });
      if (typeof out === "function") out();
    });
    expect(seen).toBe(provided);
  });

  it("still refuses a read with no provider above it", () => {
    const Ctx = createContext<{ n: number }, "Ctx">(undefined, { name: "Ctx" });
    expect(() => createRoot(() => run(nativeUseContext(Ctx)))).toThrow();
  });

  it("raises the guard's failure when the guard does run", () => {
    const failure = nativeFailure(["global:Error"], new Error("needs a provider"));
    expect(() => run(nativeContextGuard(null, failure))).toThrow("needs a provider");
  });
});
