import { format, resolveConfig } from "prettier";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { lowerSugarProject } from "../packages/vite-plugin-yield/src/sugar.js";
import { parseProgram } from "../packages/vite-plugin-yield/src/transform.js";
import { sugarFacts } from "../packages/compiler-yield/src/sugar-facts.js";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../packages/vite-plugin-yield/package.json", import.meta.url)
);
const babel = require("@babel/core");
const root = resolve(import.meta.dirname, "..");
const dir = join(root, "examples/todos-sugar");
const files = new Map(
  readdirSync(join(dir, "src"))
    .filter(f => /\.tsx?$/.test(f))
    .map(f => [join(dir, "src", f), readFileSync(join(dir, "src", f), "utf8")])
);
const result = lowerSugarProject(files);
mkdirSync(join(dir, ".generated/src"), { recursive: true });
for (const [id, code] of result.files)
  writeFileSync(
    join(dir, ".generated/src", id.split("/").pop()),
    await format(code, { ...(await resolveConfig(id)), filepath: id })
  );
// Keep normalization narrow: imports may be grouped/sorted; comments and
// JSX text uses Babel's standard whitespace normalization. No operation is erased.
function normalize(code, id) {
  const p = parseProgram(code, id),
    imports = [];
  p.traverse({
    ImportDeclaration(q) {
      if (q.node.source.value === "solid-yield") {
        imports.push(...q.node.specifiers);
        q.remove();
      }
    },
    JSXText(q) {
      const children = babel.types.react.buildChildren({ children: [q.node] });
      if (!children.length) q.remove();
      else q.replaceWith(babel.types.jsxExpressionContainer(children[0]));
    }
  });
  imports.sort((a, b) => a.local.name.localeCompare(b.local.name));
  p.node.body.unshift(
    babel.types.importDeclaration(imports, babel.types.stringLiteral("solid-yield"))
  );
  return babel.transformFromAstSync(babel.types.file(p.node), undefined, {
    babelrc: false,
    configFile: false,
    comments: false,
    compact: true
  }).code;
}
const normalized = new Map();
for (const [id, code] of result.files) {
  const name = relative(join(dir, "src"), id);
  const expected = readFileSync(join(root, "examples/todos-yield/src", name), "utf8");
  const actual = normalize(code, id);
  assert.equal(
    actual,
    normalize(expected, id),
    `${name}: generated code differs from handwritten twin`
  );
  normalized.set(id, actual);
}
const facts = sugarFacts(normalized, join(dir, "src/main.tsx"));
writeFileSync(join(dir, ".generated/analyzer.json"), JSON.stringify(facts, null, 2) + "\n");
console.log(
  `sugar: ${result.files.size} files match the explicit twin; inference settled in ${result.iterations} passes; ${facts.roots.length} analyzer root(s)`
);
