import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createChecker } from "../prototypes/oxc/index.mjs";
import { byGroup, fixturesDir } from "../fixtures/index.mjs";
import { score } from "../harness/score.mjs";
import { assertKnownOpenclaw } from "../harness/openclaw-known.mjs";
import { assertKnownPrecision } from "../harness/openclaw-precision-known.mjs";
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const implementation = resolve(packageDir, "prototypes/oxc");
function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory()
      ? sources(resolve(dir, e.name))
      : /[.](mjs|js|cjs|ts|tsx)$/.test(e.name)
        ? [resolve(dir, e.name)]
        : []
  );
}
describe("oxc independence", () => {
  it("has no static TypeScript imports or package loads", () => {
    for (const file of sources(implementation)) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/(?:from|import|require)[^;]*['"]typescript(?:[/][^'"]*)?['"]/);
    }
  });
  it("runs with TypeScript blocked by the module resolver", () => {
    const code = [
      "import {registerHooks} from 'node:module';",
      "registerHooks({resolve(specifier,context,nextResolve){ if(specifier === 'typescript' || specifier.startsWith('typescript/')) throw new Error('TypeScript is blocked'); return nextResolve(specifier,context); }});",
      "const {createChecker}=await import('./prototypes/oxc/index.mjs'); await import('./prototypes/oxc/vite.mjs');",
      "const {byGroup,fixturesDir}=await import('./fixtures/index.mjs');",
      "const {resolve}=await import('node:path');",
      "for(const fixture of byGroup('all')) { const rootDir=resolve(fixturesDir,fixture.dir); const c=createChecker({rootDir,files:fixture.files.map(f=>resolve(rootDir,f))}); c.check(); c.dispose(); }"
    ].join(";");
    expect(() =>
      execFileSync(process.execPath, ["--input-type=module", "-e", code], {
        cwd: packageDir,
        timeout: 60000,
        stdio: "pipe"
      })
    ).not.toThrow();
  });
});
describe("oxc shared fixtures", () => {
  for (const fixture of byGroup("all"))
    it(fixture.id, () => {
      const rootDir = resolve(fixturesDir, fixture.dir);
      const checker = createChecker({
        rootDir,
        files: fixture.files.map(f => resolve(rootDir, f))
      });
      const result = checker.check();
      const s = score(fixture, fixturesDir, result.diagnostics, result.elapsedMs);
      checker.dispose();
      if (fixture.group === "openclaw-precision") {
        assertKnownPrecision("oxc", fixture, s);
      } else if (fixture.group === "openclaw") {
        assertKnownOpenclaw("oxc", fixture, s);
      } else {
        expect(s.misses).toEqual([]);
        expect(s.warningMisses).toEqual([]);
        expect(s.infoMisses).toBe(0);
        expect(s.extraErrors).toEqual([]);
        expect(s.extraWarnings).toEqual([]);
      }
      expect(s.leakage).toEqual([]);
      expect(s.unmapped).toBe(0);
    });
});
