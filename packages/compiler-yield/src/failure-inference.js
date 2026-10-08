// Native failure inference extends the analyzer's indexed project. The existing
// Analysis owns parsing/module identities; TypeScript resolves calls and classes.
import { authoredOpaqueGenerator } from "./native-generator.js";
import { Analysis } from "./semantic.js";
import { relative } from "node:path";
const union = (...sets) => new Set(sets.flatMap(s => [...s]));
const name = n => n?.name ?? n?.value;
export function inferFailures(
  modules,
  { program, ts, root = process.cwd(), opaqueGenerators = false }
) {
  const resolve = (specifier, from) => {
    if (!specifier.startsWith(".")) return null;
    const base = new URL(specifier, `file://${from}`).pathname;
    return [base, base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx"].find(f =>
      modules.has(f)
    );
  };
  const analysis = new Analysis(modules, resolve);
  const opaque = path =>
    path.node.generator &&
    ((opaqueGenerators === true && authoredOpaqueGenerator(path)) ||
      (opaqueGenerators === "marked" &&
        path.node.body?.directives?.some(d => d.value.value === "use native opaque")));
  const checker = program.getTypeChecker();
  const functions = [],
    byBody = new Map(),
    tsNodes = new Map(),
    classes = new Map(),
    classTypes = new Map();
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
  const moduleState = node => {
    if (!opaqueGenerators || !node || !ts.isIdentifier(node)) return false;
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return (
      symbol?.declarations?.some(declaration => {
        while (
          ts.isBindingElement(declaration) ||
          ts.isArrayBindingPattern(declaration) ||
          ts.isObjectBindingPattern(declaration)
        )
          declaration = declaration.parent;
        if (
          !ts.isVariableDeclaration(declaration) ||
          !declaration.initializer ||
          !ts.isCallExpression(declaration.initializer)
        )
          return false;
        for (let parent = declaration.parent; parent; parent = parent.parent)
          if (ts.isFunctionLike(parent)) return false;
        const callee = declaration.initializer.expression;
        let api = checker.getSymbolAtLocation(callee);
        if (api?.flags & ts.SymbolFlags.Alias) api = checker.getAliasedSymbol(api);
        return (
          ["createSignal", "createStore", "createMemo"].includes(api?.name) &&
          api?.declarations?.some(d => /solid/.test(d.getSourceFile().fileName))
        );
      }) ?? false
    );
  };
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
      classTypes.set(id, type);
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
    if (api?.source === "solid-js") {
      if (
        opaqueGenerators &&
        ["createSignal", "createStore", "createMemo"].includes(api.name) &&
        !p.getFunctionParent()
      )
        return null;
      return api.name;
    }
    if (
      p.isNewExpression() &&
      callee.isIdentifier({ name: "Promise" }) &&
      !callee.scope.getBinding("Promise")
    )
      return "promise-constructor";
    if (callee.isIdentifier()) {
      const binding = callee.scope.getBinding(callee.node.name);
      const fn = binding?.path.getFunctionParent();
      const construct = fn?.parentPath;
      if (
        binding?.kind === "param" &&
        construct?.isNewExpression() &&
        construct.get("callee").isIdentifier({ name: "Promise" }) &&
        !construct.scope.getBinding("Promise")
      ) {
        if (fn.node.params[0]?.name === callee.node.name) return "promise-resolve";
        if (fn.node.params[1]?.name === callee.node.name) return "promise-reject";
      }
    }
    const call = nodeFor(p);
    const declaration = call && checker.getResolvedSignature(call)?.declaration;
    const builtin = declaration && program.isSourceFileDefaultLibrary(declaration.getSourceFile());
    if (builtin && callee.isSuper()) return "builtin-super";
    if (
      builtin &&
      callee.isIdentifier() &&
      !callee.scope.getBinding(callee.node.name) &&
      /^(setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame|cancelAnimationFrame|requestIdleCallback|cancelIdleCallback)$/.test(
        callee.node.name
      )
    )
      return "scheduler";
    if (builtin && callee.isMemberExpression()) {
      const receiver = callee.get("object");
      if (
        receiver.isIdentifier({ name: "console" }) &&
        !receiver.scope.getBinding("console") &&
        /^(log|info|warn|error|debug|trace)$/.test(name(callee.node.property))
      )
        return "console";

      const object = callee.get("object"),
        method = name(callee.node.property);
      const value = nodeFor(object),
        valueType = value && checker.getTypeAtLocation(value);
      if (
        valueType &&
        ((valueType.flags & ts.TypeFlags.StringLike &&
          ["trim", "slice", "substring", "toLowerCase", "toUpperCase"].includes(method)) ||
          (valueType.flags & ts.TypeFlags.NumberLike && method === "toString"))
      )
        return "primitive-method";
      if (
        object.isIdentifier() &&
        !object.scope.getBinding(object.node.name) &&
        ((object.node.name === "Math" && method === "random") ||
          (["Date", "performance"].includes(object.node.name) && method === "now")) &&
        p.node.arguments.length === 0
      )
        return "clock";
      const objectNode = nodeFor(object),
        type = objectNode && checker.getTypeAtLocation(objectNode);
      if (type && (checker.isArrayType(type) || checker.isTupleType(type))) {
        if (["map", "filter", "find", "findIndex", "some", "every", "forEach"].includes(method))
          return "array-callback";
        const element = checker.getIndexTypeOfType(type, ts.IndexKind.Number);
        const parts = element?.isUnion() ? element.types : element ? [element] : [];
        if (
          method === "join" &&
          parts.length &&
          parts.every(
            t =>
              t.flags &
              (ts.TypeFlags.StringLike |
                ts.TypeFlags.NumberLike |
                ts.TypeFlags.BooleanLike |
                ts.TypeFlags.Null |
                ts.TypeFlags.Undefined)
          )
        )
          return "primitive-array-join";
      }
    }
    if (callee.isIdentifier()) {
      const binding = callee.scope.getBinding(callee.node.name)?.path;
      if (binding?.isVariableDeclarator()) {
        const init = binding.get("init");
        if (init?.isCallExpression()) {
          const source = imported(init.get("callee"));
          if (
            source?.source === "solid-js" &&
            (!opaqueGenerators || !!init.getFunctionParent()) &&
            [
              "createSignal",
              "createOptimistic",
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
    if (!fn || opaque(fn.path)) return new Set(["unknown"]);
    owner.calls.add(fn.id);
    return union(fn.fails, fn.server ? new Set(["ChunkError"]) : []);
  };
  // Match nominal inheritance, never TypeScript structural assignability (I3/I4).
  function covered(id, guard) {
    if (id === "unknown") return false;
    let symbol = checker.getSymbolAtLocation(nodeFor(guard));
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const seen = new Set();
    function inherits(type) {
      if (!type || seen.has(type)) return false;
      seen.add(type);
      return type.getSymbol() === symbol || (type.getBaseTypes?.() ?? []).some(inherits);
    }
    return inherits(classTypes.get(id));
  }
  function handle(body, param, input, owner, caught) {
    const binding = param?.isIdentifier() ? param.scope.getBinding(param.node.name) : null;
    const next = new Map(caught);
    if (binding)
      next.set(binding, binding.constantViolations.length ? new Set(["unknown"]) : input);
    function branches(test, env) {
      let positive = true;
      if (test.isUnaryExpression({ operator: "!" })) {
        positive = false;
        test = test.get("argument");
      }
      if (
        !binding ||
        binding.constantViolations.length ||
        !test.isBinaryExpression({ operator: "instanceof" }) ||
        !test.get("left").isIdentifier({ name: param.node.name })
      )
        return [env, env];
      const incoming = env.get(binding),
        yes = new Map(env),
        no = new Map(env);
      yes.set(
        binding,
        new Set([...incoming].filter(k => k === "unknown" || covered(k, test.get("right"))))
      );
      no.set(binding, new Set([...incoming].filter(k => !covered(k, test.get("right")))));
      return positive ? [yes, no] : [no, yes];
    }
    function flow(p, env) {
      if (!p?.node) return { effects: new Set(), paths: [env] };
      if (p.isBlockStatement()) {
        let paths = [env],
          effects = new Set();
        for (const statement of p.get("body")) {
          const results = paths.map(e => flow(statement, e));
          effects = union(effects, ...results.map(r => r.effects));
          paths = results.flatMap(r => r.paths);
        }
        return { effects, paths };
      }
      if (p.isIfStatement()) {
        const [yes, no] = branches(p.get("test"), env);
        const a = flow(p.get("consequent"), yes),
          b = flow(p.get("alternate"), no);
        return {
          effects: union(evaluate(p.get("test"), owner, env), a.effects, b.effects),
          paths: [...a.paths, ...b.paths]
        };
      }
      return {
        effects: evaluate(p, owner, env),
        paths: p.isReturnStatement() || p.isThrowStatement() ? [] : [env]
      };
    }
    return flow(body, next).effects;
  }
  function evaluate(p, owner, caught = new Map()) {
    if (!p?.node) return new Set();
    if (Array.isArray(p)) return union(...p.map(q => evaluate(q, owner, caught)));
    if (p.isIdentifier() && moduleState(nodeFor(p))) return new Set(["unknown"]);
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
      // A promise returned without await is rejected after this catch has ended.
      const delayed = [];
      p.get("block").traverse({
        Function(q) {
          q.skip();
        },
        CallExpression(q) {
          const n = nodeFor(q);
          if (
            n &&
            checker.getPromisedTypeOfPromise(checker.getTypeAtLocation(n)) &&
            !q.findParent(a => a === p || a.isAwaitExpression())?.isAwaitExpression()
          )
            delayed.push(evaluate(q, owner, caught));
        }
      });
      return union(
        handle(handler.get("body"), handler.get("param"), body, owner, caught),
        ...delayed,
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
      if (
        receiver?.isIdentifier({ name: "Promise" }) &&
        !receiver.scope.getBinding("Promise") &&
        method === "reject"
      )
        return union(argEffects, args[0] ? classSet(args[0]) : new Set(["unknown"]));
      if (
        receiver?.isIdentifier({ name: "Promise" }) &&
        !receiver.scope.getBinding("Promise") &&
        method === "resolve"
      )
        return argEffects;
      if (["catch", "then", "finally"].includes(method)) {
        const input = evaluate(receiver, owner, caught);
        const handler = args[method === "then" ? 1 : 0];
        let handled = input;
        if (handler?.isFunction() && method !== "finally") {
          handled = handle(handler.get("body"), handler.get("params.0"), input, owner, caught);
        }
        if (
          handler?.node &&
          !handler.isFunction() &&
          !handler.isIdentifier({ name: "undefined" }) &&
          method !== "finally"
        )
          handled = union(input, invoke(target(handler), owner));
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
        if (primitive === "promise-resolve") {
          const value = args[0]?.node && nodeFor(args[0]);
          const type = value && checker.getTypeAtLocation(value);
          const primitiveValue = part =>
            !!(
              part.flags &
              (ts.TypeFlags.StringLike |
                ts.TypeFlags.NumberLike |
                ts.TypeFlags.BooleanLike |
                ts.TypeFlags.BigIntLike |
                ts.TypeFlags.Null |
                ts.TypeFlags.Undefined |
                ts.TypeFlags.Void)
            );
          return union(
            argEffects,
            !type || (type.isUnion() ? type.types : [type]).every(primitiveValue) ? [] : ["unknown"]
          );
        }
        if (primitive === "promise-reject")
          return union(argEffects, args[0] ? classSet(args[0]) : ["unknown"]);
        let callbacks = args
          .filter(a => a.isFunction())
          .map(a => invoke(byBody.get(`${owner.file}:${a.node.body.start}`), owner));
        // Getter aliases inherit their memo callback's failures.
        const binding = callee.isIdentifier()
          ? callee.scope.getBinding(callee.node.name)?.path
          : undefined;
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
        return union(argEffects, receiver ? evaluate(receiver, owner, caught) : [], ...callbacks);
      }
      // Intrinsics are explicit contracts, not a claim that arbitrary packages are pure.
      if (p.isNewExpression() && [...classSet(p)].some(k => k.startsWith("global:")))
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
      const next = opaque(fn.path)
        ? new Set(["unknown"])
        : fn.pure
          ? new Set()
          : evaluate(fn.path.get("body"), fn);
      if ([...next].some(k => !fn.fails.has(k))) {
        fn.fails = union(fn.fails, next);
        changed = true;
      }
    }
  }
  function intentionalAbsorption(p) {
    const marked = node =>
      [
        ...(node?.leadingComments ?? []),
        ...(node?.trailingComments ?? []),
        ...(node?.innerComments ?? [])
      ].some(c => /@yield-absorb\b/.test(c.value));
    let result = marked(p.node) || marked(p.node.body);
    p.get("body").traverse({
      enter(q) {
        result ||= marked(q.node);
      }
    });
    return result;
  }
  const diagnostics = [],
    unknownOrigins = [];
  const display = values =>
    [...values]
      .map(k => classes.get(k)?.name ?? k)
      .sort()
      .join(" | ");
  function completions(p) {
    if (!p?.node) return ["silent"];
    if (p.isReturnStatement()) return [p.node.argument ? "handled" : "discarded"];
    if (p.isThrowStatement()) return ["forwarded"];
    if (
      p.isExpressionStatement() &&
      p.get("expression").isAssignmentExpression() &&
      p.get("expression.left").isMemberExpression()
    )
      return ["handled"];
    if (
      p.isExpressionStatement() &&
      p.get("expression").isCallExpression() &&
      nativeCall(p.get("expression")) === "array-callback"
    ) {
      const callback = p.get("expression.arguments.0");
      if (callback?.isFunction() && completions(callback.get("body")).every(c => c === "handled"))
        return ["handled"];
    }
    if (p.isExpressionStatement() && p.get("expression").isCallExpression()) {
      const call = p.get("expression"),
        callee = call.get("callee");
      const binding = callee.isIdentifier()
        ? callee.scope.getBinding(callee.node.name)?.path
        : null;
      // A state write supplies a visible fallback, rather than discarding the error.
      if (
        binding?.isVariableDeclarator() &&
        binding.get("id").isArrayPattern() &&
        binding.node.id.elements[1]?.name === callee.node.name &&
        nativeCall(call)
      )
        return ["handled"];
    }
    if (p.isIfStatement())
      return [...completions(p.get("consequent")), ...completions(p.get("alternate"))];
    if (p.isBlockStatement()) {
      let paths = ["open"];
      for (const q of p.get("body"))
        paths = paths.flatMap(v =>
          v === "open" ? completions(q).map(c => (c === "silent" ? "open" : c)) : [v]
        );
      return paths.map(c => (c === "open" ? "silent" : c));
    }
    return ["silent"];
  }
  for (const [file, record] of analysis.modules) {
    const emit = (p, code, message) =>
      diagnostics.push({
        file,
        code,
        message,
        line: p.node.loc.start.line,
        column: p.node.loc.start.column + 1
      });
    const ownerOf = p =>
      functions.find(f => f.path.node === p.getFunctionParent()?.node) ?? {
        file,
        calls: new Set()
      };
    record.program.traverse({
      CatchClause(p) {
        const input = evaluate(p.parentPath.get("block"), ownerOf(p));
        if (
          input.size &&
          completions(p.get("body")).some(c => c === "silent" || c === "discarded") &&
          !intentionalAbsorption(p)
        )
          emit(
            p,
            "CATCH_SWALLOWS",
            `This catch discards ${display(input)} without handling; return a fallback value, rethrow, or mark the absorption intentional with @yield-absorb.`
          );
      },
      JSXAttribute(p) {
        if (!/^on[A-Z]/.test(name(p.node.name)) || !p.get("value").isJSXExpressionContainer())
          return;
        const value = p.get("value.expression");
        const fn = value.isFunction()
          ? byBody.get(`${file}:${value.node.body.start}`)
          : target(value);
        const binding = value.isIdentifier() ? value.scope.getBinding(value.node.name)?.path : null;
        const fails = fn
          ? fn.fails
          : binding?.isVariableDeclarator() &&
              binding.get("init").isCallExpression() &&
              nativeCall(binding.get("init"))
            ? evaluate(binding.get("init"), ownerOf(p))
            : new Set(["unknown"]);
        if (fails.size)
          emit(
            value,
            "EVENT_REJECTS",
            `This handler can fail with ${display(fails)} and nothing catches it; wrap the body in try/catch, or declare the failure.`
          );
      },
      ThrowStatement(p) {
        if (classSet(p.get("argument")).has("unknown"))
          unknownOrigins.push({
            file,
            start: p.node.start,
            end: p.node.end,
            line: p.node.loc.start.line,
            name: "throw " + p.get("argument").toString(),
            owner: ownerOf(p).id
          });
      },
      "CallExpression|NewExpression"(p) {
        if (!nativeCall(p) && !target(p))
          unknownOrigins.push({
            file,
            start: p.node.start,
            end: p.node.end,
            line: p.node.loc.start.line,
            name: p.get("callee").toString(),
            owner: ownerOf(p).id
          });
      }
    });
  }
  return {
    iterations,
    diagnostics,
    unknownOrigins,
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
      const callee = nodeFor(site.get("callee"));
      const calleeType = callee && checker.getTypeAtLocation(callee);
      // Invalid authored calls must stay visible as ordinary TypeScript errors.
      // An any/unknown callee keeps the conservative foreign failure contract.
      const callable =
        !calleeType ||
        !!(calleeType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) ||
        (site.isNewExpression()
          ? calleeType.getConstructSignatures()
          : calleeType.getCallSignatures()
        ).length > 0;
      return {
        callable,
        fails: [...evaluate(site, owner)],
        native: !!nativeCall(site) && nativeCall(site) !== "promise-constructor",
        target: fn?.id,
        promise: !!checker.getPromisedTypeOfPromise(checker.getTypeAtLocation(nodeFor(site))),
        async: !!fn?.path.node.async
      };
    },
    foreignState(file, start, end) {
      return moduleState(tsNodes.get(`${file}:${start}:${end}`));
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
