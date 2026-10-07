// Native failure inference extends the analyzer's indexed project. The existing
// Analysis owns parsing/module identities; TypeScript resolves calls and classes.
import { Analysis } from "./semantic.js";
import { relative } from "node:path";
const union = (...sets) => new Set(sets.flatMap(s => [...s]));
const name = n => n?.name ?? n?.value;
export function inferFailures(modules, { program, ts, root = process.cwd() }) {
  const resolve = (specifier, from) => {
    if (!specifier.startsWith(".")) return null;
    const base = new URL(specifier, `file://${from}`).pathname;
    return [base, base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx"].find(f =>
      modules.has(f)
    );
  };
  const analysis = new Analysis(modules, resolve);
  const checker = program.getTypeChecker();
  const functions = [],
    byBody = new Map(),
    tsNodes = new Map(),
    classes = new Map();
  for (const [file, record] of analysis.modules) {
    const source = program.getSourceFile(file);
    if (source) {
      const walk = n => {
        tsNodes.set(`${file}:${n.getStart(source)}:${n.end}`, n);
        ts.forEachChild(n, walk);
      };
      walk(source);
    }
    record.program.traverse({
      Function(path) {
        const parent = path.parentPath;
        const label =
          name(path.node.id) ??
          (parent.isVariableDeclarator() ? name(parent.node.id) : name(path.node.key)) ??
          `<callback:${path.node.loc.start.line}:${path.node.loc.start.column + 1}>`;
        const server =
          record.server || path.node.body?.directives?.some(d => d.value.value === "use server");
        let component = false;
        path.traverse({
          Function(q) {
            q.skip();
          },
          JSXElement() {
            component = true;
          },
          JSXFragment() {
            component = true;
          }
        });
        const fn = {
          id: `${file}:${path.node.start}`,
          file,
          name: label,
          line: path.node.loc.start.line,
          path,
          server: !!server,
          pure: record.pure,
          component: component && /^[A-Z]/.test(label),
          fails: new Set(),
          calls: new Set()
        };
        functions.push(fn);
        byBody.set(`${file}:${path.node.body.start}`, fn);
      }
    });
  }
  const nodeFor = p =>
    tsNodes.get(`${analysis.moduleOf.get(p.node)?.id}:${p.node.start}:${p.node.end}`);
  const functionFor = declaration => {
    if (!declaration) return null;
    if (ts.isVariableDeclaration(declaration)) declaration = declaration.initializer;
    if (!declaration) return null;
    return (
      declaration.body &&
      byBody.get(`${declaration.getSourceFile().fileName}:${declaration.body.getStart()}`)
    );
  };
  const target = p => {
    const node = nodeFor(p);
    if (!node) return null;
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const direct = functionFor(checker.getResolvedSignature(node)?.declaration);
      if (direct) return direct;
    }
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol?.declarations?.map(functionFor).find(Boolean) ?? null;
  };
  const classSet = p => {
    const node = nodeFor(p),
      result = new Set();
    if (!node) return new Set(["unknown"]);
    const type = checker.getTypeAtLocation(node);
    const types = type.isUnion() ? type.types : [type];
    for (const type of types) {
      const symbol = type.getSymbol();
      const declaration = symbol?.declarations?.find(
        d => ts.isClassDeclaration(d) || ts.isClassExpression(d)
      );
      // Built-in Error declarations are interfaces paired with constructor values.
      const builtin =
        symbol &&
        /^(Error|TypeError|RangeError|SyntaxError|ReferenceError|URIError|EvalError|AggregateError)$/.test(
          symbol.name
        ) &&
        symbol.declarations?.some(d => program.isSourceFileDefaultLibrary(d.getSourceFile()));
      if (!declaration && !builtin) {
        result.add("unknown");
        continue;
      }
      const id = builtin
        ? `global:${symbol.name}`
        : `${relative(root, declaration.getSourceFile().fileName)}#${symbol.name}@${declaration.pos}`;
      classes.set(id, {
        id,
        name: symbol.name,
        file: builtin ? null : relative(root, declaration.getSourceFile().fileName),
        nameStart: declaration?.name?.getStart(),
        classStart: declaration?.getStart()
      });
      result.add(id);
    }
    return result;
  };
  const imported = p => {
    if (!p?.isIdentifier() && !p?.isJSXIdentifier()) return null;
    const b = p.scope.getBinding(p.node.name)?.path;
    return b?.isImportSpecifier()
      ? { source: b.parentPath.node.source.value, name: name(b.node.imported) }
      : null;
  };
  const nativeCall = p => {
    const callee = p.get("callee"),
      api = imported(callee);
    if (api?.source === "solid-js") return api.name;
    if (callee.isIdentifier()) {
      const binding = callee.scope.getBinding(callee.node.name)?.path;
      if (binding?.isVariableDeclarator()) {
        const init = binding.get("init");
        if (init?.isCallExpression()) {
          const source = imported(init.get("callee"));
          if (
            source?.source === "solid-js" &&
            [
              "createSignal",
              "createMemo",
              "createStore",
              "createOptimisticStore",
              "createProjection"
            ].includes(source.name)
          )
            return source.name;
        }
      }
    }
    return null;
  };
  const invoke = (fn, owner) => {
    if (!fn) return new Set(["unknown"]);
    owner.calls.add(fn.id);
    return union(fn.fails, fn.server ? new Set(["ChunkError"]) : []);
  };
  function evaluate(p, owner, caught = new Map()) {
    if (!p?.node) return new Set();
    if (Array.isArray(p)) return union(...p.map(q => evaluate(q, owner, caught)));
    if (p.isFunction() || p.isClass() || p.isImportDeclaration() || p.isTSType()) return new Set();
    if (p.isThrowStatement()) {
      const arg = p.get("argument");
      const forwarded = arg.isIdentifier()
        ? caught.get(arg.scope.getBinding(arg.node.name))
        : undefined;
      return union(forwarded ?? classSet(arg), evaluate(arg, owner, caught));
    }
    if (p.isTryStatement()) {
      const body = evaluate(p.get("block"), owner, caught),
        handler = p.get("handler");
      if (!handler.node) return union(body, evaluate(p.get("finalizer"), owner, caught));
      const next = new Map(caught),
        param = handler.get("param");
      if (param?.isIdentifier()) {
        const binding = handler.scope.getBinding(param.node.name);
        const escaping = binding?.referencePaths.some(
          r =>
            !(
              r.parentPath.isThrowStatement() ||
              (r.parentPath.isBinaryExpression() && r.parentPath.node.operator === "instanceof")
            )
        );
        next.set(binding, escaping ? new Set(["unknown"]) : body);
      }
      return union(
        evaluate(handler.get("body"), owner, next),
        evaluate(p.get("finalizer"), owner, caught)
      );
    }
    if (p.isJSXElement()) {
      const tag = p.get("openingElement.name"),
        api = imported(tag);
      const attrs = p.get("openingElement.attributes");
      if (api?.source === "solid-js" && api.name === "Errored")
        return union(...attrs.map(a => evaluate(a, owner, caught))); // children are handled, fallback is not
      const called =
        /^[A-Z]/.test(tag.node.name ?? "") && api?.source !== "solid-js"
          ? invoke(target(tag), owner)
          : new Set();
      return union(
        called,
        ...attrs.map(a => evaluate(a, owner, caught)),
        ...p.get("children").map(c => evaluate(c, owner, caught))
      );
    }
    if (p.isJSXExpressionContainer() && p.get("expression").isFunction())
      return invoke(byBody.get(`${owner.file}:${p.node.expression.body.start}`), owner);
    if (p.isCallExpression() || p.isOptionalCallExpression() || p.isNewExpression()) {
      const callee = p.get("callee"),
        args = p.get("arguments");
      const method = callee.isMemberExpression() && name(callee.node.property);
      const receiver = callee.isMemberExpression() ? callee.get("object") : null;
      const argEffects = union(...args.map(a => evaluate(a, owner, caught)));
      if (receiver?.isIdentifier({ name: "Promise" }) && method === "reject")
        return union(argEffects, args[0] ? classSet(args[0]) : new Set(["unknown"]));
      if (receiver?.isIdentifier({ name: "Promise" }) && method === "resolve") return argEffects;
      if (["catch", "then", "finally"].includes(method)) {
        const input = evaluate(receiver, owner, caught);
        const handler = args[method === "then" ? 1 : 0];
        let handled = input;
        if (handler?.isFunction() && method !== "finally") {
          const next = new Map(caught),
            param = handler.get("params.0");
          if (param?.isIdentifier()) {
            const binding = handler.scope.getBinding(param.node.name);
            const escaping = binding?.referencePaths.some(
              r =>
                !(
                  r.parentPath.isThrowStatement() ||
                  (r.parentPath.isBinaryExpression() && r.parentPath.node.operator === "instanceof")
                )
            );
            next.set(binding, escaping ? new Set(["unknown"]) : input);
          }
          handled = evaluate(handler.get("body"), owner, next);
        }
        if (
          handler?.node &&
          !handler.isFunction() &&
          !handler.isIdentifier({ name: "undefined" }) &&
          method !== "finally"
        )
          handled = invoke(target(handler), owner);
        const signature = checker.getResolvedSignature(nodeFor(p))?.declaration;
        const nativePromise =
          signature && program.isSourceFileDefaultLibrary(signature.getSourceFile());
        const callback = method === "then" ? args[0] : method === "finally" ? args[0] : null;
        return union(
          argEffects,
          nativePromise ? [] : ["unknown"],
          handled,
          callback?.isFunction()
            ? invoke(byBody.get(`${owner.file}:${callback.node.body.start}`), owner)
            : callback?.node && !callback.isIdentifier({ name: "undefined" })
              ? invoke(target(callback), owner)
              : []
        );
      }
      const primitive = nativeCall(p);
      if (primitive) {
        let callbacks = args
          .filter(a => a.isFunction())
          .map(a => invoke(byBody.get(`${owner.file}:${a.node.body.start}`), owner));
        // Getter aliases inherit their memo callback's failures.
        const binding = callee.isIdentifier() && callee.scope.getBinding(callee.node.name)?.path;
        if (binding?.isVariableDeclarator()) {
          const init = binding.get("init");
          if (init?.isCallExpression())
            callbacks = callbacks.concat(
              init
                .get("arguments")
                .filter(a => a.isFunction())
                .map(a => invoke(byBody.get(`${owner.file}:${a.node.body.start}`), owner))
            );
        }
        return union(argEffects, ...callbacks);
      }
      // Intrinsics are explicit contracts, not a claim that arbitrary packages are pure.
      if (
        p.isNewExpression() &&
        /^(Error|TypeError|RangeError|SyntaxError|ReferenceError|URIError|EvalError|AggregateError)$/.test(
          callee.node.name ?? ""
        )
      )
        return argEffects;
      if (p.isNewExpression() && !classSet(p).has("unknown")) {
        const type = checker.getTypeAtLocation(nodeFor(p));
        const declaration = type
          .getSymbol()
          ?.declarations?.find(d => ts.isClassDeclaration(d) || ts.isClassExpression(d));
        const seen = new Set();
        const constructorEffects = decl => {
          if (!decl || seen.has(decl)) return new Set(["unknown"]);
          seen.add(decl);
          let klass;
          analysis.modules.get(decl.getSourceFile().fileName)?.program.traverse({
            Class(q) {
              if (q.node.id?.start === decl.name?.getStart()) klass = q;
            }
          });
          if (!klass) return new Set(["unknown"]);
          const effects = [];
          const ctor = klass.get("body.body").find(q => q.isClassMethod({ kind: "constructor" }));
          if (ctor)
            effects.push(
              invoke(byBody.get(`${decl.getSourceFile().fileName}:${ctor.node.body.start}`), owner)
            );
          for (const field of klass.get("body.body"))
            if (field.isClassProperty() && !field.node.static)
              effects.push(evaluate(field.get("value"), owner, caught));
          if (!ctor && klass.node.superClass) {
            const base = nodeFor(klass.get("superClass"));
            let symbol = base && checker.getSymbolAtLocation(base);
            if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
            const builtInError =
              symbol &&
              /^(Error|TypeError|RangeError|SyntaxError|ReferenceError|URIError|EvalError|AggregateError)$/.test(
                symbol.name
              ) &&
              symbol.declarations?.some(d => program.isSourceFileDefaultLibrary(d.getSourceFile()));
            if (!builtInError)
              effects.push(
                constructorEffects(
                  symbol?.declarations?.find(
                    d => ts.isClassDeclaration(d) || ts.isClassExpression(d)
                  )
                )
              );
          }
          return union(...effects);
        };
        return union(argEffects, constructorEffects(declaration));
      }
      return union(
        argEffects,
        invoke(target(p), owner),
        ...args
          .filter(a => a.isFunction())
          .map(a => invoke(byBody.get(`${owner.file}:${a.node.body.start}`), owner))
      );
    }
    const effects = [];
    for (const child of Object.values(
      p.get
        ? Object.fromEntries(
            Object.keys(p.node)
              .filter(k => p.node[k] && (p.node[k]?.type || Array.isArray(p.node[k])))
              .map(k => [k, p.get(k)])
          )
        : {}
    )) {
      if (Array.isArray(child)) for (const c of child) effects.push(evaluate(c, owner, caught));
      else if (child?.node) effects.push(evaluate(child, owner, caught));
    }
    return union(...effects);
  }
  let changed = true,
    iterations = 0;
  while (changed) {
    changed = false;
    iterations++;
    for (const fn of functions) {
      const next = fn.pure ? new Set() : evaluate(fn.path.get("body"), fn);
      if ([...next].some(k => !fn.fails.has(k))) {
        fn.fails = union(fn.fails, next);
        changed = true;
      }
    }
  }
  return {
    iterations,
    classes: [...classes.values()],
    functions: functions.map(({ path, pure, ...fn }) => ({
      ...fn,
      file: relative(root, fn.file),
      id: fn.id.replace(root, "<root>"),
      fails: [...fn.fails].sort(),
      calls: [...fn.calls].map(id => id.replace(root, "<root>")),
      rejection: fn.server ? [...union(fn.fails, ["ChunkError"])].sort() : undefined
    })),
    call(file, start, end) {
      let site;
      analysis.modules.get(file)?.program.traverse({
        "CallExpression|NewExpression"(p) {
          if (p.node.start === start && p.node.end === end) site = p;
        }
      });
      if (!site) return null;
      const owner = functions.find(f => f.path.node === site.getFunctionParent()?.node) ?? {
        calls: new Set(),
        file
      };
      const fn = target(site);
      return {
        fails: [...evaluate(site, owner)],
        native: !!nativeCall(site),
        target: fn?.id,
        promise: !!checker.getPromisedTypeOfPromise(checker.getTypeAtLocation(nodeFor(site))),
        async: !!fn?.path.node.async
      };
    },
    at(file, start) {
      return functions.find(f => f.file === file && f.path.node.start === start);
    },
    throws(file, start, end) {
      const record = analysis.modules.get(file);
      let found;
      record?.program.traverse({
        ThrowStatement(p) {
          if (p.node.start === start && p.node.end === end) found = classSet(p.get("argument"));
        }
      });
      return [...(found ?? new Set(["unknown"]))];
    }
  };
}
