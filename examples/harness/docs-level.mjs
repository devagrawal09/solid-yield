import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
export const docsLevel = () => {
  const level = process.env.DOCS_LEVEL ?? "L";
  if (!["S", "M", "L"].includes(level)) throw new Error("DOCS_LEVEL must be S, M or L");
  return level;
};
// Same authored site; only the selected server-derivable content is linked.
// Both normal and extracted dependency modules use this build-time selection.
export default function docsLevelPlugin() {
  const level = docsLevel();
  return {
    name: "docs-content-level",
    enforce: "pre",
    config() {
      return { define: { __DOCS_LEVEL__: JSON.stringify(level) } };
    },
    transform(code, id) {
      if (id.endsWith("/docs-yield/tests/script.ts"))
        return code.replaceAll("__DOCS_LEVEL__", JSON.stringify(level));
      if (!/\/examples\/(?:originals\/)?docs(?:-yield)?\/src\//.test(id)) return;
      if (level !== "L" && /\/level-pipelines(?:__compiler_dep)?\.ts$/.test(id))
        return readFileSync(resolve(dirname(id), `level-${level}.ts`), "utf8");
      if (level !== "L" && /\/level-data(?:__compiler_dep)?\.ts$/.test(id))
        return readFileSync(resolve(dirname(id), `data-${level}.ts`), "utf8");
      if (/\/app\.tsx$/.test(id) && level !== "S")
        return (
          `import "katex/dist/katex.min.css";\n${level === "L" ? 'import "diff2html/bundles/css/diff2html.min.css";\n' : ""}` +
          code
        );
    }
  };
}
