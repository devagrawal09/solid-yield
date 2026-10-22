// @ts-check
// Prototype B — the dataflow analysis proper. One `Analysis` per program;
// `run()` follows render paths with invocation-local props and provider values,
// then reports undischarged read obligations at roots and hand-offs.
import ts from "typescript";
import { ProjectBoundary } from "./project.mjs";
import { BY_CODE } from "../../src/codes.mjs";
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
/** @typedef {Pick<ts.Node, "getSourceFile" | "getStart" | "getEnd">} LocNode */
/** @typedef {"setup" | "tracking" | "handler" | "effect" | "untracked" | "ref"} Scope */

/** @typedef {{ loc: Loc, path: string[], source: string, failures?: Set<string>, uncoverable?: boolean, related?: Loc[] }} Obligation */

/**
 * @typedef {{
 *   name: string,
 *   node: ts.FunctionLikeDeclaration,
 *   file: ts.SourceFile,
 *   exported: boolean,
 *   propsParam: ts.ParameterDeclaration | null,
 *   props: Map<string, { values: Value[], worst: boolean }>,
 *   propsWorst: boolean,
 *   callers: number,
 *   handedOff: Loc[],
 *   rendered: Loc[],
 *   summary: { pending: Obligation[], failures: Obligation[] },
 *   facts: import("../../src/types.d.ts").ComponentFacts
 * }} Component
 */

/**
 * @typedef {{ file: string, kind: string, component?: string, ms: number, steps: number, partial: boolean }} WorkTiming
 * @typedef {{ opaqueImports?: Map<string, Set<string>>, onProgress?: (row: WorkTiming) => void, onPhase?: (stage: string) => void }} RuntimeConfig
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
 *   untracked?: boolean,
 *   refAt?: ts.Node
 * }} Ctx
 */

/**
 * @typedef {(
 *   | { kind: "signal", source: Source }
 *   | { kind: "setter", name: string }
 *   | { kind: "memo", source: Source }
 *   | { kind: "accessor", source: Source }
 *   | { kind: "value", value: Value }
 *   | { kind: "function", node: ts.FunctionLikeDeclaration, environment?: Map<ts.Symbol, Binding> }
 *   | { kind: "component", component: Component }
 *   | { kind: "props", component: Component }
 *   | { kind: "object", node: ts.ObjectLiteralExpression, value: Value }
 *   | { kind: "caught", failures: Set<string> }
 * )} Binding
 */

const MAX_DEPTH = 24;

export class Analysis {
  /**
   * @param {ts.Program} program
   * @param {readonly string[]} files absolute paths of the checked files
   * @param {RuntimeConfig} [runtime]
   */
  constructor(program, files, runtime = {}) {
    this.runtime = runtime;
    this.steps = 0;
    this.deadline = Infinity;
    /** @type {ts.Node | null} */
    this.limitNode = null;
    this.limitReported = false;
    /** @type {WorkTiming[]} */
    this.timings = [];
    /** @type {WeakMap<LocNode, Loc>} */
    this.locations = new WeakMap();
    /** @type {WeakMap<ts.Node, string>} */
    this.texts = new WeakMap();
    /** @type {WeakMap<ts.Node, ts.Symbol | undefined>} */
    this.symbols = new WeakMap();
    /** @type {WeakMap<object, Set<string>>} */
    this.factKeys = new WeakMap();
    this.mutationVersion = 0;
    /** @type {Map<Component, { signature: Map<string, (Source | string)[]> | null, providers: Map<import("./values.mjs").ContextBinding, Value>, globalsSize: number, mutationVersion: number }>} */
    this.componentActivations = new Map();
    this.program = program;
    this.project = new ProjectBoundary(program, files);
    this.checker = program.getTypeChecker();
    /** @type {Value} */
    this.thisValue = constant();
    /** @type {Map<ts.Symbol, Binding>} */
    this.bindings = new Map();
    /** @type {Map<ts.Node, Component>} */
    this.components = new Map();
    /** @type {SoundDiagnostic[]} */
    this.diagnostics = [];
    /** @type {{ component: Component | null, view: ts.Node | null, loc: Loc, rootSummary?: { pending: Obligation[], failures: Obligation[] } }[]} */
    this.roots = [];
    /** @type {Set<ts.Node>} */
    this.activeFunctions = new Set();
    this.iteration = 0;
    this.finalIteration = 0;
    /** @type {Set<string>} */
    this.reported = new Set();
    /** @type {Map<ts.Symbol, Binding>} */
    this.moduleBindings = this.bindings;
    /** @type {Set<ts.Symbol>} */
    this.initializing = new Set();
    /** @type {Map<import("./values.mjs").ContextBinding, Value>} */
    this.providers = new Map();
    /** @type {Set<Component>} */
    this.visitedComponents = new Set();
    /** @type {Set<Component>} */
    this.activeComponents = new Set();
    /** @type {{ pending: Obligation[], failures: Obligation[] }} */
    this.current = { pending: [], failures: [] };
    /** @type {ts.Node | null} */
    this.setupFailureNode = null;
  }

  // A budget belongs to an outer activation, including all calls/render paths.
  // A cut-off is an unknown read/failure, never an empty/safe summary.
  /** @param {ts.Node} node */
  beginWork(node) {
    this.steps = 0;
    this.deadline = performance.now() + 1000;
    this.limitNode = node;
    this.limitReported = false;
  }

  exhausted() { return ++this.steps > 20000 || performance.now() > this.deadline; }

  /** @param {ts.Node} node @param {Ctx} ctx @param {string} [construct] */
  limitValue(node, ctx, construct = "analysis work limit") {
    if (!this.limitReported) {
      this.unanalyzed(this.limitNode ?? node, construct, "the remaining activation has worst-case reads, results and failures.", ctx);
      this.limitReported = true;
    }
    const value = worst();
    this.obligateValue(value, node, ctx, construct);
    this.raise(ctx, ["unknown"], construct, node);
    return value;
  }

  /** @template T @param {T[] | undefined} list @param {T} value */
  recordFact(list, value) {
    if (!list) return;
    let keys = this.factKeys.get(list);
    if (!keys) this.factKeys.set(list, keys = new Set());
    const key = JSON.stringify(value) ?? "undefined";
    if (keys.has(key)) return;
    keys.add(key);
    list.push(value);
  }

  // ---- locations & reporting -----------------------------------------------
  /** @param {LocNode} node @returns {Loc} */
  loc(node) {
    const cached = this.locations.get(node);
    if (cached) return cached;
    const sf = node.getSourceFile();
    const start = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    const end = sf.getLineAndCharacterOfPosition(node.getEnd());
    const loc = { file: sf.fileName, line: start.line + 1, col: start.character + 1, endLine: end.line + 1, endCol: end.character + 1 };
    this.locations.set(node, loc);
    return loc;
  }

  /** @param {ts.Node} node */
  text(node) {
    const cached = this.texts.get(node);
    if (cached !== undefined) return cached;
    const t = node.getText();
    const text = t.length > 60 ? t.slice(0, 57) + "…" : t;
    this.texts.set(node, text);
    return text;
  }

  /**
   * @param {SoundDiagnostic["code"]} code
   * @param {SoundDiagnostic["kind"]} kind
   * @param {SoundDiagnostic["severity"]} severity
   * @param {string} message
   * @param {LocNode} node
   * @param {Partial<SoundDiagnostic>} [more]
   */
  report(code, kind, severity, message, node, more) {
    if (this.iteration !== this.finalIteration || !this.isProjectFile(node.getSourceFile())) return;
    const loc = this.loc(node);
    const key = `${code}@${loc.file}:${loc.line}:${loc.col}`;
    if (this.reported.has(key)) return;
    this.reported.add(key);
    this.diagnostics.push({ code, kind, severity: BY_CODE[code].severity, message, loc, ...more });
  }

  /** @param {ts.Node} node @param {string} construct @param {string} assumption @param {Ctx} ctx */
  unanalyzed(node, construct, assumption, ctx) {
    this.report("UNANALYZED_BOUNDARY", "analysis", "warn",
      `${construct} is outside the checked subset; ${assumption} Nothing here is trusted: downstream obligations still surface.`,
      node, { ownerName: ctx.ownerName, data: { construct } });
    this.recordFact(ctx.component?.facts.unanalyzed, { loc: this.loc(node), construct });
  }

  // ---- symbols -------------------------------------------------------------
  /** @param {ts.Node} node */
  symbolOf(node) {
    if (this.symbols.has(node)) return this.symbols.get(node);
    const symbol = resolveAlias(this.checker.getSymbolAtLocation(node), this.checker);
    this.symbols.set(node, symbol);
    return symbol;
  }

  /** @param {ts.Symbol | undefined} symbol */
  bindingOf(symbol) {
    if (!symbol) return undefined;
    const declaration = symbol.declarations?.[0];
    const moduleVariable = declaration && ts.isVariableDeclaration(declaration) && ts.isSourceFile(declaration.parent.parent.parent);
    let b = moduleVariable ? this.moduleBindings.get(symbol) : this.bindings.get(symbol) ?? this.moduleBindings.get(symbol);
    if (b) return b;
    if (declaration && this.isProjectFile(declaration.getSourceFile())) {
      // Module-level declarations are bound on demand.
      if (ts.isClassDeclaration(declaration)) {
        b = { kind: "value", value: { ...constant(), classes: [{ node: declaration, environment: this.bindings }] } };
        this.bindings.set(symbol, b);
      } else if (ts.isFunctionDeclaration(declaration) && declaration.body) {
        b = this.bindFunction(symbol, declaration);
      } else if (ts.isVariableDeclaration(declaration) && declaration.initializer && ts.isSourceFile(declaration.parent.parent.parent)) {
        const init = stripParens(declaration.initializer);
        if (isFunctionLike(init)) b = this.bindFunction(symbol, /** @type {ts.FunctionLikeDeclaration} */ (init));
        else if (!this.initializing.has(symbol)) {
          this.initializing.add(symbol);
          const saved = this.bindings;
          this.bindings = this.moduleBindings;
          this.analyzeVariableDeclaration(declaration, { component: null, scope: "setup", fn: this.newFnAcc(), comp: null, view: null, depth: 0, ownerName: "module" });
          b = this.bindings.get(symbol);
          this.bindings = saved;
          this.initializing.delete(symbol);
        }
      }
    }
    return b;
  }

  /** Does the call resolve to a default-lib declaration? @param {ts.CallExpression} call */
  isLibMethod(call) {
    const sf = this.checker.getResolvedSignature(call)?.getDeclaration()?.getSourceFile();
    return !!sf && this.program.isSourceFileDefaultLibrary(sf);
  }

  /** Is this identifier the lib global of that name (Promise, JSON, setTimeout, fetch, …)? @param {ts.Identifier} id */
  isLibGlobal(id) {
    const decl = this.symbolOf(id)?.declarations?.[0];
    return !!decl && this.program.isSourceFileDefaultLibrary(decl.getSourceFile());
  }

  /** @param {ts.SourceFile} sf */
  isProjectFile(sf) {
    return this.project.isAuthored(sf);
  }

  /**
   * @param {ts.Symbol} symbol
   * @param {ts.FunctionLikeDeclaration} node
   * @returns {Binding}
   */
  bindFunction(symbol, node) {
    const component = this.componentOf(node);
    /** @type {Binding} */
    const b = component ? { kind: "component", component } : { kind: "function", node, environment: this.moduleBindings ?? this.bindings };
    this.bindings.set(symbol, b);
    return b;
  }

  // ---- components ----------------------------------------------------------
  /** @param {ts.FunctionLikeDeclaration} node */
  componentOf(node) {
    if (!this.isProjectFile(node.getSourceFile())) return null;
    const existing = this.components.get(node);
    if (existing) return existing;
    if (!this.returnsJsx(node)) return null;
    const name = this.functionName(node);
    const sf = node.getSourceFile();
    /** @type {Component} */
    const component = {
      name, node, file: sf, exported: this.isExported(node),
      propsParam: node.parameters[0] ?? null,
      props: new Map(), propsWorst: false, callers: 0, handedOff: [], rendered: [],
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

  /** @param {ts.Expression} e @returns {boolean} */
  isViewExpression(e) {
    const x = stripParens(e);
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) return true;
    if (ts.isConditionalExpression(x)) return this.isViewExpression(x.whenTrue) || this.isViewExpression(x.whenFalse);
    if (ts.isBinaryExpression(x) && (x.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || x.operatorToken.kind === ts.SyntaxKind.BarBarToken || x.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) return this.isViewExpression(x.right) || this.isViewExpression(x.left);
    return false;
  }

  // ---- the whole-program driver --------------------------------------------
  run() {
    this.iteration = 0;
    this.finalIteration = 0;
    this.reported = new Set();
    this.moduleBindings = this.bindings;
    this.initializing = new Set();
    this.providers = new Map();
    this.visitedComponents = new Set();
    this.current = { pending: [], failures: [] };
    this.setupFailureNode = null;
    for (const sf of this.program.getSourceFiles()) if (this.isProjectFile(sf)) this.collectComponents(sf);
    this.runtime.onPhase?.("collected");
    for (const sf of this.program.getSourceFiles()) if (this.isProjectFile(sf)) {
      this.beginWork(sf);
      const start = performance.now();
      this.analyzeModuleTopLevel(sf);
      const row = { file: sf.fileName, kind: "module", ms: performance.now() - start, steps: this.steps, partial: this.limitReported };
      this.timings.push(row);
      this.runtime.onProgress?.(row);
    }
    this.runtime.onPhase?.("modules");
    // Exported components and hand-offs still need a summary when no render
    // path reaches them. Rendered components are checked separately per path.
    for (const c of this.components.values()) {
      if (!this.visitedComponents.has(c) && (c.exported || c.handedOff.length)) {
        const saved = this.current;
        this.beginWork(c.node);
        const start = performance.now();
        c.summary = this.analyzeComponent(c);
        const row = { file: c.file.fileName, component: c.name, kind: "component", ms: performance.now() - start, steps: this.steps, partial: this.limitReported };
        this.timings.push(row);
        this.runtime.onProgress?.(row);
        this.current = saved;
      }
    }
    this.runtime.onPhase?.("components");
    this.reportRoots();
    this.runtime.onPhase?.("roots");
    return this.diagnostics;
  }

  /** @param {ts.SourceFile} sf */
  collectComponents(sf) {
    /** @param {ts.Node} n */
    const visit = n => {
      if ((ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && n.body) {
        const parentIsModule = ts.isFunctionDeclaration(n) ? ts.isSourceFile(n.parent) : (ts.isVariableDeclaration(n.parent) && ts.isSourceFile(n.parent.parent.parent.parent));
        if (parentIsModule) {
          const c = this.componentOf(n);
          const symbol = ts.isFunctionDeclaration(n) ? (n.name ? this.symbolOf(n.name) : undefined) : (ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name) ? this.symbolOf(n.parent.name) : undefined);
          if (symbol) this.bindings.set(symbol, c ? { kind: "component", component: c } : { kind: "function", node: n, environment: this.moduleBindings ?? this.bindings });
          if (c) return; // components are analyzed by analyzeComponent
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }

  /** @param {ts.SourceFile} sf */
  analyzeModuleTopLevel(sf) {
    for (const statement of sf.statements) {
      if (ts.isImportEqualsDeclaration(statement) && ts.isExternalModuleReference(statement.moduleReference)) {
        const expression = statement.moduleReference.expression;
        if (expression && ts.isStringLiteral(expression) && this.runtime.opaqueImports?.get(sf.fileName)?.has(expression.text)) this.report("UNANALYZED_BOUNDARY", "analysis", "warn", "This import resolves to unchecked source; its values retain worst-case facts until consumed.", expression, { data: { construct: "unchecked source import" } });
      }
      if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) && this.runtime.opaqueImports?.get(sf.fileName)?.has(statement.moduleSpecifier.text)) {
        this.report("UNANALYZED_BOUNDARY", "analysis", "warn", "This re-export resolves to unchecked source. Its exported values and result shapes remain worst case.", statement.moduleSpecifier, { data: { construct: "unchecked source re-export" } });
      }
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && !statement.importClause?.isTypeOnly && this.runtime.opaqueImports?.get(sf.fileName)?.has(statement.moduleSpecifier.text)) {
        this.report("UNANALYZED_BOUNDARY", "analysis", "warn", "This import resolves to an unchecked source file. Its implementation and types are opaque; imported values keep worst-case reads, results and failures. Include the file among checked roots for full analysis.", statement.moduleSpecifier, { data: { construct: "unchecked source import" } });
      }
    }
    /** @type {Ctx} */
    const ctx = { component: null, scope: "setup", fn: this.newFnAcc(), comp: null, view: null, depth: 0, ownerName: sf.fileName.split("/").pop() ?? "" };
    for (const statement of sf.statements) {
      if (ts.isFunctionDeclaration(statement)) continue;
      if (ts.isVariableStatement(statement)) {
        for (const d of statement.declarationList.declarations) {
          if (d.initializer && isFunctionLike(stripParens(d.initializer))) continue;
          const symbol = ts.isIdentifier(d.name) ? this.symbolOf(d.name) : undefined;
          if (!symbol || !this.moduleBindings.has(symbol)) this.analyzeVariableDeclaration(d, ctx);
        }
        continue;
      }
      if (ts.isExpressionStatement(statement)) { this.evalExpr(statement.expression, ctx); continue; }
      if (ts.isIfStatement(statement)) { this.analyzeStatement(statement, ctx, null); continue; }
      if (ts.isExportAssignment(statement)) { this.evalExpr(statement.expression, ctx); continue; }
    }
  }

  /** @returns {FnAcc} */
  newFnAcc() { return { throws: new Set(), reasons: new Map() }; }

  // Build a cycle key without evaluating lazy props. Only primitive held facts
  // and forwarded signal/memo reads have a supported key. Capture it BEFORE
  // setup can change bindings, rather than reading old lazy inputs again later.
  /** @param {Component["props"]} props @returns {Map<string, (Source | string)[]> | null} */
  recursiveSignature(props) {
    if (props.size > 128) return null;
    /** @param {Value} value @param {Set<Value>} seen @returns {(Source | string)[] | null} */
    const normalize = (value, seen) => {
      if (seen.size > MAX_DEPTH || seen.has(value) || value.objects?.length || value.classes?.length || value.contexts?.length || value.props?.length || value.callables.length) return null;
      const plain = !value.reactive && !value.pending && !value.failures.size && !value.promise && !value.worst && !value.opaque && !value.opaqueResult && !value.caught && !value.unreachable;
      if (!value.deferred?.length) return plain ? ["held:" + value.undefined] : null;
      if (!plain || value.deferred.length !== 1) return null;
      const nextSeen = new Set(seen); nextSeen.add(value);
      const deferred = value.deferred[0], expression = stripParens(deferred.expression);
      if (ts.isNumericLiteral(expression) || ts.isStringLiteral(expression) || expression.kind === ts.SyntaxKind.TrueKeyword || expression.kind === ts.SyntaxKind.FalseKeyword || expression.kind === ts.SyntaxKind.NullKeyword) return ["held:undefined"];
      /** @param {ts.Node} node */
      const binding = node => { const symbol = this.symbolOf(node); return symbol ? deferred.environment.get(symbol) ?? this.moduleBindings.get(symbol) : undefined; };
      if (ts.isIdentifier(expression)) {
        const b = binding(expression);
        return b?.kind === "value" ? normalize(b.value, nextSeen) : null;
      }
      if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
        const b = binding(expression.expression);
        if (b?.kind !== "props" || b.component.propsWorst) return null;
        const entry = b.component.props.get(expression.name.text);
        if (!entry || entry.worst) return null;
        const parts = entry.values.map(v => normalize(v, nextSeen));
        return parts.some(part => part === null) ? null : parts.flatMap(part => part ?? []);
      }
      if (ts.isCallExpression(expression) && !expression.arguments.length && ts.isIdentifier(expression.expression)) {
        const b = binding(expression.expression);
        if (b && (b.kind === "signal" || b.kind === "memo" || b.kind === "accessor")) {
          const source = b.source;
          return [source, JSON.stringify([source.reactive, source.pending, source.worst, [...source.failures].sort()])];
        }
      }
      return null;
    };
    /** @type {Map<string, (Source | string)[]>} */
    const signature = new Map();
    for (const [name, entry] of props) {
      if (entry.worst) return null;
      const parts = entry.values.map(v => normalize(v, new Set()));
      if (parts.some(part => part === null)) return null;
      signature.set(name, parts.flatMap(part => part ?? []));
    }
    return signature;
  }

  /** @param {Component} base @param {Component["props"]} props */
  sameRecursiveInputs(base, props) {
    const active = this.componentActivations.get(base);
    if (!active || base.propsWorst || active.globalsSize !== this.moduleBindings.size || active.mutationVersion !== this.mutationVersion || this.thisValue.objects?.length || this.providers.size !== active.providers.size) return false;
    for (const [context, value] of this.providers) {
      if (active.providers.get(context) !== value || value.objects?.length || value.classes?.length || value.callables.length || value.deferred?.length || value.contexts?.length || value.props?.length) return false;
    }
    const signature = this.recursiveSignature(props);
    if (!signature || !active.signature || signature.size !== active.signature.size) return false;
    for (const [name, values] of signature) {
      const previous = active.signature.get(name);
      if (!previous || values.length !== previous.length || values.some((v, i) => v !== previous[i])) return false;
    }
    return true;
  }

  /**
   * @param {Component} base
   * @param {Map<string, { values: Value[], worst: boolean }>} [props]
   */
  analyzeComponent(base, props = base.props) {
    const exhausted = this.exhausted();
    if (!exhausted && this.activeComponents.has(base) && this.sameRecursiveInputs(base, props)) return { pending: [], failures: [] };
    if (this.activeComponents.has(base) || exhausted) {
      const construct = "recursive or bounded component";
      this.unanalyzed(base.node, construct, "unvisited setup, handlers and views retain unknown failures and pending reads.", { component: base, scope: "setup", fn: this.newFnAcc(), comp: null, view: null, depth: 0, ownerName: "<" + base.name + ">" });
      this.report("SETUP_MAY_THROW", "error", "error", "This component activation is only partially checked; its setup may fail with unknown.", base.node, { data: { failures: ["unknown"] } });
      base.facts.pending = "unknown";
      base.facts.failures = [...new Set([...base.facts.failures, "unknown"])];
      const obligation = { loc: this.loc(base.node), path: ["<" + base.name + ">"], source: construct };
      return { pending: [obligation], failures: [{ ...obligation, failures: new Set(["unknown"]) }] };
    }
    this.activeComponents.add(base);
    this.visitedComponents.add(base);
    const c = { ...base, props, propsWorst: props.get("*")?.worst ?? base.propsWorst };
    this.componentActivations.set(base, { signature: this.recursiveSignature(props), providers: new Map(this.providers), globalsSize: this.moduleBindings.size, mutationVersion: this.mutationVersion });
    const savedBindings = this.bindings;
    const savedFailure = this.setupFailureNode;
    this.setupFailureNode = null;
    this.bindings = this.bindings === this.moduleBindings ? new Map() : new Map(this.bindings);
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
    c.facts.pending = c.facts.pending || summary.pending.length > 0;
    c.facts.failures = [...new Set([...c.facts.failures, ...summary.failures.flatMap(o => [...(o.failures ?? [])])])];
    base.summary = { pending: [...base.summary.pending, ...summary.pending], failures: [...base.summary.failures, ...summary.failures] };
    this.activeComponents.delete(base);
    this.componentActivations.delete(base);
    this.bindings = savedBindings;
    this.setupFailureNode = savedFailure;
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
    for (const s of block.statements) if (ts.isFunctionDeclaration(s) && s.name && s.body) { const symbol = this.symbolOf(s.name); if (symbol && !this.bindings.has(symbol)) this.bindings.set(symbol, { kind: "function", node: s, environment: this.bindings }); }
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
      if (s.name && s.body) { const symbol = this.symbolOf(s.name); if (symbol) this.bindings.set(symbol, { kind: "function", node: s, environment: this.bindings }); }
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
        const source = { name, reactive: true, pending: ctx.component === null, failures: new Set(ctx.component === null ? ["unknown"] : []), worst: ctx.component === null, node: init };
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
      if (isFunctionLike(init)) { this.bindings.set(symbol, { kind: "function", node: /** @type {ts.FunctionLikeDeclaration} */ (init), environment: this.bindings }); return; }
      if (ts.isCallExpression(init)) {
        const api = solidApiOf(init.expression, this.checker);
        if (api && (api.api === "createMemo" || api.api === "createAsync")) {
          const source = this.analyzeMemo(init, d.name.text, ctx);
          this.bindings.set(symbol, { kind: "memo", source });
          if (ctx.component === null) {
            this.unanalyzed(init, `${api.api} outside a component`, "module-level reactive state is not modeled; it is treated as possibly pending and possibly failing.", ctx);
            source.pending = true; source.worst = true; source.failures.add("unknown");
          }
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
        else v = this.memberValue(baseValue ?? (base ? this.bindingValue(base, init, ctx) : constant()), propName, element, ctx);
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
    const readScope = ctx.scope === "ref" ? "setup" : ctx.scope;
    const scope = readScope === "untracked" ? "setup" : readScope;
    this.recordFact(c?.facts.reads, { loc, scope, source: source.name });
    switch (readScope) {
      case "setup":
        if (source.reactive && !ctx.untracked) {
          if (source.pending)
            this.report("PENDING_ASYNC_UNTRACKED_READ", "async", "error",
              `Async value "${source.name}" is read in ${ctx.ownerName}'s setup; while it is pending there is nothing to read. Read it in a tracking scope (JSX, a memo, or an effect's compute function) under a Loading boundary.`,
              node, { ownerName: ctx.ownerName, related: source.related?.map(loc => ({ message: "caller prop expression", loc })), data: { source: source.name } });
          else
            this.report("STRICT_READ_UNTRACKED", "strict-read", "error",
              `Reactive value "${source.name}" is read directly in ${ctx.ownerName}'s setup and will not update. Move it into a tracking scope (JSX, a memo, or an effect's compute function), or into the handler that needs it.`,
              node, { ownerName: ctx.ownerName, related: source.related?.map(loc => ({ message: "caller prop expression", loc })), data: { source: source.name } });
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
        if (source.pending) this.report("PENDING_ASYNC_IN_HANDLER", "async", "warn", "This handler may read a value before it is initialized. Loading and try/catch do not make a pending handler read ready.", node, { ownerName: ctx.ownerName, related: source.related?.map(loc => ({ message: "caller prop expression", loc })) });
        if (source.failures.size) this.raise(ctx, source.failures, `reading "${source.name}" may fail`, node);
        break;
      case "effect":
        if (source.pending && !ctx.untracked)
          this.report("PENDING_ASYNC_FORBIDDEN_SCOPE", "async", "error",
            `Async value "${source.name}" is read in an effect function, which serves the committed value and throws while uninitialized. Read it in the effect's compute function and pass the value.`,
            node, { ownerName: ctx.ownerName, related: source.related?.map(loc => ({ message: "caller prop expression", loc })), data: { source: source.name } });
        else if (source.reactive && !ctx.untracked)
          this.report("STRICT_READ_UNTRACKED", "strict-read", "error",
            `Reactive value "${source.name}" is read in an effect's apply function and will not update. Read it in compute and pass the value to apply.`,
            node, { ownerName: ctx.ownerName, related: source.related?.map(loc => ({ message: "caller prop expression", loc })) });
        if (source.failures.size) this.raise(ctx, source.failures, `reading "${source.name}" may fail`, node);
        break;
      case "untracked":
        break;
    }
    return { ...constant(), reactive: source.reactive, pending: source.pending, failures: new Set(source.failures), worst: source.worst, related: source.related };
  }

  /** A read at a JSX position: pending / failure obligations unless a boundary covers it. @param {Source} source @param {Loc} loc @param {Ctx} ctx */
  obligate(source, loc, ctx) {
    const view = /** @type {View} */ (ctx.view);
    if (source.pending && !view.loading) this.current.pending.push({ loc, path: [...view.path], source: source.name, related: source.related });
    if (source.failures.size && !view.errored) this.current.failures.push({ loc, path: [...view.path], source: source.name, failures: new Set(source.failures), related: source.related });
  }

  // ---- expressions ---------------------------------------------------------
  /**
   * @param {ts.Expression} e
   * @param {Ctx} ctx
   * @returns {Value}
   */
  evalExpr(e, ctx) {
    if (ctx.depth > MAX_DEPTH || this.exhausted()) return this.limitValue(e, ctx);
    const x = stripParens(e);
    if (ts.isIdentifier(x)) return this.evalIdentifier(x, ctx);
    if (ts.isCallExpression(x)) return this.evalCall(x, ctx);
    if (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x)) return this.evalMember(x, ctx);
    if (ts.isAwaitExpression(x)) {
      const v = this.evalExpr(x.expression, ctx);
      if (v.promise) this.raise(ctx, v.promise, `${this.text(x.expression)} may reject`, x);
      return { ...derived(v), pending: false, reactive: false };
    }
    if (isFunctionLike(x)) return callable({ kind: "function", node: x, environment: this.bindings, receiver: ts.isArrowFunction(x) ? this.thisValue : undefined });
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
        if (ts.isIdentifier(x.left)) {
          const sym = this.symbolOf(x.left);
          const decl = sym?.declarations?.[0];
          const moduleVariable = decl && ts.isVariableDeclaration(decl) && ts.isSourceFile(decl.parent.parent.parent);
          if (moduleVariable) { this.mutationVersion++; this.escapeValue(v, x, ctx, "storing a context service in module state"); }
          if (sym) {
            this.bindings.set(sym, { kind: "value", value: v });
            if (moduleVariable) this.moduleBindings.set(sym, { kind: "value", value: v });
          }
        }
        else {
          if (ts.isPropertyAccessExpression(x.left) || ts.isElementAccessExpression(x.left)) {
            this.mutationVersion++;
            const base = this.evalExpr(x.left.expression, ctx);
            if (base.objects?.length) {
              const name = ts.isPropertyAccessExpression(x.left) ? x.left.name.text : ts.isStringLiteral(x.left.argumentExpression) ? x.left.argumentExpression.text : null;
              if (name !== null && base.objects.every(object => object.instance && !object.escaped)) {
                for (const object of base.objects) object.members.set(name, v);
              } else {
                this.unanalyzed(x, "a mutation of an object member", "the shared object and its aliases now have worst-case member facts.", ctx);
                for (const object of base.objects) object.escaped = true;
              }
            }
          } else this.evalExpr(x.left, ctx);
        }
        return v;
      }
      if ([ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(x.operatorToken.kind)) return join(this.evalExpr(x.left, ctx), this.evalExpr(x.right, ctx));
      return join(derived(this.evalExpr(x.left, ctx)), derived(this.evalExpr(x.right, ctx)));
    }
    if (ts.isVoidExpression(x)) {
      const v = this.evalExpr(x.expression, ctx);
      this.dropped(v, x.expression, ctx); // void p drops the promise: its rejection escapes
      return { ...constant(), undefined: "always" };
    }
    if (ts.isPrefixUnaryExpression(x) || ts.isPostfixUnaryExpression(x) || ts.isTypeOfExpression(x) || ts.isSpreadElement(x)) {
      const operand = ts.isSpreadElement(x) || ts.isTypeOfExpression(x) ? x.expression : x.operand;
      return derived(this.evalExpr(operand, ctx));
    }
    if (ts.isTemplateExpression(x)) return joinAll(x.templateSpans.map(s => derived(this.evalExpr(s.expression, ctx))));
    if (ts.isNewExpression(x)) {
      const constructor = this.evalExpr(x.expression, ctx);
      const args = (x.arguments ?? []).map(a => this.evalExpr(a, ctx));
      if (constructor.classes?.length) return joinAll(constructor.classes.map(facts => this.constructClass(facts, args, x, ctx)));
      const name = x.expression.getText();
      if (name === "Promise" && ts.isIdentifier(x.expression) && this.isLibGlobal(x.expression) && x.arguments?.[0]) {
        // new Promise(executor): the executor runs now; a throw inside rejects.
        const executor = stripParens(x.arguments[0]);
        if (isFunctionLike(executor)) {
          const acc = this.newFnAcc();
          this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (executor), { ...ctx, fn: acc, scope: ctx.scope === "setup" ? "handler" : ctx.scope }, []);
          return promiseOf(acc.throws);
        }
      }
      const declaration = this.checker.getResolvedSignature(x)?.getDeclaration();
      if (!declaration || !this.program.isSourceFileDefaultLibrary(declaration.getSourceFile())) {
        this.raise(ctx, ["unknown"], `${this.text(x)} has no constructor failure information`, x);
        return this.dependencyResult(x, ctx, !!constructor.opaqueResult) ?? { ...constant(), opaque: true };
      }
      return constant();
    }
    if (ts.isTaggedTemplateExpression(x)) { this.evalExpr(x.template, ctx); return constant(); }
    if (ts.isClassExpression(x)) return { ...constant(), classes: [{ node: x, environment: this.bindings }] };
    if (x.kind === ts.SyntaxKind.ThisKeyword) return this.thisValue ?? constant();
    if (ts.isDeleteExpression(x)) { this.evalExpr(x.expression, ctx); return constant(); }
    if (ts.isYieldExpression(x)) { if (x.expression) this.evalExpr(x.expression, ctx); return worst(); }
    if (ts.isCommaListExpression(x)) return joinAll(x.elements.map(el => this.evalExpr(el, ctx)));
    return constant(); // literals, this, super, regex, …
  }

  /** Instantiate supported imperative classes; methods keep their own closure and receiver.
   * @param {import("./values.mjs").ClassFacts} facts @param {Value[]} args
   * @param {ts.NewExpression} at @param {Ctx} ctx @returns {Value}
   */
  constructClass(facts, args, at, ctx) {
    const node = facts.node;
    const base = node.heritageClauses?.[0]?.types[0]?.expression;
    const nativeErrorBase = base && ts.isIdentifier(base) && this.isLibGlobal(base) &&
      ["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "EvalError", "URIError", "AggregateError"].includes(base.text) &&
      !node.members.some(ts.isConstructorDeclaration);
    let replacementReturn = false;
    /** @param {ts.Node} part */
    const inspectReturn = part => {
      if (isFunctionLike(part)) return;
      if (ts.isReturnStatement(part) && part.expression && part.expression.kind !== ts.SyntaxKind.ThisKeyword) {
        const type = this.checker.getTypeAtLocation(part.expression);
        if ((type.isUnion() ? type.types : [type]).some(t => t.flags & (ts.TypeFlags.Object | ts.TypeFlags.Any | ts.TypeFlags.Unknown))) replacementReturn = true;
      }
      ts.forEachChild(part, inspectReturn);
    };
    const body = node.members.find(ts.isConstructorDeclaration)?.body;
    if (body) inspectReturn(body);
    const unsupported = replacementReturn || (ts.canHaveDecorators(node) && ts.getDecorators(node)?.length) ||
      node.modifiers?.some(m => m.kind === ts.SyntaxKind.DeclareKeyword) ||
      (node.heritageClauses?.length && !nativeErrorBase) || node.members.some(m =>
      ((ts.isMethodDeclaration(m) || ts.isGetAccessorDeclaration(m) || ts.isConstructorDeclaration(m)) && !m.body) ||
      (ts.canHaveModifiers(m) && ts.getModifiers(m)?.some(mod => [ts.SyntaxKind.StaticKeyword, ts.SyntaxKind.AbstractKeyword, ts.SyntaxKind.AccessorKeyword].includes(mod.kind))) ||
      (ts.canHaveDecorators(m) && ts.getDecorators(m)?.length) ||
      (m.name && !ts.isIdentifier(m.name) && !ts.isStringLiteral(m.name) && !ts.isNumericLiteral(m.name)) ||
      (!ts.isConstructorDeclaration(m) && !ts.isMethodDeclaration(m) && !ts.isPropertyDeclaration(m) && !ts.isGetAccessorDeclaration(m)));
    if (unsupported) {
      this.unanalyzed(at, "a class with inheritance or unsupported members", "the constructor may fail and the instance has worst-case member facts.", ctx);
      this.raise(ctx, ["unknown"], `${this.text(at)} has no constructor failure information`, at);
      return { ...worst(), opaqueResult: true };
    }
    /** @type {import("./values.mjs").ObjectFacts} */
    const object = { members: new Map(), getters: new Map(), escaped: false, service: false, instance: true };
    const value = { ...constant(), objects: [object] };
    const savedBindings = this.bindings;
    const savedThis = this.thisValue;
    this.bindings = facts.environment;
    this.thisValue = value;
    try {
      for (const member of node.members) {
        const name = member.name?.getText().replace(/^["']|["']$/g, "");
        if (name && ts.isMethodDeclaration(member)) object.members.set(name, callable({ kind: "function", node: member, environment: this.bindings, method: true }));
        else if (name && ts.isGetAccessorDeclaration(member)) object.getters.set(name, { kind: "function", node: member, environment: this.bindings, receiver: value });
        else if (name && ts.isPropertyDeclaration(member)) object.members.set(name, member.initializer ? this.evalExpr(member.initializer, ctx) : { ...constant(), undefined: "always" });
      }
      const constructor = node.members.find(ts.isConstructorDeclaration);
      if (constructor) {
        constructor.parameters.forEach((p, i) => {
          if (ts.isIdentifier(p.name) && p.modifiers?.length) object.members.set(p.name.text, args[i] ?? (p.initializer ? this.evalExpr(p.initializer, ctx) : { ...constant(), undefined: "always" }));
        });
        this.analyzeFunction(constructor, ctx, args, this.bindings, value);
      }
      return value;
    } finally {
      this.bindings = savedBindings;
      this.thisValue = savedThis;
    }
  }

  /** @param {ts.Identifier} id @param {Ctx} ctx */
  evalIdentifier(id, ctx) {
    const b = this.bindingOf(this.symbolOf(id));
    if (!b) return this.foreignIdentifier(id, ctx);
    return this.bindingValue(b, id, ctx);
  }

  /** An identifier with no binding of ours: a parameter, a global, a package import. @param {ts.Identifier} id @param {Ctx} ctx @returns {Value} */
  foreignIdentifier(id, ctx) {
    const raw = this.checker.getSymbolAtLocation(id);
    for (let declaration of raw?.declarations ?? []) {
      while (declaration && !ts.isImportDeclaration(declaration) && !ts.isSourceFile(declaration)) declaration = declaration.parent;
      if (declaration && ts.isImportDeclaration(declaration) && ts.isStringLiteral(declaration.moduleSpecifier) && this.runtime.opaqueImports?.get(id.getSourceFile().fileName)?.has(declaration.moduleSpecifier.text)) {
        // Hold an unknown imported value until consumed. Calling a method is
        // not itself evidence of a Solid accessor read (D-133).
        return { ...worst(), opaque: true, opaqueResult: true };
      }
    }
    const resolved = this.symbolOf(id);
    if (raw && (raw.flags & ts.SymbolFlags.Alias) && !resolved?.declarations?.length) {
      this.unanalyzed(id, "an import without declarations", "its value and returned shape remain worst case until consumed.", ctx);
      return { ...worst(), opaque: true, opaqueResult: true };
    }
    const type = this.checker.getTypeAtLocation(id);
    if (type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)) return { ...constant(), undefined: "always" };
    const symbol = this.symbolOf(id);
    const decl = symbol?.declarations?.[0];
    const api = solidApiOf(id, this.checker);
    if (api) return callable({ kind: "solid", node: id, api: api.api });
    if (decl && !this.program.isSourceFileDefaultLibrary(decl.getSourceFile()) && (ts.isParameter(decl) || ts.isVariableDeclaration(decl))) return { ...constant(), opaque: true, undefined: type.isUnion() && type.types.some(t => t.flags & ts.TypeFlags.Undefined) ? "maybe" : undefined };
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
      case "function": return callable({ kind: "function", node: b.node, environment: b.environment });
      case "component": {
        // A component referenced as a value outside a JSX tag and outside render(): a hand-off.
        if (!this.inRenderArgument) b.component.handedOff.push(this.loc(node));
        return callable({ kind: "component", node, component: b.component });
      }
      case "props": return { ...constant(), props: [b.component] };
      case "object": return b.value;
      case "caught": return { ...constant(), caught: new Set(b.failures) };
    }
  }

  /** @param {ts.ObjectLiteralExpression} o @param {Ctx} ctx */
  evalObjectLiteral(o, ctx) {
    /** @type {import("./values.mjs").ObjectFacts} */
    const object = { members: new Map(), getters: new Map(), escaped: false, service: false };
    for (const p of o.properties) {
      const name = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) || ts.isNumericLiteral(p.name)) ? p.name.text : null;
      if (ts.isPropertyAssignment(p) && name !== null) object.members.set(name, this.evalExpr(p.initializer, ctx));
      else if (ts.isShorthandPropertyAssignment(p)) {
        const b = this.bindingOf(resolveAlias(this.checker.getShorthandAssignmentValueSymbol(p), this.checker));
        object.members.set(p.name.text, b ? this.bindingValue(b, p.name, ctx) : this.foreignIdentifier(p.name, ctx));
      } else if (ts.isMethodDeclaration(p) && name !== null) object.members.set(name, callable({ kind: "function", node: p, environment: this.bindings, method: true }));
      else if (ts.isGetAccessorDeclaration(p) && name !== null) object.getters.set(name, { kind: "function", node: p, environment: this.bindings });
      else if (ts.isSpreadAssignment(p)) {
        const v = this.evalExpr(p.expression, ctx);
        for (const shape of v.objects ?? []) for (const [key, value] of shape.members) object.members.set(key, value);
        if (v.worst || v.opaque) object.members.set("*", v);
      }
    }
    return { ...constant(), objects: [object] };
  }

  /** @param {Binding & { kind: "object" }} b @param {string} name @param {ts.Node} at @param {Ctx} ctx */
  readObjectMember(b, name, at, ctx) {
    return this.memberValue(b.value, name, at, ctx);
  }

  /** Members keep their own facts; holding an object does not read its accessors.
   * @param {Value} base @param {string | null} name @param {ts.Node} at @param {Ctx} ctx @returns {Value}
   */
  memberValue(base, name, at, ctx) {
    if (base.unreachable) return base;
    /** @type {Value[]} */
    const results = [];
    for (const component of base.props ?? []) {
      const entry = name === null ? undefined : component.props.get(name);
      if (name !== null && !entry && component.callers > 0 && !component.propsWorst) results.push({ ...constant(), undefined: /** @type {const} */ ("always") });
      else if (name !== null) results.push(this.readProp(component, name, at, ctx));
      else results.push(worst());
    }
    for (const object of base.objects ?? []) {
      if (object.escaped) { results.push(worst()); continue; }
      if (name === null) {
        this.unanalyzed(at, "a dynamic service member", "its value is possibly pending and failing with unknown.", ctx);
        results.push(worst()); continue;
      }
      if (object.layers) { results.push(this.readMergedMember(object.layers, name, at, ctx)); continue; }
      const getter = object.getters.get(name);
      if (getter?.node) results.push(this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (getter.node), ctx, [], getter.environment, getter.receiver));
      else {
        const member = object.members.get(name) ?? object.members.get("*") ?? { ...constant(), undefined: /** @type {const} */ ("always") };
        const directCall = ts.isCallExpression(at.parent) && at.parent.expression === at;
        results.push({ ...member, callables: member.callables.map(cb => cb.method ? { ...cb, receiver: directCall ? { ...constant(), objects: [object] } : constant() } : cb) });
      }
    }
    if (base.worst) results.push({ ...worst(), opaqueResult: base.opaqueResult });
    if (base.opaque) results.push({ ...constant(), opaque: true, undefined: "maybe" });
    if (!results.length) return derived(base);
    const v = joinAll(results);
    if (v.worst && (!ts.isCallExpression(at.parent) || at.parent.expression !== at)) {
      this.obligateValue(v, at, ctx, this.text(at));
      this.raise(ctx, ["unknown"], this.text(at) + " has no failure information", at);
    }
    return v;
  }

  /** Solid merge reads right-to-left, skipping undefined, without calling held functions.
   * @param {Value[]} layers @param {string} name @param {ts.Node} at @param {Ctx} ctx @returns {Value}
   */
  readMergedMember(layers, name, at, ctx) {
    const values = [];
    let mayBeUndefined = true;
    for (const layer of [...layers].reverse()) {
      const value = this.memberValue(layer, name, at, ctx);
      if (value.undefined === "always") continue;
      values.push(value);
      if (!value.undefined) { mayBeUndefined = false; break; }
    }
    return { ...joinAll(values), undefined: values.length ? mayBeUndefined ? "maybe" : undefined : "always" };
  }

  /** Unknown code can mutate a shared service, but not independent instances.
   * @param {Value} v @param {ts.Node} at @param {Ctx} ctx @param {string} what
   */
  escapeValue(v, at, ctx, what) {
    if (v.objects?.length) this.mutationVersion++;
    const objects = (v.objects ?? []).filter(o => o.service);
    if (!objects.length) return;
    this.unanalyzed(at, what, "the shared object and its aliases now have worst-case member facts.", ctx);
    for (const object of objects) object.escaped = true;
  }

  /**
   * A prop read in a child: its facts come from every caller.
   * @param {Component} c
   * @param {string} name
   * @param {ts.Node} at
   * @param {Ctx} ctx
   */
  /** @param {Component} c @param {string} name @param {ts.Node} at @param {Ctx} ctx @returns {Value} */
  readProp(c, name, at, ctx) {
    const entry = c.props.get(name) ?? (c.props.get("*")?.worst ? c.props.get("*") : undefined);
    if (c.propsWorst || (entry && entry.worst)) return this.read({ name: `props.${name}`, reactive: true, pending: true, failures: new Set(["unknown"]), worst: true, node: at }, at, ctx);
    if (!entry || entry.values.length === 0) {
      // No caller in the program passes it: held, unknown shape. Calls through it are unknown (see callProp).
      return { ...constant(), opaque: true, callables: [{ kind: "function", node: null, reasonText: `props.${name} (no caller in this program)` }] };
    }
    const v = joinAll(entry.values.map(v => this.resolveProp(v, ctx)));
    if (v.reactive || v.pending || v.failures.size) {
      // A caller passed a reactive expression: the prop is a reactive value, read here.
      const sourceCallables = v.callables.filter(cb => cb.kind === "source");
      const pending = v.pending || sourceCallables.some(cb => cb.source?.pending);
      const failures = new Set([...v.failures, ...sourceCallables.flatMap(cb => [...(cb.source?.failures ?? [])])]);
      const r = this.read({ name: `props.${name}`, reactive: true, pending, failures, worst: v.worst, node: at, related: v.related }, at, ctx);
      return { ...r, callables: v.callables };
    }
    return v; // held: constants, callbacks
  }

  /** @param {ts.PropertyAccessExpression | ts.ElementAccessExpression} m @param {Ctx} ctx */
  evalMember(m, ctx) {
    const name = ts.isPropertyAccessExpression(m) ? m.name.text : (ts.isStringLiteral(m.argumentExpression) ? m.argumentExpression.text : null);
    const target = stripParens(m.expression);
    if (ts.isPropertyAccessExpression(m)) {
      const api = solidApiOf(m.name, this.checker);
      if (api) return callable({ kind: "solid", node: m, api: api.api });
      const symbol = this.symbolOf(m.name);
      const decl = symbol?.declarations?.[0];
      if (!decl && ts.isIdentifier(target)) {
        const raw = this.checker.getSymbolAtLocation(target);
        if (raw?.declarations?.some(d => ts.isNamespaceImport(d) || ts.isImportEqualsDeclaration(d))) {
          this.unanalyzed(m, "an import without declarations", "this namespace member retains worst-case facts until consumed.", ctx);
          return { ...worst(), opaque: true, opaqueResult: true };
        }
      }
      if (decl && ts.isVariableDeclaration(decl) && ts.isSourceFile(decl.parent.parent.parent)) {
        const binding = this.bindingOf(symbol);
        if (binding) return this.bindingValue(binding, m, ctx);
      }
    }
    if (ts.isIdentifier(target)) {
      const b = this.bindingOf(this.symbolOf(target));
      if (b && b.kind === "props" && name !== null) return this.readProp(b.component, name, m, ctx);
      if (b && b.kind === "object" && name !== null) return this.readObjectMember(b, name, m, ctx);
    }
    const base = this.evalExpr(m.expression, ctx);
    if (ts.isElementAccessExpression(m)) this.evalExpr(m.argumentExpression, ctx);
    if (base.objects?.length || base.props?.length || base.opaque || base.unreachable) return this.memberValue(base, name, m, ctx);
    if (base.worst) {
      // A member of a worst-case value is a worst-case value; reading it at a JSX position obligates a Loading / Errored boundary.
      /** @type {Value} */
      const w = { ...worst(), opaqueResult: base.opaqueResult, callables: [{ kind: "function", node: null, reasonText: this.text(m) }] };
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
      const resolved = this.bindingOf(this.symbolOf(callee.name));
      if (resolved?.kind === "function") return this.callBinding(resolved, call, ctx);
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
      if (receiver.objects?.length || receiver.props?.length || (receiver.opaque && !this.isLibMethod(call)) || receiver.unreachable) return this.callValue(this.memberValue(receiver, name, callee, ctx), call, ctx, this.text(call));
      if (PROMISE_METHODS.has(name) && (receiver.promise || isPromiseType(this.checker.getTypeAtLocation(callee.expression), this.checker)) && this.isLibMethod(call)) return this.callPromiseMethod(name, receiver, call, ctx);
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
        this.unanalyzed(call, "a signal tuple outside destructuring", "its value is possibly pending and failing with unknown.", ctx);
        return worst();
      }
      case "createEffect": case "createRenderEffect": {
        if (!ctx.component || ctx.scope !== "setup") this.unanalyzed(call, `${api} outside a component's setup`, "an effect created elsewhere is not modeled.", ctx);
        const compute = args[0] ? stripParens(args[0]) : null;
        const effect = args[1] ? stripParens(args[1]) : null;
        /** @type {CompAcc} */
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
      case "merge": {
        const layers = args.map(a => this.evalExpr(a, ctx));
        return { ...constant(), objects: [{ members: new Map(), getters: new Map(), layers, escaped: false, service: false }] };
      }
      case "untrack": {
        if (!args[0]) return constant();
        const before = this.setupFailureNode;
        const value = this.evalExpr(args[0], ctx);
        const result = this.callValueAsHandler(value, call, { ...ctx, untracked: true }, []);
        if (!before && this.setupFailureNode) this.setupFailureNode = call;
        return result;
      }
      case "useContext": {
        const context = args[0] ? this.evalExpr(args[0], ctx) : constant();
        if (!context.contexts?.length) {
          this.unanalyzed(call, "a context lookup without createContext provenance", "its result is possibly pending and failing with unknown.", ctx);
          return worst();
        }
        return joinAll(context.contexts.map(binding => {
          const value = this.providers.get(binding) ?? binding.defaultValue;
          if (value === null) {
            this.report("CONTEXT_PROVIDER_MISSING", "owner", "error", "This context has neither a provider on this render path nor a default. Add a provider or a usable default.", call, { ownerName: ctx.ownerName });
            return { ...constant(), unreachable: true };
          }
          for (const object of value.objects ?? []) object.service = true;
          return value;
        }));
      }
      case "createContext": {
        const value = args[0] ? this.evalExpr(args[0], ctx) : null;
        const absent = args[0] && (this.checker.getTypeAtLocation(args[0]).flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)) !== 0;
        return { ...constant(), contexts: [{ node: call, defaultValue: absent ? null : value }] };
      }
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
            if (b && b.kind === "component") {
              b.component.rendered.push(this.loc(call));
              const saved = this.current;
              const rootSummary = this.analyzeComponent(b.component);
              this.current = saved;
              this.roots.push({ component: null, view: null, loc: this.loc(call), rootSummary });
            }
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
    /** @type {CompAcc} */
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
      case "setter": return this.write(b.name, call, ctx);
      case "function": {
        return this.analyzeFunction(b.node, ctx, args, b.environment);
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

  /** @param {string} name @param {ts.Node} at @param {Ctx} ctx */
  write(name, at, ctx) {
    if (ctx.scope === "ref") {
      this.unanalyzed(ctx.refAt ?? at, "a reactive write in a ref callback", "ref write ownership is not modeled; the write result is treated as possibly pending and failing.", ctx);
      return worst();
    }
    if (ctx.scope === "setup" || ctx.scope === "tracking" || ctx.scope === "untracked") {
      const where = ctx.comp ? ctx.ownerName : ctx.scope === "tracking" ? "a JSX expression" : `${ctx.ownerName}'s setup`;
      this.report("REACTIVE_WRITE_IN_OWNED_SCOPE", "write", "error",
        `Setter "${name}" is called inside ${where}, an owned scope (component body or computation). Move the write into an event handler or an effect function.`,
        at, { ownerName: ctx.ownerName, data: { setter: name } });
    }
    return constant();
  }

  /**
   * Calling a value: each callable it may be is analyzed in the caller's scope.
   * @param {Value} v @param {ts.CallExpression} call @param {Ctx} ctx @param {string} reason
   */
  callValue(v, call, ctx, reason) {
    if (v.unreachable) return v;
    if (call.questionDotToken && v.undefined === "always") return constant();
    if (v.worst) return this.callUnknownValue(call, v, ctx);
    if (!v.callables.length) {
      // Calling something we did not track (a plain function value from a computation, a DOM method): unknown.
      return this.callUnknownValue(call, v, ctx);
    }
    const args = call.arguments.map(a => this.evalExpr(a, ctx));
    /** @type {Value[]} */
    const results = [];
    if (v.opaque) results.push(this.callUnknownValue(call, { ...constant(), opaque: true }, ctx, reason));
    for (const cb of v.callables) {
      switch (cb.kind) {
        case "source": results.push(this.read({ .../** @type {Source} */ (cb.source), related: [...(cb.source?.related ?? []), ...(v.related ?? [])] }, call, ctx)); break;
        case "setter": results.push(this.callBinding({ kind: "setter", name: cb.node ? this.text(cb.node) : "setter" }, call, ctx)); break;
        case "safe": results.push(constant()); break;
        case "function":
          if (cb.node) results.push(this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (cb.node), ctx, args, cb.environment, cb.receiver));
          else results.push(this.callUnknownValue(call, v, ctx, cb.reasonText ?? reason));
          break;
        case "solid": results.push(this.evalSolidCall(cb.api ?? "", call, ctx)); break;
        case "component": results.push(worst()); break;
      }
    }
    return joinAll(results);
  }

  /** A call with no analyzable body: possibly failing with unknown; a Promise-typed result rejects instead of throwing. @param {ts.CallExpression} call @param {Value} receiver @param {Ctx} ctx @param {string} [reason] */
  callUnknownValue(call, receiver, ctx, reason) {
    for (const a of call.arguments) { const v = this.evalCallbackArgument(a, ctx, "unknown"); this.escapeValue(v, a, ctx, "passing a context service to unknown code"); }
    const type = this.checker.getTypeAtLocation(call);
    const text = reason ?? this.text(call);
    if (isPromiseType(type, this.checker)) {
      // Rejection carried by the promise; the value it resolves to is worst case when the receiver is.
      const pending = receiver.worst && !receiver.opaqueResult;
      const v = { ...(pending ? worst() : constant()), pending, promise: new Set(["unknown"]), callables: [], reactive: pending };
      this.obligateValue(v, call, ctx, text);
      return v;
    }
    this.raise(ctx, ["unknown"], `${text} has no failure information`, call);
    if (receiver.worst && !receiver.opaqueResult) { const w = worst(); this.obligateValue(w, call, ctx, text); return w; }
    return this.dependencyResult(call, ctx, !!receiver.opaqueResult) ?? constant();
  }

  /** An installed declaration can describe held results, but an untyped result
   * stays worst case. Producing or calling through it is not itself a Solid read.
   * @param {ts.CallExpression | ts.NewExpression} at @param {Ctx} ctx
   * @param {boolean} [opaqueReceiver] @returns {Value | null}
   */
  dependencyResult(at, ctx, opaqueReceiver = false) {
    const declaration = this.checker.getResolvedSignature(at)?.getDeclaration();
    if (!opaqueReceiver && (!declaration || !this.project.isInstalled(declaration.getSourceFile()))) return null;
    const type = this.checker.getTypeAtLocation(at);
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
      this.unanalyzed(at, "a call without a declared result shape", "its returned value has worst-case facts; the call itself is not a Solid pending read.", ctx);
      return { ...worst(), opaqueResult: true, opaque: true };
    }
    return { ...constant(), opaque: type.getCallSignatures().length > 0 || !!(type.flags & ts.TypeFlags.Object) };
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
    // Name tables apply ONLY to callees declared in a TypeScript default lib (the platform). A project or
    // package method that happens to be called get / set / add / map / then has no failure information
    // and is the worst case, whatever its name (review finding on b2dfebf).
    const sig = this.checker.getResolvedSignature(call);
    const decl = sig?.getDeclaration();
    const declFile = decl?.getSourceFile();
    const isLib = declFile ? this.program.isSourceFileDefaultLibrary(declFile) : false;
    const calleeRoot = ts.isPropertyAccessExpression(call.expression) ? stripParens(call.expression.expression) : null;
    const calleeText = calleeRoot && ts.isIdentifier(calleeRoot) && this.isLibGlobal(calleeRoot) ? calleeRoot.text : "";
    if (!isLib && !(ts.isIdentifier(stripParens(call.expression)) && this.isLibGlobal(/** @type {ts.Identifier} */ (stripParens(call.expression))))) {
      // No analyzable body, not the platform: unknown, carried by the promise when the result is one.
      const args = call.arguments.map(a => { const v = this.evalCallbackArgument(a, ctx, "unknown"); this.escapeValue(v, a, ctx, "passing a context service to unknown code"); return v; });
      const type = this.checker.getTypeAtLocation(call);
      if (isPromiseType(type, this.checker)) return { ...derived(joinAll([receiver ?? constant(), ...args])), promise: new Set(["unknown"]) };
      this.raise(ctx, ["unknown"], `${this.text(call)} has no failure information`, call);
      return this.dependencyResult(call, ctx) ?? derived(joinAll([receiver ?? constant(), ...args]));
    }
    if (DETACHED_CALLBACKS.has(name)) {
      for (const a of call.arguments) this.evalCallbackArgument(a, ctx, "detached");
      return constant();
    }
    if (SYNC_CALLBACK_METHODS.has(name)) {
      const results = call.arguments.map(a => this.evalCallbackArgument(a, ctx, "sync"));
      return join(receiver ? derived(receiver) : constant(), derived(joinAll(results)));
    }
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
    // Safe receiver operations hold their arguments; removing a listener or
    // adding a callback to a Set does not execute that callback.
    const args = call.arguments.map(a => SAFE_PLATFORM.has(name) && !["stringify", "from"].includes(name) ? this.evalExpr(a, ctx) : this.evalCallbackArgument(a, ctx, "unknown"));
    const known = PLATFORM_THROWS.get(name);
    if (known && calleeText === "JSON") { this.raise(ctx, [known], `${this.text(call)} may throw`, call); return constant(); }
    const type = this.checker.getTypeAtLocation(call);
    if (isPromiseType(type, this.checker)) return { ...derived(joinAll(args)), promise: new Set(["unknown"]) };
    // The platform: ECMAScript library calls do not fail; DOM calls only when the small allowlist says so.
    if (SAFE_PLATFORM.has(name) || (declFile && !/lib\.dom/.test(declFile.fileName))) return derived(joinAll([receiver ?? constant(), ...args]));
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
  /** @param {Component} c @param {string} name @param {ts.Node} at @param {Ctx} ctx @returns {Value} */
  readPropForCall(c, name, at, ctx) {
    const entry = c.props.get(name) ?? (c.props.get("*")?.worst ? c.props.get("*") : undefined);
    if (c.propsWorst || (entry && entry.worst)) return worst();
    if (!entry || entry.values.length === 0) return { ...constant(), callables: [{ kind: "function", node: null, reasonText: `props.${name}(…) has no caller in this program` }] };
    const v = joinAll(entry.values.map(v => this.resolveProp(v, ctx)));
    // The caller's expression runs in the child's read (Solid wraps prop expressions in getters): its failures land here.
    if (v.reactive || v.pending || v.failures.size) this.read({ name: `props.${name}`, reactive: v.reactive, pending: v.pending, failures: v.failures, worst: v.worst, node: at, related: v.related }, at, ctx);
    if (!v.callables.length) {
      // Called, but no caller passed a function we can see (a value, a member of a bag): unknown.
      return { ...v, callables: [{ kind: "function", node: null, reasonText: `props.${name}(…) has no analyzable function` }] };
    }
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
  analyzeFunction(fn, ctx, args, environment = this.bindings, receiver = this.thisValue) {
    if (this.activeFunctions.has(fn) || ctx.depth > MAX_DEPTH || this.exhausted()) return this.limitValue(fn, ctx, "recursive/deep or bounded function call");
    const isAsync = !!(ts.canHaveModifiers(fn) && ts.getModifiers(fn)?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword));
    const isGenerator = !!fn.asteriskToken;
    if (isGenerator) { this.unanalyzed(fn, "a generator function", "its body is not analyzed; its value is treated as possibly pending and possibly failing.", ctx); return worst(); }
    const savedBindings = this.bindings;
    const savedThis = this.thisValue;
    this.thisValue = receiver;
    this.bindings = environment === this.moduleBindings ? new Map() : new Map(environment);
    // Each invocation owns its locals; returned methods capture this map.
    fn.parameters.forEach((p, i) => {
      if (ts.isIdentifier(p.name)) { const sym = this.symbolOf(p.name); if (sym) this.bindings.set(sym, { kind: "value", value: args[i] ?? { ...constant(), opaque: true } }); }
      else if (ts.isObjectBindingPattern(p.name)) {
        for (const el of p.name.elements) if (ts.isIdentifier(el.name)) {
          const name = el.propertyName ? el.propertyName.getText() : el.name.text;
          const value = this.memberValue(args[i] ?? { ...constant(), opaque: true }, name, el, ctx);
          const sym = this.symbolOf(el.name);
          if (sym) this.bindings.set(sym, { kind: "value", value });
        }
      } else if (ts.isArrayBindingPattern(p.name)) {
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
      this.bindings = savedBindings;
      this.thisValue = savedThis;
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
   * @param {boolean} [setupReads] ref callbacks have setup-like reads, not component ownership
   */
  analyzeHandlerAttribute(attr, ctx, setupReads = false) {
    const init = attr.initializer;
    if (!init || !ts.isJsxExpression(init) || !init.expression) return;
    const expr = stripParens(init.expression);
    const acc = this.newFnAcc();
    const hctx = { ...ctx, scope: /** @type {Scope} */ (setupReads ? "ref" : "handler"), refAt: setupReads ? attr : undefined, fn: acc, comp: null, view: null, ownerName: ctx.ownerName };
    /** @type {Value} */
    let result;
    if (isFunctionLike(expr)) result = this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (expr), hctx, [constant()]);
    else {
      // onClick={save} / onClick={props.onClick} / onClick={service.reload}: the value is called with the event.
      const v = this.evalExpr(init.expression, { ...ctx, scope: "tracking", comp: { pending: false, failures: new Set(), reads: 0 }, view: null });
      if (ts.isArrayLiteralExpression(expr)) { this.unanalyzed(expr, "a bound handler array", "its handler is treated as possibly failing with unknown.", ctx); result = { ...constant(), promise: new Set(["unknown"]) }; }
      else if (setupReads && !v.callables.length && !v.worst && !this.checker.getTypeAtLocation(init.expression).getCallSignatures().length) result = constant(); // ref={element}: capture, not a callback
      else result = this.callValueAsHandler(v, init.expression, hctx);
    }
    const escaping = new Set([...acc.throws, ...(result.promise ?? [])]);
    if (escaping.size) this.reportHandler(attr.name, `this ${attr.name.getText()} handler`, escaping, acc, ctx);
  }

  /** Invoke a held callback in the supplied scope (also used by ref and untrack).
   * @param {Value} v @param {ts.Expression} at @param {Ctx} hctx @param {Value[]} [args]
   */
  callValueAsHandler(v, at, hctx, args = [constant()]) {
    if (v.worst || !v.callables.length) {
      this.raise(hctx, ["unknown"], `${this.text(at)} has no failure information`, at);
      return constant();
    }
    /** @type {Value[]} */
    const results = [];
    if (v.opaque) this.raise(hctx, ["unknown"], this.text(at) + " has no failure information", at);
    for (const cb of v.callables) {
      if (cb.kind === "function" && cb.node) results.push(this.analyzeFunction(/** @type {ts.FunctionLikeDeclaration} */ (cb.node), hctx, args, cb.environment, cb.receiver));
      else if (cb.kind === "function") { this.raise(hctx, ["unknown"], `${cb.reasonText ?? this.text(at)} has no failure information`, at); results.push(constant()); }
      else if (cb.kind === "source") results.push(this.read(/** @type {Source} */ (cb.source), at, hctx));
      else if (cb.kind === "setter") results.push(this.write(cb.node ? this.text(cb.node) : "setter", at, hctx));
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
    if (this.exhausted()) { this.limitValue(e, { ...ctx, scope: "tracking", view }); return; }
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
      const tctx = { ...ctx, scope: /** @type {Scope} */ ("tracking"), comp: null, view };
      const value = this.evalExpr(ch.expression, tctx);
      if (value.opaqueResult) this.obligateValue(value, ch.expression, tctx, this.text(ch.expression));
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
          this.analyzeHandlerAttribute(attr, { ...ctx, view }, true);
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
          const key = attrExpr("on"); if (key) this.evalExpr(key, tctx);
          const fb = attrExpr("fallback"); if (fb) this.evalExprAsView(fb, ctx, view);
          this.recordFact(ctx.component?.facts.boundaries, { kind: "Loading", loc: this.loc(whole) });
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
          this.recordFact(ctx.component?.facts.boundaries, { kind: "Errored", loc: this.loc(whole) });
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
          const keyed = attrExpr("keyed");
          const indexMode = api.api === "Index" || keyed?.kind === ts.SyntaxKind.FalseKeyword;
          const itemAccessor = indexMode || !!(keyed && keyed.kind !== ts.SyntaxKind.TrueKeyword);
          for (const ch of children) this.evalRenderCallbackOrChild(ch, ctx, view, [
            itemAccessor ? { name: "item", reactive: true, pending: false, failures: new Set(), worst: eachValue.worst, node: each ?? whole } : null,
            indexMode ? null : { name: "index", reactive: true, pending: false, failures: new Set(), worst: false, node: each ?? whole }
          ], true);
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
    // Only createContext provenance makes a value a provider. No type spelling.
    const b = ts.isIdentifier(tag) ? this.bindingOf(this.symbolOf(tag)) : undefined;
    if (b?.kind === "component") {
      this.renderChild(b.component, opening, children, ctx, view, whole);
      return;
    }
    const value = ts.isJsxNamespacedName(tag) ? worst() : this.evalExpr(tag, tctx);
    if (value.contexts?.length) {
      const supplied = attrExpr("value");
      const providerValue = supplied ? this.evalExpr(supplied, tctx) : constant();
      const saved = this.providers;
      if (value.contexts.length > 1) this.unanalyzed(opening, "a dynamic provider", "each possible provider path uses worst-case service facts.", ctx);
      for (const binding of value.contexts) {
        this.providers = new Map(saved);
        this.providers.set(binding, value.contexts.length > 1 ? worst() : providerValue);
        for (const ch of children) this.evalJsxChild(ch, ctx, view);
      }
      this.providers = saved;
      return;
    }
    this.unanalyzed(opening, "an unresolved provider or component", "its values are worst case; children retain their own boundary paths.", ctx);
    for (const a of attrs) if (ts.isJsxAttribute(a) && a.initializer && ts.isJsxExpression(a.initializer) && a.initializer.expression) this.evalExpr(a.initializer.expression, tctx);
    for (const ch of children) this.evalJsxChild(ch, ctx, view);
  }

  /** A `fallback={…}`: JSX is a view under the outer boundaries; other expressions are tracking reads. @param {ts.Expression} e @param {Ctx} ctx @param {View} view */
  evalExprAsView(e, ctx, view) {
    const x = stripParens(e);
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) this.evalView(x, ctx, view);
    else this.evalExpr(e, { ...ctx, scope: "tracking", comp: null, view });
  }

  /** Show / For children: null parameters are held values, the others are accessors.
   * @param {ts.JsxChild} ch @param {Ctx} ctx @param {View} view @param {(Source | null)[]} params @param {boolean} [setup]
   */
  evalRenderCallbackOrChild(ch, ctx, view, params, setup = false) {
    if (ts.isJsxExpression(ch) && ch.expression) {
      const x = stripParens(ch.expression);
      if (isFunctionLike(x)) {
        const fn = /** @type {ts.FunctionLikeDeclaration} */ (x);
        const args = params.map(p => p ? callable({ kind: "source", node: x, source: p }) : constant());
        this.analyzeRenderCallback(fn, { ...ctx, scope: setup ? "setup" : "tracking", comp: null, view }, args);
        return;
      }
    }
    this.evalJsxChild(ch, ctx, view);
  }

  /** @param {ts.FunctionLikeDeclaration} fn @param {Ctx} ctx @param {Value[]} args */
  analyzeRenderCallback(fn, ctx, args) {
    // The caller sets the body scope; returned JSX introduces tracking reads.
    fn.parameters.forEach((p, i) => {
      if (ts.isIdentifier(p.name)) { const sym = this.symbolOf(p.name); if (sym) this.bindings.set(sym, { kind: "value", value: args[i] ?? { ...constant(), opaque: true } }); }
      else if (ts.isObjectBindingPattern(p.name)) for (const el of p.name.elements) if (ts.isIdentifier(el.name)) { const sym = this.symbolOf(el.name); if (sym) this.bindings.set(sym, { kind: "value", value: constant() }); }
    });
    const body = fn.body;
    if (!body) return;
    const view = /** @type {View} */ (ctx.view);
    if (ts.isBlock(body)) {
      // For row statements are setup-like; Show callbacks remain tracking.
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
    child.callers++;
    /** @type {Map<string, { values: Value[], worst: boolean }>} */
    const props = new Map();
    let propsWorst = false;
    for (const attr of opening.attributes.properties) {
      if (ts.isJsxSpreadAttribute(attr)) {
        this.unanalyzed(attr, "a spread into a component's props", "every prop of the child is treated as the worst case (possibly reactive, pending and failing).", ctx);
        this.evalExpr(attr.expression, { ...ctx, scope: "tracking", comp: null, view });
        propsWorst = true;
        continue;
      }
      const name = attr.name.getText();
      const value = this.propValue(attr, ctx, view);
      const entry = props.get(name) ?? { values: [], worst: false };
      entry.values.push(value);
      if (value.worst) entry.worst = true;
      props.set(name, entry);
    }
    if (children.length) {
      const meaningful = children.filter(ch => !(ts.isJsxText(ch) && ch.containsOnlyTriviaWhiteSpaces));
      const entry = props.get("children") ?? { values: [], worst: false };
      for (const ch of meaningful) {
        if (ts.isJsxExpression(ch) && ch.expression) {
          const x = stripParens(ch.expression);
          if (isFunctionLike(x)) { entry.values.push(callable({ kind: "function", node: x, environment: this.bindings })); continue; }
          entry.values.push(this.deferProp(ch.expression));
        } else {
          // JSX children render lazily where the child places them.
          entry.values.push(this.deferProp(/** @type {ts.Expression} */ (/** @type {unknown} */ (ch))));
        }
      }
      props.set("children", entry);
    }
    const saved = this.current;
    if (propsWorst) props.set("*", { values: [worst()], worst: true });
    const summary = this.analyzeComponent(child, props);
    this.current = saved;
    const path = [...view.path, `<${child.name}>`];
    for (const o of summary.pending) if (o.uncoverable || !view.loading) this.current.pending.push({ ...o, path: [...path, ...o.path.slice(1)] });
    for (const o of summary.failures) if (o.uncoverable || !view.errored) this.current.failures.push({ ...o, path: [...path, ...o.path.slice(1)] });
    void whole;
  }

  /** The value a caller passes for a prop: reads are deferred to the child, so they are collected, not obligated. @param {ts.JsxAttribute} attr @param {Ctx} ctx @param {View} view */
  propValue(attr, ctx, view) {
    const init = attr.initializer;
    if (!init) return constant(); // <Comp flag />
    if (ts.isStringLiteral(init)) return constant();
    if (ts.isJsxExpression(init) && init.expression) {
      if (isEventAttribute(attr.name.getText()) && isFunctionLike(stripParens(init.expression))) return callable({ kind: "function", node: stripParens(init.expression), environment: this.bindings });
      return this.deferProp(init.expression);
    }
    if (ts.isJsxElement(init) || ts.isJsxSelfClosingElement(init) || ts.isJsxFragment(init)) { this.evalView(init, ctx, view); return constant(); }
    return constant();
  }

  /** @param {ts.Expression} expression @returns {Value} */
  deferProp(expression) {
    return { ...constant(), deferred: [{ expression, environment: this.bindings, providers: this.providers }] };
  }

  /** Evaluate lazy props only at consuming reads, without moving their obligations.
   * @param {Value} value @param {Ctx} ctx @returns {Value}
   */
  resolveProp(value, ctx) {
    if (!value.deferred?.length) return value;
    const savedBindings = this.bindings;
    const savedProviders = this.providers;
    const results = [];
    for (const deferred of value.deferred) {
      this.bindings = deferred.environment;
      this.providers = deferred.providers;
      if (this.isViewExpression(deferred.expression) && ctx.view) {
        this.evalView(deferred.expression, ctx, ctx.view);
        results.push(constant());
        continue;
      }
      /** @type {CompAcc} */
    const acc = { pending: false, failures: new Set(), reads: 0 };
      const v = this.evalExpr(deferred.expression, { ...ctx, scope: "tracking", comp: acc, view: null });
      results.push({ ...v, reactive: v.reactive || acc.reads > 0, pending: v.pending || acc.pending, failures: new Set([...v.failures, ...acc.failures]), related: [...(v.related ?? []), this.loc(deferred.expression)] });
    }
    this.bindings = savedBindings;
    this.providers = savedProviders;
    return joinAll(results);
  }

  // ---- roots ---------------------------------------------------------------
  reportRoots() {
    /** @param {Obligation} o @param {"pending" | "failure"} kind @param {Loc} rootLoc @param {string} rootWhat */
    const emit = (o, kind, rootLoc, rootWhat) => {
      // Multiple render paths can carry the same obligation. report() already
      // keeps the first diagnostic at a site; avoid rebuilding its AST lookup
      // and message for every duplicate path.
      const code = kind === "pending" ? "ASYNC_OUTSIDE_LOADING_BOUNDARY" : "ERROR_OUTSIDE_ERRORED_BOUNDARY";
      if (this.reported.has(code + "@" + o.loc.file + ":" + o.loc.line + ":" + o.loc.col)) return;
      const node = this.nodeAt(o.loc);
      if (!node) return;
      const where = `${rootWhat} at ${rootLoc.file.split("/").pop()}:${rootLoc.line}`;
      if (kind === "pending")
        this.report("ASYNC_OUTSIDE_LOADING_BOUNDARY", "async", "error",
          `"${o.source}" may be pending here and no Loading boundary is above this read, up to the ${where}; the root mount would be deferred with no fallback. Wrap the read in <Loading fallback={…}>, here or in a caller.`,
          node, { ownerName: o.path[o.path.length - 1], ownerPath: o.path, related: [...(o.related ?? []).map(loc => ({ message: "caller prop expression", loc })), { message: `the ${rootWhat}`, loc: rootLoc }], data: { source: o.source } });
      else
        this.report("ERROR_OUTSIDE_ERRORED_BOUNDARY", "error", "error",
          `"${o.source}" may fail with ${describeFailures(o.failures ?? new Set())} here and no Errored boundary is above this read, up to the ${where}; the failure would reach the root and halt reactivity. Wrap the work in <Errored fallback={…}>, here or in a caller.`,
          node, { ownerName: o.path[o.path.length - 1], ownerPath: o.path, related: [...(o.related ?? []).map(loc => ({ message: "caller prop expression", loc })), { message: `the ${rootWhat}`, loc: rootLoc }], data: { failures: [...(o.failures ?? [])], source: o.source } });
    };
    for (const root of this.roots) {
      const summary = root.rootSummary ?? root.component?.summary;
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
      /** @type {ts.Node | null} */
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
