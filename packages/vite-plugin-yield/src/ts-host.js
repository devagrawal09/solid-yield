// @ts-check
// One compiler host for the lowering's programs. Every pass of the lowering
// builds a fresh program; parsing and binding TypeScript's libs and the
// packages' declarations again each time dominated a check. A file read from
// disk (a lib, a package's or the library's declarations) is parsed once and
// reused while its text and the options that shape its tree are the same, as
// TypeScript's own language service reuses documents. The files the lowering
// is given (authored or lowered) are always parsed afresh.
import ts from "typescript";

/** @type {Map<string, { text: string, file: ts.SourceFile }>} */
const parsed = new Map();

/** The options that shape a source file's tree and binding (as TypeScript's
 * document registry keys them; `jsxImportSource` is not one, so the failure
 * inference's program and the lowering's share their libraries).
 * @param {ts.CompilerOptions} options */
const shape = options =>
  JSON.stringify([
    options.target,
    options.module,
    options.moduleResolution,
    options.moduleDetection,
    options.jsx,
    options.allowJs,
    options.strict,
    options.alwaysStrict,
    options.preserveConstEnums,
    options.isolatedModules,
    options.allowUnreachableCode,
    options.allowUnusedLabels
  ]);

/**
 * A compiler host over `files` (path → text) that reuses parsed files from disk.
 * @param {Map<string, string>} files @param {ts.CompilerOptions} options
 */
export function cachedHost(files, options) {
  const host = ts.createCompilerHost(options, true);
  const read = host.readFile.bind(host),
    exists = host.fileExists.bind(host);
  host.readFile = f => files.get(f) ?? read(f);
  host.fileExists = f => files.has(f) || exists(f);
  const key = shape(options);
  host.getSourceFile = (fileName, language) => {
    const text = host.readFile(fileName);
    if (text === undefined) return undefined;
    if (files.has(fileName)) return ts.createSourceFile(fileName, text, language, true);
    const id = key + "\0" + fileName + "\0" + JSON.stringify(language);
    const hit = parsed.get(id);
    if (hit && hit.text === text) return hit.file;
    const file = ts.createSourceFile(fileName, text, language, true);
    parsed.set(id, { text, file });
    return file;
  };
  return host;
}
