import { parseProgram } from "./parse.js";
import { CONSTRUCTORS } from "../../eslint-plugin-yield/src/routines.js";

export const provenance = ["S", "U", "C"];
const CELLS = new Set(["$signal", "$store", "$optimistic", "$optimisticStore", "$projection"]);
const FLOW = new Set(["Show", "For", "Switch", "Match", "Repeat"]);
const BOUNDARY = new Set(["Loading", "Errored"]);
const unwrap = p => {
  while (
    p?.node &&
    [
      "TSAsExpression",
      "TSTypeAssertion",
      "TSNonNullExpression",
      "ParenthesizedExpression"
    ].includes(p.node.type)
  )
    p = p.get("expression");
  return p;
};
const keyName = n => n?.name ?? n?.value;

/** A build-local graph. No file is evaluated and no analysis is read from disk. */
export function analyze(
  modules,
  { resolve = (id, from) => new URL(id, `file://${from}`).pathname } = {}
) {
  const records = new Map();
  const paths = new WeakMap();
  const owners = new WeakMap();
  const facts = new Map();
  const exports = new Map();
  const imports = new Map();
  const parts = [];
  const components = [];
  const merges = [];
  const leaks = new Map();
  const findings = [];
  const getId = p => `${owners.get(p.node)}:${p.node.start}`;
  const loc = p => `${owners.get(p.node)}:${p.node.loc.start.line}:${p.node.loc.start.column + 1}`;
  for (const [id, code] of modules) {
    const program = parseProgram(code, id);
    records.set(id, { id, code, program });
    owners.set(program.node, id);
    paths.set(program.node, program);
    program.traverse({
      enter(p) {
        paths.set(p.node, p);
        owners.set(p.node, id);
      }
    });
  }
  function imported(p) {
    p = unwrap(p);
    if (!p?.isIdentifier()) return null;
    const b = p.scope.getBinding(p.node.name);
    if (!b?.path.isImportSpecifier()) return null;
    return {
      source: b.path.parentPath.node.source.value,
      name: keyName(b.path.node.imported)
    };
  }
  function lib(p) {
    const i = imported(p);
    return i && (i.source === "solid-yield" || i.source === "solid-yield/h") ? i.name : null;
  }
  // Import identities, including aliases and re-exports, use the build's resolver.
  for (const r of records.values()) {
    const ex = new Map();
    exports.set(r.id, ex);
    for (const p of r.program.get("body")) {
      if (p.isImportDeclaration()) {
        for (const sp of p.get("specifiers"))
          imports.set(sp.node, {
            id: resolve(p.node.source.value, r.id),
            name: sp.isImportDefaultSpecifier() ? "default" : keyName(sp.node.imported),
            source: p.node.source.value
          });
      }
      if (p.isExportDefaultDeclaration()) ex.set("default", p.get("declaration"));
      if (p.isExportNamedDeclaration()) {
        const d = p.get("declaration");
        if (d?.isVariableDeclaration())
          for (const v of d.get("declarations")) {
            if (v.get("id").isIdentifier()) ex.set(v.node.id.name, v.get("init"));
          }
        if (d?.isFunctionDeclaration()) ex.set(d.node.id.name, d);
        for (const sp of p.get("specifiers")) {
          if (p.node.source)
            ex.set(keyName(sp.node.exported), {
              reexport: true,
              id: resolve(p.node.source.value, r.id),
              name: keyName(sp.node.local)
            });
          else ex.set(keyName(sp.node.exported), sp.get("local"));
        }
      }
    }
  }
  function definition(p, seen = new Set()) {
    p = unwrap(p);
    if (!p?.node || seen.has(p.node)) return p;
    seen.add(p.node);
    if (p.isIdentifier()) {
      const b = p.scope.getBinding(p.node.name);
      if (!b) return p;
      const imp = imports.get(b.path.node);
      if (imp) {
        let target = exports.get(imp.id)?.get(imp.name);
        const visits = new Set();
        while (target?.reexport && !visits.has(target)) {
          visits.add(target);
          target = exports.get(target.id)?.get(target.name);
        }
        return target ? definition(target, seen) : p;
      }
      if (b.path.isVariableDeclarator()) {
        const init = b.path.get("init");
        if (b.path.get("id").isIdentifier() && init?.node) return definition(init, seen);
      }
      if (b.path.isFunctionDeclaration()) return b.path;
    }
    if (p.isYieldExpression()) return definition(p.get("argument"), seen);
    return p;
  }
  function targetOfCall(p) {
    return definition(lib(p.get("callee")) === "h" ? p.get("arguments")[0] : p.get("callee"));
  }
  function controlName(p) {
    return lib(p.get("callee")) === "h" ? lib(p.get("arguments")[0]) : lib(p.get("callee"));
  }
  const make = (p, kind, base = 0) => {
    const id = getId(p);
    if (facts.has(id)) return facts.get(id);
    const fact = {
      id,
      at: loc(p),
      kind,
      base,
      p: base,
      deps: new Set(),
      path: p,
      pending: false,
      failing: false
    };
    facts.set(id, fact);
    return fact;
  };
  const leak = (p, reason) => {
    const f = make(p, "unknown", 1);
    if (!leaks.has(f.id))
      leaks.set(f.id, { id: f.id, at: f.at, name: p.toString().slice(0, 100), reason });
    return f;
  };
  const partByNode = new WeakMap();
  const componentByNode = new WeakMap();
  const addPart = (p, kind, base = 0) => {
    if (partByNode.has(p.node)) return partByNode.get(p.node);
    const f = make(p, kind, base);
    f.kind = kind;
    f.base = Math.max(f.base, base);
    parts.push(f);
    partByNode.set(p.node, f);
    return f;
  };
  function componentOf(p) {
    for (let a = p; a; a = a.parentPath)
      if (componentByNode.has(a.node)) return componentByNode.get(a.node);
    return null;
  }
  for (const r of records.values())
    r.program.traverse({
      CallExpression(p) {
        const name = lib(p.get("callee"));
        if (name === "component") {
          const f = make(p, "component");
          f.name = p.parentPath.isVariableDeclarator()
            ? p.parentPath.node.id.name
            : `component@${f.at}`;
          components.push(f);
          componentByNode.set(p.node, f);
        }
        if (CELLS.has(name)) addPart(p, "cell", name.startsWith("$optimistic") ? 2 : 0);
        else if (name === "$memo") addPart(p, "memo");
        else if (name && CONSTRUCTORS[name] === "event") addPart(p, "event", 2);
        else if (name && CONSTRUCTORS[name] === "effect") addPart(p, "effect", 2);
        else if (name === "foreignSource") addPart(p, "foreign-source", 1);
        else if (name === "foreign") addPart(p, "foreign", 1);
        if (name === "h") {
          const target = p.get("arguments")[0];
          if (target?.isStringLiteral()) {
            const props = p.get("arguments")[1];
            if (props?.isObjectExpression())
              for (const prop of props.get("properties")) {
                if (!prop.isObjectProperty()) continue;
                const v = prop.get("value");
                if (!v.isLiteral())
                  addPart(
                    v,
                    /^on[A-Z]/.test(keyName(prop.node.key)) ? "bind" : "hole",
                    /^on[A-Z]/.test(keyName(prop.node.key)) ? 2 : 0
                  );
              }
            for (const child of p.get("arguments").slice(2))
              if (!child.isLiteral() && !child.isCallExpression()) addPart(child, "hole");
          }
        }
      },
      JSXElement(p) {
        const name = p.node.openingElement.name;
        if (name.type === "JSXMemberExpression" || /^[A-Z]/.test(name.name ?? ""))
          addPart(p, "foreign", 1);
      }
    });
  const setterCells = new Map();
  const inbound = new Map();
  const inboundArgs = new Map();
  const callsites = new Map();
  for (const part of parts) {
    if (part.kind !== "cell") continue;
    const d = part.path.findParent(p => p.isVariableDeclarator());
    if (d?.get("id").isArrayPattern()) {
      const setter = d.get("id.elements")[1];
      if (setter?.isIdentifier())
        setterCells.set(setter.scope.getBinding(setter.node.name)?.identifier, part);
    }
  }
  function enclosingHost(p) {
    for (let a = p.parentPath; a; a = a.parentPath) {
      const part = partByNode.get(a.node);
      if (part && ["memo", "event", "effect"].includes(part.kind)) return part;
    }
    return null;
  }
  function readBinding(p) {
    const b = p.scope.getBinding(p.node.name);
    if (!b) return p.node.name === "undefined" ? make(p, "constant") : leak(p, "unresolved global");
    if (setterCells.has(b.identifier)) return setterCells.get(b.identifier);
    // Resolve mutable bindings before following their initializer. A literal
    // initializer does not prove that a later read still sees that literal.
    const memberWrite = b.referencePaths.some(ref => {
      let target = ref;
      while (target.parentPath?.isMemberExpression() && target.parentKey === "object")
        target = target.parentPath;
      const parent = target.parentPath;
      return (
        (parent?.isAssignmentExpression() && target.key === "left") ||
        parent?.isUpdateExpression() ||
        parent?.isUnaryExpression({ operator: "delete" })
      );
    });
    if (!b.constant || memberWrite || (b.scope.path.isProgram() && ["let", "var"].includes(b.kind)))
      return leak(b.path, "mutable binding");
    const d = definition(p);
    if (d.node !== p.node) return value(d);
    if (b.kind === "param") {
      const host = enclosingHost(b.path);
      if (host?.kind === "event") return make(b.path, "event-argument", 2);
      const fn = b.path.findParent(q => q.isFunction());
      const comp = fn?.parentPath && componentByNode.get(fn.parentPath.node);
      if (comp) {
        const f = make(b.path, "prop");
        f.deps = new Set(inbound.get(comp.id) ?? []);
        if (!f.deps.size) f.base = 1;
        return f;
      }
      // A row's values follow its controlling source, rather than becoming globals.
      const control = fn?.findParent(q => q.isCallExpression() && FLOW.has(lib(q.get("callee"))));
      if (control) {
        const obj = control.get("arguments")[0];
        const input =
          obj?.isObjectExpression() &&
          obj.get("properties").find(q => ["each", "when", "count"].includes(keyName(q.node.key)));
        if (input) return value(input.get("value"));
      }
      return leak(b.path, "unresolved parameter (row, callback or foreign props)");
    }
    if (b.path.isVariableDeclarator()) {
      const init = b.path.get("init");
      if (init?.node) {
        const f = value(init);
        if (!b.constant) f.base = Math.max(f.base, 1);
        return f;
      }
    }
    return leak(b.path, "unread import or mutable binding");
  }
  function propValues(p) {
    const object = p.get("object");
    if (!object.isIdentifier()) return null;
    const binding = object.scope.getBinding(object.node.name);
    if (binding?.kind !== "param") return null;
    const fn = binding.path.findParent(q => q.isFunction());
    const comp = fn?.parentPath && componentByNode.get(fn.parentPath.node);
    if (!comp) return null;
    const key = p.node.computed
      ? p.get("property").isStringLiteral() && p.node.property.value
      : keyName(p.node.property);
    if (key === false) return null;
    const args = inboundArgs.get(comp.id) ?? [];
    const values = [];
    let unknown = !args.length;
    for (const arg of args) {
      const obj = arg && definition(arg);
      if (!obj?.isObjectExpression()) {
        unknown = true;
        if (arg) values.push(arg);
        continue;
      }
      // Last explicit property wins, unless a later spread can replace it.
      let selected = null;
      for (const prop of obj.get("properties")) {
        if (prop.isSpreadElement()) {
          selected = null;
          unknown = true;
          values.push(prop.get("argument"));
        } else if (prop.node.computed || prop.isObjectMethod()) {
          unknown = true;
        } else if (prop.isObjectProperty() && keyName(prop.node.key) === key) {
          selected = prop.get("value");
        }
      }
      if (selected) values.push(selected);
    }
    return { values, unknown };
  }
  const evaluating = new Set();
  function value(input) {
    const p = unwrap(input);
    if (!p?.node) return null;
    if (p.isIdentifier()) return readBinding(p);
    const id = getId(p);
    if (evaluating.has(id)) return make(p, "recursive");
    const existing = facts.get(id);
    if (existing?.evaluated) return existing;
    const f = existing ?? make(p, "expression");
    evaluating.add(id);
    const dep = q => {
      const d = value(q);
      if (d && d !== f) f.deps.add(d.id);
    };
    const name = p.isCallExpression() ? lib(p.get("callee")) : null;
    if (p.isLiteral() || p.isJSXText()) {
      /* serializable scalar syntax */
    } else if (p.isYieldExpression()) dep(p.get("argument"));
    else if (p.isMemberExpression() || p.isOptionalMemberExpression()) {
      const prop = propValues(p);
      if (prop) {
        if (prop.unknown) f.base = Math.max(f.base, 1);
        for (const arg of prop.values) dep(arg);
      } else {
        dep(p.get("object"));
        if (p.node.computed) dep(p.get("property"));
      }
    } else if (p.isFunction()) {
      if (!p.get("body").isBlockStatement()) dep(p.get("body"));
      p.traverse({
        YieldExpression(q) {
          dep(q.get("argument"));
        },
        ReturnStatement(q) {
          if (q.get("argument").node) dep(q.get("argument"));
        }
      });
    } else if (p.isCallExpression()) {
      if (name === "component") {
        dep(p.get("arguments")[0]);
      } else if (CELLS.has(name)) dep(p.get("arguments")[0]);
      else if (
        [
          "$memo",
          "$event",
          "$effect",
          "view",
          "constant",
          "readStore",
          "latestOf",
          "isPendingOf"
        ].includes(name)
      ) {
        for (const arg of p.get("arguments")) dep(arg);
      } else if (name === "foreignSource") {
        f.base = 1;
        leaks.set(id, {
          id,
          at: f.at,
          name: p.parentPath.node.id?.name ?? "foreignSource",
          reason: "foreignSource: always unknown"
        });
      } else if (name === "createContext") for (const arg of p.get("arguments")) dep(arg);
      else if (FLOW.has(name) || BOUNDARY.has(name) || name === "h")
        for (const arg of p.get("arguments")) dep(arg);
      else if (name === "attempt") {
        f.pending = true;
        f.failing = true;
        const fn = p.get("arguments")[0];
        const body = fn?.isFunction() ? fn.get("body") : fn;
        const target = body?.isCallExpression() ? definition(body.get("callee")) : null;
        const server =
          target?.isFunction() &&
          (target.node.body.directives?.some(d => d.value.value === "use server") ||
            records
              .get(owners.get(target.node))
              .program.node.directives?.some(d => d.value.value === "use server"));
        const sourceTarget = body && definition(body);
        const bridge =
          sourceTarget?.isCallExpression() && lib(sourceTarget.get("callee")) === "foreignSource";
        if (server) for (const arg of body.get("arguments")) dep(arg);
        else if (bridge) dep(body);
        else {
          f.base = 1;
          leaks.set(id, {
            id,
            at: f.at,
            name: fn?.toString().slice(0, 100),
            reason: "attempt target not proved a server function"
          });
          dep(fn);
        }
      } else if (["refresh", "$cleanup", "raise", "until"].includes(name)) {
        for (const arg of p.get("arguments")) dep(arg);
        f.pending = name === "until";
        f.failing = name === "raise" || name === "until";
      } else if (
        p.get("callee").isMemberExpression() &&
        keyName(p.node.callee.property) === "provide"
      ) {
        for (const arg of p.get("arguments")) dep(arg);
      } else {
        const target = definition(p.get("callee"));
        if (target && componentByNode.has(target.node)) {
          dep(target);
        } else if (target?.isFunction() && target.node.generator) dep(target);
        else if (
          setterCells.has(
            p.get("callee").isIdentifier() && p.scope.getBinding(p.node.callee.name)?.identifier
          )
        ) {
          dep(p.get("callee"));
        } else {
          f.base = 1;
          leaks.set(id, {
            id,
            at: f.at,
            name: p.get("callee").toString(),
            reason: "unanalysed call"
          });
        }
        for (const arg of p.get("arguments")) dep(arg);
      }
    } else if (p.isJSXElement()) {
      if (
        /^[A-Z]/.test(p.node.openingElement.name.name ?? "") ||
        p.node.openingElement.name.type === "JSXMemberExpression"
      ) {
        f.base = 1;
        leaks.set(id, {
          id,
          at: f.at,
          name: p.get("openingElement.name").toString(),
          reason: "foreign tag"
        });
      }
      for (const attr of p.get("openingElement.attributes")) {
        if (attr.isJSXSpreadAttribute()) {
          f.base = 1;
          dep(attr.get("argument"));
        } else if (attr.node.value) {
          dep(attr.get("value"));
          if (/^on[A-Z]/.test(keyName(attr.node.name))) f.base = 2;
        }
      }
      for (const child of p.get("children")) dep(child);
    } else if (p.isJSXFragment()) for (const child of p.get("children")) dep(child);
    else if (p.isJSXExpressionContainer()) dep(p.get("expression"));
    else if (p.isObjectExpression())
      for (const prop of p.get("properties")) {
        if (prop.isSpreadElement()) {
          f.base = 1;
          dep(prop.get("argument"));
        } else if (prop.isObjectProperty()) dep(prop.get("value"));
        else f.base = 1;
      }
    else if (p.isArrayExpression()) for (const el of p.get("elements")) dep(el);
    else if (p.isBinaryExpression() || p.isLogicalExpression()) {
      dep(p.get("left"));
      dep(p.get("right"));
    } else if (p.isConditionalExpression()) {
      dep(p.get("test"));
      dep(p.get("consequent"));
      dep(p.get("alternate"));
    } else if (p.isUnaryExpression()) dep(p.get("argument"));
    else if (p.isTemplateLiteral()) for (const e of p.get("expressions")) dep(e);
    else if (p.isBlockStatement())
      for (const q of p.get("body")) {
        if (q.isReturnStatement()) dep(q.get("argument"));
        else
          q.traverse({
            ReturnStatement(r) {
              dep(r.get("argument"));
            }
          });
      }
    else if (!p.isJSXEmptyExpression()) {
      f.base = 1;
    }
    f.evaluated = true;
    evaluating.delete(id);
    return f;
  }
  // Calls feed the component's props. Cap 1 is deliberately conservative and reported.
  for (const r of records.values())
    r.program.traverse({
      CallExpression(p) {
        const target = targetOfCall(p);
        const comp = target && componentByNode.get(target.node);
        if (comp) {
          if (!callsites.has(comp.id)) callsites.set(comp.id, []);
          callsites.get(comp.id).push(p);
          const list = inbound.get(comp.id) ?? new Set();
          const arg = p.get("arguments")[lib(p.get("callee")) === "h" ? 1 : 0];
          if (arg?.node) list.add(getId(unwrap(arg)));
          inbound.set(comp.id, list);
          const args = inboundArgs.get(comp.id) ?? [];
          args.push(arg?.node ? arg : null);
          inboundArgs.set(comp.id, args);
        }
      }
    });
  // Evaluate argument facts before reading parameter equations, without depending on visit order.
  for (const r of records.values())
    r.program.traverse({
      CallExpression(p) {
        const target = targetOfCall(p);
        if (target && componentByNode.has(target.node))
          for (const a of p.get("arguments")) value(a);
      }
    });
  for (const c of components) value(c.path);
  for (const p of parts) value(p.path);
  for (const r of records.values())
    r.program.traverse({
      YieldExpression(p) {
        if (!p.node.delegate || !p.node.argument) return;
        const host = enclosingHost(p);
        if (host?.kind === "event" || host?.kind === "effect") {
          const arg = p.get("argument");
          if (arg.isCallExpression()) {
            const callee = arg.get("callee");
            const setter = definition(callee);
            const cell =
              setter?.isIdentifier() &&
              setterCells.get(setter.scope.getBinding(setter.node.name)?.identifier);
            const target = lib(callee) === "refresh" ? value(arg.get("arguments")[0]) : cell;
            if (target) {
              target.base = 2;
              host.deps.add(target.id);
              target.written = true;
            }
          }
        }
        const setupCall = p.get("argument");
        const setupName = setupCall.isCallExpression() && lib(setupCall.get("callee"));
        const setupOnly =
          CELLS.has(setupName) || ["$memo", "$effect", "$cleanup"].includes(setupName);
        const fn = p.getFunctionParent();
        let inJsx = false;
        for (let q = p.parentPath; q && q !== fn; q = q.parentPath) {
          if (q.isJSXExpressionContainer()) {
            inJsx = true;
            break;
          }
        }
        const fnProp = fn?.parentPath;
        const holeProp =
          fnProp?.isObjectProperty() &&
          ["when", "each", "count", "on"].includes(keyName(fnProp.node.key));
        const contextTarget = definition(p.get("argument"));
        const contextRead =
          contextTarget?.isCallExpression() && lib(contextTarget.get("callee")) === "createContext";
        if (!host && !setupOnly && (inJsx || holeProp || contextRead)) {
          const attr = p.findParent(q => q.isJSXAttribute());
          const kind = contextRead
            ? "context-read"
            : attr && /^on[A-Z]/.test(keyName(attr.node.name))
              ? "bind"
              : "hole";
          const f = addPart(p, kind, kind === "bind" ? 2 : 0);
          f.deps.add(value(p.get("argument")).id);
        }
      },
      CallExpression(p) {
        const name = controlName(p);
        if (FLOW.has(name) || BOUNDARY.has(name)) addPart(p, FLOW.has(name) ? "flow" : "boundary");
        const host = componentOf(p);
        const nearest = p.getFunctionParent();
        if (
          host &&
          nearest?.parentPath.node === host.path.node &&
          !name &&
          !p.findParent(q => q.isYieldExpression())
        ) {
          const target = definition(p.get("callee"));
          if (!target || !componentByNode.has(target.node)) {
            host.unsafeSetup = true;
            findings.push({
              at: loc(p),
              rule: "1.7",
              message: `setup call ${p.get("callee").toString()} is not proved inert; eager fallback required`
            });
          }
        }
      }
    });
  // Read contexts conservatively across the module graph, including foreign edges.
  const contexts = new Map();
  for (const r of records.values())
    r.program.traverse({
      CallExpression(p) {
        if (lib(p.get("callee")) === "createContext") contexts.set(p.node, value(p));
      }
    });
  for (const r of records.values())
    r.program.traverse({
      CallExpression(p) {
        const callee = p.get("callee");
        if (!callee.isMemberExpression() || keyName(callee.node.property) !== "provide") return;
        const target = definition(callee.get("object"));
        const ctx = target && contexts.get(target.node);
        if (!ctx) return;
        const args = p.get("arguments")[0];
        const prop =
          args?.isObjectExpression() &&
          args.get("properties").find(q => keyName(q.node.key) === "value");
        if (prop) ctx.deps.add(value(prop.get("value")).id);
        addPart(p, "provide").deps.add(ctx.id);
      }
    });
  for (const ctx of contexts.values())
    if (!ctx.deps.size && ctx.path.node.arguments.length === 0) {
      ctx.base = 1;
      leaks.set(ctx.id, {
        id: ctx.id,
        at: ctx.at,
        name: ctx.path.parentPath.node.id?.name ?? "context",
        reason: "required context has no analysed provider or default"
      });
    }
  for (const p of parts) {
    p.component = componentOf(p.path)?.id ?? null;
    const c = facts.get(p.component);
    if (c) c.deps.add(p.id);
    const evaluated = value(p.path);
    if (evaluated && evaluated !== p) p.deps.add(evaluated.id);
  }
  // Monotone finite-height worklist: provenance and color reach a fixpoint together.
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of facts.values()) {
      const ds = [...f.deps].map(id => facts.get(id)).filter(Boolean);
      const p = Math.max(f.base, ...ds.map(d => d.p));
      const pending = f.pending || ds.some(d => d.pending);
      const failing = f.failing || ds.some(d => d.failing);
      if (p !== f.p || pending !== f.pending || failing !== f.failing) {
        f.p = p;
        f.pending = pending;
        f.failing = failing;
        changed = true;
      }
    }
  }
  const active = parts.filter(p => p.p > 0 || p.kind === "effect");
  const parent = new Map(active.map(p => [p.id, p.id]));
  function root(id) {
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r);
    return r;
  }
  const edgeKeys = new Set();
  function edge(a, b, reason) {
    if (a === b || !parent.has(a) || !parent.has(b)) return;
    const pair = [a, b].sort();
    const key = `${reason}:${pair.join("|")}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    merges.push({ rule: reason, sites: pair.map(id => facts.get(id).at) });
    const ar = root(a),
      br = root(b);
    if (ar !== br) parent.set(br, ar);
  }
  function reachable(f, seen = new Set()) {
    if (!f || seen.has(f.id)) return seen;
    seen.add(f.id);
    for (const id of f.deps) reachable(facts.get(id), seen);
    return seen;
  }
  const reach = new Map(active.map(p => [p.id, reachable(p)]));
  for (const a of active)
    for (const id of reach.get(a.id)) {
      if (!parent.has(id)) continue;
      const b = facts.get(id);
      edge(
        a.id,
        id,
        a.kind === "event" ? "M2" : a.kind === "provide" || contexts.has(b.path.node) ? "M3" : "M1"
      );
    }
  for (let i = 0; i < active.length; i++)
    for (const b of active.slice(i + 1)) {
      const a = active[i];
      if ([...reach.get(a.id)].some(id => leaks.has(id) && reach.get(b.id).has(id)))
        edge(a.id, b.id, "M6");
    }
  for (const control of active.filter(p => ["flow", "boundary"].includes(p.kind))) {
    for (const p of active)
      if (p.path.findParent(q => q.node === control.path.node)) {
        if (control.kind === "flow") edge(control.id, p.id, "M5");
        else if (p.pending || p.failing) edge(control.id, p.id, "M4");
      }
  }
  const captureFailures = [];
  // Without extraction, these are candidate edges: report the binding that would
  // need to cross, then merge its creator's component conservatively.
  for (const p of active) {
    const comp = facts.get(p.component);
    if (!comp) continue;
    p.path.traverse({
      ReferencedIdentifier(ref) {
        const binding = ref.scope.getBinding(ref.node.name);
        if (!binding || binding.kind === "module" || binding.kind === "param") return;
        const def = binding.path;
        if (!def.isVariableDeclarator() || !def.get("id").isIdentifier() || !def.get("init").node)
          return;
        if (def.findParent(q => q.node === p.path.node)) return;
        const target = definition(ref);
        const known = partByNode.get(target?.node);
        if (known || target?.isLiteral() || target?.isYieldExpression()) return;
        if (!def.findParent(q => q.node === comp.path.node)) return;
        if (!captureFailures.some(x => x.id === getId(def.get("id"))))
          captureFailures.push({
            id: getId(def.get("id")),
            variable: ref.node.name,
            at: loc(def.get("id")),
            reason: "setup-local value is not proved serializable at the candidate root edge"
          });
        for (const other of active)
          if (other.component === comp.id) edge(p.id, other.id, "CAPTURE_FALLBACK");
      }
    });
  }
  function collectGroups() {
    const groups = new Map();
    for (const p of active) {
      const id = root(p.id);
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(p);
    }
    return groups;
  }
  function spanOf(ps) {
    const compIds = new Set(ps.map(p => p.component));
    const anchors = [];
    function lift(path, comp, seen = new Set()) {
      if (!comp || seen.has(comp)) {
        anchors.push(path);
        return;
      }
      seen.add(comp);
      const calls = (callsites.get(comp) ?? []).filter(p => {
        const parent = componentOf(p)?.id;
        return parent && parent !== comp && compIds.has(parent) && !seen.has(parent);
      });
      if (!calls.length) anchors.push(path);
      else for (const call of calls) lift(call, componentOf(call)?.id, new Set(seen));
    }
    for (const p of ps)
      if (["hole", "bind", "foreign", "flow", "boundary"].includes(p.kind))
        lift(p.path, p.component);
    if (!anchors.length) return null;
    for (let candidate = anchors[0]; candidate; candidate = candidate.parentPath) {
      const isView =
        candidate.isJSXElement() ||
        candidate.isJSXFragment() ||
        (candidate.isCallExpression() &&
          ["h", ...FLOW, ...BOUNDARY].includes(lib(candidate.get("callee"))));
      if (
        isView &&
        anchors.every(
          p => p.node === candidate.node || p.findParent(q => q.node === candidate.node)
        )
      )
        return candidate;
    }
    return null;
  }
  // C0 1.5's safety rule requires merging overlapping hydration claims.
  // It has no numbered M-rule: keep this finding separate from M1-M6.
  let groups = collectGroups();
  let overlaps = true;
  while (overlaps) {
    overlaps = false;
    const candidates = [...groups.values()]
      .map(ps => ({ ps, span: spanOf(ps) }))
      .filter(x => x.span);
    for (let i = 0; i < candidates.length; i++)
      for (const b of candidates.slice(i + 1)) {
        const a = candidates[i];
        if (
          owners.get(a.span.node) === owners.get(b.span.node) &&
          a.span.node.start < b.span.node.end &&
          b.span.node.start < a.span.node.end &&
          root(a.ps[0].id) !== root(b.ps[0].id)
        ) {
          edge(a.ps[0].id, b.ps[0].id, "SPAN_OVERLAP");
          overlaps = true;
        }
      }
    if (overlaps) groups = collectGroups();
  }
  const roots = [...groups.values()].map((ps, i) => {
    const effects = ps.filter(p => p.kind === "effect");
    const unsafe = ps.some(p => facts.get(p.component)?.unsafeSetup);
    const mode =
      effects.length || unsafe
        ? "eager"
        : ps.some(p => p.kind === "foreign-source" || p.pending || p.p === 1)
          ? "visible"
          : "lazy";
    return {
      id: i + 1,
      span: spanOf(ps) ? loc(spanOf(ps)) : null,
      size: ps.length,
      mode,
      sites: ps.map(p => p.at),
      components: [...new Set(ps.map(p => facts.get(p.component)?.name).filter(Boolean))],
      effectReach: effects.map(e => ({
        at: e.at,
        touched: [...reach.get(e.id)]
          .filter(id => id !== e.id && parts.some(p => p.id === id))
          .map(id => facts.get(id).at),
        pulledIn: ps.filter(p => !reach.get(e.id).has(p.id)).map(p => p.at)
      })),
      fallback: unsafe ? "unproved setup work" : null
    };
  });
  const holes = parts.filter(p => p.kind === "hole" || p.kind === "bind");
  const elements = [];
  for (const r of records.values())
    r.program.traverse({
      JSXElement(p) {
        elements.push(value(p));
      }
    });
  return {
    definitions: {
      provenance: "S < U < C; join=max",
      contextSensitivityCap: 1,
      units: "static sites; joined props per component",
      markupBytes: "not measured",
      capture: "candidate edges, conservative refusal; serializer not invoked",
      limitations: [
        "Joined props lose per-call precision",
        "Spans unresolved across foreign ownership; no dynamic root counts",
        "Capture and span-overlap fallbacks are separate from M1-M6",
        "Foreign and helper calls may hide ownership",
        "Not safe as a codegen input"
      ]
    },
    modules: [...records.keys()],
    holes: { inert: holes.filter(p => p.p === 0).length, total: holes.length },
    elements: { inert: elements.filter(p => p.p === 0).length, total: elements.length },
    sources: parts
      .filter(p => ["cell", "memo", "foreign-source"].includes(p.kind))
      .map(p => ({ at: p.at, kind: p.kind, provenance: provenance[p.p], written: !!p.written })),
    components: components.map(c => ({
      at: c.at,
      name: c.name,
      provenance: provenance[c.p],
      inert: c.p === 0
    })),
    roots,
    merges,
    captureFailures,
    leaks: [...leaks.values()].map(l => ({
      ...l,
      clientParts: active.filter(p => reach.get(p.id).has(l.id)).length
    })),
    findings
  };
}
