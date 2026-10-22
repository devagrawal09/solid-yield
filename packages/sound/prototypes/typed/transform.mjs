// @ts-check
// Prototype A — the syntactic transform. The user's plain Solid is rewritten,
// in memory, into calls of the virtual module "solid-sound-typed"
// (runtime.d.ts) so that TypeScript's type system folds pending / failure
// colors over dependency lists and the JSX tree. The transform decides SCOPE
// (setup / tracking / handler) syntactically and extracts dependency lists;
// two pre-passes supply what types cannot express: failure sets (TypeScript
// has no throw types) and which props are reactive (TypeScript checks a
// component body once, not per caller). Diagnostics that are not type-level
// (partial-check warnings, writes in owned scopes) are emitted here directly.
//
// Shared with prototype B: solid.mjs (recognition of Solid imports and
// platform contracts through the type checker) — infrastructure, not IR.
import ts from "typescript";
import { DETACHED_CALLBACKS, PLATFORM_THROWS, PROMISE_METHODS, SAFE_PLATFORM, SYNC_CALLBACK_METHODS, isEventAttribute, isFunctionLike, isPromiseType, resolveAlias, solidApiOf, stripParens } from "../dataflow/solid.mjs";

/** @typedef {import("../../src/types.d.ts").SoundDiagnostic} SoundDiagnostic */
/** @typedef {import("../../src/types.d.ts").Loc} Loc */

/**
 * @typedef {(
 *   | { kind: "signal", name: string }
 *   | { kind: "setter", name: string }
 *   | { kind: "memo", name: string, compute: ts.Node | null }
 *   | { kind: "helper", node: ts.FunctionLikeDeclaration, factory: boolean }
 *   | { kind: "component", info: ComponentInfo }
 *   | { kind: "props", info: ComponentInfo }
 *   | { kind: "propMember", info: ComponentInfo, name: string }
 *   | { kind: "object", node: ts.ObjectLiteralExpression }
 *   | { kind: "worst" }
 *   | { kind: "accessor" }
 *   | { kind: "promise", rejects: Set<string> }
 *   | { kind: "caught", failures: Set<string> }
 * )} Binding
 */

/**
 * @typedef {{
 *   name: string,
 *   node: ts.FunctionLikeDeclaration,
 *   exported: boolean,
 *   propsWorst: boolean,
 *   reactiveProps: Set<string>,
 *   callbackProps: Map<string, ts.Expression[]>,
 *   callers: number,
 *   handedOff: boolean,
 *   rendered: boolean
 * }} ComponentInfo
 */

/** @typedef {{ text: string, orig: number, inserted: boolean }} Piece */

const MAX_DEPTH = 16;

/** The virtual text of one file and the map back to the original. */
export class Output {
  /** @param {string} original */
  constructor(original) {
    this.original = original;
    /** @type {Piece[]} */
    this.pieces = [];
    this.length = 0;
    this.cursor = 0;
  }
  /** Copy original text [from, to). @param {number} from @param {number} to */
  copy(from, to) {
    if (to <= from) return;
    this.pieces.push({ text: this.original.slice(from, to), orig: from, inserted: false });
    this.length += to - from;
  }
  /** Insert generated text, mapped to the original position `anchor`. @param {string} text @param {number} anchor */
  insert(text, anchor) {
    if (!text) return;
    this.pieces.push({ text, orig: anchor, inserted: true });
    this.length += text.length;
  }
  text() { return this.pieces.map(p => p.text).join(""); }
  /** @param {number} vpos virtual offset @returns {number} original offset */
  toOriginal(vpos) {
    let at = 0;
    for (const p of this.pieces) {
      if (vpos < at + p.text.length) return p.inserted ? p.orig : p.orig + (vpos - at);
      at += p.text.length;
    }
    return this.original.length;
  }
}

export class Transformer {
  /**
   * @param {ts.Program} program the ORIGINAL program (resolution oracle)
   * @param {readonly string[]} files
   */
  constructor(program, files) {
    this.program = program;
    this.checker = program.getTypeChecker();
    this.files = new Set(files.map(f => f.replaceAll("\\", "/")));
    /** @type {Map<ts.Symbol, Binding>} */
    this.bindings = new Map();
    /** @type {Map<ts.Node, ComponentInfo>} */
    this.components = new Map();
    /** @type {SoundDiagnostic[]} */
    this.diagnostics = [];
    /** @type {Set<ts.Node>} */
    this.active = new Set();
    /** @type {Map<ts.Node, Set<string>>} */
    this.failureCache = new Map();
    this.prepare();
  }

  // ---- utilities ---------------------------------------------------------------
  /** @param {ts.Node} node @returns {Loc} */
  loc(node) {
    const sf = node.getSourceFile();
    const s = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    const e = sf.getLineAndCharacterOfPosition(node.getEnd());
    return { file: sf.fileName, line: s.line + 1, col: s.character + 1, endLine: e.line + 1, endCol: e.character + 1 };
  }
  /** @param {ts.Node} n */
  symbolOf(n) { return resolveAlias(this.checker.getSymbolAtLocation(n), this.checker); }
  /** @param {ts.Node} n */
  bindingOf(n) { const s = this.symbolOf(n); return s ? this.bindings.get(s) : undefined; }
  /** @param {ts.Node} node @param {string} construct @param {string} assumption @param {string} owner */
  warn(node, construct, assumption, owner) {
    this.diagnostics.push({ code: "UNANALYZED_BOUNDARY", kind: "analysis", severity: "warn", message: `${construct} is outside the checked subset; ${assumption} Nothing here is trusted: downstream obligations still surface.`, loc: this.loc(node), ownerName: owner, data: { construct } });
  }
  /** @param {string} t */
  short(t) { return t.length > 60 ? t.slice(0, 57) + "…" : t; }
  /** @param {ts.SourceFile} sf */
  isProjectFile(sf) { return this.files.has(sf.fileName.replaceAll("\\", "/")); }

  // ---- pre-pass: bindings, components, callers -------------------------------------
  prepare() {
    for (const sf of this.program.getSourceFiles()) if (this.isProjectFile(sf)) this.collect(sf);
    for (const sf of this.program.getSourceFiles()) if (this.isProjectFile(sf)) this.collectCallers(sf);
  }

  /** @param {ts.SourceFile} sf */
  collect(sf) {
    /** @param {ts.Node} n */
    const visit = n => {
      if (ts.isFunctionDeclaration(n) && n.name && n.body) this.bindFunction(n.name, n);
      else if (ts.isVariableDeclaration(n) && n.initializer) this.bindVariable(n);
      else if (ts.isCatchClause(n) && n.variableDeclaration && ts.isIdentifier(n.variableDeclaration.name)) {
        const s = this.symbolOf(n.variableDeclaration.name);
        if (s) this.bindings.set(s, { kind: "caught", failures: new Set() }); // filled by failuresOf
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }

  /** @param {ts.Identifier} name @param {ts.FunctionLikeDeclaration} fn */
  bindFunction(name, fn) {
    const s = this.symbolOf(name);
    if (!s || this.bindings.has(s)) return;
    const moduleLevel = ts.isFunctionDeclaration(fn) ? ts.isSourceFile(fn.parent) : (ts.isVariableDeclaration(fn.parent) && ts.isSourceFile(fn.parent.parent.parent.parent));
    if (moduleLevel && this.returnsJsx(fn)) {
      /** @type {ComponentInfo} */
      const info = { name: name.text, node: fn, exported: this.isExported(fn), propsWorst: false, reactiveProps: new Set(), callbackProps: new Map(), callers: 0, handedOff: false, rendered: false };
      this.components.set(fn, info);
      this.bindings.set(s, { kind: "component", info });
      const p = fn.parameters[0];
      if (p && ts.isIdentifier(p.name)) { const ps = this.symbolOf(p.name); if (ps) this.bindings.set(ps, { kind: "props", info }); }
      return;
    }
    this.bindings.set(s, { kind: "helper", node: fn, factory: this.isStateFactory(fn) });
  }

  /** @param {ts.VariableDeclaration} d */
  bindVariable(d) {
    const init = stripParens(/** @type {ts.Expression} */ (d.initializer));
    if (ts.isArrayBindingPattern(d.name) && ts.isCallExpression(init)) {
      const api = solidApiOf(init.expression, this.checker);
      if (api?.api === "createSignal") {
        const [g, s] = d.name.elements;
        if (g && !ts.isOmittedExpression(g) && ts.isIdentifier(g.name)) { const sym = this.symbolOf(g.name); if (sym) this.bindings.set(sym, { kind: "signal", name: g.name.text }); }
        if (s && !ts.isOmittedExpression(s) && ts.isIdentifier(s.name)) { const sym = this.symbolOf(s.name); if (sym) this.bindings.set(sym, { kind: "setter", name: s.name.text }); }
        return;
      }
      if (this.isWorstCall(init)) for (const el of d.name.elements) if (!ts.isOmittedExpression(el) && ts.isIdentifier(el.name)) { const sym = this.symbolOf(el.name); if (sym) this.bindings.set(sym, { kind: "worst" }); }
      return;
    }
    if (ts.isObjectBindingPattern(d.name) && ts.isIdentifier(init)) {
      const base = this.bindingOf(init);
      if (base?.kind === "props") for (const el of d.name.elements) if (ts.isIdentifier(el.name)) { const s = this.symbolOf(el.name); if (s) this.bindings.set(s, { kind: "propMember", info: base.info, name: (el.propertyName ?? el.name).getText() }); }
      return;
    }
    if (!ts.isIdentifier(d.name)) return;
    const sym = this.symbolOf(d.name);
    if (!sym) return;
    if (isFunctionLike(init)) { this.bindFunction(d.name, /** @type {ts.FunctionLikeDeclaration} */ (init)); return; }
    if (ts.isCallExpression(init)) {
      const api = solidApiOf(init.expression, this.checker);
      if (api && (api.api === "createMemo" || api.api === "createAsync")) { this.bindings.set(sym, { kind: "memo", name: d.name.text, compute: init.arguments[0] ? stripParens(init.arguments[0]) : null }); return; }
      if (this.isWorstCall(init)) { this.bindings.set(sym, { kind: "worst" }); return; }
      if (this.isPromiseProducing(init)) { this.bindings.set(sym, { kind: "promise", rejects: new Set(["unknown"]) }); return; }
      return;
    }
    if (ts.isObjectLiteralExpression(init)) { this.bindings.set(sym, { kind: "object", node: init }); return; }
  }

  /** A call whose result is a worst-case value: an unmodeled Solid API or a state factory. @param {ts.CallExpression} call */
  isWorstCall(call) {
    const api = solidApiOf(call.expression, this.checker);
    if (api) return !["createSignal", "createMemo", "createAsync", "createEffect", "createRenderEffect", "untrack", "createContext", "render", "hydrate"].includes(api.api);
    const callee = stripParens(call.expression);
    if (ts.isIdentifier(callee)) {
      const b = this.bindingOf(callee);
      if (b?.kind === "helper") return b.factory;
      if (b?.kind === "worst") return true;
    }
    if (ts.isPropertyAccessExpression(callee)) return this.rootBinding(callee)?.kind === "worst";
    return false;
  }

  /** A call with no analyzable body whose type is a promise (fetch, an injected api): a kept promise rejecting with unknown. @param {ts.CallExpression} call */
  isPromiseProducing(call) {
    const callee = stripParens(call.expression);
    if (ts.isIdentifier(callee) && this.bindingOf(callee)?.kind === "helper") return false;
    return isPromiseType(this.checker.getTypeAtLocation(call), this.checker);
  }

  /** The binding of the root identifier of a member chain. @param {ts.Expression} e */
  rootBinding(e) {
    let x = stripParens(e);
    while (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x) || ts.isCallExpression(x)) x = stripParens(x.expression);
    return ts.isIdentifier(x) ? this.bindingOf(x) : undefined;
  }

  /** @param {ts.FunctionLikeDeclaration} fn */
  isStateFactory(fn) {
    let found = false;
    /** @param {ts.Node} n */
    const visit = n => {
      if (found) return;
      if (ts.isCallExpression(n)) { const api = solidApiOf(n.expression, this.checker); if (api && /^create(Signal|Memo|Effect|Store|OptimisticStore|Root|Context|RenderEffect)$/.test(api.api)) { found = true; return; } }
      ts.forEachChild(n, visit);
    };
    if (fn.body) visit(fn.body);
    return found;
  }

  /** @param {ts.FunctionLikeDeclaration} fn */
  isExported(fn) {
    /** @param {ts.Node} n */
    const has = n => !!(ts.canHaveModifiers(n) && ts.getModifiers(n)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword));
    if (ts.isFunctionDeclaration(fn)) return has(fn);
    const stmt = fn.parent?.parent?.parent;
    return !!stmt && ts.isVariableStatement(stmt) && has(stmt);
  }

  /** @param {ts.FunctionLikeDeclaration} fn */
  returnsJsx(fn) {
    if (!fn.body || fn.asteriskToken || (ts.canHaveModifiers(fn) && ts.getModifiers(fn)?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword))) return false;
    if (!ts.isBlock(fn.body)) return this.isViewExpr(fn.body);
    let found = false;
    /** @param {ts.Node} n */
    const visit = n => { if (found || isFunctionLike(n)) return; if (ts.isReturnStatement(n) && n.expression && this.isViewExpr(n.expression)) found = true; else ts.forEachChild(n, visit); };
    visit(fn.body);
    return found;
  }

  /** @param {ts.Expression} e */
  isViewExpr(e) {
    const x = stripParens(e);
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) return true;
    if (ts.isConditionalExpression(x)) return this.isViewExpr(x.whenTrue) || this.isViewExpr(x.whenFalse);
    if (ts.isBinaryExpression(x) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(x.operatorToken.kind)) return this.isViewExpr(x.right) || this.isViewExpr(x.left);
    return false;
  }

  /** Which props are reactive (D-119: from the callers) and which functions callback props receive. @param {ts.SourceFile} sf */
  collectCallers(sf) {
    /** @param {ts.Node} n */
    const visit = n => {
      if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
        const tag = n.tagName;
        const b = ts.isIdentifier(tag) ? this.bindingOf(tag) : undefined;
        if (b?.kind === "component") {
          b.info.callers++;
          for (const a of n.attributes.properties) {
            if (ts.isJsxSpreadAttribute(a)) { b.info.propsWorst = true; continue; }
            const name = a.name.getText();
            const init = a.initializer;
            if (!init || !ts.isJsxExpression(init) || !init.expression) continue;
            const x = stripParens(init.expression);
            if (isFunctionLike(x)) { const list = b.info.callbackProps.get(name) ?? []; list.push(x); b.info.callbackProps.set(name, list); continue; }
            if (this.isReactiveExpr(x)) b.info.reactiveProps.add(name);
            // A forwarded callback (onPick={props.onPick}) or a setter / helper passed by name.
            const list = b.info.callbackProps.get(name) ?? []; list.push(x); b.info.callbackProps.set(name, list);
          }
        }
      } else if (ts.isIdentifier(n)) {
        const b = ts.isShorthandPropertyAssignment(n.parent) ? this.shorthandBinding(n.parent) : this.bindingOf(n);
        if (b?.kind === "component" && !this.isTagOrDeclaration(n) && !this.isRenderArgument(n)) b.info.handedOff = true;
        if (b?.kind === "component" && this.isRenderArgument(n)) b.info.rendered = true;
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }

  /** @param {ts.ShorthandPropertyAssignment} p */
  shorthandBinding(p) { const s = resolveAlias(this.checker.getShorthandAssignmentValueSymbol(p), this.checker); return s ? this.bindings.get(s) : undefined; }

  /** @param {ts.Identifier} n */
  isTagOrDeclaration(n) {
    const p = n.parent;
    return ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p) || ts.isFunctionDeclaration(p) || ts.isVariableDeclaration(p) || ts.isImportSpecifier(p) || ts.isExportSpecifier(p);
  }

  /** @param {ts.Identifier} n */
  isRenderArgument(n) {
    const p = n.parent;
    if (ts.isCallExpression(p) && p.arguments[0] === n) { const api = solidApiOf(p.expression, this.checker); return !!api && (api.api === "render" || api.api === "hydrate"); }
    return false;
  }

  /** An expression that reads or carries a reactive value. @param {ts.Node} e */
  isReactiveExpr(e) {
    let found = false;
    /** @param {ts.Node} n */
    const visit = n => {
      if (found) return;
      if (isFunctionLike(n)) return;
      if (ts.isIdentifier(n)) {
        const b = this.bindingOf(n);
        if (b && (b.kind === "signal" || b.kind === "memo" || b.kind === "accessor" || b.kind === "worst")) { found = true; return; }
        if (b?.kind === "props" && ts.isPropertyAccessExpression(n.parent) && n.parent.expression === n && b.info.reactiveProps.has(n.parent.name.text)) { found = true; return; }
        if (b?.kind === "helper" && this.depsOf(b.node.body ?? b.node, 0).length) { found = true; return; }
      }
      ts.forEachChild(n, visit);
    };
    visit(e);
    return found;
  }

  // ---- dependency lists --------------------------------------------------------------
  /**
   * The reactive dependencies an expression reads or carries: identifiers bound
   * to sources / worst-case values, transitively through sync helpers and getters.
   * @param {ts.Node} node @param {number} depth @returns {string[]}
   */
  depsOf(node, depth) {
    /** @type {Set<string>} */
    const out = new Set();
    if (depth > MAX_DEPTH) return [];
    /** @param {ts.Node} n @param {boolean} inSyncCallback */
    const visit = (n, inSyncCallback) => {
      if (isFunctionLike(n) && !inSyncCallback) return; // a nested function is not run here
      if (ts.isIdentifier(n)) {
        const b = this.bindingOf(n);
        if (b && (b.kind === "signal" || b.kind === "memo" || b.kind === "accessor" || b.kind === "worst")) {
          if (!(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) && !ts.isVariableDeclaration(n.parent) && !ts.isParameter(n.parent) && !ts.isBindingElement(n.parent)) out.add(n.text);
        } else if (b?.kind === "helper" && ts.isCallExpression(n.parent) && n.parent.expression === n && !this.active.has(b.node)) {
          this.active.add(b.node);
          for (const d of this.depsOf(b.node.body ?? b.node, depth + 1)) out.add(d);
          this.active.delete(b.node);
        } else if (b?.kind === "helper" && this.isSyncCallbackArgument(n)) {
          if (!this.active.has(b.node)) { this.active.add(b.node); for (const d of this.depsOf(b.node.body ?? b.node, depth + 1)) out.add(d); this.active.delete(b.node); }
        } else if (b?.kind === "object" && ts.isPropertyAccessExpression(n.parent) && n.parent.expression === n) {
          const getter = this.getterOf(b.node, n.parent.name.text);
          if (getter?.body && !this.active.has(getter)) { this.active.add(getter); for (const d of this.depsOf(getter.body, depth + 1)) out.add(d); this.active.delete(getter); }
        }
      }
      if (ts.isCallExpression(n)) {
        const callee = stripParens(n.expression);
        const isSync = ts.isPropertyAccessExpression(callee) && SYNC_CALLBACK_METHODS.has(callee.name.text) && this.isLibCall(n);
        if (isFunctionLike(callee)) visit(callee, true); else visit(n.expression, false);
        for (const a of n.arguments) visit(a, isSync && isFunctionLike(stripParens(a)) ? true : false);
        return;
      }
      if (isFunctionLike(n) && inSyncCallback) { if (n.body) visit(n.body, false); return; }
      ts.forEachChild(n, ch => visit(ch, false));
    };
    visit(node, node.kind === ts.SyntaxKind.Block || isFunctionLike(node) ? true : false);
    return [...out];
  }

  /** @param {ts.Identifier} n */
  isSyncCallbackArgument(n) {
    const p = n.parent;
    return ts.isCallExpression(p) && p.arguments.includes(n) && ts.isPropertyAccessExpression(p.expression) && SYNC_CALLBACK_METHODS.has(p.expression.name.text);
  }

  /** @param {ts.ObjectLiteralExpression} o @param {string} name */
  getterOf(o, name) {
    for (const p of o.properties) if (ts.isGetAccessorDeclaration(p) && p.name.getText() === name) return p;
    return null;
  }

  // ---- failure pre-pass ---------------------------------------------------------------
  /**
   * Failure type names (or "unknown") a function body or expression may raise
   * synchronously — or, for an async function, reject with. TypeScript has no
   * throw types, so this is computed here and handed to the types as `Fails<E>`.
   * @param {ts.Node} node @param {number} depth
   * @returns {Set<string>}
   */
  failuresOf(node, depth) {
    const cached = this.failureCache.get(node);
    if (cached) return cached;
    if (depth > MAX_DEPTH || this.active.has(node)) return new Set();
    this.active.add(node);
    /** @type {Set<string>} */
    const out = new Set();
    /** @param {ts.Node} n */
    const visit = n => {
      if (isFunctionLike(n) && n !== node) return; // defined, not run
      if (ts.isThrowStatement(n)) { for (const f of this.thrownNames(n.expression)) out.add(f); return; }
      if (ts.isTryStatement(n)) {
        const inner = this.failuresOf(n.tryBlock, depth + 1);
        if (n.catchClause) {
          if (n.catchClause.variableDeclaration && ts.isIdentifier(n.catchClause.variableDeclaration.name)) { const s = this.symbolOf(n.catchClause.variableDeclaration.name); if (s) this.bindings.set(s, { kind: "caught", failures: inner }); }
          for (const f of this.failuresOf(n.catchClause.block, depth + 1)) out.add(f);
        } else for (const f of inner) out.add(f);
        if (n.finallyBlock) for (const f of this.failuresOf(n.finallyBlock, depth + 1)) out.add(f);
        return;
      }
      if (ts.isAwaitExpression(n)) { for (const f of this.rejectsOf(n.expression, depth + 1)) out.add(f); visit(n.expression); return; }
      if (ts.isExpressionStatement(n) && this.producesPromise(n.expression)) { for (const f of this.rejectsOf(n.expression, depth + 1)) out.add(f); }
      if (ts.isReturnStatement(n) && n.expression && this.producesPromise(n.expression)) { for (const f of this.rejectsOf(n.expression, depth + 1)) out.add(f); }
      if (ts.isCallExpression(n)) { for (const f of this.callFailures(n, depth + 1)) out.add(f); }
      ts.forEachChild(n, visit);
    };
    if (isFunctionLike(node)) {
      const fn = /** @type {ts.FunctionLikeDeclaration} */ (node);
      if (fn.body) { visit(fn.body); if (!ts.isBlock(fn.body) && this.producesPromise(fn.body)) for (const f of this.rejectsOf(fn.body, depth + 1)) out.add(f); }
    } else visit(node);
    this.active.delete(node);
    this.failureCache.set(node, out);
    return out;
  }

  /** @param {ts.Expression} e */
  thrownNames(e) {
    const x = stripParens(e);
    if (ts.isNewExpression(x)) return [x.expression.getText()];
    if (ts.isIdentifier(x)) { const b = this.bindingOf(x); if (b?.kind === "caught") return [...b.failures]; }
    if (ts.isStringLiteral(x) || ts.isTemplateExpression(x) || ts.isNoSubstitutionTemplateLiteral(x)) return ["string"];
    const name = this.checker.getTypeAtLocation(x).getSymbol()?.getName();
    return [name && !name.startsWith("__") ? name : "unknown"];
  }

  /** @param {ts.Expression} e */
  producesPromise(e) {
    const x = stripParens(e);
    if (ts.isCallExpression(x) || ts.isIdentifier(x) || ts.isAwaitExpression(x)) {
      if (ts.isAwaitExpression(x)) return false;
      if (ts.isIdentifier(x)) return this.bindingOf(x)?.kind === "promise";
      return isPromiseType(this.checker.getTypeAtLocation(x), this.checker) || (ts.isIdentifier(stripParens(x.expression)) && this.bindingOf(stripParens(x.expression))?.kind === "helper" && this.isAsyncFn(/** @type {Binding & { kind: "helper" }} */ (this.bindingOf(stripParens(x.expression))).node));
    }
    return false;
  }

  /** @param {ts.FunctionLikeDeclaration} fn */
  isAsyncFn(fn) { return !!(ts.canHaveModifiers(fn) && ts.getModifiers(fn)?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)); }

  /** The rejection set of a promise-valued expression. @param {ts.Expression} e @param {number} depth @returns {Set<string>} */
  rejectsOf(e, depth) {
    const x = stripParens(e);
    if (ts.isIdentifier(x)) { const b = this.bindingOf(x); return b?.kind === "promise" ? new Set(b.rejects) : new Set(); }
    if (ts.isCallExpression(x)) {
      const callee = stripParens(x.expression);
      if (ts.isPropertyAccessExpression(callee) && PROMISE_METHODS.has(callee.name.text) && this.isLibCall(x)) {
        const receiver = this.rejectsOf(callee.expression, depth);
        /** @param {ts.Expression | undefined} a */
        const cont = a => (a ? (isFunctionLike(stripParens(a)) ? this.failuresOf(stripParens(a), depth + 1) : this.calleeFailures(stripParens(a), depth + 1)) : null);
        if (callee.name.text === "then") { const ok = cont(x.arguments[0]) ?? new Set(); const err = x.arguments[1] ? cont(x.arguments[1]) : null; return err ? new Set([...ok, ...err]) : new Set([...receiver, ...ok]); }
        if (callee.name.text === "catch") return cont(x.arguments[0]) ?? new Set();
        return new Set([...receiver, ...(cont(x.arguments[0]) ?? [])]);
      }
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === "Promise" && this.isLibGlobal(callee.expression)) {
        if (callee.name.text === "reject") return new Set(x.arguments[0] ? this.thrownNames(x.arguments[0]) : ["unknown"]);
        return new Set();
      }
      if (ts.isIdentifier(callee)) {
        const b = this.bindingOf(callee);
        if (b?.kind === "helper") return this.isAsyncFn(b.node) ? this.failuresOf(b.node, depth + 1) : new Set();
        if (b?.kind === "worst") return new Set(["unknown"]);
        if (b?.kind === "propMember") return this.propCallFailures(b.info, b.name, depth + 1);
      }
      if (ts.isPropertyAccessExpression(callee) && this.rootBinding(callee)?.kind === "worst") return new Set(["unknown"]);
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && this.bindingOf(callee.expression)?.kind === "props") {
        return this.propCallFailures(/** @type {Binding & { kind: "props" }} */ (this.bindingOf(callee.expression)).info, callee.name.text, depth + 1);
      }
      if (isPromiseType(this.checker.getTypeAtLocation(x), this.checker)) return new Set(["unknown"]);
    }
    if (ts.isNewExpression(x) && x.expression.getText() === "Promise" && x.arguments?.[0] && isFunctionLike(stripParens(x.arguments[0]))) return this.failuresOf(stripParens(x.arguments[0]), depth + 1);
    return new Set();
  }

  /** The synchronous failures of one call. @param {ts.CallExpression} call @param {number} depth @returns {Set<string>} */
  callFailures(call, depth) {
    const callee = stripParens(call.expression);
    const api = ts.isIdentifier(callee) ? solidApiOf(callee, this.checker) : ts.isPropertyAccessExpression(callee) ? solidApiOf(callee.name, this.checker) : null;
    if (api) return new Set();
    if (ts.isIdentifier(callee)) {
      const b = this.bindingOf(callee);
      if (b) {
        if (b.kind === "propMember") return this.propCallFailures(b.info, b.name, depth);
        if (b.kind === "helper") return b.factory ? new Set() : (this.isAsyncFn(b.node) ? new Set() : this.failuresOf(b.node, depth));
        if (b.kind === "memo") return this.sourceFailures(b, depth);
        if (b.kind === "worst") return isPromiseType(this.checker.getTypeAtLocation(call), this.checker) ? new Set() : new Set(["unknown"]);
        return new Set();
      }
      const decl = this.symbolOf(callee)?.declarations?.[0];
      if (decl && ts.isParameter(decl)) return new Set(["unknown"]);
      return this.platformFailures(call, callee.text);
    }
    if (ts.isPropertyAccessExpression(callee)) {
      const name = callee.name.text;
      if (PROMISE_METHODS.has(name) && this.isLibCall(call)) return new Set();
      const target = stripParens(callee.expression);
      if (ts.isIdentifier(target)) {
        const tb = this.bindingOf(target);
        if (tb?.kind === "props") return this.propCallFailures(tb.info, name, depth);
        if (tb?.kind === "object") { const m = tb.node.properties.find(p => p.name?.getText() === name); if (m && (ts.isMethodDeclaration(m) || ts.isGetAccessorDeclaration(m))) return this.failuresOf(m, depth); if (m && ts.isPropertyAssignment(m) && isFunctionLike(stripParens(m.initializer))) return this.failuresOf(stripParens(m.initializer), depth); return new Set(); }
        if (target.text === "JSON" && PLATFORM_THROWS.has(name) && this.isLibGlobal(target)) return new Set([/** @type {string} */ (PLATFORM_THROWS.get(name))]);
        if (target.text === "Promise" && this.isLibGlobal(target)) return new Set();
      }
      if (this.rootBinding(callee)?.kind === "worst") return isPromiseType(this.checker.getTypeAtLocation(call), this.checker) ? new Set() : new Set(["unknown"]);
      return this.platformFailures(call, name);
    }
    if (isFunctionLike(callee)) return this.failuresOf(callee, depth); // an IIFE
    return new Set();
  }

  /** @param {ts.Expression} callee @param {number} depth */
  calleeFailures(callee, depth) {
    if (ts.isIdentifier(callee)) { const b = this.bindingOf(callee); if (b?.kind === "helper") return this.failuresOf(b.node, depth); if (b?.kind === "setter") return new Set(); }
    return new Set(["unknown"]);
  }

  /** A read of a memo may raise what its compute raises (and what its sources raise). @param {Binding & { kind: "memo" }} b @param {number} depth */
  sourceFailures(b, depth) {
    if (!b.compute || !isFunctionLike(b.compute)) return new Set(["unknown"]);
    const own = this.failuresOf(b.compute, depth);
    /** @type {Set<string>} */
    const out = new Set(own);
    for (const d of this.depsOf(b.compute, depth)) {
      const sym = this.resolveDepName(d, b.compute);
      const db = sym ? this.bindings.get(sym) : undefined;
      if (db?.kind === "worst") out.add("unknown");
      else if (db?.kind === "memo" && db !== b) for (const f of this.sourceFailures(db, depth + 1)) out.add(f);
    }
    if (this.isAsyncFn(/** @type {ts.FunctionLikeDeclaration} */ (b.compute)) === false && this.returnsPromiseCall(/** @type {ts.FunctionLikeDeclaration} */ (b.compute))) out.add("unknown");
    return out;
  }

  /** @param {ts.FunctionLikeDeclaration} fn */
  returnsPromiseCall(fn) {
    if (!fn.body) return false;
    if (!ts.isBlock(fn.body)) return ts.isCallExpression(stripParens(fn.body)) && this.rootBinding(stripParens(fn.body))?.kind === "worst" && isPromiseType(this.checker.getTypeAtLocation(fn.body), this.checker);
    let found = false;
    /** @param {ts.Node} n */
    const visit = n => { if (found || isFunctionLike(n)) return; if (ts.isReturnStatement(n) && n.expression && ts.isCallExpression(stripParens(n.expression)) && this.rootBinding(stripParens(n.expression))?.kind === "worst" && isPromiseType(this.checker.getTypeAtLocation(n.expression), this.checker)) found = true; ts.forEachChild(n, visit); };
    visit(fn.body);
    return found;
  }

  /** @param {string} name @param {ts.Node} scope */
  resolveDepName(name, scope) {
    let found;
    /** @param {ts.Node} n */
    const visit = n => { if (found) return; if (ts.isIdentifier(n) && n.text === name) { found = this.symbolOf(n); return; } ts.forEachChild(n, visit); };
    visit(scope);
    return found;
  }

  /** Calling a callback prop: the union of what the callers pass; unknown with unknown callers. @param {ComponentInfo} info @param {string} name @param {number} depth */
  propCallFailures(info, name, depth) {
    if (info.propsWorst || info.handedOff || depth > MAX_DEPTH) return new Set(["unknown"]);
    const passed = info.callbackProps.get(name);
    if (!passed || !passed.length) return new Set(["unknown"]);
    /** @type {Set<string>} */
    const out = new Set();
    for (const e of passed) {
      if (isFunctionLike(e)) { for (const f of this.failuresOf(e, depth + 1)) out.add(f); continue; }
      if (ts.isIdentifier(e)) {
        const b = this.bindingOf(e);
        if (b?.kind === "setter" || b?.kind === "signal" || b?.kind === "memo" || b?.kind === "accessor") continue;
        if (b?.kind === "helper") { for (const f of this.failuresOf(b.node, depth + 1)) out.add(f); continue; }
        out.add("unknown"); continue;
      }
      if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression)) {
        const b = this.bindingOf(e.expression);
        if (b?.kind === "props") { for (const f of this.propCallFailures(b.info, e.name.text, depth + 1)) out.add(f); continue; }
      }
      out.add("unknown");
    }
    return out;
  }

  /** @param {ts.CallExpression} call @param {string} name */
  platformFailures(call, name) {
    const sig = this.checker.getResolvedSignature(call);
    const declFile = sig?.getDeclaration()?.getSourceFile();
    const isLib = declFile ? this.program.isSourceFileDefaultLibrary(declFile) : false;
    if (!isLib) return new Set(["unknown"]); // a project / package function without an analyzable body: no failure information
    if (DETACHED_CALLBACKS.has(name) || SYNC_CALLBACK_METHODS.has(name)) {
      /** @type {Set<string>} */
      const out = new Set();
      if (SYNC_CALLBACK_METHODS.has(name)) for (const a of call.arguments) { const x = stripParens(a); if (isFunctionLike(x)) for (const f of this.failuresOf(x, 0)) out.add(f); else if (ts.isIdentifier(x)) { const b = this.bindingOf(x); if (b?.kind === "helper") for (const f of this.failuresOf(b.node, 0)) out.add(f); } }
      return out;
    }
    if (isPromiseType(this.checker.getTypeAtLocation(call), this.checker)) return new Set();
    if (SAFE_PLATFORM.has(name) || (declFile && !/lib\.dom/.test(declFile.fileName))) return new Set();
    return new Set(["unknown"]);
  }

  /** @param {Iterable<string>} set */
  failsType(set) {
    const list = [...set].sort();
    return list.length ? `__s.fails<${list.map(f => JSON.stringify(f)).join(" | ")}>()` : "__s.fails()";
  }

  // ---- the transform proper ------------------------------------------------------------
  /**
   * @param {ts.SourceFile} sf
   * @returns {Output}
   */
  transformFile(sf) {
    const out = new Output(sf.getFullText());
    out.insert('import * as __s from "solid-sound-typed";\n', 0);
    this.out = out;
    this.sf = sf;
    this.effectCounter = 0;
    this.owner = sf.fileName.split("/").pop() ?? "";
    this.walk(sf, "module");
    out.copy(out.cursor, sf.getFullText().length);
    return out;
  }

  /**
   * Walk emitting original text except where a node is rewritten.
   * @param {ts.Node} node
   * @param {"module" | "setup" | "setup-callback" | "tracking" | "handler" | "generic"} mode
   */
  walk(node, mode, entering = false) {
    const out = /** @type {Output} */ (this.out);
    const rewrite = this.rewriteFor(node, mode);
    if (rewrite) {
      const start = node.getStart(this.sf);
      out.copy(out.cursor, start);
      rewrite();
      out.cursor = node.getEnd();
      return;
    }
    const inner = isFunctionLike(node) && !entering && (mode === "setup" || mode === "tracking") ? "generic" : mode === "setup-callback" ? "setup" : mode;
    ts.forEachChild(node, ch => this.walk(ch, this.modeFor(ch, node, inner)));
  }

  /** The mode a child is walked in. @param {ts.Node} child @param {ts.Node} parent @param {"module" | "setup" | "setup-callback" | "tracking" | "handler" | "generic"} mode */
  modeFor(child, parent, mode) {
    if (mode === "setup" && isFunctionLike(child)) {
      // A nested function is not run here, unless it is a sync callback (map / filter / …) or an IIFE — then its body is setup code.
      if (ts.isCallExpression(parent) && parent.arguments.includes(/** @type {ts.Expression} */ (child)) && ts.isPropertyAccessExpression(parent.expression) && SYNC_CALLBACK_METHODS.has(parent.expression.name.text) && this.isLibCall(parent)) return "setup-callback";
      if (ts.isCallExpression(parent) && stripParens(parent.expression) === child) return "setup-callback";
      return "generic";
    }
    return mode;
  }

  /** Does this call resolve to a TypeScript default-lib declaration (the platform), as opposed to project / package code? @param {ts.CallExpression} call */
  isLibCall(call) {
    const decl = this.checker.getResolvedSignature(call)?.getDeclaration();
    const sf = decl?.getSourceFile();
    return !!sf && this.program.isSourceFileDefaultLibrary(sf);
  }

  /** Is this identifier the lib global of that name (Promise, JSON, setTimeout, …)? @param {ts.Identifier} id */
  isLibGlobal(id) {
    const decl = this.symbolOf(id)?.declarations?.[0];
    return !!decl && this.program.isSourceFileDefaultLibrary(decl.getSourceFile());
  }

  /**
   * @param {ts.Node} node
   * @param {"module" | "setup" | "setup-callback" | "tracking" | "handler" | "generic"} mode
   * @returns {(() => void) | null}
   */
  rewriteFor(node, mode) {
    if (mode === "setup-callback") mode = "setup";
    const out = /** @type {Output} */ (this.out);
    const start = node.getStart(this.sf);
    // Components (module level) and render roots / hand-offs.
    if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && this.components.has(node)) {
      const info = /** @type {ComponentInfo} */ (this.components.get(node));
      return () => this.emitComponent(node, info);
    }
    if (ts.isCallExpression(node)) {
      const api = ts.isIdentifier(node.expression) ? solidApiOf(node.expression, this.checker) : null;
      if (api && (api.api === "render" || api.api === "hydrate") && node.arguments[0]) {
        const target = stripParens(node.arguments[0]);
        return () => {
          if (ts.isIdentifier(target) && this.bindingOf(target)?.kind === "component") {
            out.insert("__s.renderComponent(", start);
            this.walkRange(node.arguments[0], "generic");
          } else if (isFunctionLike(target)) {
            out.insert("__s.render(", start);
            this.walkRange(node.arguments[0], "tracking");
          } else {
            this.warn(node.arguments[0], "a render argument that is not a component", "the rendered tree is not checked.", this.owner);
            out.insert("__s.render(() => __s.views([]), ", start);
          }
          for (const a of node.arguments.slice(1)) { out.insert(", ", a.getStart(this.sf)); this.walkRange(a, "generic"); }
          out.insert(")", node.getEnd());
        };
      }
    }
    if (ts.isIdentifier(node) && mode !== "handler") {
      const b = ts.isShorthandPropertyAssignment(node.parent) ? this.shorthandBinding(node.parent) : this.bindingOf(node);
      if (b?.kind === "component" && !this.isTagOrDeclaration(node) && !this.isRenderArgument(node) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) && !ts.isShorthandPropertyAssignment(node.parent)) {
        return () => { out.insert("__s.handoff(", start); out.copy(start, node.getEnd()); out.insert(")", node.getEnd()); };
      }
      if (b?.kind === "component" && ts.isShorthandPropertyAssignment(node.parent)) {
        return () => { out.copy(start, node.getEnd()); out.insert(`: __s.handoff(${node.text})`, node.getEnd()); };
      }
    }
    // JSX anywhere becomes a view.
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return () => this.emitView(node, mode === "setup" ? "setup" : "tracking");
    if (mode === "module" || mode === "generic") return null;
    // Solid primitives.
    if (ts.isCallExpression(node)) return this.rewriteCall(node, mode);
    // Reads of reactive props and object getters in setup.
    if (mode === "setup" && ts.isPropertyAccessExpression(node) && !(ts.isCallExpression(node.parent) && node.parent.expression === node)) {
      const target = stripParens(node.expression);
      if (ts.isIdentifier(target)) {
        const b = this.bindingOf(target);
        if (b?.kind === "props" && (b.info.reactiveProps.has(node.name.text) || b.info.propsWorst)) {
          return () => { out.insert("__s.setupRead(__s.propSrc(", start); out.copy(start, node.getEnd()); out.insert("))", node.getEnd()); };
        }
        if (b?.kind === "object") {
          const getter = this.getterOf(b.node, node.name.text);
          const deps = getter?.body ? this.depsOf(getter.body, 0) : [];
          if (deps.length) return () => { out.insert(`(__s.setupReads([${deps.join(", ")}]), `, start); out.copy(start, node.getEnd()); out.insert(")", node.getEnd()); };
        }
      }
    }
    if (mode === "setup" && ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer && ts.isIdentifier(stripParens(node.initializer))) {
      const b = this.bindingOf(stripParens(node.initializer));
      if (b?.kind === "props") {
        const names = node.name.elements.map(el => (el.propertyName ?? el.name).getText()).filter(n => b.info.reactiveProps.has(n) || b.info.propsWorst);
        if (names.length) return () => { out.copy(start, node.getEnd()); out.insert(`, __destructured = (${names.map(n => `__s.setupRead(__s.propSrc(props.${n}))`).join(", ")})`, node.getEnd()); };
      }
    }
    return null;
  }

  /** Walk a sub-range (a node) fully, in a mode. @param {ts.Node} node @param {"module" | "setup" | "tracking" | "handler" | "generic"} mode */
  walkRange(node, mode) {
    const out = /** @type {Output} */ (this.out);
    out.cursor = node.getStart(this.sf);
    this.walk(node, mode, true);
    out.copy(out.cursor, node.getEnd());
    out.cursor = node.getEnd();
  }

  /**
   * @param {ts.CallExpression} call
   * @param {"setup" | "tracking" | "handler"} mode
   * @returns {(() => void) | null}
   */
  rewriteCall(call, mode) {
    const out = /** @type {Output} */ (this.out);
    const start = call.getStart(this.sf);
    const callee = stripParens(call.expression);
    const api = ts.isIdentifier(callee) ? solidApiOf(callee, this.checker) : ts.isPropertyAccessExpression(callee) ? solidApiOf(callee.name, this.checker) : null;
    if (api) {
      switch (api.api) {
        case "createSignal": return () => { out.insert("__s.signal", start); out.cursor = callee.getEnd(); this.walkArgs(call, mode); out.insert(")", call.getEnd()); };
        case "createMemo": case "createAsync": return () => {
          const fn = call.arguments[0] ? stripParens(call.arguments[0]) : null;
          if (!fn || !isFunctionLike(fn)) { this.warn(call, "a memo compute that is not a function literal", "its reads and failures are treated as the worst case.", this.owner); out.insert("__s.worst(", start); out.copy(start, call.getEnd()); out.insert(")", call.getEnd()); return; }
          if (mode !== "setup") this.warn(call, "createMemo outside a component's setup", "a memo created in a computation or handler is not modeled.", this.owner);
          this.checkWrites(fn, `memo`);
          out.insert("__s.memo(", start);
          this.walkRange(call.arguments[0], "tracking");
          out.insert(`, [${this.depsOf(fn, 0).join(", ")}], ${this.failsType(this.failuresOf(fn, 0))})`, call.getEnd());
        };
        case "createEffect": case "createRenderEffect": return () => {
          const compute = call.arguments[0] ? stripParens(call.arguments[0]) : null;
          const effect = call.arguments[1] ? stripParens(call.arguments[1]) : null;
          if (!compute || !isFunctionLike(compute)) { this.warn(call, "an effect compute that is not a function literal", "its reads and failures are treated as the worst case.", this.owner); }
          const id = `__e${++this.effectCounter}`;
          this.effects?.push(id);
          const failures = new Set([...(compute && isFunctionLike(compute) ? this.failuresOf(compute, 0) : ["unknown"]), ...(effect && isFunctionLike(effect) ? this.failuresOf(effect, 0) : effect ? ["unknown"] : [])]);
          out.insert(`${mode === "setup" ? `const ${id} = ` : ""}__s.effect(`, start);
          if (compute) this.walkRange(call.arguments[0], "tracking"); else out.insert("() => undefined", start);
          out.insert(`, [${compute && isFunctionLike(compute) ? this.depsOf(compute, 0).join(", ") : ""}], `, start);
          const effectAnchor = effect ? effect.getStart(this.sf) : start;
          if (effect) this.walkRange(call.arguments[1], "handler"); else out.insert("() => undefined", start);
          out.insert(`, [${effect && isFunctionLike(effect) ? this.depsOf(effect, 0).join(", ") : ""}], ${this.failsType(failures)})`, effectAnchor);
        };
        case "untrack": return () => { out.copy(start, call.getEnd()); }; // nothing inside is a tracked read
        case "render": case "hydrate": return null;
        case "createContext": return null;
        default: return () => {
          const assumption = api.api === "useContext" ? "context values are the next area; this value is treated as possibly pending and possibly failing with unknown."
            : /Store|Mutable|Projection/.test(api.api) ? "stores are not modeled; the store and its setter are treated as possibly pending and possibly failing with unknown."
            : "this Solid API is not modeled in the slice; its value is treated as possibly pending and possibly failing with unknown.";
          this.warn(call, `${api.api}(…)`, assumption, this.owner);
          out.insert("__s.worst(", start);
          out.copy(start, callee.getEnd());
          out.cursor = callee.getEnd();
          this.walkArgs(call, mode === "setup" ? "generic" : mode);
          out.insert("))", call.getEnd());
        };
      }
    }
    if (ts.isIdentifier(callee)) {
      const b = this.bindingOf(callee);
      if (b?.kind === "setter" && mode !== "handler") {
        this.diagnostics.push({ code: "REACTIVE_WRITE_IN_OWNED_SCOPE", kind: "write", severity: "error", message: `Setter "${b.name}" is called inside ${mode === "setup" ? "a component's setup" : "a memo or JSX expression"}, an owned scope (component body or computation). Move the write into an event handler or an effect function.`, loc: this.loc(call), ownerName: this.owner, data: { setter: b.name } });
        return null;
      }
      if (mode === "setup" && b && (b.kind === "signal" || b.kind === "memo" || b.kind === "accessor")) {
        return () => { out.insert("__s.setupRead(", start); out.copy(start, callee.getEnd()); out.insert(")", call.getEnd()); };
      }
      if (mode === "setup" && b?.kind === "helper" && !b.factory) {
        const deps = this.depsOf(b.node, 0);
        if (deps.length) return () => { out.insert(`(__s.setupReads([${deps.join(", ")}]), `, start); out.copy(start, callee.getEnd()); out.cursor = callee.getEnd(); this.walkArgs(call, mode); out.insert("))", call.getEnd()); };
      }
      if (b?.kind === "helper" && b.factory) {
        return () => { this.warn(call, `${callee.text}(…)`, "it creates reactive state outside a component (a state factory); its result is treated as possibly pending and possibly failing with unknown.", this.owner); out.insert("__s.worst(", start); out.copy(start, callee.getEnd()); out.cursor = callee.getEnd(); this.walkArgs(call, "generic"); out.insert("))", call.getEnd()); };
      }
      if (DETACHED_CALLBACKS.has(callee.text) && !b && this.isLibGlobal(callee)) return () => this.emitDetached(call, mode);
    }
    if (ts.isPropertyAccessExpression(callee)) {
      const target = stripParens(callee.expression);
      if (mode === "setup" && ts.isIdentifier(target)) {
        const b = this.bindingOf(target);
        if (b?.kind === "props" && (b.info.reactiveProps.has(callee.name.text) || b.info.propsWorst)) {
          return () => { out.insert("__s.setupRead(__s.propSrc(", start); out.copy(start, callee.getEnd()); out.insert("))", call.getEnd()); };
        }
        if (b?.kind === "object") {
          const member = b.node.properties.find(p => p.name?.getText() === callee.name.text);
          const body = member && (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member)) ? member : member && ts.isPropertyAssignment(member) && isFunctionLike(stripParens(member.initializer)) ? stripParens(member.initializer) : null;
          const deps = body ? this.depsOf(body, 0) : [];
          if (deps.length) return () => { out.insert(`(__s.setupReads([${deps.join(", ")}]), `, start); out.copy(start, callee.getEnd()); out.cursor = callee.getEnd(); this.walkArgs(call, mode); out.insert("))", call.getEnd()); };
        }
      }
      if (SYNC_CALLBACK_METHODS.has(callee.name.text) && mode === "setup" && this.isLibCall(call)) {
        // A helper passed by name to map / filter runs here: its reads are setup reads.
        const helpers = call.arguments.map(a => stripParens(a)).filter(a => ts.isIdentifier(a) && this.bindingOf(a)?.kind === "helper");
        const deps = helpers.flatMap(h => { const hb = /** @type {Binding & { kind: "helper" }} */ (this.bindingOf(h)); return this.depsOf(hb.node, 0); });
        if (deps.length) return () => { out.insert(`(__s.setupReads([${deps.join(", ")}]), `, start); this.walkRange(call.expression, mode); out.cursor = callee.getEnd(); this.walkArgs(call, mode); out.insert("))", call.getEnd()); };
      }
    }
    return null;
  }

  /** Emit "(" args ")" walking each argument. Assumes cursor at the callee's end. @param {ts.CallExpression} call @param {"module" | "setup" | "tracking" | "handler" | "generic"} mode */
  walkArgs(call, mode) {
    const out = /** @type {Output} */ (this.out);
    const open = this.sf.getFullText().indexOf("(", out.cursor);
    out.copy(out.cursor, open + 1);
    out.cursor = open + 1;
    call.arguments.forEach((a, i) => {
      if (i) out.insert(", ", a.getStart(this.sf));
      this.walkRange(a, this.modeFor(a, call, mode === "module" ? "generic" : mode));
    });
    out.cursor = call.getEnd();
  }

  /** setTimeout(cb): the callback runs detached; its failures are unhandled. @param {ts.CallExpression} call @param {"setup" | "tracking" | "handler"} mode */
  emitDetached(call, mode) {
    const out = /** @type {Output} */ (this.out);
    out.copy(call.getStart(this.sf), call.expression.getEnd());
    out.cursor = call.expression.getEnd();
    const open = this.sf.getFullText().indexOf("(", out.cursor);
    out.copy(out.cursor, open + 1);
    call.arguments.forEach((a, i) => {
      if (i) out.insert(", ", a.getStart(this.sf));
      const x = stripParens(a);
      if (isFunctionLike(x) || (ts.isIdentifier(x) && this.bindingOf(x)?.kind === "helper")) {
        const fn = isFunctionLike(x) ? x : /** @type {Binding & { kind: "helper" }} */ (this.bindingOf(/** @type {ts.Identifier} */ (x))).node;
        out.insert("__s.checked(", a.getStart(this.sf));
        this.walkRange(a, "handler");
        out.insert(`, ${this.failsType(this.failuresOf(fn, 0))})`, a.getStart(this.sf));
      } else this.walkRange(a, mode);
    });
    out.insert(")", call.getEnd());
    out.cursor = call.getEnd();
  }

  /** Setter calls inside a compute are writes in an owned scope. @param {ts.Node} fn @param {string} where */
  checkWrites(fn, where) {
    /** @param {ts.Node} n */
    const visit = n => {
      if (isFunctionLike(n) && n !== fn) return;
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) { const b = this.bindingOf(n.expression); if (b?.kind === "setter") this.diagnostics.push({ code: "REACTIVE_WRITE_IN_OWNED_SCOPE", kind: "write", severity: "error", message: `Setter "${b.name}" is called inside a ${where}, an owned scope (component body or computation). Move the write into an event handler or an effect function.`, loc: this.loc(n), ownerName: this.owner, data: { setter: b.name } }); }
      ts.forEachChild(n, visit);
    };
    visit(fn);
  }

  // ---- components -----------------------------------------------------------------------
  /** @param {ts.FunctionLikeDeclaration} fn @param {ComponentInfo} info */
  emitComponent(fn, info) {
    const out = /** @type {Output} */ (this.out);
    const savedOwner = this.owner;
    const savedEffects = this.effects;
    this.owner = `<${info.name}>`;
    this.effects = [];
    const body = fn.body;
    if (!body) { out.copy(fn.getStart(this.sf), fn.getEnd()); return; }
    out.copy(fn.getStart(this.sf), body.getStart(this.sf));
    out.cursor = body.getStart(this.sf);
    if (ts.isBlock(body)) {
      // Setup failures (the pre-pass) are asserted at the first failing statement.
      const setupFailures = this.setupFailures(body);
      out.copy(out.cursor, body.statements[0]?.getStart(this.sf) ?? body.getEnd() - 1);
      out.cursor = body.statements[0]?.getStart(this.sf) ?? out.cursor;
      let asserted = false;
      for (const s of body.statements) {
        if (!asserted && setupFailures.size && setupFailures.at === s) { out.insert(`__s.setupFails(${this.failsType(setupFailures)}); `, s.getStart(this.sf)); asserted = true; }
        this.emitComponentStatement(s);
      }
      if (!asserted && setupFailures.size) out.insert(`__s.setupFails(${this.failsType(setupFailures)}); `, body.getEnd() - 1);
      out.copy(out.cursor, fn.getEnd());
    } else {
      out.insert("__s.own([", body.getStart(this.sf));
      this.walkRange(body, "setup");
      out.insert(`${this.effects.map(e => `, ${e}`).join("")}])`, body.getEnd());
      out.copy(out.cursor, fn.getEnd());
    }
    out.cursor = fn.getEnd();
    this.owner = savedOwner;
    this.effects = savedEffects;
  }

  /** The failure set of a component's setup statements, with the first failing statement. @param {ts.Block} body */
  setupFailures(body) {
    /** @type {Set<string> & { at?: ts.Statement }} */
    const out = new Set();
    for (const s of body.statements) {
      if (ts.isReturnStatement(s) || ts.isFunctionDeclaration(s)) continue;
      const f = this.failuresOf(s, 0);
      if (f.size && !out.at) out.at = s;
      for (const x of f) out.add(x);
    }
    return out;
  }

  /** @param {ts.Statement} s */
  emitComponentStatement(s) {
    const out = /** @type {Output} */ (this.out);
    if (ts.isReturnStatement(s)) {
      out.copy(out.cursor, s.getStart(this.sf));
      if (!s.expression) { out.copy(s.getStart(this.sf), s.getEnd()); out.cursor = s.getEnd(); return; }
      out.insert("return __s.own([", s.getStart(this.sf));
      this.walkRange(s.expression, "setup");
      out.insert(`${(this.effects ?? []).map(e => `, ${e}`).join("")}]);`, s.getEnd());
      out.cursor = s.getEnd();
      return;
    }
    if (ts.isIfStatement(s) || ts.isBlock(s) || ts.isTryStatement(s) || ts.isLabeledStatement(s)) {
      // Nested returns are views too: walk statements individually.
      out.copy(out.cursor, s.getStart(this.sf));
      out.cursor = s.getStart(this.sf);
      this.walkCompound(s);
      return;
    }
    out.copy(out.cursor, s.getStart(this.sf));
    out.cursor = s.getStart(this.sf);
    this.walk(s, "setup");
    out.copy(out.cursor, s.getEnd());
    out.cursor = s.getEnd();
  }

  /** @param {ts.Node} n */
  walkCompound(n) {
    const out = /** @type {Output} */ (this.out);
    ts.forEachChild(n, ch => {
      if (ts.isStatement(ch) && !ts.isBlock(ch)) { out.copy(out.cursor, ch.getStart(this.sf)); out.cursor = ch.getStart(this.sf); this.emitComponentStatement(ch); }
      else if (ts.isBlock(ch) || ts.isCatchClause(ch) || ts.isIfStatement(ch)) { this.walkCompound(ch); }
      else { out.copy(out.cursor, ch.getStart(this.sf)); out.cursor = ch.getStart(this.sf); this.walk(ch, "setup"); out.copy(out.cursor, ch.getEnd()); out.cursor = ch.getEnd(); }
    });
  }

  // ---- views ------------------------------------------------------------------------------
  /**
   * @param {ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment} node
   * @param {"setup" | "tracking"} mode the scope of expressions computed OUTSIDE JSX containers
   */
  emitView(node, mode) {
    const out = /** @type {Output} */ (this.out);
    const start = node.getStart(this.sf);
    if (ts.isJsxFragment(node)) {
      out.insert("__s.views([", start);
      this.emitChildren(node.children, start);
      out.insert("])", node.getEnd());
      out.cursor = node.getEnd();
      return;
    }
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    const children = ts.isJsxElement(node) ? node.children : [];
    const tag = opening.tagName;
    const attrs = opening.attributes.properties;
    /** @param {string} n */
    const attrExpr = n => { for (const a of attrs) if (ts.isJsxAttribute(a) && a.name.getText() === n && a.initializer && ts.isJsxExpression(a.initializer)) return a.initializer.expression ?? null; return null; };
    if (ts.isIdentifier(tag) && /^[a-z]/.test(tag.text)) {
      out.insert(`__s.host(${JSON.stringify(tag.text)}, [`, start);
      let first = true;
      for (const a of attrs) {
        if (ts.isJsxSpreadAttribute(a)) { this.warn(a, "a spread on an element", "its attributes and handlers are not checked.", this.owner); continue; }
        const name = a.name.getText();
        const init = a.initializer;
        if (!init || !ts.isJsxExpression(init) || !init.expression) continue;
        out.insert(first ? "" : ", ", a.getStart(this.sf)); first = false;
        if (isEventAttribute(name) || name === "ref") {
          if (name === "ref") this.warn(a, "a ref", "the ref callback runs as a handler; its reads are not tracked and its failures are unhandled.", this.owner);
          this.emitHandler(init.expression, a.getStart(this.sf), `this ${name} handler`);
        } else this.emitTrack(init.expression);
      }
      out.insert("], [", start);
      this.emitChildren(children, start);
      out.insert("])", node.getEnd());
      out.cursor = node.getEnd();
      return;
    }
    const tagNode = ts.isPropertyAccessExpression(tag) ? tag.name : tag;
    const api = solidApiOf(tagNode, this.checker);
    if (api && (api.api === "Loading" || api.api === "Errored")) {
      out.insert(`__s.${api.api.toLowerCase()}(`, start);
      const fb = attrExpr("fallback");
      if (fb) this.emitFallback(fb); else out.insert("undefined", start);
      out.insert(", [", start);
      this.emitChildren(children, start);
      out.insert("])", node.getEnd());
      out.cursor = node.getEnd();
      return;
    }
    if (api && ["Show", "For", "Index", "Switch", "Match", "Repeat"].includes(api.api)) {
      out.insert(`__s.flow(${JSON.stringify(api.api)}, [`, start);
      let first = true;
      for (const a of attrs) {
        if (!ts.isJsxAttribute(a) || !a.initializer || !ts.isJsxExpression(a.initializer) || !a.initializer.expression) continue;
        if (a.name.getText() === "fallback") continue;
        out.insert(first ? "" : ", ", a.getStart(this.sf)); first = false;
        this.emitTrack(a.initializer.expression);
      }
      out.insert("], [", start);
      const fb = attrExpr("fallback");
      let firstChild = true;
      if (fb) { this.emitFallback(fb); firstChild = false; }
      const callbacks = [];
      for (const ch of children) {
        if (ts.isJsxText(ch)) continue;
        if (ts.isJsxExpression(ch) && ch.expression && isFunctionLike(stripParens(ch.expression))) { callbacks.push(ch.expression); continue; }
        out.insert(firstChild ? "" : ", ", ch.getStart(this.sf)); firstChild = false;
        this.emitChild(ch);
      }
      out.insert("], [", start);
      callbacks.forEach((cb, i) => { out.insert(i ? ", " : "", cb.getStart(this.sf)); this.emitRenderCallback(cb); });
      out.insert("])", node.getEnd());
      out.cursor = node.getEnd();
      return;
    }
    const b = ts.isIdentifier(tag) ? this.bindingOf(tag) : undefined;
    if (!b || b.kind !== "component") {
      // Context providers are resolved by createContext provenance in context.mjs.
      const isContext = false;
      this.warn(opening, api ? `<${tag.getText()}>` : isContext ? `<${tag.getText()} value={…}> (a context provider)` : `<${tag.getText()}>`,
        api ? "this Solid component is not modeled in the slice; its children are checked under the current boundaries and its own value is treated as the worst case."
          : isContext ? "context is the next area; the provided value is not followed into consumers (each useContext is treated as the worst case) and the children are checked under the current boundaries."
          : "its component cannot be resolved to a project function; its children are checked under the current boundaries.", this.owner);
      out.insert(`__s.views([__s.track(() => undefined, [__s.worstDep()], __s.fails(), ${JSON.stringify(this.sf.fileName + ":" + start)})`, start);
      let first = false;
      for (const a of attrs) { if (ts.isJsxAttribute(a) && a.initializer && ts.isJsxExpression(a.initializer) && a.initializer.expression) { out.insert(first ? "" : ", ", a.getStart(this.sf)); first = false; this.emitTrack(a.initializer.expression); } }
      if (children.length) { out.insert(first ? "" : ", ", start); this.emitChildren(children, start); }
      out.insert("])", node.getEnd());
      out.cursor = node.getEnd();
      return;
    }
    // A user component: props as declared, their colors beside them (the caller's boundaries cover them).
    out.insert(`__s.el(${tag.getText()}, {`, start);
    let first = true;
    /** @type {ts.Expression[]} */
    const views = [];
    for (const a of attrs) {
      if (ts.isJsxSpreadAttribute(a)) { this.warn(a, "a spread into a component's props", "every prop of the child is treated as the worst case (possibly reactive, pending and failing).", this.owner); out.insert(`${first ? "" : ", "}...`, a.getStart(this.sf)); first = false; this.walkRange(a.expression, "generic"); continue; }
      const name = a.name.getText();
      out.insert(`${first ? "" : ", "}${/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)}: `, a.getStart(this.sf)); first = false;
      const init = a.initializer;
      if (!init) { out.insert("true", a.getStart(this.sf)); continue; }
      if (ts.isStringLiteral(init)) { out.copy(init.getStart(this.sf), init.getEnd()); continue; }
      if (ts.isJsxExpression(init) && init.expression) {
        const x = stripParens(init.expression);
        if (isFunctionLike(x)) this.walkRange(init.expression, "generic");
        else { this.walkRange(init.expression, "tracking"); views.push(init.expression); }
        continue;
      }
      out.insert("undefined", a.getStart(this.sf));
    }
    const meaningful = children.filter(ch => !(ts.isJsxText(ch) && ch.containsOnlyTriviaWhiteSpaces));
    if (meaningful.length) {
      out.insert(`${first ? "" : ", "}children: `, start);
      const single = meaningful.length === 1 ? meaningful[0] : null;
      if (single && ts.isJsxExpression(single) && single.expression) { const x = stripParens(single.expression); if (isFunctionLike(x)) this.walkRange(single.expression, "generic"); else { this.walkRange(single.expression, "tracking"); views.push(single.expression); } }
      else out.insert("__s.jsxChildren()", start);
    }
    out.insert("}, [", start);
    views.forEach((v, i) => { out.insert(`${i ? ", " : ""}__s.propView([${this.depsOf(v, 0).join(", ")}], ${this.failsType(this.failuresOf(v, 0))})`, v.getStart(this.sf)); });
    // JSX children render where the child places them: checked under the caller's boundaries.
    let n = views.length;
    for (const ch of meaningful) {
      if (ts.isJsxExpression(ch)) continue;
      out.insert(n++ ? ", " : "", ch.getStart(this.sf));
      this.emitChild(ch);
    }
    out.insert("])", node.getEnd());
    out.cursor = node.getEnd();
  }

  /** @param {readonly ts.JsxChild[]} children @param {number} anchor */
  emitChildren(children, anchor) {
    const out = /** @type {Output} */ (this.out);
    let first = true;
    for (const ch of children) {
      if (ts.isJsxText(ch)) continue;
      if (ts.isJsxExpression(ch) && !ch.expression) continue;
      out.insert(first ? "" : ", ", ch.getStart(this.sf)); first = false;
      this.emitChild(ch);
    }
    void anchor;
  }

  /** @param {ts.JsxChild} ch */
  emitChild(ch) {
    if (ts.isJsxExpression(ch)) {
      const e = /** @type {ts.Expression} */ (ch.expression);
      const x = stripParens(e);
      if (isFunctionLike(x)) { this.warn(x, "a function child of an element", "it is not a Show/For render callback; it is treated as a view under the current boundaries.", this.owner); this.emitRenderCallback(e); return; }
      this.emitTrack(e);
      return;
    }
    if (ts.isJsxElement(ch) || ts.isJsxSelfClosingElement(ch) || ts.isJsxFragment(ch)) { this.emitView(ch, "tracking"); return; }
  }

  /** A JSX expression container / attribute: a tracked read with its dependency list. @param {ts.Expression} e */
  emitTrack(e) {
    const out = /** @type {Output} */ (this.out);
    const start = e.getStart(this.sf);
    out.insert("__s.track(() => ", start);
    this.walkRange(e, "tracking");
    out.insert(`, [${this.depsOf(e, 0).join(", ")}], ${this.failsType(this.failuresOf(e, 0))})`, start);
  }

  /** A fallback: JSX is a view; anything else a tracked read. @param {ts.Expression} e */
  emitFallback(e) {
    const x = stripParens(e);
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) { this.emitView(x, "tracking"); return; }
    if (isFunctionLike(x)) { this.emitRenderCallback(e); return; }
    this.emitTrack(e);
  }

  /** A Show / For / Errored render callback: parameters become safe accessors, the body a view. @param {ts.Expression} e */
  emitRenderCallback(e) {
    const out = /** @type {Output} */ (this.out);
    const x = stripParens(e);
    const fn = /** @type {ts.FunctionLikeDeclaration} */ (x);
    for (const p of fn.parameters) if (ts.isIdentifier(p.name)) { const s = this.symbolOf(p.name); if (s) this.bindings.set(s, { kind: "accessor" }); }
    out.insert("__s.callbackView(", e.getStart(this.sf));
    this.walkRange(e, "tracking");
    out.insert(")", e.getEnd());
  }

  /** An event attribute: the handler with its pre-pass failure set. @param {ts.Expression} e @param {number} anchor @param {string} what */
  emitHandler(e, anchor, what) {
    const out = /** @type {Output} */ (this.out);
    const x = stripParens(e);
    /** @type {Set<string>} */
    let failures;
    if (isFunctionLike(x)) failures = this.failuresOf(x, 0);
    else if (ts.isIdentifier(x)) {
      const b = this.bindingOf(x);
      failures = b?.kind === "helper" ? this.failuresOf(b.node, 0) : b?.kind === "setter" || b?.kind === "accessor" || b?.kind === "signal" || b?.kind === "memo" ? new Set() : new Set(["unknown"]);
    } else if (ts.isPropertyAccessExpression(x) && ts.isIdentifier(x.expression) && this.bindingOf(x.expression)?.kind === "props") {
      failures = this.propCallFailures(/** @type {Binding & { kind: "props" }} */ (this.bindingOf(x.expression)).info, x.name.text, 0);
    } else if (ts.isArrayLiteralExpression(x)) { this.warn(x, "a bound handler array", "its handler is treated as possibly failing with unknown.", this.owner); failures = new Set(["unknown"]); }
    else failures = new Set(["unknown"]);
    void what;
    out.insert("__s.handler(", anchor);
    this.walkRange(e, "handler");
    out.insert(`, ${this.failsType(failures)})`, anchor);
  }
}
