// @ts-check
// Prototype B — the dataflow analysis proper. One `Analysis` per program;
// `run()` analyzes every component to a fixpoint over prop tables and
// component summaries, then reports at roots and hand-offs.
import ts from "typescript";
import { callable, constant, derived, describeFailures, join, joinAll, promiseOf, worst } from "./values.mjs";
import {
  DETACHED_CALLBACKS, PLATFORM_THROWS, PROMISE_METHODS, SAFE_PLATFORM, SYNC_CALLBACK_METHODS,
  isEventAttribute, isFunctionLike, isPromiseType, packageOf, resolveAlias, solidApiOf, stripParens
} from "./solid.mjs";

/** @typedef {import("./values.mjs").Value} Value */
/** @typedef {import("./values.mjs").Source} Source */
/** @typedef {import("./values.mjs").Callable} Callable */
/** @typedef {import("../../src/types.d.ts").SoundDiagnostic} SoundDiagnostic */
/** @typedef {import("../../src/types.d.ts").Loc} Loc */
/** @typedef {"setup" | "tracking" | "handler" | "effect" | "untracked"} Scope */

/** @typedef {{ loc: Loc, path: string[], source: string, failures?: Set<string>, uncoverable?: boolean }} Obligation */

/**
 * @typedef {{
 *   name: string,
 *   node: ts.FunctionLikeDeclaration,
 *   file: ts.SourceFile,
 *   exported: boolean,
 *   propsParam: ts.ParameterDeclaration | null,
 *   props: Map<string, { values: Value[], worst: boolean }>,
 *   nextProps: Map<string, { values: Value[], worst: boolean }>,
 *   propsWorst: boolean,
 *   nextPropsWorst: boolean,
 *   callers: number,
 *   nextCallers: number,
 *   handedOff: Loc[],
 *   rendered: Loc[],
 *   summary: { pending: Obligation[], failures: Obligation[] },
 *   facts: import("../../src/types.d.ts").ComponentFacts
 * }} Component
 */

/**
 * @typedef {{ throws: Set<string>, reasons: Map<string, string> }} FnAcc
 * @typedef {{ pending: boolean, failures: Set<string>, reads: number, pendingAt?: ts.Node, failureAt?: ts.Node }} CompAcc
 * @typedef {{ loading: boolean, errored: boolean, path: string[] }} View
 * @typedef {{
 *   component: Component | null,
 *   scope: Scope,
 *   fn: FnAcc,
 *   comp: CompAcc | null,
 *   view: View | null,
 *   depth: number,
 *   ownerName: string,
 *   untracked?: boolean
 * }} Ctx
 */

/**
 * @typedef {(
 *   | { kind: "signal", source: Source }
 *   | { kind: "setter", name: string }
 *   | { kind: "memo", source: Source }
 *   | { kind: "accessor", source: Source }
 *   | { kind: "value", value: Value }
 *   | { kind: "function", node: ts.FunctionLikeDeclaration, factory: boolean }
 *   | { kind: "component", component: Component }
 *   | { kind: "props", component: Component }
 *   | { kind: "object", node: ts.ObjectLiteralExpression, value: Value }
 *   | { kind: "caught", failures: Set<string> }
 * )} Binding
 */

const MAX_ITERATIONS = 6;
const MAX_DEPTH = 24;

export class Analysis {
  /**
   * @param {ts.Program} program
   * @param {readonly string[]} files absolute paths of the checked files
   */
  constructor(program, files) {
    this.program = program;
    this.checker = program.getTypeChecker();
    this.files = new Set(files.map(f => f.replaceAll("\\", "/")));
    /** @type {Map<ts.Symbol, Binding>} */
    this.bindings = new Map();
    /** @type {Map<ts.Node, Component>} */
    this.components = new Map();
    /** @type {SoundDiagnostic[]} */
    this.diagnostics = [];
    /** @type {{ component: Component | null, view: ts.Node | null, loc: Loc }[]} */
    this.roots = [];
    /** @type {Set<ts.Node>} */
    this.activeFunctions = new Set();
    /** @type {Map<ts.Node, Map<string, { value: Value, acc: FnAcc }>>} */
    this.functionCache = new Map();
    this.iteration = 0;
  }

  // ---- locations & reporting -----------------------------------------------
  /** @param {ts.Node} node @returns {Loc} */
  loc(node) {
    const sf = node.getSourceFile();
    const start = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    const end = sf.getLineAndCharacterOfPosition(node.getEnd());
    return { file: sf.fileName, line: start.line + 1, col: start.character + 1, endLine: end.line + 1, endCol: end.character + 1 };
  }

  /** @param {ts.Node} node */
  text(node) {
    const t = node.getText();
    return t.length > 60 ? t.slice(0, 57) + "…" : t;
  }

  /**
   * @param {SoundDiagnostic["code"]} code
   * @param {SoundDiagnostic["kind"]} kind
   * @param {SoundDiagnostic["severity"]} severity
   * @param {string} message
   * @param {ts.Node} node
   * @param {Partial<SoundDiagnostic>} [more]
   */
  report(code, kind, severity, message, node, more) {
    if (this.iteration !== this.finalIteration) return;
    const loc = this.loc(node);
    const key = `${code}@${loc.file}:${loc.line}:${loc.col}`;
    if (this.reported.has(key)) return;
    this.reported.add(key);
    this.diagnostics.push({ code, kind, severity, message, loc, ...more });
  }

  /** @param {ts.Node} node @param {string} construct @param {string} assumption @param {Ctx} ctx */
  unanalyzed(node, construct, assumption, ctx) {
    this.report("UNANALYZED_BOUNDARY", "analysis", "warn",
      `${construct} is outside the checked subset; ${assumption} Nothing here is trusted: downstream obligations still surface.`,
      node, { ownerName: ctx.ownerName, data: { construct } });
    ctx.component?.facts.unanalyzed.push({ loc: this.loc(node), construct });
  }

  // ---- symbols -------------------------------------------------------------
  /** @param {ts.Node} node */
  symbolOf(node) {
    return resolveAlias(this.checker.getSymbolAtLocation(node), this.checker);
  }

  /** @param {ts.Symbol | undefined} symbol */
  bindingOf(symbol) {
    if (!symbol) return undefined;
    let b = this.bindings.get(symbol);
    if (b) return b;
    const declaration = symbol.declarations?.[0];
    if (declaration && this.isProjectFile(declaration.getSourceFile())) {
      // Module-level declarations are bound on demand.
      if (ts.isFunctionDeclaration(declaration) && declaration.body) {
        b = this.bindFunction(symbol, declaration);
      } else if (ts.isVariableDeclaration(declaration) && declaration.initializer && ts.isSourceFile(declaration.parent.parent.parent)) {
        const init = stripParens(declaration.initializer);
        if (isFunctionLike(init)) b = this.bindFunction(symbol, /** @type {ts.FunctionLikeDeclaration} */ (init));
      }
    }
    return b;
  }

  /** @param {ts.SourceFile} sf */
  isProjectFile(sf) {
    return this.files.has(sf.fileName.replaceAll("\\", "/"));
  }

  /**
   * @param {ts.Symbol} symbol
   * @param {ts.FunctionLikeDeclaration} node
   * @returns {Binding}
   */
  bindFunction(symbol, node) {
    const component = this.componentOf(node);
    /** @type {Binding} */
    const b = component ? { kind: "component", component } : { kind: "function", node, factory: this.isStateFactory(node) };
    this.bindings.set(symbol, b);
    return b;
  }

  /** A non-component function that creates reactive state (outside the slice). @param {ts.FunctionLikeDeclaration} node */
  isStateFactory(node) {
    let found = false;
    /** @param {ts.Node} n */
    const visit = n => {
      if (found) return;
      if (ts.isCallExpression(n)) {
        const api = solidApiOf(n.expression, this.checker);
        if (api && /^create(Signal|Memo|Effect|Store|OptimisticStore|Root|Context|RenderEffect)$/.test(api.api)) { found = true; return; }
      }
      ts.forEachChild(n, visit);
    };
    if (node.body) visit(node.body);
    return found;
  }

  // ---- components ----------------------------------------------------------
  /** @param {ts.FunctionLikeDeclaration} node */
  componentOf(node) {
    const existing = this.components.get(node);
    if (existing) return existing;
    if (!this.returnsJsx(node)) return null;
    const name = this.functionName(node);
    const sf = node.getSourceFile();
    /** @type {Component} */
    const component = {
      name, node, file: sf, exported: this.isExported(node),
      propsParam: node.parameters[0] ?? null,
      props: new Map(), nextProps: new Map(), propsWorst: false, nextPropsWorst: false, callers: 0, nextCallers: 0, handedOff: [], rendered: [],
      summary: { pending: [], failures: [] },
      facts: { component: name, file: sf.fileName, pending: false, failures: [], reads: [], boundaries: [], unanalyzed: [] }
    };
    this.components.set(node, component);
    return component;
  }

  /** @param {ts.FunctionLikeDeclaration} node */
  functionName(node) {
    if (node.name && ts.isIdentifier(node.name)) return node.name.text;
    const p = node.parent;
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
    return "(anonymous)";
  }

  /** @param {ts.FunctionLikeDeclaration} node */
  isExported(node) {
    const hasExport = /** @param {ts.Node} n */ n => !!ts.getModifiers?.(/** @type {ts.HasModifiers} */ (n))?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isFunctionDeclaration(node)) return hasExport(node);
    const stmt = node.parent?.parent?.parent;
    return !!stmt && ts.isVariableStatement(stmt) && hasExport(stmt);
  }

  /** @param {ts.FunctionLikeDeclaration} node */
  returnsJsx(node) {
    if (!node.body) return false;
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      if (node.asteriskToken || node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) return false;
    } else return false;
    const body = node.body;
    if (!ts.isBlock(body)) return this.isViewExpression(body);
    let found = false;
    /** @param {ts.Node} n */
    const visit = n => {
      if (found || isFunctionLike(n)) return;
      if (ts.isReturnStatement(n) && n.expression && this.isViewExpression(n.expression)) found = true;
      else ts.forEachChild(n, visit);
    };
    visit(body);
    return found;
  }

  /** @param {ts.Expression} e */
  isViewExpression(e) {
    const x = stripParens(e);
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) return true;
    if (ts.isConditionalExpression(x)) return this.isViewExpression(x.whenTrue) || this.isViewExpression(x.whenFalse);
    if (ts.isBinaryExpression(x) && (x.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || x.operatorToken.kind === ts.SyntaxKind.BarBarToken || x.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) return this.isViewExpression(x.right) || this.isViewExpression(x.left);
    return false;
  }

  // ---- the whole-program driver --------------------------------------------
  run() {
    this.finalIteration = -1;
    this.reported = new Set();
    for (const sf of this.program.getSourceFiles()) {
      if (!this.isProjectFile(sf)) continue;
      this.collectComponents(sf);
    }
    /** @type {string | null} */
    let previous = null;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      this.iteration = i;
      const snapshot = this.pass();
      if (snapshot === previous) break;
      previous = snapshot;
    }
    this.finalIteration = this.iteration;
    this.diagnostics = [];
    this.reported = new Set();
    this.pass();
    this.reportRoots();
    return this.diagnostics;
  }

  /** One analysis pass over every component and every module's top level. */
  pass() {
    for (const c of this.components.values()) {
      c.nextProps = new Map(); c.nextPropsWorst = false; c.nextCallers = 0; c.handedOff = []; c.rendered = [];
      c.facts = { component: c.name, file: c.file.fileName, pending: false, failures: [], reads: [], boundaries: [], unanalyzed: [] };
    }
    this.roots = [];
    this.functionCache = new Map();
    this.current = { pending: [], failures: [] };
    this.setupFailureNode = null;
    /** @type {Map<Component, { pending: Obligation[], failures: Obligation[] }>} */
    const previous = new Map([...this.components.values()].map(c => [c, c.summary]));
    this.childSummaries = previous;
    // Callers first: module top levels (roots, hand-offs), then components, so
    // that prop tables are filled before the children that read them (this
    // pass); summaries from the previous pass feed the parents (next pass).
    for (const sf of this.program.getSourceFiles()) if (this.isProjectFile(sf)) this.analyzeModuleTopLevel(sf);
    /** @type {Map<Component, { pending: Obligation[], failures: Obligation[] }>} */
    const next = new Map();
    for (const c of this.components.values()) next.set(c, this.analyzeComponent(c, previous));
    for (const [c, s] of next) { c.summary = s; c.props = c.nextProps; c.propsWorst = c.nextPropsWorst || c.handedOff.length > 0; c.callers = c.nextCallers; }
    return JSON.stringify([...this.components.values()].map(c => [
      c.name,
      c.summary.pending.map(o => o.loc.line + ":" + o.loc.col),
      c.summary.failures.map(o => o.loc.line + ":" + o.loc.col + ":" + describeFailures(o.failures ?? new Set())),
      [...c.props.entries()].map(([k, v]) => [k, v.worst, v.values.map(x => [x.reactive, x.pending, [...x.failures], x.callables.length])]),
      c.propsWorst, c.callers, c.handedOff.length, c.rendered.length
    ]));
  }

  /** @param {ts.SourceFile} sf */
  collectComponents(sf) {
    /** @param {ts.Node} n */
    const visit = n => {
      if ((ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && n.body) {
        const parentIsModule = ts.isFunctionDeclaration(n) ? ts.isSourceFile(n.parent) : (ts.isVariableDeclaration(n.parent) && ts.isSourceFile(n.parent.parent.parent));
        if (parentIsModule) {
          const c = this.componentOf(n);
          const symbol = ts.isFunctionDeclaration(n) ? (n.name ? this.symbolOf(n.name) : undefined) : (ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name) ? this.symbolOf(n.parent.name) : undefined);
          if (symbol) this.bindings.set(symbol, c ? { kind: "component", component: c } : { kind: "function", node: n, factory: this.isStateFactory(n) });
          if (c) return; // components are analyzed by analyzeComponent
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }

  /** @param {ts.SourceFile} sf */
  analyzeModuleTopLevel(sf) {
    /** @type {Ctx} */
    const ctx = { component: null, scope: "setup", fn: this.newFnAcc(), comp: null, view: null, depth: 0, ownerName: sf.fileName.split("/").pop() ?? "" };
    for (const statement of sf.statements) {
      if (ts.isFunctionDeclaration(statement)) continue;
      if (ts.isVariableStatement(statement)) {
        for (const d of statement.declarationList.declarations) {
          if (d.initializer && isFunctionLike(stripParens(d.initializer))) continue;
          this.analyzeVariableDeclaration(d, ctx);
        }
        continue;
      }
      if (ts.isExpressionStatement(statement)) { this.evalExpr(statement.expression, ctx); continue; }
      if (ts.isIfStatement(statement)) { this.analyzeStatement(statement, ctx, null); continue; }
      if (ts.isExportAssignment(statement)) { this.evalExpr(statement.expression, ctx); continue; }
    }
  }

  newFnAcc() { return { throws: new Set(), reasons: new Map() }; }

  /**
   * @param {Component} c
   * @param {Map<Component, { pending: Obligation[], failures: Obligation[] }>} previous
   */
  analyzeComponent(c, previous) {
    this.childSummaries = previous;
    /** @type {Ctx} */
    const ctx = { component: c, scope: "setup", fn: this.newFnAcc(), comp: null, view: { loading: false, errored: false, path: [`<${c.name}>`] }, depth: 0, ownerName: `<${c.name}>` };
    this.current = { pending: /** @type {Obligation[]} */ ([]), failures: /** @type {Obligation[]} */ ([]) };
    if (c.propsParam) this.bindPropsParam(c, c.propsParam, ctx);
    const body = c.node.body;
    if (body) {
      if (ts.isBlock(body)) this.analyzeBlock(body, ctx, c);
      else this.evalView(body, ctx, /** @type {View} */ (ctx.view));
    }
    // Setup may not fail.
    if (ctx.fn.throws.size) {
      const first = [...ctx.fn.throws][0];
      const reason = ctx.fn.reasons.get(first);
      this.report("SETUP_MAY_THROW", "error", "error",
        `<${c.name}>'s setup may fail with ${describeFailures(ctx.fn.throws)}${reason ? ` (${reason})` : ""}; a component body only creates state. Move this work into a memo or rendered work under an Errored boundary, or into a handler, or handle the failure where it is produced.`,
        this.setupFailureNode ?? c.node.name ?? c.node, { ownerName: `<${c.name}>`, data: { failures: [...ctx.fn.throws] } });
    }
    this.setupFailureNode = null;
    const summary = this.current;
    c.facts.pending = summary.pending.length > 0;
    c.facts.failures = [...new Set(summary.failures.flatMap(o => [...(o.failures ?? [])]))];
    return summary;
  }

  /** @param {Component} c @param {ts.ParameterDeclaration} param @param {Ctx} ctx */
  bindPropsParam(c, param, ctx) {
    if (ts.isIdentifier(param.name)) {
      const symbol = this.symbolOf(param.name);
      if (symbol) this.bindings.set(symbol, { kind: "props", component: c });
    } else if (ts.isObjectBindingPattern(param.name)) {
      // Destructuring props in the parameter list reads every named prop in setup.
      for (const element of param.name.elements) {
        const propName = element.propertyName ? element.propertyName.getText() : element.name.getText();
        const value = this.readProp(c, propName, element, ctx);
        const symbol = ts.isIdentifier(element.name) ? this.symbolOf(element.name) : undefined;
        if (symbol) this.bindings.set(symbol, { kind: "value", value });
      }
    }
  }

  // ---- statements ----------------------------------------------------------
  /**
   * @param {ts.Block} block
   * @param {Ctx} ctx
   * @param {Component | null} componentBody when the block is a component's body, returns are views
   * @returns {Value} the joined value of return statements (for helpers)
   */
  analyzeBlock(block, ctx, componentBody) {
    let result = constant();
    let returned = false;
    for (const s of block.statements) if (ts.isFunctionDeclaration(s) && s.name && s.body) { const symbol = this.symbolOf(s.name); if (symbol && !this.bindings.has(symbol)) this.bindings.set(symbol, { kind: "function", node: s, factory: false }); }
    for (const s of block.statements) {
      const r = this.analyzeStatement(s, ctx, componentBody);
      if (r) { result = returned ? join(result, r) : r; returned = true; }
    }
    return result;
  }

  /**
   * @param {ts.Statement} s
   * @param {Ctx} ctx
   * @param {Component | null} componentBody
   * @returns {Value | null} a return value, if the statement returns
   */
  analyzeStatement(s, ctx, componentBody) {
    if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) this.analyzeVariableDeclaration(d, ctx);
      return null;
    }
    if (ts.isFunctionDeclaration(s)) {
      if (s.name && s.body) { const symbol = this.symbolOf(s.name); if (symbol) this.bindings.set(symbol, { kind: "function", node: s, factory: false }); }
      return null;
    }
    if (ts.isExpressionStatement(s)) {
      const v = this.evalExpr(s.expression, ctx);
      this.dropped(v, s.expression, ctx);
      return null;
    }
    if (ts.isReturnStatement(s)) {
      if (!s.expression) return constant();
      if (componentBody && ctx.view) { this.evalView(s.expression, ctx, ctx.view); return constant(); }
      return this.evalExpr(s.expression, ctx);
    }
    if (ts.isBlock(s)) return this.analyzeBlock(s, ctx, componentBody);
    if (ts.isIfStatement(s)) {
      this.evalExpr(s.expression, ctx);
      const a = this.analyzeStatement(s.thenStatement, ctx, componentBody);
      const b = s.elseStatement ? this.analyzeStatement(s.elseStatement, ctx, componentBody) : null;
      return a && b ? join(a, b) : (a ?? b);
    }
    if (ts.isTryStatement(s)) return this.analyzeTry(s, ctx, componentBody);
    if (ts.isThrowStatement(s)) {
      const v = this.evalExpr(s.expression, ctx);
      this.raise(ctx, this.failureNamesOf(s.expression, v), this.text(s), s);
      return null;
    }
    if (ts.isForOfStatement(s) || ts.isForInStatement(s)) { this.evalExpr(s.expression, ctx); return this.analyzeStatement(s.statement, ctx, componentBody); }
    if (ts.isForStatement(s)) {
      if (s.initializer) { if (ts.isVariableDeclarationList(s.initializer)) for (const d of s.initializer.declarations) this.analyzeVariableDeclaration(d, ctx); else this.evalExpr(s.initializer, ctx); }
      if (s.condition) this.evalExpr(s.condition, ctx);
      if (s.incrementor) this.evalExpr(s.incrementor, ctx);
      return this.analyzeStatement(s.statement, ctx, componentBody);
    }
    if (ts.isWhileStatement(s) || ts.isDoStatement(s)) { this.evalExpr(s.expression, ctx); return this.analyzeStatement(s.statement, ctx, componentBody); }
    if (ts.isSwitchStatement(s)) {
      this.evalExpr(s.expression, ctx);
      let r = null;
      for (const clause of s.caseBlock.clauses) {
        if (ts.isCaseClause(clause)) this.evalExpr(clause.expression, ctx);
        for (const st of clause.statements) { const x = this.analyzeStatement(st, ctx, componentBody); if (x) r = r ? join(r, x) : x; }
      }
      return r;
    }
    if (ts.isLabeledStatement(s)) return this.analyzeStatement(s.statement, ctx, componentBody);
    return null;
  }

  /** @param {ts.TryStatement} s @param {Ctx} ctx @param {Component | null} componentBody */
  analyzeTry(s, ctx, componentBody) {
    const inner = { ...ctx, fn: this.newFnAcc() };
    let r = this.analyzeBlock(s.tryBlock, inner, componentBody);
    if (s.catchClause) {
      const caught = inner.fn.throws;
      if (s.catchClause.variableDeclaration && ts.isIdentifier(s.catchClause.variableDeclaration.name)) {
        const symbol = this.symbolOf(s.catchClause.variableDeclaration.name);
        if (symbol) this.bindings.set(symbol, { kind: "caught", failures: new Set(caught) });
      }
      const c = this.analyzeBlock(s.catchClause.block, ctx, componentBody);
      if (c) r = r ? join(r, c) : c;
    } else {
      for (const f of inner.fn.throws) this.raise(ctx, [f], inner.fn.reasons.get(f) ?? "", s);
    }
    if (s.finallyBlock) { const f = this.analyzeBlock(s.finallyBlock, ctx, componentBody); if (f) r = r ? join(r, f) : f; }
    return r;
  }

  /** @param {ts.VariableDeclaration} d @param {Ctx} ctx */
  analyzeVariableDeclaration(d, ctx) {
    if (!d.initializer) return;
    const init = stripParens(d.initializer);
    // const [get, set] = createSignal(...)
    if (ts.isArrayBindingPattern(d.name) && ts.isCallExpression(init)) {
      const api = solidApiOf(init.expression, this.checker);
      if (api && api.api === "createSignal") {
        const name = d.name.elements[0] && !ts.isOmittedExpression(d.name.elements[0]) ? d.name.elements[0].name.getText() : "signal";
        for (const a of init.arguments) this.evalExpr(a, ctx);
        /** @type {Source} */
        const source = { name, reactive: true, pending: false, failures: new Set(), worst: false, node: init };
        const [g, s] = d.name.elements;
        if (g && !ts.isOmittedExpression(g) && ts.isIdentifier(g.name)) { const sym = this.symbolOf(g.name); if (sym) this.bindings.set(sym, { kind: "signal", source }); }
        if (s && !ts.isOmittedExpression(s) && ts.isIdentifier(s.name)) { const sym = this.symbolOf(s.name); if (sym) this.bindings.set(sym, { kind: "setter", name: s.name.text }); }
        if (ctx.component === null) this.unanalyzed(init, "createSignal outside a component", "module-level reactive state is not modeled; it is treated as possibly pending and possibly failing.", ctx);
        return;
      }
    }
    if (ts.isIdentifier(d.name)) {
      const symbol = this.symbolOf(d.name);
      if (!symbol) return;
      if (isFunctionLike(init)) { this.bindings.set(symbol, { kind: "function", node: /** @type {ts.FunctionLikeDeclaration} */ (init), factory: false }); return; }
      if (ts.isCallExpression(init)) {
        const api = solidApiOf(init.expression, this.checker);
        if (api && (api.api === "createMemo" || api.api === "createAsync")) {
          const source = this.analyzeMemo(init, d.name.text, ctx);
          this.bindings.set(symbol, { kind: "memo", source });
          if (ctx.component === null) this.unanalyzed(init, `${api.api} outside a component`, "module-level reactive state is not modeled; it is treated as possibly pending and possibly failing.", ctx);
          return;
        }
      }
      if (ts.isObjectLiteralExpression(init)) {
        const v = this.evalObjectLiteral(init, ctx);
        this.bindings.set(symbol, { kind: "object", node: init, value: v });
        return;
      }
      const v = this.evalExpr(init, ctx);
      this.bindings.set(symbol, { kind: "value", value: v });
      return;
    }
    if (ts.isArrayBindingPattern(d.name)) {
      const v = this.evalExpr(init, ctx);
      for (const el of d.name.elements) if (!ts.isOmittedExpression(el) && ts.isIdentifier(el.name)) { const sym = this.symbolOf(el.name); if (sym) this.bindings.set(sym, { kind: "value", value: v.worst ? v : derived(v) }); }
      return;
    }
    if (ts.isObjectBindingPattern(d.name)) {
      // const { onPick } = props / const { a } = obj
      const base = ts.isIdentifier(init) ? this.bindingOf(this.symbolOf(init)) : undefined;
      const baseValue = base ? null : this.evalExpr(init, ctx);
      for (const element of d.name.elements) {
        const propName = element.propertyName ? element.propertyName.getText() : element.name.getText();
        /** @type {Value} */
        let v;
        if (base && base.kind === "props") v = this.readProp(base.component, propName, element, ctx);
        else if (base && base.kind === "object") v = this.readObjectMember(base, propName, element, ctx);
        else v = derived(baseValue ?? (base ? this.bindingValue(base, init, ctx) : constant()));
        const sym = ts.isIdentifier(element.name) ? this.symbolOf(element.name) : undefined;
        if (sym) this.bindings.set(sym, { kind: "value", value: v });
      }
      return;
    }
    this.evalExpr(init, ctx);
  }

  /** A value dropped as a statement: a rejecting promise escapes. @param {Value} v @param {ts.Expression} e @param {Ctx} ctx */
  dropped(v, e, ctx) {
    if (v.promise && v.promise.size) this.raise(ctx, v.promise, `${this.text(e)} rejects and nothing handles the promise`, e);
  }

  /** @param {Ctx} ctx @param {Iterable<string>} failures @param {string} reason */
  addThrows(ctx, failures, reason) {
    for (const f of failures) { ctx.fn.throws.add(f); if (!ctx.fn.reasons.has(f)) ctx.fn.reasons.set(f, reason); }
  }

  /**
   * A failure raised at `node`: in a computation it is the computation's; at a
   * JSX position it is a boundary obligation; elsewhere it is the function's.
   * @param {Ctx} ctx @param {Iterable<string>} failures @param {string} reason @param {ts.Node} node
   */
  raise(ctx, failures, reason, node) {
    const set = new Set(failures);
    if (!set.size) return;
    if (ctx.scope === "tracking" && ctx.comp) { if (!ctx.comp.failures.size) ctx.comp.failureAt = node; for (const f of set) ctx.comp.failures.add(f); return; }
    if (ctx.scope === "tracking" && ctx.view) {
      if (!ctx.view.errored) this.current.failures.push({ loc: this.loc(node), path: [...ctx.view.path], source: reason.replace(/ (has no failure information|may fail|may throw|may reject).*$/, ""), failures: set });
      return;
    }
    this.addThrows(ctx, set, reason);
    if (ctx.scope === "setup" && !this.setupFailureNode) this.setupFailureNode = node;
  }

  /** A worst-case / pending value produced at a JSX position obligates a Loading boundary. @param {Value} v @param {ts.Node} node @param {Ctx} ctx @param {string} what */
  obligateValue(v, node, ctx, what) {
    if (ctx.scope !== "tracking" || !ctx.view || ctx.comp) return;
    if (v.pending && !ctx.view.loading) this.current.pending.push({ loc: this.loc(node), path: [...ctx.view.path], source: what });
  }

  /** @param {ts.Expression} e @param {Value} v */
  failureNamesOf(e, v) {
    if (v.caught) return [...v.caught];
    const x = stripParens(e);
    if (ts.isNewExpression(x)) return [x.expression.getText()];
    if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x) || ts.isTemplateExpression(x)) return ["string"];
    if (ts.isNumericLiteral(x)) return ["number"];
    const type = this.checker.getTypeAtLocation(x);
    const name = type.getSymbol()?.getName();
    return [name && name !== "__type" && name !== "__object" ? name : "unknown"];
  }

  // ---- reads ---------------------------------------------------------------
  /**
   * A reactive source is read at `node` in `ctx`.
   * @param {Source} source
   * @param {ts.Node} node
   * @param {Ctx} ctx
   * @returns {Value}
   */
  read(source, node, ctx) {
    const c = ctx.component;
    const loc = this.loc(node);
    const scope = ctx.scope === "untracked" ? "setup" : ctx.scope;
    c?.facts.reads.push({ loc, scope, source: source.name });
    switch (ctx.scope) {
      case "setup":
        if (source.reactive && !source.worst && !ctx.untracked) {
          if (source.pending)
            this.report("PENDING_ASYNC_UNTRACKED_READ", "async", "error",
              `Async value "${source.name}" is read in ${ctx.ownerName}'s setup; while it is pending there is nothing to read. Read it in a tracking scope (JSX, a memo, or an effect's compute function) under a Loading boundary.`,
              node, { ownerName: ctx.ownerName, data: { source: source.name } });
          else
            this.report("STRICT_READ_UNTRACKED", "strict-read", "error",
              `Reactive value "${source.name}" is read directly in ${ctx.ownerName}'s setup and will not update. Move it into a tracking scope (JSX, a memo, or an effect's compute function), or into the handler that needs it.`,
              node, { ownerName: ctx.ownerName, data: { source: source.name } });
        }
        if (source.failures.size) this.raise(ctx, source.failures, `reading "${source.name}" may fail`, node);
        break;
      case "tracking":
        if (ctx.comp) {
          ctx.comp.reads++;
          if (source.pending && !ctx.comp.pending) ctx.comp.pendingAt = node;
          if (source.failures.size && !ctx.comp.failures.size) ctx.comp.failureAt = node;
          ctx.comp.pending ||= source.pending;
          for (const f of source.failures) ctx.comp.failures.add(f);
        } else if (ctx.view) this.obligate(source, loc, ctx);
        break;
      case "handler":
        if (source.failures.size) this.raise(ctx, source.failures, `reading "${source.name}" may fail`, node);
        break;
      case "effect":
        if (source.pending && !ctx.untracked)
          this.report("PENDING_ASYNC_FORBIDDEN_SCOPE", "async", "error",
            `Async value "${source.name}" is read in an effect function, which serves the committed value and throws while uninitialized. Read it in the effect's compute function and pass the value.`,
            node, { ownerName: ctx.ownerName, data: { source: source.name } });
        if (source.failures.size) this.raise(ctx, source.failures, `reading "${source.name}" may fail`, node);
        break;
      case "untracked":
        break;
    }
    return { reactive: true, pending: source.pending, failures: new Set(source.failures), promise: null, callables: [], worst: source.worst, caught: null };
  }

  /** A read at a JSX position: pending / failure obligations unless a boundary covers it. @param {Source} source @param {Loc} loc @param {Ctx} ctx */
  obligate(source, loc, ctx) {
    const view = /** @type {View} */ (ctx.view);
    if (source.pending && !view.loading) this.current.pending.push({ loc, path: [...view.path], source: source.name });
    if (source.failures.size && !view.errored) this.current.failures.push({ loc, path: [...view.path], source: source.name, failures: new Set(source.failures) });
  }

  // ---- expressions ---------------------------------------------------------
  /**
   * @param {ts.Expression} e
   * @param {Ctx} ctx
   * @returns {Value}
   */
  evalExpr(e, ctx) {
    if (ctx.depth > MAX_DEPTH) return worst();
    const x = stripParens(e);
    if (ts.isIdentifier(x)) return this.evalIdentifier(x, ctx);
    if (ts.isCallExpression(x)) return this.evalCall(x, ctx);
    if (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x)) return this.evalMember(x, ctx);
    if (ts.isAwaitExpression(x)) {
      const v = this.evalExpr(x.expression, ctx);
      if (v.promise) this.raise(ctx, v.promise, `${this.text(x.expression)} may reject`, x);
      return { ...derived(v), pending: false, reactive: false };
    }
    if (isFunctionLike(x)) return callable({ kind: "function", node: x });
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) {
      // JSX outside the view position: evaluated as a view under the current boundaries.
      this.evalView(x, ctx, ctx.view ?? { loading: false, errored: false, path: [ctx.ownerName] });
      return constant();
    }
    if (ts.isObjectLiteralExpression(x)) return this.evalObjectLiteral(x, ctx);
    if (ts.isArrayLiteralExpression(x)) return joinAll(x.elements.map(el => derived(this.evalExpr(ts.isSpreadElement(el) ? el.expression : el, ctx))));
    if (ts.isConditionalExpression(x)) {
      const c = this.evalExpr(x.condition, ctx);
      return join(derived(c), join(this.evalExpr(x.whenTrue, ctx), this.evalExpr(x.whenFalse, ctx)));
    }
    if (ts.isBinaryExpression(x)) {
      if (x.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const v = this.evalExpr(x.right, ctx);
        if (ts.isIdentifier(x.left)) { const sym = this.symbolOf(x.left); if (sym) this.bindings.set(sym, { kind: "value", value: v }); }
        else this.evalExpr(x.left, ctx);
        return v;
      }
      return join(derived(this.evalExpr(x.left, ctx)), derived(this.evalExpr(x.right, ctx)));
    }
    if (ts.isPrefixUnaryExpression(x) || ts.isPostfixUnaryExpression(x) || ts.isTypeOfExpression(x) || ts.isVoidExpression(x) || ts.isSpreadElement(x)) {
      const operand = ts.isSpreadElement(x) ? x.expression : x.operand;
      return derived(this.evalExpr(operand, ctx));
    }
    if (ts.isTemplateExpression(x)) return joinAll(x.templateSpans.map(s => derived(this.evalExpr(s.expression, ctx))));
    if (ts.isNewExpression(x)) {
      for (const a of x.arguments ?? []) this.evalExpr(a, ctx);
      const name = x.expression.getText();
      if (name === "Promise" && x.arguments?.[0]) {
        // new Promise(executor): the executor runs now; a throw inside rejects.
        const executor = stripParens(x.arguments[0]);
        if (isFunctionLike(executor)) {
          const acc = this.newFnAcc();
          this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (executor), { ...ctx, fn: acc, scope: ctx.scope === "setup" ? "handler" : ctx.scope }, []);
          return promiseOf(acc.throws);
        }
      }
      return constant();
    }
    if (ts.isTaggedTemplateExpression(x)) { this.evalExpr(x.template, ctx); return constant(); }
    if (ts.isClassExpression(x)) { this.unanalyzed(x, "a class expression", "its members are not analyzed; its value is treated as possibly pending and possibly failing.", ctx); return worst(); }
    if (ts.isDeleteExpression(x)) { this.evalExpr(x.expression, ctx); return constant(); }
    if (ts.isYieldExpression(x)) { if (x.expression) this.evalExpr(x.expression, ctx); return worst(); }
    if (ts.isCommaListExpression(x)) return joinAll(x.elements.map(el => this.evalExpr(el, ctx)));
    return constant(); // literals, this, super, regex, …
  }

  /** @param {ts.Identifier} id @param {Ctx} ctx */
  evalIdentifier(id, ctx) {
    const b = this.bindingOf(this.symbolOf(id));
    if (!b) return this.foreignIdentifier(id, ctx);
    return this.bindingValue(b, id, ctx);
  }

  /** An identifier with no binding of ours: a parameter, a global, a package import. @param {ts.Identifier} id @param {Ctx} ctx */
  foreignIdentifier(id, ctx) {
    void ctx;
    const symbol = this.symbolOf(id);
    const decl = symbol?.declarations?.[0];
    if (decl && ts.isParameter(decl)) return constant(); // an unbound parameter (a plain value)
    if (decl && ts.isImportSpecifier(decl)) return constant();
    if (decl && this.program.isSourceFileDefaultLibrary(decl.getSourceFile())) return constant(); // Math, Promise, console, document, …
    const pkg = packageOf(decl);
    if (pkg && !["solid-js", "@solidjs/web", "@solidjs/signals"].includes(pkg)) return worst();
    return constant();
  }

  /**
   * The value of a binding used as an expression (not called).
   * @param {Binding} b
   * @param {ts.Node} node
   * @param {Ctx} ctx
   */
  bindingValue(b, node, ctx) {
    switch (b.kind) {
      case "signal": case "memo": case "accessor": return callable({ kind: "source", node, source: b.source });
      case "setter": return callable({ kind: "setter", node });
      case "value": return b.value;
      case "function": return b.factory ? callable({ kind: "function", node: b.node, reasonText: "factory" }) : callable({ kind: "function", node: b.node });
      case "component": {
        // A component referenced as a value outside a JSX tag and outside render(): a hand-off.
        if (!this.inRenderArgument) b.component.handedOff.push(this.loc(node));
        return callable({ kind: "component", node, component: b.component });
      }
      case "props": return constant();
      case "object": return b.value;
      case "caught": return { ...constant(), caught: new Set(b.failures) };
    }
  }

  /** @param {ts.ObjectLiteralExpression} o @param {Ctx} ctx */
  evalObjectLiteral(o, ctx) {
    let v = constant();
    for (const p of o.properties) {
      if (ts.isPropertyAssignment(p)) v = join(v, derived(this.evalExpr(p.initializer, ctx)));
      else if (ts.isShorthandPropertyAssignment(p)) {
        const valueSymbol = resolveAlias(this.checker.getShorthandAssignmentValueSymbol(p), this.checker);
        const b = this.bindingOf(valueSymbol);
        v = join(v, derived(b ? this.bindingValue(b, p.name, ctx) : this.foreignIdentifier(p.name, ctx)));
      }
      else if (ts.isSpreadAssignment(p)) v = join(v, derived(this.evalExpr(p.expression, ctx)));
      // getters / methods are analyzed where they are read / called
    }
    return v;
  }

  /**
   * @param {Binding & { kind: "object" }} b
   * @param {string} name
   * @param {ts.Node} at
   * @param {Ctx} ctx
   */
  readObjectMember(b, name, at, ctx) {
    for (const p of b.node.properties) {
      const pName = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
      if (pName !== name) continue;
      if (ts.isGetAccessorDeclaration(p)) return this.analyzeFunction(p, ctx, []); // a getter runs in the reader's scope
      if (ts.isMethodDeclaration(p)) return callable({ kind: "function", node: p });
      if (ts.isPropertyAssignment(p)) return this.evalExpr(p.initializer, ctx);
      if (ts.isShorthandPropertyAssignment(p)) {
        const b2 = this.bindingOf(resolveAlias(this.checker.getShorthandAssignmentValueSymbol(p), this.checker));
        return b2 ? this.bindingValue(b2, p.name, ctx) : this.foreignIdentifier(p.name, ctx);
      }
    }
    void at;
    return derived(b.value);
  }

  /**
   * A prop read in a child: its facts come from every caller.
   * @param {Component} c
   * @param {string} name
   * @param {ts.Node} at
   * @param {Ctx} ctx
   */
  readProp(c, name, at, ctx) {
    const entry = c.props.get(name);
    if (c.propsWorst || (entry && entry.worst)) return this.read({ name: `props.${name}`, reactive: true, pending: true, failures: new Set(["unknown"]), worst: true, node: at }, at, ctx);
    if (!entry || entry.values.length === 0) {
      // No caller in the program passes it: held, unknown shape. Calls through it are unknown (see callProp).
      return { ...constant(), callables: [{ kind: "function", node: null, reasonText: `props.${name} (no caller in this program)` }] };
    }
    const v = joinAll(entry.values);
    if (name === "children") return v;
    if (v.reactive || v.pending || v.failures.size) {
      // A caller passed a reactive expression: the prop is a reactive value, read here.
      const sourceCallables = v.callables.filter(cb => cb.kind === "source");
      const pending = v.pending || sourceCallables.some(cb => cb.source?.pending);
      const failures = new Set([...v.failures, ...sourceCallables.flatMap(cb => [...(cb.source?.failures ?? [])])]);
      const r = this.read({ name: `props.${name}`, reactive: true, pending, failures, worst: v.worst, node: at }, at, ctx);
      return { ...r, callables: v.callables };
    }
    return v; // held: constants, callbacks
  }

  /** @param {ts.PropertyAccessExpression | ts.ElementAccessExpression} m @param {Ctx} ctx */
  evalMember(m, ctx) {
    const name = ts.isPropertyAccessExpression(m) ? m.name.text : (ts.isStringLiteral(m.argumentExpression) ? m.argumentExpression.text : null);
    const target = stripParens(m.expression);
    if (ts.isIdentifier(target)) {
      const b = this.bindingOf(this.symbolOf(target));
      if (b && b.kind === "props" && name !== null) return this.readProp(b.component, name, m, ctx);
      if (b && b.kind === "object" && name !== null) return this.readObjectMember(b, name, m, ctx);
    }
    const base = this.evalExpr(m.expression, ctx);
    if (ts.isElementAccessExpression(m)) this.evalExpr(m.argumentExpression, ctx);
    if (base.worst) {
      // A member of a worst-case value is a worst-case value; reading it at a JSX position obligates a Loading / Errored boundary.
      const w = { ...worst(), callables: [{ kind: "function", node: null, reasonText: this.text(m) }] };
      if (!ts.isCallExpression(m.parent) || m.parent.expression !== m) { this.obligateValue(w, m, ctx, this.text(m)); this.raise(ctx, ["unknown"], `${this.text(m)} has no failure information`, m); }
      return w;
    }
    // A member of a reactive value derived from reads keeps the facts; callables are not tracked through members.
    const d = derived(base);
    if (base.callables.length) d.callables = base.callables.filter(cb => cb.kind === "function" && cb.node === null); // unknown shapes stay unknown
    return d;
  }

  // ---- calls ---------------------------------------------------------------
  /** @param {ts.CallExpression} call @param {Ctx} ctx */
  evalCall(call, ctx) {
    const callee = stripParens(call.expression);
    // Solid APIs
    const api = ts.isIdentifier(callee) || ts.isPropertyAccessExpression(callee) ? solidApiOf(ts.isPropertyAccessExpression(callee) ? callee.name : callee, this.checker) : null;
    if (api) return this.evalSolidCall(api.api, call, ctx);
    // Local bindings
    if (ts.isIdentifier(callee)) {
      const b = this.bindingOf(this.symbolOf(callee));
      if (b) return this.callBinding(b, call, ctx);
      const decl = this.symbolOf(callee)?.declarations?.[0];
      if (decl && ts.isParameter(decl)) return this.callUnknownValue(call, this.evalIdentifier(callee, ctx), ctx);
      return this.callPlatform(call, callee.text, ctx);
    }
    if (ts.isPropertyAccessExpression(callee)) {
      const target = stripParens(callee.expression);
      const name = callee.name.text;
      if (ts.isIdentifier(target)) {
        const b = this.bindingOf(this.symbolOf(target));
        if (b && b.kind === "props") return this.callProp(b.component, name, call, ctx);
        if (b && b.kind === "object") {
          const member = this.readObjectMember(b, name, callee, ctx);
          return this.callValue(member, call, ctx, this.text(call));
        }
      }
      const receiver = this.evalExpr(callee.expression, ctx);
      if (PROMISE_METHODS.has(name) && (receiver.promise || isPromiseType(this.checker.getTypeAtLocation(callee.expression), this.checker))) return this.callPromiseMethod(name, receiver, call, ctx);
      if (receiver.worst || receiver.callables.some(cb => cb.kind === "function" && cb.node === null)) return this.callUnknownValue(call, receiver, ctx);
      return this.callPlatform(call, name, ctx, receiver);
    }
    // (expr)(...)  e.g. scaled(3)(n), (() => p() * 2)()
    const v = this.evalExpr(call.expression, ctx);
    return this.callValue(v, call, ctx, this.text(call));
  }

  /** @param {string} api @param {ts.CallExpression} call @param {Ctx} ctx */
  evalSolidCall(api, call, ctx) {
    const args = call.arguments;
    switch (api) {
      case "createMemo": case "createAsync": {
        const source = this.analyzeMemo(call, "memo", ctx);
        return callable({ kind: "source", node: call, source });
      }
      case "createSignal": {
        for (const a of args) this.evalExpr(a, ctx);
        return worst(); // a signal tuple not destructured: not modeled
      }
      case "createEffect": case "createRenderEffect": {
        if (!ctx.component || ctx.scope !== "setup") this.unanalyzed(call, `${api} outside a component's setup`, "an effect created elsewhere is not modeled.", ctx);
        const compute = args[0] ? stripParens(args[0]) : null;
        const effect = args[1] ? stripParens(args[1]) : null;
        const acc = { pending: false, failures: new Set(), reads: 0 };
        const fnAcc = this.newFnAcc();
        /** @type {Value} */
        let computed = constant();
        if (compute && isFunctionLike(compute)) computed = this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (compute), { ...ctx, scope: "tracking", comp: acc, fn: fnAcc, view: null, ownerName: "effect" }, []);
        else if (compute) this.unanalyzed(compute, "an effect compute that is not a function literal", "its reads and failures are treated as the worst case.", ctx);
        const loc = this.loc(call);
        const pendingLoc = acc.pendingAt ? this.loc(acc.pendingAt) : loc;
        const failureLoc = acc.failureAt ? this.loc(acc.failureAt) : loc;
        if (acc.pending || computed.pending) this.current.pending.push({ loc: pendingLoc, path: [...(ctx.view?.path ?? [])], source: "the effect's compute", uncoverable: true });
        const failures = new Set([...acc.failures, ...fnAcc.throws, ...computed.failures]);
        if (effect && isFunctionLike(effect)) {
          const effAcc = this.newFnAcc();
          this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (effect), { ...ctx, scope: "effect", comp: null, fn: effAcc, view: null, ownerName: "effect" }, [computed]);
          for (const f of effAcc.throws) failures.add(f);
        } else if (effect) this.unanalyzed(effect, "an effect function that is not a function literal", "its failures are treated as unknown.", ctx);
        if (failures.size) this.current.failures.push({ loc: failureLoc, path: [...(ctx.view?.path ?? [])], source: "the effect", failures, uncoverable: true });
        return constant();
      }
      case "untrack": {
        const fn = args[0] ? stripParens(args[0]) : null;
        if (fn && isFunctionLike(fn)) return this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (fn), { ...ctx, untracked: true }, []);
        return constant();
      }
      case "useContext": {
        for (const a of args) this.evalExpr(a, ctx);
        this.unanalyzed(call, "useContext(…)", "context values are the next area; this value is treated as possibly pending and possibly failing with unknown.", ctx);
        return worst();
      }
      case "createContext": return constant();
      case "createStore": case "createOptimisticStore": case "createMutable": case "createProjection": {
        for (const a of args) this.evalExpr(a, ctx);
        this.unanalyzed(call, `${api}(…)`, "stores are not modeled; the store and its setter are treated as possibly pending and possibly failing with unknown.", ctx);
        return worst();
      }
      case "latest": case "isPending": {
        for (const a of args) this.evalExpr(a, { ...ctx, untracked: true });
        this.unanalyzed(call, `${api}(…)`, "pending-state helpers are not modeled; the value is treated as possibly pending and possibly failing.", ctx);
        return worst();
      }
      case "render": case "hydrate": {
        const target = args[0] ? stripParens(args[0]) : null;
        if (args[1]) this.evalExpr(args[1], ctx);
        if (target) {
          this.inRenderArgument = true;
          if (ts.isIdentifier(target)) {
            const b = this.bindingOf(this.symbolOf(target));
            if (b && b.kind === "component") { b.component.rendered.push(this.loc(call)); this.roots.push({ component: b.component, view: null, loc: this.loc(call) }); }
            else this.unanalyzed(target, "a render argument that is not a component", "the rendered tree is not checked.", ctx);
          } else if (isFunctionLike(target)) {
            this.roots.push({ component: null, view: target, loc: this.loc(call) });
            this.inRenderArgument = false;
            this.analyzeRootView(/** @type {ts.FunctionLikeDeclaration} */ (target), this.loc(call));
          } else this.unanalyzed(target, "a render argument that is not a component", "the rendered tree is not checked.", ctx);
          this.inRenderArgument = false;
        }
        return constant();
      }
      case "lazy": case "createRoot": case "createUniqueId": case "onCleanup": case "onMount": case "batch": case "on": case "mapArray": case "indexArray": case "children": case "mergeProps": case "splitProps": case "createSelector": case "catchError": case "startTransition": case "useTransition": case "getOwner": case "runWithOwner": case "createComputed": case "createReaction": case "createResource": case "resolve": case "refresh": case "action": case "flushSync": case "createTrackedEffect": case "onSettled": {
        for (const a of args) this.evalExpr(a, { ...ctx, scope: ctx.scope === "setup" ? "handler" : ctx.scope });
        this.unanalyzed(call, `${api}(…)`, "this Solid API is not modeled in the slice; its value is treated as possibly pending and possibly failing with unknown.", ctx);
        return worst();
      }
      default: {
        for (const a of args) this.evalExpr(a, ctx);
        this.unanalyzed(call, `${api}(…)`, "this Solid API is not modeled in the slice; its value is treated as possibly pending and possibly failing with unknown.", ctx);
        return worst();
      }
    }
  }

  /** createMemo(fn): an analyzed computation. @param {ts.CallExpression} call @param {string} name @param {Ctx} ctx */
  analyzeMemo(call, name, ctx) {
    const fn = call.arguments[0] ? stripParens(call.arguments[0]) : null;
    const acc = { pending: false, failures: new Set(), reads: 0 };
    const fnAcc = this.newFnAcc();
    /** @type {Value} */
    let result = constant();
    if (fn && isFunctionLike(fn)) {
      result = this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (fn), { ...ctx, scope: "tracking", comp: acc, fn: fnAcc, view: null, ownerName: `memo "${name}"` }, []);
    } else if (fn) {
      this.unanalyzed(fn, "a memo compute that is not a function literal", "its reads and failures are treated as the worst case.", ctx);
      result = worst();
    }
    for (const a of call.arguments.slice(1)) this.evalExpr(a, ctx);
    const pending = acc.pending || result.pending || result.promise !== null || result.worst;
    const failures = new Set([...acc.failures, ...fnAcc.throws, ...result.failures, ...(result.promise ?? [])]);
    if (ctx.scope !== "setup" && ctx.component) this.unanalyzed(call, "createMemo outside a component's setup", "a memo created in a computation or handler is not modeled.", ctx);
    return { name, reactive: true, pending, failures, worst: result.worst, node: call };
  }

  /** A root rendered as `render(() => <App />, el)`. @param {ts.FunctionLikeDeclaration} fn @param {Loc} rootLoc */
  analyzeRootView(fn, rootLoc) {
    const saved = this.current;
    this.current = { pending: [], failures: [] };
    /** @type {Ctx} */
    const ctx = { component: null, scope: "tracking", fn: this.newFnAcc(), comp: null, view: { loading: false, errored: false, path: ["render"] }, depth: 0, ownerName: "render" };
    const body = fn.body;
    if (body) { if (ts.isBlock(body)) this.analyzeBlock(body, { ...ctx, scope: "setup" }, null); else this.evalView(body, ctx, /** @type {View} */ (ctx.view)); }
    const root = this.roots[this.roots.length - 1];
    root.rootSummary = this.current;
    void rootLoc;
    this.current = saved;
  }

  /** @param {Binding} b @param {ts.CallExpression} call @param {Ctx} ctx */
  callBinding(b, call, ctx) {
    const args = call.arguments.map(a => this.evalExpr(a, ctx));
    switch (b.kind) {
      case "signal": case "memo": case "accessor": return this.read(b.source, call, ctx);
      case "setter": {
        if (ctx.scope === "setup" || ctx.scope === "tracking" || ctx.scope === "untracked") {
          const where = ctx.comp ? ctx.ownerName : ctx.scope === "tracking" ? "a JSX expression" : `${ctx.ownerName}'s setup`;
          this.report("REACTIVE_WRITE_IN_OWNED_SCOPE", "write", "error",
            `Setter "${b.name}" is called inside ${where}, an owned scope (component body or computation). Move the write into an event handler or an effect function.`,
            call, { ownerName: ctx.ownerName, data: { setter: b.name } });
        }
        return constant();
      }
      case "function": {
        if (b.factory) {
          this.unanalyzed(call, `${this.text(call.expression)}(…)`, "it creates reactive state outside a component (a state factory); its result is treated as possibly pending and possibly failing with unknown.", ctx);
          return worst();
        }
        return this.analyzeFunction(b.node, ctx, args);
      }
      case "component": {
        this.unanalyzed(call, `calling the component ${b.component.name} as a function`, "the rendered tree is not checked here.", ctx);
        return worst();
      }
      case "value": return this.callValue(b.value, call, ctx, this.text(call));
      case "object": return this.callValue(b.value, call, ctx, this.text(call));
      case "props": return this.callUnknownValue(call, worst(), ctx);
      case "caught": return constant();
    }
  }

  /**
   * Calling a value: each callable it may be is analyzed in the caller's scope.
   * @param {Value} v @param {ts.CallExpression} call @param {Ctx} ctx @param {string} reason
   */
  callValue(v, call, ctx, reason) {
    if (v.worst) return this.callUnknownValue(call, v, ctx);
    if (!v.callables.length) {
      // Calling something we did not track (a plain function value from a computation, a DOM method): unknown.
      return this.callUnknownValue(call, v, ctx);
    }
    const args = call.arguments.map(a => this.evalExpr(a, ctx));
    /** @type {Value[]} */
    const results = [];
    for (const cb of v.callables) {
      switch (cb.kind) {
        case "source": results.push(this.read(/** @type {Source} */ (cb.source), call, ctx)); break;
        case "setter": results.push(constant()); break;
        case "safe": results.push(constant()); break;
        case "function":
          if (cb.node) results.push(this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (cb.node), ctx, args));
          else results.push(this.callUnknownValue(call, v, ctx, cb.reasonText ?? reason));
          break;
        case "component": results.push(worst()); break;
      }
    }
    return joinAll(results);
  }

  /** A call with no analyzable body: possibly failing with unknown; a Promise-typed result rejects instead of throwing. @param {ts.CallExpression} call @param {Value} receiver @param {Ctx} ctx @param {string} [reason] */
  callUnknownValue(call, receiver, ctx, reason) {
    for (const a of call.arguments) this.evalCallbackArgument(a, ctx, "unknown");
    const type = this.checker.getTypeAtLocation(call);
    const text = reason ?? this.text(call);
    if (isPromiseType(type, this.checker)) {
      // Rejection carried by the promise; the value it resolves to is worst case when the receiver is.
      const v = { ...(receiver.worst ? worst() : constant()), pending: receiver.worst, promise: new Set(["unknown"]), callables: [], reactive: receiver.worst };
      this.obligateValue(v, call, ctx, text);
      return v;
    }
    this.raise(ctx, ["unknown"], `${text} has no failure information`, call);
    if (receiver.worst) { const w = worst(); this.obligateValue(w, call, ctx, text); return w; }
    return constant();
  }

  /**
   * A callback passed to a call we cannot see into runs detached: its escaping failures are unhandled.
   * @param {ts.Expression} a @param {Ctx} ctx @param {"unknown" | "detached" | "sync"} mode
   */
  evalCallbackArgument(a, ctx, mode) {
    const x = stripParens(a);
    if (isFunctionLike(x) || (ts.isIdentifier(x) && this.bindingOf(this.symbolOf(x))?.kind === "function")) {
      const node = isFunctionLike(x) ? /** @type {ts.FunctionLikeDeclaration} */ (x) : /** @type {Binding & { kind: "function" }} */ (this.bindingOf(this.symbolOf(/** @type {ts.Identifier} */ (x)))).node;
      if (mode === "sync") return this.analyzeFunction(node, ctx, []);
      const acc = this.newFnAcc();
      const result = this.analyzeFunction(node, { ...ctx, scope: "handler", fn: acc, comp: null, view: null }, []);
      const escaping = new Set([...acc.throws, ...(result.promise ?? [])]);
      if (escaping.size) this.reportHandler(a, `this callback`, escaping, acc, ctx);
      return constant();
    }
    return this.evalExpr(a, ctx);
  }

  /**
   * A call whose callee lives in the platform or a package: a small contract table, else unknown.
   * @param {ts.CallExpression} call @param {string} name @param {Ctx} ctx @param {Value} [receiver]
   */
  callPlatform(call, name, ctx, receiver) {
    if (DETACHED_CALLBACKS.has(name)) {
      for (const a of call.arguments) this.evalCallbackArgument(a, ctx, "detached");
      return constant();
    }
    if (SYNC_CALLBACK_METHODS.has(name)) {
      const results = call.arguments.map(a => this.evalCallbackArgument(a, ctx, "sync"));
      return join(receiver ? derived(receiver) : constant(), derived(joinAll(results)));
    }
    const calleeText = ts.isPropertyAccessExpression(call.expression) ? call.expression.expression.getText() : "";
    if (name === "reject" && calleeText === "Promise") {
      const v = call.arguments[0] ? this.evalExpr(call.arguments[0], ctx) : constant();
      return promiseOf(new Set(call.arguments[0] ? this.failureNamesOf(call.arguments[0], v) : ["unknown"]));
    }
    if (name === "resolve" && calleeText === "Promise") {
      const v = call.arguments[0] ? this.evalExpr(call.arguments[0], ctx) : constant();
      return promiseOf(v.promise ?? new Set());
    }
    if ((name === "all" || name === "allSettled" || name === "race" || name === "any") && calleeText === "Promise") {
      const v = joinAll(call.arguments.map(a => this.evalExpr(a, ctx)));
      return promiseOf(v.promise ?? new Set());
    }
    const args = call.arguments.map(a => this.evalCallbackArgument(a, ctx, "unknown"));
    const known = PLATFORM_THROWS.get(name);
    if (known && calleeText === "JSON") { this.raise(ctx, [known], `${this.text(call)} may throw`, call); return constant(); }
    const sig = this.checker.getResolvedSignature(call);
    const decl = sig?.getDeclaration();
    const declFile = decl?.getSourceFile();
    const isLib = declFile ? this.program.isSourceFileDefaultLibrary(declFile) : false;
    const type = this.checker.getTypeAtLocation(call);
    if (isPromiseType(type, this.checker)) return { ...derived(joinAll(args)), promise: new Set(["unknown"]) };
    if (SAFE_PLATFORM.has(name) || (isLib && declFile && !/lib\.dom/.test(declFile.fileName))) return derived(joinAll([receiver ?? constant(), ...args]));
    // Project function without a binding (e.g. imported from a non-checked file) or a DOM / package call: unknown.
    this.raise(ctx, ["unknown"], `${this.text(call)} has no failure information`, call);
    return derived(joinAll([receiver ?? constant(), ...args]));
  }

  /** .then / .catch / .finally on a promise value. @param {string} name @param {Value} receiver @param {ts.CallExpression} call @param {Ctx} ctx */
  callPromiseMethod(name, receiver, call, ctx) {
    const rejects = new Set(receiver.promise ?? ["unknown"]);
    /** @param {ts.Expression | undefined} a */
    const continuation = a => {
      if (!a) return null;
      const x = stripParens(a);
      const acc = this.newFnAcc();
      /** @type {Value} */
      let r;
      if (isFunctionLike(x)) r = this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (x), { ...ctx, scope: "handler", fn: acc, comp: null, view: null }, [constant()]);
      else {
        const v = this.evalExpr(a, ctx);
        r = this.callValue(v, call, { ...ctx, scope: "handler", fn: acc, comp: null, view: null }, this.text(a));
      }
      return new Set([...acc.throws, ...(r.promise ?? [])]);
    };
    if (name === "then") {
      const ok = continuation(call.arguments[0]) ?? new Set();
      const err = call.arguments[1] ? continuation(call.arguments[1]) : null;
      return promiseOf(err ? new Set([...ok, ...err]) : new Set([...rejects, ...ok]));
    }
    if (name === "catch") return promiseOf(continuation(call.arguments[0]) ?? new Set());
    const fin = continuation(call.arguments[0]) ?? new Set();
    return promiseOf(new Set([...rejects, ...fin]));
  }

  /** props.x(...) in a child: the callers' functions / sources are analyzed here. @param {Component} c @param {string} name @param {ts.CallExpression} call @param {Ctx} ctx */
  callProp(c, name, call, ctx) {
    const v = this.readPropForCall(c, name, call.expression, ctx);
    return this.callValue(v, call, ctx, `props.${name}(…)`);
  }

  /** Like readProp but a function-typed prop about to be called is not itself a read. @param {Component} c @param {string} name @param {ts.Node} at @param {Ctx} ctx */
  readPropForCall(c, name, at, ctx) {
    const entry = c.props.get(name);
    if (c.propsWorst || (entry && entry.worst)) return worst();
    if (!entry || entry.values.length === 0) return { ...constant(), callables: [{ kind: "function", node: null, reasonText: `props.${name}(…) has no caller in this program` }] };
    const v = joinAll(entry.values);
    if (!v.callables.length) {
      // Called, but no caller passed a function we can see (a value, a member of a bag): unknown.
      return { ...v, callables: [{ kind: "function", node: null, reasonText: `props.${name}(…) has no analyzable function` }] };
    }
    void at; void ctx;
    return v;
  }

  // ---- functions -----------------------------------------------------------
  /**
   * Analyze a function body with the given scope: sync functions run in the
   * caller's scope; async functions run as handlers and return a promise.
   * @param {ts.FunctionLikeDeclaration} fn
   * @param {Ctx} ctx
   * @param {Value[]} args
   * @returns {Value}
   */
  analyzeFunction(fn, ctx, args) {
    if (this.activeFunctions.has(fn) || ctx.depth > MAX_DEPTH) return constant(); // recursion: the first activation's facts stand
    const isAsync = !!(ts.canHaveModifiers(fn) && ts.getModifiers(fn)?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword));
    const isGenerator = !!fn.asteriskToken;
    if (isGenerator) { this.unanalyzed(fn, "a generator function", "its body is not analyzed; its value is treated as possibly pending and possibly failing.", ctx); return worst(); }
    // Parameters take the argument values (closures see the last binding; path-insensitive).
    fn.parameters.forEach((p, i) => {
      if (ts.isIdentifier(p.name)) { const sym = this.symbolOf(p.name); if (sym) this.bindings.set(sym, { kind: "value", value: args[i] ?? constant() }); }
      else if (ts.isObjectBindingPattern(p.name) || ts.isArrayBindingPattern(p.name)) {
        for (const el of p.name.elements) if (!ts.isOmittedExpression(el) && ts.isIdentifier(el.name)) { const sym = this.symbolOf(el.name); if (sym) this.bindings.set(sym, { kind: "value", value: derived(args[i] ?? constant()) }); }
      }
    });
    this.activeFunctions.add(fn);
    try {
      if (isAsync) {
        // The body's synchronous prefix runs in the caller's scope (a read there is the caller's read);
        // its throws are the promise's rejections. Reads at a JSX position are not obligations of the
        // view (the promise is), so the view is dropped; a computation's reads stay the computation's.
        const acc = this.newFnAcc();
        const inner = { ...ctx, fn: acc, view: null, depth: ctx.depth + 1 };
        const r = this.runBody(fn, inner);
        return { ...derived(r), pending: false, reactive: false, promise: new Set([...acc.throws, ...(r.promise ?? [])]) };
      }
      return this.runBody(fn, { ...ctx, depth: ctx.depth + 1 });
    } finally {
      this.activeFunctions.delete(fn);
    }
  }

  /** @param {ts.FunctionLikeDeclaration} fn @param {Ctx} ctx */
  runBody(fn, ctx) {
    const body = fn.body;
    if (!body) return constant();
    if (ts.isBlock(body)) return this.analyzeBlock(body, ctx, null);
    return this.evalExpr(body, ctx);
  }

  // ---- handlers ------------------------------------------------------------
  /**
   * A JSX event attribute's value, analyzed as a handler.
   * @param {ts.JsxAttribute} attr
   * @param {Ctx} ctx
   */
  analyzeHandlerAttribute(attr, ctx) {
    const init = attr.initializer;
    if (!init || !ts.isJsxExpression(init) || !init.expression) return;
    const expr = stripParens(init.expression);
    const acc = this.newFnAcc();
    const hctx = { ...ctx, scope: /** @type {Scope} */ ("handler"), fn: acc, comp: null, view: null, ownerName: ctx.ownerName };
    /** @type {Value} */
    let result;
    if (isFunctionLike(expr)) result = this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (expr), hctx, [constant()]);
    else {
      // onClick={save} / onClick={props.onClick} / onClick={service.reload}: the value is called with the event.
      const v = this.evalExpr(init.expression, { ...ctx, scope: "tracking", comp: { pending: false, failures: new Set(), reads: 0 }, view: null });
      if (ts.isArrayLiteralExpression(expr)) { this.unanalyzed(expr, "a bound handler array", "its handler is treated as possibly failing with unknown.", ctx); result = { ...constant(), promise: new Set(["unknown"]) }; }
      else result = this.callValueAsHandler(v, init.expression, hctx);
    }
    const escaping = new Set([...acc.throws, ...(result.promise ?? [])]);
    if (escaping.size) this.reportHandler(attr.name, `this ${attr.name.getText()} handler`, escaping, acc, ctx);
  }

  /** @param {Value} v @param {ts.Expression} at @param {Ctx} hctx */
  callValueAsHandler(v, at, hctx) {
    if (v.worst || !v.callables.length) {
      this.raise(hctx, ["unknown"], `${this.text(at)} has no failure information`, at);
      return constant();
    }
    /** @type {Value[]} */
    const results = [];
    for (const cb of v.callables) {
      if (cb.kind === "function" && cb.node) results.push(this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (cb.node), hctx, [constant()]));
      else if (cb.kind === "function") { this.raise(hctx, ["unknown"], `${cb.reasonText ?? this.text(at)} has no failure information`, at); results.push(constant()); }
      else if (cb.kind === "source") results.push(this.read(/** @type {Source} */ (cb.source), at, hctx));
      else results.push(constant());
    }
    return joinAll(results);
  }

  /** @param {ts.Node} at @param {string} what @param {Set<string>} failures @param {FnAcc} acc @param {Ctx} ctx */
  reportHandler(at, what, failures, acc, ctx) {
    const reasons = [...failures].map(f => acc.reasons.get(f)).filter((r, i, a) => r && a.indexOf(r) === i);
    this.report("UNHANDLED_HANDLER_FAILURE", "error", "error",
      `${what[0].toUpperCase()}${what.slice(1)} can fail with ${describeFailures(failures)}${reasons.length ? ` (${reasons.join("; ")})` : ""} and nothing catches it; a rendered Errored does not catch a handler's failure. Catch and handle it inside the handler.`,
      at, { ownerName: ctx.ownerName, ownerPath: ctx.view ? [...ctx.view.path] : undefined, data: { failures: [...failures] } });
  }

  // ---- views ---------------------------------------------------------------
  /**
   * @param {ts.Expression} e
   * @param {Ctx} ctx
   * @param {View} view
   */
  evalView(e, ctx, view) {
    const x = stripParens(e);
    if (ts.isJsxElement(x)) { this.evalJsxElement(x.openingElement, x.children, ctx, view, x); return; }
    if (ts.isJsxSelfClosingElement(x)) { this.evalJsxElement(x, [], ctx, view, x); return; }
    if (ts.isJsxFragment(x)) { for (const ch of x.children) this.evalJsxChild(ch, ctx, view); return; }
    if (ts.isConditionalExpression(x)) {
      // A condition computed outside the JSX runs in the enclosing scope (setup for a component's return).
      this.evalExpr(x.condition, ctx);
      this.evalView(x.whenTrue, ctx, view); this.evalView(x.whenFalse, ctx, view);
      return;
    }
    if (ts.isBinaryExpression(x) && (x.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || x.operatorToken.kind === ts.SyntaxKind.BarBarToken || x.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
      this.evalExpr(x.left, ctx); this.evalView(x.right, ctx, view); return;
    }
    if (x.kind === ts.SyntaxKind.NullKeyword || ts.isLiteralExpression(x) || (ts.isIdentifier(x) && x.text === "undefined")) return;
    // Anything else returned as a view (a call, a variable holding JSX): evaluated in the enclosing scope.
    this.evalExpr(x, ctx);
  }

  /** @param {ts.JsxChild} ch @param {Ctx} ctx @param {View} view */
  evalJsxChild(ch, ctx, view) {
    if (ts.isJsxText(ch)) return;
    if (ts.isJsxExpression(ch)) {
      if (!ch.expression) return;
      const x = stripParens(ch.expression);
      if (isFunctionLike(x)) { this.unanalyzed(x, "a function child of an element", "it is not a Show/For render callback; it is treated as a view under the current boundaries.", ctx); this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (x), { ...ctx, scope: "tracking", comp: null, view }, []); return; }
      this.evalExpr(ch.expression, { ...ctx, scope: "tracking", comp: null, view });
      return;
    }
    this.evalView(ch, ctx, view);
  }

  /**
   * @param {ts.JsxOpeningElement | ts.JsxSelfClosingElement} opening
   * @param {readonly ts.JsxChild[]} children
   * @param {Ctx} ctx
   * @param {View} view
   * @param {ts.Node} whole
   */
  evalJsxElement(opening, children, ctx, view, whole) {
    const tag = opening.tagName;
    const tctx = { ...ctx, scope: /** @type {Scope} */ ("tracking"), comp: null, view };
    // Intrinsic element
    if (ts.isIdentifier(tag) && /^[a-z]/.test(tag.text)) {
      for (const attr of opening.attributes.properties) {
        if (ts.isJsxSpreadAttribute(attr)) { this.unanalyzed(attr, "a spread on an element", "its attributes and handlers are not checked.", ctx); this.evalExpr(attr.expression, tctx); continue; }
        const name = attr.name.getText();
        if (isEventAttribute(name)) { this.analyzeHandlerAttribute(attr, { ...ctx, view }); continue; }
        if (name === "ref") {
          this.unanalyzed(attr, "a ref", "the ref callback runs as a handler; its reads are not tracked and its failures are unhandled.", ctx);
          this.analyzeHandlerAttribute(attr, { ...ctx, view });
          continue;
        }
        if (attr.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression) this.evalExpr(attr.initializer.expression, tctx);
      }
      for (const ch of children) this.evalJsxChild(ch, ctx, view);
      return;
    }
    // Component tag
    const tagNode = ts.isPropertyAccessExpression(tag) ? tag.name : tag;
    const api = solidApiOf(tagNode, this.checker);
    const attrs = opening.attributes.properties;
    /** @param {string} n */
    const attrExpr = n => { for (const a of attrs) if (ts.isJsxAttribute(a) && a.name.getText() === n && a.initializer && ts.isJsxExpression(a.initializer)) return a.initializer.expression ?? null; return null; };
    if (api) {
      switch (api.api) {
        case "Loading": {
          const fb = attrExpr("fallback"); if (fb) this.evalExprAsView(fb, ctx, view);
          ctx.component?.facts.boundaries.push({ kind: "Loading", loc: this.loc(whole) });
          const inner = { ...view, loading: true };
          for (const ch of children) this.evalJsxChild(ch, ctx, inner);
          return;
        }
        case "Errored": {
          const fb = attrExpr("fallback");
          if (fb) {
            const f = stripParens(fb);
            if (isFunctionLike(f)) {
              const fnode = /** @type {ts.FunctionLikeDeclaration} */ (f);
              const error = { name: "error", reactive: true, pending: false, failures: new Set(), worst: false, node: f };
              this.analyzeFunction(fnode, { ...tctx, view }, [callable({ kind: "source", node: f, source: error }), callable({ kind: "safe", node: f })]);
            } else this.evalExprAsView(fb, ctx, view);
          }
          ctx.component?.facts.boundaries.push({ kind: "Errored", loc: this.loc(whole) });
          const inner = { ...view, errored: true };
          for (const ch of children) this.evalJsxChild(ch, ctx, inner);
          return;
        }
        case "Show": case "Match": {
          const when = attrExpr("when");
          const whenValue = when ? this.evalExpr(when, tctx) : constant();
          const fb = attrExpr("fallback"); if (fb) this.evalExprAsView(fb, ctx, view);
          for (const a of attrs) if (ts.isJsxAttribute(a) && !["when", "fallback", "keyed"].includes(a.name.getText()) && a.initializer && ts.isJsxExpression(a.initializer) && a.initializer.expression) this.evalExpr(a.initializer.expression, tctx);
          for (const ch of children) this.evalRenderCallbackOrChild(ch, ctx, view, [{ name: "when", reactive: true, pending: false, failures: new Set(), worst: whenValue.worst, node: when ?? whole }]);
          return;
        }
        case "For": case "Index": case "Repeat": {
          const each = attrExpr("each") ?? attrExpr("count");
          const eachValue = each ? this.evalExpr(each, tctx) : constant();
          const fb = attrExpr("fallback"); if (fb) this.evalExprAsView(fb, ctx, view);
          for (const ch of children) this.evalRenderCallbackOrChild(ch, ctx, view, [
            { name: "item", reactive: true, pending: false, failures: new Set(), worst: eachValue.worst, node: each ?? whole },
            { name: "index", reactive: true, pending: false, failures: new Set(), worst: false, node: each ?? whole }
          ]);
          return;
        }
        case "Switch": {
          const fb = attrExpr("fallback"); if (fb) this.evalExprAsView(fb, ctx, view);
          for (const ch of children) this.evalJsxChild(ch, ctx, view);
          return;
        }
        default: {
          this.unanalyzed(opening, `<${tag.getText()}>`, "this Solid component is not modeled in the slice; its children are checked under the current boundaries and its own value is treated as the worst case.", ctx);
          for (const a of attrs) if (ts.isJsxAttribute(a) && a.initializer && ts.isJsxExpression(a.initializer) && a.initializer.expression) this.evalExpr(a.initializer.expression, tctx);
          for (const ch of children) this.evalJsxChild(ch, ctx, view);
          return;
        }
      }
    }
    // A context provider (<Ctx value={…}>) or a user component.
    const b = ts.isIdentifier(tag) ? this.bindingOf(this.symbolOf(tag)) : undefined;
    if (!b || b.kind !== "component") {
      const isContext = ts.isIdentifier(tag) && this.isContextValue(tag);
      this.unanalyzed(opening, isContext ? `<${tag.getText()} value={…}> (a context provider)` : `<${tag.getText()}>`,
        isContext ? "context is the next area; the provided value is not followed into consumers (each useContext is treated as the worst case) and the children are checked under the current boundaries." : "its component cannot be resolved to a project function; its children are checked under the current boundaries.", ctx);
      for (const a of attrs) if (ts.isJsxAttribute(a) && a.initializer && ts.isJsxExpression(a.initializer) && a.initializer.expression) this.evalExpr(a.initializer.expression, tctx);
      for (const ch of children) this.evalJsxChild(ch, ctx, view);
      return;
    }
    this.renderChild(b.component, opening, children, ctx, view, whole);
  }

  /** @param {ts.Identifier} tag */
  isContextValue(tag) {
    const symbol = this.symbolOf(tag);
    const decl = symbol?.declarations?.[0];
    if (decl && ts.isVariableDeclaration(decl) && decl.initializer) {
      const init = stripParens(decl.initializer);
      if (ts.isCallExpression(init)) { const api = solidApiOf(init.expression, this.checker); return !!api && api.api === "createContext"; }
    }
    const type = this.checker.getTypeAtLocation(tag);
    return /Context/.test(this.checker.typeToString(type));
  }

  /** A `fallback={…}`: JSX is a view under the outer boundaries; other expressions are tracking reads. @param {ts.Expression} e @param {Ctx} ctx @param {View} view */
  evalExprAsView(e, ctx, view) {
    const x = stripParens(e);
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) this.evalView(x, ctx, view);
    else this.evalExpr(e, { ...ctx, scope: "tracking", comp: null, view });
  }

  /** Show / For children: a render callback whose parameters are safe accessors, or plain children. @param {ts.JsxChild} ch @param {Ctx} ctx @param {View} view @param {Source[]} params */
  evalRenderCallbackOrChild(ch, ctx, view, params) {
    if (ts.isJsxExpression(ch) && ch.expression) {
      const x = stripParens(ch.expression);
      if (isFunctionLike(x)) {
        const fn = /** @type {ts.FunctionLikeDeclaration} */ (x);
        const args = params.map(p => callable({ kind: "source", node: x, source: p }));
        this.analyzeRenderCallback(fn, { ...ctx, scope: "tracking", comp: null, view }, args);
        return;
      }
    }
    this.evalJsxChild(ch, ctx, view);
  }

  /** @param {ts.FunctionLikeDeclaration} fn @param {Ctx} ctx @param {Value[]} args */
  analyzeRenderCallback(fn, ctx, args) {
    // Keyed For hands the item as a plain value, not an accessor: either way the body is a view in a tracking scope.
    fn.parameters.forEach((p, i) => {
      if (ts.isIdentifier(p.name)) { const sym = this.symbolOf(p.name); if (sym) this.bindings.set(sym, { kind: "value", value: args[i] ?? constant() }); }
      else if (ts.isObjectBindingPattern(p.name)) for (const el of p.name.elements) if (ts.isIdentifier(el.name)) { const sym = this.symbolOf(el.name); if (sym) this.bindings.set(sym, { kind: "value", value: constant() }); }
    });
    const body = fn.body;
    if (!body) return;
    const view = /** @type {View} */ (ctx.view);
    if (ts.isBlock(body)) {
      // Statements before the return run in a tracking scope; returned JSX is the view.
      for (const s of body.statements) {
        if (ts.isReturnStatement(s) && s.expression) this.evalView(s.expression, ctx, view);
        else this.analyzeStatement(s, ctx, null);
      }
    } else this.evalView(body, ctx, view);
  }

  /**
   * <Child …/>: props flow into the child's table; the child's summary flows back under this position's boundaries.
   * @param {Component} child
   * @param {ts.JsxOpeningElement | ts.JsxSelfClosingElement} opening
   * @param {readonly ts.JsxChild[]} children
   * @param {Ctx} ctx
   * @param {View} view
   * @param {ts.Node} whole
   */
  renderChild(child, opening, children, ctx, view, whole) {
    child.nextCallers++;
    for (const attr of opening.attributes.properties) {
      if (ts.isJsxSpreadAttribute(attr)) {
        this.unanalyzed(attr, "a spread into a component's props", "every prop of the child is treated as the worst case (possibly reactive, pending and failing).", ctx);
        this.evalExpr(attr.expression, { ...ctx, scope: "tracking", comp: null, view });
        child.nextPropsWorst = true;
        continue;
      }
      const name = attr.name.getText();
      const value = this.propValue(attr, ctx, view);
      const entry = child.nextProps.get(name) ?? { values: [], worst: false };
      entry.values.push(value);
      if (value.worst) entry.worst = true;
      child.nextProps.set(name, entry);
    }
    if (children.length) {
      const meaningful = children.filter(ch => !(ts.isJsxText(ch) && ch.containsOnlyTriviaWhiteSpaces));
      const entry = child.nextProps.get("children") ?? { values: [], worst: false };
      for (const ch of meaningful) {
        if (ts.isJsxExpression(ch) && ch.expression) {
          const x = stripParens(ch.expression);
          if (isFunctionLike(x)) { entry.values.push(callable({ kind: "function", node: x })); continue; }
          entry.values.push(this.propExpressionValue(ch.expression, ctx, view));
        } else {
          // JSX children render where the child places them; checked here under the current boundaries.
          this.evalView(/** @type {ts.Expression} */ (/** @type {unknown} */ (ch)), ctx, view);
          entry.values.push(constant());
        }
      }
      child.nextProps.set("children", entry);
    }
    // The child's obligations (previous pass) land here.
    const summary = this.childSummaries.get(child) ?? child.summary;
    const path = [...view.path, `<${child.name}>`];
    for (const o of summary.pending) if (!view.loading) this.current.pending.push({ ...o, path: [...path, ...o.path.slice(1)] });
    for (const o of summary.failures) if (!view.errored) this.current.failures.push({ ...o, path: [...path, ...o.path.slice(1)] });
    void whole;
  }

  /** The value a caller passes for a prop: reads are deferred to the child, so they are collected, not obligated. @param {ts.JsxAttribute} attr @param {Ctx} ctx @param {View} view */
  propValue(attr, ctx, view) {
    const init = attr.initializer;
    if (!init) return constant(); // <Comp flag />
    if (ts.isStringLiteral(init)) return constant();
    if (ts.isJsxExpression(init) && init.expression) {
      if (isEventAttribute(attr.name.getText()) && isFunctionLike(stripParens(init.expression))) return callable({ kind: "function", node: stripParens(init.expression) });
      return this.propExpressionValue(init.expression, ctx, view);
    }
    if (ts.isJsxElement(init) || ts.isJsxSelfClosingElement(init) || ts.isJsxFragment(init)) { this.evalView(init, ctx, view); return constant(); }
    return constant();
  }

  /** @param {ts.Expression} e @param {Ctx} ctx @param {View} view */
  propExpressionValue(e, ctx, view) {
    const x = stripParens(e);
    if (isFunctionLike(x)) return callable({ kind: "function", node: x });
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) { this.evalView(x, ctx, view); return constant(); }
    const acc = { pending: false, failures: new Set(), reads: 0 };
    const v = this.evalExpr(e, { ...ctx, scope: "tracking", comp: acc, view: null });
    return { ...v, reactive: v.reactive || acc.reads > 0, pending: v.pending || acc.pending, failures: new Set([...v.failures, ...acc.failures]) };
  }

  // ---- roots ---------------------------------------------------------------
  reportRoots() {
    /** @param {Obligation} o @param {"pending" | "failure"} kind @param {Loc} rootLoc @param {string} rootWhat */
    const emit = (o, kind, rootLoc, rootWhat) => {
      const node = this.nodeAt(o.loc);
      if (!node) return;
      const where = `${rootWhat} at ${rootLoc.file.split("/").pop()}:${rootLoc.line}`;
      if (kind === "pending")
        this.report("ASYNC_OUTSIDE_LOADING_BOUNDARY", "async", "error",
          `"${o.source}" may be pending here and no Loading boundary is above this read, up to the ${where}; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller.`,
          node, { ownerName: o.path[o.path.length - 1], ownerPath: o.path, related: [{ message: `the ${rootWhat}`, loc: rootLoc }], data: { source: o.source } });
      else
        this.report("ERROR_OUTSIDE_ERRORED_BOUNDARY", "error", "error",
          `"${o.source}" may fail with ${describeFailures(o.failures ?? new Set())} here and no Errored boundary is above this read, up to the ${where}; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller.`,
          node, { ownerName: o.path[o.path.length - 1], ownerPath: o.path, related: [{ message: `the ${rootWhat}`, loc: rootLoc }], data: { failures: [...(o.failures ?? [])], source: o.source } });
    };
    for (const root of this.roots) {
      const summary = root.component ? root.component.summary : root.rootSummary;
      if (!summary) continue;
      for (const o of summary.pending) emit(o, "pending", root.loc, "render root");
      for (const o of summary.failures) emit(o, "failure", root.loc, "render root");
    }
    for (const c of this.components.values()) {
      for (const h of c.handedOff) {
        for (const o of c.summary.pending) emit(o, "pending", h, "hand-off");
        for (const o of c.summary.failures) emit(o, "failure", h, "hand-off");
      }
      if (c.exported && !c.rendered.length && !c.handedOff.length && c.callers === 0 && (c.summary.pending.length || c.summary.failures.length)) {
        const name = c.node.name ?? (ts.isVariableDeclaration(c.node.parent) ? c.node.parent.name : c.node);
        const pend = c.summary.pending.map(o => o.source);
        const fail = c.summary.failures.map(o => `${o.source}: ${describeFailures(o.failures ?? new Set())}`);
        this.report("COMPONENT_OBLIGATIONS_EXPORTED", "analysis", "info",
          `<${c.name}> is exported and nothing in this program renders it; it may be ${[pend.length ? `pending (${[...new Set(pend)].join(", ")})` : "", fail.length ? `failing (${[...new Set(fail)].join(", ")})` : ""].filter(Boolean).join(" and ")}. Its renderers must provide the Loading / Errored boundary.`,
          name, { ownerName: `<${c.name}>`, data: { pending: pend, failures: fail } });
      }
    }
  }

  /** @param {Loc} loc */
  nodeAt(loc) {
    const sf = this.program.getSourceFile(loc.file);
    if (!sf) return null;
    const pos = sf.getPositionOfLineAndCharacter(loc.line - 1, loc.col - 1);
    /** @param {ts.Node} n @returns {ts.Node | null} */
    const find = n => {
      if (n.getStart(sf) === pos) return n;
      let hit = null;
      ts.forEachChild(n, ch => { if (!hit && ch.getStart(sf) <= pos && ch.getEnd() >= pos) hit = find(ch); });
      return hit;
    };
    return find(sf) ?? ({ getSourceFile: () => sf, getStart: () => pos, getEnd: () => pos });
  }

  facts() {
    return [...this.components.values()].map(c => c.facts);
  }
}
