// @ts-check
import ts from "typescript";
import { createHash } from "node:crypto";
const printer = ts.createPrinter({ removeComments: true });
/** @typedef {ts.SourceFile & { pragmas?: Map<string, unknown>, parseDiagnostics?: readonly ts.Diagnostic[] }} ParsedSource */

/** Remove source offsets from compiler directives, but keep their meaning.
 * @param {unknown} value @returns {unknown} */
function clean(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clean);
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "pos" && key !== "end").map(([key, item]) => [key, clean(item)]));
}

/** A conservative semantic summary: includes private bodies, JSX text and ASI.
 * It may invalidate too much, but never treats a changed body as unchanged.
 * @param {string} path @param {string} text */
export function summarize(path, text) {
  const source = /** @type {ParsedSource} */ (ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true));
  const refs = [source.referencedFiles, source.typeReferenceDirectives, source.libReferenceDirectives].map(list => list.map(r => r.fileName));
  const directives = clean([...(source.pragmas ?? [])]);
  const shape = JSON.stringify([refs, source.hasNoDefaultLib, directives]) + printer.printFile(source);
  return { source, shape, valid: !source.parseDiagnostics?.length, hash: createHash("sha256").update(shape).digest("hex") };
}

/** Relocate unchanged syntax without mutating a previous CheckResult.
 * @template T @param {T} result @param {ts.SourceFile} before @param {ts.SourceFile} after @returns {T} */
export function relocate(result, before, after) {
  /** @type {Map<number, number>} */
  const starts = new Map(), ends = new Map();
  /** @param {ts.Node} a @param {ts.Node} b */
  const pair = (a, b) => {
    starts.set(a.getStart(before), b.getStart(after)); ends.set(a.getEnd(), b.getEnd());
    /** @type {ts.Node[]} */
    const aa = [], bb = [];
    ts.forEachChild(a, n => { aa.push(n); }); ts.forEachChild(b, n => { bb.push(n); });
    if (aa.length !== bb.length) throw new Error("dataflow: unchanged syntax has different children");
    aa.forEach((n, i) => pair(n, bb[i]));
  };
  pair(before, after);
  /** @param {number} line @param {number} col @param {Map<number, number>} map */
  const point = (line, col, map) => {
    const pos = before.getPositionOfLineAndCharacter(line - 1, col - 1);
    const next = map.get(pos);
    if (next === undefined) throw new Error("dataflow: cannot relocate diagnostic");
    const lc = after.getLineAndCharacterOfPosition(next);
    return [lc.line + 1, lc.character + 1];
  };
  /** @param {unknown} value @returns {unknown} */
  const visit = value => {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(visit);
    const record = /** @type {Record<string, unknown>} */ (value);
    if (record.file === before.fileName && typeof record.line === "number" && typeof record.col === "number") {
      const [line, col] = point(record.line, record.col, starts);
      if (typeof record.endLine === "number" && typeof record.endCol === "number") {
        const [endLine, endCol] = point(record.endLine, record.endCol, ends);
        return { ...record, line, col, endLine, endCol };
      }
      return { ...record, line, col };
    }
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, visit(item)]));
  };
  return /** @type {T} */ (visit(result));
}
