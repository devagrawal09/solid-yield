// @ts-check
// Prototype B — "dataflow": a dedicated reactive / async / failure analysis over
// the TypeScript AST with the type checker as an oracle; diagnostics are
// produced directly (see analyze.mjs). Implements CONTRACT.md.
import ts from "typescript";
import { existsSync, readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { Analysis } from "./analyze.mjs";
import { boundedImports } from "./imports.mjs";
import { summarize, relocate } from "./incremental.mjs";

export const name = "dataflow";
/** @typedef {import("../../src/types.d.ts").CheckResult & { invalidatedFiles: string[], reanalyzedFiles: string[], timings: import("./analyze.mjs").WorkTiming[], programStats: Record<string, number>, summaryHash?: string, summaryChanges?: string[] }} ScaleResult */
/** @typedef {Omit<import("../../src/types.d.ts").Checker, "check" | "update"> & { check(): ScaleResult, update(path: string, text: string): ScaleResult }} ScaleChecker */

/**
 * @param {import("../../src/types.d.ts").CheckerOptions} options
 * @returns {ScaleChecker}
 */
export function createChecker(options) {
  const files = options.files.map(f => f.replaceAll("\\", "/"));
  /** @type {Map<string, { version: number, text: string }>} */
  const docs = new Map();
  const read = options.readFile ?? (p => (existsSync(p) ? readFileSync(p, "utf8") : undefined));
  for (const f of files) docs.set(f, { version: 1, text: read(f) ?? "" });
  const compilerOptions = options.compilerOptions ?? { strict: true, jsx: ts.JsxEmit.Preserve, jsxImportSource: "@solidjs/web", moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, noEmit: true, skipLibCheck: true };

  /** @type {ts.LanguageServiceHost} */
  const host = {
    getCompilationSettings: () => compilerOptions,
    getScriptFileNames: () => files,
    getScriptVersion: f => String(docs.get(f.replaceAll("\\", "/"))?.version ?? 0),
    getScriptSnapshot: f => {
      const doc = docs.get(f.replaceAll("\\", "/"));
      if (doc) return ts.ScriptSnapshot.fromString(doc.text);
      const text = ts.sys.readFile(f);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => options.rootDir,
    getDefaultLibFileName: o => ts.getDefaultLibFilePath(o),
    fileExists: f => docs.has(f.replaceAll("\\", "/")) || ts.sys.fileExists(f),
    readFile: f => docs.get(f.replaceAll("\\", "/"))?.text ?? ts.sys.readFile(f),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath, // pnpm symlinks: solid-js's re-exports from @solidjs/signals resolve through the store
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames
  };
  const imports = boundedImports(files, options.rootDir, compilerOptions, host);
  host.resolveModuleNames = imports.resolve;
  const registry = ts.createDocumentRegistry();
  const service = ts.createLanguageService(host, registry);

  /** @type {ScaleResult | undefined} */
  let latest;
  const run = () => {
    const t0 = performance.now();
    const program = service.getProgram();
    if (!program) throw new Error("dataflow: no program");
    const analysis = new Analysis(program, files, { opaqueImports: imports.opaque });
    const diagnostics = analysis.run();
    latest = { diagnostics, elapsedMs: performance.now() - t0, facts: analysis.facts(), invalidatedFiles: [...files], reanalyzedFiles: [...files], timings: analysis.timings, programStats: { sources: program.getSourceFiles().length, declarations: program.getSourceFiles().filter(sf => sf.isDeclarationFile).length, nodes: program.getNodeCount(), symbols: program.getSymbolCount(), types: program.getTypeCount(), instantiations: program.getInstantiationCount() } };
    return latest;
  };

  return {
    check: run,
    update(path, text) {
      const key = path.replaceAll("\\", "/");
      const start = performance.now();
      const doc = docs.get(key);
      if (!doc) {
        // Preserve updates of imported declarations too. They have no cached
        // authored summary, so conservatively refresh the whole checked project.
        docs.set(key, { version: 1, text });
        return run();
      }
      const before = summarize(key, doc.text);
      const after = summarize(key, text);
      doc.version++; doc.text = text;
      if (latest && before.valid && after.valid && before.shape === after.shape) {
        try {
          latest = { ...relocate(latest, before.source, after.source), elapsedMs: performance.now() - start, invalidatedFiles: [key], reanalyzedFiles: [], summaryChanges: [], summaryHash: after.hash, timings: [] };
          return latest;
        } catch { /* An unmappable location requires a real check, not stale output. */ }
      }
      const result = run();
      return { ...result, elapsedMs: performance.now() - start, summaryChanges: [key], summaryHash: after.hash };
    },
    dispose() { service.dispose(); latest = undefined; docs.clear(); }
  };
}
