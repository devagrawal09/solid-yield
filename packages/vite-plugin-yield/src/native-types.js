// @ts-check
import babel from "@babel/core";
const t = babel.types;
/** Solid value contracts translated to the existing library contracts. */
export const nativeTypeMapping = Object.freeze({
  Accessor: ["solid-yield", "Source"],
  Setter: ["solid-yield", "Setter"],
  Signal: ["solid-yield/internal", "NativeSignal"],
  Component: ["solid-yield", "Component"],
  ParentProps: ["solid-yield/internal", "NativeParentProps"],
  ParentComponent: ["solid-yield/internal", "NativeParentComponent"],
  VoidComponent: ["solid-yield/internal", "NativeVoidComponent"]
});
/** @typedef {import('@babel/core').NodePath<any>} Path */
/** A normal TS import can still be used exclusively in annotations.
 * @param {Path} q */
export function nativeTypeImport(q) {
  if (!q.parentPath?.isImportDeclaration()) return false;
  if (q.parentPath.node.importKind === "type" || q.node.importKind === "type") return true;
  const refs = q.scope.getBinding(q.node.local.name)?.referencePaths ?? [];
  return (
    refs.length > 0 &&
    refs.every(ref =>
      ref.findParent(
        parent =>
          parent.isTSTypeReference() ||
          parent.isTSExpressionWithTypeArguments() ||
          parent.isTSTypeQuery()
      )
    )
  );
}
/** @param {Path} q */
export function solidType(q) {
  let name = q.node.typeName ?? q.node.expression ?? q.node.exprName;
  const parts = [];
  while (t.isTSQualifiedName(name)) {
    parts.unshift(name.right.name);
    name = name.left;
  }
  if (!t.isIdentifier(name)) return null;
  const binding = q.scope.getBinding(name.name)?.path;
  if (!binding?.parentPath?.isImportDeclaration()) return null;
  const module = binding.parentPath.node.source.value;
  if (!["solid-js", "@solidjs/web"].includes(module)) return null;
  if (binding.isImportSpecifier())
    parts.unshift(
      t.isIdentifier(binding.node.imported)
        ? binding.node.imported.name
        : binding.node.imported.value
    );
  else if (!binding.isImportNamespaceSpecifier()) return null;
  return { name: parts.join("."), binding, module };
}
/** Report unmapped types at each use, preserving the authored contract.
 * @param {Path} p @param {string} file */
export function nativeTypeDiagnostics(p, file) {
  /** @type {import('./native.js').NativeDiagnosticError['diagnostics']} */
  const diagnostics = [];
  /** @param {Path} q */
  const check = q => {
    const type = q.isTSImportType() ? importType(q) : solidType(q);
    if (!type || type.name in nativeTypeMapping || type.name === "JSX.Element") return;
    diagnostics.push({
      code: "NATIVE_TYPE_UNMAPPED",
      message: `Solid type ${type.name} has no native type mapping; the annotation is retained.`,
      file,
      line: q.node.loc?.start.line ?? 1,
      column: (q.node.loc?.start.column ?? 0) + 1,
      severity: /** @type {const} */ ("warning")
    });
  };
  p.traverse({
    TSTypeReference: check,
    TSExpressionWithTypeArguments: check,
    TSImportType: check,
    TSTypeQuery: check
  });
  return diagnostics;
}
/** @param {Path} q */
function importType(q) {
  if (!["solid-js", "@solidjs/web"].includes(q.node.argument.value)) return null;
  let name = q.node.qualifier;
  const parts = [];
  while (t.isTSQualifiedName(name)) {
    parts.unshift(name.right.name);
    name = name.left;
  }
  if (!t.isIdentifier(name)) return null;
  parts.unshift(name.name);
  return { name: parts.join("."), binding: null };
}
/** Lower all type positions, including aliases, nested generics and casts.
 * Run after component parameter extraction, before value import rewriting.
 * @param {Path} p */
export function lowerNativeTypes(p) {
  const imports = new Map();
  const rewritten = new Set();
  /** @param {string} module @param {string} name @param {any} local */
  const add = (module, name, local) => {
    const specs = imports.get(module) ?? [];
    specs.push(t.importSpecifier(local, t.identifier(name)));
    imports.set(module, specs);
  };
  // Preserve local aliases and binding identity. Unknown imports stay Solid.
  p.traverse({
    ImportDeclaration(q) {
      if (!["solid-js", "@solidjs/web"].includes(q.node.source.value)) return;
      for (const spec of q.get("specifiers")) {
        if (spec.isImportNamespaceSpecifier() && nativeTypeImport(spec)) q.node.importKind = "type";
        if (!spec.isImportSpecifier()) continue;
        const name = t.isIdentifier(spec.node.imported)
          ? spec.node.imported.name
          : spec.node.imported.value;
        const mapping = nativeTypeMapping[/** @type {keyof typeof nativeTypeMapping} */ (name)];
        if (!mapping) {
          if (q.node.importKind !== "type" && nativeTypeImport(spec)) spec.node.importKind = "type";
          continue;
        }
        rewritten.add(spec.node);
        add(mapping[0], mapping[1], t.cloneNode(spec.node.local));
      }
    }
  });
  const qualified = new Map();
  /** @param {Path} q */
  const rewrite = q => {
    const type = q.isTSImportType() ? importType(q) : solidType(q);
    if (!type || (type.binding && rewritten.has(type.binding.node))) return;
    const mapping =
      type.name === "JSX.Element"
        ? ["solid-yield", "Element"]
        : nativeTypeMapping[/** @type {keyof typeof nativeTypeMapping} */ (type.name)];
    if (!mapping) return;
    const key = mapping.join(":");
    let id = qualified.get(key);
    if (!id) {
      id = p.scope.generateUidIdentifier(`Native${mapping[1]}`);
      qualified.set(key, id);
      add(mapping[0], mapping[1], id);
    }
    if (q.isTSImportType())
      q.replaceWith(t.tsTypeReference(t.cloneNode(id), q.node.typeParameters));
    else if (q.isTSTypeReference()) q.node.typeName = t.cloneNode(id);
    else q.node.expression = t.cloneNode(id);
  };
  p.traverse({
    TSTypeReference: rewrite,
    TSExpressionWithTypeArguments: rewrite,
    TSImportType: rewrite
  });
  // JSX is a namespace, not a named replacement. Drop its import only when
  // every reference was lowered; other JSX contracts keep their Solid origin.
  p.scope.crawl();
  p.traverse({
    ImportSpecifier(q) {
      if (!q.parentPath.isImportDeclaration()) return;
      if (!["solid-js", "@solidjs/web"].includes(q.parentPath.node.source.value)) return;
      if (!t.isIdentifier(q.node.imported, { name: "JSX" })) return;
      if (!q.scope.getBinding(q.node.local.name)?.referenced) rewritten.add(q.node);
    }
  });
  p.traverse({
    ImportDeclaration(q) {
      const hadSpecifiers = q.node.specifiers.length > 0;
      q.node.specifiers = q.node.specifiers.filter(spec => !rewritten.has(spec));
      if (
        hadSpecifiers &&
        !q.node.specifiers.length &&
        ["solid-js", "@solidjs/web"].includes(q.node.source.value)
      )
        q.remove();
    }
  });
  for (const [module, specs] of imports) {
    const declaration = t.importDeclaration(specs, t.stringLiteral(module));
    declaration.importKind = "type";
    p.node.body.unshift(declaration);
  }
}
