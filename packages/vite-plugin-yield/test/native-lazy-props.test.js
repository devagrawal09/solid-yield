import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lowerNativeProject } from "../src/native.js";

// A component reached through `lazy` (Rendering's Profile) loses its type
// parameters there, so D-119 widens its props to what its callers pass.
const dir = resolve(import.meta.dirname, "fixtures/native-lazy-props");
const page = resolve(dir, "index.tsx"),
  profile = resolve(dir, "Profile.tsx");
const lower = () =>
  lowerNativeProject(
    new Map([
      [page, readFileSync(page, "utf8")],
      [profile, readFileSync(profile, "utf8")]
    ])
  );

describe("native lazy components' props (D-119 through lazy)", { timeout: 120_000 }, () => {
  it("widens to the colors the callers pass, not to type parameters", () => {
    const result = lower();
    expect(result.diagnostics).toEqual([]);
    const code = result.files.get(profile);
    expect(code).toContain("info: __NativeSource<string[], never, true>;");
    expect(code).toContain("user: __NativeSource<User, never, true>;");
    expect(code).not.toMatch(/function\* Profile</);
  });

  it("calls the lazy page natively, not through a foreign boundary", () => {
    const result = lower();
    expect(result.files.get(page)).toContain("yield* Profile({");
    expect(result.files.get(page)).not.toContain("foreign(");
  });

  it("resolving a promise with a value that has no `then` fails nothing", () => {
    const result = lower();
    const fails = name => [...result.inference.functions.find(f => f.name === name).fails];
    // The two memos' bodies (lines 8 and 11) resolve an object and an array.
    expect(fails("<callback:8:5>")).toEqual([]);
    expect(fails("<callback:11:5>")).toEqual([]);
  });
});
