/**
 * D-062 / D-065 / D-066 / D-067: a block component is called, never tagged;
 * its props are sources, holes or settled values; its children a generator.
 * Shared by `no-component-tag`, `no-read-in-prop` and
 * `component-children-generator`.
 */

const FLOW = new Set(["For", "Show", "Switch", "Match", "Repeat", "Loading", "Errored"]);

/** The variable an identifier resolves to, or null. */
function resolve(context, node) {
  let s = context.sourceCode.getScope(node);
  while (s) {
    const v = s.set.get(node.name);
    if (v) return v;
    s = s.upper;
  }
  return null;
}

/** Whether a TypeScript type is marked as a block component's view (`[COMPONENT]`). */
function isComponentView(type, seen) {
  if (!type || seen.has(type)) return false;
  seen.add(type);
  if (type.isUnionOrIntersection && type.isUnionOrIntersection())
    return type.types.some(t => isComponentView(t, seen));
  const props = type.getProperties ? type.getProperties() : [];
  return props.some(p => String(p.escapedName).startsWith("__@COMPONENT@"));
}

/**
 * Whether a TypeScript type is a block component: a function returning a
 * view marked `[COMPONENT]` (D-068 — the mark is on the view it returns, so a
 * component's own type stays a plain function and keeps its type parameters).
 */
function hasBrand(type, seen = new Set()) {
  if (!type || seen.has(type)) return false;
  seen.add(type);
  if (type.isUnionOrIntersection && type.isUnionOrIntersection())
    return type.types.some(t => hasBrand(t, seen));
  const signatures = type.getCallSignatures ? type.getCallSignatures() : [];
  return signatures.some(sig => isComponentView(sig.getReturnType(), new Set()));
}

/**
 * Whether `node` (an Identifier, a JSXIdentifier, a member expression) names a
 * block component. With type information: it returns a marked view. Without:
 * imported from `@solidjs/blocks` (the flow controls and boundaries), or bound
 * to `$component(…)` / `lazy(…)`. Unknown (a component imported from another
 * module, without types) is not reported.
 */
export function isBlockComponent(context, node) {
  const services = context.sourceCode.parserServices;
  if (services && services.program && services.esTreeNodeToTSNodeMap) {
    const tsNode = services.esTreeNodeToTSNodeMap.get(node);
    if (tsNode) {
      const checker = services.program.getTypeChecker();
      return hasBrand(checker.getTypeAtLocation(tsNode));
    }
  }
  const name = node.type === "JSXIdentifier" || node.type === "Identifier" ? node.name : null;
  if (!name) return false;
  const v = resolve(context, node);
  const def = v && v.defs[0];
  if (!def) return FLOW.has(name);
  if (def.type === "ImportBinding")
    return def.parent.source.value === "@solidjs/blocks" && def.parent.importKind !== "type";
  const init = def.node && def.node.init;
  return (
    !!init &&
    init.type === "CallExpression" &&
    init.callee.type === "Identifier" &&
    (init.callee.name === "$component" || init.callee.name === "lazy")
  );
}

/** The nearest enclosing function of a node (not the node itself). */
export function enclosingFn(node) {
  let p = node.parent;
  while (
    p &&
    p.type !== "FunctionExpression" &&
    p.type !== "FunctionDeclaration" &&
    p.type !== "ArrowFunctionExpression"
  )
    p = p.parent;
  return p || null;
}

/** Whether an expression contains a `yield*` of its own (not in a nested function). */
export function containsYield(node) {
  let found = false;
  const visit = n => {
    if (found || !n || typeof n.type !== "string") return;
    if (n !== node && /Function/.test(n.type)) return;
    if (n.type === "YieldExpression") {
      found = true;
      return;
    }
    for (const k of Object.keys(n)) {
      if (k === "parent") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v.type === "string") visit(v);
    }
  };
  visit(node);
  return found;
}

/** A prop value in call form (D-065): a source as itself, a derived read as a hole. */
export function propValue(source, expr) {
  // a function is a value: a hole (`function* () { … }`) or a callback
  if (/Function/.test(expr.type)) return source.getText(expr);
  // `yield* src` with `src` a source or a path is the source itself; any
  // other delegation (a helper's generator, `yield* matches("x")`) is a hole
  if (
    expr.type === "YieldExpression" &&
    expr.delegate &&
    expr.argument &&
    (expr.argument.type === "Identifier" || expr.argument.type === "MemberExpression")
  )
    return source.getText(expr.argument);
  const text = source.getText(expr);
  if (containsYield(expr)) return `function* () {\nreturn ${text};\n}`;
  return text;
}

const isJsx = n => n && (n.type === "JSXElement" || n.type === "JSXFragment");

/**
 * A component call's children (D-066), from a function value: a generator as
 * it is (a row, or a lazy view); a render callback returning JSX as a row
 * generator; `() => Comp(…)` as a lazy view; null when it cannot be fixed.
 */
export function childrenFromFunction(source, fn) {
  if (fn.generator) return source.getText(fn);
  const params = fn.params.map(p => source.getText(p)).join(", ");
  let body = fn.body;
  if (body.type === "BlockStatement") {
    const stmts = body.body;
    if (stmts.length !== 1 || stmts[0].type !== "ReturnStatement" || !stmts[0].argument)
      return null;
    body = stmts[0].argument;
  }
  while (body.type === "TSAsExpression" || body.type === "ParenthesizedExpression")
    body = body.expression;
  const jsx = isJsx(body)
    ? source.getText(body)
    : body.type === "CallExpression"
      ? `<>{yield* ${source.getText(body)}}</>`
      : `<>{${source.getText(body)}}</>`;
  if (fn.params.length === 0) return `function* () {\nreturn ${jsx};\n}`;
  // a render callback is a row (D-066): its body a setup returning its view
  return `function* (${params}) {\nreturn view(function* () {\nreturn ${jsx};\n});\n}`;
}

/** A tag's JSX children as a component call's `children` (D-066), or null. */
export function childrenFromJsx(source, children) {
  // whitespace and `{/* comments */}` are not children
  const kids = children.filter(
    c =>
      !(c.type === "JSXText" && !c.value.trim()) &&
      !(c.type === "JSXExpressionContainer" && c.expression.type === "JSXEmptyExpression")
  );
  if (!kids.length) return undefined;
  if (kids.length === 1 && kids[0].type === "JSXExpressionContainer") {
    const e = kids[0].expression;
    if (e.type === "FunctionExpression" || e.type === "ArrowFunctionExpression")
      return childrenFromFunction(source, e);
    // a named row or render callback (`{comment}`), passed as it is
    if (e.type === "Identifier") return source.getText(e);
    // a view passed as a tag's child (`<Loading>{Card()}</Loading>`): in the
    // lazy view it is delegated to, so its colors reach the component
    if (
      e.type === "CallExpression" &&
      e.callee.type === "Identifier" &&
      /^[A-Z]/.test(e.callee.name)
    )
      return `function* () {\nreturn <>{yield* ${source.getText(e)}}</>;\n}`;
  }
  const first = kids[0];
  const last = kids[kids.length - 1];
  const text =
    kids.length === 1 && isJsx(first)
      ? source.getText(first)
      : `<>${source.text.slice(first.range[0], last.range[1])}</>`;
  return `function* () {\nreturn ${text};\n}`;
}

/** Whether a function (or any of its JSX) is a generator, so `yield*` may be written in it. */
export function inGenerator(node) {
  const fn = enclosingFn(node);
  return !!fn && !!fn.generator;
}

/** A fix that imports `view` from @solidjs/blocks when a fix used it and it is missing. */
export function importView(context, fixer) {
  const source = context.sourceCode;
  const blocks = source.ast.body.find(
    s =>
      s.type === "ImportDeclaration" &&
      s.source.value === "@solidjs/blocks" &&
      s.importKind !== "type"
  );
  if (!blocks) return null;
  if (blocks.specifiers.some(s => s.type === "ImportSpecifier" && s.local.name === "view"))
    return null;
  const specs = blocks.specifiers.filter(s => s.type === "ImportSpecifier");
  return specs.length ? fixer.insertTextAfter(specs[specs.length - 1], ", view") : null;
}
