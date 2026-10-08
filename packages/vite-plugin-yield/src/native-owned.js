// Compiler metadata survives printing between native and sugar passes.
// Only generator callbacks passed directly to core APIs belong to lowering.
import babel from "@babel/core";
import { parseProgram } from "./transform.js";
import { printMapped } from "./positions.js";
const t = babel.types;
// Solid 2 rc.13: action consumes sync/async generators; the other APIs accept
// AsyncIterable producers in their first (compute/derived-store) argument.
export const generatorApis = new Set([
  "action",
  "createSignal",
  "createMemo",
  "createOptimistic",
  "createEffect",
  "createRenderEffect",
  "createStore",
  "createProjection",
  "createOptimisticStore"
]);
/** @param {import("@babel/core").NodePath<any>} path */
export function coreGenerator(path) {
  const call = path.parentPath;
  if (!call?.isCallExpression() || call.node.arguments[0] !== path.node) return false;
  const callee = call.get("callee");
  const spec = callee.isIdentifier() ? callee.scope.getBinding(callee.node.name)?.path : null;
  if (
    spec?.isImportSpecifier() &&
    spec.parentPath.isImportDeclaration() &&
    spec.parentPath.node.source.value === "solid-js"
  )
    return generatorApis.has(
      t.isIdentifier(spec.node.imported) ? spec.node.imported.name : spec.node.imported.value
    );
  if (callee.isMemberExpression() && !callee.node.computed) {
    const object = callee.get("object");
    const binding = object.isIdentifier() ? object.scope.getBinding(object.node.name)?.path : null;
    return !!(
      binding?.isImportNamespaceSpecifier() &&
      binding.parentPath.isImportDeclaration() &&
      binding.parentPath.node.source.value === "solid-js" &&
      t.isIdentifier(callee.node.property) &&
      generatorApis.has(callee.node.property.name)
    );
  }
  return false;
}
/** @param {import("@babel/core").NodePath<any>} path */
export const authoredOpaqueGenerator = path => !!path.node.generator && !coreGenerator(path);
export const opaqueDirective = "use native opaque";
/** @param {any} node */
export const opaqueGenerator = node =>
  !!node?.generator &&
  node.body?.directives?.some(/** @param {any} d */ d => d.value.value === opaqueDirective);
/** @param {import("@babel/core").NodePath<any> | null | undefined} path @param {import("@babel/core").Visitor<any>} visitor */
export function traverseOwned(path, visitor) {
  path?.traverse({
    ...visitor,
    enter(q) {
      if ((q.isFunction() && opaqueGenerator(q.node)) || moduleStateCall(q)) {
        q.skip();
        return;
      }
      if (typeof visitor.enter === "function") visitor.enter(q, undefined);
    }
  });
}
/** @param {Map<string,string>} files */
export function markOpaqueGenerators(files) {
  return new Map(
    [...files].map(([file, code]) => {
      const p = parseProgram(code, file);
      let changed = false;
      p?.traverse({
        Function(q) {
          if (!authoredOpaqueGenerator(q) || !t.isBlockStatement(q.node.body)) return;
          q.node.body.directives.unshift(t.directive(t.directiveLiteral(opaqueDirective)));
          changed = true;
          q.skip();
        }
      });
      return [file, changed && p ? printMapped(t.file(p.node)) : code];
    })
  );
}
/** @param {import("@babel/core").NodePath<any>} path */
export const inOpaqueGenerator = path =>
  !!path.findParent(q => q.isFunction() && opaqueGenerator(q.node));
/** @param {import("@babel/core").NodePath<any>} ref */
export function foreignStateReference(ref) {
  if (inOpaqueGenerator(ref)) return true;
  const call = ref.parentPath;
  if (!call?.isCallExpression() || call.node.callee !== ref.node) return false;
  const spec = ref.scope.getBinding(ref.node.name)?.path;
  const name =
    spec?.isImportSpecifier() && t.isIdentifier(spec.node.imported) ? spec.node.imported.name : "";
  if (!call.getFunctionParent() && /^(createSignal|createStore|createMemo)$/.test(name))
    return true;
  return call.node.arguments.some(arg => t.isFunction(arg) && opaqueGenerator(arg));
}

/** @param {Map<string,string>} files */
export function unmarkOpaqueGenerators(files) {
  return new Map(
    [...files].map(([file, code]) => {
      const p = parseProgram(code, file);
      let changed = false;
      p?.traverse({
        Function(q) {
          if (!opaqueGenerator(q.node) || !t.isBlockStatement(q.node.body)) return;
          q.node.body.directives = q.node.body.directives.filter(
            d => d.value.value !== opaqueDirective
          );
          changed = true;
        }
      });
      return [file, changed && p ? printMapped(t.file(p.node)) : code];
    })
  );
}

/** @param {import("@babel/core").NodePath<any>} q */
export function moduleStateCall(q) {
  if (!q?.isCallExpression() || q.getFunctionParent()) return false;
  const callee = q.get("callee");
  if (!callee.isIdentifier()) return false;
  const spec = callee.scope.getBinding(callee.node.name)?.path;
  return (
    spec?.isImportSpecifier() &&
    spec.parentPath.isImportDeclaration() &&
    spec.parentPath.node.source.value === "solid-js" &&
    t.isIdentifier(spec.node.imported) &&
    /^(createSignal|createStore|createMemo)$/.test(spec.node.imported.name)
  );
}
