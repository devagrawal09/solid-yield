// Native failure inference extends the analyzer's indexed project. The existing
// Analysis owns parsing/module identities; TypeScript resolves calls and classes.
import { authoredOpaqueGenerator } from "./native-generator.js";
import { Analysis } from "./semantic.js";
import { relative } from "node:path";
const union = (...sets) => new Set(sets.flatMap(s => [...s]));
const name = n => n?.name ?? n?.value;
/** `@solidjs/web` components that render no author code that can fail (F-S45). */
const SAFE_WEB_COMPONENTS = ["HydrationScript", "NoHydration"];
/** A member observation cannot expose the provider bag or mutate its slots.
 * Resolve own data members, not getters or an annotation hiding an unknown
 * implementation. Callable aliases may only be called or handed to DOM events.
 * @param {typeof import('typescript')} ts
 * @param {import('typescript').TypeChecker} checker
 * @param {import('typescript').VariableDeclaration} declaration
 * @param {import('typescript').Node} use
 * @param {boolean} [allowGenerators]
 */
export function providerMemberObservation(ts, checker, declaration, use, allowGenerators = false) {
  const unwrap = node => {
    while (
      node &&
      (ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isTypeAssertionExpression(node) ||
        ts.isNonNullExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isYieldExpression(node))
    )
      node = node.expression;
    return node;
  };
  const api = node => {
    const imported = checker.getSymbolAtLocation(node)?.declarations?.find(ts.isImportSpecifier);
    const module = imported?.parent.parent.parent;
    return imported &&
      module &&
      ts.isImportDeclaration(module) &&
      ts.isStringLiteral(module.moduleSpecifier)
      ? { module: module.moduleSpecifier.text, name: (imported.propertyName ?? imported.name).text }
      : null;
  };
  const symbolAt = node => {
    let symbol =
      ts.isIdentifier(node) && ts.isShorthandPropertyAssignment(node.parent)
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : checker.getSymbolAtLocation(node);
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol;
  };
  const origin = (node, seen = new Set()) => {
    node = unwrap(node);
    if (!node || seen.has(node)) return undefined;
    seen = new Set([...seen, node]);
    if (ts.isIdentifier(node)) {
      const binding = symbolAt(node)?.valueDeclaration;
      if (binding && ts.isVariableDeclaration(binding) && binding.parent.flags & ts.NodeFlags.Const)
        return origin(binding.initializer, seen);
      if (binding && ts.isFunctionDeclaration(binding)) return binding;
    }
    if (ts.isCallExpression(node)) {
      const helper = api(node.expression);
      if (helper?.module === "solid-yield/internal") {
        if (helper.name === "nativeArgument") return origin(node.arguments[0], seen);
        if (helper.name === "nativeLexicalCallback") return origin(node.arguments[1], seen);
      }
    }
    return node;
  };
  const implementation = node => {
    node = origin(node);
    if (
      !node ||
      !(
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node)
      ) ||
      !node.body ||
      node.getSourceFile().isDeclarationFile ||
      (!allowGenerators && node.asteriskToken)
    )
      return undefined;
    if (
      ts.isBlock(node.body) &&
      node.body.statements.some(
        statement =>
          ts.isExpressionStatement(statement) &&
          ts.isStringLiteral(statement.expression) &&
          statement.expression.text === "use native opaque"
      )
    )
      return undefined;
    return node;
  };
  const memberName = node => {
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression &&
      (ts.isStringLiteral(node.argumentExpression) || ts.isNumericLiteral(node.argumentExpression))
    )
      return node.argumentExpression.text;
    return undefined;
  };
  const valuesOf = (node, name, seen = new Set()) => {
    node = origin(node);
    if (!node || seen.has(node)) return undefined;
    seen = new Set([...seen, node]);
    if (ts.isObjectLiteralExpression(node)) {
      // An unknown computed key can overwrite the named data slot (including
      // with a getter). Do not silently ignore that possible collision.
      if (
        node.properties.some(
          property =>
            ts.isSpreadAssignment(property) ||
            (property.name && ts.isComputedPropertyName(property.name))
        )
      )
        return undefined;
      if (name === "__proto__") return undefined;
      const properties = node.properties.filter(
        property =>
          property.name &&
          !ts.isComputedPropertyName(property.name) &&
          (ts.isIdentifier(property.name) ||
            ts.isStringLiteral(property.name) ||
            ts.isNumericLiteral(property.name)) &&
          property.name.text === name
      );
      if (properties.length !== 1) return undefined;
      const property = properties[0];
      if (ts.isPropertyAssignment(property)) return [property.initializer];
      if (ts.isShorthandPropertyAssignment(property)) return [property.name];
      if (ts.isMethodDeclaration(property)) return [property];
      return undefined;
    }
    if (!ts.isCallExpression(node)) return undefined;
    const helper = api(node.expression);
    const fn =
      helper?.module === "solid-yield/internal" && helper.name === "nativeInvoke"
        ? implementation(node.arguments[0])
        : implementation(node.expression);
    if (!fn) return undefined;
    const returns = [];
    const visit = child => {
      if (ts.isFunctionLike(child)) return;
      if (ts.isReturnStatement(child)) returns.push(child.expression);
      else ts.forEachChild(child, visit);
    };
    if (ts.isBlock(fn.body)) ts.forEachChild(fn.body, visit);
    else returns.push(fn.body);
    const values = returns.map(value => valuesOf(value, name, seen));
    return values.length && values.every(Boolean) ? values.flat() : undefined;
  };
  const sourceCall = node => {
    node = unwrap(node);
    if (!node || !ts.isCallExpression(node)) return false;
    const imported = api(node.expression);
    return (
      imported &&
      ["solid-js", "solid-yield"].includes(imported.module) &&
      [
        "createSignal",
        "createMemo",
        "createOptimistic",
        "createStore",
        "createOptimisticStore",
        "createProjection",
        "$signal",
        "$memo",
        "$optimistic",
        "$store",
        "$optimisticStore",
        "$projection",
        "constant"
      ].includes(imported.name)
    );
  };
  const receiverFree = node => {
    const resolved = origin(node);
    if (!resolved) return false;
    if (sourceCall(resolved)) return true;
    if (ts.isIdentifier(resolved)) {
      const binding = symbolAt(resolved)?.valueDeclaration;
      if (
        binding &&
        ts.isBindingElement(binding) &&
        !binding.dotDotDotToken &&
        ts.isArrayBindingPattern(binding.parent) &&
        binding.parent.elements.indexOf(binding) < 2 &&
        ts.isVariableDeclaration(binding.parent.parent) &&
        sourceCall(binding.parent.parent.initializer)
      )
        return true;
    }
    const fn = implementation(resolved);
    if (!fn) return false;
    let safe = true;
    const visit = child => {
      if (
        child.kind === ts.SyntaxKind.ThisKeyword ||
        child.kind === ts.SyntaxKind.SuperKeyword ||
        (ts.isCallExpression(child) &&
          ts.isIdentifier(child.expression) &&
          child.expression.text === "eval")
      )
        safe = false;
      if (safe) ts.forEachChild(child, visit);
    };
    visit(fn.body);
    for (const parameter of fn.parameters) {
      if (parameter.initializer) visit(parameter.initializer);
      if (ts.isBindingPattern(parameter.name)) visit(parameter.name);
    }
    return safe;
  };
  const outer = node => {
    while (
      node.parent &&
      (ts.isParenthesizedExpression(node.parent) ||
        ts.isAsExpression(node.parent) ||
        ts.isTypeAssertionExpression(node.parent) ||
        ts.isNonNullExpression(node.parent) ||
        ts.isSatisfiesExpression(node.parent))
    )
      node = node.parent;
    return node;
  };
  const leafUse = (node, seen = new Set()) => {
    node = outer(node);
    const parent = node.parent;
    if (ts.isYieldExpression(parent) && parent.asteriskToken) return true;
    if (ts.isCallExpression(parent) && parent.expression === node) return true;
    if (ts.isCallExpression(parent)) {
      const helper = api(parent.expression);
      if (helper?.module === "solid-yield/internal" && helper.name === "nativeArgument")
        return leafUse(parent, seen);
      if (
        helper?.module === "solid-yield" &&
        helper.name === "$event" &&
        parent.arguments[0] === node
      )
        return true;
      if (
        helper?.module === "solid-yield/internal" &&
        helper.name === "nativeInvoke" &&
        parent.arguments[0] === node
      )
        return origin(parent.arguments[1]) === origin(declaration.initializer);
    }
    if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) {
      const attribute = parent.parent;
      const opening = attribute.parent.parent;
      return (
        ts.isIdentifier(attribute.name) &&
        /^on[A-Z]/.test(attribute.name.text) &&
        ts.isIdentifier(opening.tagName) &&
        /^[a-z]/.test(opening.tagName.text)
      );
    }
    if (
      !ts.isVariableDeclaration(parent) ||
      parent.initializer !== node ||
      !ts.isIdentifier(parent.name) ||
      !(parent.parent.flags & ts.NodeFlags.Const)
    )
      return false;
    if (
      ts.isVariableStatement(parent.parent.parent) &&
      parent.parent.parent.modifiers?.some(
        modifier => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
    )
      return false;
    const symbol = checker.getSymbolAtLocation(parent.name);
    if (!symbol || seen.has(symbol)) return false;
    seen = new Set([...seen, symbol]);
    let safe = true;
    const visit = child => {
      if (!safe || ts.isTypeNode(child)) return;
      if (ts.isIdentifier(child) && child !== parent.name && symbolAt(child) === symbol)
        safe = leafUse(child, seen);
      ts.forEachChild(child, visit);
    };
    visit(parent.getSourceFile());
    return safe;
  };
  use = outer(use);
  let member = use.parent;
  if (
    ts.isCallExpression(member) &&
    member.arguments[1] === use &&
    api(member.expression)?.module === "solid-yield/internal" &&
    api(member.expression)?.name === "nativeInvoke"
  ) {
    const callee = origin(member.arguments[0]);
    if (
      !callee ||
      !(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) ||
      origin(callee.expression) !== origin(declaration.initializer)
    )
      return false;
    member = callee;
  }
  if (
    !(ts.isPropertyAccessExpression(member) || ts.isElementAccessExpression(member)) ||
    (member.expression !== use && origin(member.expression) !== origin(declaration.initializer))
  )
    return false;
  const name = memberName(member);
  const values = name === undefined ? undefined : valuesOf(declaration.initializer, name);
  return !!values?.length && values.every(receiverFree) && leafUse(member);
}
export function inferFailures(
  modules,
  { program, ts, root = process.cwd(), opaqueGenerators = false }
) {
  // Analysis parses and indexes the modules; nothing here evaluates through it
  // (TypeScript resolves calls and imports), so it takes no import resolver
  const analysis = new Analysis(modules, null);
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
    // Babel keys a body without its parentheses: `() => ({ … })`.
    let body = declaration.body;
    while (body && ts.isParenthesizedExpression(body)) body = body.expression;
    return body && byBody.get(`${declaration.getSourceFile().fileName}:${body.getStart()}`);
  };
  /** `api.save()` on a bag held in a local `const api = { … }`: its member's
   * implementation is what the literal says only while every use of the bag
   * keeps it as it was made (no write to a member, no escape to code that
   * could), which `localMemberTarget` proves. @param {Path} p */
  const literalBag = p => {
    let member = p.isCallExpression() ? p.get("callee") : p;
    while (
      member.isTSAsExpression() ||
      member.isTSNonNullExpression() ||
      member.isTSSatisfiesExpression() ||
      member.isParenthesizedExpression()
    )
      member = member.get("expression");
    if (!member.isMemberExpression()) return false;
    const object = member.get("object");
    if (!object.isIdentifier()) return false;
    const binding = object.scope.getBinding(object.node.name);
    if (!binding?.constant || !binding.path.isVariableDeclarator()) return false;
    let init = binding.path.get("init");
    while (
      init.isTSAsExpression() ||
      init.isTSNonNullExpression() ||
      init.isTSSatisfiesExpression() ||
      init.isParenthesizedExpression()
    )
      init = init.get("expression");
    return init.isObjectExpression();
  };
  const target = p => {
    const node = nodeFor(p);
    if (!node) return null;
    if (literalBag(p)) return localMemberTarget(p);
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const direct = functionFor(checker.getResolvedSignature(node)?.declaration);
      if (direct) return direct;
    }
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol?.declarations?.map(functionFor).find(Boolean) ?? localMemberTarget(p);
  };
  // A local provider member can be called before useContext (including a
  // callback extracted for a DOM event). Use the actual implementation only
  // after the complete bag path passes the same immutability proof.
  function localMemberTarget(path) {
    const seen = new Set();
    const follow = value => {
      if (!value?.node || seen.has(value.node)) return null;
      seen.add(value.node);
      if (
        value.isTSAsExpression() ||
        value.isTSNonNullExpression() ||
        value.isTSSatisfiesExpression() ||
        value.isParenthesizedExpression()
      )
        return follow(value.get("expression"));
      if (value.isIdentifier()) {
        const binding = value.scope.getBinding(value.node.name);
        if (binding?.constant && binding.path.isVariableDeclarator())
          return follow(binding.path.get("init"));
      }
      return value;
    };
    const member = follow(path.isCallExpression() ? path.get("callee") : path);
    if (!member?.isMemberExpression()) return null;
    const key = member.node.computed
      ? member.get("property").isStringLiteral()
        ? member.node.property.value
        : null
      : name(member.node.property);
    const object = member.get("object");
    if (key == null || !object.isIdentifier()) return null;
    const binding = object.scope.getBinding(object.node.name);
    if (!binding?.constant || !binding.path.isVariableDeclarator()) return null;
    const allowed = new Set();
    for (let reference of binding.referencePaths) {
      while (
        reference.parentPath?.isTSAsExpression() ||
        reference.parentPath?.isTSNonNullExpression() ||
        reference.parentPath?.isTSSatisfiesExpression() ||
        reference.parentPath?.isParenthesizedExpression()
      )
        reference = reference.parentPath;
      const expression = reference.parentPath;
      const attribute = expression?.isJSXExpressionContainer() ? expression.parentPath : null;
      const opening = attribute?.isJSXAttribute() ? attribute.parentPath : null;
      if (
        opening?.isJSXOpeningElement() &&
        name(attribute.node.name) === "value" &&
        contextId(opening.get("name")) &&
        !opening.node.attributes.some(a => a.type === "JSXSpreadAttribute")
      )
        allowed.add(reference.node);
    }
    if (!stableProvider(binding, allowed)) return null;
    const values = providerValues(binding.path.get("init"));
    if (!values?.length) return null;
    const routine = (value, visited = new Set()) => {
      if (!value?.node || visited.has(value.node)) return null;
      visited = new Set([...visited, value.node]);
      if (value.isFunction())
        return byBody.get(analysis.moduleOf.get(value.node)?.id + ":" + value.node.body.start);
      if (!value.isIdentifier()) return null;
      const held = value.scope.getBinding(value.node.name);
      if (!held?.constant) return null;
      if (held.path.isFunctionDeclaration()) return routine(held.path, visited);
      return held.path.isVariableDeclarator() ? routine(held.path.get("init"), visited) : null;
    };
    const targets = values.map(value => {
      if (!value.isObjectExpression()) return null;
      const property = value
        .get("properties")
        .find(
          p =>
            (p.isObjectProperty() || p.isObjectMethod()) &&
            !p.node.computed &&
            name(p.node.key) === key
        );
      return property?.isObjectMethod()
        ? routine(property)
        : property?.isObjectProperty()
          ? routine(property.get("value"))
          : null;
    });
    return targets[0] && targets.every(fn => fn === targets[0]) ? targets[0] : null;
  }
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
    while (
      p.isTSNonNullExpression() ||
      p.isTSAsExpression() ||
      p.isTSSatisfiesExpression() ||
      p.isParenthesizedExpression()
    )
      p = p.get("expression");
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
  // Follow only immutable bags on the provider path. A reference stored in an
  // unknown container/callback can be changed without assigning the binding.
  const stableProvider = (binding, allowed, seen = new Set()) => {
    if (
      !binding?.constant ||
      binding.kind !== "const" ||
      !binding.path.isVariableDeclarator() ||
      !binding.path.get("id").isIdentifier() ||
      seen.has(binding)
    )
      return false;
    if (binding.path.parentPath.parentPath?.isExportNamedDeclaration()) return false;
    seen = new Set([...seen, binding]);
    return binding.referencePaths.every(reference => {
      if (reference.findParent(path => path.isTSType())) return true;
      let use = reference;
      while (
        use.parentPath?.isTSAsExpression() ||
        use.parentPath?.isTSNonNullExpression() ||
        use.parentPath?.isTSSatisfiesExpression() ||
        use.parentPath?.isParenthesizedExpression()
      )
        use = use.parentPath;
      const parent = use.parentPath;
      if (
        parent?.isVariableDeclarator() &&
        parent.get("init").node === use.node &&
        parent.get("id").isIdentifier()
      )
        return stableProvider(parent.scope.getBinding(parent.node.id.name), allowed, seen);
      if (!allowed.has(use.node)) {
        const declaration = nodeFor(binding.path);
        const reference = nodeFor(use);
        return declaration && ts.isVariableDeclaration(declaration) && reference
          ? providerMemberObservation(ts, checker, declaration, reference)
          : false;
      }
      if (parent?.isReturnStatement())
        return parent.getFunctionParent() === binding.path.getFunctionParent();
      if (parent?.isJSXExpressionContainer())
        return parent.parentPath.isJSXAttribute() && name(parent.parentPath.node.name) === "value";
      if (parent?.isCallExpression()) {
        const api = imported(parent.get("callee"));
        return (
          api?.source === "solid-js" &&
          api.name === "createContext" &&
          parent.node.arguments[0] === use.node
        );
      }
      return false;
    });
  };
  const providerValues = (value, allowed = new Set(), seen = new Set()) => {
    if (!value?.node || seen.has(value.node)) return null;
    seen = new Set([...seen, value.node]);
    allowed = new Set([...allowed, value.node]);
    if (
      value.isTSAsExpression() ||
      value.isTSNonNullExpression() ||
      value.isTSSatisfiesExpression() ||
      value.isParenthesizedExpression()
    )
      return providerValues(value.get("expression"), allowed, seen);
    if (value.isObjectExpression())
      return value.node.properties.some(property => property.type === "SpreadElement")
        ? null
        : [value];
    if (value.isArrayExpression())
      return value.node.elements.some(element => element?.type === "SpreadElement")
        ? null
        : [value];
    if (value.isIdentifier()) {
      const binding = value.scope.getBinding(value.node.name);
      return stableProvider(binding, allowed)
        ? providerValues(binding.path.get("init"), allowed, seen)
        : null;
    }
    if (!value.isCallExpression()) return null;
    const callee = value.get("callee");
    if (!callee.isIdentifier() || !callee.scope.getBinding(callee.node.name)?.constant) return null;
    const fn = target(value)?.path;
    // An authored iterator is a value, not a factory invocation to drive here.
    if (!fn || fn.node.async || fn.node.generator) return null;
    const declaration = fn.isFunctionDeclaration() ? fn : fn.parentPath;
    const id = declaration.isVariableDeclarator() ? declaration.node.id : fn.node.id;
    if (id?.type === "Identifier" && !declaration.scope.getBinding(id.name)?.constant) return null;
    const body = fn.get("body");
    if (!body.isBlockStatement()) return providerValues(body, allowed, seen);
    const returns = [];
    body.traverse({
      Function(path) {
        path.skip();
      },
      ReturnStatement(path) {
        if (path.node.argument) returns.push(path.get("argument"));
      }
    });
    if (!returns.length) return null;
    const values = returns.map(result => providerValues(result, allowed, seen));
    return values.every(Boolean) ? values.flat() : null;
  };
  const contextValues = id => {
    if (!contextValueMap) {
      contextValueMap = new Map();
      const add = (ctx, value) => {
        const values = contextValueMap.has(ctx) ? contextValueMap.get(ctx) : [];
        if (values) {
          const provided = providerValues(value);
          contextValueMap.set(ctx, provided ? [...values, ...provided] : null);
        }
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
            let opening = q.parentPath;
            if (
              opening.isJSXMemberExpression() &&
              q.key === "object" &&
              name(opening.node.property) === "Provider"
            )
              opening = opening.parentPath;
            // `</Ctx>` and `</Ctx.Provider>` close a provider the opening tag recorded
            if (opening.isJSXClosingElement()) return;
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
    const defaults = providerValues(fallback);
    return defaults ? [...values, ...defaults] : null;
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
  /** The keys and indices from a member chain's root to its end
   * (`value[1].bump`), or `null` when one is computed from a value. */
  const chainSteps = member => {
    const steps = [];
    let base = member;
    while (base.isMemberExpression()) {
      const key = base.node.property;
      const step = !base.node.computed
        ? key.name
        : key.type === "NumericLiteral" || key.type === "StringLiteral"
          ? key.value
          : null;
      if (step == null) return null;
      steps.unshift(step);
      base = base.get("object");
    }
    return { base, steps };
  };
  /** F-S45: what calling the member `steps` names in each value the context
   * `id` can hold fails with, or `null` when one is not known. */
  const valuesCall = (id, steps, owner) => {
    const values = id && contextValues(id);
    if (!values?.length) return null;
    const effects = values.map(root => callAt(root, steps, owner));
    return effects.every(Boolean) ? union(...effects) : null;
  };
  /** What calling the member `steps` names inside `root` (an object or array
   * literal) fails with, or `null` when one is not known. */
  const callAt = (root, steps, owner) => {
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
  };
  /** F-S45: the context an expression reaches into and the keys and indices
   * from its value: through names destructured from it or declared from a
   * member of it (`const [, { setLocation }] = useRouter()`, `bump =
   * context[1].bump`) and member chains off either (`nested.parse`). */
  const contextAt = (p, depth = 0) => {
    if (!p?.node || depth > 8) return null;
    while (
      p.isTSNonNullExpression() ||
      p.isTSAsExpression() ||
      p.isTSSatisfiesExpression() ||
      p.isParenthesizedExpression()
    )
      p = p.get("expression");
    if (p.isMemberExpression()) {
      const chain = chainSteps(p);
      const at = chain && contextAt(chain.base, depth + 1);
      return at && { id: at.id, steps: [...at.steps, ...chain.steps] };
    }
    if (p.isIdentifier()) {
      const binding = p.scope.getBinding(p.node.name);
      const declarator = binding?.path;
      if (binding?.constant && declarator?.isVariableDeclarator()) {
        const steps =
          declarator.node.id === binding.identifier
            ? []
            : patternPath(declarator.node.id, binding.identifier);
        const at = steps && contextAt(declarator.get("init"), depth + 1);
        if (at) return { id: at.id, steps: [...at.steps, ...steps] };
      }
    }
    const id = contextOfValue(p);
    return id ? { id, steps: [] } : null;
  };
  /** F-S45: a call through a member of a context's value (`value[1].bump()`,
   * a destructured `bump()`, `nested.parse()`), or `null`. */
  const contextMember = (callee, owner) => {
    const at = contextAt(callee);
    return at?.steps.length ? valuesCall(at.id, at.steps, owner) : null;
  };
  /** D-126: the component whose props an expression reaches into, and the
   * keys from its props: `props.onPick`, a name destructured in the
   * parameter, or one declared from either (`const { onPick } = props`). */
  const propsAt = (p, depth = 0) => {
    if (!p?.node || depth > 8) return null;
    if (p.isMemberExpression()) {
      const chain = chainSteps(p);
      const at = chain && propsAt(chain.base, depth + 1);
      return at && { fn: at.fn, steps: [...at.steps, ...chain.steps] };
    }
    if (!p.isIdentifier()) return null;
    const binding = p.scope.getBinding(p.node.name);
    if (!binding?.constant) return null;
    if (binding.path.isVariableDeclarator()) {
      const declarator = binding.path;
      const steps =
        declarator.node.id === binding.identifier
          ? []
          : patternPath(declarator.node.id, binding.identifier);
      const at = steps && propsAt(declarator.get("init"), depth + 1);
      return at && { fn: at.fn, steps: [...at.steps, ...steps] };
    }
    if (binding.kind !== "param" || binding.path.listKey !== "params" || binding.path.key !== 0)
      return null;
    const fn = functions.find(f => f.path.node === binding.path.parentPath?.node);
    const steps = patternPath(binding.path.node, binding.identifier);
    return fn?.component && steps ? { fn, steps } : null;
  };
  /** D-126: each JSX element rendering a component, or `null` when the
   * component is named anywhere but a tag (handed on: not every caller is seen). */
  const renders = new Map();
  const rendersOf = fn => {
    if (renders.has(fn.id)) return renders.get(fn.id);
    /** @type {any[] | null} */ let sites = [];
    const names = [];
    const namespaces = [];
    const containsComponent = (symbol, seen = new Set()) => {
      if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      if (symbol.declarations?.some(declaration => functionFor(declaration) === fn)) return true;
      if (!(symbol.flags & ts.SymbolFlags.Module) || seen.has(symbol)) return false;
      // An unresolved deep namespace stays conservative; cycles alone expose no new members.
      if (seen.size >= 32) return true;
      seen = new Set([...seen, symbol]);
      return checker.getExportsOfModule(symbol).some(exported => containsComponent(exported, seen));
    };
    const own = fn.path.isFunctionDeclaration()
      ? fn.path.node.id
      : fn.path.parentPath.isVariableDeclarator() && fn.path.parentPath.node.init === fn.path.node
        ? fn.path.parentPath.node.id
        : null;
    if (own?.type === "Identifier") names.push(fn.path.parentPath.scope.getBinding(own.name));
    else if (!fn.path.parentPath.isExportDefaultDeclaration()) sites = null;
    for (const [, record] of analysis.modules)
      for (const statement of record.program.get("body")) {
        if (!statement.isImportDeclaration()) continue;
        for (const specifier of statement.get("specifiers")) {
          // Resolve exported aliases before deciding which namespace uses expose this component.
          const local = specifier.get("local"),
            node = nodeFor(local);
          let symbol = node && checker.getSymbolAtLocation(node);
          if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
          const exports =
            symbol?.flags & ts.SymbolFlags.Module ? checker.getExportsOfModule(symbol) : [];
          const members = new Set(
            exports.filter(exported => containsComponent(exported)).map(exported => exported.name)
          );
          if (members.size)
            namespaces.push({ binding: specifier.scope.getBinding(local.node.name), members });
          if (target(specifier.get("local")) === fn)
            names.push(specifier.scope.getBinding(specifier.node.local.name));
        }
      }
    for (const binding of names) {
      if (!sites || !binding?.constant) {
        sites = null;
        break;
      }
      for (const ref of binding.referencePaths) {
        const at = ref.parentPath;
        if (at.isJSXOpeningElement() && at.node.name === ref.node) sites.push(at);
        // Babel counts an exported declaration as a reference to itself.
        // It is not a runtime handoff; imports below still have to be used
        // only as JSX tags, and a component with no known render stays unknown.
        else if (ref.isExportNamedDeclaration() && ref.node.declaration === binding.path.node)
          continue;
        else if (!at.isJSXClosingElement() && !at.isExportSpecifier()) {
          sites = null;
          break;
        }
      }
    }
    for (const { binding, members } of namespaces) {
      if (!sites || !binding?.constant) {
        sites = null;
        break;
      }
      for (const ref of binding.referencePaths) {
        if (ref.findParent(path => path.isTSType())) continue;
        // A whole namespace or a dynamic key can expose any of its components.
        const member = ref.parentPath;
        if (
          !(member.isMemberExpression() || member.isJSXMemberExpression()) ||
          member.node.object !== ref.node
        ) {
          sites = null;
          break;
        }
        const property = member.node.property;
        const key = !member.node.computed
          ? property.name
          : property.type === "StringLiteral" || property.type === "NumericLiteral"
            ? String(property.value)
            : null;
        if (key === null) {
          sites = null;
          break;
        }
        if (!members.has(key)) continue;
        const at = member.parentPath;
        if (at.isJSXOpeningElement() && at.node.name === member.node) sites.push(at);
        else if (!at.isJSXClosingElement()) {
          sites = null;
          break;
        }
      }
    }
    if (sites && !sites.length) sites = null;
    renders.set(fn.id, sites);
    return sites;
  };
  /** D-126: a call through a held prop (`props.onPick(1)`): what each value
   * the component's callers pass for it fails with when called, or `null`
   * when one is not known (a spread, a value not followed, a caller not seen). */
  const propMember = (callee, owner, depth = 0) => {
    const at = depth < 8 && propsAt(callee);
    const [prop, ...rest] = at?.steps ?? [];
    if (typeof prop !== "string") return null;
    const sites = rendersOf(at.fn);
    if (!sites) return null;
    const effects = sites.map(site => {
      const attributes = site.get("attributes");
      if (attributes.some(a => a.isJSXSpreadAttribute())) return null;
      const attribute = attributes.find(a => name(a.node.name) === prop);
      // Not passed: the prop is optional, and the call is guarded.
      if (!attribute) return new Set();
      const value = attribute.get("value");
      if (!value.isJSXExpressionContainer()) return null;
      const passed = value.get("expression");
      return rest.length
        ? callAt(passed, rest, owner)
        : (valueCall(passed, owner) ?? propMember(passed, owner, depth + 1));
    });
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
      // `const NotFound = class extends Error {}`: the class is NotFound
      const name =
        declaration &&
        ts.isClassExpression(declaration) &&
        !declaration.name &&
        ts.isVariableDeclaration(declaration.parent) &&
        ts.isIdentifier(declaration.parent.name)
          ? declaration.parent.name.text
          : symbol.name;
      const id = builtin
        ? `global:${symbol.name}`
        : `${relative(root, declaration.getSourceFile().fileName)}#${name}@${declaration.pos}`;
      classTypes.set(id, type);
      classes.set(id, {
        id,
        name,
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
    // F-S45: marks an error safe to serialize; it does not throw. Nor do the
    // props and request helpers: they compose objects or read the request.
    if (
      api?.source === "@solidjs/web" &&
      ["markSafeError", "mergeProps", "getRequestEvent", "dynamic"].includes(api.name)
    )
      return "web";
    // A root renderer's root is checked where it is rendered (RootCheck: a
    // root that may fail or be pending is refused); the call fails nothing more.
    if (
      api?.source === "@solidjs/web" &&
      ["render", "hydrate", "renderToString", "renderToStream"].includes(api.name)
    )
      return "renderer";
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
  const ARRAY_METHODS = new Set([
    "map",
    "flatMap",
    "filter",
    "find",
    "findIndex",
    "findLast",
    "findLastIndex",
    "some",
    "every",
    "forEach",
    "reduce",
    "reduceRight",
    "sort",
    "toSorted"
  ]);
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
  // An opaque generator's own body's failures, for the loops that drive it.
  const bodyFails = new Map();
  // Substitute only callback parameters whose complete use is a direct call
  // in this helper. Storage, forwarding and nested callbacks keep the unknown
  // contract; their invocation timing cannot be proved here.
  let callbackBindings = new Map();
  const specializing = new Set();
  const callbackArguments = (fn, site) => {
    const bindings = new Map();
    if (!fn || !site?.isCallExpression() || opaque(fn.path)) return bindings;
    const args = site.get("arguments");
    // A spread argument (`helper(...fs, () => …)`) shifts every later
    // position by an unknown count: the callbacks after it are not paired.
    const spreadAt = args.findIndex(arg => arg.isSpreadElement());
    for (const [index, param] of fn.path.get("params").entries()) {
      if (spreadAt !== -1 && index >= spreadAt) break;
      const arg = args[index];
      if (!param.isIdentifier() || !arg?.isFunction()) continue;
      const binding = fn.path.scope.getBinding(param.node.name);
      const callback = byBody.get(`${analysis.moduleOf.get(arg.node)?.id}:${arg.node.body.start}`);
      // TypeScript permits an async function in a void callback slot. That
      // erased Promise must not turn a detached rejection into a caught throw.
      const promised = path => {
        const node = nodeFor(path);
        return (
          node &&
          checker
            .getTypeAtLocation(node)
            .getCallSignatures()
            .some(
              signature =>
                !!checker.getPromisedTypeOfPromise(checker.getReturnTypeOfSignature(signature))
            )
        );
      };
      if (promised(arg) && !promised(param)) continue;
      if (
        !callback ||
        !binding?.constant ||
        !binding.referencePaths.every(
          ref =>
            ref.parentPath.isCallExpression() &&
            ref.key === "callee" &&
            ref.getFunctionParent() === fn.path
        )
      )
        continue;
      bindings.set(binding, { callback, argument: arg.node });
    }
    return bindings;
  };
  const invoke = (fn, owner, site = null) => {
    if (!fn) return new Set(["unknown"]);
    if (opaque(fn.path)) {
      // A generator iterated where it is called (`for (… of gen())`, `for
      // await`) is driven by that loop alone, with next() and return(): no
      // foreign driver can throw into it, so its own body's failures are exact.
      if (!site?.parentPath?.isForOfStatement() || site.key !== "right")
        return new Set(["unknown"]);
      owner.calls.add(fn.id);
      return bodyFails.get(fn) ?? new Set();
    }
    owner.calls.add(fn.id);
    const argumentsHere = callbackArguments(fn, site);
    if (argumentsHere.size) {
      if (specializing.has(fn)) return new Set(["unknown"]);
      const previous = callbackBindings;
      callbackBindings = new Map([...previous, ...argumentsHere]);
      specializing.add(fn);
      const specialized = { ...fn, calls: new Set(), timerFails: new Set() };
      try {
        const fails = evaluate(fn.path.get("body"), specialized, new Map());
        for (const call of specialized.calls) owner.calls.add(call);
        if (owner.timerFails) owner.timerFails = union(owner.timerFails, specialized.timerFails);
        return union(fails, fn.server ? new Set(["ChunkError"]) : []);
      } finally {
        callbackBindings = previous;
        specializing.delete(fn);
      }
    }
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
  /** A promise kept by `const` (`const request = fetch(url)`, not awaited):
   * what it may reject with reaches the continuation chained on it. */
  function keptRejection(p, owner, caught) {
    if (!p?.isIdentifier()) return new Set();
    const binding = p.scope.getBinding(p.node.name);
    if (binding?.kind !== "const" || !binding.path.isVariableDeclarator()) return new Set();
    const init = binding.path.get("init");
    if (!init.isCallExpression() && !init.isNewExpression()) return new Set();
    const node = nodeFor(init);
    return node && checker.getPromisedTypeOfPromise(checker.getTypeAtLocation(node))
      ? evaluate(init, owner, caught)
      : new Set();
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
        const input = union(
          evaluate(receiver, owner, caught),
          keptRejection(receiver, owner, caught)
        );
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
        if (primitive === "renderer") return argEffects;
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
      const substituted = callee.isIdentifier()
        ? callbackBindings.get(callee.scope.getBinding(callee.node.name))
        : null;
      const handledArguments = callbackArguments(resolved, p);
      return union(
        argEffects,
        substituted
          ? invoke(substituted.callback, owner, p)
          : resolved
            ? invoke(resolved, owner, p)
            : (contextMember(callee, owner) ?? propMember(callee, owner) ?? invoke(null, owner)),
        ...args
          .filter(
            a =>
              a.isFunction() &&
              ![...handledArguments.values()].some(value => value.argument === a.node)
          )
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
      if (opaque(fn.path)) {
        const body = union(evaluate(fn.path.get("body"), fn), fn.timerFails);
        const known = bodyFails.get(fn) ?? new Set();
        if ([...body].some(k => !known.has(k))) {
          bodyFails.set(fn, union(known, body));
          changed = true;
        }
      }
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
            : (propMember(value, ownerOf(p)) ?? new Set(["unknown"]));
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
          !contextMember(p.get("callee"), { calls: new Set(), timerFails: null }) &&
          !propMember(p.get("callee"), { calls: new Set(), timerFails: null })
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
        ? invoke(fn, owner, site)
        : primitive === "builtin" && !promiseMethod
          ? new Set(platformFailures(site))
          : total;
      return {
        callable,
        fails: [...total],
        ownFails: [...own],
        native:
          !!nativeCall(site) && !["promise-constructor", "builtin"].includes(nativeCall(site)),
        // The platform's own function (`fetch`, `response.json`): one that
        // returns a promise rejects it rather than throwing (WebIDL).
        platform: ["builtin", "promise-constructor"].includes(primitive ?? ""),
        // An array's own method that runs its callbacks at once (`every`,
        // `reduce`, `sort`): they run in the caller's host.
        arrayMethod: (() => {
          if (!["array-callback", "builtin"].includes(primitive ?? "")) return false;
          if (!callee.isMemberExpression()) return false;
          if (!ARRAY_METHODS.has(name(callee.node.property) ?? "")) return false;
          const receiver = nodeFor(callee.get("object"));
          const type = receiver && checker.getTypeAtLocation(receiver);
          return !!type && (checker.isArrayType(type) || checker.isTupleType(type));
        })(),
        target: fn?.id,
        promise: !!checker.getPromisedTypeOfPromise(checker.getTypeAtLocation(nodeFor(site))),
        async: !!fn?.path.node.async,
        // An async iterable result: a stream, which a memo takes through an attempt.
        stream: ["AsyncIterable", "AsyncIterableIterator", "AsyncGenerator"].includes(
          checker.getTypeAtLocation(nodeFor(site)).symbol?.name ?? ""
        ),
        // Which argument a type guard narrows (`Exit.isSuccess(exit)`), so its
        // lowered attempt can keep the narrowing.
        predicate: (() => {
          const node = nodeFor(site);
          const signature = ts.isCallExpression(node) ? checker.getResolvedSignature(node) : null;
          const guard = signature && checker.getTypePredicateOfSignature(signature);
          return guard?.kind === ts.TypePredicateKind.Identifier ? guard.parameterIndex : null;
        })(),
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
