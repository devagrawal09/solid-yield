// The twins through the plugin (Phase 2): the `h` twins have no JSX, so the
// plugin leaves every file alone. (Until D-043 this file also checked that,
// for every JSX file of the 6 JSX twins, compiling the plugin's output equals
// what the compiler's own rule produced — the rule idled behind the plugin;
// with the rule gone, rule.test.js's checked-in outputs are the oracle.)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { transform } from "../src/index.js";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const H_TWINS = ["sierpinski-yield-h", "todos-yield-h"];

const sources = twin =>
  existsSync(join(repo, "examples", twin))
    ? execFileSync("git", ["ls-files", `examples/${twin}`], { cwd: repo, encoding: "utf8" })
        .split("\n")
        .filter(f => /\.[mc]?[jt]sx?$/.test(f))
    : [];

describe("the h twins are no-ops", () => {
  for (const twin of H_TWINS) {
    const files = sources(twin);
    it.skipIf(!files.length)(`${twin}: transform() is null for every file`, () => {
      const changed = files.filter(f =>
        transform(readFileSync(join(repo, f), "utf8"), { filename: join(repo, f) })
      );
      expect(changed).toEqual([]);
    });
  }
});
