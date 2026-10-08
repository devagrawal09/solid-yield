import { printMapped, copyPosition } from "./positions.js";
// @ts-check
import babel from "@babel/core";
import { parseProgram } from "./transform.js";
const t = babel.types;
/** Entry files remain foreign Solid code. Insert only the existing checked
 * handoff for direct renderer components, never a routine around the entry.
 * @param {string} code @param {string} file @returns {string|null} */
export function nativeEntry(code, file) {
  const p = parseProgram(code, file);
  if (!p) return null;
  const roots = new Set();
  let hasSetup = false,
    hasComponent = false;
  p.traverse({
    ImportDeclaration(q) {
      if (
        q.node.source.value === "solid-js" &&
        q.node.specifiers.some(
          s =>
            t.isImportSpecifier(s) &&
            t.isIdentifier(s.imported) &&
            /^(create|action|onSettled)/.test(s.imported.name)
        )
      )
        hasSetup = true;
      if (q.node.source.value === "@solidjs/web")
        for (const s of q.node.specifiers)
          if (
            t.isImportSpecifier(s) &&
            t.isIdentifier(s.imported) &&
            ["render", "hydrate", "renderToString", "renderToStream"].includes(s.imported.name)
          )
            roots.add(s.local.name);
    },
    Function(q) {
      const name =
        ("id" in q.node ? q.node.id?.name : undefined) ??
        (q.parentPath.isVariableDeclarator() && t.isIdentifier(q.parentPath.node.id)
          ? q.parentPath.node.id.name
          : "");
      if (/^[A-Z]/.test(name ?? "")) hasComponent = true;
    }
  });
  if (!roots.size || hasSetup || hasComponent) return null;
  let adapted = false;
  p.traverse({
    CallExpression(q) {
      if (!t.isIdentifier(q.node.callee) || !roots.has(q.node.callee.name)) return;
      let arg = q.node.arguments[0];
      if (t.isArrowFunctionExpression(arg) && t.isJSXElement(arg.body)) {
        const body = arg.body;
        if (
          t.isJSXIdentifier(body.openingElement.name) &&
          !body.openingElement.attributes.length &&
          !body.children.length
        )
          arg = copyPosition(t.identifier(body.openingElement.name.name), body.openingElement.name);
      }
      if (t.isIdentifier(arg) && /^[A-Z]/.test(arg.name)) {
        adapted = true;
        q.node.arguments[0] = t.callExpression(t.identifier("__nativeForeign"), [
          copyPosition(
            t.tsSatisfiesExpression(
              arg,
              t.tsTypeReference(
                t.identifier("__NativeRootCheck"),
                t.tsTypeParameterInstantiation([t.tsTypeQuery(t.identifier(arg.name))])
              )
            ),
            arg
          )
        ]);
      }
    }
  });
  if (adapted) {
    if (p.scope.hasBinding("__nativeForeign"))
      throw new Error(
        `[NATIVE_NAME] Reserve __nativeForeign for the generated entry adapter. (${file})`
      );
    p.node.body.unshift(
      t.importDeclaration(
        [
          t.importSpecifier(t.identifier("__nativeForeign"), t.identifier("foreign")),
          Object.assign(
            t.importSpecifier(t.identifier("__NativeRootCheck"), t.identifier("RootCheck")),
            { importKind: "type" }
          )
        ],
        t.stringLiteral("solid-yield")
      )
    );
  }
  return printMapped(t.file(p.node));
}
