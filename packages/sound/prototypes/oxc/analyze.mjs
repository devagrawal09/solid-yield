// @ts-check
import { BY_CODE } from "../../src/codes.mjs";
import {
  Env,
  plain,
  unknown,
  object,
  join,
  each,
  globalValue,
  keyName,
  unwrap,
  walk
} from "./graph.mjs";

const uniq = values => [...new Set(values)];
const fnTypes = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
const callbackMethods = new Set([
  "map",
  "filter",
  "find",
  "findIndex",
  "some",
  "every",
  "forEach",
  "reduce",
  "flatMap",
  "sort"
]);
const scalarMethods = new Set([
  "trim",
  "toUpperCase",
  "toLowerCase",
  "includes",
  "startsWith",
  "endsWith",
  "slice",
  "substring",
  "split",
  "replace",
  "replaceAll",
  "charAt",
  "indexOf",
  "lastIndexOf",
  "join",
  "concat",
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "reverse",
  "at",
  "toString",
  "toFixed",
  "toLocaleString",
  "match",
  "test"
]);
export class Analysis {
  constructor(graph) {
    this.graph = graph;
    this.diagnostics = [];
    this.keys = new Set();
    this.inference = new Map();
    this.worstSites = new Map();
    this.nodes = [];
    this.facts = new Map();
    this.called = new Set();
    this.components = new Set();
    this.active = new Map();
    this.roots = [];
    this.escapes = [];
  }
  context(extra = {}) {
    return {
      scope: "module",
      owner: null,
      path: [],
      providers: [],
      loading: false,
      errored: false,
      sink: [],
      reads: [],
      ...extra
    };
  }
  event(kind, node, data = {}) {
    this.nodes.push({ kind, loc: this.graph.loc(node), ...data });
  }
  needed(node, reason) {
    const loc = this.graph.loc(node);
    this.inference.set(loc.file + ":" + node?.start + ":" + reason, { loc, reason });
  }
  worstSite(node, reason) {
    const loc = this.graph.loc(node);
    const key = loc.file + ":" + node?.start + ":" + node?.end;
    const previous = this.worstSites.get(key);
    this.worstSites.set(key, { loc, reasons: uniq([...(previous?.reasons ?? []), reason]) });
  }
  emit(code, node, c, related = [], data = {}) {
    if (!node) return;
    if (
      c?.mode === "export" &&
      ["ASYNC_OUTSIDE_LOADING_BOUNDARY", "ERROR_OUTSIDE_ERRORED_BOUNDARY"].includes(code)
    ) {
      c.exported.push({ code, node, data });
      return;
    }
    const entry = BY_CODE[code];
    const loc = this.graph.loc(node);
    const key = [code, loc.file, loc.line, loc.col].join(":");
    if (this.keys.has(key)) return;
    this.keys.add(key);
    const allRelated = [...(c?.related ?? []), ...related];
    this.diagnostics.push({
      code,
      kind: entry.kind,
      severity: entry.severity,
      message: entry.meaning + " " + entry.fix,
      loc,
      ownerName: c?.owner,
      ownerPath: c?.path,
      related: allRelated.map(n => ({
        message: "Related caller or root.",
        loc: this.graph.loc(n)
      })),
      data
    });
  }
  partial(node, c, reason) {
    this.worstSite(node, reason);
    this.emit("UNANALYZED_BOUNDARY", node, c, [], { construct: reason });
    this.needed(node, reason);
    this.event("boundary", node, { reason });
    return { tag: "worst", reason };
  }
  fail(failures, node, c) {
    if (!failures?.length || c.scope === "module") return;
    if (c.caught) {
      c.caught.push(...failures);
      return;
    }
    if (c.capture) {
      c.capture.failures.push(...failures);
      return;
    }
    if (c.asyncRejections) {
      c.asyncRejections.push(...failures);
      return;
    }
    if (c.scope === "handler" || c.scope === "ref") {
      c.sink.push(...failures);
      return;
    }
    if (c.scope === "setup")
      this.emit("SETUP_MAY_THROW", node, c, [], { failures: uniq(failures) });
    else if (!c.errored)
      this.emit("ERROR_OUTSIDE_ERRORED_BOUNDARY", node, c, [], { failures: uniq(failures) });
  }
  read(value, node, c, related = []) {
    // Ref failure/write rules stay detached; only its read scope is setup-like.
    const scope = c.scope === "ref" ? "setup" : c.scope;
    this.event("read", node, { scope, pending: !!value.pending });
    if (c.owner) {
      const fact = this.facts.get(c.owner + "@" + this.graph.loc(node).file);
      fact?.reads.push({
        loc: this.graph.loc(node),
        scope: scope === "module" ? "setup" : scope,
        source: "accessor"
      });
      if (fact) {
        fact.pending ||= !!value.pending;
        fact.failures = uniq([...fact.failures, ...(value.failures ?? [])]);
      }
    }
    if (c.capture) {
      c.capture.reactive = true;
      c.capture.pending ||= value.pending;
      c.capture.failures.push(...(value.failures ?? []));
      c.capture.related.push(...related);
      return;
    }
    const next = { ...c, related: [...(c.related ?? []), ...related] };
    if (!c.untracked) {
      if (scope === "setup" || (scope === "effect" && !value.pending))
        this.emit(
          value.pending ? "PENDING_ASYNC_UNTRACKED_READ" : "STRICT_READ_UNTRACKED",
          node,
          next
        );
      if (value.pending && scope === "effect")
        this.emit("PENDING_ASYNC_FORBIDDEN_SCOPE", node, next);
      if (value.pending && scope === "handler") this.emit("PENDING_ASYNC_IN_HANDLER", node, next);
      if (value.pending && scope === "tracking" && !c.loading)
        this.emit("ASYNC_OUTSIDE_LOADING_BOUNDARY", node, next);
    }
    this.fail(value.failures, node, next);
  }
  dropped(value, node, c) {
    each(value, v => {
      if (v.tag === "promise" && !v.handled) this.fail(v.rejects, node, { ...c, caught: null });
      return v;
    });
  }
  capture(c, fn) {
    const cap = { reactive: false, pending: false, failures: [], related: [] };
    const value = fn({ ...c, scope: "tracking", capture: cap, caught: null });
    return { value, cap };
  }
  deref(value) {
    if (value?.tag !== "link") return value;
    const v = value;
    if (["solid-js", "@solidjs/signals", "@solidjs/web"].includes(v.pkg))
      return v.name === "*"
        ? { tag: "namespace", link: v }
        : { tag: "solid", name: v.name, pkg: v.pkg };
    if (!v.path) return unknown("unresolved import " + v.spec);
    const mod = this.graph.load(v.path);
    if (mod.blocked)
      return { tag: "dependencyUnknown", reason: "installed dependency has no declaration" };
    this.initialize(mod);
    if (v.name === "*") return { tag: "module", mod };
    return this.exportValue(mod, v.name, new Set());
  }
  exportValue(mod, name, seen) {
    const key = mod.path + ":" + name;
    if (seen.has(key)) return unknown("cyclic export");
    seen.add(key);
    if (mod.blocked)
      return { tag: "dependencyUnknown", reason: "installed dependency has no declaration" };
    const entry = mod.exports.get(name);
    if (entry?.local) return this.deref(mod.env.get(entry.local) ?? unknown("unresolved export"));
    if (entry?.declaration) {
      entry.value ??=
        mod.env.get(entry.declaration.id?.name) ??
        (mod.declarationOnly
          ? this.graph.shape(entry.declaration, mod.env)
          : this.eval(entry.declaration, mod.env, this.context()));
      return entry.value;
    }
    if (entry?.pkg && ["solid-js", "@solidjs/signals", "@solidjs/web"].includes(entry.pkg))
      return this.deref({ tag: "link", ...entry });
    if (entry?.path) {
      const next = this.graph.load(entry.path);
      this.initialize(next);
      return this.exportValue(next, entry.name, seen);
    }
    for (const [n, e] of mod.exports)
      if (n.startsWith("*") && e.path) {
        if (["solid-js", "@solidjs/signals", "@solidjs/web"].includes(e.pkg))
          return this.deref({ tag: "link", ...e, name });
        const next = this.graph.load(e.path);
        this.initialize(next);
        const result = this.exportValue(next, name, seen);
        if (result.tag !== "unknown") return result;
      }
    return unknown("export without a body");
  }
  initialize(mod) {
    if (mod.state !== "new") return;
    mod.state = "loading";
    if (mod.declarationOnly) {
      for (const s of mod.ast.body) {
        const n = s.declaration ?? s;
        if (["TSDeclareFunction", "FunctionDeclaration"].includes(n.type) && n.id)
          mod.env.define(n.id.name, this.graph.shape(n, mod.env), n);
        if (n.type === "VariableDeclaration")
          for (const d of n.declarations)
            this.bind(d.id, this.annotation(d.id, mod.env), mod.env, this.context());
      }
      mod.state = "done";
      return;
    }
    this.hoist(mod.ast.body, mod.env);
    for (const statement of mod.ast.body) {
      if (statement.type === "ImportDeclaration") continue;
      this.statement(statement, mod.env, this.context());
    }
    mod.state = "done";
  }
  closure(node, env) {
    const value = { tag: "function", node, env, name: node.id?.name ?? "", component: false };
    let jsx = false;
    walk(node.body, n => {
      if (n.type === "JSXElement" || n.type === "JSXFragment") jsx = true;
    });
    value.component = jsx && /^[A-Z]/.test(value.name);
    if (value.component) this.components.add(value);
    return value;
  }
  hoist(statements, env) {
    for (const s of statements ?? []) {
      const n = s.declaration ?? s;
      if (n.type === "FunctionDeclaration") env.define(n.id.name, this.closure(n, env), n);
      if (n.type === "TSDeclareFunction") env.define(n.id.name, this.graph.shape(n, env), n);
    }
  }
  bind(pattern, value, env, c) {
    if (!pattern) return;
    if (pattern.type === "Identifier") {
      env.define(pattern.name, value, pattern);
      return;
    }
    if (pattern.type === "AssignmentPattern") {
      this.bind(
        pattern.left,
        each(value, v =>
          v.tag === "plain" && v.value === undefined ? this.eval(pattern.right, env, c) : v
        ),
        env,
        c
      );
      return;
    }
    if (pattern.type === "RestElement") {
      this.bind(pattern.argument, value, env, c);
      return;
    }
    if (pattern.type === "ArrayPattern")
      pattern.elements.forEach((p, i) =>
        this.bind(p, this.member(value, String(i), p, env, c), env, c)
      );
    if (pattern.type === "ObjectPattern")
      for (const p of pattern.properties) {
        if (p.type === "RestElement") this.bind(p.argument, value, env, c);
        else this.bind(p.value, this.member(value, keyName(p.key), p, env, c), env, c);
      }
  }
  annotation(pattern, env) {
    return this.graph.shape(pattern?.typeAnnotation, env);
  }
  functionCall(fn, args, node, c) {
    if (fn.tag !== "function") return this.call(fn, args, node, c);
    this.called.add(fn);
    const count = this.active.get(fn.node) ?? 0;
    if (count > 8) return this.partial(node, c, "recursive call needs a wider summary");
    this.active.set(fn.node, count + 1);
    const env = new Env(fn.env);
    if (fn.thisValue) env.define("this", fn.thisValue, fn.node);
    const sink = [];
    const returns = [];
    const next = {
      ...c,
      returns,
      sink: fn.node.async ? sink : c.sink,
      asyncRejections: fn.node.async ? sink : c.asyncRejections
    };
    // Async setup prefixes remain setup in this slice; handlers remain handlers.
    for (let i = 0; i < fn.node.params.length; i++) {
      const p = fn.node.params[i];
      let arg = args[i];
      // Callback props carry the body failure set, not a per-literal specialization.
      if (fn.callbackProp && arg?.tag === "plain")
        arg = { ...plain(), primitive: typeof arg.value };
      if (!arg) arg = p.typeAnnotation ? this.annotation(p, env) : plain();
      this.bind(p, arg, env, next);
    }
    if (fn.node.body?.type === "BlockStatement") {
      this.hoist(fn.node.body.body, env);
      this.block(fn.node.body.body, env, next);
    } else returns.push(this.eval(fn.node.body, env, next));
    let result = returns.length ? join(...returns) : { ...plain(), undefinedValue: true };
    if (fn.node.async) {
      const rejected = [...sink];
      if (result.tag === "promise") rejected.push(...result.rejects);
      if (c.capture) rejected.push(...c.capture.failures);
      result = {
        tag: "promise",
        rejects: uniq(rejected),
        result: result.tag === "promise" ? result.result : result
      };
    }
    this.active.set(fn.node, count);
    return result;
  }
  runHandler(fn, node, c, args = [], scope = "handler") {
    const sink = [];
    const next = { ...c, scope, capture: null, caught: null, sink };
    const value = this.call(fn, args, node, next);
    this.dropped(value, node, next);
    if (sink.length) this.emit("UNHANDLED_HANDLER_FAILURE", node, c, [], { failures: uniq(sink) });
  }
  component(fn, props, node, c) {
    if (fn.tag !== "function") {
      const v = this.partial(node, c, "dynamic component");
      this.read({ pending: true, failures: ["unknown"] }, node, c);
      return v;
    }
    fn.component = true;
    this.components.add(fn);
    const name = "<" + (fn.name || fn.node.id?.name || "Component") + ">";
    const factKey = name + "@" + this.graph.loc(fn.node).file;
    if (!this.facts.has(factKey))
      this.facts.set(factKey, {
        component: name,
        file: this.graph.loc(fn.node).file,
        pending: false,
        failures: [],
        reads: [],
        boundaries: [],
        unanalyzed: []
      });
    const next = { ...c, scope: "setup", owner: name, path: [...c.path, name] };
    this.event("component", node, { name });
    return this.functionCall(fn, [props], node, next);
  }
  member(value, key, node, env, c) {
    return each(this.deref(value), v => {
      if (v.tainted) {
        const previous = v.members?.get(key);
        if (previous?.tag === "source")
          return {
            tag: "source",
            pending: true,
            failures: ["unknown"],
            result: unknown("escaped accessor result")
          };
        return { tag: "unknownMethod", reason: "escaped context member" };
      }
      if (v.tag === "merged") return this.mergedMember(v.sources, key, node, env, c);
      if (v.tag === "object" || v.tag === "props") {
        const entry = v.members.get(key);
        if (entry?.tag === "thunk") {
          const { value: out, cap } = this.capture(c, cc =>
            this.eval(entry.node, entry.env, {
              ...entry.context,
              ...cc,
              providers: entry.context.providers
            })
          );
          if (cap.reactive || cap.pending || cap.failures.length)
            this.read({ pending: cap.pending, failures: uniq(cap.failures) }, node, c, [
              entry.node,
              ...cap.related
            ]);
          return out.tag === "function" ? { ...out, callbackProp: true } : out;
        }
        if (entry?.tag === "getter") return this.functionCall(entry.fn, [], node, c);
        return (
          entry ??
          (v.tag === "props" && !v.closed
            ? this.propFallback(v, key, env, node, c)
            : { ...plain(), undefinedValue: true })
        );
      }
      if (v.tag === "array") {
        if (/^[0-9]+$/.test(key)) return v.elements[Number(key)] ?? v.elements[0] ?? plain();
        if (key === "length") return plain();
        return { tag: "method", receiver: v, key };
      }
      if (v.tag === "namespace") return this.deref({ ...v.link, name: key });
      if (v.tag === "module") return this.exportValue(v.mod, key, new Set());
      if (v.tag === "platform" || v.tag === "platformInstance")
        return { tag: "platform", path: v.path + "." + key, receiver: v };
      if (v.tag === "promise") return { tag: "method", receiver: v, key };
      if (v.tag === "worst") return { tag: "unknownMethod", reason: v.reason };
      if (v.tag === "unknownMethod" || v.tag === "dependencyUnknown") return v;
      if (v.tag === "plain" && typeof v.value === "string")
        return { tag: "method", receiver: { tag: "platformInstance", path: "String" }, key };
      if (v.tag === "plain")
        return scalarMethods.has(key) &&
          ["string", "number", "boolean"].includes(v.primitive ?? typeof v.value)
          ? { tag: "method", receiver: v, key }
          : unknown("member shape needs inference");
      if (v.tag === "sourceValue") return { tag: "method", receiver: v, key };
      this.needed(node, "member shape needs inference");
      return unknown("member shape needs inference");
    });
  }
  mergedMember(sources, key, node, env, c) {
    if (!sources.length) return { ...plain(), undefinedValue: true };
    const fallback = () => this.mergedMember(sources.slice(0, -1), key, node, env, c);
    return each(sources[sources.length - 1], source => {
      if (source.tag === "object" || source.tag === "props") {
        if (!source.members.has(key) && (source.tag === "object" || source.closed))
          return fallback();
        const value = source.members.has(key)
          ? this.member(source, key, node, env, c)
          : each(source.shape, shape =>
              shape.tag === "object"
                ? (shape.members.get(key) ?? { ...plain(), undefinedValue: true })
                : shape.undefinedValue
                  ? shape
                  : this.partial(node, c, "merge source shape needs inference")
            );
        return each(value, entry => (entry.undefinedValue ? fallback() : entry));
      }
      if (source.tag === "merged")
        return each(this.member(source, key, node, env, c), entry =>
          entry.undefinedValue ? fallback() : entry
        );
      return join(fallback(), this.partial(node, c, "merge source shape needs inference"));
    });
  }
  propFallback(props, key, env, node, c) {
    const shape = props.shape;
    if (shape?.tag === "object" && shape.members.has(key)) return shape.members.get(key);
    if (shape?.tag === "union")
      return each(shape, s => (s.tag === "object" ? (s.members.get(key) ?? plain()) : plain()));
    return plain();
  }

  call(value, args, node, c) {
    return each(this.deref(value), fn => {
      if (fn.tag === "optionalMissing" || (node.optional && fn.undefinedValue))
        return { ...plain(), undefinedValue: true };
      if (fn.tag === "function") return this.functionCall(fn, args, node, c);
      if (fn.tag === "solid") return this.solid(fn.name, args, node, c);
      if (fn.tag === "setter") {
        if (c.scope === "ref")
          return this.partial(
            c.refNode ?? node,
            c,
            "reactive write in ref: ownership is not modeled"
          );
        if (["setup", "tracking"].includes(c.scope))
          this.emit("REACTIVE_WRITE_IN_OWNED_SCOPE", node, c);
        this.event("write", node);
        if (args[0]?.tag === "function")
          this.call(args[0], [plain()], node, { ...c, untracked: true });
        return plain();
      }
      if (fn.tag === "source") {
        if (fn.compute && !fn.evaluating) {
          fn.evaluating = true;
          const { value: out, cap } = this.capture(c, cc =>
            this.call(fn.compute, [], node, { ...cc, providers: fn.context.providers })
          );
          fn.pending ||= cap.pending;
          fn.failures = uniq([...fn.failures, ...cap.failures]);
          each(out, v => {
            if (v.tag === "promise") {
              fn.pending = true;
              fn.failures = uniq([...fn.failures, ...v.rejects]);
            }
            return v;
          });
          fn.evaluating = false;
        }
        this.read(fn, node, c);
        return fn.result ?? plain();
      }
      if (fn.tag === "safe") return fn.result ?? plain();
      if (fn.tag === "rejector") {
        fn.rejected.push(args[0]?.error ?? "unknown");
        return plain();
      }
      if (fn.tag === "declared") {
        for (const arg of args)
          if (arg.tag === "object" && arg.service) {
            this.partial(node, c, "context passed to unknown code");
            arg.tainted = true;
          }
        this.needed(node, "function annotation supplies no failure facts");
        this.worstSite(node, "unknown declared failures");
        if (fn.result?.tag === "promise") return { ...fn.result, rejects: ["unknown"] };
        this.fail(["unknown"], node, c);
        return fn.result ?? unknown();
      }
      if (fn.tag === "unknownMethod") {
        this.needed(node, "unknown method has no failure or result facts");
        this.worstSite(node, fn.reason);
        this.fail(["unknown"], node, c);
        return { tag: "worst", reason: fn.reason };
      }
      if (fn.tag === "dependencyUnknown") {
        this.partial(node, c, fn.reason);
        this.fail(["unknown"], node, c);
        return fn;
      }
      if (fn.tag === "platform") return this.platform(fn, args, node, c);
      if (fn.tag === "method") return this.method(fn, args, node, c);
      if (fn.tag === "worst") {
        this.worstSite(node, fn.reason);
        this.read({ pending: true, failures: ["unknown"] }, node, c);
        return { tag: "worst", reason: fn.reason };
      }
      if (fn.tag === "plain") {
        this.needed(node, "callable shape needs inference");
        this.worstSite(node, "unknown callable");
        this.fail(["unknown"], node, c);
        return unknown("call result needs inference");
      }
      for (const arg of args)
        if (arg.tag === "object" && arg.service) {
          this.partial(node, c, "context passed to unknown code");
          arg.tainted = true;
        }
      this.needed(node, "call needs inference or an analyzable body");
      this.worstSite(node, "unknown callable");
      this.fail(["unknown"], node, c);
      return unknown("call result");
    });
  }
  solid(name, args, node, c) {
    if (name === "render") {
      this.roots.push({ fn: args[0], node });
      return plain();
    }
    if (name === "createContext") return { tag: "context", defaultValue: args[0], node };
    if (name === "merge") return { tag: "merged", sources: args };
    if (name === "useContext") {
      const context = args[0];
      const provider = [...c.providers].reverse().find(p => p.context === context);
      const value = provider?.value ?? context.defaultValue;
      return each(value ?? { ...plain(), undefinedValue: true }, v => {
        if (v.undefinedValue) {
          this.emit("CONTEXT_PROVIDER_MISSING", node, c);
          return object();
        }
        if (v.tag === "object") v.service = true;
        return v;
      });
    }
    if (c.scope === "ref" && ["createSignal", "createMemo", "createAsync"].includes(name))
      return this.partial(node, c, "primitive creation in ref: ownership is not modeled");
    if (name === "createSignal") {
      if (c.scope === "module" || args[0]?.tag === "function") {
        const worst = this.partial(
          node,
          c,
          c.scope === "module" ? "module reactive state" : "derived signal"
        );
        return { tag: "array", elements: [worst, { tag: "setter" }] };
      }
      return {
        tag: "array",
        elements: [
          {
            tag: "source",
            pending: false,
            failures: [],
            result:
              args[0]?.tag === "plain"
                ? { ...plain(), primitive: typeof args[0].value }
                : (args[0] ?? plain())
          },
          { tag: "setter" }
        ]
      };
    }
    if (name === "createStore" || name === "createOptimisticStore")
      return {
        tag: "array",
        elements: [
          this.partial(node, c, "Solid " + name + " is outside the modeled subset"),
          { tag: "declared", result: plain() }
        ]
      };
    if (name === "createMemo" || name === "createAsync") {
      const { value, cap } = this.capture(c, cc =>
        this.call(args[0], [], node, { ...cc, scope: "tracking" })
      );
      let pending = cap.pending || name === "createAsync";
      const failures = [...cap.failures];
      let result = value;
      each(value, v => {
        if (v.tag === "promise") {
          pending = true;
          failures.push(...v.rejects);
          result = v.result;
        } else if (["worst", "unknown", "dependencyUnknown"].includes(v.tag)) {
          // An opaque return can be a promise. The method call alone is not a
          // reactive read, but exposing it through a memo creates an accessor.
          pending = true;
          failures.push("unknown");
        }
        return v;
      });
      this.event("source", node, { pending, failures: uniq(failures) });
      return {
        tag: "source",
        pending,
        failures: uniq(failures),
        result,
        compute: args[0],
        context: c
      };
    }
    if (name === "untrack") {
      // Untracking changes subscriptions, not the caller's failure obligations.
      const failures = [];
      const result = this.call(args[0], [], node, { ...c, untracked: true, caught: failures });
      this.fail(uniq(failures), node, c);
      return result;
    }
    if (name === "createEffect" && args.length >= 2) {
      const first = this.call(args[0], [], node, { ...c, scope: "tracking" });
      return this.call(args[1], [first], node, { ...c, scope: "effect" });
    }
    if (name === "onCleanup" || name === "onMount") {
      this.runHandler(args[0], node, c);
      return plain();
    }
    if (name === "onSettled" || name === "createTrackedEffect")
      return this.call(args[0], [], node, { ...c, scope: "effect" });
    if (["Loading", "Errored", "Show", "For", "Switch", "Match"].includes(name)) return plain();
    return this.partial(node, c, "Solid " + name + " is outside the modeled subset");
  }
  platform(fn, args, node, c) {
    const path = fn.path;
    if (path === "Promise.resolve")
      return args[0]?.tag === "promise"
        ? args[0]
        : { tag: "promise", rejects: [], result: args[0] ?? plain() };
    if (path === "Promise.reject")
      return { tag: "promise", rejects: [args[0]?.error ?? "unknown"], result: plain() };
    if (path === "Promise.all" || path === "Promise.allSettled") {
      const entries = args[0]?.elements ?? [];
      return {
        tag: "promise",
        rejects: path.endsWith("Settled") ? [] : entries.flatMap(v => v.rejects ?? []),
        result: { tag: "array", elements: entries.map(v => v.result ?? v) }
      };
    }
    if (path === "fetch")
      return {
        tag: "promise",
        rejects: ["unknown"],
        result: { tag: "platformInstance", path: "Response" }
      };
    if (/^Response[.](json|text|blob|arrayBuffer)$/.test(path))
      return { tag: "promise", rejects: ["unknown"], result: plain() };
    if (path === "JSON.parse") {
      this.fail(["SyntaxError"], node, c);
      return plain();
    }
    if (
      [
        "setTimeout",
        "setInterval",
        "queueMicrotask",
        "requestAnimationFrame",
        "window.setTimeout",
        "window.setInterval"
      ].includes(path)
    ) {
      this.runHandler(args[0], node, c, [plain()]);
      return plain();
    }
    if (path === "Array.from") {
      const value = args[1] ? this.call(args[1], [plain(), plain()], node, c) : plain();
      return { tag: "array", elements: [value] };
    }
    if (path.startsWith("document.") || path.startsWith("window.document.")) {
      if (
        /(querySelector|querySelectorAll|getElementById|createElement|getElementsByClassName)$/.test(
          path
        )
      )
        return { tag: "platformInstance", path: "Element" };
    }
    if (
      (/^(Element|Event)[.]/.test(path) ||
        /^(document|window|window[.]document)[.](addEventListener|removeEventListener)$/.test(
          path
        )) &&
      /[.](preventDefault|stopPropagation|addEventListener|removeEventListener|focus|blur|setAttribute|removeAttribute|appendChild|remove|reset|requestSubmit)$/.test(
        path
      )
    ) {
      if (path.endsWith(".addEventListener") && args[1])
        this.runHandler(args[1], node, c, [{ tag: "platformInstance", path: "Event" }]);
      return plain();
    }
    if (
      [
        "Math",
        "console",
        "JSON",
        "Object",
        "String",
        "Number",
        "Boolean",
        "Date",
        "RegExp",
        "Array",
        "Reflect",
        "Intl",
        "Symbol",
        "BigInt",
        "Map",
        "Set",
        "WeakMap",
        "WeakSet"
      ].some(name => path === name || path.startsWith(name + ".")) ||
      [
        "parseInt",
        "parseFloat",
        "isNaN",
        "isFinite",
        "clearTimeout",
        "clearInterval",
        "encodeURIComponent",
        "decodeURIComponent"
      ].includes(path)
    ) {
      if (path === "Object.values" || path === "Object.keys" || path === "Object.entries")
        return { tag: "array", elements: [plain()] };
      return plain();
    }
    this.needed(node, "platform call has no modeled contract");
    this.worstSite(node, "unmodeled platform contract");
    this.fail(["unknown"], node, c);
    return unknown("platform result");
  }
  method(fn, args, node, c) {
    const { receiver: r, key } = fn;
    if (r.tag === "promise") {
      if (key === "catch") {
        r.handled = true;
        const caught = [];
        const value = this.call(args[0], [{ tag: "caught", failures: r.rejects }], node, {
          ...c,
          caught
        });
        return {
          tag: "promise",
          rejects: uniq([...caught, ...(value.rejects ?? [])]),
          result: join(r.result, value.result ?? value)
        };
      }
      if (key === "then" || key === "finally") {
        r.handled = true;
        const caught = [];
        const value = args[0]
          ? this.call(args[0], key === "then" ? [r.result] : [], node, {
              ...c,
              scope: "handler",
              caught
            })
          : plain();
        let rejects = [...r.rejects, ...caught, ...(value.rejects ?? [])];
        if (key === "then" && args[1]) {
          const errors = [];
          this.call(args[1], [{ tag: "caught", failures: r.rejects }], node, {
            ...c,
            scope: "handler",
            caught: errors
          });
          rejects = [...caught, ...errors];
        }
        return { tag: "promise", rejects: uniq(rejects), result: value.result ?? value };
      }
    }
    if (callbackMethods.has(key) && r.tag === "array") {
      const element = join(...(r.elements ?? []));
      const value = args[0] ? this.call(args[0], [element, plain(), r], node, c) : plain();
      if (key === "map" || key === "flatMap") return { tag: "array", elements: [value] };
      if (key === "filter") return r;
      if (key === "find") return join(element, { ...plain(), undefinedValue: true });
      if (key === "reduce") return value;
      return plain();
    }
    if (
      scalarMethods.has(key) &&
      ["array", "plain", "sourceValue", "platformInstance"].includes(r.tag)
    )
      return key === "split" ? { tag: "array", elements: [plain("")] } : plain();
    return this.call(unknown("unmodeled receiver method"), args, node, c);
  }
  eval(input, env, c) {
    const n = unwrap(input);
    if (!n) return { ...plain(), undefinedValue: true };
    if (fnTypes.has(n.type)) return this.closure(n, env);
    switch (n.type) {
      case "Literal":
        return plain(n.value);
      case "Identifier":
        return this.deref(env.get(n.name) ?? globalValue(n.name));
      case "ThisExpression":
        return env.get("this") ?? unknown("this");
      case "ObjectExpression": {
        const members = new Map();
        for (const p of n.properties) {
          if (p.type === "SpreadElement") {
            const v = this.eval(p.argument, env, c);
            if (v.members) for (const [k, x] of v.members) members.set(k, x);
            continue;
          }
          const key = keyName(p.key);
          let value = this.eval(p.value, env, c);
          if (p.kind === "get") value = { tag: "getter", fn: value };
          if (value.tag === "function" && !value.name) {
            value.name = key;
            value.component = /^[A-Z]/.test(key) && this.containsJSX(value.node);
            if (value.component) this.components.add(value);
          }
          members.set(key, value);
          if (c.scope === "module" && value.component) this.escapes.push({ fn: value, node: p });
        }
        return object(members);
      }
      case "ArrayExpression":
        return {
          tag: "array",
          elements: n.elements
            .filter(Boolean)
            .map(x => this.eval(x.type === "SpreadElement" ? x.argument : x, env, c))
        };
      case "MemberExpression": {
        const value = this.eval(n.object, env, c);
        const key = n.computed
          ? (this.eval(n.property, env, c).value ?? keyName(n.property))
          : keyName(n.property);
        return each(value, arm =>
          arm.tag === "optionalMissing" ||
          (n.optional && (arm.undefinedValue || arm.value === null))
            ? { tag: "optionalMissing" }
            : this.member(arm, String(key), n, env, c)
        );
      }
      case "CallExpression": {
        const fn = this.eval(n.callee, env, c);
        if (fn.tag === "solid" && fn.name === "render") {
          this.roots.push({ node: n, expression: n.arguments[0], env });
          return plain();
        }
        const args = n.arguments.map(a =>
          this.eval(a.type === "SpreadElement" ? a.argument : a, env, c)
        );
        return this.call(fn, args, n, c);
      }
      case "NewExpression": {
        const callee = this.eval(n.callee, env, c);
        const args = n.arguments.map(a => this.eval(a, env, c));
        if (callee.tag === "class") {
          const instance = object();
          const fields = new Env(callee.env);
          fields.define("this", instance, n);
          let constructor;
          for (const part of callee.node.body.body) {
            if (part.static) continue;
            if (part.computed || part.key?.type === "PrivateIdentifier")
              return this.partial(n, c, "computed or private class member");
            const key = keyName(part.key);
            if (part.type === "MethodDefinition") {
              const fn = { ...this.closure(part.value, callee.env), thisValue: instance };
              if (part.kind === "constructor") constructor = fn;
              else instance.members.set(key, part.kind === "get" ? { tag: "getter", fn } : fn);
            } else if (part.type === "PropertyDefinition") {
              instance.members.set(key, this.eval(part.value, fields, c));
            } else return this.partial(n, c, "unmodeled class member");
          }
          if (constructor) this.call(constructor, args, n, c);
          return instance;
        }
        if (callee.tag === "errorClass") return { tag: "plain", error: callee.name };
        if (callee.tag === "platform") {
          if (callee.path === "Promise") {
            const rejected = [];
            const resolveFn = { tag: "safe" };
            const rejectFn = { tag: "rejector", rejected };
            const sink = [];
            this.call(args[0], [resolveFn, rejectFn], n, { ...c, caught: sink });
            return { tag: "promise", rejects: uniq([...rejected, ...sink]), result: plain() };
          }
          if (/Error$/.test(callee.path)) return { tag: "plain", error: callee.path };
          return { tag: "platformInstance", path: callee.path };
        }
        this.fail(["unknown"], n, c);
        return this.partial(n, c, "class construction");
      }
      case "AwaitExpression": {
        const value = this.eval(n.argument, env, c);
        return each(value, v => {
          if (v.tag === "promise") {
            v.handled = true;
            this.fail(v.rejects, n, c);
            return v.result;
          }
          return v;
        });
      }
      case "UnaryExpression": {
        const value = this.eval(n.argument, env, c);
        if (n.operator === "void") {
          this.dropped(value, n, c);
          return { ...plain(), undefinedValue: true };
        }
        if (n.operator === "!")
          return typeof value.value === "boolean" ? plain(!value.value) : plain();
        return plain();
      }
      case "UpdateExpression":
        this.assign(n.argument, plain(), env, c, n);
        return plain();
      case "AssignmentExpression": {
        const value = this.eval(n.right, env, c);
        this.assign(n.left, value, env, c, n);
        return value;
      }
      case "BinaryExpression": {
        const a = this.eval(n.left, env, c);
        const b = this.eval(n.right, env, c);
        if (
          a.tag !== "plain" ||
          b.tag !== "plain" ||
          a.value === undefined ||
          b.value === undefined
        )
          return plain();
        switch (n.operator) {
          case "<":
            return plain(a.value < b.value);
          case ">":
            return plain(a.value > b.value);
          case "<=":
            return plain(a.value <= b.value);
          case ">=":
            return plain(a.value >= b.value);
          case "===":
          case "==":
            return plain(a.value === b.value);
          case "!==":
          case "!=":
            return plain(a.value !== b.value);
          case "+":
            return plain(a.value + b.value);
          case "-":
            return plain(a.value - b.value);
          case "*":
            return plain(a.value * b.value);
          case "/":
            return plain(a.value / b.value);
          case "%":
            return plain(a.value % b.value);
          default:
            return plain();
        }
      }
      case "LogicalExpression": {
        const left = this.eval(n.left, env, c);
        const right = this.eval(n.right, env, c);
        if (n.operator === "??" && left.tag === "plain" && left.value === undefined) return right;
        return join(left, right);
      }
      case "ConditionalExpression":
        this.eval(n.test, env, c);
        return join(this.eval(n.consequent, env, c), this.eval(n.alternate, env, c));
      case "SequenceExpression": {
        let v = plain();
        for (const e of n.expressions) v = this.eval(e, env, c);
        return v;
      }
      case "TemplateLiteral":
        n.expressions.forEach(e => this.eval(e, env, c));
        return plain("");
      case "TaggedTemplateExpression":
        return this.call(
          this.eval(n.tag, env, c),
          n.quasi.expressions.map(e => this.eval(e, env, c)),
          n,
          c
        );
      case "JSXElement":
        return this.jsx(n, env, c);
      case "JSXFragment":
        n.children.forEach(ch => this.child(ch, env, c));
        return plain();
      case "JSXExpressionContainer":
        return this.eval(n.expression, env, { ...c, scope: "tracking" });
      case "JSXEmptyExpression":
        return plain();
      case "TSDeclareFunction":
        return this.graph.shape(n, env);
      default:
        return this.partial(n, c, "unmodeled expression " + n.type);
    }
  }
  containsJSX(node) {
    let result = false;
    walk(node.body, n => {
      if (n.type === "JSXElement" || n.type === "JSXFragment") result = true;
    });
    return result;
  }
  assign(left, value, env, c, node) {
    if (left.type === "Identifier") {
      const cell = env.cell(left.name);
      if (cell) {
        if (
          cell.env.parent === null &&
          c.scope !== "module" &&
          value.tag === "object" &&
          value.service
        ) {
          this.partial(node, c, "context stored in module state");
          value.tainted = true;
        }
        cell.value = value;
      } else env.define(left.name, value, left);
    } else if (left.type === "MemberExpression") {
      const target = this.eval(left.object, env, c);
      if (target.tag === "object") {
        if (target.service) {
          this.partial(node, c, "context member mutation");
          target.tainted = true;
        } else target.members.set(keyName(left.property), value);
      }
    } else this.bind(left, value, env, c);
  }

  statement(n, env, c) {
    if (!n) return false;
    switch (n.type) {
      case "ExportNamedDeclaration":
      case "ExportDefaultDeclaration":
        return n.declaration ? this.statement(n.declaration, env, c) : false;
      case "ImportDeclaration":
      case "ExportAllDeclaration":
      case "TSTypeAliasDeclaration":
      case "TSInterfaceDeclaration":
      case "EmptyStatement":
      case "TSDeclareFunction":
        return false;
      case "FunctionDeclaration":
        return false;
      case "ClassDeclaration": {
        const base = this.eval(n.superClass, env, c);
        if (base.tag === "platform" && /Error$/.test(base.path))
          env.define(n.id.name, { tag: "errorClass", name: n.id.name }, n);
        else if (
          !n.superClass &&
          n.body.body.every(
            part =>
              !part.static &&
              !part.computed &&
              part.key?.type !== "PrivateIdentifier" &&
              part.kind !== "set" &&
              !part.value?.generator &&
              ["MethodDefinition", "PropertyDefinition"].includes(part.type) &&
              !(part.value?.params ?? []).some(p => p.type === "TSParameterProperty")
          )
        )
          env.define(n.id.name, { tag: "class", node: n, env }, n);
        else env.define(n.id.name, this.partial(n, c, "unsupported class shape"), n);
        return false;
      }
      case "VariableDeclaration":
        for (const d of n.declarations) {
          const value = d.init
            ? this.eval(d.init, env, c)
            : d.id.typeAnnotation
              ? this.annotation(d.id, env)
              : plain();
          if (value.tag === "function" && d.id.name) {
            value.name = d.id.name;
            value.component = /^[A-Z]/.test(value.name) && this.containsJSX(value.node);
            if (value.component) this.components.add(value);
          }
          this.bind(d.id, value, env, c);
        }
        return false;
      case "ExpressionStatement": {
        const value = this.eval(n.expression, env, c);
        this.dropped(value, n.expression, c);
        return false;
      }
      case "ReturnStatement": {
        const value = this.eval(n.argument, env, c);
        c.returns?.push(value);
        return true;
      }
      case "ThrowStatement": {
        const value = this.eval(n.argument, env, c);
        this.fail(value.tag === "caught" ? value.failures : [value.error ?? "unknown"], n, c);
        return true;
      }
      case "BlockStatement": {
        const inner = new Env(env);
        this.hoist(n.body, inner);
        return this.block(n.body, inner, c);
      }
      case "IfStatement": {
        const test = this.eval(n.test, env, c);
        if (test.tag === "plain" && typeof test.value === "boolean")
          return this.statement(test.value ? n.consequent : n.alternate, env, c);
        const a = this.fork(env);
        const b = this.fork(env);
        const doneA = this.statement(n.consequent, a, c);
        const doneB = this.statement(n.alternate, b, c);
        this.merge(env, a, b);
        return doneA && doneB;
      }
      case "TryStatement": {
        const caught = [];
        const inner = { ...c, caught: n.handler ? caught : c.caught };
        const done = this.statement(n.block, env, inner);
        if (n.handler && caught.length) {
          const handlerEnv = new Env(env);
          this.bind(n.handler.param, { tag: "caught", failures: uniq(caught) }, handlerEnv, c);
          this.statement(n.handler.body, handlerEnv, c);
        }
        if (n.finalizer) this.statement(n.finalizer, env, c);
        return done && !n.handler;
      }
      case "ForStatement":
      case "ForOfStatement":
      case "ForInStatement":
      case "WhileStatement":
      case "DoWhileStatement": {
        const widened = this.partial(n, c, "loop state needs a fixed-point analysis");
        const loop = new Env(env);
        walk(n, part => {
          if (
            (part.type === "AssignmentExpression" || part.type === "UpdateExpression") &&
            (part.left ?? part.argument)?.type === "Identifier"
          ) {
            const cell = env.cell((part.left ?? part.argument).name);
            if (cell) cell.value = join(cell.value, widened);
          }
        });
        if (n.init)
          n.init.type === "VariableDeclaration"
            ? this.statement(n.init, loop, c)
            : this.eval(n.init, loop, c);
        if (n.left?.type === "VariableDeclaration") {
          for (const d of n.left.declarations) this.bind(d.id, plain(), loop, c);
        }
        if (n.right) this.eval(n.right, loop, c);
        if (n.test) this.eval(n.test, loop, c);
        this.statement(n.body, loop, c);
        if (n.update) this.eval(n.update, loop, c);
        return false;
      }
      case "SwitchStatement":
        this.eval(n.discriminant, env, c);
        n.cases.forEach(cs => {
          this.eval(cs.test, env, c);
          this.block(cs.consequent, new Env(env), c);
        });
        return false;
      case "BreakStatement":
      case "ContinueStatement":
        return true;
      case "LabeledStatement":
        return this.statement(n.body, env, c);
      default:
        this.partial(n, c, "unmodeled statement " + n.type);
        return false;
    }
  }
  block(statements, env, c) {
    for (const n of statements) if (this.statement(n, env, c)) return true;
    return false;
  }
  fork(env, memo = new Map()) {
    if (!env) return null;
    if (!env.parent) return env;
    if (memo.has(env)) return memo.get(env);
    const out = new Env(this.fork(env.parent, memo), env.module);
    memo.set(env, out);
    for (const [name, cell] of env.cells) out.define(name, cell.value, cell.node);
    for (const cell of out.cells.values())
      if (cell.value?.tag === "function" && memo.has(cell.value.env))
        cell.value = { ...cell.value, env: memo.get(cell.value.env) };
    return out;
  }
  merge(env, a, b) {
    if (!env || !env.parent) return;
    for (const [name, cell] of env.cells)
      cell.value = join(a.cells.get(name)?.value, b.cells.get(name)?.value);
    this.merge(env.parent, a.parent, b.parent);
  }
  jsxValue(n, env, c) {
    if (n.type === "JSXIdentifier")
      return this.deref(env.get(n.name) ?? unknown("JSX tag " + n.name));
    if (n.type === "JSXMemberExpression")
      return this.member(this.jsxValue(n.object, env, c), keyName(n.property), n, env, c);
    return unknown("dynamic JSX");
  }
  child(n, env, c, args = [], callbackScope = "tracking") {
    if (n.type === "JSXText") return plain(n.value);
    if (n.type === "JSXExpressionContainer") {
      const value = this.eval(n.expression, env, { ...c, scope: "tracking" });
      if (value.tag === "function")
        return this.call(value, args, n, {
          ...c,
          scope: callbackScope,
          capture: callbackScope === "setup" ? null : c.capture
        });
      if (["worst", "unknown", "dependencyUnknown"].includes(value.tag))
        this.read({ pending: true, failures: ["unknown"] }, n.expression, {
          ...c,
          scope: "tracking"
        });
      return value;
    }
    return this.eval(n, env, c);
  }
  jsx(n, env, c) {
    const opening = n.openingElement;
    const tag = opening.name;
    const intrinsic = tag.type === "JSXIdentifier" && /^[a-z]/.test(tag.name);
    const value = intrinsic ? null : this.jsxValue(tag, env, c);
    const attrs = opening.attributes;
    const next = { ...c, scope: "tracking" };
    if (value?.tag === "context") {
      const attr = attrs.find(a => keyName(a.name) === "value");
      const provided =
        attr?.value?.type === "JSXExpressionContainer"
          ? this.eval(attr.value.expression, env, next)
          : plain(attr?.value?.value);
      this.event("provider", n);
      const cc = { ...next, providers: [...c.providers, { context: value, value: provided }] };
      n.children.forEach(ch => this.child(ch, env, cc));
      return plain();
    }
    if (value?.tag === "function") {
      const members = new Map();
      let spread = false;
      for (const a of attrs) {
        if (a.type === "JSXSpreadAttribute") {
          this.partial(a, c, "JSX spread");
          spread = true;
          this.eval(a.argument, env, next);
          continue;
        }
        const key = keyName(a.name);
        const expr = a.value?.type === "JSXExpressionContainer" ? a.value.expression : a.value;
        members.set(key, expr ? { tag: "thunk", node: expr, env, context: next } : plain(true));
      }
      const children = n.children.filter(ch => ch.type !== "JSXText" || ch.value.trim());
      if (children.length === 1) {
        const ch = children[0];
        members.set("children", {
          tag: "thunk",
          node: ch.type === "JSXExpressionContainer" ? ch.expression : ch,
          env,
          context: next
        });
      }
      const p = value.node.params[0];
      const shape = p?.typeAnnotation ? this.annotation(p, value.env) : undefined;
      // Exported inputs retain their public injectable arm even when a local
      // renderer omits it. Supplied prop thunks still keep their known bodies.
      const publicInput = [...value.env.module.exports.values()].some(
        entry =>
          entry.declaration === value.node ||
          (entry.local && value.env.module.env.get(entry.local)?.node === value.node)
      );
      const props = { tag: "props", members, shape, closed: !spread && !publicInput };
      if (spread && shape?.members)
        for (const [k, v] of shape.members) if (!members.has(k)) members.set(k, v);
      this.component(value, props, tag, next);
      return plain();
    }
    const solidName = value?.tag === "solid" ? value.name : "";
    const boundary = solidName === "Loading" || solidName === "Errored";
    const cc = {
      ...next,
      loading: c.loading || solidName === "Loading",
      errored: c.errored || solidName === "Errored"
    };
    if (boundary) this.event("boundary", n, { boundary: solidName });
    if (
      !intrinsic &&
      !["Loading", "Errored", "Show", "For", "Switch", "Match"].includes(solidName)
    ) {
      this.partial(tag, c, "dynamic or unmodeled JSX");
      this.read({ pending: true, failures: ["unknown"] }, tag, cc);
    }
    let eachValue = plain();
    let keyed = plain(true);
    for (const a of attrs) {
      if (a.type === "JSXSpreadAttribute") {
        this.partial(a, c, "JSX spread");
        continue;
      }
      const name = keyName(a.name);
      const expression = a.value?.type === "JSXExpressionContainer" ? a.value.expression : a.value;
      if (!expression) continue;
      if (name === "ref") {
        const fn = this.eval(expression, env, next);
        each(fn, arm => {
          // A DOM capture is not a call. Callback reads run once, outside tracking.
          if (["function", "declared", "unknown", "worst"].includes(arm.tag)) {
            this.runHandler(
              arm,
              a,
              { ...c, refNode: a },
              [{ tag: "platformInstance", path: "Element" }],
              "ref"
            );
          }
          return arm;
        });
      } else if (solidName === "Loading" && name === "on") {
        // A reset key is a tracked value, never a detached callback.
        this.eval(expression, env, next);
      } else if (/^on/i.test(name)) {
        const fn = this.eval(expression, env, next);
        this.runHandler(fn, a, c, [{ tag: "platformInstance", path: "Event" }]);
      } else if (name === "fallback" && boundary) {
        const fn = this.eval(expression, env, next);
        if (fn.tag === "function")
          this.call(fn, [{ tag: "safe", result: plain() }, { tag: "safe" }], expression, next);
      } else {
        const out = this.eval(expression, env, cc);
        if (name === "each") eachValue = out;
        if (name === "keyed") keyed = out;
      }
    }
    const row = eachValue.tag === "array" ? join(...eachValue.elements) : plain();
    const accessor = result => ({ tag: "source", pending: false, failures: [], result });
    const rowArgs = each(keyed, mode => {
      const callable = [
        "function",
        "declared",
        "platform",
        "safe",
        "source",
        "setter",
        "method",
        "solid"
      ].includes(mode.tag);
      if (solidName === "For" && callable) this.call(mode, [row], n, cc);
      const fixedMode =
        mode.tag === "plain" && (typeof mode.value === "boolean" || mode.undefinedValue);
      if (solidName === "For" && !callable && !fixedMode) {
        const worst = this.partial(n, cc, "unknown For key mode");
        this.read({ pending: true, failures: ["unknown"] }, n, cc);
        return {
          tag: "array",
          elements: [join(row, accessor(row), worst), join(plain(), accessor(plain()))]
        };
      }
      return {
        tag: "array",
        elements: [
          callable || mode.value === false ? accessor(row) : row,
          mode.value === false ? { ...plain(), primitive: "number" } : accessor(plain())
        ]
      };
    });
    const args =
      solidName === "For"
        ? [0, 1].map(i => each(rowArgs, arm => arm.elements[i]))
        : solidName === "Show"
          ? [{ tag: "safe", result: plain() }]
          : [];
    n.children.forEach(ch =>
      this.child(ch, env, cc, args, solidName === "For" ? "setup" : "tracking")
    );
    return plain();
  }
  run() {
    this.graph.prepare();
    for (const path of this.graph.options.files)
      if (!this.graph.isDependency(path)) this.initialize(this.graph.load(path));
    for (const root of this.roots) {
      const c = this.context({ scope: "tracking", related: [root.node] });
      const fn = root.expression ? this.eval(root.expression, root.env, c) : root.fn;
      if (fn?.component) {
        const p = fn.node.params[0];
        const shape = p?.typeAnnotation ? this.annotation(p, fn.env) : undefined;
        this.component(fn, { tag: "props", members: new Map(), shape }, root.node, c);
      } else this.call(fn, [], root.node, c);
    }
    for (const escape of this.escapes) {
      const c = this.context({ scope: "tracking", related: [escape.node] });
      const p = escape.fn.node.params[0];
      const shape = p?.typeAnnotation ? this.annotation(p, escape.fn.env) : undefined;
      this.component(escape.fn, { tag: "props", members: new Map(), shape }, escape.node, c);
    }
    for (const mod of this.graph.modules.values()) {
      if (!this.graph.options.files.includes(mod.path)) continue;
      for (const [name] of mod.exports) {
        const fn = this.exportValue(mod, name, new Set());
        if (fn.tag !== "function" || !fn.component || this.called.has(fn)) continue;
        const exported = [];
        const c = this.context({ scope: "tracking", mode: "export", exported });
        const p = fn.node.params[0];
        const shape = p?.typeAnnotation ? this.annotation(p, fn.env) : undefined;
        this.component(fn, { tag: "props", members: new Map(), shape }, fn.node, c);
        if (exported.length)
          this.emit(
            "COMPONENT_OBLIGATIONS_EXPORTED",
            fn.node.id ?? fn.node,
            { ...c, mode: null },
            [],
            {
              pending: exported.some(e => e.code === "ASYNC_OUTSIDE_LOADING_BOUNDARY"),
              failures: uniq(exported.flatMap(e => e.data.failures ?? []))
            }
          );
      }
    }
    return {
      diagnostics: this.diagnostics,
      facts: [...this.facts.values()],
      inferenceNeeded: [...this.inference.values()],
      inferenceNeededCount: this.inference.size,
      worstCaseSites: [...this.worstSites.values()],
      worstCaseSiteCount: this.worstSites.size,
      graph: { nodes: this.nodes.length }
    };
  }
}
