// @ts-check
import { describe, it, expect } from "vitest";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contextCases, contextMutants } from "../fixtures/context.mjs";
import { contextSources } from "../fixtures/context-sources.mjs";
import { fixturesDir } from "../fixtures/index.mjs";
import { compilerOptions } from "../harness/compiler-options.mjs";
import { score, resolveAnchor } from "../harness/score.mjs";

describe("context shared contract", { timeout: 120_000 }, () => {
  it("has strict TypeScript-clean native cases and mutants", () => {
    for (const f of [...contextCases, ...contextMutants]) {
      const files = f.files.map(file => resolve(fixturesDir, f.dir, file));
      const program = ts.createProgram(files, { ...compilerOptions, strict: true });
      const diagnostics = ts.getPreEmitDiagnostics(program);
      expect(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, " ")), f.id).toEqual([]);
    }
  });

  it("keeps canonical sources and actual mutations intact", () => {
    for (const f of [...contextCases, ...contextMutants]) {
      const source = contextSources.find(s => s.id === f.id);
      expect(source, f.id).toBeDefined();
      expect(readFileSync(resolve(fixturesDir, f.dir, f.files[0]), "utf8"), f.id).toBe(source?.source);
      if (f.mutation) {
        expect(f.inSubset, f.id).toBe(true);
        expect(f.expected.length + (f.expectedWarnings?.length ?? 0), f.id).toBeGreaterThan(0);
        const parent = contextSources.find(s => "cases/" + s.id === f.mutation?.parent);
        expect(parent, f.id).toBeDefined();
        const [before, after] = f.mutation.edit.split(" → ");
        if (before === undefined || after === undefined) throw new Error("missing mutation edit");
        expect(parent?.source.replace(before, after), f.id).toBe(source?.source);
      }
    }
  });

  it("requires the primary child read and related caller expression", () => {
    const f = contextCases.find(f => f.id === "context-prop-uncovered");
    if (!f) throw new Error("missing prop fixture");
    const file = resolve(fixturesDir, f.dir, f.files[0]);
    const text = readFileSync(file, "utf8");
    const primary = resolveAnchor(text, { find: "p.value" });
    const caller = resolveAnchor(text, { find: "value={s.value()}" });
    if (!primary || !caller) throw new Error("missing prop anchors");
    const loc = { file, line: primary.line, col: primary.startCol };
    const relatedLoc = { file, line: caller.line, col: caller.startCol };
    /** @type {import("../src/types.d.ts").SoundDiagnostic} */
    const diagnostic = { code: "ERROR_OUTSIDE_ERRORED_BOUNDARY", kind: "error", severity: "error", message: "Read may fail", loc };
    // Both failure and pending obligations are static errors under D-130.
    /** @type {import("../src/types.d.ts").SoundDiagnostic} */
    const pending = { ...diagnostic, code: "ASYNC_OUTSIDE_LOADING_BOUNDARY", kind: "async", message: "Read may be pending" };
    const diagnostics = [diagnostic, pending];
    expect(score(f, fixturesDir, diagnostics, 0).misses).toHaveLength(2);
    expect(score(f, fixturesDir, diagnostics.map(d => ({ ...d, related: [{ message: "Prop supplied here", loc: relatedLoc }] })), 0).misses).toHaveLength(0);
    expect(score(f, fixturesDir, diagnostics.map(d => ({ ...d, loc: relatedLoc, related: [{ message: "Read here", loc }] })), 0).misses).toHaveLength(2);
    expect(score(contextCases.find(f => f.id === "context-pending-handler") ?? f, fixturesDir, [], 0).soundnessFailure).toBe(true);
  });
});
