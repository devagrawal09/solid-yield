// @ts-check
// Symbol provenance is syntactic. All service/context colors and boundary
// discharge live in runtime.d.ts and are evaluated by the virtual TS program.
import ts from "typescript";
import { Transformer } from "./transform.mjs";
import { SYNC_CALLBACK_METHODS, isFunctionLike, solidApiOf, stripParens } from "../dataflow/solid.mjs";

export class ContextTransformer extends Transformer {
  prepare() {
    /** @type {Map<string, ts.Node>} */
    this.sites = new Map();
    /** @type {Map<string, ts.Expression[]>} */
    this.relatedSites = new Map();
    /** @type {Set<ts.Symbol>} */
    this.services = new Set();
    /** @type {Set<ts.Symbol>} */
    this.escaped = new Set();
    /** @type {Set<ts.Node>} */
    this.escapeNodes = new Set();
    /** @type {Set<ts.ParameterDeclaration>} */
    this.safeParameters = new Set();
    super.prepare();
    /** @type {Map<ts.Node, Set<ts.Node>>} */
    const graph = new Map();
    /** @type {{ opening: ts.Node, from: ts.Node, to: ts.Node }[]} */
    const edges = [];
    for (const [fn] of this.components) {
      const targets = new Set(); graph.set(fn, targets);
      /** @param {ts.Node} n */
      const visit = n => {
        if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
          const b = this.bindingOf(n.tagName);
          if (b?.kind === "component") { targets.add(b.info.node); edges.push({opening: n, from: fn, to: b.info.node}); }
        }
        ts.forEachChild(n, visit);
      }; if (fn.body) visit(fn.body);
    }
    /** @param {ts.Node} from @param {ts.Node} target @param {Set<ts.Node>} seen @returns {boolean} */
    const reaches = (from, target, seen = new Set()) => {
      if (from === target) return true;
      if (seen.has(from)) return false; seen.add(from);
      return [...(graph.get(from) ?? [])].some(n => reaches(n, target, seen));
    };
    this.recursiveCalls = new Set(edges.filter(e => reaches(e.to, e.from)).map(e => e.opening));
    // Follow aliases, destructuring and project helper returns to a fixed point.
    for (let before = -1; before !== this.services.size;) {
      before = this.services.size;
      for (const sf of this.program.getSourceFiles()) if (this.isProjectFile(sf)) {
      /** @param {ts.Node} n */
      const visit = n => {
        if (ts.isVariableDeclaration(n) && n.initializer && this.serviceExpr(n.initializer)) {
          const names = ts.isIdentifier(n.name) ? [n.name] : n.name.elements.filter(e => !ts.isOmittedExpression(e)).map(e => /** @type {ts.BindingElement} */ (e).name);
          for (const name of names) if (ts.isIdentifier(name)) { const s = this.symbolOf(name); if (s) this.services.add(s); }
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    }
    for (const sf of this.program.getSourceFiles()) if (this.isProjectFile(sf)) {
      /** @param {ts.Node} n */
      const visit = n => {
        if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left) && this.serviceExpr(n.right)) {
          const s = this.symbolOf(n.left);
          const d = s?.valueDeclaration;
          if (d && ts.isVariableDeclaration(d) && ts.isSourceFile(d.parent.parent.parent)) {
            this.escapeNodes.add(n); if (s) { this.services.add(s); this.escaped.add(s); }
            if (ts.isIdentifier(n.right)) { const r = this.symbolOf(n.right); if (r) this.escaped.add(r); }
          }
        }
        if (ts.isCallExpression(n) && !solidApiOf(n.expression, this.checker) && this.bindingOf(n.expression)?.kind !== "helper" && !this.isLibCall(n)) {
          for (const a of n.arguments) if (ts.isIdentifier(a) && this.serviceExpr(a)) { const s = this.symbolOf(a); if (s) this.escaped.add(s); this.escapeNodes.add(n); }
        }
        ts.forEachChild(n, visit);
      }; visit(sf);
    }
    for (let before = -1; before !== this.escaped.size;) {
      before = this.escaped.size;
      for (const sf of this.program.getSourceFiles()) if (this.isProjectFile(sf)) {
        /** @param {ts.Node} n */
        const visit = n => {
          if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.initializer)) {
            const from = this.symbolOf(n.initializer);
            if (from && this.escaped.has(from)) {
              const names = ts.isIdentifier(n.name) ? [n.name] : n.name.elements.filter(e => !ts.isOmittedExpression(e)).map(e => /** @type {ts.BindingElement} */ (e).name);
              for (const name of names) if (ts.isIdentifier(name)) { const s = this.symbolOf(name); if (s) this.escaped.add(s); }
            }
          }
          ts.forEachChild(n, visit);
        }; visit(sf);
      }
    }
  }

  /** @param {ts.SourceFile} sf */
  transformFile(sf) {
    const out = super.transformFile(sf);
    const entries = [...this.components].filter(([node]) => node.getSourceFile() === sf);
    out.insert("\ndeclare module \"solid-sound-typed\" { interface Components {" + entries.map(([node, info]) => this.key(node) + ": typeof " + info.name + ";").join(" ") + "} }\n", 0);
    for (const [node, info] of this.components) if (node.getSourceFile() === sf && !info.rendered && !info.handedOff && !info.callers) {
      out.insert("\n__s.checkComponent(" + info.name + ");\n", node.getStart());
    }
    return out;
  }

  /** @param {ts.Node} n */
  site(n) { const id = n.getSourceFile().fileName + ":" + n.getStart(); this.sites.set(id, n); return JSON.stringify(id); }
  /** @param {ts.Node} n */
  key(n) { return JSON.stringify(n.getSourceFile().fileName + ":" + n.getStart()); }

  /** Prove provider identity from createContext, never from a type's printed name.
   * @param {ts.Node} n @param {Set<ts.Symbol>} seen @returns {ts.CallExpression | undefined} */
  contextOf(n, seen = new Set()) {
    const s = this.symbolOf(n);
    if (!s || seen.has(s)) return undefined;
    seen.add(s);
    for (const d of s.declarations ?? []) if (ts.isVariableDeclaration(d) && d.initializer) {
      const x = stripParens(d.initializer);
      if (ts.isCallExpression(x) && solidApiOf(x.expression, this.checker)?.api === "createContext") return x;
      if (ts.isIdentifier(x) || ts.isPropertyAccessExpression(x)) return this.contextOf(x, seen);
    }
    return undefined;
  }

  /** @param {ts.Node} n @param {Set<ts.Node>} seen @returns {boolean} */
  serviceExpr(n, seen = new Set()) {
    if (seen.has(n)) return false;
    seen.add(n);
    if (ts.isIdentifier(n)) {
      const s = this.symbolOf(n);
      if (s && this.services.has(s)) return true;
      const b = this.bindingOf(n);
      if (b?.kind === "object") return b.node.properties.some(p => ts.isShorthandPropertyAssignment(p) && ["signal", "memo"].includes(this.shorthandBinding(p)?.kind ?? ""));
    }
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) return this.serviceExpr(n.expression, seen);
    if (ts.isCallExpression(n)) {
      if (solidApiOf(n.expression, this.checker)?.api === "useContext") return true;
      const b = this.bindingOf(n.expression);
      if (b?.kind === "helper") {
        if (b.factory) return true;
        let found = false;
        /** @param {ts.Node} x */
        const visit = x => { if (isFunctionLike(x)) return; if (ts.isReturnStatement(x) && x.expression && this.serviceExpr(x.expression, seen)) found = true; ts.forEachChild(x, visit); };
        if (b.node.body) { if (!ts.isBlock(b.node.body)) return this.serviceExpr(b.node.body, seen); visit(b.node.body); }
        return found;
      }
    }
    return false;
  }

  /** @param {ts.CallExpression} call */
  isWorstCall(call) {
    const api = solidApiOf(call.expression, this.checker);
    if (api?.api === "useContext") return !call.arguments[0] || !this.contextOf(call.arguments[0]);
    const b = this.bindingOf(call.expression);
    if (b?.kind === "helper" && b.factory) return false;
    return super.isWorstCall(call);
  }

  /** @param {ts.CallExpression} call @param {number} depth */
  callFailures(call, depth) {
    const b = this.bindingOf(call.expression);
    if (b?.kind === "helper" && b.factory) return this.failuresOf(b.node, depth);
    if (this.serviceExpr(call.expression)) return new Set();
    return super.callFailures(call, depth);
  }
  /** @param {ts.Expression} e @param {number} depth */
  rejectsOf(e, depth) {
    if (ts.isCallExpression(stripParens(e)) && this.serviceExpr(/** @type {ts.CallExpression} */ (stripParens(e)).expression)) return new Set();
    return super.rejectsOf(e, depth);
  }

  /** @param {ts.Node} n */
  caughtAt(n) {
    const call = ts.isCallExpression(n.parent) && n.parent.expression === n ? n.parent : undefined;
    const promise = call && this.producesPromise(call);
    let awaited = false;
    for (let p = n.parent; p; p = p.parent) {
      if (isFunctionLike(p)) break;
      if (ts.isAwaitExpression(p)) awaited = true;
      if (promise && ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && p.expression.name.text === "catch" && this.isLibCall(p) && n.getEnd() <= p.expression.expression.getEnd()) return true;
      if (ts.isTryStatement(p) && p.catchClause && n.getStart() >= p.tryBlock.getStart() && n.getEnd() <= p.tryBlock.getEnd()) return !promise || awaited;
    }
    return false;
  }

  /** @param {import("./transform.mjs").ComponentInfo} info @param {string} name @param {Set<string>} seen @returns {ts.Expression[]} */
  propOrigins(info, name, seen = new Set()) {
    const key = this.key(info.node) + ":" + name;
    if (seen.has(key)) return []; seen.add(key);
    const direct = info.callbackProps.get(name) ?? [];
    const forwarded = direct.flatMap(e => {
      if (ts.isPropertyAccessExpression(e)) {
        const b = this.bindingOf(e.expression);
        if (b?.kind === "props") return this.propOrigins(b.info, e.name.text, seen);
      }
      const b = this.bindingOf(e);
      return b?.kind === "propMember" ? this.propOrigins(b.info, b.name, seen) : [];
    });
    return [...new Set([...direct, ...forwarded])];
  }

  /** @param {ts.Node} node @param {number} depth @returns {string[]} */
  depsOf(node, depth) {
    const deps = new Set(super.depsOf(node, depth));
    /** @param {ts.Node} n @param {boolean} enter */
    const visit = (n, enter = false) => {
      if (isFunctionLike(n) && !enter) return;
      if (ts.isPropertyAccessExpression(n)) {
        const b = this.bindingOf(n.expression);
        if (b?.kind === "props") {
          deps.add("__s.propRef<" + this.key(b.info.node) + ", " + JSON.stringify(n.name.text) + ">()");
          const id = JSON.parse(this.site(node));
          this.relatedSites.set(id, this.propOrigins(b.info, n.name.text));
          return;
        }
      }
      if (ts.isIdentifier(n) && ts.isCallExpression(n.parent) && n.parent.expression === n) {
        const b = this.bindingOf(n);
        if (b && ["signal", "memo", "accessor", "worst"].includes(b.kind)) {
          deps.delete(n.text);
          const d = "__s.at(" + n.text + ", " + this.site(n.parent) + ")";
          deps.add(this.caughtAt(n) ? "__s.caught(" + d + ")" : d);
          return;
        }
      }
      if (ts.isIdentifier(n) || ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
        if (ts.isPropertyAccessExpression(n.parent) && n.parent.expression === n) return;
        if (ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) return;
        if (ts.isVariableDeclaration(n.parent) && n.parent.name === n || ts.isBindingElement(n.parent)) return;
        if (this.serviceExpr(n)) {
          if (ts.isIdentifier(n) && n !== node && !(ts.isCallExpression(n.parent) && n.parent.expression === n)) return;
          const root = ts.isIdentifier(n) ? this.symbolOf(n) : this.symbolOf(/** @type {ts.PropertyAccessExpression} */ (n).expression);
          const dep = root && this.escaped.has(root) ? "__s.tainted(" + n.getText() + ")" : n.getText();
          const located = "__s.at(" + dep + ", " + this.site(ts.isCallExpression(n.parent) ? n.parent : n) + ")";
          deps.add(this.caughtAt(n) ? "__s.caught(" + located + ")" : located);
          return;
        }
      }
      ts.forEachChild(n, ch => visit(ch));
    };
    visit(node, isFunctionLike(node));
    return [...deps];
  }

  /** @param {ts.Node} node @param {"module" | "setup" | "setup-callback" | "tracking" | "handler" | "generic"} mode */
  rewriteFor(node, mode) {
    const out = /** @type {import("./transform.mjs").Output} */ (this.out);
    // track() introduces a closure. Preserve a non-null fact already proven
    // by the original TS program when that closure would lose its narrowing.
    if (ts.isIdentifier(node) && mode === "tracking") {
      const s = this.symbolOf(node), t = this.checker.getTypeAtLocation(node);
      const nullable = (t.isUnion() ? t.types : [t]).some(t => t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null));
      if (s && this.escaped.has(s) && !nullable) return () => out.insert(node.text + "!", node.getStart());
    }
    if (this.escapeNodes.has(node)) {
      this.warn(node, "a service escape", "unknown code can change this object; its aliases are treated as worst case.", this.owner);
      if (mode === "setup") {
        const values = ts.isBinaryExpression(node) ? [node.right] : ts.isCallExpression(node) ? node.arguments : [];
        for (const value of values) if (ts.isIdentifier(value) && this.serviceExpr(value)) this.effects?.push("__s.taint(" + value.getText() + ")");
      }
    }
    if (ts.isCallExpression(node)) {
      const api = solidApiOf(node.expression, this.checker);
      if (api?.api === "createContext") return () => {
        out.insert("__s.context<" + this.key(node) + (node.typeArguments?.[0] ? ", " + node.typeArguments[0].getText() : "") + ">()(", node.getStart());
        if (node.arguments[0]) this.walkRange(node.arguments[0], "generic");
        out.insert(")", node.getEnd());
      };
      if (api?.api === "useContext" && node.arguments[0]) return () => {
        if (!this.contextOf(node.arguments[0])) {
          this.warn(node, "a dynamic context lookup", "the context has no createContext provenance; its value is worst case.", this.owner);
          out.insert("__s.worst(", node.getStart()); out.copy(node.getStart(), node.getEnd()); out.insert(")", node.getEnd()); return;
        }
        if (mode === "setup") this.effects?.push("__s.lookupView(" + node.arguments[0].getText() + ", " + this.site(node) + ")");
        out.insert("__s.lookup(" + node.arguments[0].getText() + ", " + this.site(node) + ")", node.getStart());
      };
    }
    if (mode === "setup" && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(stripParens(node.initializer))) {
      const init = /** @type {ts.CallExpression} */ (stripParens(node.initializer));
      const b = this.bindingOf(init.expression);
      if (b?.kind === "helper" && b.factory) this.effects?.push("__s.factoryView(" + node.name.text + ")");
    }
    if (mode === "setup" && ts.isReturnStatement(node) && node.expression && this.factoryDepth) return () => {
      out.insert("return __s.service(", node.getStart()); this.walkRange(node.expression, "setup");
      out.insert(", [" + (this.effects ?? []).join(", ") + "])", node.getEnd()); out.insert(";", node.getEnd());
    };
    if (ts.isVariableDeclaration(node) && node.type && ts.isIdentifier(node.name) && node.initializer && isFunctionLike(stripParens(node.initializer))) {
      const fn = stripParens(node.initializer);
      const b = this.bindingOf(node.name);
      if (this.components.has(fn) || b?.kind === "helper" && b.factory) return () => {
        out.copy(node.name.getStart(), node.name.getEnd());
        out.insert(" = __s.functionValue<Parameters<" + node.type.getText() + ">>()(", node.getStart());
        this.walkRange(node.initializer, "module"); out.insert(")", node.getEnd());
      };
    }
    if (isFunctionLike(node) && !this.components.has(node)) {
      const name = node.name ?? (ts.isVariableDeclaration(node.parent) ? node.parent.name : undefined);
      const b = name ? this.bindingOf(name) : undefined;
      if (b?.kind === "helper" && b.factory && node.body) return () => {
        const body = /** @type {ts.FunctionLikeDeclaration} */ (node).body;
        if (!body) return;
        const fn = /** @type {ts.FunctionLikeDeclaration} */ (node);
        if (fn.type) {
          const colon = node.getSourceFile().text.lastIndexOf(":", fn.type.getStart());
          out.copy(node.getStart(), colon); out.copy(fn.type.getEnd(), body.getStart());
        } else out.copy(node.getStart(), body.getStart());
        const savedEffects = this.effects;
        this.effects = []; this.factoryDepth = (this.factoryDepth ?? 0) + 1;
        if (ts.isBlock(body)) this.walkRange(body, "setup");
        else {
          out.insert("__s.service(", body.getStart()); this.walkRange(body, "setup");
          out.insert(", [" + this.effects.join(", ") + "])", body.getEnd());
        }
        this.factoryDepth--; this.effects = savedEffects;
      };
    }
    if (ts.isArrowFunction(node) && !this.components.has(node) && node.parameters.some(p => !p.type)) return () => {
      out.insert((node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ? "async " : "") + "(", node.getStart());
      node.parameters.forEach((p, i) => {
        if (i) out.insert(", ", p.getStart());
        if (p.type) out.copy(p.getStart(), p.getEnd());
        else {
          const t = this.checker.getTypeAtLocation(p.name);
          const printed = t.flags & ts.TypeFlags.Any ? "unknown" : this.checker.typeToString(t, p, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType);
          if (t.flags & ts.TypeFlags.Any) this.warn(p, "an unresolved callback parameter", "its value is treated as worst case.", this.owner);
          const type = this.safeParameters.has(p) ? "__s.Safe<" + printed + ">" : printed;
          out.insert((p.dotDotDotToken ? "..." : "") + p.name.getText() + (p.questionToken ? "?" : "") + ": " + type + (p.initializer ? " = " + p.initializer.getText() : ""), p.getStart());
        }
      });
      out.insert(")" + (node.type ? ": " + node.type.getText() : "") + " => ", node.getStart());
      this.walkRange(node.body, mode === "setup" ? "generic" : mode === "setup-callback" ? "setup" : mode === "module" ? "generic" : mode);
    };
    if (ts.isPropertyAssignment(node) && isFunctionLike(stripParens(node.initializer))) return () => {
      out.copy(node.getStart(), node.initializer.getStart());
      this.emitMethod(node.initializer, /** @type {ts.FunctionLikeDeclaration} */ (stripParens(node.initializer)));
    };
    if (ts.isShorthandPropertyAssignment(node)) {
      const b = this.shorthandBinding(node);
      if (b?.kind === "helper") return () => {
        out.insert(node.name.text + ": ", node.getStart()); this.emitMethod(node.name, b.node);
      };
    }
    // Setup scopes are added to the component's typed view, not charged to a
    // caller root. A rendered boundary cannot repair a setup read.
    if (mode === "setup" && ts.isCallExpression(node) && !solidApiOf(node.expression, this.checker)) {
      const b = this.bindingOf(node.expression);
      if (b?.kind !== "setter" && !(b?.kind === "helper" && b.factory)) {
        const callee = stripParens(node.expression);
        const reads = this.serviceExpr(callee) || b && ["signal", "memo", "accessor", "worst"].includes(b.kind) || isFunctionLike(callee) || this.isLibCall(node) && ts.isPropertyAccessExpression(callee) && SYNC_CALLBACK_METHODS.has(callee.name.text);
        const deps = b?.kind === "helper" ? this.depsOf(b.node, 0) : reads ? this.depsOf(node, 0) : [];
        if (deps.length && this.effects) this.effects.push("__s.scope([" + deps.join(", ") + "], __s.fails(), "+ JSON.stringify("setup") + ", " + this.site(node) + ")");
        if (deps.length) return null;
      }
    }
    if (mode === "setup" && ts.isPropertyAccessExpression(node) && !(ts.isCallExpression(node.parent) && node.parent.expression === node)) {
      const b = this.bindingOf(node.expression);
      if (b?.kind === "object") {
        const getter = this.getterOf(b.node, node.name.text);
        if (getter?.body) {
          const deps = this.depsOf(getter.body, 0);
          this.effects?.push("__s.scope([" + deps.join(", ") + "], __s.fails(), " + JSON.stringify("setup") + ", " + this.site(node) + ")");
          return null;
        }
      }
      if (b?.kind === "props") {
        const deps = this.depsOf(node, 0);
        this.effects?.push("__s.scope([" + deps.join(", ") + "], __s.fails(), "+ JSON.stringify("setup") + ", " + this.site(node) + ")");
        return null;
      }
    }
    return super.rewriteFor(node, mode);
  }

  /** @param {ts.Expression} expr @param {ts.FunctionLikeDeclaration} fn */
  emitMethod(expr, fn) {
    const out = /** @type {import("./transform.mjs").Output} */ (this.out);
    const deps = this.depsOf(fn, 0);
    /** @type {string[]} */
    const writes = [];
    /** @param {ts.Node} n */
    const visit = n => { if (isFunctionLike(n) && n !== fn) return; if (ts.isCallExpression(n) && this.bindingOf(n.expression)?.kind === "setter") writes.push(this.site(n)); ts.forEachChild(n, visit); };
    visit(fn);
    out.insert("__s.method(", expr.getStart());
    this.walkRange(expr, "generic");
    out.insert(", [" + deps.join(", ") + "], " + this.failsType(this.failuresOf(fn, 0)) + (writes.length ? ", " + writes[0] : "") + ")", expr.getStart());
  }

  /** @param {ts.CallExpression} call @param {"setup" | "tracking" | "handler"} mode */
  rewriteCall(call, mode) {
    const b = this.bindingOf(call.expression);
    if (b?.kind === "helper" && b.factory) return null;
    return super.rewriteCall(call, mode);
  }

  /** @param {ts.Expression} e */
  emitRenderCallback(e) {
    const fn = stripParens(e);
    if (isFunctionLike(fn)) for (const p of fn.parameters) this.safeParameters.add(p);
    return super.emitRenderCallback(e);
  }

  /** Locate the failing operation within a tracked expression, including
   * synchronous library callbacks. Source-read sites stay separate.
   * @param {ts.Node} node @returns {ts.Node} */
  failureSite(node) {
    /** @type {ts.Node | undefined} */
    let found;
    /** @param {ts.Node} n @param {boolean} enter */
    const visit = (n, enter = false) => {
      if (found || isFunctionLike(n) && !enter) return;
      if (ts.isThrowStatement(n)) { found = n; return; }
      if (ts.isCallExpression(n)) {
        const callee = stripParens(n.expression);
        visit(callee, isFunctionLike(callee));
        const sync = ts.isPropertyAccessExpression(callee) && SYNC_CALLBACK_METHODS.has(callee.name.text) && this.isLibCall(n);
        for (const arg of n.arguments) visit(arg, sync);
        if (!found && this.callFailures(n, 0).size) found = n;
        return;
      }
      if (isFunctionLike(n) && n.body) { visit(n.body); return; }
      ts.forEachChild(n, ch => visit(ch));
    };
    visit(node);
    return found ?? node;
  }

  /** @param {ts.Expression} e */
  emitTrack(e) {
    const out = /** @type {import("./transform.mjs").Output} */ (this.out);
    out.insert("__s.track(() => ", e.getStart());
    this.walkRange(e, "tracking");
    out.insert(", [" + this.depsOf(e, 0).join(", ") + "], " + this.failsType(this.failuresOf(e, 0)) + ", " + this.site(e) + ", " + this.site(this.failureSite(e)) + ")", e.getStart());
  }

  /** @param {ts.Expression} e @param {number} anchor @param {string} description */
  emitHandler(e, anchor, description) {
    const out = /** @type {import("./transform.mjs").Output} */ (this.out);
    const x = stripParens(e);
    const b = this.bindingOf(x);
    const target = isFunctionLike(x) ? x : b?.kind === "helper" ? b.node : x;
    const parentBinding = ts.isPropertyAccessExpression(x) ? this.bindingOf(x.expression) : undefined;
    const fs = isFunctionLike(target) ? this.failuresOf(target, 0) : this.serviceExpr(target) ? new Set() : parentBinding?.kind === "props" && ts.isPropertyAccessExpression(x) ? this.propCallFailures(parentBinding.info, x.name.text, 0) : b?.kind === "propMember" ? this.propCallFailures(b.info, b.name, 0) : this.calleeFailures(x, 0);
    out.insert("__s.handler(", anchor);
    this.walkRange(e, "handler");
    const handlerNode = ts.isJsxExpression(e.parent) && ts.isJsxAttribute(e.parent.parent) ? e.parent.parent : e;
    out.insert(", " + this.failsType(fs) + ", [" + this.depsOf(target, 0).join(", ") + "], " + this.site(handlerNode) + ")", anchor);
  }

  /** @param {ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment} node @param {"setup" | "tracking"} mode */
  emitView(node, mode) {
    if (ts.isJsxFragment(node)) return super.emitView(node, mode);
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    this.site(opening);
    const children = ts.isJsxElement(node) ? node.children : [];
    const out = /** @type {import("./transform.mjs").Output} */ (this.out);
    if (this.contextOf(opening.tagName)) {
      const attr = opening.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText() === "value");
      const value = attr && ts.isJsxAttribute(attr) && attr.initializer && ts.isJsxExpression(attr.initializer) ? attr.initializer.expression : undefined;
      out.insert("__s.provide(" + opening.tagName.getText() + ", ", node.getStart());
      const valueSymbol = value && ts.isIdentifier(value) ? this.symbolOf(value) : undefined;
      if (valueSymbol && this.escaped.has(valueSymbol)) out.insert("__s.taintedValue(", value.getStart());
      if (value) this.walkRange(value, "generic"); else out.insert("undefined", node.getStart());
      if (valueSymbol && this.escaped.has(valueSymbol)) out.insert(")", value.getEnd());
      out.insert(", [", node.getStart()); this.emitChildren(children, node.getStart());
      out.insert("])", node.getEnd()); out.cursor = node.getEnd(); return;
    }
    const b = this.bindingOf(opening.tagName);
    if (b?.kind !== "component") return super.emitView(node, mode);
    const recursive = this.recursiveCalls.has(opening);
    out.insert(recursive ? "__s.recur<" + this.key(b.info.node) + ">()({" : "__s.el(" + opening.tagName.getText() + ", {", node.getStart());
    let first = true;
    for (const a of opening.attributes.properties) {
      if (ts.isJsxSpreadAttribute(a)) { this.warn(a, "a spread into component props", "its values are treated as worst case.", this.owner); continue; }
      out.insert((first ? "" : ", ") + JSON.stringify(a.name.getText()) + ": ", a.getStart()); first = false;
      const init = a.initializer;
      if (init && ts.isJsxExpression(init) && init.expression) {
        const e = init.expression;
        const x = stripParens(e);
        if (isFunctionLike(x)) this.emitMethod(e, /** @type {ts.FunctionLikeDeclaration} */ (x));
        else {
          out.insert("__s.prop(() => ", e.getStart()); this.walkRange(e, "tracking");
          out.insert(", [" + this.depsOf(e, 0).join(", ") + "], " + this.failsType(this.failuresOf(e, 0)) + ")", e.getStart());
        }
      } else if (init && ts.isStringLiteral(init)) out.copy(init.getStart(), init.getEnd());
      else out.insert("true", a.getStart());
    }
    const meaningful = children.filter(ch => !ts.isJsxText(ch));
    if (meaningful.length === 1 && ts.isJsxExpression(meaningful[0]) && meaningful[0].expression) {
      const e = meaningful[0].expression;
      out.insert((first ? "" : ", ") + "children: __s.prop(() => ", e.getStart());
      this.walkRange(e, "tracking");
      out.insert(", [" + this.depsOf(e, 0).join(", ") + "], " + this.failsType(this.failuresOf(e, 0)) + ")", e.getStart());
      out.insert("}, [", node.getStart());
    } else { out.insert("}, [", node.getStart()); this.emitChildren(children, node.getStart()); }
    out.insert("], " + (recursive ? this.site(opening) : this.key(b.info.node)) + ")", node.getEnd()); out.cursor = node.getEnd();
  }
}
