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
const printer = ast =>
  babel.transformFromAstSync(ast, undefined, {
    configFile: false,
    babelrc: false,
    comments: false,
    cloneInputAst: false
  })?.code ?? "";
const constructors = new Set([
  "$memo",
  "$event",
  "$effect",
  "$projection",
  "$optimisticStore",
  "$scope"
]);
const controls = new Set(["For", "Show", "Match", "Switch", "Repeat", "Loading", "Errored"]);
/** @param {any} n */
const key = n => n?.name ?? n?.value;
/** @param {Path | null | undefined} p */
const fnName = p =>
  p?.node.id?.name ?? (p?.parentPath?.isVariableDeclarator() ? key(p.parentPath.node.id) : null);
/** @param {Path | null | undefined} p */
const lib = p => {
  if (!p?.isIdentifier()) return null;
  const b = p.scope.getBinding(p.node.name);
  return b?.path.isImportSpecifier() &&
    b.path.parentPath.isImportDeclaration() &&
    b.path.parentPath.node.source.value === "solid-yield"
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
/** @param {Path} p @param {string} code @param {string} message @param {string} filename @returns {never} */
function fail(p, code, message, filename) {
  const at = p.node.loc?.start;
  const e = new Error(`[${code}] ${message} (${filename}:${at?.line}:${(at?.column ?? 0) + 1})`);
  Object.assign(e, { code, id: filename, loc: { file: filename, ...at } });
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
  p.traverse({
    Function(path) {
      if (path.node.generator && !native)
        fail(path, "SUGAR_EXPLICIT", "A sugar file cannot contain authored generators.", filename);
    }
  });
  let needsView = false,
    needsComponent = false;
  const wrapped = new WeakSet();
  p.traverse({
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
        path.traverse({
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
          path.traverse({
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
          path.traverse({
            Function(q) {
              q.skip();
            },
            ReturnStatement(q) {
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
            n.id ?? t.identifier(fnName(path)),
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
      if (p.scope.hasBinding(name))
        fail(p, "SUGAR_NAME", `Reserve ${name} for the generated library import.`, filename);
    }
    p.node.body.unshift(
      t.importDeclaration(
        [...(needsComponent ? ["component"] : []), ...(needsView ? ["view"] : [])].map(n =>
          t.importSpecifier(t.identifier(n), t.identifier(n))
        ),
        t.stringLiteral("solid-yield")
      )
    );
  }
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
  /** @param {ts.Type | undefined} v @param {string} b */
  const brand = (v, b) =>
    v && checker.getPropertiesOfType(v).some(s => s.name.startsWith(`__@${b}@`));
  /** @param {ts.Type | undefined} v */
  const sourceType = v => brand(v, "SOURCE") || brand(v, "CONTEXT");
  /** @param {ts.Type | undefined} v */
  const isOperation = v =>
    v &&
    (brand(v, "EVENT_CALL") ||
      brand(v, "COMPONENT") ||
      ["Generator", "Yieldable", "Receipt", "View"].includes(
        v.aliasSymbol?.name ?? v.symbol?.name
      ));
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
      if (native) {
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
        const eventHost =
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
          } else
            fn.replaceWith(
              t.callExpression(t.identifier("__nativeCallback"), [
                t.callExpression(t.identifier("__nativeEvent"), [
                  /** @type {import("@babel/core").types.FunctionExpression} */ (fn.node)
                ])
              ])
            );
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
      }
    }
    path.replaceWith(t.yieldExpression(operand, true));
    path.skip();
    changed = true;
  }
  p.traverse({
    CallExpression: {
      exit(path) {
        if (path.parentPath.isYieldExpression()) return;
        const callee = path.get("callee"),
          ct = type(callee);
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
            delegate(path, callee.node);
          }
        } else if (
          isOperation(type(path)) ||
          lib(callee) === "readStore" ||
          (native && ["latestOf", "isPendingOf"].includes(lib(callee)))
        )
          delegate(path);
      }
    },
    MemberExpression: {
      exit(path) {
        if (
          path.parentPath.isYieldExpression() ||
          (path.parentPath.isMemberExpression() && path.key === "object") ||
          (path.parentPath.isCallExpression() && path.key === "callee")
        )
          return;
        if (!sourceType(type(path))) return;
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
        const call = path.parentPath.parentPath;
        if (!call?.isCallExpression() || !(control(call) || brand(type(call), "COMPONENT"))) return;
        const value = path.get("value");
        if (value.isFunction()) return;
        let reads = value.isYieldExpression();
        value.traverse({
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
          .some(sig => checker.getReturnTypeOfSignature(sig).symbol?.name === "Generator");
        if (generator && !declarationName && !importExport && !propertyName) {
          const direct = ts.isCallExpression(parent) && parent.expression === n;
          const callback =
            ts.isCallExpression(parent) &&
            ts.isIdentifier(parent.expression) &&
            constructors.has(parent.expression.text);
          if (!direct && !callback)
            throw new Error(
              `[SUGAR_ESCAPE] Routine ${n.text} is handed to an unknown consumer; a plain callback cannot drive it (${id}:${n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1}).`
            );
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
export function lowerSugarProject(input, { compilerOptions = {}, native = false } = {}) {
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
