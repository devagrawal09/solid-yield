import {
  traverseOwned,
  authoredOpaqueGenerator,
  foreignStateReference,
  markOpaqueGenerators,
  unmarkOpaqueGenerators
} from "./native-owned.js";
import { printMapped, withPositions, copyPosition } from "./positions.js";
/** Native Solid front end. Refuse unsupported contracts before emitting any file.
 * The existing sugar engine and library checker remain the only color machinery. */
// @ts-check
import babel from "@babel/core";
import ts from "typescript";
import {
  lowerNativeTypes,
  nativeTypeDiagnostics,
  nativeTypeImport,
  solidType
} from "./native-types.js";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { parseProgram } from "./transform.js";
import { lowerSugarProject } from "./sugar.js";
import { inferFailures } from "compiler-yield/failure-inference";
import { nativeProviders } from "./native-providers.js";
import { nativeEntry } from "./native-entry.js";
import { componentFactory, nativePrelude, nativeRootTrees } from "./native-prelude.js";
import { lowerNativeEffects } from "./native-effects.js";
import { lowerNativeRecursion } from "./native-recursion.js";
const t = babel.types;
/** @typedef {import('@babel/core').NodePath<any>} Path */
/** @typedef {{code:string,message:string,file:string,line:number,column:number,severity?:"error"|"warning"}} Diagnostic */
/** @type {Readonly<Record<string,string|null>>} */
export const nativeMapping = Object.freeze({
  action: "$event",
  createStore: "$store",
  createOptimistic: "$optimistic",
  createOptimisticStore: "$optimisticStore",
  createProjection: "$projection",
  refresh: "refresh",
  latest: "latestOf",
  isPending: "isPendingOf",
  until: "until",
  lazy: "lazy",
  onSettled: null,
  createSignal: "$signal",
  createMemo: "$memo",
  createEffect: "$effect",
  createContext: "createContext",
  useContext: null,
  onCleanup: "$cleanup",
  Loading: "Loading",
  Errored: "Errored",
  For: "For",
  Show: "Show",
  Match: "Match",
  Switch: "Switch",
  Repeat: "Repeat"
});
export const nativePassthrough = new Set([
  "markSafeError",
  "HydrationScript",
  "Portal",
  "dynamic",
  "isServer",
  "getRequestEvent",
  "createUniqueId",
  "Reveal",
  "render",
  "hydrate",
  "renderToStream",
  "renderToString"
]);
export const nativeTypes = new Set([
  "Component",
  "Accessor",
  "ParentProps",
  "ParentComponent",
  "Store",
  "Setter",
  "Signal",
  "VoidComponent",
  "JSX",
  "RevealOrder"
]);
const controls = new Set(["Loading", "Errored", "For", "Show", "Match", "Switch", "Repeat"]);
const print = /** @param {any} p */ p => printMapped(t.file(p.node));
/** @param {Path} p */
function imported(p) {
  if (!p.isIdentifier() && !p.isJSXIdentifier()) return null;
  const b = p.scope.getBinding(p.node.name);
  if (!b?.path.isImportSpecifier() && !b?.path.isImportDefaultSpecifier()) return null;
  if (!b.path.parentPath.isImportDeclaration()) return null;
  return {
    module: b.path.parentPath.node.source.value,
    name: b.path.isImportDefaultSpecifier()
      ? "default"
      : t.isIdentifier(b.path.node.imported)
        ? b.path.node.imported.name
        : b.path.node.imported.value
  };
}
/** @param {Map<string,string>} files @param {ts.CompilerOptions} [options] */
function nativeProgram(files, options = {}) {
  const host = ts.createCompilerHost({});
  const read = host.readFile.bind(host);
  host.readFile = f => files.get(f) ?? read(f);
  const exists = host.fileExists.bind(host);
  host.fileExists = f => files.has(f) || exists(f);
  const directoryExists = host.directoryExists?.bind(host);
  host.directoryExists = dir =>
    [...files.keys()].some(f => f.startsWith(dir + "/")) || !!directoryExists?.(dir);
  const program = ts.createProgram(
    [...files.keys()],
    {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.Preserve,
      jsxImportSource: "@solidjs/web",
      strict: true,
      skipLibCheck: true,
      allowJs: true,
      ...options
    },
    host
  );
  return program;
}
/** @param {Map<string,string>} files @param {ts.CompilerOptions} [options] @param {boolean | "marked"} [opaqueGenerators] */
export function nativeFailures(files, options = {}, opaqueGenerators = true) {
  return inferFailures(files, {
    program: nativeProgram(files, options),
    ts,
    opaqueGenerators
  });
}
/** Inspect all selected files, accumulating refusals instead of stopping at the first one.
 * @param {Map<string,string>} files */
export function inspectNativeProject(files) {
  const program = [...files.values()].some(code => /function\s*\*/.test(code))
    ? nativeProgram(files)
    : null;
  const checker = program?.getTypeChecker();
  /** @type {Map<string,ts.Node>} */ const typed = new Map();
  for (const file of files.keys()) {
    const source = program?.getSourceFile(file);
    /** @param {ts.Node} node */ const visit = node => {
      typed.set(`${file}:${node.getStart(source)}:${node.end}`, node);
      ts.forEachChild(node, visit);
    };
    if (source) visit(source);
  }
  /** @param {string} file @param {Path} q */ const reactiveCallee = (file, q) => {
    const node = typed.get(`${file}:${q.node.start}:${q.node.end}`);
    if (!node || !checker) return false;
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return (
      symbol?.declarations?.some(declaration => {
        /** @type {ts.Node} */ let value = declaration;
        while (ts.isBindingElement(value) || ts.isArrayBindingPattern(value)) value = value.parent;
        if (
          !ts.isVariableDeclaration(value) ||
          !value.initializer ||
          !ts.isCallExpression(value.initializer)
        )
          return false;
        const callee = value.initializer.expression;
        let api = checker.getSymbolAtLocation(callee);
        if (api && api.flags & ts.SymbolFlags.Alias) api = checker.getAliasedSymbol(api);
        if (api?.name === "createMemo") return true;
        return (
          ["createSignal", "createOptimistic"].includes(api?.name ?? "") &&
          ts.isBindingElement(declaration) &&
          ts.isArrayBindingPattern(declaration.parent) &&
          declaration.parent.elements[0] === declaration
        );
      }) ?? false
    );
  };
  /** @type {Diagnostic[]} */
  const diagnostics = [];
  /** @type {WeakSet<object>} */ const nestedComponents = new WeakSet();
  for (const [file, code] of files) {
    const p = parseProgram(code, file);
    if (!p) continue;
    /** @param {Path} q @param {string} code @param {string} message */
    const report = (q, code, message) =>
      diagnostics.push({
        code,
        message,
        file,
        line: q.node.loc?.start.line ?? 1,
        column: (q.node.loc?.start.column ?? 0) + 1
      });
    p.traverse({
      ImportDeclaration(q) {
        const module = q.node.source.value;
        if (module === "solid-yield")
          report(
            q,
            "NATIVE_LIBRARY",
            "Native source must import Solid APIs; solid-yield imports belong in explicit mode."
          );
        if (module !== "solid-js" && module !== "@solidjs/web") return;
        for (const s of q.get("specifiers")) {
          if (nativeTypeImport(s)) {
            continue;
          }
          if (!s.isImportSpecifier()) {
            report(
              s,
              "NATIVE_IMPORT",
              "Namespace and default Solid imports need a checked native mapping."
            );
            continue;
          }
          const name = t.isIdentifier(s.node.imported)
            ? s.node.imported.name
            : s.node.imported.value;
          if (
            !nativePassthrough.has(name) &&
            !nativeTypes.has(name) &&
            (module === "solid-js"
              ? !(name in nativeMapping)
              : !["render", "hydrate", "renderToString", "renderToStream"].includes(name))
          )
            report(s, "NATIVE_API", `Solid API ${name} has no verified native lowering.`);
        }
      },
      Identifier(q) {
        if (
          !q.isReferencedIdentifier() ||
          !q.findParent(f => f.isFunction() && authoredOpaqueGenerator(f))
        )
          return;
        if (
          !q.parentPath.isMemberExpression() &&
          !q.parentPath.isOptionalMemberExpression() &&
          !q.parentPath.isSpreadElement()
        )
          return;
        const binding = q.scope.getBinding(q.node.name)?.path;
        const init = binding?.isVariableDeclarator() ? binding.get("init") : null;
        const source = init?.isCallExpression() ? imported(init.get("callee")) : null;
        const id = binding?.isVariableDeclarator() ? binding.node.id : null;
        if (
          source?.module === "solid-js" &&
          ["createStore", "createOptimisticStore"].includes(source.name) &&
          t.isArrayPattern(id) &&
          t.isIdentifier(id.elements[0], { name: q.node.name })
        )
          report(
            q.parentPath,
            "READ_IN_OPAQUE_GENERATOR",
            "this signal is read inside a generator the compiler does not own; read it outside and pass the value in, or make the read a memo"
          );
      },
      CallExpression(q) {
        const callee = q.get("callee");
        if (
          q.findParent(f => f.isFunction() && authoredOpaqueGenerator(f)) &&
          callee.isIdentifier()
        ) {
          const binding = callee.scope.getBinding(callee.node.name)?.path;
          const init = binding?.isVariableDeclarator() ? binding.get("init") : null;
          const source = init?.isCallExpression() ? imported(init.get("callee")) : null;
          const id = binding?.isVariableDeclarator() ? binding.node.id : null;
          const read =
            source?.module === "solid-js" &&
            ((["createSignal", "createOptimistic"].includes(source.name) &&
              t.isArrayPattern(id) &&
              t.isIdentifier(id.elements[0], { name: callee.node.name })) ||
              source.name === "createMemo");
          if (read || reactiveCallee(file, callee))
            report(
              q,
              "READ_IN_OPAQUE_GENERATOR",
              "this signal is read inside a generator the compiler does not own; read it outside and pass the value in, or make the read a memo"
            );
        }
        const api = imported(callee);
        if (api?.module !== "solid-js") return;
        if (
          /^create(Signal|Memo|Store|Optimistic|Projection)/.test(api.name) &&
          !q.getFunctionParent()
        )
          report(
            q.parentPath.isVariableDeclarator() ? q.parentPath : q,
            "MODULE_STATE",
            "reactive state created at module level has no owner; create it inside a component and provide it via context, or keep it foreign and handle failures at its uses"
          );
        if (api.name === "createEffect" && q.node.arguments.length < 2)
          report(
            q,
            "NATIVE_EFFECT_PHASES",
            "createEffect needs a tracked compute and an untracked effect phase."
          );
      },
      ThrowStatement(q) {
        if (
          t.isStringLiteral(q.node.argument) ||
          t.isNumericLiteral(q.node.argument) ||
          t.isBooleanLiteral(q.node.argument) ||
          t.isNullLiteral(q.node.argument)
        )
          report(
            q,
            "NATIVE_THROW",
            "Throw an Error object so callers can identify and handle this failure."
          );
      },
      JSXOpeningElement(q) {
        // A component declared inside another function: the lowering builds
        // components at module level only.
        const tag = q.get("name");
        if (!tag.isJSXIdentifier() || !/^[A-Z]/.test(tag.node.name)) return;
        const declaration = tag.scope.getBinding(tag.node.name)?.path;
        const fn = declaration?.isFunctionDeclaration()
          ? declaration
          : declaration?.isVariableDeclarator() && declaration.get("init").isFunction()
            ? declaration.get("init")
            : null;
        if (!declaration || !fn?.node || !fn.getFunctionParent() || nestedComponents.has(fn.node))
          return;
        nestedComponents.add(fn.node);
        report(
          declaration,
          "NATIVE_COMPONENT",
          `Declare ${tag.node.name} at module level; a component declared inside another function has no native lowering.`
        );
      },
      JSXSpreadAttribute(q) {
        report(
          q,
          "NATIVE_SPREAD",
          "A JSX spread may hide reads or event bindings; native spread lowering is not verified."
        );
      },
      JSXAttribute(q) {
        if (
          t.isJSXIdentifier(q.node.name) &&
          /^on[A-Z]/.test(q.node.name.name) &&
          t.isJSXExpressionContainer(q.node.value)
        ) {
          /** @type {Path} */
          let handler = q.get("value.expression");
          if (handler.isIdentifier()) {
            const binding = handler.scope.getBinding(handler.node.name)?.path;
            if (binding?.isVariableDeclarator()) handler = binding.get("init");
            else if (binding?.isFunctionDeclaration()) handler = binding;
          }
          if (handler?.isFunction())
            traverseOwned(handler, {
              ThisExpression(site) {
                report(
                  site,
                  "NATIVE_RECEIVER",
                  "An event handler using this needs a verified receiver-preserving binding."
                );
              }
            });
        }
      }
    });
  }
  return diagnostics;
}
export class NativeDiagnosticError extends Error {
  /** @param {Diagnostic[]} diagnostics */
  constructor(diagnostics) {
    super(
      diagnostics.map(d => `[${d.code}] ${d.message} (${d.file}:${d.line}:${d.column})`).join("\n")
    );
    this.name = "NativeDiagnosticError";
    this.diagnostics = diagnostics;
  }
}
/** Translate only known surface contracts, then use the existing routine inference.
 * @param {string} code @param {string} filename @param {Map<string,string>} modules @param {ts.CompilerOptions} [options] @param {Set<string>} [foreignComponents] @param {import("compiler-yield/failure-inference").FailureFunction[]} [summaries] */
function surface(
  code,
  filename,
  modules,
  options = {},
  foreignComponents = new Set(),
  summaries = []
) {
  const p = parseProgram(code, filename);
  if (!p) throw new Error(`Cannot parse ${filename}`);
  const needed = new Set();
  const contexts = new Set();
  /** @param {Path} ref */
  const contextReference = ref => {
    if (!ref.isIdentifier() && !ref.isJSXIdentifier()) return false;
    let declaration = ref.scope.getBinding(ref.node.name)?.path;
    const api = imported(ref);
    if (api?.module.startsWith(".")) {
      const base = resolve(dirname(filename), api.module);
      const target = [
        base,
        base + ".tsx",
        base + ".ts",
        base + "/index.tsx",
        base + "/index.ts"
      ].find(f => modules.has(f));
      const module = target ? parseProgram(modules.get(target) ?? "", target) : null;
      declaration = module?.scope.getBinding(api.name)?.path;
    }
    const init = declaration?.isVariableDeclarator() ? declaration.get("init") : null;
    return !!(init?.isCallExpression() && imported(init.get("callee"))?.name === "createContext");
  };
  // F-S43: a module-level foreign component (a router) that is rendered only
  // under providers hands its component-valued props those contexts.
  /** @param {Path} tag @returns {string[]} */
  const providedBy = tag => {
    if (!tag.isJSXIdentifier() && !tag.isIdentifier()) return [];
    const api = imported(tag);
    let file = filename,
      name = tag.node.name;
    /** @type {Path | undefined} */ let declaration = tag.scope.getBinding(name)?.path;
    if (api) {
      if (!api.module.startsWith(".") || api.name === "default") return [];
      const base = resolve(dirname(filename), api.module);
      const target = [
        base,
        base + ".tsx",
        base + ".ts",
        base + "/index.tsx",
        base + "/index.ts"
      ].find(m => modules.has(m));
      if (!target) return [];
      file = target;
      name = api.name;
      declaration = parseProgram(modules.get(target) ?? "", target)?.scope.getBinding(name)?.path;
    }
    const init = declaration?.isVariableDeclarator() ? declaration.get("init") : null;
    if (init?.isCallExpression() && imported(init.get("callee"))?.name === "createContext")
      return [`${file}#${name}`];
    return summaries.find(fn => fn.name === name && file.endsWith(fn.file))?.provides ?? [];
  };
  /** @type {Map<string, Set<string> | null>} */ const routerContexts = new Map();
  traverseOwned(p, {
    JSXOpeningElement(q) {
      const tag = q.get("name");
      if (!tag.isJSXIdentifier()) return;
      const declaration = tag.scope.getBinding(tag.node.name)?.path;
      const init = declaration?.isVariableDeclarator() ? declaration.get("init") : null;
      const source = init?.isCallExpression() ? imported(init.get("callee"))?.module : null;
      if (
        !declaration?.parentPath?.parentPath?.isProgram() ||
        !source ||
        source.startsWith(".") ||
        ["solid-js", "@solidjs/web"].includes(source)
      )
        return;
      const here = new Set();
      for (let up = q.parentPath?.parentPath; up; up = up.parentPath)
        if (up.isJSXElement())
          for (const id of providedBy(up.get("openingElement.name"))) here.add(id);
      const seen = routerContexts.get(tag.node.name);
      routerContexts.set(
        tag.node.name,
        seen === undefined ? here : new Set([...(seen ?? [])].filter(id => here.has(id)))
      );
    }
  });
  for (const [router, provided] of routerContexts) {
    if (!provided?.size) continue;
    const declaration = p.scope.getBinding(router)?.path;
    if (!declaration?.isVariableDeclarator()) continue;
    const witness = t.tsUnionType(
      [...provided].map(id =>
        t.tsImportType(
          t.stringLiteral("solid-yield"),
          t.identifier("RequiredContext"),
          t.tsTypeParameterInstantiation([t.tsAnyKeyword(), t.tsLiteralType(t.stringLiteral(id))])
        )
      )
    );
    let wrapped = false;
    declaration.get("init").traverse({
      ObjectProperty(q) {
        const value = q.get("value");
        const name = t.isIdentifier(q.node.key)
          ? q.node.key.name
          : t.isStringLiteral(q.node.key)
            ? q.node.key.value
            : null;
        if (name !== "component" || !(value.isIdentifier() || value.isMemberExpression())) return;
        value.replaceWith(
          t.callExpression(t.identifier("__nativeForeignProvided"), [
            value.node,
            t.tsAsExpression(t.tsAsExpression(t.nullLiteral(), t.tsUnknownKeyword()), witness)
          ])
        );
        wrapped = true;
      }
    });
    if (wrapped && !p.scope.hasBinding("__nativeForeignProvided")) {
      p.node.body.unshift(
        t.importDeclaration(
          [
            t.importSpecifier(
              t.identifier("__nativeForeignProvided"),
              t.identifier("nativeForeignProvided")
            )
          ],
          t.stringLiteral("solid-yield/internal")
        )
      );
      p.scope.crawl();
    }
  }
  let needsReturned = false;
  traverseOwned(p, {
    TSTypeReference(q) {
      if (!t.isIdentifier(q.node.typeName, { name: "ReturnType" })) return;
      q.node.typeName = t.identifier("__NativeReturned");
      needsReturned = true;
    }
  });
  if (needsReturned) {
    const helper = parseProgram(
      "type __NativeReturned<F extends (...args: never[]) => unknown> = ReturnType<F> extends Generator<unknown, infer R, unknown> ? R : ReturnType<F>;",
      filename
    );
    if (helper) p.node.body.unshift(...helper.node.body);
  }
  /** Native scalar values from context/rows are sources in library IR.
   * @param {Path} bindingPath @param {string} name */
  const valueReads = (bindingPath, name) => {
    const binding = bindingPath.scope.getBinding(name);
    for (const ref of binding?.referencePaths ?? []) {
      if (ref.findParent(q => q.isTSType())) continue;
      if (ref.parentPath?.isMemberExpression() && ref.key === "object") continue;
      ref.replaceWith(
        copyPosition(t.callExpression(copyPosition(t.identifier(name), ref.node), []), ref.node)
      );
    }
  };
  /** @param {Path} q @param {string} code @param {string} message @returns {never} */
  // Its position is in this intermediate program; `withPositions` maps it
  // back to the authored source by `id` and `loc`.
  const fail = (q, code, message) => {
    const line = q.node.loc?.start.line ?? 1,
      column = q.node.loc?.start.column ?? 0;
    throw Object.assign(
      new NativeDiagnosticError([{ code, message, file: filename, line, column: column + 1 }]),
      {
        id: filename,
        loc: { file: filename, line, column },
        length: Math.max(0, (q.node.end ?? 0) - (q.node.start ?? 0))
      }
    );
  };
  /** @type {WeakSet<object>} */ const foreignWrapped = new WeakSet();
  /** F-S51: a call to a component factory a selected module declares.
   * @param {Path} call @param {string} file */
  const factoryCall = (call, file) => {
    const callee = /** @type {Path} */ (call.get("callee"));
    if (!callee.isIdentifier()) return false;
    /** @type {Path | null | undefined} */ let binding = callee.scope.getBinding(
      callee.node.name
    )?.path;
    if (binding?.isImportSpecifier() && binding.parentPath.isImportDeclaration()) {
      const base = resolve(dirname(file), binding.parentPath.node.source.value);
      const target = [
        base,
        base + ".tsx",
        base + ".ts",
        base + "/index.tsx",
        base + "/index.ts"
      ].find(f => modules.has(f));
      const imported = binding.node.imported;
      const name = t.isIdentifier(imported) ? imported.name : imported.value;
      binding = target
        ? parseProgram(modules.get(target) ?? "", target)?.scope.getBinding(name)?.path
        : null;
    }
    return !!binding && componentFactory(binding);
  };
  /** Preserve the foreign tag and JSX capture positions. @param {Path} q @param {any} target */
  const wrapForeign = (q, target) => {
    // The element is revisited under its alias, which is already the handoff.
    if (foreignWrapped.has(q.node)) return;
    foreignWrapped.add(q.node);
    needed.add("foreign");
    for (const child of /** @type {Path[]} */ (q.get("children"))) {
      if (!child.isJSXExpressionContainer()) continue;
      const callback = child.get("expression");
      if (!callback.isFunction() || callback.node.generator) continue;
      // A foreign render callback returns a checked view, never an iterator.
      /** @param {any} body */
      const wrap = body =>
        t.callExpression(
          t.callExpression(t.identifier("foreign"), [
            t.callExpression(t.identifier("component"), [
              t.functionExpression(
                null,
                [],
                t.blockStatement([
                  t.returnStatement(
                    t.callExpression(t.identifier("view"), [
                      t.functionExpression(
                        null,
                        [],
                        t.blockStatement([t.returnStatement(body)]),
                        true
                      )
                    ])
                  )
                ]),
                true
              )
            ])
          ]),
          []
        );
      needed.add("component");
      needed.add("view");
      if (t.isExpression(callback.node.body)) callback.node.body = wrap(callback.node.body);
      else
        traverseOwned(callback, {
          /** @param {Path} inner */
          Function(inner) {
            inner.skip();
          },
          /** @param {Path} ret */
          ReturnStatement(ret) {
            if (ret.node.argument) ret.node.argument = wrap(ret.node.argument);
          }
        });
    }
    const alias = q.scope.generateUidIdentifier("NativeForeign");
    const statement = q.getStatementParent();
    if (!statement) fail(q, "NATIVE_HOST", "Cannot determine the host of this foreign JSX value.");
    statement.insertBefore(
      t.variableDeclaration("const", [
        t.variableDeclarator(alias, t.callExpression(t.identifier("foreign"), [target]))
      ])
    );
    q.node.openingElement.name = t.jsxIdentifier(alias.name);
    if (q.node.closingElement) q.node.closingElement.name = t.jsxIdentifier(alias.name);
  };
  // Annotate component props before source signatures are queried.
  traverseOwned(p, {
    Function(q) {
      const name =
        ("id" in q.node ? q.node.id?.name : "") ||
        (q.parentPath.isVariableDeclarator() && t.isIdentifier(q.parentPath.node.id)
          ? q.parentPath.node.id.name
          : "");
      // F-S51: a component a module-level factory returns is one too.
      const factory =
        q.parentPath.isReturnStatement() && !q.getFunctionParent()?.getFunctionParent();
      if ((q.getFunctionParent() && !factory) || !/^[A-Z]/.test(name ?? "")) return;
      let jsx = t.isJSXElement(q.node.body) || t.isJSXFragment(q.node.body);
      traverseOwned(q, {
        Function(inner) {
          inner.skip();
        },
        ReturnStatement(inner) {
          jsx ||= t.isJSXElement(inner.node.argument) || t.isJSXFragment(inner.node.argument);
        }
      });
      const provider = summaries.find(f => f.name === name && filename.endsWith(f.file))?.provides
        ?.length;
      if (!jsx && !provider) return;
      const param = q.node.params[0];
      if (q.parentPath.isVariableDeclarator() && t.isIdentifier(q.parentPath.node.id)) {
        const declared = q.parentPath.node.id.typeAnnotation;
        const type = declared?.type === "TSTypeAnnotation" ? declared.typeAnnotation : null;
        const contract =
          type && t.isTSTypeReference(type)
            ? solidType(q.parentPath.get("id.typeAnnotation.typeAnnotation"))
            : null;
        if (
          t.isTSTypeReference(type) &&
          contract &&
          ["Component", "ParentComponent", "VoidComponent"].includes(contract.name)
        ) {
          if (t.isIdentifier(param) && !param.typeAnnotation) {
            const name = contract.name;
            const base = type.typeParameters?.params[0] ?? t.tsTypeLiteral([]);
            if (name === "ParentComponent") needed.add("Element");
            const children = t.tsPropertySignature(
              t.identifier("children"),
              t.tsTypeAnnotation(
                name === "VoidComponent"
                  ? t.tsNeverKeyword()
                  : t.tsTypeReference(t.identifier("Element"))
              )
            );
            children.optional = true;
            param.typeAnnotation = t.tsTypeAnnotation(
              name === "Component"
                ? base
                : t.tsIntersectionType([base, t.tsTypeLiteral([children])])
            );
          }
          q.parentPath.node.id.typeAnnotation = null;
        }
      }
      if (param && !t.isIdentifier(param))
        fail(
          q,
          "NATIVE_PROPS",
          "Use a props parameter and read props.name where needed; destructuring loses reactive updates."
        );
      if (provider && t.isIdentifier(param) && param.typeAnnotation?.type === "TSTypeAnnotation") {
        needed.add("Element");
        param.typeAnnotation.typeAnnotation = t.tsIntersectionType([
          t.tsTypeReference(
            t.identifier("Omit"),
            t.tsTypeParameterInstantiation([
              param.typeAnnotation.typeAnnotation,
              t.tsLiteralType(t.stringLiteral("children"))
            ])
          ),
          t.tsTypeLiteral([
            t.tsPropertySignature(
              t.identifier("children"),
              t.tsTypeAnnotation(t.tsTypeReference(t.identifier("Element")))
            )
          ])
        ]);
      }
      if (param?.typeAnnotation?.type === "TSTypeAnnotation") {
        const propsType = foreignComponents.has(name) ? "__NativeProps" : "Props";
        needed.add(propsType);
        // An untyped rendered child has the JSX element contract, not an
        // arbitrary unknown value that could conceal a colored source.
        if (t.isTSTypeLiteral(param.typeAnnotation.typeAnnotation))
          for (const prop of param.typeAnnotation.typeAnnotation.members)
            if (
              t.isTSPropertySignature(prop) &&
              t.isIdentifier(prop.key, { name: "children" }) &&
              (t.isTSAnyKeyword(prop.typeAnnotation?.typeAnnotation) ||
                t.isTSUnknownKeyword(prop.typeAnnotation?.typeAnnotation))
            ) {
              needed.add("Element");
              prop.typeAnnotation = t.tsTypeAnnotation(t.tsTypeReference(t.identifier("Element")));
            }
        param.typeAnnotation.typeAnnotation = t.tsTypeReference(
          t.identifier(propsType),
          t.tsTypeParameterInstantiation([param.typeAnnotation.typeAnnotation])
        );
      }
      if (
        q.node.returnType &&
        solidType(q.get("returnType.typeAnnotation"))?.name !== "JSX.Element"
      )
        fail(
          q,
          "NATIVE_RETURN_TYPE",
          "A component return annotation needs a virtual value-to-routine type mapping."
        );
      // The reconstructed function returns a view generator. Infer its colors
      // from that body rather than constraining the generator to an Element.
      q.node.returnType = null;
    },
    CallExpression(q) {
      const api = imported(q.get("callee"));
      if (
        api?.module === "@solidjs/web" &&
        ["render", "hydrate", "renderToString", "renderToStream"].includes(api.name)
      ) {
        const callback = q.get("arguments.0");
        if (callback?.isArrowFunctionExpression() && t.isJSXElement(callback.node.body)) {
          const element = callback.node.body;
          const tag = element.openingElement.name;
          const attributes = element.openingElement.attributes;
          // F-S53: a root given props (`renderToStream(() => <Root url={url} />)`,
          // a lifted entry tree): the library's renderer takes that root code,
          // `() => Root({ url })`, and checks it (RootCheck).
          const local = t.isJSXIdentifier(tag) ? q.scope.getBinding(tag.name)?.path : null;
          if (
            t.isJSXIdentifier(tag) &&
            attributes.length &&
            !element.children.length &&
            local?.isFunctionDeclaration() &&
            attributes.every(
              a =>
                t.isJSXAttribute(a) &&
                t.isJSXIdentifier(a.name) &&
                (t.isStringLiteral(a.value) ||
                  (t.isJSXExpressionContainer(a.value) && t.isExpression(a.value.expression)))
            )
          ) {
            const props = t.objectExpression(
              attributes.map(a => {
                const attribute = /** @type {any} */ (a);
                const value = t.isStringLiteral(attribute.value)
                  ? attribute.value
                  : attribute.value.expression;
                return t.objectProperty(t.identifier(attribute.name.name), value);
              })
            );
            // Bound first, so the root is checked as a bare one is: RootCheck
            // (pending, requirements) and, as a foreign handoff, no failures.
            let name = "__nativeRoot";
            for (let i = 1; q.scope.hasBinding(name); i++) name = `__nativeRoot${i}`;
            const root = t.identifier(name);
            q.getStatementParent()?.insertBefore(
              t.variableDeclaration("const", [
                t.variableDeclarator(
                  root,
                  t.arrowFunctionExpression(
                    [],
                    copyPosition(t.callExpression(t.identifier(tag.name), [props]), element)
                  )
                )
              ])
            );
            needed.add("RootCheck");
            needed.add("foreign");
            needed.add(`__native${api.name}`);
            q.node.callee = t.identifier(`__native${api.name}`);
            q.node.arguments[0] = copyPosition(
              t.callExpression(t.identifier("foreign"), [
                copyPosition(
                  t.tsSatisfiesExpression(
                    t.identifier(name),
                    copyPosition(
                      t.tsTypeReference(
                        t.identifier("RootCheck"),
                        t.tsTypeParameterInstantiation([t.tsTypeQuery(t.identifier(name))])
                      ),
                      element
                    )
                  ),
                  element
                )
              ]),
              element
            );
            return;
          }
          if (
            t.isJSXIdentifier(element.openingElement.name) &&
            !element.openingElement.attributes.length &&
            !element.children.length
          )
            callback.replaceWith(
              copyPosition(
                t.identifier(element.openingElement.name.name),
                element.openingElement.name
              )
            );
        }
        const target = q.node.arguments[0];
        if (t.isIdentifier(target)) {
          needed.add("RootCheck");
          const binding = q.scope.getBinding(target.name)?.path;
          const local = binding?.isVariableDeclarator() ? binding.get("init") : binding;
          const check = copyPosition(
            t.tsSatisfiesExpression(
              target,
              copyPosition(
                t.tsTypeReference(
                  t.identifier("RootCheck"),
                  t.tsTypeParameterInstantiation([t.tsTypeQuery(t.identifier(target.name))])
                ),
                target
              )
            ),
            target
          );
          if (local?.isFunction()) {
            // Keep the library renderer, but native render/hydrate is a foreign
            // handoff: residual failures (including unknown) must be empty.
            needed.add("foreign");
            q.node.callee = t.identifier(`__native${api.name}`);
            needed.add(`__native${api.name}`);
            q.node.arguments[0] = copyPosition(
              t.callExpression(t.identifier("foreign"), [check]),
              target
            );
          } else {
            needed.add("foreign");
            q.node.arguments[0] = copyPosition(
              t.callExpression(t.identifier("foreign"), [check]),
              target
            );
          }
        }
        return;
      }
      if (
        t.isExpression(q.node.callee) &&
        contextReference(q.get("callee")) &&
        q.node.arguments.length === 1 &&
        t.isObjectExpression(q.node.arguments[0])
      ) {
        const value = q.node.arguments[0];
        for (const prop of value.properties)
          if (
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.key, { name: "children" }) &&
            !t.isFunction(prop.value) &&
            t.isExpression(prop.value)
          ) {
            prop.value = t.arrowFunctionExpression(
              [],
              t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [
                t.jsxExpressionContainer(prop.value)
              ])
            );
          }
        q.node.callee = t.memberExpression(q.node.callee, t.identifier("provide"));
        if (q.parentPath.isReturnStatement())
          q.replaceWith(
            t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [
              t.jsxExpressionContainer(q.node)
            ])
          );
        return;
      }
      if (api?.module !== "solid-js") return;
      if (foreignStateReference(q.get("callee"))) return;
      if (
        ["createOptimisticStore", "createProjection"].includes(api.name) &&
        q.node.typeParameters?.params.length === 1 &&
        q.node.arguments.length >= 2 &&
        t.isExpression(q.node.arguments[1])
      ) {
        // Preserve the declared value type on the seed while inferring the
        // generator's operations, including its pending and failure colors.
        q.node.arguments[1] = t.tsAsExpression(
          q.node.arguments[1],
          q.node.typeParameters.params[0]
        );
        q.node.typeParameters = null;
      }
      if (["createSignal", "createOptimistic"].includes(api.name) && !q.node.arguments.length) {
        // F-S53: Solid's `createSignal<T>()` holds `T | undefined` and starts
        // undefined; the library's signal always takes its first value.
        q.node.arguments = [t.identifier("undefined")];
        const [declared] = q.node.typeParameters?.params ?? [];
        if (declared && q.node.typeParameters)
          q.node.typeParameters.params[0] = t.tsUnionType([declared, t.tsUndefinedKeyword()]);
      }
      if (api.name === "createEffect" && q.get("arguments.1").isFunction()) {
        // F-S42: Solid 2 runs an effect function's returned cleanup before the
        // next run or on disposal, as the library's $cleanup does: register it.
        const effect = q.get("arguments.1");
        if (effect.isArrowFunctionExpression() && !t.isBlockStatement(effect.node.body))
          effect.node.body = t.blockStatement([t.returnStatement(effect.node.body)]);
        /** @type {Path[]} */ const returns = [];
        traverseOwned(effect, {
          Function(inner) {
            if (inner !== effect) inner.skip();
          },
          ReturnStatement(ret) {
            if (ret.node.argument) returns.push(ret);
          }
        });
        if (returns.length) {
          const program = /** @type {Path} */ (q.findParent(x => x.isProgram()));
          let local = null;
          for (const declaration of program.node.body)
            if (t.isImportDeclaration(declaration) && declaration.source.value === "solid-js")
              for (const spec of declaration.specifiers)
                if (
                  t.isImportSpecifier(spec) &&
                  (t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value) ===
                    "onCleanup"
                )
                  local = spec.local.name;
          if (!local) {
            local = program.scope.generateUid("onCleanup");
            const source = program.node.body.find(
              /** @param {any} d */ d =>
                t.isImportDeclaration(d) && d.source.value === "solid-js" && d.importKind !== "type"
            );
            const spec = t.importSpecifier(t.identifier(local), t.identifier("onCleanup"));
            if (source && t.isImportDeclaration(source)) source.specifiers.push(spec);
            else
              program.node.body.unshift(t.importDeclaration([spec], t.stringLiteral("solid-js")));
            program.scope.crawl();
          }
          for (const ret of returns) {
            const cleanup = ret.scope.generateUidIdentifier("cleanup");
            ret.replaceWithMultiple([
              t.variableDeclaration("const", [
                t.variableDeclarator(cleanup, /** @type {any} */ (ret.node.argument))
              ]),
              t.ifStatement(
                cleanup,
                t.expressionStatement(t.callExpression(t.identifier(local), [cleanup]))
              ),
              t.returnStatement()
            ]);
          }
        }
      }
      if (api.name === "onCleanup") {
        const owner = q.getFunctionParent();
        // A Promise producer owns ordinary Solid cleanup; it is not a routine.
        if (
          owner?.parentPath.isNewExpression() &&
          t.isIdentifier(owner.parentPath.node.callee, { name: "Promise" })
        ) {
          q.node.callee = t.identifier("__nativeOwnerCleanup");
          needed.add("__nativeOwnerCleanup");
        }
      }
      if (api.name === "useContext") {
        if (q.node.arguments.length !== 1 || !t.isExpression(q.node.arguments[0]))
          fail(q, "NATIVE_CONTEXT", "useContext requires one statically resolved context.");
        // A defaultless context created in the read itself has no identity a
        // provider could give: the read can never be provided.
        const created = q.get("arguments.0");
        const createdCall = t.isCallExpression(created.node) ? created.node : null;
        const createdApi = createdCall ? imported(created.get("callee")) : null;
        if (
          createdCall &&
          createdApi?.module === "solid-js" &&
          createdApi.name === "createContext" &&
          (createdCall.arguments.length === 0 ||
            t.isIdentifier(createdCall.arguments[0], { name: "undefined" }))
        )
          fail(
            created,
            "NO_PROVIDER",
            "This context is created in the read itself, so no provider can be above it: declare it once, provide it, and read that declaration."
          );
        const declarator = q.parentPath.isVariableDeclarator() ? q.parentPath : null;
        const name =
          declarator && t.isIdentifier(declarator.node.id) ? declarator.node.id.name : null;
        // F-S37: a value used whole (a guard, a return) is what Solid's useContext
        // returns, set once by its provider, so setup may hold it; only the
        // requirement is an op. A value read only through its members (the
        // prelude's destructuring) stays a path, read where its members are.
        const whole =
          name &&
          declarator?.scope
            .getBinding(name)
            ?.referencePaths.some(
              ref =>
                !ref.findParent(r => r.isTSType()) &&
                !(ref.parentPath?.isMemberExpression() && ref.key === "object")
            );
        if (whole) {
          needed.add("__nativeUseContext");
          q.replaceWith(
            copyPosition(
              t.callExpression(t.identifier("__nativeUseContext"), [q.node.arguments[0]]),
              q.node
            )
          );
        } else {
          if (name && declarator) valueReads(declarator, name);
          q.replaceWith(copyPosition(t.callExpression(q.node.arguments[0], []), q.node));
        }
      } else if (api.name === "createContext") {
        if (!q.parentPath.isVariableDeclarator() || !t.isIdentifier(q.parentPath.node.id))
          fail(
            q,
            "NATIVE_CONTEXT",
            "A native context needs a named declaration for its generated requirement identity."
          );
        contexts.add(q.parentPath.node.id.name);
        if (
          q.node.arguments.length === 0 ||
          (q.node.arguments.length === 1 &&
            t.isIdentifier(q.node.arguments[0], { name: "undefined" }))
        ) {
          // Full module identity, not just a potentially colliding display name.
          const name = `${filename}#${q.parentPath.node.id.name}`;
          q.node.arguments = [
            t.identifier("undefined"),
            t.objectExpression([t.objectProperty(t.identifier("name"), t.stringLiteral(name))])
          ];
          const params = q.node.typeParameters?.params;
          if (!params?.length)
            fail(q, "NATIVE_CONTEXT_TYPE", "A defaultless native context needs its value type.");
          params.push(t.tsLiteralType(t.stringLiteral(name)));
        }
      }
    }
  });
  // A DOM or window handler property (`window.onpopstate = () => …`) is an
  // event, as a JSX handler is: the browser calls it.
  traverseOwned(p, {
    AssignmentExpression(q) {
      const left = q.get("left"),
        right = q.get("right");
      if (
        q.node.operator !== "=" ||
        !left.isMemberExpression() ||
        left.node.computed ||
        !t.isIdentifier(left.node.property) ||
        !/^on[a-z]/.test(left.node.property.name) ||
        !(right.isArrowFunctionExpression() || right.isFunctionExpression())
      )
        return;
      for (const param of right.node.params)
        if (t.isIdentifier(param) && !param.typeAnnotation)
          param.typeAnnotation = t.tsTypeAnnotation(t.tsTypeReference(t.identifier("Event")));
      needed.add("$event");
      right.replaceWith(
        copyPosition(t.callExpression(t.identifier("$event"), [right.node]), right.node)
      );
      right.skip();
    }
  });
  traverseOwned(p, {
    JSXElement: {
      exit(q) {
        const opening = q.get("openingElement"),
          tag = opening.get("name");
        // A member tag can have a getter. Preserve its lookup at the JSX
        // position; hoisting an alias would run it before a conditional arm.
        // The existing JSX tag contract is the foreign check at this edge.
        if (tag.isJSXMemberExpression()) {
          if (
            !t.isJSXIdentifier(tag.node.property, { name: "Provider" }) ||
            !t.isJSXIdentifier(tag.node.object)
          )
            return;
          const name = tag.node.object.name;
          const api = imported(tag.get("object"));
          if (!contextReference(tag.get("object"))) return;
          tag.replaceWith(copyPosition(t.jsxIdentifier(name), tag.node.object));
          if (q.node.closingElement) q.node.closingElement.name = t.jsxIdentifier(name);
        }
        if (!tag.isJSXIdentifier()) return;
        const name = tag.node.name;
        const nativeTag = imported(tag);
        if (nativeTag?.module === "@solidjs/web" && nativeTag.name === "HydrationScript") return;
        if (/^[a-z]/.test(name)) {
          for (const attr of opening.get("attributes")) {
            if (
              !attr.isJSXAttribute() ||
              !t.isJSXIdentifier(attr.node.name) ||
              (!/^on[A-Z]/.test(attr.node.name.name) && attr.node.name.name !== "ref")
            )
              continue;
            const value = attr.get("value");
            if (!value.isJSXExpressionContainer()) continue;
            const fn = value.get("expression");
            const isRef = attr.node.name.name === "ref";
            if (isRef && fn.isIdentifier()) {
              const binding = fn.scope.getBinding(fn.node.name);
              if (!binding?.constant) {
                const element = t.identifier("element");
                element.typeAnnotation = t.tsTypeAnnotation(
                  t.tsIndexedAccessType(
                    t.tsTypeReference(t.identifier("HTMLElementTagNameMap")),
                    t.tsLiteralType(t.stringLiteral(name))
                  )
                );
                fn.replaceWith(
                  t.arrowFunctionExpression(
                    [element],
                    t.assignmentExpression("=", fn.node, t.identifier("element"))
                  )
                );
              }
            }
            if (fn.isCallExpression() && t.isIdentifier(fn.node.callee, { name: "$event" }))
              continue;
            if (fn.isIdentifier()) {
              const binding = fn.scope.getBinding(fn.node.name);
              const fallback = fn.findParent(
                q =>
                  q.isFunction() &&
                  ((q.parentPath.isJSXExpressionContainer() &&
                    q.parentPath.parentPath.isJSXAttribute() &&
                    t.isJSXIdentifier(q.parentPath.parentPath.node.name, { name: "fallback" })) ||
                    (q.parentPath.isObjectProperty() &&
                      t.isIdentifier(q.parentPath.node.key, { name: "fallback" })))
              );
              if (
                fallback?.isFunction() &&
                t.isIdentifier(fallback.node.params[1], { name: fn.node.name }) &&
                binding?.kind === "param"
              )
                continue;
              const declaration = binding?.path;
              const target = declaration?.isVariableDeclarator()
                ? declaration.get("init")
                : declaration;
              if (!binding?.constant)
                fail(fn, "NATIVE_HANDLER", "A reassigned event handler needs stable binding.");
              needed.add("__NativeArguments");
              const args = t.identifier("args");
              args.typeAnnotation = t.tsTypeAnnotation(
                t.tsTypeReference(
                  t.identifier("__NativeArguments"),
                  t.tsTypeParameterInstantiation([t.tsTypeQuery(t.identifier(fn.node.name))])
                )
              );
              const rest = t.restElement(t.identifier("args"));
              rest.typeAnnotation = args.typeAnnotation;
              fn.replaceWith(
                t.arrowFunctionExpression(
                  [rest],
                  t.callExpression(t.identifier(fn.node.name), [
                    t.spreadElement(t.identifier("args"))
                  ])
                )
              );
            }
            if (!fn.isArrowFunctionExpression() && !fn.isFunctionExpression())
              fail(
                fn,
                "NATIVE_HANDLER",
                "A property event handler needs a checked shared event-call contract."
              );
            for (const param of fn.node.params)
              if (t.isIdentifier(param) && !param.typeAnnotation) {
                if (isRef) {
                  param.typeAnnotation = t.tsTypeAnnotation(
                    t.tsIndexedAccessType(
                      t.tsTypeReference(t.identifier("HTMLElementTagNameMap")),
                      t.tsLiteralType(t.stringLiteral(name))
                    )
                  );
                  continue;
                }
                const event = /Key/.test(attr.node.name.name)
                  ? "KeyboardEvent"
                  : /Input/.test(attr.node.name.name)
                    ? "InputEvent"
                    : /Mouse|Click/.test(attr.node.name.name)
                      ? "MouseEvent"
                      : "Event";
                param.typeAnnotation = t.tsTypeAnnotation(
                  t.tsIntersectionType([
                    t.tsTypeReference(t.identifier(event)),
                    t.tsTypeLiteral([
                      t.tsPropertySignature(
                        t.identifier("currentTarget"),
                        t.tsTypeAnnotation(
                          t.tsIndexedAccessType(
                            t.tsTypeReference(t.identifier("HTMLElementTagNameMap")),
                            t.tsLiteralType(t.stringLiteral(name))
                          )
                        )
                      )
                    ])
                  ])
                );
              }
            needed.add("$event");
            const event = t.callExpression(t.identifier("$event"), [fn.node]);
            if (isRef) {
              needed.add("__nativeCallback");
              fn.replaceWith(t.callExpression(t.identifier("__nativeCallback"), [event]));
            } else fn.replaceWith(event);
          }
          return;
        }
        const api = imported(tag);
        let importedContext = false;
        if (
          api &&
          !(api.module === "solid-js" && (controls.has(api.name) || api.name === "createContext"))
        ) {
          const base = resolve(dirname(filename), api.module);
          const resolved = ts.resolveModuleName(
            api.module,
            filename,
            { moduleResolution: ts.ModuleResolutionKind.Bundler, ...options },
            ts.sys
          ).resolvedModule?.resolvedFileName;
          const target =
            (resolved && modules.has(resolved) ? resolved : undefined) ??
            (api.module.startsWith(".") &&
              [base, base + ".tsx", base + ".ts", base + "/index.tsx", base + "/index.ts"].find(f =>
                modules.has(f)
              ));
          const program = target ? parseProgram(modules.get(target) ?? "", target) : null;
          let declaration = program?.scope.getBinding(api.name)?.path;
          if (program && api.name === "default") {
            const exported = program.get("body").find(s => s.isExportDefaultDeclaration());
            if (exported?.isExportDefaultDeclaration()) {
              const value = exported.get("declaration");
              declaration = value.isIdentifier()
                ? program.scope.getBinding(value.node.name)?.path
                : value;
            }
          }
          const init = declaration?.isVariableDeclarator() ? declaration.get("init") : declaration;
          importedContext = !!(
            init?.isCallExpression() && imported(init.get("callee"))?.name === "createContext"
          );
          let jsx = false;
          if (init?.isFunction())
            traverseOwned(init, {
              Function(q) {
                q.skip();
              },
              JSXElement() {
                jsx = true;
              },
              JSXFragment() {
                jsx = true;
              }
            });
          const declarationName = init?.isFunction() && "id" in init.node ? init.node.id?.name : "";
          const provider = summaries.some(
            f =>
              f.provides?.length &&
              typeof target === "string" &&
              target.endsWith(f.file) &&
              (f.name === api.name || f.name === declarationName)
          );
          // F-S51: a component a selected factory returns (`App = RouteHOC(…)`).
          const factoryResult = !!target && !!init?.isCallExpression() && factoryCall(init, target);
          if (!importedContext && !jsx && !provider && !factoryResult) {
            wrapForeign(q, t.identifier(name));
            return;
          }
        }
        if (!api && !contexts.has(name)) {
          const binding = tag.scope.getBinding(name)?.path;
          const init = binding?.isVariableDeclarator() ? binding.get("init") : binding;
          // F-S51: a factory's component parameter is a yield component.
          const annotation = /** @type {any} */ (binding?.node)?.typeAnnotation?.typeAnnotation;
          const factoryParam =
            t.isTSTypeReference(annotation) &&
            t.isIdentifier(annotation.typeName, { name: "__NativeComponent" });
          // `lazy(() => import("./Page"))` of a native module is the library's
          // lazy component: pending while its chunk loads, failing ChunkError.
          const lazyCall = init?.isCallExpression() ? imported(init.get("callee")) : null;
          const loader =
            lazyCall?.module === "solid-js" && lazyCall.name === "lazy"
              ? /** @type {Path | undefined} */ (init?.get("arguments.0"))
              : null;
          const loaded =
            loader?.isArrowFunctionExpression() &&
            t.isCallExpression(loader.node.body) &&
            t.isImport(loader.node.body.callee) &&
            t.isStringLiteral(loader.node.body.arguments[0])
              ? loader.node.body.arguments[0].value
              : null;
          const base = loaded ? resolve(dirname(filename), loaded) : null;
          const nativeLazy =
            !!base &&
            [base, base + ".tsx", base + ".ts", base + "/index.tsx", base + "/index.ts"].some(f =>
              modules.has(f)
            );
          if (!init?.isFunction() && !factoryParam && !nativeLazy) {
            wrapForeign(q, t.identifier(name));
            return;
          }
        }
        if (api?.name === "For") {
          const keyed = opening.node.attributes.find(
            a => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === "keyed"
          );
          const child = q
            .get("children")
            .find(c => c.isJSXExpressionContainer() && t.isFunction(c.node.expression));
          const fn = child?.get("expression");
          const keyedValue =
            keyed && t.isJSXAttribute(keyed) && t.isJSXExpressionContainer(keyed.value)
              ? keyed.value.expression
              : undefined;
          if (fn?.isFunction()) {
            if (
              (!keyedValue || t.isBooleanLiteral(keyedValue, { value: true })) &&
              t.isIdentifier(fn.node.params[0])
            )
              valueReads(fn, fn.node.params[0].name);
            if (
              t.isBooleanLiteral(keyedValue, { value: false }) &&
              t.isIdentifier(fn.node.params[1])
            )
              valueReads(fn, fn.node.params[1].name);
          }
        }
        const props = [];
        for (const attr of opening.node.attributes) {
          if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name))
            fail(opening, "NATIVE_SPREAD", "Unsupported JSX attribute contract.");
          let value = !attr.value
            ? t.booleanLiteral(true)
            : t.isJSXExpressionContainer(attr.value)
              ? attr.value.expression
              : attr.value;
          if (t.isJSXEmptyExpression(value)) continue;
          if (api && ["when", "each", "fallback"].includes(attr.name.name) && !t.isFunction(value))
            value = t.arrowFunctionExpression([], value);
          props.push(
            copyPosition(
              t.objectProperty(copyPosition(t.identifier(attr.name.name), attr.name), value),
              attr
            )
          );
        }
        const children = t.react.buildChildren(q.node);
        if (children.length) {
          let child =
            children.length === 1
              ? children[0]
              : t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), q.node.children);
          if (!t.isExpression(child)) fail(q, "NATIVE_CHILD", "Unsupported native JSX child.");
          if (!t.isFunction(child)) {
            // A provider's and a control flow's children are a lazy view, which
            // has no body: an expression child there (`props.children`) reads
            // in a hole. A component's own children prop keeps its declared
            // type (Sierpinski's `children: number`); a component or provider
            // call is a view anywhere.
            const lazyView =
              contexts.has(name) ||
              importedContext ||
              (api?.module === "solid-js" && controls.has(api.name));
            if (
              (lazyView &&
                !t.isJSXElement(child) &&
                !t.isJSXFragment(child) &&
                !t.isStringLiteral(child)) ||
              (t.isCallExpression(child) &&
                ((t.isIdentifier(child.callee) && /^[A-Z]/.test(child.callee.name)) ||
                  (t.isMemberExpression(child.callee) &&
                    t.isIdentifier(child.callee.property, { name: "provide" }))))
            )
              child = t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [
                t.jsxExpressionContainer(child)
              ]);
            child = t.arrowFunctionExpression([], child);
          }
          props.push(t.objectProperty(t.identifier("children"), child));
        }
        const callee =
          contexts.has(name) || importedContext
            ? t.memberExpression(t.identifier(name), t.identifier("provide"))
            : copyPosition(t.identifier(name), tag.node);
        const call = t.callExpression(callee, [t.objectExpression(props)]);
        if (q.parentPath.isJSXElement() || q.parentPath.isJSXFragment())
          q.replaceWith(t.jsxExpressionContainer(call));
        else
          q.replaceWith(
            t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [
              t.jsxExpressionContainer(call)
            ])
          );
      }
    }
  });
  lowerNativeTypes(p);
  const rewrittenImports = new WeakSet();
  traverseOwned(p, {
    ImportDeclaration(q) {
      if (rewrittenImports.has(q.node)) return;
      rewrittenImports.add(q.node);
      const module = q.node.source.value;
      if (!["solid-js", "@solidjs/web"].includes(module)) return;
      const specs = [];
      const foreignSpecs = [];
      for (const spec of q.node.specifiers) {
        if (!t.isImportSpecifier(spec)) continue;
        if (q.node.importKind === "type" || spec.importKind === "type") continue;
        const name = t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
        if (nativePassthrough.has(name) || nativeTypes.has(name)) continue;
        const mapped = module === "solid-js" ? nativeMapping[name] : name;
        if (!mapped) continue;
        const binding = q.scope.getBinding(spec.local.name);
        const refs = binding?.referencePaths ?? [];
        const foreign = refs.filter(foreignStateReference);
        if (foreign.length) {
          foreignSpecs.push(spec);
          const owned = refs.filter(ref => !foreignStateReference(ref));
          if (!owned.length) continue;
          const alias = q.scope.generateUidIdentifier(mapped);
          for (const ref of owned) ref.replaceWith(t.cloneNode(alias));
          specs.push(t.importSpecifier(alias, t.identifier(mapped)));
        } else specs.push(t.importSpecifier(spec.local, t.identifier(mapped)));
      }
      const types = q.node.specifiers.filter(
        s =>
          q.node.importKind === "type" ||
          (t.isImportSpecifier(s) &&
            (s.importKind === "type" ||
              nativeTypes.has(t.isIdentifier(s.imported) ? s.imported.name : s.imported.value)))
      );
      const retained = [
        ...foreignSpecs,
        ...q.node.specifiers.filter(
          s =>
            t.isImportSpecifier(s) &&
            nativePassthrough.has(t.isIdentifier(s.imported) ? s.imported.name : s.imported.value)
        )
      ];
      if (retained.length) {
        const declaration = t.importDeclaration(retained, t.stringLiteral(module));
        rewrittenImports.add(declaration);
        q.insertBefore(declaration);
      }
      if (types.length) {
        const declaration = t.importDeclaration(types, t.stringLiteral(module));
        declaration.importKind = "type";
        for (const spec of declaration.specifiers)
          if (t.isImportSpecifier(spec)) spec.importKind = "value";
        rewrittenImports.add(declaration);
        q.insertBefore(declaration);
      }
      if (specs.length) q.replaceWith(t.importDeclaration(specs, t.stringLiteral("solid-yield")));
      else q.remove();
    }
  });
  if (needed.delete("__nativeOwnerCleanup"))
    p.node.body.unshift(
      t.importDeclaration(
        [t.importSpecifier(t.identifier("__nativeOwnerCleanup"), t.identifier("onCleanup"))],
        t.stringLiteral("solid-js")
      )
    );
  if (needed.delete("__nativeUseContext"))
    p.node.body.unshift(
      t.importDeclaration(
        [t.importSpecifier(t.identifier("__nativeUseContext"), t.identifier("nativeUseContext"))],
        t.stringLiteral("solid-yield/internal")
      )
    );
  if (needed.delete("__nativeCallback"))
    p.node.body.unshift(
      t.importDeclaration(
        [t.importSpecifier(t.identifier("__nativeCallback"), t.identifier("nativeCallback"))],
        t.stringLiteral("solid-yield/internal")
      )
    );
  if (needed.delete("__NativeArguments"))
    p.node.body.unshift(
      t.importDeclaration(
        [t.importSpecifier(t.identifier("__NativeArguments"), t.identifier("NativeArguments"))],
        t.stringLiteral("solid-yield/internal")
      )
    );
  if (foreignComponents.size) {
    traverseOwned(p, {
      Function(q) {
        if (
          q.getFunctionParent() ||
          (q.parentPath.isCallExpression() &&
            t.isIdentifier(q.parentPath.node.callee, { name: "__nativeC" }))
        )
          return;
        const name =
          ("id" in q.node ? q.node.id?.name : "") ||
          (q.parentPath.isVariableDeclarator() && t.isIdentifier(q.parentPath.node.id)
            ? q.parentPath.node.id.name
            : "");
        if (!foreignComponents.has(name) || !q.node.params[0]) return;
        needed.add("__nativeC");
        if (q.isFunctionDeclaration()) {
          const fn = t.functionExpression(q.node.id, q.node.params, q.node.body);
          const declaration = t.variableDeclaration("const", [
            t.variableDeclarator(
              t.identifier(name),
              t.callExpression(t.identifier("__nativeC"), [fn])
            )
          ]);
          if (q.parentPath.isExportDefaultDeclaration())
            q.parentPath.replaceWithMultiple([
              declaration,
              t.exportDefaultDeclaration(t.identifier(name))
            ]);
          else q.replaceWith(declaration);
        } else if (q.isFunctionExpression() || q.isArrowFunctionExpression()) {
          q.replaceWith(t.callExpression(t.identifier("__nativeC"), [q.node]));
        }
        q.skip();
      }
    });
  }
  const nativePropsImports = ["__nativeC", "__NativeProps"].filter(name => needed.delete(name));
  if (nativePropsImports.length)
    p.node.body.unshift(
      t.importDeclaration(
        nativePropsImports.map(name => {
          const spec = t.importSpecifier(
            t.identifier(name),
            t.identifier(name === "__nativeC" ? "nativeC" : "NativeProps")
          );
          if (name === "__NativeProps") spec.importKind = "type";
          return spec;
        }),
        t.stringLiteral("solid-yield/internal")
      )
    );
  for (const name of needed)
    if (p.scope.hasBinding(name))
      fail(p, "NATIVE_NAME", `Reserve ${name} for the generated native import.`);
  if (needed.size)
    p.node.body.unshift(
      t.importDeclaration(
        [...needed].map(name => {
          const spec = t.importSpecifier(
            t.identifier(name),
            t.identifier(
              name.replace(/^__native(?=render$|hydrate$|renderToString$|renderToStream$)/, "")
            )
          );
          if (name === "Props" || name === "RootCheck" || name === "Element")
            spec.importKind = "type";
          return spec;
        }),
        t.stringLiteral("solid-yield")
      )
    );
  p.node.directives.unshift(t.directive(t.directiveLiteral("use yield")));
  return print(p);
}
/** @param {Map<string,string>} input @param {{compilerOptions?: ts.CompilerOptions}} [options] */
function lowerNativeProjectImpl(input, options = {}) {
  const files = nativeRootTrees(new Map([...input].map(([id, code]) => [resolve(id), code])));
  /** @type {Map<string,string>} */ const entries = new Map();
  for (const [id, code] of files) {
    const entry = nativeEntry(code, id);
    if (entry !== null) entries.set(id, entry);
  }
  const selected = new Map([...files].filter(([id]) => !entries.has(id)));
  const diagnostics = inspectNativeProject(selected);
  const refusals = diagnostics.filter(d => d.code !== "MODULE_STATE");
  if (refusals.length) throw new NativeDiagnosticError(refusals);
  for (const [file, code] of selected) {
    const p = parseProgram(code, file);
    if (p) diagnostics.push(...nativeTypeDiagnostics(p, file));
  }
  // Resolve selected components handed as values to a foreign component slot.
  // Their source parameter remains the plain Solid call signature at that edge.
  const sourceProgram = [...selected.values()].some(code => /\bcomponent\s*:/.test(code))
    ? nativeProgram(selected, options.compilerOptions)
    : null;
  const checker = sourceProgram?.getTypeChecker();
  /** @type {Map<string, Set<string>>} */ const foreignComponents = new Map();
  for (const file of selected.keys()) {
    const source = sourceProgram?.getSourceFile(file);
    /** @param {ts.Node} node */
    /** @param {ts.Node} node */ const visit = node => {
      if (
        checker &&
        ts.isPropertyAssignment(node) &&
        node.name.getText(source) === "component" &&
        ts.isIdentifier(node.initializer)
      ) {
        const call =
          ts.isObjectLiteralExpression(node.parent) && ts.isCallExpression(node.parent.parent)
            ? node.parent.parent
            : null;
        const callee =
          call && ts.isIdentifier(call.expression)
            ? checker.getSymbolAtLocation(call.expression)
            : null;
        const foreignSlot = callee?.declarations?.some(declaration => {
          let parent = /** @type {ts.Node | undefined} */ (declaration);
          while (parent && !ts.isImportDeclaration(parent)) parent = parent.parent;
          return (
            parent &&
            ts.isImportDeclaration(parent) &&
            ts.isStringLiteral(parent.moduleSpecifier) &&
            !/^(\.|~|solid-js$|@solidjs\/web$|solid-yield(?:\/|$))/.test(
              parent.moduleSpecifier.text
            )
          );
        });
        if (!foreignSlot) {
          ts.forEachChild(node, visit);
          return;
        }
        let symbol = checker.getSymbolAtLocation(node.initializer);
        if (symbol && symbol.flags & ts.SymbolFlags.Alias)
          symbol = checker.getAliasedSymbol(symbol);
        for (const declaration of symbol?.declarations ?? []) {
          const target = declaration.getSourceFile().fileName;
          if (!selected.has(target)) continue;
          const name =
            (ts.isFunctionDeclaration(declaration) || ts.isVariableDeclaration(declaration)) &&
            declaration.name &&
            ts.isIdentifier(declaration.name)
              ? declaration.name.text
              : null;
          if (!name) continue;
          if (!foreignComponents.has(target)) foreignComponents.set(target, new Set());
          foreignComponents.get(target)?.add(name);
        }
      }
      ts.forEachChild(node, visit);
    };
    if (source) visit(source);
  }
  const sourceFailures = nativeFailures(files, options.compilerOptions);
  const prepared = nativePrelude(markOpaqueGenerators(selected));
  const failures = nativeFailures(prepared, options.compilerOptions, "marked");
  const effects = new Map(
    [...nativePrelude(lowerNativeEffects(prepared, failures))].map(([id, code]) => [
      id,
      lowerNativeRecursion(code, id)
    ])
  );
  const lowered = lowerSugarProject(
    new Map([
      ...new Map(
        [...effects].map(([id, code]) => [
          id,
          surface(
            code,
            id,
            effects,
            options.compilerOptions,
            foreignComponents.get(id),
            sourceFailures.functions
          )
        ])
      ),
      ...entries
    ]),
    {
      native: true,
      compilerOptions: {
        ...options.compilerOptions,
        jsxImportSource: "solid-yield",
        paths: {
          ...options.compilerOptions?.paths,
          "solid-yield": [
            resolve(
              dirname(createRequire(import.meta.url).resolve("solid-yield/package.json")),
              "dist/types/index.d.ts"
            )
          ],
          "solid-yield/internal": [
            resolve(
              dirname(createRequire(import.meta.url).resolve("solid-yield/package.json")),
              "dist/types/internal.d.ts"
            )
          ]
        }
      }
    }
  );
  return {
    ...lowered,
    files: nativeProviders(unmarkOpaqueGenerators(lowered.files), sourceFailures.functions),
    inference: sourceFailures,
    diagnostics: [
      ...diagnostics.map(d =>
        d.code === "MODULE_STATE" ? { ...d, severity: /** @type {const} */ ("error") } : d
      ),
      ...sourceFailures.diagnostics
        .filter(d => d.code !== "EVENT_REJECTS" || d.timer)
        .map(d => ({ ...d, severity: /** @type {const} */ ("error") })),
      ...nativeForeignDiagnostics(files, options.compilerOptions)
    ]
  };
}
/** Foreign tags are recorded against authored positions, before intermediate
 * passes change their line numbers. @param {Map<string,string>} files @param {ts.CompilerOptions} [options] */
export function nativeForeignDiagnostics(files, options = {}) {
  /** @type {Diagnostic[]} */ const diagnostics = [];
  for (const [file, code] of files) {
    const p = parseProgram(code, file);
    traverseOwned(p, {
      JSXOpeningElement(q) {
        const tag = q.get("name");
        if (tag.isJSXIdentifier() && /^[a-z]/.test(tag.node.name)) return;
        let api = imported(tag);
        if (!api && tag.isJSXIdentifier()) {
          const declaration = tag.scope.getBinding(tag.node.name)?.path;
          const init = declaration?.isVariableDeclarator() ? declaration.get("init") : null;
          if (init?.isCallExpression()) api = imported(init.get("callee"));
          // A lazy native module is checked natively (the library's lazy).
          const loader =
            api?.module === "solid-js" && api.name === "lazy" ? init?.get("arguments.0") : null;
          const body = loader?.isArrowFunctionExpression() ? loader.node.body : null;
          if (
            t.isCallExpression(body) &&
            t.isImport(body.callee) &&
            t.isStringLiteral(body.arguments[0]) &&
            [".tsx", ".ts", "/index.tsx", "/index.ts", ""].some(ext =>
              files.has(resolve(dirname(file), /** @type {any} */ (body.arguments[0]).value) + ext)
            )
          )
            return;
        }
        if (!api && tag.isJSXMemberExpression()) {
          let base = tag.get("object");
          while (base.isJSXMemberExpression()) base = base.get("object");
          api = imported(base);
        }
        if (
          !api ||
          api.module.startsWith(".") ||
          files.has(
            ts.resolveModuleName(
              api.module,
              file,
              { moduleResolution: ts.ModuleResolutionKind.Bundler, ...options },
              ts.sys
            ).resolvedModule?.resolvedFileName ?? ""
          ) ||
          (api.module === "solid-js" && (controls.has(api.name) || api.name === "createContext")) ||
          (api.module === "@solidjs/web" && api.name === "HydrationScript")
        )
          return;
        diagnostics.push({
          code: "NATIVE_FOREIGN_BOUNDARY",
          message: `Handle failures inside ${tag.toString()} or its callbacks; this imported component (${api.name} from ${api.module}) is outside the native check.`,
          file,
          line: q.node.loc?.start.line ?? 1,
          column: (q.node.loc?.start.column ?? 0) + 1
        });
      }
    });
  }
  return diagnostics;
}
/** @param {string} code @param {string} filename @param {(file:string)=>boolean} include @param {Map<string,any>} cache @param {(diagnostic: Diagnostic)=>void} [report] */
export function lowerNativeFile(code, filename, include, cache, report) {
  const configPath = ts.findConfigFile(dirname(filename), ts.sys.fileExists);
  if (!configPath) throw new Error("[NATIVE_PROJECT] Native mode requires a tsconfig.json.");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
  const files = new Map(
    parsed.fileNames
      .filter(f => include(f) && !f.endsWith(".d.ts") && !f.includes("/.generated/"))
      .map(f => [f, readFileSync(f, "utf8")])
  );
  files.set(filename, code);
  const signature = JSON.stringify([parsed.options, [...files]]);
  let entry = cache.get(configPath);
  if (entry?.signature !== signature) {
    const lowered = lowerNativeProject(files, { compilerOptions: parsed.options });
    entry = { signature, files: lowered.files };
    const errors = lowered.diagnostics.filter(d => d.severity === "error");
    if (errors.length) throw new NativeDiagnosticError(errors);
    for (const diagnostic of lowered.diagnostics) report?.(diagnostic);
    cache.set(configPath, entry);
  }
  return entry.files.get(filename) ?? code;
}

/** Shared lowering, including generated-to-author position tables.
 * @param {Map<string,string>} input @param {{compilerOptions?: ts.CompilerOptions, native?:boolean}} [options] */
export function lowerNativeProject(input, options = {}) {
  return withPositions(input, () => lowerNativeProjectImpl(input, options));
}
