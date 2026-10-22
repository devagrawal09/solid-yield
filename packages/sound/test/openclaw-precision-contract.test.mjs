// @ts-check
import { describe, it, expect } from "vitest";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openclawPrecisionFixtures } from "../fixtures/openclaw-precision.mjs";
import { OPENCLAW_PRECISION_ORIGINS } from "../fixtures/origins.mjs";
import { fixturesDir, byGroup } from "../fixtures/index.mjs";
import { compilerOptions } from "../harness/compiler-options.mjs";
import { score, resolveAnchor } from "../harness/score.mjs";

describe("D-133 precision requirements", { timeout: 120_000 }, () => {
  it("is strict TypeScript using this package's rc.17 types", () => {
    const files = openclawPrecisionFixtures.flatMap(f => f.files.map(file => resolve(fixturesDir, f.dir, file)));
    const program = ts.createProgram(files, { ...compilerOptions, strict: true });
    expect(ts.getPreEmitDiagnostics(program).map(d => String(d.file?.fileName) + ":" + String(d.start) + ": " + ts.flattenDiagnosticMessageText(d.messageText, " "))).toEqual([]);
  });
  it("keeps all origins, anchors, negative controls and real paired mutants", () => {
    expect(byGroup("openclaw-precision")).toEqual(openclawPrecisionFixtures);
    expect(openclawPrecisionFixtures.filter(f => !f.mutation)).toHaveLength(15);
    for (const fixture of openclawPrecisionFixtures) {
      expect(OPENCLAW_PRECISION_ORIGINS.find(o => o.id === fixture.id), fixture.id).toBeDefined();
      for (const e of [...fixture.expected, ...(fixture.expectedWarnings ?? [])]) {
        const text = readFileSync(resolve(fixturesDir, fixture.dir, e.file), "utf8");
        for (const anchor of e.at) expect(resolveAnchor(text, anchor), fixture.id).not.toBeNull();
      }
      expect(score(fixture, fixturesDir, [], 0).soundnessFailure, fixture.id).toBe(fixture.inSubset && (fixture.expected.length > 0 || (fixture.expectedWarnings?.length ?? 0) > 0));
      if (!fixture.mutation) { expect(fixture.expected).toEqual([]); continue; }
      const parent = openclawPrecisionFixtures.find(f => "openclaw-precision/" + f.id === fixture.mutation?.parent);
      if (!parent) throw new Error("Missing precision parent: " + fixture.id);
      expect(parent.expected).toEqual([]);
      expect(fixture.expected.length).toBeGreaterThan(0);
      expect(readFileSync(resolve(fixturesDir, fixture.dir, fixture.files[0]), "utf8")).not.toBe(readFileSync(resolve(fixturesDir, parent.dir, parent.files[0]), "utf8"));
    }
  });
  it("uses declarations for imports and freezes an over-inclusive installed-root boundary", () => {
    const program = ts.createProgram([resolve(fixturesDir, "openclaw-precision/op-dependency-machine.tsx")], compilerOptions);
    expect(program.getSourceFiles().some(f => f.fileName.endsWith("@precision/machine/dist/index.d.ts"))).toBe(true);
    for (const fixture of openclawPrecisionFixtures) expect(fixture.entry?.includes("node_modules")).toBe(false);
    // The intended result stays clean even if the checked-file list includes installed code.
    const boundary = openclawPrecisionFixtures.find(f => f.id === "op-dependency-machine");
    expect(boundary?.files.some(file => file.includes("node_modules/"))).toBe(true);
    expect(boundary?.expected).toEqual([]);
  });
});
