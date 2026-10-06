import { parseProgram } from "../../vite-plugin-yield/src/transform.js";

const key = n => n?.name ?? n?.value;
const unwrap = p => {
  while (
    p?.node &&
    /^(TSAsExpression|TSNonNullExpression|TSTypeAssertion|ParenthesizedExpression)$/.test(
      p.node.type
    )
  )
    p = p.get("expression");
  return p;
};
const cells = new Set(["$signal", "$store", "$projection", "$optimistic", "$optimisticStore"]);
const flows = new Set(["For", "Show", "Switch", "Match", "Repeat"]);
const boundaries = new Set(["Loading", "Errored", "Reveal"]);
const pure = new Set([
  "String",
  "Number",
  "Boolean",
  "parseInt",
  "parseFloat",
  "isNaN",
  "encodeURIComponent",
  "decodeURIComponent",
  "JSON.stringify",
  "JSON.parse",
  "Object.keys",
  "Object.values",
  "Object.entries",
  "Object.assign",
  "Object.freeze",
  "Array.from",
  "Array.isArray",
  "Math.floor",
  "Math.ceil",
  "Math.round",
  "Math.min",
  "Math.max",
  "Math.abs",
  "Math.pow"
]);
const methods = new Set([
  "trim",
  "toLowerCase",
  "toUpperCase",
  "toFixed",
  "toString",
  "slice",
  "substring",
  "split",
  "join",
  "replace",
  "replaceAll",
  "includes",
  "startsWith",
  "endsWith",
  "indexOf",
  "reverse",
  "concat",
  "map",
  "filter",
  "find",
  "findIndex",
  "some",
  "every",
  "reduce",
  "forEach",
  "sort",
  "at"
]);
const timers = new Set([
  "setInterval",
  "setTimeout",
  "requestAnimationFrame",
  "requestIdleCallback",
  "queueMicrotask"
]);

/** Abstract values, never evaluated application code. Each function invocation has
 * its own binding environment. Only recursion reuses an ancestor environment. */
export class Analysis {
  constructor(modules, resolve) {
    this.resolve = resolve;
    this.modules = new Map();
    this.paths = new WeakMap();
    this.moduleOf = new WeakMap();
    this.facts = new Map();
    this.parts = [];
    this.frames = [];
    this.dom = [];
    this.leaks = new Map();
    this.jobs = [];
    this.contexts = [];
    this.findings = [];
    this.serial = 0;
    this.callCache = new Map();
    this.running = [];
    for (const [id, code] of modules) {
      const program = parseProgram(code, id);
      const env = { id, bindings: new Map(), parent: null, frame: null };
      const record = {
        id,
        code,
        program,
        env,
        exports: new Map(),
        server: program.node.directives.some(d => d.value.value === "use server")
      };
      this.modules.set(id, record);
      program.traverse({
        enter: p => {
          this.paths.set(p.node, p);
          this.moduleOf.set(p.node, record);
        }
      });
      for (const p of program.get("body")) {
        if (p.isExportDefaultDeclaration()) record.exports.set("default", p.get("declaration"));
        if (p.isExportNamedDeclaration()) {
          const d = p.get("declaration");
          if (d?.isVariableDeclaration())
            for (const v of d.get("declarations"))
              record.exports.set(key(v.node.id), v.get("init"));
          if (d?.isFunctionDeclaration()) record.exports.set(d.node.id.name, d);
          for (const s of p.get("specifiers"))
            record.exports.set(
              key(s.node.exported),
              p.node.source
                ? { source: p.node.source.value, name: key(s.node.local) }
                : s.get("local")
            );
        }
      }
    }
  }
  at(p) {
    return `${this.moduleOf.get(p.node)?.id}:${p.node.loc?.start.line ?? 1}:${(p.node.loc?.start.column ?? 0) + 1}`;
  }
  value(p, env, role = "value", base = 0) {
    const id = `${env.id}:${p?.node?.start ?? "synthetic"}:${role}`;
    if (!this.facts.has(id))
      this.facts.set(id, {
        id,
        at: p ? this.at(p) : env.id,
        path: p,
        kind: role,
        base,
        p: base,
        deps: new Set(),
        fields: new Map(),
        owner: env.frame,
        pending: false,
        failing: false
      });
    return this.facts.get(id);
  }
  join(p, env, values, role = "value") {
    const out = this.value(p, env, role);
    for (const v of values.filter(Boolean)) if (v !== out) out.deps.add(v);
    return out;
  }
  scalar(p, env, literal) {
    const v = this.value(p, env);
    v.literal = literal;
    v.known = true;
    return v;
  }
  unknown(
    p,
    env,
    construct,
    reason,
    classification = "genuine",
    rule = "A client input remains U under C0 §1.2."
  ) {
    const v = this.value(p, env, "unknown", 1);
    v.base = 1;
    // Count a syntactic origin once, even when instantiated more than once.
    const site = this.at(p);
    if (!this.leaks.has(site))
      this.leaks.set(site, {
        at: site,
        name: p.toString(),
        construct,
        classification,
        reason,
        rule,
        values: new Set()
      });
    this.leaks.get(site).values.add(v);
    return v;
  }
  part(p, env, kind, deps = [], ctx = {}) {
    const v = this.join(p, env, deps, kind);
    if (!v.part) {
      v.part = true;
      this.parts.push(v);
    }
    v.anchor ??= ctx.dom ?? env.frame?.anchor ?? null;
    v.host ??= ctx.host;
    return v;
  }
  env(parent, id, frame = parent.frame) {
    return { id, parent, frame, bindings: new Map() };
  }
  lookup(binding, env) {
    for (let e = env; e; e = e.parent)
      if (e.bindings.has(binding.identifier)) return e.bindings.get(binding.identifier);
    return null;
  }
  bind(pattern, v, env) {
    if (!pattern?.node) return;
    if (pattern.isIdentifier()) {
      const b = pattern.scope.getBinding(pattern.node.name);
      if (b) env.bindings.set(b.identifier, v);
      v.binding ??= { name: pattern.node.name, at: this.at(pattern), frame: env.frame };
    } else if (pattern.isArrayPattern())
      pattern
        .get("elements")
        .forEach((x, i) => this.bind(x, this.prop(v, String(i), pattern, env), env));
    else if (pattern.isObjectPattern())
      for (const x of pattern.get("properties")) {
        if (x.isObjectProperty())
          this.bind(x.get("value"), this.prop(v, key(x.node.key), x, env), env);
        else if (x.isRestElement()) this.bind(x.get("argument"), v, env);
      }
    else if (pattern.isAssignmentPattern())
      this.bind(
        pattern.get("left"),
        this.join(pattern, env, [v, this.expr(pattern.get("right"), env)]),
        env
      );
    else if (pattern.isRestElement()) this.bind(pattern.get("argument"), v, env);
  }
  prop(obj, name, p, env) {
    if (!obj)
      return this.unknown(
        p,
        env,
        "other",
        "missing object",
        "blind spot",
        "Resolve the object's defining expression."
      );
    if (obj.fields.has(name)) return obj.fields.get(name);
    if (obj.context) {
      const v = this.value(p, env, `context-field:${name}`);
      v.contextField = { context: obj.context, name };
      return v;
    }
    if (obj.namespace) return this.exported(obj.namespace, name, p, env);
    if (obj.external) {
      const v = this.value(p, env, `external:${name}`);
      v.external = { ...obj.external, name: `${obj.external.name}.${name}` };
      return v;
    }
    if (obj.global) {
      const v = this.value(p, env, `global:${name}`);
      v.global = `${obj.global}.${name}`;
      if (/^(window|document|location|navigator)\b/.test(v.global)) v.base = 2;
      return v;
    }
    const v = this.join(p, env, [obj], `field:${name}`);
    v.receiver = obj;
    v.method = name;
    if (obj.callable?.kind === "context" && name === "provide")
      v.callable = { kind: "provide", context: obj };
    return v;
  }
  exported(id, name, p, env, seen = new Set()) {
    const r = this.modules.get(id),
      item = r?.exports.get(name);
    if (!item || seen.has(`${id}:${name}`))
      return this.unknown(
        p,
        env,
        "other",
        `unread export ${name}`,
        "blind spot",
        "Follow the module export/re-export binding."
      );
    seen.add(`${id}:${name}`);
    if (item.source) return this.exported(this.resolve(item.source, id), item.name, p, env, seen);
    return this.expr(item, r.env);
  }
  identifier(p, env) {
    const b = p.scope.getBinding(p.node.name);
    if (!b) {
      const v = this.value(p, env);
      v.global = p.node.name;
      if (["undefined", "NaN", "Infinity"].includes(p.node.name)) v.known = true;
      if (/^(window|document|location|navigator)$/.test(p.node.name)) v.base = 2;
      return v;
    }
    const found = this.lookup(b, env);
    if (found) return found;
    const path = b.path;
    if (
      path.isImportSpecifier() ||
      path.isImportDefaultSpecifier() ||
      path.isImportNamespaceSpecifier()
    ) {
      const source = path.parentPath.node.source.value;
      const name = path.isImportDefaultSpecifier() ? "default" : key(path.node.imported);
      const id = this.resolve(source, this.moduleOf.get(path.node).id);
      if (this.modules.has(id)) {
        if (path.isImportNamespaceSpecifier()) {
          const v = this.value(path, env);
          v.namespace = id;
          return v;
        }
        return this.exported(id, name, p, env);
      }
      const v = this.value(path, this.moduleOf.get(path.node).env);
      v.external = { source, name: path.isImportNamespaceSpecifier() ? "" : name };
      return v;
    }
    if (path.isFunctionDeclaration()) return this.expr(path, this.moduleOf.get(path.node).env);
    if (path.isVariableDeclarator()) {
      const moduleEnv = path.scope.getFunctionParent() ? env : this.moduleOf.get(path.node).env;
      const placeholder = this.value(path, moduleEnv, "binding");
      this.bind(path.get("id"), placeholder, moduleEnv);
      const v = this.expr(path.get("init"), moduleEnv);
      this.bind(path.get("id"), v, moduleEnv);
      if (!b.constant) {
        v.mutable = true;
        for (const w of b.constantViolations)
          if (w.isAssignmentExpression()) v.deps.add(this.expr(w.get("right"), moduleEnv));
      }
      return this.lookup(b, moduleEnv) ?? v;
    }
    if (path.isClassDeclaration()) {
      const v = this.value(path, env);
      v.class = true;
      return v;
    }
    return this.unknown(
      path,
      env,
      "helper routine",
      "parameter not supplied by a known call",
      "blind spot",
      "Instantiate the callback with its caller's argument provenance."
    );
  }
  expr(input, env, ctx = {}) {
    const p = unwrap(input);
    if (!p?.node) return this.value(null, env, "undefined");
    if (p.isIdentifier()) return this.identifier(p, env);
    if (p.isLiteral() || p.isJSXText()) return this.scalar(p, env, p.node.value);
    if (p.isFunction()) {
      const v = this.value(p, env, "function");
      v.callable = { kind: "function", path: p, env };
      return v;
    }
    if (p.isYieldExpression() || p.isAwaitExpression()) {
      const v = this.expr(p.get("argument"), env, ctx);
      if (v.callable?.kind === "context") {
        const out = this.part(p, env, "context-read", [v], ctx);
        out.context = v;
        for (const [name, value] of v.fields) out.fields.set(name, value);
        return out;
      }
      ctx.reads?.add(v);
      return v;
    }
    if (p.isMemberExpression() || p.isOptionalMemberExpression())
      return this.prop(
        this.expr(p.get("object"), env, ctx),
        p.node.computed
          ? p.get("property").isLiteral()
            ? p.node.property.value
            : "*"
          : key(p.node.property),
        p,
        env
      );
    if (p.isObjectExpression()) {
      const out = this.value(p, env, "object");
      for (const field of p.get("properties")) {
        if (field.isSpreadElement()) {
          const v = this.expr(field.get("argument"), env, ctx);
          for (const [k, item] of v.fields) out.fields.set(k, item);
          out.deps.add(v);
        } else {
          const v = field.isObjectMethod()
            ? this.expr(field, env, ctx)
            : this.expr(field.get("value"), env, ctx);
          out.fields.set(key(field.node.key) ?? "*", v);
          out.deps.add(v);
        }
      }
      return out;
    }
    if (p.isArrayExpression()) {
      const out = this.value(p, env, "array");
      p.get("elements").forEach((q, i) => {
        const v = this.expr(q.isSpreadElement() ? q.get("argument") : q, env, ctx);
        out.fields.set(String(i), v);
        out.deps.add(v);
      });
      return out;
    }
    if (p.isCallExpression() || p.isOptionalCallExpression() || p.isNewExpression()) {
      const fn = this.expr(p.get("callee"), env, ctx);
      const args = p
        .get("arguments")
        .map(q => this.expr(q.isSpreadElement() ? q.get("argument") : q, env, ctx));
      return this.call(fn, args, p, env, ctx, p.isNewExpression());
    }
    if (p.isJSXElement() || p.isJSXFragment()) return this.jsx(p, env, ctx);
    if (p.isJSXExpressionContainer()) return this.expr(p.get("expression"), env, ctx);
    if (p.isAssignmentExpression()) {
      const value = this.expr(p.get("right"), env, ctx),
        old = this.expr(p.get("left"), env, ctx);
      old.deps.add(value);
      old.mutable = true;
      if (["event", "effect", "timer"].includes(ctx.host)) old.base = 2;
      return old;
    }
    if (p.isUpdateExpression()) {
      const v = this.expr(p.get("argument"), env, ctx);
      if (ctx.host) v.base = 2;
      return v;
    }
    const values = [];
    for (const name of [
      "left",
      "right",
      "test",
      "consequent",
      "alternate",
      "argument",
      "expression"
    ])
      if (p.node[name] && !Array.isArray(p.node[name]))
        values.push(this.expr(p.get(name), env, ctx));
    for (const name of ["expressions", "elements"])
      if (Array.isArray(p.node[name])) values.push(...p.get(name).map(q => this.expr(q, env, ctx)));
    if (values.length || p.isJSXEmptyExpression()) return this.join(p, env, values);
    return this.unknown(
      p,
      env,
      "other",
      `unmodelled ${p.node.type}`,
      "blind spot",
      `Add a transfer rule for ${p.node.type}; preserve all reads and writes.`
    );
  }
  statements(body, env, ctx) {
    const returns = [];
    const visit = p => {
      if (!p?.node) return;
      if (p.isBlockStatement()) for (const s of p.get("body")) visit(s);
      else if (p.isVariableDeclaration())
        for (const d of p.get("declarations"))
          this.bind(d.get("id"), this.expr(d.get("init"), env, ctx), env);
      else if (p.isReturnStatement()) returns.push(this.expr(p.get("argument"), env, ctx));
      else if (p.isExpressionStatement()) this.expr(p.get("expression"), env, ctx);
      else if (p.isIfStatement()) {
        const condition = this.expr(p.get("test"), env, ctx);
        visit(p.get("consequent"));
        visit(p.get("alternate"));
        if (returns.length) returns.push(condition);
      } else if (p.isFunctionDeclaration()) this.bind(p.get("id"), this.expr(p, env, ctx), env);
      else if (p.isForOfStatement() || p.isForInStatement()) {
        const v = this.expr(p.get("right"), env, ctx),
          left = p.get("left");
        this.bind(
          left.isVariableDeclaration() ? left.get("declarations")[0].get("id") : left,
          v,
          env
        );
        visit(p.get("body"));
      } else if (p.isForStatement() || p.isWhileStatement() || p.isDoWhileStatement()) {
        if (p.node.init)
          p.get("init").isVariableDeclaration()
            ? visit(p.get("init"))
            : this.expr(p.get("init"), env, ctx);
        if (p.node.test) this.expr(p.get("test"), env, ctx);
        visit(p.get("body"));
        if (p.node.update) this.expr(p.get("update"), env, ctx);
      } else if (p.isTryStatement()) {
        visit(p.get("block"));
        const h = p.get("handler");
        if (h.node) {
          this.bind(h.get("param"), this.value(h, env, "caught-error", ctx.host ? 2 : 1), env);
          visit(h.get("body"));
        }
        visit(p.get("finalizer"));
      } else if (p.isSwitchStatement()) {
        const v = this.expr(p.get("discriminant"), env, ctx);
        for (const c of p.get("cases")) for (const s of c.get("consequent")) visit(s);
        returns.push(v);
      } else if (p.isThrowStatement()) {
        const v = this.expr(p.get("argument"), env, ctx);
        v.failing = true;
        returns.push(v);
      }
    };
    if (body.isBlockStatement()) visit(body);
    else returns.push(this.expr(body, env, ctx));
    return returns.length === 1 ? returns[0] : this.join(body, env, returns, "return");
  }
  invoke(fn, args, p, caller, ctx = {}, role = "call") {
    if (!fn?.callable || fn.callable.kind !== "function")
      return this.call(fn, args, p, caller, ctx);
    const { path, env: closure } = fn.callable;
    const ancestor = this.running.find(x => x.fn === fn);
    if (ancestor) {
      args.forEach((arg, i) => ancestor.params[i]?.deps.add(arg));
      this.findings.push({
        at: this.at(p),
        rule: "recursion",
        message:
          "Recursive call reuses its ancestor family; incoming provenance is joined to a fixpoint."
      });
      return ancestor.result;
    }
    const id = `${caller.id}>${p.node.start}:${role}`;
    const cached = this.callCache.get(id);
    if (cached) return cached;
    const env = this.env(closure, id, caller.frame);
    const result = this.value(p, env, "result");
    this.callCache.set(id, result);
    const params = path.get("params").map((q, i) => {
      const v = args[i] ?? this.value(q, env, "argument");
      this.bind(q, v, env);
      return v;
    });
    this.running.push({ fn, params, result });
    const returned = this.statements(path.get("body"), env, ctx);
    this.running.pop();
    result.deps.add(returned);
    result.fields = returned.fields;
    result.callable = returned.callable;
    result.rendered = returned.rendered;
    if (path.node.async) {
      result.pending = true;
      result.async = true;
    }
    return result;
  }
  call(fn, args, p, env, ctx = {}, construct = false) {
    const name = fn?.external?.name;
    const library = ["solid-yield", "solid-yield/h"].includes(fn?.external?.source);
    if (library) {
      if (name === "component") {
        const v = this.value(p, env, "component");
        v.callable = {
          kind: "component",
          fn: args[0],
          name: p.parentPath.node.id?.name ?? args[0]?.path?.node.id?.name ?? "component"
        };
        return v;
      }
      if (name === "view") {
        const v = this.value(p, env, "view");
        v.callable = { kind: "view", fn: args[0] };
        return v;
      }
      if (name === "foreign") {
        const v = this.value(p, env, "foreign-wrapper");
        v.callable = { kind: "foreign", fn: args[0] };
        return v;
      }
      if (name === "createContext") {
        const v = this.value(p, env, "context");
        v.callable = { kind: "context" };
        v.providers = args.length ? [args[0]] : [];
        this.contexts.push(v);
        return v;
      }
      if (cells.has(name)) {
        const cell = this.part(p, env, "cell", [], ctx);
        cell.base = name.startsWith("$optimistic") ? 2 : 0;
        const initial = args[0];
        if (initial?.callable)
          this.jobs.push(() => {
            const reads = new Set();
            cell.deps.add(
              this.invoke(initial, [], p, env, { ...ctx, host: "memo", reads }, "initial")
            );
            for (const r of reads) cell.deps.add(r);
          });
        else if (initial) cell.deps.add(initial);
        const setter = this.value(p, env, "setter");
        setter.callable = { kind: "setter", cell };
        const pair = this.value(p, env, "cell-pair");
        pair.fields.set("0", cell);
        pair.fields.set("1", setter);
        return pair;
      }
      if (name === "$memo") {
        const v = this.part(p, env, "memo", [], ctx);
        this.jobs.push(() => {
          const reads = new Set();
          v.deps.add(this.invoke(args[0], [], p, env, { ...ctx, host: "memo", reads }, "memo"));
          for (const r of reads) v.deps.add(r);
        });
        return v;
      }
      if (name === "$event") {
        const v = this.part(p, env, "event", [], ctx);
        v.base = 2;
        v.callable = { kind: "event", fn: args[0], event: v };
        this.jobs.push(() => {
          const params =
            args[0]?.callable?.path
              .get("params")
              .map(q => this.value(q, env, "event-argument", 2)) ?? [];
          const reads = new Set();
          const out = this.invoke(
            args[0],
            params,
            p,
            env,
            { ...ctx, host: "event", reads, event: v },
            "event-body"
          );
          v.deps.add(out);
          for (const r of reads) v.deps.add(r);
        });
        return v;
      }
      if (name === "$effect") {
        const v = this.part(p, env, "effect", [], ctx);
        v.base = 2;
        this.jobs.push(() => {
          const reads = new Set();
          const computed = this.invoke(
            args[0],
            [],
            p,
            env,
            { ...ctx, host: "compute", reads },
            "compute"
          );
          v.deps.add(computed);
          if (args[1])
            v.deps.add(
              this.invoke(
                args[1],
                [computed],
                p,
                env,
                { ...ctx, host: "effect", reads, event: v },
                "effect-body"
              )
            );
          for (const r of reads) v.deps.add(r);
        });
        return v;
      }
      if (name === "$cleanup") return this.value(p, env, "cleanup");
      if (name === "refresh") {
        const v = this.join(p, env, args, "refresh");
        for (const a of args) {
          a.base = 2;
          a.written = true;
        }
        ctx.event?.deps.add(v);
        return v;
      }
      if (name === "constant") return args[0];
      if (["readStore", "latestOf", "isPendingOf"].includes(name)) {
        const result =
          name === "readStore" && args[1]?.callable
            ? this.invoke(args[1], [args[0]], p, env, ctx, "store-selector")
            : args[0];
        return this.join(p, env, [args[0], result]);
      }
      if (name === "attempt") {
        const result = this.invoke(args[0], [], p, env, ctx, "attempt");
        const v = this.join(p, env, [result], "attempt");
        v.pending = !!(result.pending || result.async || result.base === 1);
        v.failing = true;
        return v;
      }
      if (name === "foreignSource")
        return this.unknown(p, env, "foreign primitive", "foreignSource is always U (Q5)");
      if (name === "raise" || name === "until") {
        const v = this.join(p, env, args);
        v.failing = true;
        v.pending = name === "until";
        return v;
      }
      if (name === "h") {
        const v = this.value(p, env, "h");
        v.callable = { kind: "h", args };
        return v;
      }
      if (flows.has(name) || boundaries.has(name)) return this.control(name, args[0], p, env, ctx);
      if (["render", "hydrate", "renderToString", "renderToStream"].includes(name))
        return this.materialize(args[0], p, env, ctx);
      if (name === "lazy") {
        const v = this.value(p, env, "lazy");
        v.callable = { kind: "lazy", loader: args[0] };
        return v;
      }
    }
    if (fn?.callable) {
      const c = fn.callable;
      if (c.kind === "function") {
        if (
          c.path.node.body.directives?.some(d => d.value.value === "use server") ||
          this.moduleOf.get(c.path.node).server
        ) {
          const v = this.join(p, env, args, "server-call");
          v.pending = true;
          return v;
        }
        return this.invoke(fn, args, p, env, ctx);
      }
      if (c.kind === "h") return this.h(p, env, ctx, c.args);
      if (c.kind === "fragment") {
        const values = c.children.map(v => this.materialize(v, v.path ?? p, env, ctx));
        const out = this.join(p, env, values, "fragment-output");
        out.rendered = true;
        return out;
      }
      if (c.kind === "accessor") return c.value;
      if (c.kind === "component") return this.component(fn, args[0], p, env, ctx);
      if (c.kind === "view") return this.invoke(c.fn, [], p, env, ctx, "view");
      if (c.kind === "setter") {
        c.cell.base = 2;
        c.cell.written = true;
        ctx.event?.deps.add(c.cell);
        return this.join(p, env, [c.cell, ...args], "write");
      }
      if (c.kind === "event") {
        ctx.event?.deps.add(c.event);
        return c.event;
      }
      if (c.kind === "provide") {
        const value = args[0]?.fields.get("value");
        if (value) c.context.providers.push(value);
        const anchor = this.node(p, env, ctx, "provider");
        const part = this.part(p, env, "provide", [value], { ...ctx, dom: anchor });
        part.context = c.context;
        return this.materialize(args[0]?.fields.get("children"), p, env, { ...ctx, dom: anchor });
      }
      if (c.kind === "foreign") return this.foreign(c.fn, args[0], p, env, ctx);
      if (c.kind === "query") {
        const v = this.unknown(
          p,
          env,
          "router query",
          "Router query cache/RPC remains U under C0 §2.2"
        );
        args.forEach(a => v.deps.add(a));
        v.pending = true;
        return v;
      }
      if (c.kind === "router") {
        const anchor = this.node(p, env, ctx, "foreign");
        const foreign = this.part(
          p,
          env,
          "foreign",
          [
            this.unknown(
              p,
              env,
              "foreign primitive",
              "Client router controls route ownership and navigation"
            )
          ],
          { ...ctx, dom: anchor }
        );
        foreign.foreignOwner = true;
        const output = [];
        for (const route of c.routes?.fields.values() ?? []) {
          const target = route.fields.get("component");
          if (!target) continue;
          const props = this.unknown(
            target.path ?? p,
            env,
            "route props",
            "Router supplies params and navigation props"
          );
          output.push(this.call(target, [props], target.path ?? p, env, { ...ctx, dom: anchor }));
        }
        const children = this.join(p, env, output, "route-output");
        children.rendered = true;
        const props = this.value(p, env, "router-props");
        props.fields.set("children", children);
        for (const child of args[0]?.fields.get("children")?.fields.values() ?? [])
          output.push(this.materialize(child, p, env, { ...ctx, dom: anchor }, [props]));
        return this.join(p, env, output, "rendered");
      }
      if (c.kind === "lazy") {
        // Literal imports are followed statically; no module is executed.
        const loader = c.loader?.callable?.path;
        const imports = [];
        loader?.traverse({
          CallExpression: q => {
            if (q.node.callee.type === "Import" && q.node.arguments[0]?.type === "StringLiteral")
              imports.push(q.node.arguments[0].value);
          }
        });
        if (imports.length === 1) {
          const id = this.resolve(imports[0], this.moduleOf.get(loader.node).id);
          const comp = this.exported(id, "default", p, env);
          return this.call(comp, args, p, env, ctx);
        }
        return this.unknown(p, env, "foreign primitive", "Non-literal lazy import");
      }
    }
    if (fn?.external?.source === "@solidjs/router") {
      if (name === "query") {
        const v = this.value(p, env, "query");
        v.callable = { kind: "query" };
        return v;
      }
      if (name === "defineRoute" || name === "defineRoutes") return args[0];
      if (name === "createRouter") {
        const v = this.value(p, env, "router");
        v.callable = { kind: "router", routes: args[0]?.fields.get("routes") };
        return v;
      }
    }
    const global = fn?.global;
    if (pure.has(global) || (fn?.method && methods.has(fn.method))) {
      const values = [fn?.receiver, ...args.filter(a => !a.callable)];
      for (const arg of args)
        if (arg.callable)
          values.push(
            this.invoke(
              arg,
              [fn.receiver ?? args[0], fn.receiver ?? args[0]],
              p,
              env,
              ctx,
              `callback:${args.indexOf(arg)}`
            )
          );
      return this.join(p, env, values, "pure-call");
    }
    if (global === "Date.now" || global === "Math.random" || global === "performance.now")
      return this.value(p, env, "client-clock", 2);
    if (timers.has(global)) {
      const v = this.part(p, env, "timer", args, ctx);
      v.base = 2;
      if (!ctx.host || ctx.host === "setup") {
        v.eager = true;
        this.findings.push({
          at: this.at(p),
          rule: "1.7",
          message: `${global} starts work in setup; eager without $effect`
        });
      }
      if (args[0]?.callable)
        this.jobs.push(() =>
          this.call(args[0], [this.value(p, env, "timer-argument", 2)], p, env, {
            ...ctx,
            host: "timer",
            event: v
          })
        );
      return v;
    }
    if (
      /^(clearInterval|clearTimeout|cancelAnimationFrame|cancelIdleCallback)$/.test(global ?? "") ||
      /\.(addEventListener|removeEventListener)$/.test(global ?? "")
    ) {
      const v = this.join(p, env, args, "browser-effect");
      v.base = 2;
      ctx.event?.deps.add(v);
      return v;
    }
    if (
      global === "Promise" ||
      /\.(then|catch|finally)$/.test(global ?? "") ||
      ["then", "catch", "finally"].includes(fn?.method)
    ) {
      const v = this.unknown(
        p,
        env,
        "plain function call",
        "Non-server promise; completion can change the client view"
      );
      v.pending = true;
      for (const a of args.filter(a => !a.callable)) v.deps.add(a);
      if (fn.receiver) v.deps.add(fn.receiver);
      return v;
    }
    if (
      construct &&
      (fn?.class ||
        ["Error", "TypeError", "Date", "Set", "Map", "AbortController"].includes(global))
    ) {
      const v = this.join(p, env, args, "instance");
      v.nonserializable = !["Date", "Set", "Map"].includes(global);
      return v;
    }
    if (fn?.method && ["push", "splice", "set", "delete", "add"].includes(fn.method)) {
      const v = this.join(p, env, [fn.receiver, ...args]);
      if (ctx.host === "event") fn.receiver.base = 2;
      return v;
    }
    if (ctx.host === "event" || ctx.host === "effect" || ctx.host === "timer") {
      // The invocation is client by host, but follow arguments to preserve calls/writes.
      const v = this.join(p, env, [fn, ...args], "client-call");
      v.base = 2;
      return v;
    }
    const foreign = !!fn?.external;
    const v = this.unknown(
      p,
      env,
      foreign ? "foreign primitive" : "plain function call",
      foreign ? `External ${fn.external.source}:${name}` : "Unresolved callable",
      foreign ? "genuine" : "blind spot",
      foreign
        ? "Foreign output is U under C0 §1.2; its owner stays client."
        : "Resolve the callable and substitute its arguments and captured values."
    );
    v.deps.add(fn);
    for (const a of args.filter(a => !a.callable)) v.deps.add(a);
    return v;
  }
  materialize(v, p, env, ctx, args = []) {
    if (!v) return this.value(p, env, "empty");
    const seen = new Set();
    while (
      v?.callable &&
      !["event", "setter", "context"].includes(v.callable.kind) &&
      !seen.has(v)
    ) {
      seen.add(v);
      v = this.call(v, args, v.path ?? p, env, ctx);
    }
    return v;
  }
  component(comp, props, p, env, ctx) {
    const c = comp.callable;
    const ancestor = this.running.find(x => x.component === comp);
    if (ancestor) {
      if (props)
        for (const [name, v] of props.fields) {
          if (ancestor.props.fields.has(name)) ancestor.props.fields.get(name).deps.add(v);
          else ancestor.props.fields.set(name, v);
        }
      ancestor.frame.recursive = true;
      this.findings.push({
        at: this.at(p),
        rule: "recursion",
        message: `${c.name}: recursive family widened, not a dynamic instance count`
      });
      return ancestor.result;
    }
    const id = `${env.id}>component:${p.node.start}`;
    if (this.callCache.has(id)) return this.callCache.get(id);
    const frame = {
      id,
      name: c.name,
      at: comp.at,
      call: this.at(p),
      parent: env.frame,
      recursive: false
    };
    const child = this.env(c.fn.callable.env, id, frame);
    const anchor = this.node(p, child, ctx, "component");
    frame.anchor = anchor;
    this.frames.push(frame);
    const input = props ?? this.value(p, child, "props");
    const result = this.value(p, child, "component-output");
    result.rendered = true;
    this.callCache.set(id, result);
    this.running.push({ component: comp, props: input, frame, result });
    const setup = this.invoke(
      c.fn,
      [input],
      p,
      child,
      { ...ctx, dom: anchor, host: "setup" },
      "setup"
    );
    const rendered = this.materialize(setup, p, child, { ...ctx, dom: anchor, host: "view" });
    result.deps.add(rendered);
    this.running.pop();
    return result;
  }
  node(p, env, ctx, kind) {
    const id = `${env.id}:${p.node.start}:dom:${kind}`;
    const old = this.dom.find(n => n.id === id);
    if (old) return old;
    const n = {
      id,
      at: this.at(p),
      path: p,
      kind,
      parent: ctx.dom ?? null,
      frame: env.frame,
      children: []
    };
    n.parent?.children.push(n);
    this.dom.push(n);
    return n;
  }
  hole(p, v, env, ctx, bind = false) {
    if (v.callable && !["event", "setter"].includes(v.callable.kind))
      v = this.materialize(v, p, env, { ...ctx, host: "hole" });
    const out = this.part(p, env, bind ? "bind" : "hole", [v], ctx);
    if (bind) out.base = 2;
    out.structural = v.rendered === true;
    return out;
  }
  jsx(p, env, ctx) {
    const fragment = p.isJSXFragment();
    const tag = !fragment && p.get("openingElement.name");
    const name = tag && (tag.isJSXIdentifier() ? tag.node.name : tag.toString());
    const native = fragment || /^[a-z]/.test(name);
    const node = this.node(p, env, ctx, fragment ? "fragment" : native ? "element" : "foreign");
    const sub = { ...ctx, dom: node };
    const props = this.value(p, env, "jsx-props"),
      values = [];
    if (!fragment)
      for (const attr of p.get("openingElement.attributes")) {
        if (attr.isJSXSpreadAttribute()) {
          const v = this.expr(attr.get("argument"), env, sub);
          for (const [k, x] of v.fields) props.fields.set(k, x);
          values.push(this.hole(attr, v, env, sub));
          continue;
        }
        const q = attr.get("value");
        if (!q.node) continue;
        const v = this.expr(q, env, sub),
          name = key(attr.node.name);
        props.fields.set(name, v);
        if (native && !q.isStringLiteral())
          values.push(this.hole(q, v, env, sub, /^on[A-Z]/.test(name)));
      }
    const children = this.value(p, env, "jsx-children");
    for (const [i, q] of p.get("children").entries()) {
      const v = this.expr(q, env, sub);
      children.fields.set(String(i), v);
      if (
        native &&
        q.isJSXExpressionContainer() &&
        !q.get("expression").isJSXEmptyExpression() &&
        !q.get("expression").isLiteral()
      )
        values.push(this.hole(q, v, env, sub));
      else values.push(v);
    }
    props.fields.set("children", children);
    if (!native) {
      // JSX names have bindings but are not Identifier paths.
      const b = tag.scope.getBinding(name);
      const target = b ? this.identifier(tag, env) : null;
      values.push(
        target?.callable?.kind === "router"
          ? this.call(target, [props], p, env, sub)
          : this.foreign(target, props, p, env, sub)
      );
    }
    const result = this.join(p, env, values, "markup");
    result.rendered = true;
    node.value = result;
    return result;
  }
  foreign(target, props, p, env, ctx) {
    const anchor = this.node(p, env, ctx, "foreign-owner");
    const v = this.part(
      p,
      env,
      "foreign",
      [
        this.unknown(p, env, "foreign primitive", "Foreign component owns this subtree (C0 §1.3.5)")
      ],
      { ...ctx, dom: anchor }
    );
    v.foreignOwner = true;
    const values = [v];
    if (target?.callable) values.push(this.call(target, [props], p, env, { ...ctx, dom: anchor }));
    for (const child of props?.fields.get("children")?.fields.values() ?? [])
      values.push(this.materialize(child, p, env, { ...ctx, dom: anchor }));
    const result = this.join(p, env, values, "foreign-output");
    result.rendered = true;
    return result;
  }
  control(name, props, p, env, ctx) {
    const anchor = this.node(p, env, ctx, flows.has(name) ? "flow" : "boundary");
    const source =
      props?.fields.get("when") ??
      props?.fields.get("each") ??
      props?.fields.get("count") ??
      props?.fields.get("on");
    const input = source?.callable
      ? this.materialize(source, p, env, { ...ctx, dom: anchor })
      : source;
    const part = this.part(p, env, flows.has(name) ? "flow" : "boundary", input ? [input] : [], {
      ...ctx,
      dom: anchor
    });
    if (input) this.hole(source.path ?? p, input, env, { ...ctx, dom: anchor });
    const values = [];
    for (const field of ["children", "fallback"]) {
      const child = props?.fields.get(field);
      if (!child) continue;
      const arg =
        input ??
        this.value(
          p,
          env,
          field === "fallback" ? "boundary-error" : "control-input",
          field === "fallback" ? 2 : 0
        );
      const reset = this.value(p, env, "reset", 2);
      if (field === "fallback" && name === "Errored") {
        const accessor = this.value(p, env, "error-accessor");
        accessor.callable = { kind: "accessor", value: arg };
        values.push(
          this.materialize(child, child.path ?? p, env, { ...ctx, dom: anchor, host: "view" }, [
            accessor,
            reset
          ])
        );
        continue;
      }
      values.push(
        this.materialize(child, child.path ?? p, env, { ...ctx, dom: anchor, host: "view" }, [
          arg,
          reset
        ])
      );
    }
    const result = this.join(p, env, values, "control-output");
    result.rendered = true;
    anchor.value = result;
    return result;
  }
  h(p, env, ctx, args) {
    const [tag, props, ...children] = args;
    if (tag?.kind === "array") {
      const out = this.join(
        p,
        env,
        [...tag.fields.values()].map(v => this.materialize(v, v.path ?? p, env, ctx)),
        "h-fragment"
      );
      out.rendered = true;
      return out;
    }
    if (tag?.known && typeof tag.literal === "string") {
      const anchor = this.node(p, env, ctx, "element"),
        values = [];
      for (const [name, v] of props?.fields ?? [])
        if (!v.known)
          values.push(
            this.hole(v.path ?? p, v, env, { ...ctx, dom: anchor }, /^on[A-Z]/.test(name))
          );
      for (const v of children)
        values.push(v.rendered ? v : this.hole(v.path ?? p, v, env, { ...ctx, dom: anchor }));
      const out = this.join(p, env, values, "h-output");
      out.rendered = true;
      anchor.value = out;
      return out;
    }
    const input = props ?? this.value(p, env, "h-props");
    if (children.length) {
      const child = this.value(p, env, "h-children");
      child.callable = { kind: "fragment", children };
      input.fields.set("children", child);
    }
    return this.call(tag, [input], p, env, ctx);
  }
}
