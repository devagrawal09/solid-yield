import { analyzeInstances as analyze } from "./placement.js";
import { parseProgram } from "./parse.js";
export { analyzeInstances as analyze } from "./placement.js";

export function importsOf(code, id) {
  const imports = new Set();
  const program = parseProgram(code, id);
  program.traverse({
    ImportDeclaration(p) {
      if (p.node.importKind !== "type") imports.add(p.node.source.value);
    },
    ExportNamedDeclaration(p) {
      if (p.node.source) imports.add(p.node.source.value);
    },
    ExportAllDeclaration(p) {
      imports.add(p.node.source.value);
    },
    CallExpression(p) {
      if (p.node.callee.type === "Import" && p.node.arguments[0]?.type === "StringLiteral")
        imports.add(p.node.arguments[0].value);
    }
  });
  return [...imports];
}

/** Place before solidYield(): C1 returns no transformed code or generated files. */
export default function compilerYield({ onReport = () => {} } = {}) {
  const modules = new Map();
  const resolved = new Map();
  return {
    name: "compiler-yield:analysis",
    enforce: "pre",
    buildStart() {
      modules.clear();
      resolved.clear();
    },
    async transform(code, id) {
      if (id.includes("node_modules") || !/\.[cm]?[jt]sx?$/.test(id)) return null;
      modules.set(id, code);
      for (const spec of importsOf(code, id)) {
        const target = await this.resolve(spec, id);
        resolved.set(`${id}\0${spec}`, target?.id ?? null);
      }
      return null;
    },
    buildEnd(error) {
      if (error) return;
      const report = analyze(modules, {
        resolve: (spec, from) => resolved.get(`${from}\0${spec}`)
      });
      onReport(report);
      for (const root of report.roots)
        for (const effect of root.effectReach)
          this.warn(
            `${effect.at}: effect makes root ${root.id} eager; touches ${effect.touched.length} parts, pulls in ${effect.pulledIn.length}`
          );
    }
  };
}
