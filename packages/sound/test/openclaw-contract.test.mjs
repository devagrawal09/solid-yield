// @ts-check
import { describe, it, expect } from "vitest";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openclawFixtures } from "../fixtures/openclaw.mjs";
import { OPENCLAW_ORIGINS } from "../fixtures/origins.mjs";
import { fixturesDir, byGroup } from "../fixtures/index.mjs";
import { compilerOptions } from "../harness/compiler-options.mjs";
import { score, resolveAnchor } from "../harness/score.mjs";
import { BY_CODE } from "../src/codes.mjs";

describe("frozen OpenClaw contract", { timeout: 120_000 }, () => {
  it("is ordinary strict TypeScript against installed rc.17 types", () => {
    const files = openclawFixtures.flatMap(f => f.files.map(file => resolve(fixturesDir, f.dir, file)));
    const program = ts.createProgram(files, { ...compilerOptions, strict: true });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(diagnostics.map(d => `${d.file?.fileName}:${d.start}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`)).toEqual([]);
  });

  it("keeps origins, real mutants, severity and all primary/related anchors", () => {
    expect(byGroup("openclaw")).toEqual(openclawFixtures);
    for (const f of openclawFixtures) {
      expect(OPENCLAW_ORIGINS.find(o => o.id === f.id), f.id).toBeDefined();
      for (const e of [...f.expected, ...(f.expectedWarnings ?? []), ...(f.expectedInfo ?? [])]) {
        const text = readFileSync(resolve(fixturesDir, f.dir, e.file), "utf8");
        for (const anchor of e.at) expect(resolveAnchor(text, anchor), `${f.id} primary`).not.toBeNull();
        for (const related of e.related ?? []) {
          const source = readFileSync(resolve(fixturesDir, f.dir, related.file), "utf8");
          for (const anchor of related.at) expect(resolveAnchor(source, anchor), `${f.id} related`).not.toBeNull();
        }
        expect(BY_CODE[e.code].severity, f.id).toBe("error");
      }
      const s = score(f, fixturesDir, [], 0);
      expect(s.soundnessFailure, f.id).toBe(f.expected.length > 0 || (f.expectedWarnings?.length ?? 0) > 0);
      if (f.mutation) {
        const parent = openclawFixtures.find(p => `openclaw/${p.id}` === f.mutation?.parent);
        expect(parent, f.id).toBeDefined();
        if (!parent) throw new Error(`Missing parent: ${f.id}`);
        expect(f.expected.length, f.id).toBeGreaterThan(0);
        expect(readFileSync(resolve(fixturesDir, f.dir, f.files[0]), "utf8")).not.toBe(readFileSync(resolve(fixturesDir, parent.dir, parent.files[0]), "utf8"));
      }
    }
  });
});
