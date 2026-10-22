// @ts-check
// Prototype B — "dataflow": a dedicated reactive / async / failure analysis over
// the TypeScript AST with the type checker as an oracle; diagnostics are
// produced directly (see analyze.mjs). Implements CONTRACT.md.
import ts from "typescript";
import { existsSync, readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { Analysis } from "./analyze.mjs";

export const name = "dataflow";

/**
 * @param {import("../../src/types.d.ts").CheckerOptions} options
 * @returns {import("../../src/types.d.ts").Checker}
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
  const registry = ts.createDocumentRegistry();
  const service = ts.createLanguageService(host, registry);

  const run = () => {
    const t0 = performance.now();
    const program = service.getProgram();
    if (!program) throw new Error("dataflow: no program");
    const analysis = new Analysis(program, files);
    const diagnostics = analysis.run();
    return { diagnostics, elapsedMs: performance.now() - t0, facts: analysis.facts() };
  };

  return {
    check: run,
    update(path, text) {
      const key = path.replaceAll("\\", "/");
      const doc = docs.get(key);
      if (doc) { doc.version++; doc.text = text; }
      else docs.set(key, { version: 1, text });
      return run();
    },
    dispose() { service.dispose(); }
  };
}
