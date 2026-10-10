import { traverseOwned, opaqueDirective } from "./native-owned.js";
import { printMapped, withPositions, copyPosition } from "./positions.js";
/** Experimental project transform. Types are queried on generated virtual files,
 * never asserted onto authored calls. See documentation/sugar-design.md. */
// @ts-check
import ts from "typescript";
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
const fnName = p =>
  p?.node.id?.name ?? (p?.parentPath?.isVariableDeclarator() ? key(p.parentPath.node.id) : null);
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
/** Resolve the enclosing phase through any number of plain callbacks.
 * @param {Path} fn @returns {string | null} */
const lexicalPhase = fn => {
  for (let outer = fn.parentPath; outer; outer = outer.parentPath) {
    if (outer.isJSXExpressionContainer()) return "hole";
    if (!outer.isFunction()) continue;
    const call = outer.parentPath?.isCallExpression() ? outer.parentPath : null;
    const api = lib(call?.get("callee"));
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
/** F-S40, before types: a function passed as a component prop (not children or a
 * fallback) whose body writes (refresh, a setter of a signal/store/optimistic)
 * is called from the child's event, not during render, so its host is an event.
 * @param {Path} fn */
const writingCallbackProp = fn => {
  const call = ownerCall(fn);
  const callee = call?.get("callee");
  if (!callee?.isIdentifier() || !/^[A-Z]/.test(callee.node.name) || lib(callee)) return false;
  if (["children", "fallback"].includes(propKey(fn))) return false;
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
        let returnsJSX = t.isJSXElement(n.body) || t.isJSXFragment(n.body);
        traverseOwned(path, {
          Function(q) {
            q.skip();
          },
          ReturnStatement(q) {
            returnsJSX ||= t.isJSXElement(q.node.argument) || t.isJSXFragment(q.node.argument);
          }
        });
        const isComponent =
          /^[A-Z]/.test(fnName(path) ?? "") && !path.getFunctionParent() && returnsJSX;
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
        if (path.isArrowFunctionExpression()) {
          // Reject lexical captures whose meaning would change in a generator.
          traverseOwned(path, {
            ThisExpression(q) {
              fail(q, "SUGAR_LEXICAL", "A routine arrow cannot capture this.", filename);
            },
            ReferencedIdentifier(q) {
              if (q.node.name === "arguments")
                fail(q, "SUGAR_LEXICAL", "A routine arrow cannot capture arguments.", filename);
            }
          });
          path.arrowFunctionToExpression();
        }
        Object.assign(n, path.node);
        n.generator = true;
        path.node.generator = true;
        if (isComponent || row) {
          needsView = true;
          traverseOwned(path, {
            Function(q) {
              q.skip();
            },
            ReturnStatement(q) {
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
              if (!t.isJSXElement(q.node.argument) && !t.isJSXFragment(q.node.argument))
                fail(
                  q,
                  "SUGAR_RETURN",
                  "A component or row must return JSX on every return path.",
                  filename
                );
              q.node.argument = t.callExpression(t.identifier("view"), [
                t.functionExpression(
                  null,
                  [],
                  t.blockStatement([t.returnStatement(q.node.argument)]),
                  true
                )
              ]);
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
        fail(p, "SUGAR_NAME", `Reserve ${name} for the generated library import.`, filename);
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
        if (
          api === "attempt" ||
          constructors.has(api) ||
          call?.node.callee === fn.node ||
          call?.get("callee").isIdentifier({ name: "__nativeLexicalCallback" }) ||
          call?.get("callee").isIdentifier({ name: "__nativeTry" }) ||
          call?.get("callee").isIdentifier({ name: "__nativeMap" })
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
/** @param {Map<string,string>} files @param {ts.CompilerOptions} options */
function programFor(files, options) {
  const host = ts.createCompilerHost(options);
  const read = host.readFile.bind(host),
    exists = host.fileExists.bind(host);
  host.readFile = f => files.get(f) ?? read(f);
  host.fileExists = f => files.has(f) || exists(f);
  host.getSourceFile = (f, lang) => {
    const s = host.readFile(f);
    return s === undefined ? undefined : ts.createSourceFile(f, s, lang, true);
  };
  return ts.createProgram([...files.keys()], options, host);
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
      return !yields || !(yields.isUnion() ? yields.types : [yields]).every(data);
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
    // method types its result from the callback's. A callback given to another
    // function keeps its host but is not delegated (F-S47): its result type
    // can feed the call's, which an earlier pass may already have delegated.
    const parent = call.parentPath;
    if (!parent?.isCallExpression() || !parent.node.arguments.includes(call.node)) return;
    const method = parent.get("callee");
    if (!method.isMemberExpression() || !ARRAY_CALLBACKS.has(key(method.node.property) ?? ""))
      return;
    const receiver = type(/** @type {Path} */ (method.get("object")));
    if (!receiver || !(checker.isArrayType(receiver) || checker.isTupleType(receiver))) return;
    if (!call.getFunctionParent()?.node.generator) return;
    if (lexicalPhase(call) !== phaseArg.value) return;
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
    call.replaceWith(t.yieldExpression(operand, true));
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
    if (!call || control(call) || !brand(type(call), "COMPONENT")) return false;
    if (["children", "fallback"].includes(propKey(fn))) return false;
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
  /** @param {Path} path @param {any} [operand] */
  function delegate(path, operand = path.node) {
    const fn = path.getFunctionParent();
    if (!fn) return; // root renderer calls and foreign edges stay plain
    if (!fn.node.generator) {
      if (fn.node.async || fn.isObjectMethod() || fn.isClassMethod())
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
      let phase = lexicalPhase(fn);
      if (phase === "hole" && eventCallbackProp(fn)) phase = "event";
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
        const eventHost =
          promiseHost ||
          isScheduler(hostCall) ||
          (hostCall?.parentPath.isExpressionStatement() &&
            lib(hostCall.get("callee")) !== "attempt") ||
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
            fn.replaceWith(
              promiseHost ? event : t.callExpression(t.identifier("__nativeCallback"), [event])
            );
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
          if (!promiseHost && p && !p.scope.hasBinding("__nativeCallback")) {
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
      if (!fnName(fn) && !attemptHandler && !nativeHost)
        fail(
          path,
          "SUGAR_CALLBACK",
          "A reactive read in an unknown callback has no routine host; use a memo, event, or hole.",
          filename
        );
      if (!nativeHost) {
        if (fn.isArrowFunctionExpression()) fn.arrowFunctionToExpression();
        fn.node.generator = true;
        if (native) fn.node.returnType = null;
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
        const object = callee.get("object"),
          ct = type(object);
        if (!sourceType(ct)) return;
        const symbol = checker.getPropertiesOfType(ct).find(s => s.name.startsWith("__@SOURCE@"));
        const value = symbol && checker.getTypeOfSymbolAtLocation(symbol, source);
        if (!value || (!checker.isArrayType(value) && !checker.isTupleType(value))) return;
        if (
          !["filter", "map", "every", "some", "find", "findIndex", "slice"].includes(
            key(callee.node.property)
          )
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
        const store = object.node,
          state = path.scope.generateUidIdentifier("state");
        object.replaceWith(state);
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
  traverseOwned(p, {
    YieldExpression(path) {
      const value = path.get("argument");
      if (!path.node.delegate || !value.isCallExpression()) return;
      const bridged = value
        .get("arguments")
        .some(
          arg =>
            arg.isCallExpression() &&
            arg.get("callee").isIdentifier({ name: "__nativeLexicalCallback" })
        );
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
        if (
          !opaqueCall(body) &&
          (sourceType(type(body.get("callee"))) || isOperation(type(body)))
        ) {
          path.replaceWith(body.node);
          changed = true;
        }
      },
      exit(path) {
        for (const argument of path.get("arguments")) plainWriter(argument);
        delegateLexical(path);
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
        const delegated = path.parentPath.isYieldExpression();
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
          (isOperation(type(path)) ||
            lib(callee) === "readStore" ||
            (native && ["latestOf", "isPendingOf"].includes(lib(callee))))
        )
          delegate(path);
      }
    },
    MemberExpression: {
      exit(path) {
        // F-S39: a member the source itself lacks (a string's toLowerCase, a
        // number's toFixed) belongs to its value: read the source, then look
        // the member up. A path key (props.item.title) stays a path.
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
        value.replaceWith(
          t.functionExpression(
            null,
            [],
            t.blockStatement([
              t.returnStatement(/** @type {import("@babel/core").types.Expression} */ (value.node))
            ]),
            true
          )
        );
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
    }
  });
  return changed ? printer(t.file(p.node)) : code;
}
/**
 * D-119: a native component's plain-typed prop that a caller passes a pending or
 * failing value. Solid reads a prop lazily, inside the child, so that value's
 * colors are the child's: such a prop is widened to `Source<T, E, P>` with the
 * component's own type parameters (D-029), and each call carries what it passes.
 * Found where TypeScript refuses the call's prop; only a colored source or hole
 * counts, so a genuine type mismatch stays an error.
 * @param {ts.Program} program @param {Set<string>} active
 * @returns {Map<string, Map<string, Set<string>>>} file → component → props
 */
function coloredPropSites(program, active) {
  const checker = program.getTypeChecker();
  /** @type {Map<string, Map<string, Set<string>>>} */
  const wanted = new Map();
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
  /** @param {ts.Node} node @param {number} start @returns {ts.Node} */
  const innermost = (node, start) =>
    ts.forEachChild(node, c =>
      c.getStart() <= start && start < c.end ? innermost(c, start) : undefined
    ) ?? node;
  for (const id of active) {
    const source = program.getSourceFile(id);
    if (!source) continue;
    for (const d of program.getSemanticDiagnostics(source)) {
      if (d.start === undefined) continue;
      let node = innermost(source, d.start);
      while (node && !ts.isPropertyAssignment(node) && !ts.isSourceFile(node)) node = node.parent;
      if (!node || !ts.isPropertyAssignment(node)) continue;
      const prop = node;
      // TypeScript reports a prop's assignability at its name, not inside its value.
      if (!(prop.name.getStart() <= d.start && d.start < prop.name.end)) continue;
      const literal = prop.parent,
        call = literal.parent;
      if (!ts.isCallExpression(call) || call.arguments[0] !== literal) continue;
      if (!colored(checker.getTypeAtLocation(prop.initializer), prop.initializer)) continue;
      let symbol = checker.getSymbolAtLocation(call.expression);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      const declaration = symbol?.declarations?.find(ts.isVariableDeclaration);
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
        !annotation.typeArguments?.[0] ||
        !ts.isTypeLiteralNode(annotation.typeArguments[0])
      )
        continue;
      const name = prop.name.getText();
      const declared = annotation.typeArguments[0].members.find(
        m => ts.isPropertySignature(m) && m.name.getText() === name && m.type
      );
      if (!declared || !ts.isPropertySignature(declared) || !declared.type) continue;
      // Only a plain declaration widens; a declared Source keeps its own contract.
      if (member(checker.getTypeFromTypeNode(declared.type), "SOURCE", declared)) continue;
      if (!wanted.has(file)) wanted.set(file, new Map());
      const components = /** @type {Map<string, Set<string>>} */ (wanted.get(file));
      const component = declaration.name.text;
      if (!components.has(component)) components.set(component, new Set());
      components.get(component)?.add(name);
    }
  }
  return wanted;
}
/** D-119: widen the recorded props. @param {string} code @param {string} filename @param {Map<string, Set<string>>} components */
function widenColoredProps(code, filename, components) {
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
      const literal =
        t.isTSTypeReference(annotation) && t.isIdentifier(annotation.typeName, { name: "Props" })
          ? annotation.typeParameters?.params[0]
          : null;
      if (!typed || !annotation || !t.isTSTypeLiteral(literal)) return;
      const parameters = t.isTSTypeParameterDeclaration(fn.typeParameters)
        ? fn.typeParameters.params
        : [];
      let widened = false;
      for (const declared of literal.members) {
        if (!t.isTSPropertySignature(declared) || !declared.typeAnnotation) continue;
        const name = key(declared.key);
        if (!props.has(name)) continue;
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
/** Refuse generator helpers handed to an unknown consumer. The library's
 * callback hosts are the only allowed consumers besides direct delegation.
 * @param {Map<string,string>} files @param {Set<string>} active @param {ts.CompilerOptions} options */
function checkEscapes(files, active, options) {
  const program = programFor(files, options),
    checker = program.getTypeChecker();
  for (const id of active) {
    const source = program.getSourceFile(id);
    if (!source) continue;
    /** @param {ts.Node} n */
    function walk(n) {
      if (ts.isTypeNode(n)) return;
      if (ts.isIdentifier(n)) {
        const parent = n.parent;
        const declarationName =
          (ts.isFunctionDeclaration(parent) ||
            ts.isFunctionExpression(parent) ||
            ts.isVariableDeclaration(parent) ||
            ts.isParameter(parent)) &&
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
          const callback =
            ts.isCallExpression(parent) &&
            ts.isIdentifier(parent.expression) &&
            constructors.has(parent.expression.text);
          if (!direct && !callback) {
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
/** @param {Map<string,string>} input @param {{compilerOptions?: ts.CompilerOptions, native?:boolean}} [options] */
function lowerSugarProjectImpl(input, { compilerOptions = {}, native = false } = {}) {
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
  for (let i = 0; i < 24; i++) {
    const program = programFor(files, options);
    const next = new Map(files);
    let changed = false;
    for (const id of active) {
      const code = pass(files.get(id) ?? "", id, program, native);
      next.set(id, code);
      changed ||= code !== files.get(id);
    }
    files = next;
    if (!changed && native)
      for (const [id, components] of coloredPropSites(program, active)) {
        const code = widenColoredProps(files.get(id) ?? "", id, components);
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
