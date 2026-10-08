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
/** @param {any} path */
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
      spec.node.imported.type === "Identifier" ? spec.node.imported.name : spec.node.imported.value
    );
  if (callee.isMemberExpression() && !callee.node.computed) {
    const object = callee.get("object");
    const binding = object.isIdentifier() ? object.scope.getBinding(object.node.name)?.path : null;
    return !!(
      binding?.isImportNamespaceSpecifier() &&
      binding.parentPath.isImportDeclaration() &&
      binding.parentPath.node.source.value === "solid-js" &&
      callee.node.property.type === "Identifier" &&
      generatorApis.has(callee.node.property.name)
    );
  }
  return false;
}
/** @param {any} path */
export const authoredOpaqueGenerator = path => !!path.node.generator && !coreGenerator(path);
