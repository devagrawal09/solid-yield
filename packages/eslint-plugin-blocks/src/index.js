/**
 * eslint-plugin-solid-blocks — the strict rules of solid-blocks that
 * TypeScript cannot express. Everything else is a type error.
 *
 *   no-throw               a block raises typed failures: `yield* raise(e)`
 *   no-read-in-view-body   a view has no body: every read is a hole (D-032)
 *   yield-in-jsx-hole      every `yield*` in JSX is in a position the transform turns into a hole
 *   read-before-attempt    a $memo reads before its first `attempt`
 *   no-unyielded-write     an operation acts only as `yield* op` (setters; with types, event calls and any op)
 *   no-foreign-reactive    no reactive state from plain Solid, the router or another library
 *   no-component-tag       a block component is called, never a JSX tag (autofix)
 *   no-read-in-prop        a component call's prop is a source, a hole or a value — never a read (autofix)
 *   component-children-generator  a component call's children is a generator (autofix)
 *   jsx-only-in-view       JSX only in a view, a hole or a row's view: a setup never creates elements
 *   prefer-view-wrapper    (warning) wrap a view in `view(…)` so its errors land where it is written
 *   no-path-object-use     a path is a read: no spread, no `===`, no `JSON.stringify` of one
 *   no-dollar-block        `$` / `$scope` are removed: bare `function*` holes and rows, `$memo` derivations (autofix)
 */
import {
  childrenFromFunction,
  childrenFromJsx,
  importView,
  inGenerator,
  isBlockComponent,
  propValue
} from "./calls.js";
import {
  blockKind,
  isViewCall,
  enclosingFunction,
  isCallTo,
  isCapitalizedCall,
  jsxPosition,
  kindAt
} from "./blocks.js";

/**
 * The positions the JSX transform's block rule refuses — the same list as
 * `REFUSALS` in vite-plugin-solid-blocks (pinned by
 * packages/vite-plugin-blocks/test/fixtures/rule.json).
 */
export const REFUSALS = {
  BLOCKS_YIELD_IN_EVENT:
    "a `yield*` in an event handler prop would read once, at render: read inside the `$event` instead",
  BLOCKS_YIELD_IN_REF: "a `yield*` in a `ref` has no hole to read in: a ref is set once",
  BLOCKS_YIELD_IN_SPREAD:
    "a `yield*` in a spread cannot become a hole: spread an object of values, or pass each prop",
  BLOCKS_YIELD_IN_SPREAD_CHILD: "a `yield*` in a spread child cannot become a hole",
  BLOCKS_PLAIN_YIELD_IN_JSX: "a plain `yield` inside JSX is not a read: use `yield*`"
};

/** The refusal code for a `yield` in JSX, or null when the transform accepts it. */
export function refusalFor(node, position) {
  if (!node.delegate) return "BLOCKS_PLAIN_YIELD_IN_JSX";
  if (position.hole === "spread") return "BLOCKS_YIELD_IN_SPREAD";
  if (position.hole === "spread-child") return "BLOCKS_YIELD_IN_SPREAD_CHILD";
  if (position.hole === "attribute") {
    const name = position.name;
    if (name === "ref") return "BLOCKS_YIELD_IN_REF";
    if (/^on[A-Z]/.test(name) || /^(on|oncapture):/.test(name)) return "BLOCKS_YIELD_IN_EVENT";
  }
  return null;
}

const noThrow = {
  meta: {
    type: "problem",
    docs: {
      description: "A block raises typed failures with `yield* raise(error)`, never `throw`."
    },
    messages: {
      throw:
        "`throw` in a block is an untyped failure: use `yield* raise(error)` so readers see it in the type."
    },
    schema: []
  },
  create(context) {
    return {
      ThrowStatement(node) {
        if (kindAt(node)) context.report({ node, messageId: "throw" });
      }
    };
  }
};

/**
 * A JSX view has no body (D-032): `function* () { return <…/>; }`. Every
 * read is a hole — a `yield*` in a JSX expression or attribute. An `h` view
 * (no JSX in its body) is the type's (`[HVIEW_READ]`, D-049), not this rule's.
 */
/** Whether a function's body holds JSX (an `h` view holds none). */
const jsxViews = new WeakMap();
function isJsxView(fn) {
  if (jsxViews.has(fn)) return jsxViews.get(fn);
  let found = false;
  const visit = node => {
    if (found || !node || typeof node.type !== "string") return;
    if (node.type === "JSXElement" || node.type === "JSXFragment") {
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
  jsxViews.set(fn, found);
  return found;
}

const noReadInViewBody = {
  meta: {
    type: "problem",
    docs: {
      description:
        "A view does not read: every read is a hole (a `yield*` in JSX, a bare `function*` hole in `h` / `html`); structure comes from flow controls."
    },
    messages: {
      read: "a view does not read: read in a hole (`{yield* …}` in JSX, a bare `function*` in `h` / `html`), branch with <Show> / <Match>, derive with a $memo in the setup.",
      child:
        "a view does not read: a child view is rendered by a hole (`{yield* Child(props)}` in JSX, `h(Child, props)` without JSX)."
    },
    schema: []
  },
  create(context) {
    return {
      YieldExpression(node) {
        if (!node.delegate) return;
        if (kindAt(node) !== "view") return;
        if (jsxPosition(node)) return;
        // an `h` view is held by its type (`[HVIEW_READ]`), not the lint (D-049)
        if (!isJsxView(enclosingFunction(node))) return;
        context.report({
          node,
          messageId: isCapitalizedCall(node.argument) ? "child" : "read"
        });
      }
    };
  }
};

const yieldInJsxHole = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Every `yield*` in JSX is in a position the JSX transform turns into a hole (the transform refuses the rest)."
    },
    messages: Object.fromEntries(
      Object.entries(REFUSALS).map(([code, m]) => [code, `[${code}] ${m}`])
    ),
    schema: []
  },
  create(context) {
    return {
      YieldExpression(node) {
        const position = jsxPosition(node);
        if (!position) return;
        const code = refusalFor(node, position);
        if (code) context.report({ node, messageId: code });
      }
    };
  }
};

const readBeforeAttempt = {
  meta: {
    type: "problem",
    docs: {
      description:
        "A $memo reads before its first `attempt`: after an async attempt the memo resumes outside tracking."
    },
    messages: {
      after:
        "a $memo reads before its first `attempt`: this read would not be tracked after an async attempt."
    },
    schema: []
  },
  create(context) {
    const attempts = new WeakMap();
    return {
      YieldExpression(node) {
        if (!node.delegate) return;
        const fn = enclosingFunction(node);
        if (blockKind(fn) !== "memo") return;
        if (isCallTo(node.argument, ["attempt"])) {
          if (!attempts.has(fn)) attempts.set(fn, node.range[0]);
          return;
        }
        // a raise, or an untracked read (D-042), is fine after an attempt
        if (isCallTo(node.argument, ["raise", "$untrack"])) return;
        const first = attempts.get(fn);
        if (first !== undefined && node.range[0] > first)
          context.report({ node, messageId: "after" });
      }
    };
  }
};

/** Whether an identifier is a setter created by `yield* $signal / $store / $optimistic / $optimisticStore(…)`. */
function isBlockSetter(context, identifier) {
  const scope = context.sourceCode.getScope(identifier);
  let s = scope;
  let variable = null;
  while (s && !variable) {
    variable = s.set.get(identifier.name) || null;
    s = s.upper;
  }
  if (!variable || !variable.defs.length) return false;
  const def = variable.defs[0];
  const decl = def.node;
  if (!decl || decl.type !== "VariableDeclarator" || decl.id.type !== "ArrayPattern") return false;
  const element = decl.id.elements[1];
  if (!element || element.type !== "Identifier" || element.name !== identifier.name) return false;
  const init = decl.init;
  return (
    !!init &&
    init.type === "YieldExpression" &&
    init.delegate &&
    isCallTo(init.argument, ["$signal", "$store", "$optimistic", "$optimisticStore"])
  );
}

const OP_TYPES = new Set(["Yieldable", "Receipt", "EventCall", "Generator"]);

/** Whether a TypeScript type is (or extends) one of the named block-operation types. */
function isOpType(type, seen = new Set()) {
  if (!type || seen.has(type)) return false;
  seen.add(type);
  if (type.isUnionOrIntersection && type.isUnionOrIntersection())
    return type.types.some(t => isOpType(t, seen));
  const sym = type.aliasSymbol || (type.getSymbol && type.getSymbol());
  if (sym && OP_TYPES.has(sym.getName())) return true;
  const target = type.target || type;
  const bases = (target.getBaseTypes && target.getBaseTypes()) || [];
  return bases.some(b => isOpType(b, seen));
}
function isEventCallType(type) {
  if (!type) return false;
  if (type.isUnionOrIntersection && type.isUnionOrIntersection())
    return type.types.some(isEventCallType);
  const sym = type.aliasSymbol || (type.getSymbol && type.getSymbol());
  return !!sym && sym.getName() === "EventCall";
}
/** A call whose value nobody uses: a statement, `void x`, or an optional call statement. */
function isDiscarded(node) {
  let n = node;
  let p = n.parent;
  if (p && p.type === "ChainExpression") {
    n = p;
    p = p.parent;
  }
  return (
    !!p &&
    (p.type === "ExpressionStatement" || (p.type === "UnaryExpression" && p.operator === "void"))
  );
}

const noUnyieldedWrite = {
  meta: {
    type: "problem",
    docs: {
      description:
        "A block operation acts only when delegated to: `yield* setX(v)`, `yield* save(x)` (an event call), `yield* attempt(…)`. With type information, any operation a block discards is reported."
    },
    messages: {
      unyielded:
        "`{{name}}(…)` writes nothing until it is delegated to: `yield* {{name}}(…)`, in an $event or an $effect.",
      discarded: "`{{name}}(…)` does nothing until it is delegated to: `yield* {{name}}(…)`.",
      eventCall:
        "`{{name}}(…)` is an event call this block does not delegate to: `yield* {{name}}(…)` waits for it (its colors join this block's type)."
    },
    schema: []
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    const checker =
      services && services.program && services.esTreeNodeToTSNodeMap
        ? services.program.getTypeChecker()
        : null;
    const nameOf = node => {
      const text = context.sourceCode.getText(node.callee);
      return text.length > 40 ? text.slice(0, 37) + "..." : text;
    };
    return {
      CallExpression(node) {
        const p = node.parent;
        if (p && p.type === "YieldExpression" && p.delegate && p.argument === node) return;
        if (node.callee.type === "Identifier" && isBlockSetter(context, node.callee)) {
          context.report({ node, messageId: "unyielded", data: { name: node.callee.name } });
          return;
        }
        if (!checker || !kindAt(node)) return;
        const type = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node));
        if (isEventCallType(type)) {
          // in a block an event call is delegated to, or kept to delegate to
          // later — never used as a bare promise (its colors would not reach
          // this block's type)
          if (p && p.type === "VariableDeclarator" && p.init === node) return;
          context.report({ node, messageId: "eventCall", data: { name: nameOf(node) } });
        } else if (isDiscarded(node) && isOpType(type))
          context.report({ node, messageId: "discarded", data: { name: nameOf(node) } });
      }
    };
  }
};

const ROUTE_PROPS =
  "the route component's props (`yield* props.location…`, `yield* props.params…`)";
const SOLID_FOREIGN = {
  createSignal: "`$signal`",
  createMemo: "`$memo`",
  createStore: "`$store`",
  createProjection: "`$projection`",
  createOptimistic: "`$optimistic`",
  createOptimisticStore: "`$optimisticStore`",
  createEffect: "`$effect`",
  createRenderEffect: "`$effect`",
  createTrackedEffect: "`$effect`",
  createReaction: "`$effect`",
  onSettled: "`$settled`",
  action: "`$event`",
  until: "`until` from solid-blocks",
  refresh: "`refresh` from solid-blocks",
  isPending: "`isPendingOf`",
  latest: "`latestOf`",
  untrack: "`$untrack` (in a hole, a $memo, an $effect or an $event)",
  flush: null
};
/**
 * Reactive state that blocks cannot see: importing it into block code would
 * read or write outside `yield*`. Each name maps to its block replacement.
 */
export const FOREIGN_REACTIVE = {
  "solid-js": SOLID_FOREIGN,
  "@solidjs/signals": SOLID_FOREIGN,
  "@solidjs/router": {
    useLocation: ROUTE_PROPS,
    useParams: ROUTE_PROPS,
    useSearchParams: ROUTE_PROPS,
    useMatch: ROUTE_PROPS,
    useCurrentMatches: ROUTE_PROPS,
    useIsRouting: null,
    useSubmission: null,
    useSubmissions: null,
    createAsync: "`$memo`",
    createAsyncStore: "`$optimisticStore` or `$projection`"
  },
  // no block form: a server-component call has no place in the model (D-058);
  // a component chosen at run time is a `<Switch>` / `<Show>` over components
  "@solidjs/web": { dynamic: "`<Switch>` / `<Show>` over the components" }
};

const noForeignReactive = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Block code reads and writes only with `yield*`: no reactive state from plain Solid, the router or another library."
    },
    messages: {
      foreign:
        '`{{name}}` from "{{source}}" is reactive state blocks cannot see: blocks read and write only with `yield*`.{{hint}}'
    },
    schema: []
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const banned = FOREIGN_REACTIVE[node.source.value];
        if (!banned || node.importKind === "type") return;
        for (const spec of node.specifiers) {
          if (spec.type !== "ImportSpecifier" || spec.importKind === "type") continue;
          const name =
            spec.imported.type === "Identifier" ? spec.imported.name : spec.imported.value;
          if (!Object.prototype.hasOwnProperty.call(banned, name)) continue;
          const use = banned[name];
          context.report({
            node: spec,
            messageId: "foreign",
            data: { name, source: node.source.value, hint: use ? ` Use ${use}.` : "" }
          });
        }
      }
    };
  }
};

/** The flow-control props that read a source (where an `h`-flavor hole may stand). */
const FLOW_SOURCE_PROPS = new Set(["when", "each", "count", "on"]);
const FLOW_CONTROLS = new Set(["For", "Show", "Match", "Repeat", "Loading", "Errored", "Switch"]);

/** Whether `$` / `$scope` at `identifier` is the library's (imported from it, or unbound). */
function isLibraryBinding(context, identifier) {
  let s = context.sourceCode.getScope(identifier);
  while (s) {
    const variable = s.set.get(identifier.name);
    if (variable) {
      const def = variable.defs[0];
      return (
        !!def &&
        def.type === "ImportBinding" &&
        def.parent.type === "ImportDeclaration" &&
        def.parent.source.value === "solid-blocks"
      );
    }
    s = s.upper;
  }
  return true;
}

/**
 * Whether a node is a hole of the no-JSX flavor: an argument of `h(…)` (a
 * child, or an attribute value in its props object), a value in an `html`
 * template, or a source prop (`when`, `each`, …) of a flow control called
 * directly. A bare `function*` is a hole there.
 */
function isHHole(node) {
  let child = node;
  let p = node.parent;
  let key = null;
  while (p) {
    if (p.type === "ArrayExpression") {
      child = p;
      p = p.parent;
      continue;
    }
    if (p.type === "Property" && p.value === child && p.parent.type === "ObjectExpression") {
      if (key !== null) return false;
      key = p.key.type === "Identifier" ? p.key.name : p.key.value;
      child = p.parent;
      p = child.parent;
      continue;
    }
    if (p.type === "TemplateLiteral")
      return (
        p.parent.type === "TaggedTemplateExpression" &&
        p.parent.tag.type === "Identifier" &&
        p.parent.tag.name === "html"
      );
    if (p.type === "CallExpression" && p.arguments.includes(child)) {
      const callee = p.callee.type === "Identifier" ? p.callee.name : null;
      if (callee === "h") {
        if (key !== null) return !/^on/.test(String(key)) && key !== "ref" && key !== "children";
        return p.arguments[0] !== child || child.type === "ArrayExpression";
      }
      if (callee && FLOW_CONTROLS.has(callee))
        return key !== null && FLOW_SOURCE_PROPS.has(String(key)) && child === p.arguments[0];
      return false;
    }
    return false;
  }
  return false;
}

const noDollarBlock = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "`$` and `$scope` are removed: a hole or a row is a bare `function*`, and a derivation several holes read is `yield* $memo(…)` in the setup (or the row's setup)."
    },
    messages: {
      hole: "`$` is removed: a hole is a bare `function*` here.",
      row: "`{{name}}` is removed: a row is a bare `function*` (its body is a setup that returns the row's view).",
      derived:
        "`$` is removed: a derivation is `yield* $memo(function* () { … })` in the setup (or the row's setup).",
      other:
        "`$` is removed: read inside JSX (`{yield* …}`), pass a bare `function*` hole to `h` / `html`, or derive with `yield* $memo(…)` in a setup.",
      import: "`{{name}}` is removed from solid-blocks."
    },
    schema: []
  },
  create(context) {
    const source = context.sourceCode;
    let needsMemo = false;
    const unfixed = new Set();
    const imports = [];
    return {
      ImportDeclaration(node) {
        if (node.source.value === "solid-blocks") imports.push(node);
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "Identifier" || (callee.name !== "$" && callee.name !== "$scope"))
          return;
        if (!isLibraryBinding(context, callee)) return;
        const arg = node.arguments[0];
        const name = callee.name;
        const isGen =
          arg &&
          (arg.type === "FunctionExpression" || arg.type === "FunctionDeclaration") &&
          arg.generator;
        const argText = arg ? source.getText(arg) : "";
        // a row: `$(function* (item) …)`, `$scope(fn)`
        if (arg && (name === "$scope" || (isGen && arg.params.length > 0))) {
          context.report({
            node,
            messageId: "row",
            data: { name },
            fix: fixer => fixer.replaceText(node, argText)
          });
          return;
        }
        if (!isGen) {
          unfixed.add(name);
          context.report({ node, messageId: "other" });
          return;
        }
        // a hole of the no-JSX flavor
        if (isHHole(node)) {
          context.report({
            node,
            messageId: "hole",
            fix: fixer => fixer.replaceText(node, argText)
          });
          return;
        }
        // a derivation bound in a setup or a row's setup
        const p = node.parent;
        const kind = kindAt(node);
        if (
          p.type === "VariableDeclarator" &&
          p.init === node &&
          (kind === "setup" || kind === "row")
        ) {
          needsMemo = true;
          context.report({
            node,
            messageId: "derived",
            fix: fixer => fixer.replaceText(node, `yield* $memo(${argText})`)
          });
          return;
        }
        unfixed.add(name);
        context.report({ node, messageId: "other" });
      },
      "Program:exit"() {
        for (const decl of imports) {
          const specs = decl.specifiers.filter(
            s =>
              s.type === "ImportSpecifier" &&
              s.imported.type === "Identifier" &&
              (s.imported.name === "$" || s.imported.name === "$scope")
          );
          if (!specs.length) continue;
          const hasMemo = decl.specifiers.some(
            s => s.type === "ImportSpecifier" && s.local.name === "$memo"
          );
          // one fix for the declaration: drop the specifiers whose every use
          // was fixed, and import `$memo` when a fix introduced it
          const keep = decl.specifiers.filter(s => !specs.includes(s) || unfixed.has(s.local.name));
          const removable = keep.length < decl.specifiers.length;
          const named = keep.filter(s => s.type === "ImportSpecifier").map(s => source.getText(s));
          if (needsMemo && !hasMemo) {
            // after the `$` creators that sort before it
            let at = 0;
            named.forEach((text, i) => {
              if (text.startsWith("$") && text < "$memo") at = i + 1;
            });
            named.splice(at, 0, "$memo");
          }
          const others = keep.filter(s => s.type !== "ImportSpecifier").map(s => source.getText(s));
          const clause = [...others, ...(named.length ? [`{ ${named.join(", ")} }`] : [])].join(
            ", "
          );
          const fix = fixer =>
            clause
              ? fixer.replaceText(decl, `import ${clause} from ${source.getText(decl.source)};`)
              : fixer.remove(decl);
          specs.forEach((spec, i) =>
            context.report({
              node: spec,
              messageId: "import",
              data: { name: spec.imported.name },
              ...(i === 0 && removable ? { fix } : {})
            })
          );
        }
      }
    };
  }
};

/** The variable an identifier resolves to, or null. */
function resolve(context, identifier) {
  let s = context.sourceCode.getScope(identifier);
  while (s) {
    const variable = s.set.get(identifier.name);
    if (variable) return variable;
    s = s.upper;
  }
  return null;
}

/**
 * What a binding holds, as far as paths go: "path" (a store or a projection,
 * a row's argument — the binding itself is a path), "props" (a setup's props:
 * each key is a path, the object is not), or null.
 */
function pathBinding(context, identifier) {
  const variable = resolve(context, identifier);
  const def = variable && variable.defs[0];
  if (!def) return null;
  if (def.type === "Parameter") {
    const fn = def.node;
    const index = fn.params.findIndex(p => p === def.name || (p.left && p.left === def.name));
    const kind = blockKind(fn);
    if (kind === "row") return "path";
    if (kind === "setup" && index === 0) return "props";
    return null;
  }
  if (def.type === "Variable") {
    const decl = def.node;
    const init = decl.init;
    if (!init || init.type !== "YieldExpression" || !init.delegate) return null;
    if (
      decl.id.type === "ArrayPattern" &&
      decl.id.elements[0] === def.name &&
      isCallTo(init.argument, ["$store", "$optimisticStore"])
    )
      return "path";
    if (decl.id === def.name && isCallTo(init.argument, ["$projection"])) return "path";
  }
  return null;
}

/** Whether an expression is a path (syntactically): a store, a row argument, a prop, or a key of one. */
function isPathExpression(context, node) {
  let n = node;
  while (n.type === "TSNonNullExpression" || n.type === "TSAsExpression") n = n.expression;
  if (n.type === "ChainExpression") n = n.expression;
  if (n.type === "Identifier") return pathBinding(context, n) === "path";
  if (n.type !== "MemberExpression") return false;
  let root = n;
  while (root.type === "MemberExpression") root = root.object;
  if (root.type !== "Identifier") return false;
  const binding = pathBinding(context, root);
  return binding === "path" || binding === "props";
}

const noPathObjectUse = {
  meta: {
    type: "problem",
    docs: {
      description:
        "A path (a prop, a store or a row argument, or a key of one) is a read, not an object: spreading it, comparing it with `===` or `JSON.stringify`-ing it never sees the data."
    },
    messages: {
      spread:
        "spreading a path copies no data (it is a read, not an object): spread `yield* {{text}}`, or pass the path on as it is.",
      compare:
        "a path is a read, not a value: compare `(yield* {{text}})`, not the path (two paths are never the same object).",
      stringify:
        "`JSON.stringify` of a path gives its description, not its data: stringify `yield* {{text}}`."
    },
    schema: []
  },
  create(context) {
    const text = node => {
      const t = context.sourceCode.getText(node);
      return t.length > 40 ? t.slice(0, 37) + "..." : t;
    };
    const check = (node, messageId) => {
      if (node && isPathExpression(context, node))
        context.report({ node, messageId, data: { text: text(node) } });
    };
    return {
      SpreadElement(node) {
        check(node.argument, "spread");
      },
      JSXSpreadAttribute(node) {
        check(node.argument, "spread");
      },
      BinaryExpression(node) {
        if (!["===", "!==", "==", "!="].includes(node.operator)) return;
        check(node.left, "compare");
        check(node.right, "compare");
      },
      CallExpression(node) {
        const c = node.callee;
        if (
          c.type === "MemberExpression" &&
          !c.computed &&
          c.object.type === "Identifier" &&
          c.object.name === "JSON" &&
          c.property.type === "Identifier" &&
          c.property.name === "stringify"
        )
          check(node.arguments[0], "stringify");
      }
    };
  }
};

const preferViewWrapper = {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: {
      description:
        "Wrap a view in `view(function* () { … })`: its mistakes are reported where it is written, naming the op, instead of at the `$component(` call (D-054)."
    },
    messages: {
      wrap: "wrap this view in `view(…)` so its type errors are reported here, not at the `$component(` call."
    },
    schema: []
  },
  create(context) {
    const source = context.sourceCode;
    return {
      FunctionExpression(node) {
        if (!node.generator || blockKind(node) !== "view") return;
        if (isViewCall(node.parent) && node.parent.arguments[0] === node) return;
        // a lazy view (`children: function* () { … }`, D-066) is typed by the
        // call it is a prop of
        if (node.parent.type === "Property") return;
        const blocks = source.ast.body.find(
          s =>
            s.type === "ImportDeclaration" &&
            s.source.value === "solid-blocks" &&
            s.importKind !== "type"
        );
        context.report({
          node,
          messageId: "wrap",
          fix: fixer => {
            const fixes = [fixer.replaceText(node, `view(${source.getText(node)})`)];
            if (!blocks) return fixes;
            const imported = blocks.specifiers.some(
              s => s.type === "ImportSpecifier" && s.local.name === "view"
            );
            const specs = blocks.specifiers.filter(s => s.type === "ImportSpecifier");
            if (!imported && specs.length)
              fixes.push(fixer.insertTextAfter(specs[specs.length - 1], ", view"));
            return fixes;
          }
        });
      }
    };
  }
};

/** Block kinds whose body never builds elements: JSX is a view's, a hole's or a row's view's (D-041). */
const NO_JSX_KINDS = new Set(["setup", "row", "memo", "effect", "event", "settled"]);

/**
 * JSX only as the return of a view, a hole, or a row's view (D-041): a setup
 * never creates elements. Reports the outermost JSX in a block that is not a
 * view — or in a plain function declared directly in such a block (a
 * `const header = () => <h1/>` in a setup), unless it sits inside JSX (a
 * render callback in a view, `{props => <Loading>…</Loading>}`).
 */
const jsxOnlyInView = {
  meta: {
    type: "problem",
    docs: {
      description:
        "JSX only as the return of a view, a hole, or a row's view: a setup (or a memo, an effect, an event) never creates elements."
    },
    messages: {
      jsx: "JSX in {{where}}: elements are built by the view it returns (`return view(function* () { return <…/>; })`)."
    },
    schema: []
  },
  create(context) {
    const where = {
      setup: "a setup",
      row: "a row's setup",
      memo: "a $memo",
      effect: "an $effect",
      event: "an $event",
      settled: "a $settled"
    };
    const check = node => {
      // the outermost JSX only
      let p = node.parent;
      while (p) {
        if (p.type === "JSXElement" || p.type === "JSXFragment") return;
        if (
          p.type === "FunctionExpression" ||
          p.type === "ArrowFunctionExpression" ||
          p.type === "FunctionDeclaration"
        )
          break;
        p = p.parent;
      }
      if (!p) return;
      let kind = blockKind(p);
      if (!kind) {
        // a plain function declared in a block: it is the block's code — but
        // not inside JSX (a render callback a view hands on)
        let q = p.parent;
        while (
          q &&
          !(
            q.type === "FunctionExpression" ||
            q.type === "ArrowFunctionExpression" ||
            q.type === "FunctionDeclaration"
          )
        ) {
          if (
            q.type === "JSXElement" ||
            q.type === "JSXFragment" ||
            q.type === "JSXExpressionContainer"
          )
            return;
          q = q.parent;
        }
        kind = q ? blockKind(q) : null;
      }
      if (kind && NO_JSX_KINDS.has(kind))
        context.report({ node, messageId: "jsx", data: { where: where[kind] } });
    };
    return { JSXElement: check, JSXFragment: check };
  }
};

/** A capitalised call or a branded one: a component call (D-062). */
function isComponentCallee(context, callee) {
  if (isBlockComponent(context, callee)) return true;
  const name =
    callee.type === "Identifier"
      ? callee.name
      : callee.type === "MemberExpression" && callee.property.type === "Identifier"
        ? callee.property.name
        : "";
  return /^[A-Z]/.test(name);
}

const IDENT = /^[A-Za-z_$][\w$]*$/;

/**
 * D-062 / D-067: a block component (`$component`, `lazy`, the library's flow
 * controls and boundaries) is called — `{yield* Card({ todo })}` — never a
 * JSX tag; tags are for DOM elements and foreign (plain-Solid) components.
 * Autofix: the tag becomes the call, its attributes props (D-065), its
 * children a generator (D-066).
 */
const noComponentTag = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "A block component is called (`{yield* Card({ todo })}`), never a JSX tag: its colors travel only through `yield*` (D-062)."
    },
    messages: {
      tag: "`<{{name}}>` is a block component: call it — `{yield* {{name}}({ … })}` — so its pending and failures reach this view (D-062)."
    },
    schema: []
  },
  create(context) {
    const source = context.sourceCode;
    return {
      JSXElement(node) {
        const nameNode = node.openingElement.name;
        if (nameNode.type === "JSXNamespacedName") return;
        if (nameNode.type === "JSXIdentifier" && !/^[A-Z]/.test(nameNode.name)) return;
        if (!isBlockComponent(context, nameNode)) return;
        const name = source.getText(nameNode);
        // in a block the call is a hole's `yield*`; outside one (a root, a
        // test, a module-level value) it is the plain call
        const inBlock = inGenerator(node);
        context.report({
          node: node.openingElement,
          messageId: "tag",
          data: { name },
          fix: fixer => {
            const props = [];
            let usesView = false;
            for (const attr of node.openingElement.attributes) {
              if (attr.type === "JSXSpreadAttribute") {
                props.push(`...${source.getText(attr.argument)}`);
                continue;
              }
              const raw =
                attr.name.type === "JSXNamespacedName"
                  ? `${attr.name.namespace.name}:${attr.name.name.name}`
                  : attr.name.name;
              const key = IDENT.test(raw) ? raw : JSON.stringify(raw);
              const v = attr.value;
              if (v == null) props.push(`${key}: true`);
              else if (v.type === "Literal") props.push(`${key}: ${JSON.stringify(v.value)}`);
              else if (v.type === "JSXExpressionContainer") {
                if (v.expression.type === "JSXEmptyExpression") continue;
                props.push(`${key}: ${propValue(source, v.expression)}`);
              } else props.push(`${key}: ${source.getText(v)}`);
            }
            const children = childrenFromJsx(source, node.children);
            if (children === null) return null;
            if (children !== undefined) {
              props.push(`children: ${children}`);
              usesView = children.includes("return view(");
            }
            const call = props.length ? `${name}({ ${props.join(", ")} })` : `${name}()`;
            const parent = node.parent;
            const inJsx = parent.type === "JSXElement" || parent.type === "JSXFragment";
            // a tag given as a component's prop (`fallback={<Checkout />}`, or
            // `fallback: <Checkout />` once the holder is a call) was built
            // lazily, when the prop was read: it becomes a lazy view, so the
            // component is set up only where (and when) the prop is shown
            const asProp =
              (parent.type === "JSXExpressionContainer" && parent.parent.type === "JSXAttribute") ||
              (parent.type === "Property" &&
                parent.value === node &&
                parent.parent.type === "ObjectExpression" &&
                parent.parent.parent.type === "CallExpression" &&
                parent.parent.parent.callee.type === "Identifier" &&
                /^[A-Z]/.test(parent.parent.parent.callee.name));
            const fixes = [
              fixer.replaceText(
                node,
                inBlock
                  ? asProp
                    ? `function* () {\nreturn <>{yield* ${call}}</>;\n}`
                    : inJsx
                      ? `{yield* ${call}}`
                      : `<>{yield* ${call}}</>`
                  : inJsx
                    ? `{${call}}`
                    : call
              )
            ];
            if (usesView) {
              const imp = importView(context, fixer);
              if (imp) fixes.push(imp);
            }
            return fixes;
          }
        });
      }
    };
  }
};

/**
 * D-065: a component call's props are evaluated in the caller — a `yield*` in
 * them reads in the caller's hole, which then re-creates the component on
 * every change. Pass the source itself, or a hole the component reads.
 */
const noReadInProp = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "A component call's prop is a source, a hole (`function* () { … }`) or a settled value, never a read in the caller (D-065)."
    },
    messages: {
      read: "read in a prop: pass the source (`{{key}}: src`), or a hole (`{{key}}: function* () { return …; }`) the component reads (D-065)."
    },
    schema: []
  },
  create(context) {
    const source = context.sourceCode;
    const reported = new WeakSet();
    return {
      YieldExpression(node) {
        if (!node.delegate) return;
        let child = node;
        let p = node.parent;
        while (p) {
          if (/Function/.test(p.type) || p.type === "JSXExpressionContainer") return;
          if (p.type === "Property" && p.value === child && p.parent.type === "ObjectExpression") {
            const obj = p.parent;
            const call = obj.parent;
            if (
              call &&
              call.type === "CallExpression" &&
              call.arguments[0] === obj &&
              isComponentCallee(context, call.callee) &&
              !reported.has(p)
            ) {
              reported.add(p);
              const key = source.getText(p.key);
              context.report({
                node,
                messageId: "read",
                data: { key },
                fix:
                  p.kind === "init"
                    ? fixer => fixer.replaceText(p.value, propValue(source, p.value))
                    : null
              });
            }
            return;
          }
          child = p;
          p = p.parent;
        }
      }
    };
  }
};

/**
 * D-066: a component call's `children` is always a generator — a lazy view
 * `function* () { return <…/>; }` or a row `function* (item, index) { … }` —
 * never plain JSX (built eagerly, in the caller), a getter or a render arrow.
 */
const componentChildrenGenerator = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "A component call's `children` is a generator: a lazy view `function* () { return <…/>; }` or a row (D-066)."
    },
    messages: {
      children:
        "`children` of a component call is a generator: `function* () { return <…/>; }` (built inside the component), or a row `function* (item) { … }` (D-066)."
    },
    schema: []
  },
  create(context) {
    const source = context.sourceCode;
    const tsx = /\.[jt]sx$/.test(context.filename || "");
    return {
      Property(node) {
        const key = node.key.type === "Identifier" ? node.key.name : node.key.value;
        if (key !== "children" || node.computed) return;
        const obj = node.parent;
        const call = obj.parent;
        if (!call || call.type !== "CallExpression" || call.arguments[0] !== obj) return;
        if (!isComponentCallee(context, call.callee)) return;
        const v = node.value;
        let text;
        if (node.kind === "get") text = childrenFromFunction(source, { ...v, params: [] });
        else if (v.type === "JSXElement" || v.type === "JSXFragment")
          text = `function* () {\nreturn ${source.getText(v)};\n}`;
        else if (v.type === "FunctionExpression" || v.type === "ArrowFunctionExpression") {
          if (v.generator) return;
          const body = v.body.type === "BlockStatement" ? null : v.body;
          const returnsJsx = body
            ? body.type === "JSXElement" || body.type === "JSXFragment"
            : v.body.body.some(
                st =>
                  st.type === "ReturnStatement" &&
                  st.argument &&
                  (st.argument.type === "JSXElement" || st.argument.type === "JSXFragment")
              );
          // `h` output and `() => View()` stay in a no-JSX file (built where
          // they are inserted); in JSX every one is a generator
          if (!returnsJsx && !tsx) return;
          text = childrenFromFunction(source, v);
        } else return;
        context.report({
          node,
          messageId: "children",
          fix:
            text == null
              ? null
              : fixer => {
                  const fixes = [fixer.replaceText(node, `children: ${text}`)];
                  if (text.includes("return view(")) {
                    const imp = importView(context, fixer);
                    if (imp) fixes.push(imp);
                  }
                  return fixes;
                }
        });
      }
    };
  }
};

export const rules = {
  "no-throw": noThrow,
  "no-read-in-view-body": noReadInViewBody,
  "yield-in-jsx-hole": yieldInJsxHole,
  "read-before-attempt": readBeforeAttempt,
  "no-unyielded-write": noUnyieldedWrite,
  "no-foreign-reactive": noForeignReactive,
  "no-dollar-block": noDollarBlock,
  "no-path-object-use": noPathObjectUse,
  "prefer-view-wrapper": preferViewWrapper,
  "jsx-only-in-view": jsxOnlyInView,
  "no-component-tag": noComponentTag,
  "no-read-in-prop": noReadInProp,
  "component-children-generator": componentChildrenGenerator
};

const plugin = {
  meta: { name: "eslint-plugin-solid-blocks", version: "0.0.0" },
  rules,
  configs: {}
};

/** Rules `recommended` sets to warn (a suggestion, not a rule of the model). */
const WARNINGS = new Set(["prefer-view-wrapper"]);
/** `recommended`: every rule an error, but the suggestions (`WARNINGS`), which warn (flat config). */
plugin.configs.recommended = {
  plugins: { "solid-blocks": plugin },
  rules: Object.fromEntries(
    Object.keys(rules).map(name => [`solid-blocks/${name}`, WARNINGS.has(name) ? "warn" : "error"])
  )
};

export default plugin;
