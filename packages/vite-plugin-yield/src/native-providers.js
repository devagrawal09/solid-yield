// @ts-check
import babel from "@babel/core";
import { printMapped } from "./positions.js";
import { parseProgram } from "./transform.js";
const t = babel.types;
const helper = `type __NativeProvided<C, D, Q> = C extends (...args: any[]) => import("solid-yield").ComponentView<infer P extends boolean, infer E, infer W extends boolean, infer R>
 ? <A extends Omit<import("solid-yield").PropsInput<D, unknown>, "children"> & {children: () => Generator<import("solid-yield").ViewOp, import("solid-yield").Element, any>}>(props: A) => import("solid-yield").ComponentView<
 P | import("solid-yield").ViewPending<import("solid-yield").ViewYield<A["children"]>, import("solid-yield").ViewReturn<A["children"]>>,
 E | import("solid-yield").ViewFails<import("solid-yield").ViewYield<A["children"]>, import("solid-yield").ViewReturn<A["children"]>>,
 W | import("solid-yield").ViewMayWait<import("solid-yield").ViewYield<A["children"]>, import("solid-yield").ViewReturn<A["children"]>>,
 R | Exclude<import("solid-yield").ViewRequires<import("solid-yield").ViewYield<A["children"]>, import("solid-yield").ViewReturn<A["children"]>>, Q>>
 : never;`;
/** Preserve the library's four color projections, subtracting the contexts
 * proved to surround children by the component-body summary. No runtime wrapper.
 * @param {Map<string,string>} files
 * @param {import('compiler-yield/failure-inference').FailureFunction[]} summaries */
export function nativeProviders(files, summaries) {
  return new Map(
    [...files].map(([file, code]) => {
      const providers = summaries.filter(f => file.endsWith(f.file) && f.provides?.length);
      if (!providers.length) return [file, code];
      const p = parseProgram(code, file);
      if (!p) return [file, code];
      let used = false;
      p.traverse({
        VariableDeclarator(q) {
          if (!t.isIdentifier(q.node.id) || !t.isCallExpression(q.node.init)) return;
          const name = q.node.id.name;
          const summary = providers.find(f => f.name === name);
          if (!summary) return;
          const fn = q.node.init.arguments[0];
          if (!t.isFunction(fn) || !t.isIdentifier(fn.params[0])) return;
          const annotation = fn.params[0].typeAnnotation;
          const props = annotation?.type === "TSTypeAnnotation" ? annotation.typeAnnotation : null;
          if (!t.isTSTypeReference(props) || !props.typeParameters?.params[0]) return;
          const base = q.scope.generateUidIdentifier(summary.name);
          const statement = q.parentPath.parentPath?.isExportNamedDeclaration()
            ? q.parentPath.parentPath
            : q.parentPath;
          statement.insertBefore(
            t.variableDeclaration("const", [t.variableDeclarator(base, q.node.init)])
          );
          const provided = summary.provides.map(id =>
            t.tsImportType(
              t.stringLiteral("solid-yield"),
              t.identifier("RequiredContext"),
              t.tsTypeParameterInstantiation([
                t.tsAnyKeyword(),
                t.tsLiteralType(t.stringLiteral(id))
              ])
            )
          );
          q.node.init = t.tsAsExpression(
            base,
            t.tsTypeReference(
              t.identifier("__NativeProvided"),
              t.tsTypeParameterInstantiation([
                t.tsTypeQuery(base),
                props.typeParameters.params[0],
                provided.length === 1 ? provided[0] : t.tsUnionType(provided)
              ])
            )
          );
          used = true;
          q.skip();
        }
      });
      if (used) {
        const parsed = parseProgram(helper, file);
        if (parsed) p.node.body.unshift(...parsed.node.body);
      }
      return [file, printMapped(t.file(p.node))];
    })
  );
}
