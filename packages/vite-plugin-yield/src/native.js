import { printMapped, withPositions, copyPosition } from "./positions.js";
/** Native Solid front end. Refuse unsupported contracts before emitting any file.
 * The existing sugar engine and library checker remain the only color machinery. */
// @ts-check
import babel from "@babel/core";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { parseProgram } from "./transform.js";
import { lowerSugarProject } from "./sugar.js";
import { inferFailures } from "../../compiler-yield/src/failure-inference.js";
import { nativeEntry } from "./native-entry.js";
import { nativePrelude } from "./native-prelude.js";
import { lowerNativeEffects } from "./native-effects.js";
import { lowerNativeRecursion } from "./native-recursion.js";
const t = babel.types;
/** @typedef {import('@babel/core').NodePath<any>} Path */
/** @typedef {{code:string,message:string,file:string,line:number,column:number}} Diagnostic */
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
      strict: true,
      skipLibCheck: true,
      allowJs: true,
      ...options
    },
    host
  );
  return program;
}
/** @param {Map<string,string>} files @param {ts.CompilerOptions} [options] */
export function nativeFailures(files, options = {}) {
  return inferFailures(files, { program: nativeProgram(files, options), ts });
}
/** Inspect all selected files, accumulating refusals instead of stopping at the first one.
 * @param {Map<string,string>} files */
export function inspectNativeProject(files) {
  /** @type {Diagnostic[]} */
  const diagnostics = [];
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
          if (
            q.node.importKind === "type" ||
            (s.isImportSpecifier() && s.node.importKind === "type")
          ) {
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
      CallExpression(q) {
        const api = imported(q.get("callee"));
        if (api?.module !== "solid-js") return;
        if (api.name === "createEffect" && q.node.arguments.length < 2)
          report(
            q,
            "NATIVE_EFFECT_PHASES",
            "createEffect needs a tracked compute and an untracked effect phase."
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
            handler.traverse({
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
 * @param {string} code @param {string} filename @param {Map<string,string>} modules @param {ts.CompilerOptions} [options] */
function surface(code, filename, modules, options = {}) {
  const p = parseProgram(code, filename);
  if (!p) throw new Error(`Cannot parse ${filename}`);
  const needed = new Set();
  const contexts = new Set();
  let needsReturned = false;
  p.traverse({
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
      if (ref.parentPath?.isCallExpression() && ref.key === "callee") continue;
      ref.replaceWith(t.callExpression(t.identifier(name), []));
    }
  };
  /** @param {Path} q @param {string} code @param {string} message @returns {never} */
  const fail = (q, code, message) => {
    throw new NativeDiagnosticError([
      {
        code,
        message,
        file: filename,
        line: q.node.loc?.start.line ?? 1,
        column: (q.node.loc?.start.column ?? 0) + 1
      }
    ]);
  };
  /** Preserve the foreign tag and JSX capture positions. @param {Path} q @param {any} target */
  const wrapForeign = (q, target) => {
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
        callback.traverse({
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
  p.traverse({
    Function(q) {
      const name =
        ("id" in q.node ? q.node.id?.name : "") ||
        (q.parentPath.isVariableDeclarator() && t.isIdentifier(q.parentPath.node.id)
          ? q.parentPath.node.id.name
          : "");
      if (q.getFunctionParent() || !/^[A-Z]/.test(name ?? "")) return;
      let jsx = t.isJSXElement(q.node.body) || t.isJSXFragment(q.node.body);
      q.traverse({
        Function(inner) {
          inner.skip();
        },
        ReturnStatement(inner) {
          jsx ||= t.isJSXElement(inner.node.argument) || t.isJSXFragment(inner.node.argument);
        }
      });
      if (!jsx) return;
      const param = q.node.params[0];
      if (q.parentPath.isVariableDeclarator() && t.isIdentifier(q.parentPath.node.id)) {
        const declared = q.parentPath.node.id.typeAnnotation;
        const type = declared?.type === "TSTypeAnnotation" ? declared.typeAnnotation : null;
        if (
          t.isTSTypeReference(type) &&
          t.isIdentifier(type.typeName) &&
          ["Component", "ParentComponent"].includes(type.typeName.name)
        ) {
          const binding = q.scope.getBinding(type.typeName.name)?.path;
          if (
            binding?.isImportSpecifier() &&
            binding.parentPath.isImportDeclaration() &&
            binding.parentPath.node.source.value === "solid-js"
          ) {
            if (t.isIdentifier(param) && !param.typeAnnotation)
              param.typeAnnotation = t.tsTypeAnnotation(
                type.typeParameters?.params[0] ?? t.tsTypeLiteral([])
              );
            q.parentPath.node.id.typeAnnotation = null;
          }
        }
      }
      if (param && !t.isIdentifier(param))
        fail(
          q,
          "NATIVE_PROPS",
          "Destructured component parameters need a checked snapshot-versus-path mapping."
        );
      if (param?.typeAnnotation?.type === "TSTypeAnnotation") {
        needed.add("Props");
        param.typeAnnotation.typeAnnotation = t.tsTypeReference(
          t.identifier("Props"),
          t.tsTypeParameterInstantiation([param.typeAnnotation.typeAnnotation])
        );
      }
      if (q.node.returnType)
        fail(
          q,
          "NATIVE_RETURN_TYPE",
          "A component return annotation needs a virtual value-to-routine type mapping."
        );
    },
    CallExpression(q) {
      const api = imported(q.get("callee"));
      if (api?.module === "@solidjs/web" && ["render", "hydrate"].includes(api.name)) {
        const callback = q.get("arguments.0");
        if (callback?.isArrowFunctionExpression() && t.isJSXElement(callback.node.body)) {
          const element = callback.node.body;
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
              t.tsTypeReference(
                t.identifier("RootCheck"),
                t.tsTypeParameterInstantiation([t.tsTypeQuery(t.identifier(target.name))])
              )
            ),
            target
          );
          if (local?.isFunction()) {
            // A selected local component is a library root, where failures
            // may propagate (D-033), rather than a foreign component handoff.
            q.node.callee = t.identifier(`__native${api.name}`);
            needed.add(`__native${api.name}`);
            q.node.arguments[0] = check;
          } else {
            needed.add("foreign");
            q.node.arguments[0] = t.callExpression(t.identifier("foreign"), [check]);
          }
        }
        return;
      }
      if (api?.module !== "solid-js") return;
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
        if (q.parentPath.isVariableDeclarator() && t.isIdentifier(q.parentPath.node.id))
          valueReads(q.parentPath, q.parentPath.node.id.name);
        q.replaceWith(t.callExpression(q.node.arguments[0], []));
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
  p.traverse({
    JSXElement: {
      exit(q) {
        const opening = q.get("openingElement"),
          tag = opening.get("name");
        // A member tag can have a getter. Preserve its lookup at the JSX
        // position; hoisting an alias would run it before a conditional arm.
        // The existing JSX tag contract is the foreign check at this edge.
        if (tag.isJSXMemberExpression()) return;
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
            init.traverse({
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
          if (!importedContext && !jsx) {
            wrapForeign(q, t.identifier(name));
            return;
          }
        }
        if (!api && !contexts.has(name)) {
          const binding = tag.scope.getBinding(name)?.path;
          const init = binding?.isVariableDeclarator() ? binding.get("init") : binding;
          if (!init?.isFunction()) {
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
            if (
              t.isCallExpression(child) &&
              ((t.isIdentifier(child.callee) && /^[A-Z]/.test(child.callee.name)) ||
                (t.isMemberExpression(child.callee) &&
                  t.isIdentifier(child.callee.property, { name: "provide" })))
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
  const rewrittenImports = new WeakSet();
  p.traverse({
    ImportDeclaration(q) {
      if (rewrittenImports.has(q.node)) return;
      rewrittenImports.add(q.node);
      const module = q.node.source.value;
      if (!["solid-js", "@solidjs/web"].includes(module)) return;
      const specs = [];
      for (const spec of q.node.specifiers) {
        if (!t.isImportSpecifier(spec)) continue;
        if (q.node.importKind === "type" || spec.importKind === "type") continue;
        const name = t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
        if (nativePassthrough.has(name) || nativeTypes.has(name)) continue;
        const mapped = module === "solid-js" ? nativeMapping[name] : name;
        if (!mapped) continue;
        specs.push(t.importSpecifier(spec.local, t.identifier(mapped)));
      }
      const types = q.node.specifiers.filter(
        s =>
          q.node.importKind === "type" ||
          (t.isImportSpecifier(s) &&
            (s.importKind === "type" ||
              nativeTypes.has(t.isIdentifier(s.imported) ? s.imported.name : s.imported.value)))
      );
      const retained = q.node.specifiers.filter(
        s =>
          t.isImportSpecifier(s) &&
          nativePassthrough.has(t.isIdentifier(s.imported) ? s.imported.name : s.imported.value)
      );
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
  for (const name of needed)
    if (p.scope.hasBinding(name))
      fail(p, "NATIVE_NAME", `Reserve ${name} for the generated native import.`);
  if (needed.size)
    p.node.body.unshift(
      t.importDeclaration(
        [...needed].map(name => {
          const spec = t.importSpecifier(
            t.identifier(name),
            t.identifier(name.replace(/^__native(?=render$|hydrate$)/, ""))
          );
          if (name === "Props" || name === "RootCheck") spec.importKind = "type";
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
  const files = new Map([...input].map(([id, code]) => [resolve(id), code]));
  /** @type {Map<string,string>} */ const entries = new Map();
  for (const [id, code] of files) {
    const entry = nativeEntry(code, id);
    if (entry !== null) entries.set(id, entry);
  }
  const selected = new Map([...files].filter(([id]) => !entries.has(id)));
  const diagnostics = inspectNativeProject(selected);
  if (diagnostics.length) throw new NativeDiagnosticError(diagnostics);
  const prepared = nativePrelude(selected);
  const failures = nativeFailures(prepared, options.compilerOptions);
  const effects = new Map(
    [...nativePrelude(lowerNativeEffects(prepared, failures))].map(([id, code]) => [
      id,
      lowerNativeRecursion(code, id)
    ])
  );
  const lowered = lowerSugarProject(
    new Map([
      ...new Map(
        [...effects].map(([id, code]) => [id, surface(code, id, effects, options.compilerOptions)])
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
  return { ...lowered, diagnostics: nativeForeignDiagnostics(files, options.compilerOptions) };
}
/** Foreign tags are recorded against authored positions, before intermediate
 * passes change their line numbers. @param {Map<string,string>} files @param {ts.CompilerOptions} [options] */
export function nativeForeignDiagnostics(files, options = {}) {
  /** @type {Diagnostic[]} */ const diagnostics = [];
  for (const [file, code] of files) {
    const p = parseProgram(code, file);
    p?.traverse({
      JSXOpeningElement(q) {
        const tag = q.get("name");
        let api = imported(tag);
        if (!api && tag.isJSXIdentifier()) {
          const declaration = tag.scope.getBinding(tag.node.name)?.path;
          const init = declaration?.isVariableDeclarator() ? declaration.get("init") : null;
          if (init?.isCallExpression()) api = imported(init.get("callee"));
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
          message: `${tag.toString()} (${api.name} from ${api.module}) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.`,
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
