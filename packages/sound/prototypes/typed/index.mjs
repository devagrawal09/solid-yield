// @ts-check
// Prototype A — "typed": TypeScript remains the checker. A syntactic transform
// (transform.mjs) rewrites each checked file, in memory, into calls of the
// virtual module "solid-sound-typed" (runtime.d.ts) whose phantom types fold
// the reactive facts; the type errors that result carry a __MARKER__ naming
// the solid-sound code, and are mapped back to the original source here.
// Implements CONTRACT.md.
import ts from "typescript";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { Transformer } from "./transform.mjs";
import { BY_CODE } from "../../src/codes.mjs";

export const name = "typed";

const here = dirname(fileURLToPath(import.meta.url));
const RUNTIME_DTS = resolve(here, "runtime.d.ts");
const VIRTUAL_MODULE = "solid-sound-typed";

/** @type {Record<string, { kind: import("../../src/types.d.ts").SoundKind, message: (ctx: string, data: Record<string, unknown>) => string }>} */
const CODES = {
  STRICT_READ_UNTRACKED: { kind: "strict-read", message: ctx => `Reactive value ${ctx} is read directly in the component's setup and will not update. Move it into a tracking scope (JSX, a memo, or an effect's compute function), or into the handler that needs it.` },
  PENDING_ASYNC_UNTRACKED_READ: { kind: "async", message: ctx => `Async value ${ctx} is read in the component's setup; while it is pending there is nothing to read. Read it in a tracking scope (JSX, a memo, or an effect's compute function) under a Loading boundary.` },
  ASYNC_OUTSIDE_LOADING_BOUNDARY: { kind: "async", message: ctx => `The view rendered by ${ctx} may be pending and no Loading boundary covers it before the root; the root mount would be deferred with no fallback. Wrap the pending read in <Loading fallback={…}>, in the component or in a caller.` },
  ERROR_OUTSIDE_ERRORED_BOUNDARY: { kind: "error", message: (ctx, d) => `The view rendered by ${ctx} may fail${d.failures ? ` with ${d.failures}` : ""} and no Errored boundary covers it before the root; the failure would reach the root and halt reactivity. Wrap the failing work in <Errored fallback={…}>, in the component or in a caller.` },
  PENDING_ASYNC_FORBIDDEN_SCOPE: { kind: "async", message: () => `An effect function reads an async value, which serves the committed value and throws while uninitialized. Read it in the effect's compute function and pass the value.` },
  UNHANDLED_HANDLER_FAILURE: { kind: "error", message: (ctx, d) => `This handler (${ctx}) can fail${d.failures ? ` with ${d.failures}` : ""} and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler.` },
  SETUP_MAY_THROW: { kind: "error", message: (ctx, d) => `The component's setup may fail${d.failures ? ` with ${d.failures}` : ""} at ${ctx}; a component body only creates state. Move this work into a memo or rendered work under an Errored boundary, or into a handler, or handle the failure where it is produced.` }
};

/**
 * @param {import("../../src/types.d.ts").CheckerOptions} options
 * @returns {import("../../src/types.d.ts").Checker}
 */
export function createChecker(options) {
  const files = options.files.map(f => f.replaceAll("\\", "/"));
  const read = options.readFile ?? (p => (existsSync(p) ? readFileSync(p, "utf8") : undefined));
  /** @type {Map<string, { version: number, text: string }>} */
  const originals = new Map(files.map(f => [f, { version: 1, text: read(f) ?? "" }]));
  /** @type {Map<string, { version: number, text: string }>} */
  const virtuals = new Map();
  // The virtual program is for colors, not for the user's own type errors (their tsc does that): implicit-any
  // noise from worst-case members and recursive views is switched off there.
  const compilerOptions = { ...(options.compilerOptions ?? {}), noImplicitAny: false, noUncheckedSideEffectImports: false, paths: { ...(options.compilerOptions?.paths ?? {}), [VIRTUAL_MODULE]: [RUNTIME_DTS] } };
  const runtimeText = readFileSync(RUNTIME_DTS, "utf8");

  /** @param {Map<string, { version: number, text: string }>} docs @returns {ts.LanguageServiceHost} */
  const hostFor = docs => ({
    getCompilationSettings: () => compilerOptions,
    getScriptFileNames: () => files,
    getScriptVersion: f => String(docs.get(f.replaceAll("\\", "/"))?.version ?? (f === RUNTIME_DTS ? 1 : 0)),
    getScriptSnapshot: f => {
      const k = f.replaceAll("\\", "/");
      const doc = docs.get(k);
      if (doc) return ts.ScriptSnapshot.fromString(doc.text);
      if (k === RUNTIME_DTS) return ts.ScriptSnapshot.fromString(runtimeText);
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
    realpath: ts.sys.realpath,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames
  });
  const originalService = ts.createLanguageService(hostFor(originals), ts.createDocumentRegistry());
  const virtualService = ts.createLanguageService(hostFor(virtuals), ts.createDocumentRegistry());
  /** @type {Map<string, import("./transform.mjs").Output>} */
  let outputs = new Map();

  const run = () => {
    const t0 = performance.now();
    const program = originalService.getProgram();
    if (!program) throw new Error("typed: no program");
    const transformer = new Transformer(program, files);
    outputs = new Map();
    for (const f of files) {
      const sf = program.getSourceFile(f);
      if (!sf) continue;
      const out = transformer.transformFile(sf);
      outputs.set(f, out);
      const prev = virtuals.get(f);
      const text = out.text();
      if (!prev) virtuals.set(f, { version: 1, text });
      else if (prev.text !== text) { prev.version++; prev.text = text; }
    }
    const tTransform = performance.now();
    const vprogram = virtualService.getProgram();
    if (!vprogram) throw new Error("typed: no virtual program");
    /** @type {import("../../src/types.d.ts").SoundDiagnostic[]} */
    const diagnostics = [...transformer.diagnostics];
    const seen = new Set();
    let unclassified = 0;
    for (const f of files) {
      const out = outputs.get(f);
      const vsf = vprogram.getSourceFile(f);
      const osf = program.getSourceFile(f);
      if (!out || !vsf || !osf) continue;
      for (const d of [...virtualService.getSyntacticDiagnostics(f), ...virtualService.getSemanticDiagnostics(f)]) {
        const text = ts.flattenDiagnosticMessageText(d.messageText, "\n");
        // One type error may carry several markers (a view both pending and failing at a root).
        const codes = [...new Set([...text.matchAll(/__([A-Z_]+)__/g)].map(m => m[1]))].filter(c => c in CODES);
        const vpos = d.start ?? 0;
        const opos = out.toOriginal(vpos);
        const lc = osf.getLineAndCharacterOfPosition(Math.min(opos, osf.getFullText().length));
        const loc = { file: f, line: lc.line + 1, col: lc.character + 1 };
        const contextText = osf.getFullText().slice(opos, opos + 48).split("\n")[0].trim();
        const failures = /Fails<"([^>]+)">/.exec(text)?.[1]?.replaceAll('"', "");
        if (codes.length) {
          for (const code of codes) {
            const key = `${code}@${loc.line}:${loc.col}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const spec = CODES[code];
            diagnostics.push({ code, kind: spec.kind, severity: BY_CODE[code].severity, message: spec.message(`\`${contextText}\``, { failures }), loc, ownerName: ownerAt(osf, opos), data: { tsMessage: text, failures } });
          }
        } else {
          const key = `ts${d.code}@${loc.line}:${loc.col}`;
          if (seen.has(key)) continue;
          seen.add(key);
          unclassified++;
          diagnostics.push({ code: "UNANALYZED_BOUNDARY", kind: "analysis", severity: "warn", message: `The typed encoding could not accept this construct (an unclassified TypeScript error in the virtual program); it is not checked here and values from it are treated as the worst case.`, loc, ownerName: ownerAt(osf, opos), data: { unclassified: true, tsMessage: text, construct: contextText } });
        }
      }
      // Exported, never-rendered components: their colors are informational.
      const checker = vprogram.getTypeChecker();
      for (const [node, info] of transformer.components) {
        if (node.getSourceFile() !== osf || !info.exported || info.rendered || info.handedOff || info.callers > 0) continue;
        const vnode = nodeAt(vsf, out, node.getStart(osf));
        if (!vnode) continue;
        const type = checker.getTypeAtLocation(vnode);
        const sig = checker.getSignaturesOfType(type, ts.SignatureKind.Call)[0];
        const ret = sig ? checker.typeToString(sig.getReturnType(), undefined, ts.TypeFormatFlags.NoTruncation) : "";
        const m = /View<(true|false|boolean), (.+)>$/.exec(ret);
        if (m && (m[1] !== "false" || m[2] !== "never")) {
          const nameNode = node.name ?? (ts.isVariableDeclaration(node.parent) ? node.parent.name : node);
          const lc = osf.getLineAndCharacterOfPosition(nameNode.getStart(osf));
          diagnostics.push({ code: "COMPONENT_OBLIGATIONS_EXPORTED", kind: "analysis", severity: "info", message: `<${info.name}> is exported and nothing in this program renders it; its view is ${ret}: it may be ${[m[1] !== "false" ? "pending" : "", m[2] !== "never" ? `failing (${m[2]})` : ""].filter(Boolean).join(" and ")}. Its renderers must provide the Loading / Errored boundary.`, loc: { file: f, line: lc.line + 1, col: lc.character + 1 }, ownerName: `<${info.name}>`, data: { view: ret } });
        }
      }
    }
    return { diagnostics, elapsedMs: performance.now() - t0, data: { transformMs: tTransform - t0, unclassified } };
  };

  return {
    check: run,
    update(path, text) {
      const key = path.replaceAll("\\", "/");
      const doc = originals.get(key);
      if (doc) { doc.version++; doc.text = text; } else originals.set(key, { version: 1, text });
      return run();
    },
    dispose() { originalService.dispose(); virtualService.dispose(); }
  };
}

/** The enclosing function's name at an original offset, as the owner. @param {ts.SourceFile} sf @param {number} pos */
function ownerAt(sf, pos) {
  /** @type {string | undefined} */
  let owner;
  /** @param {ts.Node} n */
  const visit = n => {
    if (n.getStart(sf) <= pos && pos < n.getEnd()) {
      if (ts.isFunctionDeclaration(n) && n.name) owner = `<${n.name.text}>`;
      else if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name) && ts.isSourceFile(n.parent.parent.parent)) owner = `<${n.parent.name.text}>`;
      ts.forEachChild(n, visit);
    }
  };
  visit(sf);
  return owner;
}

/** The virtual node starting where an original node starts. @param {ts.SourceFile} vsf @param {import("./transform.mjs").Output} out @param {number} opos */
function nodeAt(vsf, out, opos) {
  let vpos = -1, at = 0;
  for (const p of out.pieces) { if (!p.inserted && opos >= p.orig && opos < p.orig + p.text.length) { vpos = at + (opos - p.orig); break; } at += p.text.length; }
  if (vpos < 0) return null;
  /** @type {ts.Node | null} */
  let hit = null;
  /** @param {ts.Node} n */
  const visit = n => { if (n.getStart(vsf) === vpos && (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n))) { hit = n; return; } if (n.getStart(vsf) <= vpos && vpos < n.getEnd()) ts.forEachChild(n, visit); };
  visit(vsf);
  return hit;
}
