import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { parseProgram } from "../../vite-plugin-yield/src/transform.js";
const require = createRequire(new URL("../../vite-plugin-yield/package.json", import.meta.url));
const MagicString = require("magic-string");

/** Emit a module from original spans, retaining top-level dependency bindings.
 * No application code is evaluated. Each returned map names the original file;
 * the ordinary yield and Solid passes chain it through their own maps.
 */
export function extractModule(code, filename, names, rewriteImport) {
  const program = parseProgram(code, filename);
  names ??= program
    .get("body")
    .flatMap(p =>
      p.isExportNamedDeclaration() && p.node.declaration
        ? Object.keys(p.get("declaration").getOuterBindingIdentifiers())
        : []
    );
  const keep = new Set(),
    bindings = new Set();
  const visit = binding => {
    if (!binding || bindings.has(binding)) return;
    bindings.add(binding);
    let statement = binding.path;
    while (statement.parentPath !== program) statement = statement.parentPath;
    keep.add(statement);
    if (statement.isImportDeclaration()) return;
    statement.traverse({
      ReferencedIdentifier(p) {
        const dependency = p.scope.getBinding(p.node.name);
        if (dependency?.scope === program.scope) visit(dependency);
      },
      JSXIdentifier(p) {
        const dependency = p.scope.getBinding(p.node.name);
        if (dependency?.scope === program.scope) visit(dependency);
      }
    });
  };
  for (const name of names) {
    const binding = program.scope.getBinding(name);
    if (!binding) throw new Error(`${filename}: cannot extract ${name}`);
    visit(binding);
  }
  // Removing a declaration must not remove module work. Only the library's
  // component factory and expressions Babel proves pure may be discarded.
  for (const statement of program.get("body")) {
    if (keep.has(statement) || statement.isImportDeclaration()) continue;
    if (
      statement.isExportNamedDeclaration() &&
      !statement.node.declaration &&
      !statement.node.source
    )
      continue;
    const declaration = statement.isExportNamedDeclaration()
      ? statement.get("declaration")
      : statement;
    if (
      declaration?.isFunctionDeclaration() ||
      declaration?.isTSTypeAliasDeclaration() ||
      declaration?.isTSInterfaceDeclaration()
    )
      continue;
    if (declaration?.isVariableDeclaration()) {
      const pure = declaration.get("declarations").every(d => {
        const init = d.get("init");
        if (!init.node || init.isPure()) return true;
        const binding =
          init.isCallExpression() &&
          init.get("callee").isIdentifier() &&
          init.scope.getBinding(init.node.callee.name);
        return (
          binding?.path.isImportSpecifier() &&
          binding.path.node.imported.name === "component" &&
          binding.path.parentPath.node.source.value === "solid-yield"
        );
      });
      if (pure) continue;
    } else if (
      statement.isExportDefaultDeclaration() &&
      statement.get("declaration").isIdentifier()
    )
      continue;
    keep.add(statement);
    statement.traverse({
      ReferencedIdentifier(p) {
        const binding = p.scope.getBinding(p.node.name);
        if (binding?.scope === program.scope) visit(binding);
      }
    });
  }
  const out = new MagicString(code);
  for (const statement of program.get("body")) {
    if (statement.isImportDeclaration() && !statement.node.specifiers.length) continue;
    if (!keep.has(statement)) {
      out.remove(statement.node.start, statement.node.end);
      continue;
    }
    if (statement.isImportDeclaration()) {
      if (statement.node.importKind === "type") {
        out.remove(statement.node.start, statement.node.end);
        continue;
      }
      const specs = statement
        .get("specifiers")
        .filter(
          p =>
            p.node.importKind !== "type" &&
            bindings.has(program.scope.getBinding(p.node.local.name))
        );
      const source =
        rewriteImport?.(
          statement.node.source.value,
          specs.map(p =>
            p.isImportSpecifier()
              ? p.node.imported.name
              : p.isImportDefaultSpecifier()
                ? "default"
                : "*"
          )
        ) ?? statement.node.source.value;
      if (
        specs.length !== statement.node.specifiers.length ||
        source !== statement.node.source.value
      ) {
        // Import syntax is generated; executable function spans remain exact.
        const defaults = specs
          .filter(p => p.isImportDefaultSpecifier())
          .map(p => p.node.local.name);
        const namespaces = specs
          .filter(p => p.isImportNamespaceSpecifier())
          .map(p => `* as ${p.node.local.name}`);
        const named = specs
          .filter(p => p.isImportSpecifier())
          .map(
            p =>
              `${p.node.imported.name}${p.node.local.name === p.node.imported.name ? "" : ` as ${p.node.local.name}`}`
          );
        out.overwrite(
          statement.node.start,
          statement.node.end,
          `import ${[...defaults, ...namespaces, ...(named.length ? [`{${named.join(",")}}`] : [])].join(",")} from ${JSON.stringify(source)};`
        );
      }
    }
  }
  out.append(`\nexport { ${names.join(", ")} };\n`);
  // Remove original export keywords to avoid duplicate exports in the slice.
  for (const statement of keep)
    if (statement.isExportNamedDeclaration() && statement.node.declaration)
      out.remove(statement.node.start, statement.node.declaration.start);
  return {
    code: out.toString(),
    map: out.generateMap({ source: filename, includeContent: true, hires: true })
  };
}

/** C2 preparation: emit source-mapped root modules. Physical placements are an
 * explicit plan, not C1's diagnostic spans silently treated as proven claims.
 */
export function rootModule(filename, names) {
  return extractModule(readFileSync(filename, "utf8"), filename, names);
}
