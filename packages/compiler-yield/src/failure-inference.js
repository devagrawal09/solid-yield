// Native failure inference extends the analyzer's indexed project. The existing
// Analysis owns parsing/module identities; TypeScript resolves calls and classes.
import { authoredOpaqueGenerator } from "./native-generator.js";
import { Analysis } from "./semantic.js";
import { relative } from "node:path";
const union = (...sets) => new Set(sets.flatMap(s => [...s]));
const name = n => n?.name ?? n?.value;
/** `@solidjs/web` components that render no author code that can fail (F-S45). */
const SAFE_WEB_COMPONENTS = ["HydrationScript", "NoHydration"];
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
    classTypes = new Map(),
    callSites = new Map(),
    throwSites = new Map(),
    guardSites = new Map(),
    swallowed = new Map();
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
      "CallExpression|NewExpression"(path) {
        callSites.set(`${file}:${path.node.start}:${path.node.end}`, path);
      },
      Function(path) {
        const parent = path.parentPath;
        const label =
          name(path.node.id) ??
          (parent.isVariableDeclarator() ? name(parent.node.id) : name(path.node.key)) ??
          `<callback:${path.node.loc.start.line}:${path.node.loc.start.column + 1}>`;
        const server =
          path.node.async &&
          (record.server || path.node.body?.directives?.some(d => d.value.value === "use server"));
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
          calls: new Set(),
          provides: new Set(),
          timerFails: new Set()
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
  const contextId = path => {
    const node = nodeFor(path);
    let symbol = node && checker.getSymbolAtLocation(node);
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol?.declarations?.find(ts.isVariableDeclaration);
    const init = declaration?.initializer;
    if (!init || !ts.isCallExpression(init)) return null;
    const signature = checker.getResolvedSignature(init)?.declaration;
    const fn = signature?.name?.getText();
    if (
      fn !== "createContext" ||
      !/(solid-js|@solidjs)[/\\]/.test(signature.getSourceFile().fileName)
    )
      return null;
    return `${declaration.getSourceFile().fileName}#${declaration.name.getText()}`;
  };
  function provided(value) {
    if (!value?.node) return new Set();
    let tag;
    if (value.isJSXElement()) tag = value.get("openingElement.name");
    else if (value.isCallExpression()) tag = value.get("callee");
    if (!tag) return new Set();
    if (
      (tag.isJSXMemberExpression() || tag.isMemberExpression()) &&
      ["Provider", "provide"].includes(name(tag.node.property))
    )
      tag = tag.get("object");
    const ctx = contextId(tag);
    if (ctx) return new Set([ctx]);
    return target(tag)?.provides ?? new Set();
  }
  /**
   * F-S45: the context a value is, when it is `useContext(Ctx)` — directly, or
   * through constant bindings and hooks whose every return is that value.
   */
  const contextOfValue = (p, depth = 0) => {
    if (!p?.node || depth > 4) return null;
    if (p.isIdentifier()) {
      const binding = p.scope.getBinding(p.node.name);
      if (
        !binding?.constant ||
        !binding.path.isVariableDeclarator() ||
        !binding.path.get("id").isIdentifier()
      )
        return null;
      return contextOfValue(binding.path.get("init"), depth + 1);
    }
    if (!p.isCallExpression()) return null;
    const api = imported(p.get("callee"));
    if (api?.source === "solid-js" && api.name === "useContext")
      return p.node.arguments.length ? contextId(p.get("arguments.0")) : null;
    const fn = target(p);
    if (!fn || fn.path.node.generator || fn.path.node.async) return null;
    const body = fn.path.get("body");
    if (!body.isBlockStatement()) return contextOfValue(body, depth + 1);
    const returns = [];
    body.traverse({
      Function(q) {
        q.skip();
      },
      ReturnStatement(q) {
        returns.push(q.get("argument"));
      }
    });
    const ids = returns.map(r => contextOfValue(r, depth + 1));
    return ids.length && ids.every(id => id && id === ids[0]) ? ids[0] : null;
  };
  /**
   * F-S45: every value a context can hold — each provider's `value` and its
   * default — or `null` when one is not an object literal or the context
   * escapes (is used other than as a provider tag or a `useContext` argument).
   */
  let contextValueMap = null;
  const contextValues = id => {
    if (!contextValueMap) {
      contextValueMap = new Map();
      const add = (ctx, value) => {
        const values = contextValueMap.has(ctx) ? contextValueMap.get(ctx) : [];
        if (values)
          contextValueMap.set(
            ctx,
            value?.isObjectExpression() || value?.isArrayExpression() ? [...values, value] : null
          );
      };
      for (const [, record] of analysis.modules)
        record.program.traverse({
          "Identifier|JSXIdentifier"(q) {
            const binding = q.scope.getBinding(q.node.name);
            if (
              !binding ||
              binding.identifier === q.node ||
              !(binding.kind === "module" || binding.path.isVariableDeclarator())
            )
              return;
            if (q.isIdentifier() && !q.isReferenced()) return;
            if (q.parentPath.isImportSpecifier() || q.parentPath.isExportSpecifier()) return;
            if (q.isJSXIdentifier() && q.parentPath.isJSXAttribute()) return;
            const ctx = contextId(q);
            if (!ctx) return;
            if (q.parentPath.isJSXClosingElement()) return;
            let opening = q.parentPath;
            if (
              opening.isJSXMemberExpression() &&
              q.key === "object" &&
              name(opening.node.property) === "Provider"
            )
              opening = opening.parentPath;
            if (opening.isJSXOpeningElement()) {
              const attributes = opening.get("attributes");
              const attr = attributes.find(a => a.isJSXAttribute() && a.node.name.name === "value");
              const value = attr?.get("value");
              add(
                ctx,
                attributes.some(a => a.isJSXSpreadAttribute()) || !value?.isJSXExpressionContainer()
                  ? null
                  : value.get("expression")
              );
              return;
            }
            const call = q.parentPath;
            const api = call.isCallExpression() ? imported(call.get("callee")) : null;
            if (api?.source === "solid-js" && api.name === "useContext" && q.key === 0) return;
            add(ctx, null);
          }
        });
    }
    const values = contextValueMap.has(id) ? contextValueMap.get(id) : [];
    const [file, local] = [id.slice(0, id.lastIndexOf("#")), id.slice(id.lastIndexOf("#") + 1)];
    const declaration = analysis.modules.get(file)?.program.scope.getBinding(local)?.path;
    const init = declaration?.isVariableDeclarator() ? declaration.get("init") : null;
    if (!values || !init?.isCallExpression()) return null;
    const [fallback] = init.get("arguments");
    if (!fallback || fallback.isIdentifier({ name: "undefined" })) return values;
    return fallback.isObjectExpression() || fallback.isArrayExpression()
      ? [...values, fallback]
      : null;
  };
  const SETTER_PRODUCERS = [
    "createSignal",
    "createOptimistic",
    "createStore",
    "createOptimisticStore",
    "createProjection"
  ];
  /**
   * F-S45: what calling `member` of an object literal fails with: its function's
   * failures, nothing for a Solid setter (its callback arguments are the
   * caller's), a signal getter's computation (nothing for a plain value), or
   * `null` when the member is anything else.
   */
  const memberCall = (object, member, owner) => {
    if (!object?.isObjectExpression()) return null;
    let found = null;
    for (const prop of object.get("properties")) {
      if (prop.isSpreadElement()) return null;
      if (!prop.node.computed && name(prop.node.key) === member) found = prop;
    }
    if (!found) return null;
    if (found.isObjectMethod()) {
      const file = analysis.moduleOf.get(found.node)?.id;
      return invoke(byBody.get(`${file}:${found.node.body.start}`), owner);
    }
    return valueCall(found.get("value"), owner);
  };
  /** What calling a value held in a context's value fails with (see memberCall). */
  const valueCall = (value, owner) => {
    if (!value?.node) return null;
    const file = analysis.moduleOf.get(value.node)?.id;
    const body = fn => invoke(byBody.get(`${file}:${fn.node.body.start}`), owner);
    if (value.isFunction()) return body(value);
    if (!value.isIdentifier()) return null;
    const binding = value.scope.getBinding(value.node.name);
    if (!binding?.constant) return null;
    if (binding.path.isFunctionDeclaration()) return body(binding.path);
    if (!binding.path.isVariableDeclarator()) return null;
    const init = binding.path.get("init");
    if (init.isFunction()) return body(init);
    const pattern = binding.path.node.id;
    const api = init.isCallExpression() ? imported(init.get("callee")) : null;
    if (pattern.type !== "ArrayPattern" || api?.source !== "solid-js") return null;
    const index = pattern.elements.findIndex(
      e => e?.type === "Identifier" && e.name === value.node.name
    );
    if (index === 1 && SETTER_PRODUCERS.includes(api.name)) return new Set();
    if (index === 0 && ["createSignal", "createOptimistic"].includes(api.name)) {
      const [initial] = init.get("arguments");
      return initial?.isFunction() ? body(initial) : new Set();
    }
    return null;
  };
  /** The steps from a destructuring pattern to one of its names (indices and
   * keys), or `null` when it is behind a default, a rest or a computed key. */
  const patternPath = (pattern, target) => {
    if (pattern === target) return [];
    if (pattern?.type === "ArrayPattern")
      for (const [i, element] of pattern.elements.entries()) {
        const rest = element && patternPath(element, target);
        if (rest) return [i, ...rest];
      }
    if (pattern?.type === "ObjectPattern")
      for (const prop of pattern.properties) {
        if (prop.type !== "ObjectProperty" || prop.computed) continue;
        const rest = patternPath(prop.value, target);
        if (rest) return [name(prop.key), ...rest];
      }
    return null;
  };
  /** F-S45: a call through a name destructured from a context's value
   * (`const [, { setLocation }] = useRouter()`), or `null`. */
  const destructuredMember = (callee, owner) => {
    if (!callee.isIdentifier()) return null;
    const binding = callee.scope.getBinding(callee.node.name);
    const declarator = binding?.path;
    if (!binding?.constant || !declarator?.isVariableDeclarator()) return null;
    if (declarator.node.id === binding.identifier) return null;
    const steps = patternPath(declarator.node.id, binding.identifier);
    const id = steps?.length && contextOfValue(declarator.get("init"));
    const values = id && contextValues(id);
    if (!values?.length) return null;
    const effects = values.map(root => {
      let container = root;
      for (const step of steps.slice(0, -1)) {
        if (typeof step === "number") {
          if (!container?.isArrayExpression()) return null;
          container = container.get(`elements.${step}`);
        } else {
          const prop = container?.isObjectExpression()
            ? container
                .get("properties")
                .find(p => p.isObjectProperty() && !p.node.computed && name(p.node.key) === step)
            : null;
          container = prop?.get("value") ?? null;
        }
      }
      const last = steps.at(-1);
      return typeof last === "number"
        ? container?.isArrayExpression()
          ? valueCall(container.get(`elements.${last}`), owner)
          : null
        : memberCall(container, last, owner);
    });
    return effects.every(Boolean) ? union(...effects) : null;
  };
  /** F-S45: a call through a member of a context's value, or `null`. */
  const contextMember = (callee, owner) => {
    if (callee.isIdentifier()) return destructuredMember(callee, owner);
    if (!callee.isMemberExpression() || callee.node.computed) return null;
    const id = contextOfValue(callee.get("object"));
    const values = id && contextValues(id);
    if (!values?.length) return null;
    const effects = values.map(v => memberCall(v, name(callee.node.property), owner));
    return effects.every(Boolean) ? union(...effects) : null;
  };
  // A wrapper provides only what every returned subtree provides. An optional
  // provider in one branch cannot erase requirements in another branch.
  let provisionChanged = true;
  while (provisionChanged) {
    provisionChanged = false;
    for (const fn of functions) {
      const returns = [];
      const body = fn.path.get("body");
      if (body.isExpression()) returns.push(body);
      else
        body.traverse({
          Function(q) {
            q.skip();
          },
          ReturnStatement(q) {
            if (q.node.argument) returns.push(q.get("argument"));
          }
        });
      const parameter = fn.path.node.params[0];
      const propBinding = parameter?.name && fn.path.scope.getBinding(parameter.name);
      const contexts = [];
      for (const value of returns) {
        const references = [];
        const visit = ref => {
          if (
            !ref.isMemberExpression() ||
            name(ref.node.property) !== "children" ||
            !ref.get("object").isIdentifier({ name: parameter?.name }) ||
            ref.scope.getBinding(parameter.name) !== propBinding
          )
            return;
          const scope = new Set();
          let child = ref;
          for (let parent = ref.parentPath; parent; child = parent, parent = parent.parentPath) {
            if (parent.isJSXElement() && !child.isJSXOpeningElement())
              for (const id of provided(parent)) scope.add(id);
            if (parent.isCallExpression()) {
              let edge = ref;
              while (
                edge &&
                edge !== parent &&
                !(edge.isObjectProperty() && name(edge.node.key) === "children")
              )
                edge = edge.parentPath;
              if (edge !== parent) for (const id of provided(parent)) scope.add(id);
            }
            if (parent === value) break;
          }
          references.push(scope);
        };
        if (propBinding) {
          visit(value);
          value.traverse({ MemberExpression: visit });
        }
        // F-S41: a returned subtree that never places props.children provides
        // nothing to its callers (an app that renders its own provider is not a wrapper).
        contexts.push(...(references.length ? references : [new Set()]));
      }
      const common = contexts.length
        ? [...contexts[0]].filter(id => contexts.every(s => s.has(id)))
        : [];
      for (const id of common)
        if (!fn.provides.has(id)) {
          fn.provides.add(id);
          provisionChanged = true;
          if (/^[A-Z]/.test(fn.name)) fn.component = true;
        }
    }
  }
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
  /**
   * F-S37: `const value = useContext(Ctx); … if (!value) throw …`. Solid's
   * useContext throws first when no provider is above, so the guard can only
   * see a value the provider gave: it fires only for one its declared type
   * admits (falsy for `!value`, null/undefined for `== null` and friends).
   */
  const contextGuard = p => {
    let statement = p;
    if (statement.parentPath.isBlockStatement() && statement.parentPath.node.body.length === 1)
      statement = statement.parentPath;
    const branch = statement.parentPath;
    if (!branch?.isIfStatement() || statement.key !== "consequent" || branch.node.alternate)
      return null;
    const test = branch.get("test");
    /** @type {any} */ let subject = null;
    /** @type {"falsy" | "nullish" | "null" | "undefined"} */ let kind = "falsy";
    if (test.isUnaryExpression({ operator: "!" })) subject = test.get("argument");
    else if (test.isBinaryExpression() && ["==", "==="].includes(test.node.operator)) {
      const absent = x => x.isNullLiteral() || x.isIdentifier({ name: "undefined" });
      const [left, right] = [test.get("left"), test.get("right")];
      const literal = absent(right) ? right : absent(left) ? left : null;
      subject = literal === right ? left : literal === left ? right : null;
      kind =
        test.node.operator === "==" ? "nullish" : literal?.isNullLiteral() ? "null" : "undefined";
    }
    if (!subject?.isIdentifier()) return null;
    const binding = subject.scope.getBinding(subject.node.name);
    if (binding?.kind !== "const" || !binding.path.isVariableDeclarator()) return null;
    const init = binding.path.get("init");
    if (!init.isCallExpression()) return null;
    const api = imported(init.get("callee"));
    if (api?.source !== "solid-js" || api.name !== "useContext") return null;
    return { subject, kind };
  };
  const guardCanFire = guard => {
    const node = nodeFor(guard.subject);
    if (!node) return true;
    const type = checker.getTypeAtLocation(node);
    const F = ts.TypeFlags;
    const open = F.Any | F.Unknown | F.Instantiable;
    const mask =
      guard.kind === "falsy"
        ? open |
          F.Null |
          F.Undefined |
          F.Void |
          F.BooleanLike |
          F.NumberLike |
          F.StringLike |
          F.BigIntLike
        : guard.kind === "null"
          ? open | F.Null
          : guard.kind === "undefined"
            ? open | F.Undefined | F.Void
            : open | F.Null | F.Undefined | F.Void;
    return (type.isUnion() ? type.types : [type]).some(part => !!(part.flags & mask));
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
    if (contextId(callee)) return "context";
    // F-S45: marks an error safe to serialize; it does not throw.
    if (api?.source === "@solidjs/web" && api.name === "markSafeError") return "web";
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
      // An Errored fallback's `reset` (its second parameter) clears the
      // boundary and re-runs its children; the call itself throws nothing.
      const attribute = construct?.parentPath;
      const errored =
        attribute?.isJSXAttribute() && attribute.get("name").isJSXIdentifier({ name: "fallback" })
          ? imported(attribute.parentPath.get("name"))
          : null;
      if (
        binding?.kind === "param" &&
        construct?.isJSXExpressionContainer() &&
        errored?.source === "solid-js" &&
        errored.name === "Errored" &&
        fn.node.params[1]?.name === callee.node.name
      )
        return "errored-reset";
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
    // Node's own timer globals (`@types/node`) schedule as the DOM's do.
    const nodeGlobal =
      !!declaration &&
      /[\\/]node_modules[\\/]@types[\\/]node[\\/]/.test(declaration.getSourceFile().fileName);
    if (
      (builtin || nodeGlobal) &&
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
        valueType.flags & ts.TypeFlags.StringLike &&
        ["trim", "slice", "substring", "toLowerCase", "toUpperCase"].includes(method)
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
    // Context-held accessors and setters have the same Solid contract as
    // locally destructured signals, even when there is no local producer call.
    if (declaration && /(?:solid-js|@solidjs)[/\\]/.test(declaration.getSourceFile().fileName)) {
      let parent = declaration;
      while (parent && !ts.isInterfaceDeclaration(parent) && !ts.isTypeAliasDeclaration(parent))
        parent = parent.parent;
      if (["Accessor", "Setter", "Source", "Action"].includes(parent?.name?.text))
        return "signal-contract";
    }
    if (builtin) return "builtin";
    return null;
  };
  // Only declarations from the platform libraries are built-ins. A shadowed
  // Math/JSON or a package method must never inherit these contracts.
  const throwingBuiltins = {
    "JSON.parse": ["SyntaxError"],
    "JSON.stringify": ["TypeError"],
    URL: ["TypeError"],
    decodeURI: ["URIError"],
    decodeURIComponent: ["URIError"],
    encodeURI: ["URIError"],
    encodeURIComponent: ["URIError"],
    fetch: ["TypeError", "DOMException"],
    "Number.toFixed": ["RangeError"],
    "Number.toPrecision": ["RangeError"],
    "Number.toExponential": ["RangeError"],
    "Number.toString": ["RangeError"],
    "String.repeat": ["RangeError"],
    "String.normalize": ["RangeError"],
    RegExp: ["SyntaxError"],
    BigInt: ["SyntaxError", "RangeError", "TypeError"],
    "Date.toISOString": ["RangeError"],
    "Array.reduce": ["TypeError"],
    "Array.reduceRight": ["TypeError"],
    Array: ["RangeError"],
    Intl: ["RangeError", "TypeError"]
  };
  function platformFailures(p) {
    const callee = p.get("callee");
    let key = callee.isIdentifier() ? callee.node.name : "";
    if (callee.isMemberExpression()) {
      const object = callee.get("object"),
        method = name(callee.node.property);
      const node = nodeFor(object),
        type = node && checker.getTypeAtLocation(node);
      const text = object.toString();
      key =
        text === "JSON"
          ? `JSON.${method}`
          : text.startsWith("Intl") || text === "Intl"
            ? "Intl"
            : type?.flags & ts.TypeFlags.NumberLike || type?.symbol?.name === "Number"
              ? `Number.${method}`
              : type?.flags & ts.TypeFlags.StringLike || type?.symbol?.name === "String"
                ? `String.${method}`
                : type && (checker.isArrayType(type) || checker.isTupleType(type))
                  ? `Array.${method}`
                  : type?.symbol?.name === "Date"
                    ? `Date.${method}`
                    : "";
    }
    // Default numeric formatting is valid. Known valid literal options do not
    // add a possible RangeError; dynamic/out-of-range options retain it.
    const args = p.get("arguments");
    if (/^Number\.to(Fixed|Precision|Exponential)$/.test(key)) {
      if (!args.length || args[0].isIdentifier({ name: "undefined" })) return [];
      const minimum = key === "Number.toPrecision" ? 1 : 0;
      if (args[0].isNumericLiteral() && args[0].node.value >= minimum && args[0].node.value <= 100)
        return [];
    }
    if (
      key === "Number.toString" &&
      (!args.length ||
        (args[0].isNumericLiteral() && args[0].node.value >= 2 && args[0].node.value <= 36))
    )
      return [];
    if (key === "BigInt" && args[0]?.isNumericLiteral() && Number.isInteger(args[0].node.value))
      return [];
    if (/^Array\.reduce(Right)?$/.test(key) && args.length >= 2) return [];
    if (key === "Array") {
      if (args.length !== 1) return [];
      if (
        args[0].isNumericLiteral() &&
        Number.isInteger(args[0].node.value) &&
        args[0].node.value >= 0 &&
        args[0].node.value < 4294967296
      )
        return [];
      const node = nodeFor(args[0]),
        type = node && checker.getTypeAtLocation(node);
      if (type && !(type.flags & ts.TypeFlags.NumberLike)) return [];
    }
    return (throwingBuiltins[key] ?? []).map(error => {
      const id = `global:${error}`;
      const symbol = checker.resolveName(error, nodeFor(p), ts.SymbolFlags.Type, false);
      if (symbol) classTypes.set(id, checker.getDeclaredTypeOfSymbol(symbol));
      classes.set(id, { id, name: error, file: null });
      return id;
    });
  }
  const invoke = (fn, owner) => {
    if (!fn || opaque(fn.path)) return new Set(["unknown"]);
    owner.calls.add(fn.id);
    if (owner.timerFails) owner.timerFails = union(owner.timerFails, fn.timerFails);
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
    const result = flow(body, next);
    if (body.parentPath.isCatchClause() && binding) {
      const remaining = union(...result.paths.map(env => env.get(binding) ?? []));
      swallowed.set(`${owner.file}:${body.parentPath.node.start}`, remaining);
    }
    return result.effects;
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
      const kinds = forwarded ?? classSet(arg);
      const key = `${owner.file}:${p.node.start}:${p.node.end}`;
      throwSites.set(key, union(throwSites.get(key) ?? [], kinds));
      const guard = contextGuard(p);
      if (guard) {
        guardSites.set(key, guard.subject.node.name);
        if (!guardCanFire(guard)) return new Set();
      }
      return union(kinds, evaluate(arg, owner, caught));
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
      // A context is its own provider (F-S45); Solid's web components below fail nothing.
      const called =
        /^[A-Z]/.test(tag.node.name ?? "") &&
        api?.source !== "solid-js" &&
        !(api?.source === "@solidjs/web" && SAFE_WEB_COMPONENTS.includes(api.name)) &&
        !contextId(tag)
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
        ["resolve", "all", "allSettled", "race", "any"].includes(method)
      )
        return method === "allSettled" ? new Set() : argEffects;
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
        if (primitive === "builtin")
          return union(
            argEffects,
            platformFailures(p),
            receiver ? evaluate(receiver, owner, caught) : [],
            ...args
              .filter(a => a.isFunction())
              .map(a => invoke(byBody.get(`${owner.file}:${a.node.body.start}`), owner))
          );
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
          // A value with no `then` cannot be a thenable, so it cannot adopt a
          // rejection (an object literal, an array, a primitive).
          const settled = part => primitiveValue(part) || !checker.getPropertyOfType(part, "then");
          return union(
            argEffects,
            !type || (type.isUnion() ? type.types : [type]).every(settled) ? [] : ["unknown"]
          );
        }
        if (primitive === "promise-reject")
          return union(argEffects, args[0] ? classSet(args[0]) : ["unknown"]);
        let callbacks = args
          .filter(a => a.isFunction())
          .map(a => invoke(byBody.get(`${owner.file}:${a.node.body.start}`), owner));
        if (
          primitive === "scheduler" &&
          /^(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)$/.test(
            callee.node.name
          ) &&
          args[0]?.isIdentifier()
        ) {
          const callback = args[0];
          const binding = callback.scope.getBinding(callback.node.name);
          const executor = binding?.path.getFunctionParent();
          const producer = executor?.parentPath;
          const promiseCallback =
            binding?.kind === "param" &&
            producer?.isNewExpression() &&
            producer.get("callee").isIdentifier({ name: "Promise" }) &&
            !producer.scope.getBinding("Promise");
          if (promiseCallback) {
            // The Promise owns this delayed rejection. It is not a detached
            // timer failure, and its payload may be a non-Error value.
            if (executor.node.params[1] === binding.path.node)
              return union(argEffects, args[2] ? classSet(args[2]) : ["unknown"]);
          } else callbacks.push(invoke(target(callback), owner));
        }
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
        if (primitive === "scheduler" && owner.timerFails)
          owner.timerFails = union(owner.timerFails, ...callbacks);
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
      const resolved = target(p);
      return union(
        argEffects,
        resolved ? invoke(resolved, owner) : (contextMember(callee, owner) ?? invoke(null, owner)),
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
          : union(evaluate(fn.path.get("body"), fn), fn.timerFails);
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
            `This catch discards ${display(swallowed.get(`${file}:${p.node.start}`)?.size ? swallowed.get(`${file}:${p.node.start}`) : input)} without handling; return a fallback value, rethrow, or mark the absorption intentional with @yield-absorb.`
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
        if (fails.size) {
          emit(
            value,
            "EVENT_REJECTS",
            fn?.timerFails.size
              ? `This handler starts a timer that can fail with ${display(fn.timerFails)}; catch the failure inside the timer callback.`
              : `This handler can fail with ${display(fails)} and nothing catches it; wrap the body in try/catch, or declare the failure.`
          );
          diagnostics.at(-1).timer = !!fn?.timerFails.size;
        }
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
        if (
          !nativeCall(p) &&
          !target(p) &&
          !contextMember(p.get("callee"), { calls: new Set(), timerFails: null })
        )
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
      provides: [...fn.provides],
      timerFails: [...fn.timerFails],
      calls: [...fn.calls].map(id => id.replace(root, "<root>")),
      rejection: fn.server ? [...union(fn.fails, ["ChunkError"])].sort() : undefined
    })),
    call(file, start, end) {
      const site = callSites.get(`${file}:${start}:${end}`);
      if (!site) return null;
      const owner = functions.find(f => f.path.node === site.getFunctionParent()?.node) ?? {
        calls: new Set(),
        file
      };
      const fn = target(site);
      const total = evaluate(site, owner);
      const primitive = nativeCall(site);
      const callee = site.get("callee");
      const calleeNode = nodeFor(callee);
      const calleeType = calleeNode && checker.getTypeAtLocation(calleeNode);
      // Invalid authored calls must stay visible as ordinary TypeScript errors.
      // An any/unknown callee keeps the conservative foreign failure contract.
      const callable =
        !calleeType ||
        !!(calleeType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) ||
        (site.isNewExpression()
          ? calleeType.getConstructSignatures()
          : calleeType.getCallSignatures()
        ).length > 0;
      const promiseMethod =
        callee.isMemberExpression() &&
        ["then", "catch", "finally", "all", "race", "any", "allSettled", "reject"].includes(
          name(callee.node.property)
        );
      const own = fn
        ? invoke(fn, owner)
        : primitive === "builtin" && !promiseMethod
          ? new Set(platformFailures(site))
          : total;
      return {
        callable,
        fails: [...total],
        ownFails: [...own],
        native:
          !!nativeCall(site) && !["promise-constructor", "builtin"].includes(nativeCall(site)),
        target: fn?.id,
        promise: !!checker.getPromisedTypeOfPromise(checker.getTypeAtLocation(nodeFor(site))),
        async: !!fn?.path.node.async,
        resultType: checker.typeToString(
          checker.getTypeAtLocation(nodeFor(site)),
          nodeFor(site),
          ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType
        )
      };
    },
    guard(file, start, end) {
      return guardSites.get(`${file}:${start}:${end}`) ?? null;
    },
    foreignState(file, start, end) {
      return moduleState(tsNodes.get(`${file}:${start}:${end}`));
    },
    at(file, start) {
      return functions.find(f => f.file === file && f.path.node.start === start);
    },
    throws(file, start, end) {
      return [...(throwSites.get(`${file}:${start}:${end}`) ?? new Set(["unknown"]))];
    }
  };
}
