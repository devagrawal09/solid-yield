/**
 * eslint-plugin-solid-yield — the strict rules of solid-yield that
 * TypeScript cannot express. Everything else is a type error.
 *
 *   no-throw               a routine raises typed failures: `yield* raise(e)`
 *   no-try-catch           a routine handles a failure with `attempt` or an `Errored`, never `try` / `catch`
 *   no-read-in-view-body   a view has no body: every read is a hole (D-032)
 *   yield-in-jsx-hole      every `yield*` in JSX is in a position the transform turns into a hole
 *   read-before-attempt    a $memo reads before its first `attempt`
 *   no-unyielded-write     an operation acts only as `yield* op` (setters; with types, event calls and any op)
 *   no-foreign-reactive    no reactive state from plain Solid, the router or another library
 *   no-component-tag       a yield component is called, never a JSX tag (autofix)
 *   no-read-in-prop        a component call's prop is a source, a hole or a value — never a read (autofix)
 *   component-children-generator  a component call's children is a generator, a flow control's JSX fallback a lazy view (autofix)
 *   component-call-yielded  a yield component call in a routine is delegated to: `{yield* Card(…)}` (autofix)
 *   no-unbound-event       an `$event` handler in an event prop is bound: `onClick={yield* save}` (autofix)
 *   no-unshown-wait        (warning, with types) a bound handler that may wait on pending data: show its in-flight state
 *   no-unchecked-foreign-handoff  a yield component handed to plain Solid (the router, `@solidjs/web`'s render) goes through `foreign(…)`
 *   jsx-only-in-view       JSX only in a view, a hole or a row's view: a setup never creates elements
 *   require-view-wrapper   a setup's (or a row's) view is `view(function* () { … })`: one spelling (D-089; autofix)
 *   no-path-object-use     a path is a read: no spread, no `===`, no `JSON.stringify` of one
 *   no-dollar-block        `$` / `$scope` are removed: bare `function*` holes and rows, `$memo` derivations (autofix)
 *   require-jsx-factory    (warning) the tsconfig sets jsxFactory / jsxFragmentFactory, so fragments are type-checked (D-093)
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve as resolvePath } from "node:path";
import {
  childrenFromFunction,
  childrenFromJsx,
  importView,
  inGenerator,
  isYieldComponent,
  propValue
} from "./calls.js";
import {
  routineKind,
  isViewCall,
  enclosingFunction,
  isCallTo,
  isCapitalizedCall,
  jsxPosition,
  kindAt
} from "./routines.js";

/**
 * The positions the JSX transform's yield rule refuses — the same list as
 * `REFUSALS` in vite-plugin-solid-yield (pinned by
 * packages/vite-plugin-yield/test/fixtures/rule.json).
 */
export const REFUSALS = {
  YIELD_IN_REF: "a `yield*` in a `ref` has no hole to read in: a ref is set once",
  YIELD_IN_SPREAD:
    "a `yield*` in a spread cannot become a hole: spread an object of values, or pass each prop",
  YIELD_IN_SPREAD_CHILD: "a `yield*` in a spread child cannot become a hole",
  PLAIN_YIELD_IN_JSX: "a plain `yield` inside JSX is not a read: use `yield*`"
};

/** The refusal code for a `yield` in JSX, or null when the transform accepts it. */
export function refusalFor(node, position) {
  if (!node.delegate) return "PLAIN_YIELD_IN_JSX";
  if (position.hole === "spread") return "YIELD_IN_SPREAD";
  if (position.hole === "spread-child") return "YIELD_IN_SPREAD_CHILD";
  if (position.hole === "attribute") {
    const name = position.name;
    // an event prop binds a handler, `onClick={yield* save}` (D-072): accepted
    if (name === "ref") return "YIELD_IN_REF";
  }
  return null;
}

const noThrow = {
  meta: {
    type: "problem",
    docs: {
      description: "A routine raises typed failures with `yield* raise(error)`, never `throw`."
    },
    messages: {
      throw:
        "`throw` in a routine is an untyped failure: use `yield* raise(error)` so readers see it in the type."
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

const TRY_WHERE = {
  setup: "a setup",
  view: "a view",
  hole: "a hole",
  row: "a row",
  memo: "a $memo",
  effect: "an $effect",
  event: "an $event"
};
/**
 * D-077: `try` / `catch` is not a routine form. A failure it catches at run
 * time stays in the routine's type (the types cannot see a `catch`), so the
 * type would over-state the runtime (D-071). A routine handles a failure with
 * `attempt(fn, onError)` — over a promise, a stream or an event call, the
 * handler returning the failure, a transformation of it, or nothing to absorb
 * it (D-076) — or lets it reach an `Errored`. Reported in every routine body
 * (and a bare `function*` hole given to `h`); a `try` with only `finally`
 * catches nothing and is not reported.
 */
const noTryCatch = {
  meta: {
    type: "problem",
    docs: {
      description:
        "A routine handles a failure with `attempt` (absorb or transform it) or an `Errored`, never `try` / `catch`: the types cannot see a catch (D-077)."
    },
    messages: {
      tryCatch:
        "`try` / `catch` in {{where}} is not a routine form: the types cannot see the catch, so the failure stays in this routine's type. Handle it with `yield* attempt(() => …, e => …)` — return the failure or a transformation of it, or nothing to absorb it — or let it reach an `Errored` (D-077)."
    },
    schema: []
  },
  create(context) {
    return {
      TryStatement(node) {
        if (!node.handler) return;
        const fn = enclosingFunction(node);
        let kind = routineKind(fn);
        if (!kind && fn && fn.generator && fn.params.length === 0 && isHHole(fn)) kind = "hole";
        if (kind) context.report({ node, messageId: "tryCatch", data: { where: TRY_WHERE[kind] } });
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
        "A view does not read: every read is a hole (a `yield*` in JSX, a bare `function*` hole in `h`); structure comes from flow controls."
    },
    messages: {
      read: "a view does not read: read in a hole (`{yield* …}` in JSX, a bare `function*` in `h`), branch with a flow control, `Show(…)` / `Match(…)` in a hole, derive with a $memo in the setup.",
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
        if (routineKind(fn) !== "memo") return;
        if (isCallTo(node.argument, ["attempt"])) {
          if (!attempts.has(fn)) attempts.set(fn, node.range[0]);
          return;
        }
        // a raise is fine after an attempt
        if (isCallTo(node.argument, ["raise"])) return;
        const first = attempts.get(fn);
        if (first !== undefined && node.range[0] > first)
          context.report({ node, messageId: "after" });
      }
    };
  }
};

/** Whether an identifier is a setter created by `yield* $signal / $store / $optimistic / $optimisticStore(…)`. */
function isYieldSetter(context, identifier) {
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

/** Whether a TypeScript type is (or extends) one of the named routine-operation types. */
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
        "A routine operation acts only when delegated to: `yield* setX(v)`, `yield* save(x)` (an event call), `yield* attempt(…)`. With type information, any operation a routine discards is reported."
    },
    messages: {
      unyielded:
        "`{{name}}(…)` writes nothing until it is delegated to: `yield* {{name}}(…)`, in an $event or an $effect's effect phase.",
      discarded: "`{{name}}(…)` does nothing until it is delegated to: `yield* {{name}}(…)`.",
      eventCall:
        "`{{name}}(…)` is an event call this routine does not delegate to: `yield* {{name}}(…)` waits for it (its colors join this routine's type)."
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
        if (node.callee.type === "Identifier" && isYieldSetter(context, node.callee)) {
          context.report({ node, messageId: "unyielded", data: { name: node.callee.name } });
          return;
        }
        if (!checker || !kindAt(node)) return;
        const type = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node));
        if (isEventCallType(type)) {
          // in a routine an event call is delegated to, or kept to delegate to
          // later — never used as a bare promise (its colors would not reach
          // this routine's type)
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
  createEffect: "`$effect(compute, effect)`",
  createRenderEffect: "`$effect`",
  createTrackedEffect:
    "`$effect(compute, effect)` (a tracked effect is the compute; its writes go in the effect phase)",
  createReaction: "`$effect`",
  onSettled:
    "`$effect(function* () {}, function* () { … })` (an empty compute: its effect phase runs once, after the first render, D-101)",
  action: "`$event`",
  until: "`until` from solid-yield",
  refresh: "`refresh` from solid-yield",
  isPending: "`isPendingOf`",
  latest: "`latestOf`",
  untrack:
    "a plain `yield*` where the host does not track: an `$event`, or an `$effect`'s effect phase"
};
/**
 * Reactive state that routines cannot see: importing it into routine code would
 * read or write outside `yield*`. Each name maps to its routine replacement.
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
  // no routine form: a server-component call has no place in the model (D-058);
  // a component chosen at run time is a `Switch(…)` / `Show(…)` over components
  "@solidjs/web": { dynamic: "`Switch(…)` / `Show(…)` over the components" }
};

/**
 * Not reactive state, so its import is admitted: Solid's `flush` commits the
 * pending writes now. A test calls it between two dispatched events (the
 * getting-started guide's tests import it so). Only a use in routine code is
 * reported: a routine's writes commit when its transaction ends.
 */
export const ROUTINE_FORBIDDEN = {
  "solid-js": new Set(["flush"]),
  "@solidjs/signals": new Set(["flush"])
};

/** Whether `node` sits inside a routine, at any depth of plain functions. */
function inRoutine(node) {
  for (let fn = enclosingFunction(node); fn; fn = enclosingFunction(fn))
    if (routineKind(fn)) return true;
  return false;
}

const noForeignReactive = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Routine code reads and writes only with `yield*`: no reactive state from plain Solid, the router or another library."
    },
    messages: {
      foreign:
        '`{{name}}` from "{{source}}" is reactive state routines cannot see: routines read and write only with `yield*`.{{hint}}',
      inRoutine:
        '`{{name}}` from "{{source}}" in a routine: a routine\'s writes commit when its transaction ends. `{{name}}` is for code outside routines (a test, between two dispatched events).'
    },
    schema: []
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const banned = FOREIGN_REACTIVE[node.source.value];
        if (!banned || node.importKind === "type") return;
        const routineOnly = ROUTINE_FORBIDDEN[node.source.value];
        for (const spec of node.specifiers) {
          if (spec.type !== "ImportSpecifier" || spec.importKind === "type") continue;
          const name =
            spec.imported.type === "Identifier" ? spec.imported.name : spec.imported.value;
          if (routineOnly && routineOnly.has(name)) {
            for (const variable of context.sourceCode.getDeclaredVariables(spec))
              for (const ref of variable.references)
                if (inRoutine(ref.identifier))
                  context.report({
                    node: ref.identifier,
                    messageId: "inRoutine",
                    data: { name, source: node.source.value }
                  });
            continue;
          }
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
        def.parent.source.value === "solid-yield"
      );
    }
    s = s.upper;
  }
  return true;
}

/**
 * Whether a node is a hole of the no-JSX flavor: an argument of `h(…)` (a
 * child, or an attribute value in its props object), or a source prop
 * (`when`, `each`, …) of a flow control called directly. A bare `function*`
 * is a hole there.
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
        "`$` is removed: read inside JSX (`{yield* …}`), pass a bare `function*` hole to `h`, or derive with `yield* $memo(…)` in a setup.",
      import: "`{{name}}` is removed from solid-yield."
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
        if (node.source.value === "solid-yield") imports.push(node);
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
    const kind = routineKind(fn);
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

const requireViewWrapper = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "A setup's (or a row's) view is written `view(function* () { … })` (D-089: one spelling of a view; its type errors are reported where it is written, D-054)."
    },
    messages: {
      wrap: "wrap the view: `return view(function* () { … })` — a bare `function*` returned from a setup is not a view (D-089); with `view(…)` its type errors are reported here, not at the `component(` call."
    },
    schema: []
  },
  create(context) {
    const source = context.sourceCode;
    return {
      FunctionExpression(node) {
        if (!node.generator || routineKind(node) !== "view") return;
        if (isViewCall(node.parent) && node.parent.arguments[0] === node) return;
        // a lazy view (`children: function* () { … }`, D-066) is typed by the
        // call it is a prop of
        if (node.parent.type === "Property") return;
        const lib = source.ast.body.find(
          s =>
            s.type === "ImportDeclaration" &&
            s.source.value === "solid-yield" &&
            s.importKind !== "type"
        );
        context.report({
          node,
          messageId: "wrap",
          fix: fixer => {
            const fixes = [fixer.replaceText(node, `view(${source.getText(node)})`)];
            if (!lib) return fixes;
            const imported = lib.specifiers.some(
              s => s.type === "ImportSpecifier" && s.local.name === "view"
            );
            const specs = lib.specifiers.filter(s => s.type === "ImportSpecifier");
            if (!imported && specs.length)
              fixes.push(fixer.insertTextAfter(specs[specs.length - 1], ", view"));
            return fixes;
          }
        });
      }
    };
  }
};

/** Routine kinds whose body never builds elements: JSX is a view's, a hole's or a row's view's (D-041). */
const NO_JSX_KINDS = new Set(["setup", "row", "memo", "effect", "event"]);

/**
 * JSX only as the return of a view, a hole, or a row's view (D-041): a setup
 * never creates elements. Reports the outermost JSX in a routine that is not a
 * view — or in a plain function declared directly in such a routine (a
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
      event: "an $event"
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
      let kind = routineKind(p);
      if (!kind) {
        // a plain function declared in a routine: it is the routine's code — but
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
        kind = q ? routineKind(q) : null;
      }
      if (kind && NO_JSX_KINDS.has(kind))
        context.report({ node, messageId: "jsx", data: { where: where[kind] } });
    };
    return { JSXElement: check, JSXFragment: check };
  }
};

/** A capitalised call or a branded one: a component call (D-062). */
function isComponentCallee(context, callee) {
  if (isYieldComponent(context, callee)) return true;
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
 * D-062 / D-067: a yield component (`component`, `lazy`, the library's flow
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
        "A yield component is called (`{yield* Card({ todo })}`), never a JSX tag: its colors travel only through `yield*` (D-062)."
    },
    messages: {
      tag: "`<{{name}}>` is a yield component: call it — `{yield* {{name}}({ … })}` — so its pending and failures reach this view (D-062)."
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
        if (!isYieldComponent(context, nameNode)) return;
        const name = source.getText(nameNode);
        // in a routine the call is a hole's `yield*`; outside one (a root, a
        // test, a module-level value) it is the plain call
        const inRoutine = inGenerator(node);
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
                inRoutine
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
 * D-092: so is a flow control's or a boundary's JSX `fallback`: written as
 * JSX in the call it is built with the holding view, shown or not, and while
 * hydrating that build claims a server node that is not there whenever the
 * server rendered the content (Solid's "Hydration key miss").
 * D-094: for the library's flow controls and boundaries both are type errors
 * too (`[LAZY_VIEW]`); this rule is their autofix.
 */
const componentChildrenGenerator = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "A component call's `children` is a generator: a lazy view `function* () { return <…/>; }` or a row (D-066); a flow control's JSX `fallback` is a lazy view (D-092)."
    },
    messages: {
      children:
        "`children` of a component call is a generator: `function* () { return <…/>; }` (built inside the component), or a row `function* (item) { … }` (D-066).",
      fallback:
        "`fallback` of `{{name}}` is built here, shown or not (and while hydrating it claims a server node that is there only if the server showed it): write it as a lazy view, `function* () { return <…/>; }`, built when it shows (D-092)."
    },
    schema: []
  },
  create(context) {
    const source = context.sourceCode;
    const tsx = /\.[jt]sx$/.test(context.filename || "");
    return {
      Property(node) {
        const key = node.key.type === "Identifier" ? node.key.name : node.key.value;
        if ((key !== "children" && key !== "fallback") || node.computed) return;
        const obj = node.parent;
        const call = obj.parent;
        if (!call || call.type !== "CallExpression" || call.arguments[0] !== obj) return;
        if (!isComponentCallee(context, call.callee)) return;
        const v = node.value;
        if (key === "fallback") {
          // a flow control's or a boundary's (the library's): a yield
          // component's own `fallback` prop is a value like any other
          if (
            call.callee.type !== "Identifier" ||
            !FLOW_CONTROLS.has(call.callee.name) ||
            !isYieldComponent(context, call.callee)
          )
            return;
          if (node.kind !== "init" || (v.type !== "JSXElement" && v.type !== "JSXFragment")) return;
          context.report({
            node,
            messageId: "fallback",
            data: { name: call.callee.name },
            fix: fixer =>
              fixer.replaceText(node, `fallback: function* () {\nreturn ${source.getText(v)};\n}`)
          });
          return;
        }
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

/**
 * D-086: a yield component call (a `component`, `lazy`, a flow control or a
 * boundary) in JSX is delegated to with `yield*` — `{yield* Card({ todo })}`
 * — so its pending and failures join the holding view's type. Not delegated
 * (`<>{Card({ todo })}</>`, `{[Main(), Footer()]}`, `{ok ? A() : B()}`) the
 * call still renders, and its colors reach no type. Reported in a JSX
 * expression (through an array, a conditional or a logical operand) and as a
 * discarded statement, in a generator, where `yield*` can be written. Not
 * reported: an argument or a prop (`h("div", Show(…))`, `fallback: Card()`:
 * typed by what takes it), a view's returned call, a call kept in a variable,
 * a call in a plain function (a root or foreign handoff, `render(() =>
 * App(), root)`, an `h` thunk). Autofix: the `yield*`.
 */
const WRAPPERS = new Set([
  "ArrayExpression",
  "ConditionalExpression",
  "LogicalExpression",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression"
]);
const componentCallYielded = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "A yield component call in JSX is delegated to with `yield*` (`{yield* Card(…)}`), so its pending and failures join the view's type (D-086)."
    },
    messages: {
      unyielded:
        "`{{name}}(…)` is a yield component call not delegated to: write `yield* {{name}}(…)`, so its pending and failures join this view's type (D-086)."
    },
    schema: []
  },
  create(context) {
    const source = context.sourceCode;
    return {
      CallExpression(node) {
        let child = node;
        let p = node.parent;
        while (p && WRAPPERS.has(p.type)) {
          if (p.type === "ConditionalExpression" && p.test === child) return;
          child = p;
          p = p.parent;
        }
        if (!p || (p.type !== "JSXExpressionContainer" && p.type !== "ExpressionStatement")) return;
        if (!inGenerator(node)) return;
        if (!isYieldComponent(context, node.callee)) return;
        const name = source.getText(node.callee);
        const parent = node.parent;
        const bare =
          parent.type === "JSXExpressionContainer" ||
          parent.type === "ExpressionStatement" ||
          parent.type === "ArrayExpression";
        context.report({
          node,
          messageId: "unyielded",
          data: { name: name.length > 40 ? name.slice(0, 37) + "..." : name },
          fix: bare
            ? fixer => fixer.insertTextBefore(node, "yield* ")
            : fixer => [fixer.insertTextBefore(node, "(yield* "), fixer.insertTextAfter(node, ")")]
        });
      }
    };
  }
};

/** Whether a JSX attribute name is an event prop: `onClick`, `on:click`, `oncapture:click`. */
function isEventAttribute(name) {
  if (name.type === "JSXNamespacedName")
    return name.namespace.name === "on" || name.namespace.name === "oncapture";
  const n = name.name;
  return n.length > 2 && n.startsWith("on") && n[2] >= "A" && n[2] <= "Z";
}

/** Whether a TypeScript type is an `$event` handler: it carries the library's `[EVENT]` brand. */
function isEventHandlerType(type, seen = new Set()) {
  if (!type || seen.has(type)) return false;
  seen.add(type);
  if (type.isUnionOrIntersection && type.isUnionOrIntersection())
    return type.types.some(t => isEventHandlerType(t, seen));
  const props = type.getProperties ? type.getProperties() : [];
  return props.some(p => /^__@EVENT@\d+$/.test(String(p.escapedName)));
}

/**
 * D-072: an `$event` handler in an event prop is bound — `onClick={yield*
 * save}`, a `Bind` op whose failures (and may-wait marker, D-075) join the view's type.
 * Given as a plain value (`onClick={save}`) it is bound all the same at run
 * time, but its colors reach no type. With type information any expression
 * typed as an `$event` handler is reported (`onInput={pick("a")}`); without,
 * a binding of `$event(…)` and a direct `$event(…)` call. Autofix (in a
 * generator): the `yield*`.
 */
const noUnboundEvent = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "An `$event` handler in an event prop is bound with `yield*` (`onClick={yield* save}`), so its failures and may-wait marker join the view's type (D-072, D-075)."
    },
    messages: {
      unbound:
        "`{{name}}` is an `$event` handler given unbound: bind it, `{{attr}}={yield* {{name}}}`, so its failures and may-wait marker join this view's type (D-072, D-075)."
    },
    schema: []
  },
  create(context) {
    const source = context.sourceCode;
    const services = source.parserServices;
    const checker =
      services && services.program && services.esTreeNodeToTSNodeMap
        ? services.program.getTypeChecker()
        : null;
    const isHandler = node => {
      if (checker) {
        const tsNode = services.esTreeNodeToTSNodeMap.get(node);
        if (tsNode) return isEventHandlerType(checker.getTypeAtLocation(tsNode));
      }
      if (node.type === "CallExpression") return isCallTo(node, ["$event"]);
      if (node.type !== "Identifier") return false;
      const variable = resolve(context, node);
      const def = variable && variable.defs[0];
      const init = def && def.type === "Variable" ? def.node.init : null;
      return !!init && isCallTo(init, ["$event"]);
    };
    const short = text => (text.length > 40 ? text.slice(0, 37) + "..." : text);
    return {
      JSXAttribute(node) {
        if (!isEventAttribute(node.name)) return;
        const v = node.value;
        if (!v || v.type !== "JSXExpressionContainer") return;
        // `onClick={[save, data]}`: the handler is the array's first element
        let target = v.expression;
        if (target.type === "ArrayExpression") target = target.elements[0];
        if (!target || target.type === "YieldExpression" || target.type === "JSXEmptyExpression")
          return;
        if (!isHandler(target)) return;
        const text = source.getText(target);
        const attr = source.getText(node.name);
        const simple = /^(Identifier|MemberExpression|CallExpression)$/.test(target.type);
        context.report({
          node: target,
          messageId: "unbound",
          data: { name: short(text), attr },
          fix:
            inGenerator(node) && simple ? fixer => fixer.insertTextBefore(target, "yield* ") : null
        });
      }
    };
  }
};

/** The type of a TypeScript property whose name is a library phantom (`[MAY_WAIT]`), or null. */
function phantomType(checker, type, name, at) {
  const pattern = new RegExp(`^__@${name}@\\d+$`);
  const types = type.isUnion && type.isUnion() ? type.types : [type];
  for (const t of types) {
    const props = t.getProperties ? t.getProperties() : [];
    const prop = props.find(p => pattern.test(String(p.escapedName)));
    if (prop) return checker.getTypeOfSymbolAtLocation(prop, at);
  }
  return null;
}
/** Whether a type is, or is a union holding, the literal `true`. */
function includesTrue(checker, type) {
  const types = type.isUnion && type.isUnion() ? type.types : [type];
  return types.some(t => checker.typeToString(t) === "true");
}

/**
 * D-075 (amended): a bound handler whose call may wait on a pending read
 * (its `P`) does not make the view pending — the runtime never suspends a
 * view for a call — so nothing shows that a click is waiting. The type
 * carries it as the view's may-wait marker; this rule surfaces it where the
 * handler is bound (`onClick={yield* save}`, `[yield* save, data]`, or an
 * `h` attribute). With type information only: the handler's `[MAY_WAIT]`
 * phantom says whether it may wait.
 */
const noUnshownWait = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "A view binds a handler that may wait on pending data (its call waits, and nothing suspends the view for it): show its in-flight state (D-075)."
    },
    messages: {
      wait: "this view binds a handler that may wait on pending data; show its in-flight state (`{{name}}`, D-075)."
    },
    schema: []
  },
  create(context) {
    const source = context.sourceCode;
    const services = source.parserServices;
    const checker =
      services && services.program && services.esTreeNodeToTSNodeMap
        ? services.program.getTypeChecker()
        : null;
    if (!checker) return {};
    const short = text => (text.length > 40 ? text.slice(0, 37) + "..." : text);
    const check = node => {
      const tsNode = services.esTreeNodeToTSNodeMap.get(node);
      if (!tsNode) return;
      const wait = phantomType(checker, checker.getTypeAtLocation(tsNode), "MAY_WAIT", tsNode);
      if (wait && includesTrue(checker, wait))
        context.report({ node, messageId: "wait", data: { name: short(source.getText(node)) } });
    };
    return {
      JSXAttribute(node) {
        if (!isEventAttribute(node.name)) return;
        const v = node.value;
        if (!v || v.type !== "JSXExpressionContainer") return;
        let target = v.expression;
        if (target.type === "ArrayExpression") target = target.elements[0];
        if (target && target.type === "YieldExpression" && target.delegate && target.argument)
          check(target.argument);
      },
      // `h("button", { onClick: save })`: an `$event` handler attribute is the bind
      Property(node) {
        if (node.computed || node.kind !== "init") return;
        const key = node.key.type === "Identifier" ? node.key.name : node.key.value;
        if (typeof key !== "string" || !/^on(?:[A-Z]|:|capture:)/.test(key)) return;
        const obj = node.parent;
        const call = obj && obj.parent;
        if (
          !call ||
          call.type !== "CallExpression" ||
          call.arguments[1] !== obj ||
          call.callee.type !== "Identifier" ||
          call.callee.name !== "h"
        )
          return;
        let target = node.value;
        if (target.type === "ArrayExpression") target = target.elements[0];
        if (target) check(target);
      }
    };
  }
};

/**
 * The modules whose `render` / `hydrate` / `renderTo…` mount a component as
 * plain Solid. Not solid-yield: its `render` / `hydrate` / `renderToString` /
 * `renderToStream` are the root edge (D-095, D-099), typed, and not a hand-off.
 */
const FOREIGN_RENDER_MODULES = new Set(["@solidjs/web", "solid-js/web"]);
const FOREIGN_RENDERERS = new Set([
  "render",
  "hydrate",
  "renderToString",
  "renderToStringAsync",
  "renderToStream"
]);

/** The module an identifier is imported from, or null. */
function importedFrom(context, node) {
  const v = resolve(context, node);
  const def = v && v.defs[0];
  if (!def || def.type !== "ImportBinding") return null;
  const spec = def.node;
  const imported =
    spec.type === "ImportSpecifier"
      ? spec.imported.type === "Identifier"
        ? spec.imported.name
        : spec.imported.value
      : "default";
  return { module: def.parent.source.value, imported };
}

/** A fix that imports `name` from solid-yield when it is missing (null when there is no import to extend). */
function importFromYield(context, fixer, name) {
  const lib = context.sourceCode.ast.body.find(
    s =>
      s.type === "ImportDeclaration" && s.source.value === "solid-yield" && s.importKind !== "type"
  );
  if (!lib) return null;
  if (lib.specifiers.some(s => s.type === "ImportSpecifier" && s.local.name === name)) return null;
  const specs = lib.specifiers.filter(s => s.type === "ImportSpecifier");
  return specs.length ? fixer.insertTextAfter(specs[specs.length - 1], `, ${name}`) : null;
}

/**
 * D-088: a yield component handed to foreign code as a value — the router's
 * `component` (`defineRoute({ component })`, a route object, `<Route
 * component={…}>`, `<Dynamic component={…}>`), `@solidjs/web`'s `render` /
 * `hydrate` / `renderTo…`, Solid's `lazy` over a module whose export is a
 * yield component — loses its colors there: plain Solid renders it with no
 * `yield*`. The library's own `render` / `hydrate` / `renderTo…` are not a
 * hand-off: they are the root edge, typed (a settled root that may fail, D-033;
 * D-095, D-099). It may pend (the app's
 * `Loading`); it must handle its own failures. `foreign(Comp)` checks that
 * at the handoff; this rule reports a handoff written without it. With type
 * information any expression typed as a yield component is reported (a local
 * `route(Live)` bridge too) and the message names what it may fail with;
 * without, a `component` / `lazy` binding. Suggestion: wrap in `foreign(…)`.
 */
const noUncheckedForeignHandoff = {
  meta: {
    type: "problem",
    hasSuggestions: true,
    docs: {
      description:
        "A yield component handed to plain Solid as a value (the router, `@solidjs/web`'s `render`, Solid's `lazy`) goes through `foreign(…)`, which checks that it handles its own failures (D-088)."
    },
    messages: {
      unchecked:
        "`{{name}}` is a yield component handed to plain Solid ({{where}}) unchecked: write `foreign({{name}})`, which checks that it handles its own failures — plain Solid renders it with no `yield*`, so they would reach no type (D-088).",
      uncheckedFails:
        "`{{name}}` may fail with {{fails}}; handle it inside, or wrap it in an Errored, before handing it to plain Solid ({{where}}) — and write `foreign({{name}})`, which checks it (D-088).",
      solidLazy:
        "Solid's `lazy` hands `{{name}}`, a yield component, to plain Solid: its pending and failures reach no type. Use solid-yield's `lazy` (a yield component, called with `yield*`) (D-088).",
      wrap: "Wrap it in `foreign(…)`."
    },
    schema: []
  },
  create(context) {
    const source = context.sourceCode;
    const services = source.parserServices;
    const checker =
      services && services.program && services.esTreeNodeToTSNodeMap
        ? services.program.getTypeChecker()
        : null;
    const short = text => (text.length > 40 ? text.slice(0, 37) + "..." : text);
    /** What a yield component may fail with (with types), or null. */
    const failsOf = node => {
      if (!checker) return null;
      const tsNode = services.esTreeNodeToTSNodeMap.get(node);
      if (!tsNode) return null;
      const type = checker.getTypeAtLocation(tsNode);
      const types = type.isUnion && type.isUnion() ? type.types : [type];
      for (const t of types)
        for (const sig of t.getCallSignatures ? t.getCallSignatures() : []) {
          const fails = phantomType(checker, sig.getReturnType(), "FAILS", tsNode);
          if (fails) {
            const text = checker.typeToString(fails);
            return text === "never" ? null : text;
          }
        }
      return null;
    };
    const isForeignCall = node =>
      node.type === "CallExpression" &&
      node.callee.type === "Identifier" &&
      node.callee.name === "foreign";
    /** Report `value` (a component handed over) when it is a yield component not checked. */
    const check = (value, where) => {
      if (!value || isForeignCall(value)) return;
      if (/Function/.test(value.type)) {
        // `render(() => App(), root)`: the function's result is the handoff
        const body = value.body;
        if (body && body.type === "CallExpression" && !isForeignCall(body))
          check(body.callee, where);
        return;
      }
      if (
        !checker &&
        value.type !== "Identifier" &&
        value.type !== "MemberExpression" &&
        value.type !== "JSXIdentifier"
      )
        return;
      if (!isYieldComponent(context, value)) return;
      const name = short(source.getText(value));
      const fails = failsOf(value);
      context.report({
        node: value,
        messageId: fails ? "uncheckedFails" : "unchecked",
        data: { name, where, fails: fails ?? "" },
        suggest: [
          {
            messageId: "wrap",
            fix: fixer => {
              const fixes = [
                fixer.insertTextBefore(value, "foreign("),
                fixer.insertTextAfter(value, ")")
              ];
              const imp = importFromYield(context, fixer, "foreign");
              return imp ? [...fixes, imp] : fixes;
            }
          }
        ]
      });
    };
    return {
      // a route object, `defineRoute({ component })`, any config's `component`
      Property(node) {
        if (node.computed || node.kind !== "init") return;
        const key = node.key.type === "Identifier" ? node.key.name : node.key.value;
        if (key !== "component") return;
        if (node.parent.type !== "ObjectExpression") return;
        check(node.value, "a `component` given to foreign code");
      },
      // `<Route component={Page} />`, `<Dynamic component={Page} />`
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "component") return;
        const v = node.value;
        if (!v || v.type !== "JSXExpressionContainer") return;
        check(v.expression, "a foreign tag's `component`");
      },
      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;
        const from = importedFrom(context, node.callee);
        if (!from) return;
        if (FOREIGN_RENDER_MODULES.has(from.module) && FOREIGN_RENDERERS.has(from.imported)) {
          check(node.arguments[0], `\`${from.imported}\` from ${from.module}`);
          return;
        }
        // Solid's `lazy(() => import("./Page"))`: with types, the module's export
        if (from.module === "solid-js" && from.imported === "lazy" && checker) {
          const loader = node.arguments[0];
          if (!loader) return;
          const tsNode = services.esTreeNodeToTSNodeMap.get(loader);
          if (!tsNode) return;
          const loaderType = checker.getTypeAtLocation(tsNode);
          for (const sig of loaderType.getCallSignatures()) {
            const promised = checker.getAwaitedType(sig.getReturnType());
            const def = promised && promised.getProperty("default");
            if (!def) continue;
            const defType = checker.getTypeOfSymbolAtLocation(def, tsNode);
            const isRoutine = defType.getCallSignatures().some(s =>
              s
                .getReturnType()
                .getProperties()
                .some(p => String(p.escapedName).startsWith("__@COMPONENT@"))
            );
            if (isRoutine) {
              context.report({
                node,
                messageId: "solidLazy",
                data: { name: "its default export" }
              });
              return;
            }
          }
        }
      }
    };
  }
};

/**
 * D-093 (D-086's type half): TypeScript checks a fragment's children — so
 * refuses `<>{Card({ todo })}</>` — only when the tsconfig in effect sets
 * `"jsxFactory": "jsx"` and `"jsxFragmentFactory": "Fragment"` beside
 * `jsxImportSource`. Without them a fragment is `any` to the checker and its
 * children pass. Reported once per tsconfig (the first JSX file linted in
 * it), at line 1. With type information the options are the program's; without,
 * the nearest `tsconfig.json` above the file, read through TypeScript (so
 * `extends` is followed); with neither TypeScript nor a tsconfig, nothing.
 */
const JSX_FACTORY = { jsxFactory: "jsx", jsxFragmentFactory: "Fragment" };
/** The tsconfigs already reported (once per project). */
const reportedConfigs = new Set();
let typescript;
function loadTypescript() {
  if (typescript === undefined) {
    try {
      typescript = createRequire(import.meta.url)("typescript");
    } catch {
      try {
        typescript = createRequire(join(process.cwd(), "package.json"))("typescript");
      } catch {
        typescript = null;
      }
    }
  }
  return typescript;
}
/** The nearest tsconfig.json above `file` and its compiler options in effect, or null. */
function tsconfigFor(file) {
  const ts = loadTypescript();
  if (!ts) return null;
  let dir = dirname(resolvePath(file));
  for (;;) {
    const candidate = join(dir, "tsconfig.json");
    if (existsSync(candidate)) {
      const read = ts.readConfigFile(candidate, ts.sys.readFile);
      if (read.error) return null;
      const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dir, undefined, candidate);
      return { path: candidate, options: parsed.options };
    }
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

const requireJsxFactory = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        'The tsconfig sets `"jsxFactory": "jsx"` and `"jsxFragmentFactory": "Fragment"`, so TypeScript checks a fragment\'s children (D-086, D-093).'
    },
    messages: {
      missing:
        'The tsconfig in effect ({{config}}) lacks {{missing}}: without them TypeScript does not check a fragment\'s children, and an unyielded component call in `<>…</>` passes the types (D-086). Add them beside `jsxImportSource`, as in the setup block of getting-started ("Install") and the solid-yield README (D-093).'
    },
    schema: []
  },
  create(context) {
    const filename = context.filename || "";
    if (!/\.[jt]sx$/.test(filename)) return {};
    return {
      Program(node) {
        const services = context.sourceCode.parserServices;
        let config = null;
        if (services && services.program) {
          const options = services.program.getCompilerOptions();
          config = { path: options.configFilePath || "(the program's)", options };
        } else config = tsconfigFor(filename);
        if (!config || reportedConfigs.has(config.path)) return;
        const missing = Object.entries(JSX_FACTORY)
          .filter(([key, value]) => config.options[key] !== value)
          .map(([key, value]) => `\`"${key}": "${value}"\``);
        if (missing.length === 0) return;
        reportedConfigs.add(config.path);
        context.report({
          node,
          loc: { line: 1, column: 0 },
          messageId: "missing",
          data: {
            config: relative(process.cwd(), config.path) || config.path,
            missing: missing.join(" and ")
          }
        });
      }
    };
  }
};

export const rules = {
  "no-throw": noThrow,
  "no-try-catch": noTryCatch,
  "no-read-in-view-body": noReadInViewBody,
  "yield-in-jsx-hole": yieldInJsxHole,
  "read-before-attempt": readBeforeAttempt,
  "no-unyielded-write": noUnyieldedWrite,
  "no-foreign-reactive": noForeignReactive,
  "no-dollar-block": noDollarBlock,
  "no-path-object-use": noPathObjectUse,
  "require-view-wrapper": requireViewWrapper,
  "jsx-only-in-view": jsxOnlyInView,
  "no-component-tag": noComponentTag,
  "no-read-in-prop": noReadInProp,
  "component-children-generator": componentChildrenGenerator,
  "component-call-yielded": componentCallYielded,
  "no-unbound-event": noUnboundEvent,
  "no-unshown-wait": noUnshownWait,
  "no-unchecked-foreign-handoff": noUncheckedForeignHandoff,
  "require-jsx-factory": requireJsxFactory
};

const plugin = {
  meta: { name: "eslint-plugin-solid-yield", version: "0.0.0" },
  rules,
  configs: {}
};

/** Rules `recommended` sets to warn (a suggestion, not a rule of the model). */
const WARNINGS = new Set(["no-unshown-wait", "require-jsx-factory"]);
/** `recommended`: every rule an error, but the suggestions (`WARNINGS`), which warn (flat config). */
plugin.configs.recommended = {
  plugins: { "solid-yield": plugin },
  rules: Object.fromEntries(
    Object.keys(rules).map(name => [`solid-yield/${name}`, WARNINGS.has(name) ? "warn" : "error"])
  )
};

export default plugin;
