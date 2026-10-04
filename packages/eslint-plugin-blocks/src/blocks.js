/**
 * What the rules share: recognizing blocks from syntax.
 *
 * A block is a generator function that is
 * - the argument of a block constructor (`$component` → setup, `$memo`,
 *   `$effect`, `$event`, `$settled`, `$` → hole, or row when it has
 *   parameters, `$scope` → row);
 * - returned by a setup or a row block's setup (→ view), also as a branch of
 *   a conditional or logical return (a setup may return one of several views);
 * - a render callback written inline in JSX (→ row);
 * - the `children` (or an `Errored`'s `fallback`) of a flow control called
 *   directly (`For({ each, children: function* (item) { … } })`, → row);
 * - a generator declared inside a setup or a row (a named row block → row),
 *   or bound there to a `const`, taking parameters and returning a
 *   `function*` (its view) (→ row; a generator helper returning a value is not).
 */

export const CONSTRUCTORS = {
  $component: "setup",
  $memo: "memo",
  $effect: "effect",
  $event: "event",
  $settled: "settled",
  $scope: "row"
};

/** Kinds whose body is a reactive computation (reads, no writes). */
export const REACTIVE = new Set(["memo", "view", "hole", "setup", "row"]);

function isFunction(node) {
  return (
    node &&
    (node.type === "FunctionExpression" ||
      node.type === "FunctionDeclaration" ||
      node.type === "ArrowFunctionExpression")
  );
}

function calleeName(call) {
  const c = call.callee;
  if (c.type === "Identifier") return c.name;
  if (c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier")
    return c.property.name;
  return null;
}

/** The nearest enclosing function of `node` (not `node` itself). */
export function enclosingFunction(node) {
  let p = node.parent;
  while (p && !isFunction(p)) p = p.parent;
  return p || null;
}

const kinds = new WeakMap();
/** The block kind of a function node, or null for a function that is not a block. */
export function blockKind(fn) {
  if (!fn || !fn.generator) return null;
  if (kinds.has(fn)) return kinds.get(fn);
  const kind = computeKind(fn);
  kinds.set(fn, kind);
  return kind;
}

function computeKind(fn) {
  const parent = fn.parent;
  if (parent.type === "CallExpression" && parent.arguments[0] === fn) {
    const name = calleeName(parent);
    if (name === "$") return fn.params.length > 0 ? "row" : "hole";
    if (name && CONSTRUCTORS[name]) return CONSTRUCTORS[name];
  }
  // returned by a setup (or a row block's setup): the view — also wrapped,
  // `return view(function* () { … })` (D-054)
  let ret = isViewCall(parent) && parent.arguments[0] === fn ? parent : fn;
  while (
    ret.parent.type === "ConditionalExpression" ||
    ret.parent.type === "LogicalExpression" ||
    ret.parent.type === "SequenceExpression"
  )
    ret = ret.parent;
  if (ret.parent.type === "ReturnStatement" && ret.parent.argument === ret) {
    const outer = enclosingFunction(ret.parent);
    const k = blockKind(outer);
    if (k === "setup" || k === "row") return "view";
  }
  if (parent.type === "JSXExpressionContainer") return "row";
  // a component call's `children` (or a flow control's `fallback`): with
  // parameters a row (`function* (item, index)`), without them a lazy view
  // (D-066), rendered where the control shows it
  if (
    parent.type === "Property" &&
    parent.value === fn &&
    !parent.computed &&
    parent.key.type === "Identifier" &&
    (parent.key.name === "children" || parent.key.name === "fallback")
  )
    return fn.params.length > 0 ? "row" : "view";
  if (fn.type === "FunctionDeclaration") {
    const outer = enclosingFunction(fn);
    const k = blockKind(outer);
    if (k === "setup" || k === "row") return "row";
  }
  if (
    parent.type === "VariableDeclarator" &&
    parent.init === fn &&
    fn.params.length > 0 &&
    returnsGenerator(fn)
  ) {
    const outer = enclosingFunction(fn);
    const k = blockKind(outer);
    if (k === "setup" || k === "row") return "row";
  }
  return null;
}

/** `view(fn)`: the typing wrapper of a view (D-054). */
export function isViewCall(node) {
  return (
    !!node &&
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "view"
  );
}

/** Whether a function returns a `function*` expression (from its own body, not a nested function). */
function returnsGenerator(fn) {
  let found = false;
  const visit = node => {
    if (found || !node || typeof node.type !== "string") return;
    if (node !== fn.body && isFunction(node)) return;
    const arg =
      node.type === "ReturnStatement" && isViewCall(node.argument)
        ? node.argument.arguments[0]
        : node.argument;
    if (
      node.type === "ReturnStatement" &&
      arg &&
      arg.type === "FunctionExpression" &&
      arg.generator
    ) {
      found = true;
      return;
    }
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v.type === "string") visit(v);
    }
  };
  visit(fn.body);
  return found;
}

/** The block kind of the function a node sits in (null outside blocks). */
export function kindAt(node) {
  return blockKind(enclosingFunction(node));
}

/**
 * Where a node sits relative to the nearest JSX before a function boundary:
 * `null` (not in JSX), `{ hole: "child" | "attribute" | "spread" | "spread-child", name }`.
 */
export function jsxPosition(node) {
  let child = node;
  let p = node.parent;
  while (p) {
    if (isFunction(p) || p.type === "ClassBody") return null;
    if (p.type === "JSXSpreadAttribute") return { hole: "spread" };
    if (p.type === "JSXSpreadChild") return { hole: "spread-child" };
    if (p.type === "JSXExpressionContainer") {
      const owner = p.parent;
      if (owner && owner.type === "JSXAttribute") {
        const n = owner.name;
        const name = n.type === "JSXNamespacedName" ? `${n.namespace.name}:${n.name.name}` : n.name;
        return { hole: "attribute", name };
      }
      return { hole: "child" };
    }
    child = p;
    p = p.parent;
  }
  void child;
  return null;
}

export function isCallTo(node, names) {
  return node && node.type === "CallExpression" && names.includes(calleeName(node));
}

export function isCapitalizedCall(node) {
  if (!node || node.type !== "CallExpression") return false;
  const name = calleeName(node);
  return !!name && /^[A-Z]/.test(name);
}
