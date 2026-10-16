import { traverseOwned, opaqueDirective } from "./native-owned.js";
import { printMapped, withPositions, copyPosition } from "./positions.js";
/** Experimental project transform. Types are queried on generated virtual files,
 * never asserted onto authored calls. See documentation/sugar-design.md. */
// @ts-check
import ts from "typescript";
import { cachedHost } from "./ts-host.js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseProgram } from "./transform.js";
import babel from "@babel/core";

/** @typedef {import("@babel/core").NodePath<any>} Path */
const t = babel.types;
/** @param {import("@babel/core").types.File} ast */
const printer = ast => printMapped(ast);
const constructors = new Set([
  "$memo",
  "$event",
  "$effect",
  "$projection",
  "$optimisticStore",
  "$scope"
]);
const controls = new Set(["For", "Show", "Match", "Switch", "Repeat", "Loading", "Errored"]);
/** Array methods that call their callback synchronously (F-S46). */
const ARRAY_CALLBACKS = new Set([
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
/** @param {any} n */
const key = n => n?.name ?? n?.value;
/** The property key a function is the value of, if any. @param {Path} fn */
const propKey = fn => (fn.parentPath?.isObjectProperty() ? key(fn.parentPath.node.key) : null);
/** @param {Path | null | undefined} p */
const fnName = p => {
  // a component a foreign slot takes, `const Page = __nativeC((props) => …)`, is Page
  const held =
    p?.parentPath?.isCallExpression() &&
    t.isIdentifier(p.parentPath.node.callee, { name: "__nativeC" })
      ? p.parentPath
      : p;
  return (
    p?.node.id?.name ??
    (held?.parentPath?.isVariableDeclarator() ? key(held.parentPath.node.id) : null)
  );
};
/**
 * D-124: a reader a function hands back (`useDouble(count)` returning
 * `() => count() * 2`, or an object of them): a derived accessor, a routine
 * its callers read where they call it, as a named one is.
 * @param {Path} p
 */
const returnedReader = p => {
  const at = p.parentPath;
  if (at?.isReturnStatement()) return true;
  if (at?.isArrowFunctionExpression() && at.node.body === p.node) return true;
  const object = at?.isObjectProperty() && at.node.value === p.node ? at.parentPath : null;
  return (
    !!object?.isObjectExpression() &&
    (!!object.parentPath?.isReturnStatement() ||
      (!!object.parentPath?.isArrowFunctionExpression() &&
        object.parentPath.node.body === object.node))
  );
};
/**
 * A local function only ever called (`const get = () => n(); get() + 1`): it
 * runs where it is called, so it is a routine its caller delegates to, and
 * its reads color that host (not a lexical callback, run on its own).
 * @param {Path} p
 */
const calledOnly = p => {
  const declarator = p.parentPath?.isVariableDeclarator() ? p.parentPath : null;
  const id = declarator?.node.id ?? (p.isFunctionDeclaration() ? p.node.id : null);
  if (!t.isIdentifier(id)) return false;
  const binding = (declarator ?? p).scope.getBinding(id.name);
  return (
    !!binding?.constant &&
    binding.referencePaths.length > 0 &&
    binding.referencePaths.every(
      ref => ref.parentPath?.isCallExpression() && ref.parentPath.node.callee === ref.node
    )
  );
};
/** @param {Path | null | undefined} p @param {string} [from] */
const lib = (p, from = "solid-yield") => {
  if (!p?.isIdentifier()) return null;
  const b = p.scope.getBinding(p.node.name);
  return b?.path.isImportSpecifier() &&
    b.path.parentPath.isImportDeclaration() &&
    b.path.parentPath.node.source.value === from
    ? key(b.path.node.imported)
    : null;
};
/** @param {Path | null | undefined} p */
const ownerCall = p =>
  p?.parentPath?.isObjectProperty() && p.parentPath.parentPath?.parentPath?.isCallExpression()
    ? p.parentPath.parentPath.parentPath
    : null;
/** @param {Path | null | undefined} p */
const control = p =>
  controls.has(lib(/** @type {Path | undefined} */ (p?.get("callee")))) ||
  p?.node.callee?.property?.name === "provide";
/** Where a source of `any` is read before its member: in a routine, or in a
 * callback that never becomes one (given to a plain function: the read is
 * refused there, as a typed one is). A row's or a hole's callback becomes a
 * routine in a later pass; its read waits for it.
 * @param {Path | null} host */
const anyHostReady = host => !host || !!host.node.generator || lexicalPhase(host) === null;
/** Resolve the enclosing phase through any number of plain callbacks.
 * @param {Path} fn @returns {string | null} */
const lexicalPhase = fn => {
  for (let outer = fn.parentPath; outer; outer = outer.parentPath) {
    if (outer.isJSXExpressionContainer()) return "hole";
    if (!outer.isFunction()) continue;
    const call = outer.parentPath?.isCallExpression() ? outer.parentPath : null;
    const api = lib(call?.get("callee"));
    // a hole's IIFE, bound before the view's statement (`__nativeHole`)
    if (
      call?.node.callee === outer.node &&
      call.parentPath?.isCallExpression() &&
      call.parentPath.get("callee").isIdentifier({ name: "__nativeHole" })
    )
      return "hole";
    if (api === "$event") return "event";
    if (api === "$memo") return "memo";
    if (api === "$effect") return call?.node.arguments[0] === outer.node ? "compute" : "effect";
    if (["$projection", "$optimisticStore"].includes(api ?? "")) return "memo";
    if (call?.get("callee").isIdentifier({ name: "__nativeLexicalCallback" }))
      return t.isStringLiteral(call.node.arguments[0]) ? call.node.arguments[0].value : null;
    if (api === "component" || api === "view") return null;
  }
  return null;
};
/**
 * Whether `fn` is held in a provider's value (`Ctx.provide({ value: { bump:
 * () => setCount(…) } })`, `<Ctx value={…}>` lowered): its consumers call it,
 * the provider's render does not; one that writes is an event's (F-S40).
 * @param {Path} fn
 */
const providedValue = fn => {
  for (
    let held = fn, at = fn.parentPath;
    at?.isObjectProperty() || at?.isObjectExpression() || at?.isArrayExpression();
    held = at, at = at.parentPath
  ) {
    if (at.isObjectProperty() && at.node.value === held.node && key(at.node.key) === "value") {
      const call = at.parentPath?.parentPath;
      if (
        call?.isCallExpression() &&
        call.node.arguments[0] === at.parent &&
        t.isMemberExpression(call.node.callee) &&
        key(call.node.callee.property) === "provide"
      )
        return true;
    }
  }
  return false;
};
/** F-S40, before types: a function passed as a component prop (not children or a
 * fallback) whose body writes (refresh, a setter of a signal/store/optimistic)
 * is called from the child's event, not during render, so its host is an event.
 * @param {Path} fn */
const writingCallbackProp = fn => {
  if (!providedValue(fn)) {
    const callee = ownerCall(fn)?.get("callee");
    if (!callee?.isIdentifier() || !/^[A-Z]/.test(callee.node.name) || lib(callee)) return false;
    if (["children", "fallback"].includes(propKey(fn))) return false;
  }
  let writes = false;
  traverseOwned(fn, {
    Function(inner) {
      if (inner !== fn) inner.skip();
    },
    CallExpression(site) {
      const target = site.get("callee");
      if (lib(target) === "refresh") writes = true;
      // A destructured binding's path is its declarator: `const [n, setN] = …`.
      const name = target.isIdentifier() ? target.node.name : null;
      const declarator = name ? target.scope.getBinding(name)?.path : null;
      const pattern = declarator?.isVariableDeclarator() ? declarator.node.id : null;
      const init = declarator?.isVariableDeclarator() ? declarator.get("init") : null;
      const create = init?.isYieldExpression() ? init.get("argument") : init;
      if (
        t.isArrayPattern(pattern) &&
        pattern.elements.findIndex(e => t.isIdentifier(e, { name: name ?? "" })) >= 1 &&
        create?.isCallExpression() &&
        ["$signal", "$store", "$optimistic", "$optimisticStore", "$projection"].includes(
          lib(create.get("callee")) ?? ""
        )
      )
        writes = true;
    }
  });
  return writes;
};
/** Whether a returned expression holds JSX of its own: an element, or one
 * through a ternary, a logical operator, an array or parentheses (not inside a
 * call's argument or a nested function). D-125.
 * @param {any} e @returns {boolean} */
const holdsJSX = e =>
  t.isJSXElement(e) ||
  t.isJSXFragment(e) ||
  ((t.isParenthesizedExpression(e) ||
    t.isTSAsExpression(e) ||
    t.isTSSatisfiesExpression(e) ||
    t.isTSNonNullExpression(e)) &&
    holdsJSX(e.expression)) ||
  (t.isConditionalExpression(e) && (holdsJSX(e.consequent) || holdsJSX(e.alternate))) ||
  (t.isLogicalExpression(e) && (holdsJSX(e.left) || holdsJSX(e.right))) ||
  (t.isSequenceExpression(e) && holdsJSX(e.expressions.at(-1))) ||
  (t.isArrayExpression(e) && e.elements.some(holdsJSX));
/** Leave ordinary value/IO callbacks unchanged. A later typed read can still
 * resolve its lexical host in delegate(). @param {Path} fn */
function reactiveCallback(fn) {
  let reads = false;
  /** @param {Path} value */
  const sourceBinding = value => {
    const binding = value.isIdentifier() ? value.scope.getBinding(value.node.name)?.path : null;
    const init = binding?.isVariableDeclarator() ? binding.get("init") : null;
    const call = init?.isYieldExpression() ? init.get("argument") : init;
    return (
      call?.isCallExpression() &&
      ["$signal", "$store", "$memo", "$optimistic", "$optimisticStore", "$projection"].includes(
        lib(call.get("callee")) ?? ""
      )
    );
  };
  traverseOwned(fn, {
    Function(inner) {
      inner.skip();
    },
    CallExpression(call) {
      const callee = call.get("callee");
      const api = lib(callee);
      reads ||=
        constructors.has(api) ||
        ["attempt", "raise", "readStore", "latestOf", "isPendingOf", "refresh", "until"].includes(
          api ?? ""
        ) ||
        sourceBinding(callee) ||
        (callee.isIdentifier() &&
          /^__native(Attempt|ReadStore|Raise|Try|Map|LexicalCallback)$/.test(callee.node.name));
    },
    MemberExpression(member) {
      let root = member.get("object");
      while (root.isMemberExpression()) root = root.get("object");
      reads ||= !!sourceBinding(root);
    }
  });
  return reads;
}
/** @param {Path} fn @param {string} phase @param {Path} program */
function wrapLexical(fn, phase, program) {
  const call = fn.parentPath?.isCallExpression() ? fn.parentPath : null;
  const callee = call?.get("callee");
  const deferred =
    callee?.isMemberExpression() &&
    ["then", "catch", "finally"].includes(key(callee.node.property));
  // A wrapped Errored fallback keeps Solid's own parameter types, which the
  // generic wrapper would otherwise erase: (err: Accessor<unknown>, reset).
  if (propKey(fn) === "fallback" && lib(ownerCall(fn)?.get("callee")) === "Errored") {
    const [error, reset] = fn.node.params;
    if (t.isIdentifier(error) && !error.typeAnnotation)
      error.typeAnnotation = t.tsTypeAnnotation(
        t.tsFunctionType(null, [], t.tsTypeAnnotation(t.tsUnknownKeyword()))
      );
    if (t.isIdentifier(reset) && !reset.typeAnnotation) {
      reset.typeAnnotation = t.tsTypeAnnotation(t.tsTypeReference(t.identifier("__NativeReset")));
      if (!program.scope.hasBinding("__NativeReset")) {
        const reset = t.importDeclaration(
          [t.importSpecifier(t.identifier("__NativeReset"), t.identifier("Reset"))],
          t.stringLiteral("solid-yield")
        );
        reset.importKind = "type";
        program.node.body.unshift(reset);
        program.scope.crawl();
      }
    }
  }
  if (fn.isArrowFunctionExpression()) fn.arrowFunctionToExpression();
  fn.node.generator = true;
  const name = fn.isFunctionDeclaration() ? fn.node.id : null;
  const expression = fn.isFunctionDeclaration()
    ? t.functionExpression(null, fn.node.params, fn.node.body, true)
    : /** @type {import("@babel/core").types.FunctionExpression} */ (fn.node);
  let callback = t.callExpression(t.identifier("__nativeLexicalCallback"), [
    t.stringLiteral(phase),
    expression,
    ...(deferred ? [t.booleanLiteral(true)] : [])
  ]);
  const target = callee?.isMemberExpression() ? key(callee.node.property) : key(callee?.node);
  const scheduled =
    /^(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback|addEventListener|removeEventListener)$/.test(
      target ?? ""
    );
  if (scheduled) {
    callback = t.callExpression(t.identifier("__nativeCallback"), [callback]);
    if (!program.scope.hasBinding("__nativeCallback"))
      program.node.body.unshift(
        t.importDeclaration(
          [t.importSpecifier(t.identifier("__nativeCallback"), t.identifier("nativeCallback"))],
          t.stringLiteral("solid-yield/internal")
        )
      );
  }
  if (name) fn.replaceWith(t.variableDeclaration("const", [t.variableDeclarator(name, callback)]));
  else fn.replaceWith(callback);
  if (!program.scope.hasBinding("__nativeLexicalCallback")) {
    program.node.body.unshift(
      t.importDeclaration(
        [
          t.importSpecifier(
            t.identifier("__nativeLexicalCallback"),
            t.identifier("nativeLexicalCallback")
          )
        ],
        t.stringLiteral("solid-yield/internal")
      )
    );
    program.scope.crawl();
  }
}
/** @param {Path} p @param {string} code @param {string} message @param {string} filename @returns {never} */
function fail(p, code, message, filename) {
  const at = p.node.loc?.start;
  const e = new Error(`[${code}] ${message} (${filename}:${at?.line}:${(at?.column ?? 0) + 1})`);
  Object.assign(e, {
    code,
    id: filename,
    loc: { file: filename, ...at },
    intermediateRead: p.toString(),
    intermediateHost: p.getFunctionParent()?.toString(),
    length: Math.max(0, (p.node.end ?? 0) - (p.node.start ?? 0))
  });
  throw e;
}
/** @param {string} code */
export function isSugar(code) {
  // Only a directive prologue opts in; a string elsewhere does not.
  return /^\s*(?:(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*["']use yield["']\s*;/.test(code);
}
/** @param {string} code @param {string} filename */
function seed(code, filename, native = false) {
  const p = parseProgram(code, filename);
  if (!p) throw new Error(`Cannot parse ${filename}`);
  traverseOwned(p, {
    Function(path) {
      if (path.node.generator && !native)
        fail(path, "SUGAR_EXPLICIT", "A sugar file cannot contain authored generators.", filename);
    }
  });
  let needsView = false,
    needsComponent = false;
  const wrapped = new WeakSet();
  traverseOwned(p, {
    Function: {
      exit(path) {
        const n = /** @type {any} */ (path.node);
        if (wrapped.has(n) || n.generator) {
          path.skip();
          return;
        }
        const call = path.parentPath.isCallExpression() ? path.parentPath : null;
        const name = call && lib(call.get("callee"));
        const propCall = ownerCall(path);
        const prop = path.parentPath.isObjectProperty() ? key(path.parentPath.node.key) : null;
        const isControl = propCall && control(propCall);
        const isCallback =
          (native &&
            call &&
            t.isIdentifier(call.node.callee) &&
            ["__nativeTry", "__nativeMap"].includes(call.node.callee.name)) ||
          constructors.has(name) ||
          (native &&
            propCall &&
            t.isIdentifier(propCall.node.callee) &&
            /^[A-Z]/.test(propCall.node.callee.name) &&
            prop === "children") ||
          (isControl && ["children", "when", "each", "fallback", "on"].includes(prop));
        // Errored's plain accessor fallback stays a Solid callback, not a row.
        const plainFallback = prop === "fallback" && lib(propCall?.get("callee")) === "Errored";
        let returnsJSX = holdsJSX(n.body);
        traverseOwned(path, {
          Function(q) {
            q.skip();
          },
          ReturnStatement(q) {
            returnsJSX ||= holdsJSX(q.node.argument);
          }
        });
        // F-S51: a component a module-level factory returns is one too.
        const factoryComponent =
          path.parentPath.isReturnStatement() && !path.getFunctionParent()?.getFunctionParent();
        const isComponent =
          /^[A-Z]/.test(fnName(path) ?? "") &&
          (!path.getFunctionParent() || factoryComponent) &&
          returnsJSX;
        if (returnsJSX && !path.getFunctionParent() && !isComponent)
          fail(
            path,
            "SUGAR_COMPONENT",
            "A sugar component needs a top-level PascalCase name.",
            filename
          );
        const row = isControl && prop === "children" && n.params.length > 0;
        if (!isComponent && (!isCallback || plainFallback)) return;
        if (n.async)
          fail(
            path,
            "SUGAR_ASYNC",
            "Use attempt inside a synchronous routine; async functions are not routines.",
            filename
          );
        // An arrow's `this` and `arguments` are its enclosing function's:
        // Babel's conversion hoists them there (`const _this = this`), so
        // the generator keeps their meaning.
        if (path.isArrowFunctionExpression()) path.arrowFunctionToExpression();
        Object.assign(n, path.node);
        n.generator = true;
        path.node.generator = true;
        if (isComponent || row) {
          needsView = true;
          /** Returns made views: wrapping one in a block revisits it. */
          const viewed = new WeakSet();
          traverseOwned(path, {
            Function(q) {
              q.skip();
            },
            ReturnStatement(q) {
              if (viewed.has(q.node)) return;
              // Native throw lowering returns raise(), which never completes.
              // It is a failure path, not a component return needing JSX.
              const failureReturn = q.get("argument").isTSAsExpression()
                ? q.get("argument.expression")
                : q.get("argument");
              // A context guard's raise (F-S37) is one too.
              if (
                native &&
                failureReturn.isCallExpression() &&
                (lib(failureReturn.get("callee")) === "raise" ||
                  lib(failureReturn.get("callee"), "solid-yield/internal") === "nativeContextGuard")
              )
                return;
              const argument = q.node.argument;
              const element = t.isJSXElement(argument) || t.isJSXFragment(argument);
              if (!native && !element)
                fail(
                  q,
                  "SUGAR_RETURN",
                  "A component or row must return JSX on every return path.",
                  filename
                );
              // D-125: in native mode a component returns what Solid renders:
              // nothing (`return null`, `return;`), or JSX through a ternary,
              // `&&`, an array. What the return computes outside its JSX is
              // computed in the body, as in Solid (a read there is the
              // body's); both arms' parts are, a may-check of either path.
              /** @type {any[]} */ const before = [];
              /** @param {any} e @returns {any} */
              const split = e => {
                if (!e || t.isJSXElement(e) || t.isJSXFragment(e)) return e;
                if (t.isNullLiteral(e) || t.isIdentifier(e, { name: "undefined" })) return e;
                if (t.isStringLiteral(e) || t.isNumericLiteral(e) || t.isBooleanLiteral(e))
                  return e;
                if (t.isParenthesizedExpression(e) && holdsJSX(e)) return split(e.expression);
                if (t.isConditionalExpression(e) && holdsJSX(e))
                  return t.conditionalExpression(
                    split(e.test),
                    split(e.consequent),
                    split(e.alternate)
                  );
                if (t.isLogicalExpression(e) && holdsJSX(e))
                  return t.logicalExpression(e.operator, split(e.left), split(e.right));
                if (t.isArrayExpression(e) && holdsJSX(e))
                  return t.arrayExpression(
                    e.elements.map(x => (x && !t.isSpreadElement(x) ? split(x) : x))
                  );
                const id = q.scope.generateUidIdentifier("returned");
                before.push(t.variableDeclaration("const", [t.variableDeclarator(id, e)]));
                return id;
              };
              const shown = element ? argument : split(argument ?? t.identifier("undefined"));
              q.node.argument = t.callExpression(t.identifier("view"), [
                t.functionExpression(null, [], t.blockStatement([t.returnStatement(shown)]), true)
              ]);
              viewed.add(q.node);
              if (before.length) {
                if (q.parentPath.isBlockStatement() || q.parentPath.isProgram())
                  q.insertBefore(before);
                else q.replaceWith(t.blockStatement([...before, q.node]));
              }
            }
          });
        }
        if (isComponent) {
          needsComponent = true;
          const expr = t.functionExpression(
            native &&
              path.parentPath.isVariableDeclarator() &&
              t.isIdentifier(path.parentPath.node.id) &&
              path.parentPath.node.id.typeAnnotation
              ? null
              : (n.id ?? t.identifier(fnName(path))),
            n.params,
            n.body,
            true
          );
          wrapped.add(expr);
          expr.typeParameters = n.typeParameters;
          expr.returnType = n.returnType;
          if (path.isFunctionDeclaration()) {
            const declaration = t.variableDeclaration("const", [
              t.variableDeclarator(n.id, t.callExpression(t.identifier("component"), [expr]))
            ]);
            if (path.parentPath.isExportDefaultDeclaration())
              path.parentPath.replaceWithMultiple([
                declaration,
                t.exportDefaultDeclaration(t.identifier(n.id.name))
              ]);
            else path.replaceWith(declaration);
          } else {
            wrapped.add(expr);
            path.replaceWith(t.callExpression(t.identifier("component"), [expr]));
            path.skip();
          }
        }
      }
    }
  });
  if (needsView || needsComponent) {
    // Reserve these names rather than silently shadowing user declarations.
    for (const name of [...(needsComponent ? ["component"] : []), ...(needsView ? ["view"] : [])]) {
      const binding = p.scope.getBinding(name)?.path;
      const generatedImport =
        native &&
        binding?.isImportSpecifier() &&
        binding.parentPath.isImportDeclaration() &&
        binding.parentPath.node.source.value === "solid-yield";
      if (p.scope.hasBinding(name) && !generatedImport)
        fail(
          binding ?? p,
          "SUGAR_NAME",
          `Reserve ${name} for the generated library import.`,
          filename
        );
    }
    p.node.body.unshift(
      t.importDeclaration(
        [...(needsComponent ? ["component"] : []), ...(needsView ? ["view"] : [])]
          .filter(n => !p.scope.hasBinding(n))
          .map(n => t.importSpecifier(t.identifier(n), t.identifier(n))),
        t.stringLiteral("solid-yield")
      )
    );
  }
  p.scope.crawl();
  traverseOwned(p, {
    Function: {
      exit(fn) {
        if (fn.node.async || fn.isObjectMethod() || fn.isClassMethod()) return;
        // Errored's accessor fallback is a contextual Solid callback, not a
        // generated routine. Its JSX holes and nested events own their reads.
        if (
          fn.parentPath?.isObjectProperty() &&
          key(fn.parentPath.node.key) === "fallback" &&
          lib(ownerCall(fn)?.get("callee")) === "Errored"
        )
          return;
        const call = fn.parentPath?.isCallExpression() ? fn.parentPath : null;
        const api = lib(call?.get("callee"));
        const callee = call?.get("callee");
        const continuation =
          callee?.isMemberExpression() &&
          ["then", "catch", "finally"].includes(key(callee.node.property));
        if (fn.node.generator && !continuation) return;
        // a method or a getter is lowered where it reads (delegate), never
        // wrapped; so is a reader a function hands back: its caller reads it
        if (
          fn.isObjectMethod() ||
          fn.isClassMethod() ||
          (native && (returnedReader(fn) || calledOnly(fn)))
        )
          return;
        if (
          api === "attempt" ||
          constructors.has(api) ||
          call?.node.callee === fn.node ||
          call?.get("callee").isIdentifier({ name: "__nativeLexicalCallback" }) ||
          call?.get("callee").isIdentifier({ name: "__nativeTry" }) ||
          call?.get("callee").isIdentifier({ name: "__nativeMap" }) ||
          // `untrack`'s callback runs in place (`nativeUntrack`, in delegate)
          (call?.node.arguments[0] === fn.node && lib(call.get("callee"), "solid-js") === "untrack")
        )
          return;
        const lexical = lexicalPhase(fn);
        const phase = lexical === "hole" && writingCallbackProp(fn) ? "event" : lexical;
        if (phase && reactiveCallback(fn)) wrapLexical(fn, phase, p);
      }
    }
  });
  p.node.directives = p.node.directives.filter(d => d.value.value !== "use yield");
  return printer(t.file(p.node));
}
/** A pass's program: the previous one's unchanged files are reused (`ts-host.js`).
 * @param {Map<string,string>} files @param {ts.CompilerOptions} options @param {ts.Program} [oldProgram] */
function programFor(files, options, oldProgram) {
  return ts.createProgram({
    rootNames: [...files.keys()],
    options,
    host: cachedHost(files, options),
    oldProgram
  });
}
/** @param {string} code @param {string} filename @param {ts.Program} program */
function pass(code, filename, program, native = false) {
  const source = program.getSourceFile(filename),
    checker = program.getTypeChecker();
  if (!source) throw new Error(`Missing source ${filename}`);
  const nodes = new Map();
  /** @param {ts.Node} n */
  const walk = n => {
    nodes.set(`${n.getStart(source)}:${n.end}`, n);
    ts.forEachChild(n, walk);
  };
  walk(source);
  const p = parseProgram(code, filename);
  if (!p) throw new Error(`Cannot parse ${filename}`);
  let changed = false;
  /** @param {Path} p */
  const type = p => {
    const n = nodes.get(`${p.node.start}:${p.node.end}`);
    return n && checker.getTypeAtLocation(n);
  };
  /** An authored iterator is a foreign return value, never a delegated routine.
   * @param {Path} path */
  const opaqueCall = path => {
    const node = nodes.get(`${path.node.start}:${path.node.end}`);
    if (!node || !ts.isCallExpression(node)) return false;
    const declaration = /** @type {ts.FunctionLikeDeclaration | undefined} */ (
      checker.getResolvedSignature(node)?.declaration
    );
    const body = declaration?.body;
    return (
      !!body &&
      ts.isBlock(body) &&
      body.statements.some(
        statement =>
          ts.isExpressionStatement(statement) &&
          ts.isStringLiteral(statement.expression) &&
          statement.expression.text === opaqueDirective
      )
    );
  };
  /** @param {ts.Type | undefined} v @param {string} b */
  const brand = (v, b) =>
    v && checker.getPropertiesOfType(v).some(s => s.name.startsWith(`__@${b}@`));
  /** @param {ts.Type | undefined} v */
  const sourceType = v => brand(v, "SOURCE") || brand(v, "CONTEXT");
  /** D-126: a `provide` whose context holds its value (not a `Source<…>`
   * context, whose value is reactive). @param {Path} call */
  const heldContext = call => {
    const provide = type(call.get("callee"));
    const provides = provide
      ?.getProperties()
      .find(/** @param {ts.Symbol} s */ s => s.name.startsWith("__@PROVIDES@"));
    const given = provides && checker.getTypeOfSymbolAtLocation(provides, source);
    const value = given?.getProperty("value");
    const held = value && checker.getTypeOfSymbolAtLocation(value, source);
    return !!held && !(held.flags & ts.TypeFlags.Any) && !brand(held, "SOURCE");
  };
  /** D-126: a reactive prop a caller may leave out (`label?:`): a source or
   * `undefined`. @param {ts.Type | undefined} v */
  const optionalSource = v =>
    !!v?.isUnion() &&
    v.types.some(m => !!(m.flags & ts.TypeFlags.Undefined)) &&
    v.types.every(m => !!(m.flags & ts.TypeFlags.Undefined) || brand(m, "SOURCE"));
  /** A call to a library setter (`set` of `const [v, set] = yield* $signal(…)`):
   * its receipt's type does not follow its callback's, so a setter given a
   * lexical callback is still delegated, and its write performed.
   * @param {Path} call */
  const setterCall = call => {
    const callee = /** @type {Path} */ (call.get("callee"));
    const binding = callee.isIdentifier() ? callee.scope.getBinding(callee.node.name) : null;
    const declarator = binding?.path;
    if (!declarator?.isVariableDeclarator() || !t.isArrayPattern(declarator.node.id)) return false;
    if (declarator.node.id.elements[1] !== binding?.identifier) return false;
    const init = declarator.get("init");
    const created = init.isYieldExpression() ? init.get("argument") : null;
    return (
      !!created?.isCallExpression() &&
      ["$signal", "$store", "$optimistic", "$optimisticStore"].includes(
        lib(created.get("callee")) ?? ""
      )
    );
  };
  /** A `then`/`catch`/`finally` receiver, or a const only ever one.
   * @param {Path} value */
  const chained = value => {
    /** @param {Path} p */
    const receiver = p =>
      p.key === "object" &&
      !!p.parentPath?.isMemberExpression() &&
      !p.parentPath.node.computed &&
      ["then", "catch", "finally"].includes(key(p.parentPath.node.property));
    if (receiver(value)) return true;
    const declarator = value.parentPath;
    if (!declarator?.isVariableDeclarator() || !t.isIdentifier(declarator.node.id)) return false;
    const refs = declarator.scope.getBinding(declarator.node.id.name)?.referencePaths ?? [];
    return refs.length > 0 && refs.every(receiver);
  };
  /** A plain function handed out as a value: returned, passed or stored, not
   * only called or read a member of (Effect's `invoke`).
   * @param {Path} fn */
  const handedOut = fn => {
    const id = fn.parentPath?.isVariableDeclarator()
      ? fn.parentPath.node.id
      : fn.isFunctionDeclaration()
        ? fn.node.id
        : null;
    if (!t.isIdentifier(id)) return false;
    const refs = fn.scope.parent?.getBinding(id.name)?.referencePaths ?? [];
    return refs.some(
      ref =>
        !(ref.key === "callee" && ref.parentPath?.isCallExpression()) &&
        !(ref.key === "object" && ref.parentPath?.isMemberExpression())
    );
  };
  /** An event call whose promise the code keeps (S15, D-121): chained with
   * `then`/`catch`/`finally`, or returned by a plain function handed out as a
   * value. Delegating would wait for the result, where the original holds
   * the promise and handles its rejection.
   * @param {Path} call */
  const keptEventCall = call => {
    if (!native || !brand(type(call), "EVENT_CALL")) return false;
    if (chained(call)) return true;
    const fn = call.getFunctionParent();
    const returned =
      call.parentPath?.isReturnStatement() ||
      (!!fn?.isArrowFunctionExpression() && fn.node.body === call.node);
    return returned && !!fn && !fn.node.generator && handedOut(fn);
  };
  /** @param {ts.Type | undefined} v */
  const isOperation = v => {
    if (!v) return false;
    if (brand(v, "EVENT_CALL") || brand(v, "COMPONENT")) return true;
    const kind = v.aliasSymbol?.name ?? v.symbol?.name;
    if (native && kind === "Generator") {
      const yields = checker.getTypeArguments(/** @type {ts.TypeReference} */ (v))[0];
      // During reconstruction a routine's yield type can still be unknown.
      // Only a proven plain data yield is excluded from delegation here.
      /** @param {ts.Type} y */
      const data = y =>
        !!(
          y.flags &
          (ts.TypeFlags.StringLike |
            ts.TypeFlags.NumberLike |
            ts.TypeFlags.BooleanLike |
            ts.TypeFlags.BigIntLike |
            ts.TypeFlags.Null |
            ts.TypeFlags.Undefined)
        );
      // An authored generator (an Effect saga, an iterator driven by hand)
      // yields its own values: data, or objects without the library's
      // operation brand. Only an operation, or a yield type still unresolved,
      // makes a routine to delegate to.
      /** @param {ts.Type} y */
      const authored = y =>
        data(y) ||
        !!(y.flags & (ts.TypeFlags.ESSymbolLike | ts.TypeFlags.Void)) ||
        (!!(y.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) && !brand(y, "KIND"));
      return !yields || !(yields.isUnion() ? yields.types : [yields]).every(authored);
    }
    return ["Generator", "Yieldable", "Receipt", "View"].includes(kind);
  };
  /** @param {Path} value */
  const handoff = value => {
    if (value.isCallExpression() && lib(value.get("callee")) === "foreign") return;
    // Already handed over (F-S43: with the contexts provided above its router).
    const callee = value.isCallExpression() ? value.get("callee") : null;
    if (
      callee?.isIdentifier({ name: "__nativeForeignValue" }) ||
      callee?.isIdentifier({ name: "__nativeForeignProvided" })
    )
      return;
    if (
      !native ||
      !type(value)
        ?.getCallSignatures()
        .some(
          /** @param {ts.Signature} sig */ sig =>
            brand(checker.getReturnTypeOfSignature(sig), "COMPONENT")
        )
    )
      return;
    value.replaceWith(t.callExpression(t.identifier("__nativeForeignValue"), [value.node]));
    if (!p.scope.hasBinding("__nativeForeignValue")) {
      p.node.body.unshift(
        t.importDeclaration(
          [t.importSpecifier(t.identifier("__nativeForeignValue"), t.identifier("nativeForeign"))],
          t.stringLiteral("solid-yield/internal")
        )
      );
      p.scope.crawl();
    }
    changed = true;
  };
  /** @param {ts.Signature} sig */
  const receiptSignature = sig => {
    const result = checker.getReturnTypeOfSignature(sig);
    return (result.aliasSymbol?.name ?? result.symbol?.name) === "Receipt";
  };
  /**
   * A library setter where the author's types expect a plain function (a
   * context value's `setRange: (range: Range) => void`): the author's Solid
   * setter wrote when called, so it is adapted to write when called.
   * @param {Path} value
   */
  const plainWriter = value => {
    if (!native || !(value.isIdentifier() || value.isMemberExpression())) return;
    const node = nodes.get(`${value.node.start}:${value.node.end}`);
    if (!node) return;
    // A setter itself (not a function that returns its receipt: that is a
    // lexical callback, hosted by its phase).
    const setter = checker.getTypeAtLocation(node);
    if (!["Setter", "StoreSetter"].includes(setter.aliasSymbol?.name ?? "")) return;
    if (!setter.getCallSignatures().some(receiptSignature)) return;
    const expected = checker.getContextualType(node)?.getNonNullableType();
    const signatures = expected?.getCallSignatures() ?? [];
    if (!signatures.length || signatures.some(receiptSignature)) return;
    if (value.parentPath.isObjectProperty() && value.parentPath.node.shorthand)
      value.parentPath.node.shorthand = false;
    value.replaceWith(t.callExpression(t.identifier("__nativeWrite"), [value.node]));
    if (!p.scope.hasBinding("__nativeWrite")) {
      p.node.body.unshift(
        t.importDeclaration(
          [t.importSpecifier(t.identifier("__nativeWrite"), t.identifier("nativeWrite"))],
          t.stringLiteral("solid-yield/internal")
        )
      );
      p.scope.crawl();
    }
    changed = true;
  };
  /** @type {Map<ts.Node, ts.TypeNode> | undefined} */ let providedSlots;
  /**
   * D-116: a callback prop a component's child calls (`<Button onClick={e =>
   * setN(e.detail)} />`, an F-S40 event) is typed by the child's declared
   * prop. Wrapped, its parameters lose that contextual type: the input also
   * admits a source or a hole, and their candidates meet at `never`. Write
   * the declared ones, from the widest plain function the slot admits.
   * @param {Path} call
   */
  const callbackPropParams = call => {
    const callee = /** @type {Path} */ (call.get("callee"));
    if (!native || !callee.isIdentifier({ name: "__nativeLexicalCallback" })) return;
    const owner = ownerCall(call);
    // a provider's value (`bump: (k: number) => …`) is typed by the context's
    // declared slot, as a prop is by the child's
    if (
      !providedValue(call) &&
      (!owner || control(owner) || !/^[A-Z]/.test(key(owner.node.callee) ?? ""))
    )
      return;
    const fn = /** @type {Path} */ (call.get("arguments.1"));
    const callNode = nodes.get(`${call.node.start}:${call.node.end}`);
    if (!fn?.isFunction() || !callNode) return;
    if (fn.node.params.every(/** @param {any} q */ q => q.typeAnnotation || t.isRestElement(q)))
      return;
    const declared = providedValue(call)
      ? (providedSlots ??= contextSlots(program, checker)).get(callNode)
      : undefined;
    const slot = declared
      ? checker.getTypeFromTypeNode(declared)
      : checker.getContextualType(callNode)?.getNonNullableType();
    if (!slot) return;
    const [signature] = (slot.isUnion() ? slot.types : [slot])
      .filter(member => !checker.getPropertiesOfType(member).some(m => m.name.startsWith("__@")))
      .flatMap(member => member.getCallSignatures())
      .sort((a, b) => b.parameters.length - a.parameters.length);
    if (!signature) return;
    const annotations = [];
    for (const [index, param] of fn.get("params").entries()) {
      /** @type {any} */ const node = param.node;
      if (!param.isIdentifier() || node.typeAnnotation) continue;
      const symbol = signature.parameters[index];
      const declaration = symbol?.valueDeclaration;
      if (!symbol || (declaration && ts.isParameter(declaration) && declaration.dotDotDotToken))
        return;
      const type = checker.getTypeOfSymbolAtLocation(symbol, callNode);
      if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return;
      const printed = checker.typeToTypeNode(type, callNode, ts.NodeBuilderFlags.NoTruncation);
      if (!printed) return;
      const text = ts.createPrinter().printNode(ts.EmitHint.Unspecified, printed, source);
      if (/__@|\bthis\b|\bunknown\b|\bany\b/.test(text)) return;
      const holder = parseProgram(`let __t: ${text};`, filename);
      /** @type {any} */ const statement = holder?.node.body[0];
      const annotation = statement?.declarations?.[0]?.id?.typeAnnotation;
      if (!annotation) return;
      annotations.push([node, annotation]);
    }
    if (!annotations.length) return;
    for (const [node, annotation] of annotations) node.typeAnnotation = annotation;
    changed = true;
  };
  /**
   * F-S46: an array method's lexical callback that runs in its own host (a
   * map in a hole, a filter in a memo, a forEach in an event) delegates its
   * operations there, so a pending or failing read inside it colors that
   * host. A hole callback goes through `nativeHoleColors`, which presents a
   * raise as the hole's failing read. Not delegated: a callback hosted
   * elsewhere (F-S40's event callback props), a scheduled or foreign one
   * (`nativeCallback`), a component's or control's prop (the child calls it),
   * one in a `ref` (no hole to read in), and a deferred continuation (`.then`):
   * its colors reach the host through the promise it is chained on.
   * @param {Path} call
   */
  const delegateLexical = call => {
    const callee = /** @type {Path} */ (call.get("callee"));
    if (!native || !callee.isIdentifier({ name: "__nativeLexicalCallback" })) return;
    const [phaseArg, , deferred] = call.node.arguments;
    if (!t.isStringLiteral(phaseArg) || t.isBooleanLiteral(deferred, { value: true })) return;
    // An array method's callback runs synchronously in the host, and the
    // method types its result from the callback's: it is delegated in place.
    const parent = call.parentPath;
    if (!parent?.isCallExpression() || !parent.node.arguments.includes(call.node)) return;
    const method = /** @type {Path} */ (parent.get("callee"));
    const receiver = method.isMemberExpression()
      ? type(/** @type {Path} */ (method.get("object")))
      : null;
    const arrayMethod =
      method.isMemberExpression() &&
      ARRAY_CALLBACKS.has(key(method.node.property) ?? "") &&
      !!receiver &&
      (checker.isArrayType(receiver) || checker.isTupleType(receiver));
    // F-S47: a callback given to any other function keeps its host too, but
    // the call may sit in a plain thunk (an attempt's), where no `yield*` can
    // go. It is hoisted into a binding just before the host's statement and
    // delegated there; only through parameterless thunks, and only when it
    // uses no binding they declare.
    /** @type {Path[]} */ const thunks = [];
    let host = /** @type {Path | null} */ (call.getFunctionParent());
    while (host && !host.node.generator) {
      if (arrayMethod || !host.isArrowFunctionExpression() || host.node.params.length) return;
      thunks.push(host);
      host = host.parentPath?.getFunctionParent() ?? null;
    }
    if (!host) return;
    // The lowering's own wrappers (`__nativeHoleColors`, …) are not consumers.
    if (
      !arrayMethod &&
      (lib(method) ||
        /^[A-Z]/.test(key(method.node) ?? "") ||
        (method.isIdentifier() && method.node.name.startsWith("__native")))
    )
      return;
    const phaseHere = lexicalPhase(call);
    if (phaseHere !== phaseArg.value && !(phaseArg.value === "setup" && phaseHere === null)) return;
    const owner = ownerCall(call);
    if (owner && (control(owner) || /^[A-Z]/.test(key(owner.node.callee) ?? ""))) return;
    if (
      call
        .findParent(
          q =>
            q.isFunction() ||
            (q.isJSXAttribute() && t.isJSXIdentifier(q.node.name, { name: "ref" }))
        )
        ?.isJSXAttribute()
    )
      return;
    // Under `yield*` the callback loses its contextual parameter types: write
    // the ones TypeScript gave it here. A callback this pass created has no
    // types yet; the next pass delegates it.
    const fn = /** @type {Path} */ (call.get("arguments.1"));
    const callNode = nodes.get(`${call.node.start}:${call.node.end}`);
    if (!fn.isFunction() || !callNode) return;
    // The slot the callback is passed to (the receiver method's parameter)
    // types it, independently of how far its own body is lowered.
    const [slot] =
      checker.getContextualType(callNode)?.getNonNullableType().getCallSignatures() ?? [];
    if (!slot) return;
    const annotations = [];
    for (const [index, param] of fn.get("params").entries()) {
      const target = /** @type {Path} */ (param.isAssignmentPattern() ? param.get("left") : param);
      /** @type {any} */ const node = target.node;
      if (node.typeAnnotation || param.isRestElement()) {
        if (param.isRestElement() && !node.typeAnnotation) return;
        continue;
      }
      const symbol = slot.parameters[index];
      const declaration = symbol?.valueDeclaration;
      // A rest slot (`...args`) types an array, not this parameter: leave it.
      if (!symbol || (declaration && ts.isParameter(declaration) && declaration.dotDotDotToken))
        return;
      const type = checker.getTypeOfSymbolAtLocation(symbol, callNode);
      // Not typed yet (its receiver is lowered in a later pass): wait.
      if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return;
      const printed = checker.typeToTypeNode(type, callNode, ts.NodeBuilderFlags.NoTruncation);
      if (!printed) return;
      const text = ts.createPrinter().printNode(ts.EmitHint.Unspecified, printed, source);
      // Not typed yet anywhere inside (`[string, unknown]` from a receiver a
      // later pass lowers) is not typed yet: wait; a type never settled is left.
      if (/__@|\bthis\b|\bunknown\b|\bany\b/.test(text)) return;
      const holder = parseProgram(`let __t: ${text};`, filename);
      /** @type {any} */ const statement = holder?.node.body[0];
      const annotation = statement?.declarations?.[0]?.id?.typeAnnotation;
      if (!annotation) return;
      annotations.push([node, annotation]);
    }
    for (const [node, annotation] of annotations) node.typeAnnotation = annotation;
    let operand = call.node;
    if (phaseArg.value === "hole") {
      operand = t.callExpression(t.identifier("__nativeHoleColors"), [call.node]);
      if (!p.scope.hasBinding("__nativeHoleColors")) {
        p.node.body.unshift(
          t.importDeclaration(
            [
              t.importSpecifier(
                t.identifier("__nativeHoleColors"),
                t.identifier("nativeHoleColors")
              )
            ],
            t.stringLiteral("solid-yield/internal")
          )
        );
        p.scope.crawl();
      }
    }
    if (!thunks.length && arrayMethod) {
      call.replaceWith(t.yieldExpression(operand, true));
      changed = true;
      return;
    }
    let inner = false;
    fn.traverse({
      ReferencedIdentifier(ref) {
        const binding = ref.scope.getBinding(ref.node.name);
        // Its own parameters and locals move with it.
        if (binding?.path.isDescendant(fn)) return;
        if (binding && thunks.some(thunk => binding.path.isDescendant(thunk))) inner = true;
      }
    });
    if (inner) return;
    let statement = call.getStatementParent();
    while (statement && statement.getFunctionParent() !== host)
      statement = statement.parentPath?.getStatementParent() ?? null;
    if (!statement) return;
    const id = statement.scope.generateUidIdentifier("callback");
    const [declaration] = statement.insertBefore(
      t.variableDeclaration("const", [t.variableDeclarator(id, t.yieldExpression(operand, true))])
    );
    // Visible to this pass's later checks of the call (`bridgedCall`).
    declaration.scope.registerDeclaration(declaration);
    call.replaceWith(id);
    changed = true;
  };
  /** F-S40: does this call write (a setter's receipt, refresh) or call an event?
   * @param {Path} call */
  const writes = call => {
    const v = type(call);
    if (!v) return false;
    if (brand(v, "EVENT_CALL") || (v.aliasSymbol?.name ?? v.symbol?.name) === "Receipt")
      return true;
    const iterator = checker.getPropertiesOfType(v).find(s => s.name.startsWith("__@iterator@"));
    const method = iterator && checker.getTypeOfSymbolAtLocation(iterator, source);
    return !!method?.getCallSignatures().some(sig => {
      const result = checker.getReturnTypeOfSignature(sig);
      const [yields] =
        result.symbol?.name === "Generator"
          ? checker.getTypeArguments(/** @type {ts.TypeReference} */ (result))
          : [];
      return (yields?.isUnion() ? yields.types : yields ? [yields] : []).some(part => {
        const kind = checker.getPropertiesOfType(part).find(s => s.name.startsWith("__@KIND@"));
        return (
          !!kind &&
          checker.typeToString(checker.getTypeOfSymbolAtLocation(kind, source)) === '"write"'
        );
      });
    });
  };
  /** F-S40: a function passed as a component prop that writes is a callback the child
   * calls from an event, not a render callback: render cannot write.
   * @param {Path} fn */
  const eventCallbackProp = fn => {
    const call = ownerCall(fn);
    if (!providedValue(fn)) {
      if (!call || control(call) || !brand(type(call), "COMPONENT")) return false;
      if (["children", "fallback"].includes(propKey(fn))) return false;
    }
    let found = false;
    traverseOwned(fn, {
      Function(inner) {
        if (inner !== fn) inner.skip();
      },
      CallExpression(site) {
        found ||= writes(site);
      }
    });
    return found;
  };
  /** A routine's declared result type (`resolveFork(): <A, E>(effect: …) =>
   * …`) stays on what it returns (`as T`): it types the returned callbacks'
   * parameters and gives callers that type, which the inferred union may not
   * (an `as any` branch makes it `any`). An assertion, not `satisfies`: the
   * model's values can differ from Solid's here (an `$event`'s promise may
   * resolve `undefined`, D-085, where an action's does not). An async
   * function's declared `Promise<T>` was removed when its awaits were lowered.
   * @param {Path} fn */
  function keepDeclaredResult(fn) {
    const declared = fn.node.returnType;
    if (!t.isTSTypeAnnotation(declared) || t.isTSTypePredicate(declared.typeAnnotation)) return;
    let result = /** @type {import("@babel/core").types.TSType} */ (declared.typeAnnotation);
    // A promise it returns is attempted (awaited) where it is made: the
    // routine's result is the promised value.
    if (
      t.isTSTypeReference(result) &&
      t.isIdentifier(result.typeName) &&
      ["Promise", "PromiseLike"].includes(result.typeName.name) &&
      result.typeParameters?.params.length === 1
    )
      result = result.typeParameters.params[0];
    // `() => T` is Solid's accessor shape: the model returns a source there.
    /** @type {any} */ const accessor = result;
    if (t.isTSFunctionType(result) && !(accessor.parameters ?? accessor.params ?? []).length)
      return;
    traverseOwned(fn, {
      Function(inner) {
        inner.skip();
      },
      ReturnStatement(ret) {
        const value = ret.node.argument;
        if (!value || t.isTSAsExpression(value)) return;
        ret.node.argument = t.tsAsExpression(value, t.cloneNode(result, true));
      }
    });
  }
  /** @param {Path} path @param {any} [operand] */
  function delegate(path, operand = path.node) {
    const fn = path.getFunctionParent();
    if (!fn) return; // root renderer calls and foreign edges stay plain
    // An async generator is a stream producer (F-S53), not a routine: the
    // attempt that drives it takes what it yields as the stream's values, so
    // a `yield*` there would put the operation in the stream. A setter's call
    // stays plain, where the lint reports the dropped write; a read is refused.
    if (fn.node.generator && fn.node.async) {
      if (path.isCallExpression() && setterCall(path)) return;
      fail(
        path,
        "READ_IN_OPAQUE_GENERATOR",
        "this signal is read inside a generator the compiler does not own; read it outside and pass the value in, or make the read a memo",
        filename
      );
    }
    // A library renderer's root code (`renderToStream(() => Root({ url }))`)
    // is the root, checked by the renderer itself (D-099), not a callback.
    const renderer = fn.parentPath?.isCallExpression() ? fn.parentPath : null;
    if (
      renderer &&
      renderer.node.arguments[0] === fn.node &&
      ["render", "hydrate", "renderToString", "renderToStream"].includes(
        lib(renderer.get("callee")) ?? ""
      )
    )
      return;
    // The same root code bound for its check (`const __nativeRoot = () => Root({ url })`).
    if (
      fn.parentPath?.isVariableDeclarator() &&
      t.isIdentifier(fn.parentPath.node.id) &&
      /^__nativeRoot\d*$/.test(fn.parentPath.node.id.name)
    )
      return;
    if (!fn.node.generator) {
      const member = fn.isObjectMethod() || fn.isClassMethod();
      // D-124: a getter that reads (`get total() { return count() * 2; }`)
      // hands back a source over its body, read where the property is.
      if (native && member && fn.node.kind === "get" && !fn.node.async) {
        const self = fn.scope.generateUidIdentifier("self");
        let usesThis = false;
        /** @type {Path} */ (fn.get("body")).traverse({
          Function(/** @type {Path} */ q) {
            if (!q.isArrowFunctionExpression()) q.skip();
          },
          Class(/** @type {Path} */ q) {
            q.skip();
          },
          ThisExpression(/** @type {Path} */ q) {
            usesThis = true;
            q.replaceWith(t.cloneNode(self));
          }
        });
        const body = /** @type {import("@babel/core").types.BlockStatement} */ (fn.node.body);
        fn.node.body = t.blockStatement([
          ...(usesThis
            ? [t.variableDeclaration("const", [t.variableDeclarator(self, t.thisExpression())])]
            : []),
          t.returnStatement(
            t.callExpression(t.identifier("__nativeGetter"), [
              t.functionExpression(null, [], body, true)
            ])
          )
        ]);
        fn.node.returnType = null;
        if (p && !p.scope.hasBinding("__nativeGetter")) {
          p.node.body.unshift(
            t.importDeclaration(
              [t.importSpecifier(t.identifier("__nativeGetter"), t.identifier("nativeGetter"))],
              t.stringLiteral("solid-yield/internal")
            )
          );
          p.scope.crawl();
        }
        changed = true;
        return;
      }
      // a method that reads is a routine its callers delegate to (`yield* o.total()`)
      const method = native && member && fn.node.kind === "method" && !fn.node.async;
      if (fn.node.async || (member && !method))
        fail(
          path,
          "SUGAR_HOST",
          "Reactive operations in async functions or methods are unsupported.",
          filename
        );
      const hostCall = fn.parentPath?.isCallExpression() ? fn.parentPath : null;
      const attemptHandler =
        lib(hostCall?.get("callee")) === "attempt" && hostCall?.node.arguments[1] === fn.node;
      let nativeHost = false;
      // D-124: Solid's `untrack(() => …)`: the callback runs at once in the
      // routine around it, its reads untracked (`nativeUntrack`); in a
      // component's body, where Solid reads once, settled reads only.
      const untrackCall =
        native &&
        hostCall?.node.arguments[0] === fn.node &&
        lib(hostCall.get("callee"), "solid-js") === "untrack";
      if (untrackCall && hostCall) {
        const host = hostCall.findParent(f => f.isFunction() && !!f.node.generator);
        const setup =
          !!host?.parentPath?.isCallExpression() &&
          lib(host.parentPath.get("callee")) === "component";
        const bridge = setup ? "__nativeUntrackSetup" : "__nativeUntrack";
        if (fn.isArrowFunctionExpression()) fn.arrowFunctionToExpression();
        fn.node.generator = true;
        hostCall.get("callee").replaceWith(t.identifier(bridge));
        if (p && !p.scope.hasBinding(bridge)) {
          p.node.body.unshift(
            t.importDeclaration(
              [t.importSpecifier(t.identifier(bridge), t.identifier(bridge.slice(2)))],
              t.stringLiteral("solid-yield/internal")
            )
          );
          p.scope.crawl();
        }
        nativeHost = true;
      }
      // An IIFE runs where it is written: an inline routine its host
      // delegates to (the call's type is a generator's: `yield*` follows),
      // so its reads and their colors are the host's.
      const iife =
        native &&
        !untrackCall &&
        hostCall?.node.callee === fn.node &&
        !fn.node.async &&
        !!hostCall?.findParent(f => f.isFunction() && !!f.node.generator);
      if (iife && hostCall) {
        if (fn.isArrowFunctionExpression()) fn.arrowFunctionToExpression();
        fn.node.generator = true;
        nativeHost = true;
        // in a JSX hole, what it raises is the hole's failing read
        // (`nativeHole`). Bound before the view's statement, in a thunk the
        // hole calls: inline, JSX's contextual typing widens its colors to
        // `any` (a `try` in it).
        for (
          let up = /** @type {Path | null} */ (hostCall.parentPath);
          up && !up.isFunction();
          up = up.parentPath
        )
          if (up.isJSXExpressionContainer()) {
            const held = t.callExpression(t.identifier("__nativeHole"), [hostCall.node]);
            const host = hostCall.getFunctionParent();
            const statement = host?.node.generator
              ? hostCall.findParent(x => x.isStatement() && x.getFunctionParent() === host)
              : null;
            if (host && statement) {
              const id = host.scope.generateUidIdentifier("hole");
              statement.insertBefore(
                t.variableDeclaration("const", [
                  t.variableDeclarator(id, t.arrowFunctionExpression([], held))
                ])
              );
              hostCall.replaceWith(t.callExpression(t.cloneNode(id), []));
            } else hostCall.replaceWith(held);
            if (p && !p.scope.hasBinding("__nativeHole")) {
              p.node.body.unshift(
                t.importDeclaration(
                  [t.importSpecifier(t.identifier("__nativeHole"), t.identifier("nativeHole"))],
                  t.stringLiteral("solid-yield/internal")
                )
              );
              p.scope.crawl();
            }
            break;
          }
      }
      // a method is a routine of its own (`*total()`), never a lexical callback
      let phase =
        untrackCall || iife || method || (native && (returnedReader(fn) || calledOnly(fn)))
          ? null
          : lexicalPhase(fn);
      if (phase === "hole" && eventCallbackProp(fn)) phase = "event";
      // An array method's callback in a component's body runs there: its
      // operations are the body's (a read is READ_IN_SETUP, as one beside it).
      // Its receiver may be a read not lowered yet (`items().filter(…)`).
      if (
        native &&
        !phase &&
        !nativeHost &&
        hostCall?.isCallExpression() &&
        hostCall.node.arguments.includes(/** @type {any} */ (fn.node)) &&
        t.isMemberExpression(hostCall.node.callee) &&
        ARRAY_CALLBACKS.has(key(hostCall.node.callee.property) ?? "")
      ) {
        const body = hostCall.getFunctionParent();
        if (
          body?.node.generator &&
          body.parentPath?.isCallExpression() &&
          lib(body.parentPath.get("callee")) === "component"
        )
          phase = "setup";
      }
      // Attempt producers must stay plain: their arguments are handled by the
      // native call lowering, not by turning a producer into a routine.
      if (
        phase &&
        !(lib(hostCall?.get("callee")) === "attempt" && hostCall?.node.arguments[0] === fn.node)
      ) {
        if (p) wrapLexical(fn, phase, p);
        nativeHost = true;
      }
      if (native && !nativeHost) {
        const scheduler =
          /^(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback|addEventListener|removeEventListener)$/;
        /** @param {Path | null} call */
        const isScheduler = call =>
          call?.isCallExpression() &&
          scheduler.test(
            key(
              t.isMemberExpression(call.node.callee) ? call.node.callee.property : call.node.callee
            )
          );
        const binding = fnName(fn) ? fn.scope.parent?.getBinding(fnName(fn)) : undefined;
        const promiseHost =
          hostCall?.isCallExpression() &&
          t.isMemberExpression(hostCall.node.callee) &&
          ["then", "catch", "finally"].includes(key(hostCall.node.callee.property)) &&
          (() => {
            const receiver = type(hostCall.get("callee.object"));
            return (
              !!receiver &&
              (receiver.symbol?.name === "Promise" || receiver.symbol?.name === "PromiseLike")
            );
          })();
        /** A call whose result nothing takes: a statement, or the body of an
         * arrow a timer or a listener runs (`setTimeout(() => run(…))`).
         * @param {Path | null} call */
        const ignored = call => {
          if (!call?.isCallExpression()) return false;
          if (call.parentPath.isExpressionStatement()) return true;
          const arrow = call.parentPath;
          if (!arrow.isArrowFunctionExpression() || arrow.node.body !== call.node) return false;
          if (isScheduler(arrow.parentPath)) return true;
          const declarator = arrow.parentPath.isVariableDeclarator() ? arrow.parentPath : null;
          const id = declarator?.node.id;
          const refs = t.isIdentifier(id)
            ? (declarator?.scope.getBinding(id.name)?.referencePaths ?? [])
            : [];
          return refs.length > 0 && refs.every(ref => isScheduler(ref.parentPath));
        };
        const eventHost =
          promiseHost ||
          isScheduler(hostCall) ||
          (ignored(hostCall) && lib(hostCall?.get("callee")) !== "attempt") ||
          (binding?.referencePaths.length &&
            binding.referencePaths.every(
              ref => ref.findParent(p => p.isTSType()) || isScheduler(ref.parentPath)
            ));
        if (eventHost) {
          if (fn.isArrowFunctionExpression()) fn.arrowFunctionToExpression();
          fn.node.generator = true;
          if (fn.isFunctionDeclaration()) {
            const expression = t.functionExpression(null, fn.node.params, fn.node.body, true);
            fn.replaceWith(
              t.variableDeclaration("const", [
                t.variableDeclarator(
                  /** @type {import("@babel/core").types.Identifier} */ (fn.node.id),
                  t.callExpression(t.identifier("__nativeCallback"), [
                    t.callExpression(t.identifier("__nativeEvent"), [expression])
                  ])
                )
              ])
            );
          } else {
            const event = t.callExpression(t.identifier("__nativeEvent"), [
              /** @type {import("@babel/core").types.FunctionExpression} */ (fn.node)
            ]);
            fn.replaceWith(t.callExpression(t.identifier("__nativeCallback"), [event]));
          }
          if (p && !p.scope.hasBinding("__nativeEvent")) {
            p.node.body.unshift(
              t.importDeclaration(
                [t.importSpecifier(t.identifier("__nativeEvent"), t.identifier("$event"))],
                t.stringLiteral("solid-yield")
              )
            );
            p.scope.crawl();
          }
          if (p && !p.scope.hasBinding("__nativeCallback")) {
            p.node.body.unshift(
              t.importDeclaration(
                [
                  t.importSpecifier(
                    t.identifier("__nativeCallback"),
                    t.identifier("nativeCallback")
                  )
                ],
                t.stringLiteral("solid-yield/internal")
              )
            );
            p.scope.crawl();
          }
          nativeHost = true;
        } else if (
          hostCall?.isCallExpression() &&
          t.isMemberExpression(hostCall.node.callee) &&
          key(hostCall.node.callee.property) === "map" &&
          (() => {
            const receiver = type(hostCall.get("callee.object"));
            return !!receiver && (checker.isArrayType(receiver) || checker.isTupleType(receiver));
          })()
        ) {
          if (fn.isArrowFunctionExpression()) fn.arrowFunctionToExpression();
          fn.node.generator = true;
          hostCall.replaceWith(
            t.callExpression(t.identifier("__nativeMap"), [
              hostCall.node.callee.object,
              ...hostCall.node.arguments
            ])
          );
          if (p && !p.scope.hasBinding("__nativeMap")) {
            p.node.body.unshift(
              t.importDeclaration(
                [t.importSpecifier(t.identifier("__nativeMap"), t.identifier("nativeMap"))],
                t.stringLiteral("solid-yield/internal")
              )
            );
            p.scope.crawl();
          }
          nativeHost = true;
        }
      }
      if (!fnName(fn) && !method && !returnedReader(fn) && !attemptHandler && !nativeHost)
        fail(
          path,
          "SUGAR_CALLBACK",
          "A reactive read in an unknown callback has no routine host; use a memo, event, or hole.",
          filename
        );
      if (!nativeHost) {
        if (fn.isArrowFunctionExpression()) fn.arrowFunctionToExpression();
        fn.node.generator = true;
        if (native) {
          keepDeclaredResult(fn);
          fn.node.returnType = null;
        }
      }
    }
    path.replaceWith(t.yieldExpression(operand, true));
    path.skip();
    changed = true;
  }
  // Select structural array operations on the store's value, never on its
  // reactive row paths. Keep the entire method chain in one tracked read.
  if (native)
    traverseOwned(p, {
      CallExpression(path) {
        const callee = path.get("callee");
        if (!callee.isMemberExpression()) return;
        // a store path's read this pass inserted first (`(yield* store.list).map(…)`)
        const held = callee.get("object");
        const object =
            held.isYieldExpression({ delegate: true }) && held.get("argument").isMemberExpression()
              ? held.get("argument")
              : held,
          ct = type(object);
        if (!sourceType(ct)) return;
        const symbol = checker.getPropertiesOfType(ct).find(s => s.name.startsWith("__@SOURCE@"));
        const value = symbol && checker.getTypeOfSymbolAtLocation(symbol, source);
        if (!value || (!checker.isArrayType(value) && !checker.isTupleType(value))) return;
        if (
          ![
            "filter",
            "map",
            "every",
            "some",
            "find",
            "findIndex",
            "findLast",
            "findLastIndex",
            "slice",
            "reduce",
            "reduceRight",
            "includes",
            "indexOf",
            "lastIndexOf",
            "join",
            "flatMap",
            "flat",
            "at",
            "concat",
            "toSorted",
            "toReversed"
          ].includes(key(callee.node.property))
        )
          return;
        /** @type {Path} */ let chain = path;
        while (
          chain.parentPath?.isMemberExpression() &&
          chain.parentPath.node.object === chain.node
        ) {
          chain = chain.parentPath;
          if (chain.parentPath?.isCallExpression() && chain.parentPath.node.callee === chain.node)
            chain = chain.parentPath;
        }
        // An argument that reads or calls (`reduce(add, n())`) stays in the
        // routine: the selector is a plain function.
        let reads = false;
        for (let at = /** @type {Path | null} */ (path); at; at = at.parentPath) {
          if (at.isCallExpression())
            for (const arg of /** @type {Path[]} */ (at.get("arguments"))) {
              if (arg.isFunction()) continue;
              if (arg.isYieldExpression() || arg.isCallExpression()) reads = true;
              arg.traverse({
                Function(q) {
                  q.skip();
                },
                "YieldExpression|CallExpression"() {
                  reads = true;
                }
              });
            }
          if (at === chain) break;
        }
        if (reads) {
          // the path is read where it stands (`(yield* store.list).reduce(…)`)
          if (held === object) delegate(object);
          return;
        }
        const store = /** @type {any} */ (object.node),
          state = path.scope.generateUidIdentifier("state");
        held.replaceWith(state);
        chain.replaceWith(
          copyPosition(
            t.callExpression(t.identifier("__nativeReadStore"), [
              store,
              t.arrowFunctionExpression([state], chain.node)
            ]),
            chain.node
          )
        );
        if (!p.scope.hasBinding("__nativeReadStore")) {
          p.node.body.unshift(
            t.importDeclaration(
              [t.importSpecifier(t.identifier("__nativeReadStore"), t.identifier("readStore"))],
              t.stringLiteral("solid-yield")
            )
          );
          p.scope.crawl();
        }
        chain.skip();
        changed = true;
      }
    });
  /** A lexical callback, in place or hoisted into a binding (F-S47). @param {Path} arg */
  const lexicalArgument = arg => {
    if (
      arg.isCallExpression() &&
      arg.get("callee").isIdentifier({ name: "__nativeLexicalCallback" })
    )
      return true;
    if (!arg.isIdentifier()) return false;
    const binding = arg.scope.getBinding(arg.node.name)?.path;
    /** @type {Path | null} */
    let init = binding?.isVariableDeclarator() ? /** @type {Path} */ (binding.get("init")) : null;
    if (!init?.isYieldExpression()) return false;
    init = /** @type {Path} */ (init.get("argument"));
    if (init.isCallExpression() && init.get("callee").isIdentifier({ name: "__nativeHoleColors" }))
      init = init.get("arguments.0");
    return (
      init.isCallExpression() &&
      init.get("callee").isIdentifier({ name: "__nativeLexicalCallback" })
    );
  };
  /** A call given a lexical callback: until the callback's reads are lowered,
   * its result type follows the callback's provisional one. @param {Path} call */
  const bridgedCall = call => /** @type {Path[]} */ (call.get("arguments")).some(lexicalArgument);
  traverseOwned(p, {
    YieldExpression(path) {
      const value = path.get("argument");
      if (!path.node.delegate || !value.isCallExpression()) return;
      const bridged = bridgedCall(value);
      // A callback's return changes from a routine result to its driven value
      // once its reads are lowered. Remove only that provisional delegation.
      const result = type(value);
      if (
        bridged &&
        result &&
        !(result.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) &&
        !isOperation(result)
      ) {
        path.replaceWith(value.node);
        changed = true;
      }
    },
    Identifier(path) {
      // Solid's Repeat index is a number; the library's is a source (D-055).
      // Each value use of it is a read (a key is the member rule's).
      if (!native || !path.isReferencedIdentifier() || path.parentPath.isYieldExpression()) return;
      if (path.parentPath.isMemberExpression() && path.key === "property") return;
      const binding = path.scope.getBinding(path.node.name);
      const fn = binding?.kind === "param" ? binding.path.parentPath : null;
      if (!fn?.isFunction() || fn.node.params[0] !== binding?.path.node) return;
      const prop = fn.parentPath;
      if (!prop?.isObjectProperty() || key(prop.node.key) !== "children") return;
      const call = prop.parentPath?.parentPath;
      if (!call?.isCallExpression() || lib(call.get("callee")) !== "Repeat") return;
      if (path.getFunctionParent() === fn || !sourceType(type(path))) return;
      delegate(path);
    },
    ReturnStatement(path) {
      if (!native) return;
      const value = path.get("argument");
      if (!value.isIdentifier() || !sourceType(type(value))) return;
      const binding = value.scope.getBinding(value.node.name)?.path;
      const init = binding?.isVariableDeclarator() ? binding.get("init") : null;
      // Context destructuring forwards paths at declaration; returning that
      // native store from a value getter reads it at the getter's call site.
      if (init?.isMemberExpression()) delegate(value);
    },
    CallExpression: {
      enter(path) {
        if (!native || lib(path.get("callee")) !== "attempt") return;
        const producer = path.get("arguments.0");
        if (!producer?.isArrowFunctionExpression()) return;
        const body = producer.get("body");
        if (!body.isCallExpression()) return;
        // Native inference runs before context/prop accessors acquire their
        // library types. Once resolved as a source or routine, its own failure
        // color is authoritative; do not drive it inside a plain producer.
        // A call given a lexical callback is not one: its result only looks
        // like an operation while the callback's reads are unlowered.
        if (
          !opaqueCall(body) &&
          (sourceType(type(body.get("callee"))) || (isOperation(type(body)) && !bridgedCall(body)))
        ) {
          // A hole's attempt (`__nativeHole(attempt(…))`) goes with its wrapper;
          // the call put there is visited afresh, the detached attempt not at all.
          const hole = path.parentPath;
          if (
            hole.isCallExpression() &&
            hole.get("callee").isIdentifier({ name: "__nativeHole" })
          ) {
            path.skip();
            hole.replaceWith(body.node);
          } else path.replaceWith(body.node);
          changed = true;
        }
      },
      exit(path) {
        for (const argument of path.get("arguments")) plainWriter(argument);
        delegateLexical(path);
        if (path.isCallExpression()) callbackPropParams(path);
        if (!path.isCallExpression()) return;
        if (
          native &&
          path.get("callee").isCallExpression() &&
          lib(path.get("callee.callee")) === "foreign"
        )
          return;
        if (opaqueCall(path)) return;
        const callee = path.get("callee"),
          ct = type(callee);
        // A hole's attempt (`__nativeHole(…)`) is delegated through its wrapper.
        const delegated =
          path.parentPath.isYieldExpression({ delegate: true }) ||
          (path.listKey === "arguments" &&
            path.parentPath.isCallExpression() &&
            path.parentPath.get("callee").isIdentifier({ name: "__nativeHole" }));
        const fallback = path.getFunctionParent();
        if (
          native &&
          fallback &&
          !fallback.node.generator &&
          fallback.parentPath.isObjectProperty() &&
          key(fallback.parentPath.node.key) === "fallback" &&
          lib(ownerCall(fallback)?.get("callee")) === "Errored" &&
          callee.isIdentifier() &&
          t.isIdentifier(fallback.node.params[0], { name: callee.node.name })
        )
          return;
        if (sourceType(ct)) {
          const sourceBrand = checker
            .getPropertiesOfType(ct)
            .find(s => s.name.startsWith("__@SOURCE@"));
          const value = sourceBrand && checker.getTypeOfSymbolAtLocation(sourceBrand, source);
          if (value?.getCallSignatures().length) {
            // A context/prop containing an event: first read it, then call it.
            const fn = path.getFunctionParent();
            if (!fn) return;
            callee.replaceWith(
              t.yieldExpression(
                /** @type {import("@babel/core").types.Expression} */ (callee.node),
                true
              )
            );
            fn.node.generator = true;
            changed = true;
          } else {
            if (path.node.arguments.length)
              fail(path, "SUGAR_READ_ARGS", "A source read takes no arguments.", filename);
            if (delegated) {
              path.replaceWith(callee.node);
              changed = true;
            } else delegate(path, callee.node);
          }
        } else if (
          !delegated &&
          ((isOperation(type(path)) &&
            (!bridgedCall(path) || setterCall(path)) &&
            !keptEventCall(path)) ||
            lib(callee) === "readStore" ||
            (native && ["latestOf", "isPendingOf"].includes(lib(callee))))
        )
          delegate(path);
      }
    },
    MemberExpression: {
      exit(path) {
        // A source as a computed key is read: Solid's Repeat index is a
        // number, the library's a source (D-055), and a key is a value.
        const property = path.get("property");
        if (path.node.computed && !property.isYieldExpression() && sourceType(type(property))) {
          delegate(property);
          return;
        }
        // A path given to isPendingOf, latestOf, refresh or readStore (a
        // structural read's store) is that source.
        if (
          path.listKey === "arguments" &&
          (["isPendingOf", "latestOf", "refresh"].includes(
            lib(path.parentPath.get("callee")) ?? ""
          ) ||
            (lib(path.parentPath.get("callee")) === "readStore" && path.key === 0))
        )
          return;
        // F-S39: a member the source itself lacks (a string's toLowerCase, a
        // number's toFixed) belongs to its value: read the source, then look
        // the member up. A path key (props.item.title) stays a path. A
        // parameter too: a row of strings (`w => w.length`). Not a setup local
        // holding a source (`const p = props.url ?? …`): that read is the
        // setup's, already refused there (READ_IN_SETUP). A source of `any`,
        // whose members TypeScript leaves unchecked (`row.name`, a store's or
        // a context's `state.rows`), is read where a routine uses it.
        const base = path.get("object");
        const baseKind = base.isIdentifier() ? base.scope.getBinding(base.node.name)?.kind : null;
        if (native && baseKind && !path.node.computed) {
          const own = type(base);
          const name = key(path.node.property);
          const brandSymbol = own
            ?.getProperties()
            .find(/** @param {ts.Symbol} s */ s => s.name.startsWith("__@SOURCE@"));
          const held = brandSymbol && checker.getTypeOfSymbolAtLocation(brandSymbol, source);
          const intrinsic = /** @type {{ intrinsicName?: string }} */ (held ?? {}).intrinsicName;
          // `any` as written, not a list still in error midway through the lowering
          const writtenAny = !!held && !!(held.flags & ts.TypeFlags.Any) && intrinsic === "any";
          if (
            own &&
            name &&
            held &&
            // A row's item is `Source<never>` until its list is lowered;
            // a member of `unknown` is TypeScript's error, as in the original.
            !(held.flags & (ts.TypeFlags.Never | ts.TypeFlags.Unknown)) &&
            (writtenAny
              ? anyHostReady(path.getFunctionParent())
              : !(held.flags & ts.TypeFlags.Any) && baseKind === "param") &&
            !own.getProperty(name) &&
            !checker.getIndexInfosOfType(own).length
          ) {
            delegate(base);
            return;
          }
        }
        if (
          path.parentPath.isMemberExpression() &&
          path.key === "object" &&
          !path.parentPath.node.computed
        ) {
          const own = type(path);
          const name = key(path.parentPath.node.property);
          if (
            own &&
            name &&
            sourceType(own) &&
            !own.getProperty(name) &&
            !checker.getIndexInfosOfType(own).length
          ) {
            delegate(path);
            return;
          }
        }
        if (
          path.parentPath.isYieldExpression() ||
          (path.parentPath.isMemberExpression() && path.key === "object") ||
          (path.parentPath.isCallExpression() && path.key === "callee")
        )
          return;
        if (native && optionalSource(type(path))) {
          if (
            path.parentPath.isCallExpression() &&
            path.parentPath.get("callee").isIdentifier({ name: "__nativeOptional" })
          )
            return;
          // passed on as it is to a component's or a control's prop (D-065)
          const field = path.parentPath;
          const call = field.isObjectProperty() ? field.parentPath.parentPath : null;
          if (call?.isCallExpression() && (control(call) || brand(type(call), "COMPONENT"))) return;
          delegate(path, t.callExpression(t.identifier("__nativeOptional"), [path.node]));
          if (p && !p.scope.hasBinding("__nativeOptional")) {
            p.node.body.unshift(
              t.importDeclaration(
                [
                  t.importSpecifier(
                    t.identifier("__nativeOptional"),
                    t.identifier("nativeOptional")
                  )
                ],
                t.stringLiteral("solid-yield/internal")
              )
            );
            p.scope.crawl();
          }
          return;
        }
        if (!sourceType(type(path))) return;
        if (native && path.parentPath.isVariableDeclarator() && path.key === "init") {
          let root = path.get("object");
          while (root.isMemberExpression()) root = root.get("object");
          const binding = root.isIdentifier() ? root.scope.getBinding(root.node.name)?.path : null;
          const init = binding?.isVariableDeclarator() ? binding.get("init") : null;
          const context = init?.isYieldExpression()
            ? init.get("argument")
            : init?.isCallExpression()
              ? init.get("callee")
              : null;
          if (context && brand(type(context), "CONTEXT")) return;
        }
        // D-065: direct fields in a component/control props literal forward sources.
        const prop = path.parentPath;
        if (prop.isObjectProperty() && prop.key !== "key") {
          const call = prop.parentPath.parentPath;
          if (call?.isCallExpression() && (control(call) || brand(type(call), "COMPONENT"))) return;
        }
        // A source an object literal holds (`const api = { count }`) is that
        // source: Solid's `api.count` is the accessor, read only where it is
        // called. A getter's member is read where it is (D-124), a store's key too.
        if (native && !path.node.computed) {
          const holder = path.get("object");
          const binding = holder.isIdentifier() ? holder.scope.getBinding(holder.node.name) : null;
          const literal =
            binding?.constant && binding.path.isVariableDeclarator()
              ? binding.path.get("init")
              : null;
          const name = key(path.node.property);
          if (
            literal?.isObjectExpression() &&
            literal.node.properties.some(
              field => t.isObjectProperty(field) && !field.computed && key(field.key) === name
            )
          )
            return;
        }
        delegate(path);
      }
    },
    ObjectProperty: {
      exit(path) {
        plainWriter(path.get("value"));
        if (key(path.node.key) === "component") handoff(path.get("value"));
        const call = path.parentPath.parentPath;
        if (!call?.isCallExpression() || !(control(call) || brand(type(call), "COMPONENT"))) return;
        const value = path.get("value");
        if (value.isFunction()) return;
        if (
          native &&
          key(path.node.key) === "value" &&
          t.isMemberExpression(call.node.callee) &&
          key(call.node.callee.property) === "provide" &&
          value.isYieldExpression()
        ) {
          const result = type(value.get("argument"));
          const operations =
            result?.symbol?.name === "Generator"
              ? checker.getTypeArguments(/** @type {ts.TypeReference} */ (result))[0]
              : undefined;
          const creates =
            operations &&
            (operations.isUnion() ? operations.types : [operations]).every(
              operation => operation.symbol?.name === "Create"
            );
          // D-122: a value that also cleans up, reads a context or may fail
          // (Effect's `createRuntime`) is computed as Solid computes a
          // provider's: once, in the provider's own owner. It becomes the
          // provider's `init`, whose failures are the provider's.
          if (
            operations &&
            !creates &&
            (operations.isUnion() ? operations.types : [operations]).every(operation =>
              ["Create", "Cleanup", "ContextRead", "Raise"].includes(operation.symbol?.name ?? "")
            )
          ) {
            path.node.key = t.identifier("init");
            value.replaceWith(
              t.functionExpression(
                null,
                [],
                t.blockStatement([t.returnStatement(value.node)]),
                true
              )
            );
            changed = true;
            return;
          }
          if (!creates) return;
          if (
            path.findParent(
              site =>
                site.isConditionalExpression() ||
                site.isLogicalExpression() ||
                site.isIfStatement() ||
                site.isLoop()
            )
          )
            fail(
              path,
              "NATIVE_PROVIDE_SETUP",
              "A conditional context factory needs a setup at its original position.",
              filename
            );
          let setup = path.getFunctionParent();
          while (setup && lib(setup.parentPath?.get("callee")) !== "component")
            setup = setup.getFunctionParent();
          if (setup?.get("body").isBlockStatement()) {
            const id = path.scope.generateUidIdentifier("provided");
            const statements = setup.get("body.body");
            const ret = statements.find(s => s.isReturnStatement());
            if (ret) {
              ret.insertBefore(
                t.variableDeclaration("const", [t.variableDeclarator(id, value.node)])
              );
              value.replaceWith(id);
              changed = true;
              return;
            }
          }
        }
        let reads = value.isYieldExpression();
        traverseOwned(value, {
          Function(q) {
            q.skip();
          },
          YieldExpression() {
            reads = true;
          }
        });
        const lazyJSX =
          ["children", "fallback"].includes(key(path.node.key)) &&
          (value.isJSXElement() || value.isJSXFragment());
        if (!reads && !lazyJSX) return;
        const body = t.blockStatement([
          t.returnStatement(/** @type {import("@babel/core").types.Expression} */ (value.node))
        ]);
        // D-126: a held context's value that reads is read where the call
        // is, in the view around it (a call's props are evaluated there; a
        // provider reads its value once), as a bare read is (D-122 above):
        // not a hole, which only a reactive (`Source<…>`) context takes.
        if (
          native &&
          reads &&
          key(path.node.key) === "value" &&
          t.isMemberExpression(call.node.callee) &&
          key(call.node.callee.property) === "provide" &&
          heldContext(call)
        )
          return;
        value.replaceWith(t.functionExpression(null, [], body, true));
        changed = true;
      }
    },
    JSXExpressionContainer(path) {
      const e = path.get("expression");
      if (path.parentPath.isJSXAttribute() && key(path.parentPath.node.name) === "component")
        handoff(e);
      const owner = path.getFunctionParent();
      if (
        native &&
        owner &&
        !owner.node.generator &&
        owner.parentPath.isObjectProperty() &&
        key(owner.parentPath.node.key) === "fallback" &&
        lib(ownerCall(owner)?.get("callee")) === "Errored" &&
        t.isIdentifier(owner.node.params[1]) &&
        e.isIdentifier({ name: owner.node.params[1].name })
      )
        return;
      if (
        path.parentPath.isJSXAttribute() &&
        /^on/.test(key(path.parentPath.node.name) ?? "") &&
        (brand(type(e), "EVENT") || sourceType(type(e)))
      )
        delegate(e);
      // Solid's bound form, `onClick={[handler, data]}`: the handler is bound
      // as an event attribute's is
      const first = e.isArrayExpression() ? e.get("elements.0") : null;
      if (
        path.parentPath.isJSXAttribute() &&
        /^on/.test(key(path.parentPath.node.name) ?? "") &&
        t.isArrayExpression(e.node) &&
        e.node.elements.length === 2 &&
        first?.isExpression() &&
        !first.isYieldExpression() &&
        brand(type(first), "EVENT")
      )
        delegate(first);
    }
  });
  return changed ? printer(t.file(p.node)) : code;
}
/**
 * D-119: a native component's plain-typed prop that a caller passes a pending or
 * failing value. Solid reads a prop lazily, inside the child, so that value's
 * colors are the child's: such a prop is widened to `Source<T, E, P>` with the
 * component's own type parameters (D-029), and each call carries what it passes.
 * Found where TypeScript refuses the call's prop; only a source or a hole
 * counts, so a genuine type mismatch stays an error. Under D-126 a settled one
 * counts too: a bare type is held and refuses any source or hole (`[HELD_PROP]`),
 * while Solid reads every prop lazily (Dev, 2026-10-15: widen it). An accessor
 * prop (F-S54: declared `() => T`, given a source) counts too.
 * @param {ts.Program} program @param {Set<string>} active
 * @returns {{wanted: Map<string, Map<string, Set<string>>>, concrete: Map<string, Map<string, Map<string, {pending: boolean, fails: Set<string>}>>>, accessors: Map<string, Map<string, Set<string>>>}} file → component → props
 */
function coloredPropSites(program, active) {
  const checker = program.getTypeChecker();
  /** @type {Map<string, Map<string, Set<string>>>} */
  const wanted = new Map();
  /** A component reached through `lazy` loses its type parameters there
   * (`LazyComponent<T>`): its props widen to the colors every caller passes.
   * @type {Map<string, Map<string, Map<string, {pending: boolean, fails: Set<string>}>>>} */
  const concrete = new Map();
  /** @type {Set<string>} */ const unprintable = new Set();
  /** Accessor props (F-S54): declared `() => T`, given a source, as Solid
   * passes a memo or signal getter. They take the value's type, `T`.
   * @type {Map<string, Map<string, Set<string>>>} */
  const accessors = new Map();
  /** Props declared outside a literal (an interface, an alias, a library's
   * attributes), by whether each is optional: widened beside the type.
   * @type {Map<string, Map<string, Map<string, boolean>>>} */
  const outside = new Map();
  const printer = ts.createPrinter();
  /** @param {ts.VariableDeclaration} declaration @returns {ts.VariableDeclaration | undefined} */
  const lazyTarget = declaration => {
    const init = declaration.initializer;
    if (!init || !ts.isCallExpression(init) || !ts.isIdentifier(init.expression)) return;
    let lazy = checker.getSymbolAtLocation(init.expression);
    if (lazy && lazy.flags & ts.SymbolFlags.Alias) lazy = checker.getAliasedSymbol(lazy);
    if (lazy?.name !== "lazy") return;
    const loader = init.arguments[0];
    const load = loader && ts.isArrowFunction(loader) ? loader.body : undefined;
    const specifier =
      load && ts.isCallExpression(load) && load.expression.kind === ts.SyntaxKind.ImportKeyword
        ? load.arguments[0]
        : undefined;
    const module = specifier && checker.getSymbolAtLocation(specifier);
    let target = module && checker.getExportsOfModule(module).find(e => e.name === "default");
    if (target && target.flags & ts.SymbolFlags.Alias) target = checker.getAliasedSymbol(target);
    return target?.declarations?.find(ts.isVariableDeclaration);
  };
  /** What a passed value may be: pending, and its failures as types printed
   * for the component's file, or `null` when one cannot be printed there.
   * @param {ts.Type} type @param {ts.Node} at @param {ts.Node} place */
  const colorsOf = (type, at, place) => {
    /** @type {ts.Type[]} */ const parts = [];
    if (member(type, "SOURCE", at)) parts.push(type);
    else
      for (const sig of type.getCallSignatures()) {
        const result = checker.getReturnTypeOfSignature(sig);
        if (result.symbol?.name !== "Generator") continue;
        const [yields] = checker.getTypeArguments(/** @type {ts.TypeReference} */ (result));
        if (yields) parts.push(...(yields.isUnion() ? yields.types : [yields]));
      }
    let pending = false;
    /** @type {Set<string>} */ const fails = new Set();
    for (const part of parts) {
      const p = member(part, "PENDING", at),
        f = member(part, "FAILS", at);
      if (p && checker.typeToString(p) !== "false") pending = true;
      if (!f || f.flags & ts.TypeFlags.Never) continue;
      for (const failure of f.isUnion() ? f.types : [f]) {
        const node = checker.typeToTypeNode(failure, place, ts.NodeBuilderFlags.NoTruncation);
        const text =
          node && printer.printNode(ts.EmitHint.Unspecified, node, place.getSourceFile());
        if (!text || /__@|\bany\b/.test(text)) return null;
        fails.add(text);
      }
    }
    return { pending, fails };
  };
  /** @param {ts.Type} type @param {string} name @param {ts.Node} at */
  const member = (type, name, at) => {
    const symbol = checker.getPropertiesOfType(type).find(p => p.name.startsWith(`__@${name}@`));
    return symbol && checker.getTypeOfSymbolAtLocation(symbol, at);
  };
  /** @param {ts.Type} type @param {ts.Node} at */
  const coloredOps = (type, at) =>
    (type.isUnion() ? type.types : [type]).some(part => {
      const pending = member(part, "PENDING", at),
        fails = member(part, "FAILS", at);
      return (
        (!!pending && checker.typeToString(pending) !== "false") ||
        (!!fails && !(fails.flags & ts.TypeFlags.Never))
      );
    });
  /** @param {ts.Type} type @param {ts.Node} at */
  const colored = (type, at) => {
    if (member(type, "SOURCE", at)) return coloredOps(type, at);
    return type.getCallSignatures().some(sig => {
      if (sig.getParameters().length) return false;
      const result = checker.getReturnTypeOfSignature(sig);
      if (result.symbol?.name !== "Generator") return false;
      const [yields] = checker.getTypeArguments(/** @type {ts.TypeReference} */ (result));
      return !!yields && coloredOps(yields, at);
    });
  };
  /** A hole: a routine with no parameters (`function* () { … }`).
   * @param {ts.Type} type */
  const hole = type =>
    type
      .getCallSignatures()
      .some(
        sig =>
          !sig.getParameters().length &&
          checker.getReturnTypeOfSignature(sig).symbol?.name === "Generator"
      );
  /** @param {ts.Node} node @param {number} start @returns {ts.Node} */
  const innermost = (node, start) =>
    ts.forEachChild(node, c =>
      c.getStart() <= start && start < c.end ? innermost(c, start) : undefined
    ) ?? node;
  for (const id of active) {
    const source = program.getSourceFile(id);
    if (!source) continue;
    /** @type {{ name: string, at: ts.Node, passedType: ts.Type, call: ts.CallExpression }[]} */
    const sites = [];
    for (const d of program.getSemanticDiagnostics(source)) {
      if (d.start === undefined) continue;
      let node = innermost(source, d.start);
      while (
        node &&
        !ts.isPropertyAssignment(node) &&
        !ts.isObjectLiteralExpression(node) &&
        !ts.isSourceFile(node)
      )
        node = node.parent;
      if (!node || (!ts.isPropertyAssignment(node) && !ts.isObjectLiteralExpression(node)))
        continue;
      const literal = ts.isPropertyAssignment(node) ? node.parent : node,
        call = literal.parent;
      if (!ts.isCallExpression(call) || call.arguments[0] !== literal) continue;
      if (ts.isPropertyAssignment(node)) {
        // TypeScript reports a prop's assignability at its name, not inside its value.
        if (!(node.name.getStart() <= d.start && d.start < node.name.end)) continue;
        sites.push({
          name: checker.getSymbolAtLocation(node.name)?.name ?? node.name.getText(),
          at: node.initializer,
          passedType: checker.getTypeAtLocation(node.initializer),
          call
        });
      } else if (node.getStart() === d.start) {
        // Spread assignability is reported on the argument; use its final
        // property types, including getters and later spread overrides.
        for (const prop of checker.getTypeAtLocation(node).getProperties()) {
          const passedType = checker.getTypeOfSymbolAtLocation(prop, node);
          sites.push({
            name: prop.name,
            at: node,
            passedType,
            call
          });
        }
      }
    }
    for (const { name, at, passedType, call } of sites) {
      const passedSource = !!member(passedType, "SOURCE", at);
      const isColored = colored(passedType, at);
      // D-126: a source or a hole for a held prop, settled or not (Dev,
      // 2026-10-15: native mode widens it, as Solid reads a prop lazily)
      const reactive = passedSource || hole(passedType);
      if (!reactive && !isColored) continue;
      let symbol = checker.getSymbolAtLocation(call.expression);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      let declaration = symbol?.declarations?.find(ts.isVariableDeclaration);
      // `lazy(() => import("./Page"))`: the page module's default component.
      const viaLazy = declaration ? lazyTarget(declaration) : undefined;
      if (viaLazy) declaration = viaLazy;
      const file = declaration?.getSourceFile().fileName;
      if (!declaration || !file || !active.has(file) || !ts.isIdentifier(declaration.name))
        continue;
      const init = declaration.initializer;
      const fn = init && ts.isCallExpression(init) ? init.arguments[0] : undefined;
      let annotation = fn && ts.isFunctionExpression(fn) ? fn.parameters[0]?.type : undefined;
      // A component already widened carries `& __NativeRequiring<_R>` (F-S49).
      if (annotation && ts.isIntersectionTypeNode(annotation)) annotation = annotation.types[0];
      if (
        !annotation ||
        !ts.isTypeReferenceNode(annotation) ||
        annotation.typeName.getText() !== "Props" ||
        !annotation.typeArguments?.[0]
      )
        continue;
      const [argument] = annotation.typeArguments;
      // `ParentProps<L>` (NativeParentProps): L's members and a plain `children`.
      let alias = ts.isTypeReferenceNode(argument)
        ? checker.getSymbolAtLocation(argument.typeName)
        : undefined;
      if (alias && alias.flags & ts.SymbolFlags.Alias) alias = checker.getAliasedSymbol(alias);
      const parent = alias?.name === "NativeParentProps";
      const inner =
        parent && ts.isTypeReferenceNode(argument) ? argument.typeArguments?.[0] : argument;
      // The literal a prop is declared in: the props type's own, or one of an
      // intersection's (`JSX.ButtonHTMLAttributes<…> & { label: string }`).
      const literals = !inner
        ? []
        : ts.isIntersectionTypeNode(inner)
          ? inner.types.filter(ts.isTypeLiteralNode)
          : [inner].filter(ts.isTypeLiteralNode);
      if (!inner && !parent) continue;
      // `children` widens where it is declared directly (a literal, ParentProps):
      // in an intersection it is a form the lowering made (a provider's
      // wrapper, ParentComponent), whose children it types itself.
      if (name === "children" && inner && !ts.isTypeLiteralNode(inner)) continue;
      const declared = literals
        .flatMap(literal => [...literal.members])
        .find(
          m =>
            ts.isPropertySignature(m) &&
            (checker.getSymbolAtLocation(m.name)?.name ?? m.name.getText()) === name &&
            m.type
        );
      // one the props type has from elsewhere: an interface's, an alias's
      const elsewhere =
        declared || (parent && name === "children")
          ? undefined
          : checker.getTypeFromTypeNode(argument).getProperty(name);
      const elsewhereType =
        elsewhere && checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(elsewhere, at));
      const declaredType =
        declared && ts.isPropertySignature(declared) && declared.type
          ? checker.getTypeFromTypeNode(declared.type)
          : elsewhereType;
      if (declaredType && checker.isTypeAssignableTo(passedType, declaredType)) continue;
      const getter = elsewhereType?.getCallSignatures();
      const accessor =
        passedSource &&
        (declared
          ? ts.isPropertySignature(declared) &&
            !!declared.type &&
            ts.isFunctionTypeNode(declared.type) &&
            !declared.type.parameters.length &&
            !declared.type.typeParameters
          : getter?.length === 1 &&
            !getter[0].getParameters().length &&
            !getter[0].getTypeParameters()?.length &&
            checker.getReturnTypeOfSignature(getter[0]).symbol?.name !== "Generator");
      if (!accessor && !isColored && !reactive) continue;
      if (accessor) {
        if (!accessors.has(file)) accessors.set(file, new Map());
        const byComponent = /** @type {Map<string, Set<string>>} */ (accessors.get(file));
        const component = /** @type {ts.Identifier} */ (declaration.name).text;
        if (!byComponent.has(component)) byComponent.set(component, new Set());
        byComponent.get(component)?.add(name);
      }
      if (declared && !accessor) {
        if (!ts.isPropertySignature(declared) || !declared.type) continue;
        // Only a plain declaration widens; a declared Source keeps its own
        // contract. F-S50's `Source<T, never, false>` for a generic bare prop is plain.
        const bare =
          ts.isTypeReferenceNode(declared.type) &&
          declared.type.typeName.getText() === "__NativeSource" &&
          declared.type.typeArguments?.[1]?.kind === ts.SyntaxKind.NeverKeyword &&
          declared.type.typeArguments?.[2]?.getText() === "false";
        if (!bare && member(checker.getTypeFromTypeNode(declared.type), "SOURCE", declared))
          continue;
      } else if (elsewhere && elsewhereType) {
        if (!accessor && member(elsewhereType, "SOURCE", at)) continue;
        if (!outside.has(file)) outside.set(file, new Map());
        const byComponent = /** @type {Map<string, Map<string, boolean>>} */ (outside.get(file));
        const component = declaration.name.text;
        if (!byComponent.has(component)) byComponent.set(component, new Map());
        byComponent.get(component)?.set(name, !!(elsewhere.flags & ts.SymbolFlags.Optional));
      } else if (!accessor && !(parent && name === "children")) continue;
      if (!wanted.has(file)) wanted.set(file, new Map());
      const components = /** @type {Map<string, Set<string>>} */ (wanted.get(file));
      const component = declaration.name.text;
      if (!components.has(component)) components.set(component, new Set());
      components.get(component)?.add(name);
      if (viaLazy) {
        if (!concrete.has(file)) concrete.set(file, new Map());
        const props =
          /** @type {Map<string, Map<string, {pending: boolean, fails: Set<string>}>>} */ (
            concrete.get(file)
          );
        if (!props.has(component)) props.set(component, new Map());
        const colors = props.get(component);
        const seen = colors?.get(name) ?? { pending: false, fails: new Set() };
        const passed = colorsOf(passedType, at, declaration);
        if (!passed) unprintable.add(`${file}#${component}`);
        else {
          seen.pending ||= passed.pending;
          for (const f of passed.fails) seen.fails.add(f);
        }
        colors?.set(name, seen);
      }
    }
  }
  for (const id of unprintable) {
    const [file, component] = [id.slice(0, id.lastIndexOf("#")), id.slice(id.lastIndexOf("#") + 1)];
    concrete.get(file)?.delete(component);
  }
  return { wanted, concrete, accessors, outside };
}
/** D-119: widen the recorded props, with the component's own type parameters,
 * or (a component reached through `lazy`) with the colors its callers pass.
 * @param {string} code @param {string} filename @param {Map<string, Set<string>>} components
 * @param {Map<string, Map<string, {pending: boolean, fails: Set<string>}>>} [concrete]
 * @param {Map<string, Set<string>>} [accessors]
 * @param {Map<string, Map<string, boolean>>} [outside] props the type has from
 * elsewhere (an interface's), by whether each is optional: the type becomes
 * `Omit<P, k> & { k: Source<P["k"], …> }`. */
function widenColoredProps(code, filename, components, concrete, accessors, outside) {
  const p = parseProgram(code, filename);
  if (!p) return code;
  let changed = false;
  traverseOwned(p, {
    VariableDeclarator(q) {
      const props = components.get(key(q.node.id));
      const init = q.node.init;
      const fn = props && t.isCallExpression(init) ? init.arguments[0] : null;
      if (!props || !t.isFunctionExpression(fn)) return;
      const param = fn.params[0];
      const typed =
        param && "typeAnnotation" in param && t.isTSTypeAnnotation(param.typeAnnotation)
          ? param.typeAnnotation
          : null;
      const requiring = t.isTSIntersectionType(typed?.typeAnnotation);
      const annotation = requiring
        ? /** @type {import("@babel/core").types.TSIntersectionType} */ (typed?.typeAnnotation)
            .types[0]
        : typed?.typeAnnotation;
      let literal =
        t.isTSTypeReference(annotation) && t.isIdentifier(annotation.typeName, { name: "Props" })
          ? annotation.typeParameters?.params[0]
          : null;
      // `ParentProps<L>` (Solid's, lowered to `NativeParentProps`) is L with an
      // optional `children`: spelled out, so `children` widens as any prop does.
      if (
        t.isTSTypeReference(literal) &&
        t.isIdentifier(literal.typeName) &&
        lib(
          q.scope.getBinding(literal.typeName.name)?.path.get("local") ?? null,
          "solid-yield/internal"
        ) === "NativeParentProps"
      ) {
        const [inner] = literal.typeParameters?.params ?? [];
        if (inner && !t.isTSTypeLiteral(inner)) return;
        const children = t.tsPropertySignature(
          t.identifier("children"),
          t.tsTypeAnnotation(
            t.tsImportType(t.stringLiteral("solid-yield"), t.identifier("Element"))
          )
        );
        children.optional = true;
        literal = t.tsTypeLiteral([...(inner?.members ?? []), children]);
        if (annotation && t.isTSTypeReference(annotation) && annotation.typeParameters)
          annotation.typeParameters.params[0] = literal;
      }
      const literals = t.isTSIntersectionType(literal)
        ? literal.types.filter(part => t.isTSTypeLiteral(part))
        : [literal].filter(part => t.isTSTypeLiteral(part));
      const elsewhere = outside?.get(key(q.node.id));
      if (!typed || !annotation || !literal || (!literals.length && !elsewhere?.size)) return;
      // A prop the type has from elsewhere is declared beside it, as its own
      // type (`P["k"]`, an accessor's result `ReturnType<…>`), and widened as
      // a literal's is.
      const whole = literal;
      /** @type {Set<any>} */ const made = new Set();
      for (const [name, optional] of elsewhere ?? []) {
        /** @type {import("@babel/core").types.TSType} */
        let type = t.tsIndexedAccessType(
          t.cloneNode(whole, true),
          t.tsLiteralType(t.stringLiteral(name))
        );
        if (optional)
          type = t.tsTypeReference(
            t.identifier("Exclude"),
            t.tsTypeParameterInstantiation([type, t.tsUndefinedKeyword()])
          );
        if (accessors?.get(key(q.node.id))?.has(name))
          type = t.tsTypeReference(
            t.identifier("ReturnType"),
            t.tsTypeParameterInstantiation([type])
          );
        const member = t.tsPropertySignature(
          t.isValidIdentifier(name) ? t.identifier(name) : t.stringLiteral(name),
          t.tsTypeAnnotation(type)
        );
        member.optional = optional;
        made.add(member);
      }
      const parameters = t.isTSTypeParameterDeclaration(fn.typeParameters)
        ? fn.typeParameters.params
        : [];
      let widened = false;
      for (const declared of [...literals.flatMap(part => part.members), ...made]) {
        if (!t.isTSPropertySignature(declared) || !declared.typeAnnotation) continue;
        const name = key(declared.key);
        if (!props.has(name)) continue;
        // F-S50's `Source<T, never, false>` widens its own colors.
        const own = declared.typeAnnotation.typeAnnotation;
        // F-S54: an accessor prop (`results: () => Package[]`) its callers
        // pass a source takes the value's type; a call of it is a read.
        /** @type {any} */ const getter = own;
        const getterResult = getter.typeAnnotation ?? getter.returnType;
        if (
          accessors?.get(key(q.node.id))?.has(name) &&
          (made.has(declared) ||
            (t.isTSFunctionType(own) &&
              !(getter.parameters ?? getter.params ?? []).length &&
              t.isTSTypeAnnotation(getterResult)))
        ) {
          if (!made.has(declared))
            declared.typeAnnotation.typeAnnotation = getterResult.typeAnnotation;
          const holder = t.isIdentifier(param) ? param.name : null;
          if (holder)
            q.get("init").traverse({
              CallExpression(c) {
                let callee = c.get("callee");
                while (callee.isParenthesizedExpression()) callee = callee.get("expression");
                const read = callee.isYieldExpression({ delegate: true })
                  ? callee.get("argument")
                  : null;
                if (
                  !c.node.arguments.length &&
                  read?.isMemberExpression() &&
                  read.get("object").isIdentifier({ name: holder }) &&
                  key(read.node.property) === name
                )
                  c.replaceWith(callee.node);
              }
            });
          changed = true;
        }
        if (
          t.isTSTypeReference(own) &&
          t.isIdentifier(own.typeName, { name: "__NativeSource" }) &&
          own.typeParameters?.params.length === 3
        )
          declared.typeAnnotation.typeAnnotation = own.typeParameters.params[0];
        const passed = concrete?.get(key(q.node.id))?.get(name);
        if (passed) {
          const failures = [...passed.fails].join(" | ") || "never";
          const holder = parseProgram(`let __t: ${failures};`, filename);
          /** @type {any} */ const statement = holder?.node.body[0];
          const failureType = statement?.declarations?.[0]?.id?.typeAnnotation?.typeAnnotation;
          if (!failureType) continue;
          declared.typeAnnotation.typeAnnotation = t.tsTypeReference(
            t.identifier("__NativeSource"),
            t.tsTypeParameterInstantiation([
              declared.typeAnnotation.typeAnnotation,
              failureType,
              t.tsLiteralType(t.booleanLiteral(passed.pending))
            ])
          );
          changed = true;
          continue;
        }
        const fails = q.scope.generateUid(`E_${name}`),
          pending = q.scope.generateUid(`P_${name}`);
        declared.typeAnnotation.typeAnnotation = t.tsTypeReference(
          t.identifier("__NativeSource"),
          t.tsTypeParameterInstantiation([
            declared.typeAnnotation.typeAnnotation,
            t.tsTypeReference(t.identifier(fails)),
            t.tsTypeReference(t.identifier(pending))
          ])
        );
        parameters.push(
          t.tsTypeParameter(null, null, fails),
          t.tsTypeParameter(t.tsBooleanKeyword(), null, pending)
        );
        changed = widened = true;
      }
      if (made.size && t.isTSTypeReference(annotation) && annotation.typeParameters) {
        annotation.typeParameters.params[0] = t.tsIntersectionType([
          t.tsTypeReference(
            t.identifier("Omit"),
            t.tsTypeParameterInstantiation([
              whole,
              t.tsUnionType([...made].map(m => t.tsLiteralType(t.stringLiteral(key(m.key)))))
            ])
          ),
          t.tsTypeLiteral([...made])
        ]);
        changed = true;
      }
      // F-S49: a generic setup takes the plain call, whose hole props would
      // require nothing; one requirement parameter, inferred per call from
      // its holes, lets a child that needs a context pass through.
      if (widened && !requiring) {
        const requires = q.scope.generateUid("R");
        parameters.push(t.tsTypeParameter(null, t.tsNeverKeyword(), requires));
        typed.typeAnnotation = t.tsIntersectionType([
          annotation,
          t.tsTypeReference(
            t.identifier("__NativeRequiring"),
            t.tsTypeParameterInstantiation([t.tsTypeReference(t.identifier(requires))])
          )
        ]);
      }
      // A defaulted parameter stays after the required ones.
      if (parameters.length)
        fn.typeParameters = t.tsTypeParameterDeclaration([
          ...parameters.filter(param => !param.default),
          ...parameters.filter(param => param.default)
        ]);
    }
  });
  if (!changed) return code;
  for (const [local, imported, from] of [
    ["__NativeSource", "Source", "solid-yield"],
    ["__NativeRequiring", "NativeRequiring", "solid-yield/internal"]
  ]) {
    if (p.scope.hasBinding(local)) continue;
    const source = t.importDeclaration(
      [t.importSpecifier(t.identifier(local), t.identifier(imported))],
      t.stringLiteral(from)
    );
    source.importKind = "type";
    p.node.body.unshift(source);
  }
  return printer(t.file(p.node));
}
/**
 * An authored value type on a memo or an effect's compute (`createMemo<T>(…)`).
 * The library's `$memo<Y, R>` and `$effect<YC, V, YE>` take their operations
 * first, and TypeScript cannot give only the value: the type moves onto the
 * settled body's returns, checked as Solid checks them and giving the value
 * (`(x satisfies T) as T`: a mismatch is still an error). An async iterable of
 * `T` is left to inference: its items are the value.
 * @param {string} code @param {string} filename @param {ts.Program} program
 */
function typedCreations(code, filename, program) {
  const p = parseProgram(code, filename);
  const source = program.getSourceFile(filename);
  if (!p || !source || source.text !== code) return code;
  const checker = program.getTypeChecker();
  /** @type {Map<string, ts.Node>} */ const nodes = new Map();
  /** @param {ts.Node} node */
  // The outermost node of a span: a type reference, not its name.
  const index = node => {
    const span = `${node.getStart(source)}:${node.end}`;
    if (!nodes.has(span)) nodes.set(span, node);
    ts.forEachChild(node, index);
  };
  index(source);
  let changed = false;
  traverseOwned(p, {
    CallExpression(q) {
      const api = lib(q.get("callee"));
      const params = q.node.typeParameters?.params;
      if (!params?.length || (api !== "$memo" && api !== "$effect")) return;
      const annotation = /** @type {any} */ (params[0]);
      const typeNode = nodes.get(`${annotation.start}:${annotation.end}`);
      const body = q.get("arguments.0");
      if (!typeNode || !ts.isTypeNode(typeNode) || !body.isFunction()) return;
      const declared = checker.getTypeFromTypeNode(typeNode);
      traverseOwned(body, {
        Function(inner) {
          if (inner !== body) inner.skip();
        },
        ReturnStatement(ret) {
          const argument = ret.node.argument;
          const node = argument && nodes.get(`${argument.start}:${argument.end}`);
          if (!argument || !node) return;
          // An async iterable yields `T`s (Stream's memo): its items are the value.
          const returned = checker.getTypeAtLocation(node);
          const iterable = (returned.isUnion() ? returned.types : [returned]).some(part =>
            checker.getPropertiesOfType(part).some(s => s.name.startsWith("__@asyncIterator@"))
          );
          if (iterable && !checker.isTypeAssignableTo(returned, declared)) return;
          ret.node.argument = t.tsAsExpression(
            t.tsSatisfiesExpression(argument, t.cloneNode(annotation, true)),
            t.cloneNode(annotation, true)
          );
        }
      });
      q.node.typeParameters = null;
      changed = true;
    }
  });
  return changed ? printer(t.file(p.node)) : code;
}
/**
 * D-126 in native mode: a prop a caller passes a source or a hole is reactive
 * (widened to `Source<T, E, P>`, D-119), and a caller that passes a plain
 * value gives Solid's plain value, which the library takes as `constant(v)`.
 * Found where TypeScript refuses it (`[REACTIVE_PROP]`).
 * @param {string} code @param {string} filename @param {ts.Program} program
 */
function constantProps(code, filename, program) {
  const source = program.getSourceFile(filename);
  if (!source || source.text !== code) return code;
  /** @param {ts.Node} node @param {number} start @returns {ts.Node} */
  const innermost = (node, start) =>
    ts.forEachChild(node, c =>
      c.getStart(source) <= start && start < c.end ? innermost(c, start) : undefined
    ) ?? node;
  /** @type {Set<number>} where each value to take as a constant starts */
  const values = new Set();
  for (const d of program.getSemanticDiagnostics(source)) {
    if (d.start === undefined) continue;
    if (!ts.flattenDiagnosticMessageText(d.messageText, "\n").includes("[REACTIVE_PROP]")) continue;
    /** @type {ts.Node | undefined} */ let node = innermost(source, d.start);
    while (node && !ts.isPropertyAssignment(node) && !ts.isShorthandPropertyAssignment(node))
      node = ts.isSourceFile(node) ? undefined : node.parent;
    if (!node || !ts.isObjectLiteralExpression(node.parent)) continue;
    if (!ts.isCallExpression(node.parent.parent)) continue;
    values.add((ts.isPropertyAssignment(node) ? node.initializer : node.name).getStart(source));
  }
  if (!values.size) return code;
  const p = parseProgram(code, filename);
  if (!p) return code;
  let changed = false;
  let constant = false;
  p.traverse({
    ObjectProperty(path) {
      const value = path.node.value;
      if (!t.isExpression(value) || !values.has(value.start ?? -1)) return;
      // already a constant, or a hole (refused for what it does, as a
      // write): what is left is the value's own error
      if (
        (t.isCallExpression(value) && t.isIdentifier(value.callee, { name: "__nativeConstant" })) ||
        (t.isFunctionExpression(value) && value.generator)
      )
        return;
      path.node.shorthand = false;
      const [phase, body] = t.isCallExpression(value) ? value.arguments : [];
      // A getter (`count={() => 2}` where another caller passes a signal):
      // Solid calls it where the prop is read, as a hole runs. One that reads
      // is lowered already, as a lexical callback of a hole: it is that hole.
      if (
        t.isCallExpression(value) &&
        t.isIdentifier(value.callee, { name: "__nativeLexicalCallback" }) &&
        value.arguments.length === 2 &&
        t.isStringLiteral(phase, { value: "hole" }) &&
        t.isFunctionExpression(body) &&
        body.generator &&
        !body.params.length
      )
        path.get("value").replaceWith(body);
      else if (
        (t.isArrowFunctionExpression(value) || t.isFunctionExpression(value)) &&
        !value.params.length &&
        !value.async &&
        !value.generator
      )
        path
          .get("value")
          .replaceWith(
            t.functionExpression(
              null,
              [],
              t.isBlockStatement(value.body)
                ? value.body
                : t.blockStatement([t.returnStatement(value.body)]),
              true
            )
          );
      else {
        path
          .get("value")
          .replaceWith(t.callExpression(t.identifier("__nativeConstant"), [t.cloneNode(value)]));
        constant = true;
      }
      path.skip();
      changed = true;
    }
  });
  if (!changed) return code;
  if (constant && !p.scope.hasBinding("__nativeConstant"))
    p.node.body.unshift(
      t.importDeclaration(
        [t.importSpecifier(t.identifier("__nativeConstant"), t.identifier("constant"))],
        t.stringLiteral("solid-yield")
      )
    );
  return printer(t.file(p.node));
}
/**
 * D-116's capture rule: a source given where plain code takes an accessor (a
 * parameter typed as a function: `useDebounced(count)`, `mapArray(items, …)`).
 * Solid hands over the getter itself; the lowered program hands over Solid's
 * accessor (`yield* nativeAccessor(count)`), and the routine takes the
 * source's colors, as if it read it there. Found where TypeScript refuses the
 * argument, in a routine.
 * @param {string} code @param {string} filename @param {ts.Program} program
 */
function accessorArguments(code, filename, program) {
  const p = parseProgram(code, filename);
  const source = program.getSourceFile(filename);
  if (!p || !source || source.text !== code) return code;
  const checker = program.getTypeChecker();
  /** @type {Map<string, ts.Node>} */ const nodes = new Map();
  /** @param {ts.Node} node */
  const index = node => {
    const span = `${node.getStart(source)}:${node.end}`;
    if (!nodes.has(span)) nodes.set(span, node);
    ts.forEachChild(node, index);
  };
  index(source);
  /** @param {ts.Type} type */
  const isSource = type =>
    checker.getPropertiesOfType(type).some(s => s.name.startsWith("__@SOURCE@"));
  let changed = false;
  /** @type {Set<string>} */ const used = new Set();
  traverseOwned(p, {
    // A DOM spread (`<div {...props}>`): Solid's spread reads each member, so
    // the routine takes each source member's colors and binds each `$event`
    // member, and the element gets the values read through and the events
    // bound (`nativeSpread`). Taken before the statement: a `yield*` in a
    // spread cannot become a hole.
    JSXSpreadAttribute(q) {
      const name = /** @type {any} */ (q.parent).name;
      if (!t.isJSXIdentifier(name) || !/^[a-z]/.test(name.name)) return;
      const host = q.getFunctionParent();
      if (!host?.node.generator) return;
      const arg = q.get("argument");
      // already taken through the bridge
      const taken = arg.isIdentifier() ? arg.scope.getBinding(arg.node.name)?.path : null;
      const init = taken?.isVariableDeclarator() ? taken.node.init : null;
      if (
        t.isYieldExpression(init) &&
        t.isCallExpression(init.argument) &&
        t.isIdentifier(init.argument.callee, { name: "__nativeSpread" })
      )
        return;
      const node = nodes.get(`${arg.node.start}:${arg.node.end}`);
      if (!node) return;
      const type = checker.getTypeAtLocation(node);
      // a member the spread reads (a source) or binds (an `$event`, or a
      // function under an `on…` key: Solid's spread adds it as a listener)
      const bridged = (/** @type {ts.Symbol} */ member) => {
        const value = checker.getTypeOfSymbolAtLocation(member, node).getNonNullableType();
        return (
          checker
            .getPropertiesOfType(value)
            .some(s => s.name.startsWith("__@SOURCE@") || s.name.startsWith("__@EVENT@")) ||
          (member.name.startsWith("on") && value.getCallSignatures().length > 0)
        );
      };
      if (!checker.getPropertiesOfType(type).some(bridged)) return;
      const statement = q.findParent(x => x.isStatement() && x.getFunctionParent() === host);
      if (!statement) return;
      const id = host.scope.generateUidIdentifier("spread");
      statement.insertBefore(
        t.variableDeclaration("const", [
          t.variableDeclarator(
            id,
            t.yieldExpression(
              t.callExpression(t.identifier("__nativeSpread"), [t.cloneNode(arg.node)]),
              true
            )
          )
        ])
      );
      arg.replaceWith(id);
      used.add("__nativeSpread");
      changed = true;
    },
    CallExpression(q) {
      // The routine: the call's own function, or the one running a thunk at
      // once (an attempt's `() => twice(n)`).
      const host = q.findParent(f => f.isFunction() && !!f.node.generator);
      if (!host) return;
      const own = q.getFunctionParent() === host;
      const thunk = own ? null : q.getFunctionParent();
      if (thunk && (thunk.getFunctionParent() !== host || !thunk.parentPath?.isCallExpression()))
        return;
      // in a component's setup the plain code reads the source later
      const setup =
        host.parentPath?.isCallExpression() && lib(host.parentPath.get("callee")) === "component";
      const call = nodes.get(`${q.node.start}:${q.node.end}`);
      if (!call || !ts.isCallExpression(call)) return;
      const signature = checker.getResolvedSignature(call);
      if (!signature) return;
      /** @type {[Path, ts.Type, Path | null][]} what each argument, or each member
       * of an object one, is given for; and the routine holding that object */
      const given = [];
      q.get("arguments").forEach((arg, i) => {
        const parameter = signature.parameters[i];
        if (!parameter || !arg.isExpression() || arg.isFunction()) return;
        const expected = checker.getTypeOfSymbolAtLocation(parameter, call);
        // an object literal's members: a helper may take its accessors in one
        // (`pick({ get: count })`), the literal written there or held by a
        // constant of the routine (an argument the lowering took first)
        let literal = arg.isObjectExpression() ? arg : null;
        if (!literal && arg.isIdentifier()) {
          const held = arg.scope.getBinding(arg.node.name);
          const init =
            held?.constant && held.path.isVariableDeclarator() ? held.path.get("init") : null;
          const owner = init?.getFunctionParent();
          // held by this routine or one around it (a component's body)
          if (
            init?.isObjectExpression() &&
            owner?.node.generator &&
            (owner === host || host.findParent(f => f === owner))
          )
            literal = init;
        }
        if (literal)
          for (const member of literal.get("properties")) {
            if (!member.isObjectProperty() || member.node.computed) continue;
            const name = key(member.node.key);
            const slot = name ? expected.getNonNullableType().getProperty(name) : undefined;
            const value = member.get("value");
            if (slot && value.isExpression() && !value.isFunction())
              given.push([
                value,
                checker.getTypeOfSymbolAtLocation(slot, call),
                literal === arg ? null : literal.getFunctionParent()
              ]);
          }
        else given.push([arg, expected, null]);
      });
      for (const [arg, expected, owner] of given) {
        const node = nodes.get(`${arg.node.start}:${arg.node.end}`);
        if (!node) continue;
        const type = checker.getTypeAtLocation(node);
        if (
          !isSource(type) ||
          isSource(expected) ||
          !expected.getNonNullableType().getCallSignatures().length ||
          checker.isTypeAssignableTo(type, expected)
        )
          continue;
        // `{ count }` becomes `{ count: … }`
        const holder = arg.parentPath;
        if (holder?.isObjectProperty()) holder.node.shorthand = false;
        // a component's body hands it on later, as Solid's plain code does
        const inSetup = owner
          ? owner.parentPath?.isCallExpression() &&
            lib(owner.parentPath.get("callee")) === "component"
          : setup;
        const bridge = inSetup ? "__nativeAccessorSetup" : "__nativeAccessor";
        const value = t.yieldExpression(
          t.callExpression(t.identifier(bridge), [t.cloneNode(arg.node)]),
          true
        );
        if (!thunk || owner) arg.replaceWith(value);
        else {
          // taken before the statement that runs the thunk, when it names
          // nothing the thunk binds
          let local = false;
          arg.traverse({
            Identifier(r) {
              const b = r.isReferencedIdentifier() && r.scope.getBinding(r.node.name);
              if (b && b.path.findParent(a => a === thunk)) local = true;
            }
          });
          const binding = t.isIdentifier(arg.node) && arg.scope.getBinding(arg.node.name);
          if (local || (binding && binding.path.findParent(a => a === thunk))) continue;
          const statement = q.findParent(x => x.isStatement() && x.getFunctionParent() === host);
          if (!statement) continue;
          const id = host.scope.generateUidIdentifier("accessor");
          statement.insertBefore(t.variableDeclaration("const", [t.variableDeclarator(id, value)]));
          arg.replaceWith(id);
        }
        used.add(bridge);
        changed = true;
      }
    }
  });
  if (!changed) return code;
  for (const bridge of used)
    if (!p.scope.hasBinding(bridge))
      p.node.body.unshift(
        t.importDeclaration(
          [t.importSpecifier(t.identifier(bridge), t.identifier(bridge.slice(2)))],
          t.stringLiteral("solid-yield/internal")
        )
      );
  return printer(t.file(p.node));
}
/**
 * F-S52: a context's value type as plain Solid declares it
 * (`[() => string, { matches: (match: string) => boolean }]`) holds, once
 * lowered, a source and a routine: Solid reads an accessor or a reactive
 * helper where it is called; the library reads a source and drives a routine
 * there. Each provided value is walked with the declared type (tuples by
 * position, objects by member, through aliases and interfaces). A declared
 * function type given a source or a routine it does not admit becomes that
 * value's type, so every consumer reads or delegates it, as D-119 widens a
 * prop. Run once the bodies are settled.
 * @param {string} code @param {string} filename @param {ts.Program} program
 */
function contextFacades(code, filename, program) {
  const source = program.getSourceFile(filename);
  if (!source || source.text !== code) return code;
  const checker = program.getTypeChecker();
  /** @param {ts.Type} type */
  const routineOrSource = type =>
    checker.getPropertiesOfType(type).some(s => s.name.startsWith("__@SOURCE@")) ||
    type
      .getCallSignatures()
      .some(sig => checker.getReturnTypeOfSignature(sig).symbol?.name === "Generator");
  /**
   * Whether the value as plain Solid typed it fits the slot: a source's value
   * (a store, a getter) or an accessor of it, a routine's helper by what it
   * returns.
   * @param {ts.Type} type @param {ts.Type} slot @param {ts.Node} at
   */
  const plainFits = (type, slot, at) => {
    const returns = slot.getCallSignatures().map(sig => checker.getReturnTypeOfSignature(sig));
    const brand = checker.getPropertiesOfType(type).find(s => s.name.startsWith("__@SOURCE@"));
    if (brand) {
      const value = checker.getTypeOfSymbolAtLocation(brand, at);
      const accessor = slot
        .getCallSignatures()
        .some(
          sig =>
            !sig.getParameters().length &&
            checker.isTypeAssignableTo(value, checker.getReturnTypeOfSignature(sig))
        );
      return accessor || checker.isTypeAssignableTo(value, slot);
    }
    return type.getCallSignatures().some(sig => {
      const generator = checker.getReturnTypeOfSignature(sig);
      const result = checker.getTypeArguments(/** @type {ts.TypeReference} */ (generator))[1];
      return !!result && returns.some(r => checker.isTypeAssignableTo(result, r));
    });
  };
  /** @type {{start: number, end: number, text: string}[]} */ const edits = [];
  const tsPrinter = ts.createPrinter();
  for (const [value, declared] of contextSlots(program, checker)) {
    // a slot is retyped in the file that declares it
    if (declared.getSourceFile() !== source) continue;
    // a getter (D-124) hands back a source over its body, and a store is
    // one: plain Solid types them as their values, the slot holds the source
    const getter = ts.isGetAccessorDeclaration(value);
    const property = getter ? checker.getSymbolAtLocation(value.name) : undefined;
    const actual = property
      ? checker.getTypeOfSymbolAtLocation(property, value)
      : ts.isIdentifier(value) && ts.isShorthandPropertyAssignment(value.parent)
        ? checker.getTypeOfSymbolAtLocation(
            /** @type {ts.Symbol} */ (checker.getShorthandAssignmentValueSymbol(value.parent)),
            value
          )
        : checker.getTypeAtLocation(value);
    if (!routineOrSource(actual)) continue;
    const slot = checker.getTypeFromTypeNode(declared);
    if (checker.isTypeAssignableTo(actual, slot)) continue;
    // only a value plain Solid accepts there: a wrong one keeps TypeScript's error
    if (!plainFits(actual, slot, value)) continue;
    const node = checker.typeToTypeNode(actual, value, ts.NodeBuilderFlags.NoTruncation);
    if (!node) continue;
    const text = tsPrinter.printNode(ts.EmitHint.Unspecified, node, source);
    // Not settled yet (a generator's own `any` next type aside): leave it.
    if (/__@|\bany\b|\bunknown\b/.test(text.replace(/,\s*any>/g, ">"))) continue;
    edits.push({ start: declared.getStart(source), end: declared.end, text: `(${text})` });
  }
  if (!edits.length) return code;
  // Several providers of one slot: the slot holds any of their values.
  /** @type {Map<number, {start: number, end: number, texts: Set<string>}>} */
  const slots = new Map();
  for (const edit of edits) {
    const slot = slots.get(edit.start) ?? { start: edit.start, end: edit.end, texts: new Set() };
    slot.texts.add(edit.text);
    slots.set(edit.start, slot);
  }
  // Replaced in the tree and printed mapped, so positions survive the retyping.
  const p = parseProgram(code, filename);
  if (!p) return code;
  let replaced = 0;
  p.traverse({
    TSType(path) {
      const slot = slots.get(path.node.start ?? -1);
      if (!slot || path.node.end !== slot.end) return;
      const holder = parseProgram(`let __t: ${[...slot.texts].join(" | ")};`, filename);
      /** @type {any} */ const statement = holder?.node.body[0];
      const annotation = statement?.declarations?.[0]?.id?.typeAnnotation?.typeAnnotation;
      if (!annotation) return;
      path.replaceWith(annotation);
      path.skip();
      replaced++;
    }
  });
  return replaced ? printer(t.file(p.node)) : code;
}
/** @type {WeakMap<ts.Program, Map<ts.Node, ts.TypeNode>>} */
const slotsOf = new WeakMap();
/**
 * F-S52: each provided value's leaves paired with the context's declared type
 * nodes (`Ctx.provide({ value })`): tuples by position, objects by member,
 * through aliases and interfaces declared in the context's file. Every file's
 * providers: a context declared in one file may be provided in another.
 * @param {ts.Program} program @param {ts.TypeChecker} checker
 * @returns {Map<ts.Node, ts.TypeNode>}
 */
function contextSlots(program, checker) {
  const cached = slotsOf.get(program);
  if (cached) return cached;
  /** @type {Map<ts.Node, ts.TypeNode>} */ const slots = new Map();
  slotsOf.set(program, slots);
  /** @param {ts.Node | undefined} node @returns {ts.Node | undefined} */
  const resolveType = node => {
    // aliases and interfaces of the file that declares the context's type
    const home = node?.getSourceFile();
    // however long the chain; a circular one (TypeScript's error) stops where it repeats
    const seen = new Set();
    while (node && !seen.has(node)) {
      seen.add(node);
      if (ts.isParenthesizedTypeNode(node)) {
        node = node.type;
        continue;
      }
      if (!ts.isTypeReferenceNode(node)) return node;
      let symbol = checker.getSymbolAtLocation(node.typeName);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      const declaration = symbol?.declarations?.[0];
      if (!declaration || declaration.getSourceFile() !== home) return node;
      if (ts.isTypeAliasDeclaration(declaration)) node = declaration.type;
      else if (ts.isInterfaceDeclaration(declaration)) return declaration;
      else return node;
    }
    return node;
  };
  /** @param {ts.Expression} value @param {ts.Node | undefined} declared */
  const walk = (value, declared) => {
    const resolved = resolveType(declared);
    if (!resolved) return;
    if (ts.isArrayLiteralExpression(value) && ts.isTupleTypeNode(resolved)) {
      value.elements.forEach((element, i) => {
        const slot = resolved.elements[i];
        walk(element, slot && ts.isNamedTupleMember(slot) ? slot.type : slot);
      });
      return;
    }
    if (ts.isObjectLiteralExpression(value)) {
      const members =
        ts.isTypeLiteralNode(resolved) || ts.isInterfaceDeclaration(resolved)
          ? resolved.members
          : null;
      if (!members) return;
      for (const property of value.properties) {
        if (
          !ts.isPropertyAssignment(property) &&
          !ts.isShorthandPropertyAssignment(property) &&
          !ts.isGetAccessorDeclaration(property)
        )
          continue;
        const name = property.name.getText();
        const member = members.find(m => ts.isPropertySignature(m) && m.name.getText() === name);
        if (!member || !ts.isPropertySignature(member) || !member.type) continue;
        if (ts.isGetAccessorDeclaration(property)) slots.set(property, member.type);
        else
          walk(
            ts.isPropertyAssignment(property) ? property.initializer : property.name,
            member.type
          );
      }
      return;
    }
    // the slot is where the context names it (`State` in `[State, …]`), not
    // the body of an alias it names, which retyping would make circular
    if (ts.isTypeNode(resolved))
      slots.set(value, declared && ts.isTypeNode(declared) ? declared : resolved);
  };
  /** @param {ts.Node} node */
  const visit = node => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "provide" &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      let symbol = checker.getSymbolAtLocation(node.expression.expression);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      const declaration = symbol?.valueDeclaration;
      const init =
        declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined;
      const declared = init && ts.isCallExpression(init) ? init.typeArguments?.[0] : undefined;
      const value = node.arguments[0].properties.find(
        p => ts.isPropertyAssignment(p) && p.name.getText() === "value"
      );
      if (declared && value && ts.isPropertyAssignment(value)) walk(value.initializer, declared);
    }
    ts.forEachChild(node, visit);
  };
  for (const file of program.getSourceFiles())
    if (!file.isDeclarationFile && !/[\\/]node_modules[\\/]/.test(file.fileName)) visit(file);
  return slots;
}
/** Refuse generator helpers handed to an unknown consumer. The library's
 * callback hosts are the only allowed consumers besides direct delegation.
 * @param {Map<string,string>} files @param {Set<string>} active @param {ts.CompilerOptions} options */
function checkEscapes(files, active, options) {
  const program = programFor(files, options),
    checker = program.getTypeChecker();
  for (const id of active) {
    const source = program.getSourceFile(id);
    if (!source) continue;
    /** A routine captured in a `const` that is only ever called: the lowering
     * captures a callee before evaluating its arguments, in source order.
     * @param {ts.Identifier} n */
    const capturedCallee = n => {
      const declaration = n.parent;
      if (
        !ts.isVariableDeclaration(declaration) ||
        declaration.initializer !== n ||
        !ts.isIdentifier(declaration.name) ||
        !(declaration.parent.flags & ts.NodeFlags.Const)
      )
        return false;
      const symbol = checker.getSymbolAtLocation(declaration.name);
      const scope = declaration.parent.parent.parent;
      let calledOnly = true;
      /** @param {ts.Node} m */
      const uses = m => {
        if (
          ts.isIdentifier(m) &&
          m !== declaration.name &&
          checker.getSymbolAtLocation(m) === symbol &&
          !(ts.isCallExpression(m.parent) && m.parent.expression === m)
        )
          calledOnly = false;
        ts.forEachChild(m, uses);
      };
      uses(scope);
      return calledOnly;
    };
    /** A routine given where a routine is expected (F-S52: a context value's
     * member typed as one): its consumers delegate it. @param {ts.Identifier} n */
    const slots = contextSlots(program, checker);
    /** @param {ts.Identifier} n */
    const routineSlot = n => {
      const declared = slots.get(n);
      return (
        !!declared &&
        checker
          .getTypeFromTypeNode(declared)
          .getCallSignatures()
          .some(sig => checker.getReturnTypeOfSignature(sig).symbol?.name === "Generator")
      );
    };
    /** @param {ts.Node} n */
    function walk(n) {
      if (ts.isTypeNode(n)) return;
      if (ts.isIdentifier(n)) {
        const parent = n.parent;
        const declarationName =
          (ts.isFunctionDeclaration(parent) ||
            ts.isFunctionExpression(parent) ||
            ts.isMethodDeclaration(parent) ||
            ts.isVariableDeclaration(parent) ||
            ts.isParameter(parent) ||
            ts.isBindingElement(parent)) &&
          parent.name === n;
        const propertyName =
          (ts.isPropertyAssignment(parent) || ts.isPropertyAccessExpression(parent)) &&
          parent.name === n;
        const importExport =
          ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent);
        const generator = checker
          .getTypeAtLocation(n)
          .getCallSignatures()
          .some(sig => {
            const declaration = /** @type {ts.FunctionLikeDeclaration | undefined} */ (
              sig.declaration
            );
            const body = declaration?.body;
            const opaque =
              body &&
              ts.isBlock(body) &&
              body.statements.some(
                statement =>
                  ts.isExpressionStatement(statement) &&
                  ts.isStringLiteral(statement.expression) &&
                  statement.expression.text === opaqueDirective
              );
            return !opaque && checker.getReturnTypeOfSignature(sig).symbol?.name === "Generator";
          });
        if (generator && !declarationName && !importExport && !propertyName) {
          const direct = ts.isCallExpression(parent) && parent.expression === n;
          // Reading a member of it (`placeOrder.interrupt()`) hands nothing
          // over; `call`, `apply` and `bind` would.
          const member =
            ts.isPropertyAccessExpression(parent) &&
            parent.expression === n &&
            !["call", "apply", "bind"].includes(parent.name.text);
          const callback =
            ts.isCallExpression(parent) &&
            ts.isIdentifier(parent.expression) &&
            constructors.has(parent.expression.text);
          if (!direct && !member && !callback && !capturedCallee(n) && !routineSlot(n)) {
            const at = n.getSourceFile().getLineAndCharacterOfPosition(n.getStart());
            const error = new Error(
              `[SUGAR_ESCAPE] Routine ${n.text} is handed to an unknown consumer; a plain callback cannot drive it.`
            );
            Object.assign(error, {
              id,
              code: "SUGAR_ESCAPE",
              loc: { file: id, line: at.line + 1, column: at.character }
            });
            throw error;
          }
        }
      }
      ts.forEachChild(n, walk);
    }
    walk(source);
  }
}
/** Lower a closed set of sugar modules together. Import aliases/re-exports are
 * resolved by TypeScript; the existing analyzer consumes this same explicit IR. */
/** @param {Map<string,string>} input @param {{compilerOptions?: ts.CompilerOptions, native?:boolean, rounds?: number}} [options] `rounds`: the fixpoint's bound (tests lower it) */
function lowerSugarProjectImpl(input, { compilerOptions = {}, native = false, rounds = 24 } = {}) {
  const options = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    strict: true,
    skipLibCheck: true,
    jsxImportSource: "solid-yield",
    ...compilerOptions
  };
  let files = new Map(
    [...input].map(([id, code]) => [resolve(id), isSugar(code) ? seed(code, id, native) : code])
  );
  const active = new Set([...input].filter(([, c]) => isSugar(c)).map(([id]) => resolve(id)));
  /** @type {ts.Program | undefined} */ let previous;
  for (let i = 0; i < rounds; i++) {
    const program = programFor(files, options, previous);
    previous = program;
    const next = new Map(files);
    let changed = false;
    for (const id of active) {
      const code = pass(files.get(id) ?? "", id, program, native);
      next.set(id, code);
      changed ||= code !== files.get(id);
    }
    files = next;
    if (!changed && native)
      for (const id of active) {
        const code = contextFacades(typedCreations(files.get(id) ?? "", id, program), id, program);
        changed ||= code !== files.get(id);
        files.set(id, code);
      }
    if (!changed && native) {
      const { wanted, concrete, accessors, outside } = coloredPropSites(program, active);
      for (const [id, components] of wanted) {
        const code = widenColoredProps(
          files.get(id) ?? "",
          id,
          components,
          concrete.get(id),
          accessors.get(id),
          outside.get(id)
        );
        changed ||= code !== files.get(id);
        files.set(id, code);
      }
    }
    if (!changed && native)
      for (const id of active) {
        const code = accessorArguments(files.get(id) ?? "", id, program);
        changed ||= code !== files.get(id);
        files.set(id, code);
      }
    if (!changed && native)
      for (const id of active) {
        const code = constantProps(files.get(id) ?? "", id, program);
        changed ||= code !== files.get(id);
        files.set(id, code);
      }
    if (!changed) {
      checkEscapes(files, active, options);
      return { files, iterations: i + 1 };
    }
  }
  throw new Error(
    "[SUGAR_FIXPOINT] Routine inference did not converge; recursive routines need an explicit signature (F-S3)."
  );
}
/** The Vite adapter loads the project's source files before lowering any module.
 * File contents key the cache; Vite also clears it on watched changes. */
/** @param {string} code @param {string} filename @param {Map<string, {signature: string, files: Map<string,string>}>} [cache] */
export function lowerSugarFile(code, filename, cache = new Map()) {
  const configPath = ts.findConfigFile(dirname(filename), ts.sys.fileExists);
  if (!configPath) throw new Error("[SUGAR_PROJECT] Sugar requires a tsconfig.json.");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
  const files = new Map(
    parsed.fileNames
      .filter(f => !f.includes("node_modules") && !f.includes("/.generated/"))
      .map(f => [f, readFileSync(f, "utf8")])
  );
  files.set(filename, code);
  const signature = JSON.stringify([parsed.options, [...files]]);
  let entry = cache.get(configPath);
  if (entry?.signature !== signature) {
    entry = {
      signature,
      files: lowerSugarProject(files, { compilerOptions: parsed.options }).files
    };
    cache.set(configPath, entry);
  }
  return entry.files.get(filename) ?? code;
}

/** Shared lowering, including generated-to-author position tables.
 * @param {Map<string,string>} input @param {{compilerOptions?: ts.CompilerOptions, native?:boolean}} [options] */
export function lowerSugarProject(input, options = {}) {
  return withPositions(input, () => lowerSugarProjectImpl(input, options));
}
