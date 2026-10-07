// Standalone production bundles price the payload libraries without app/runtime
// code. Gzip is for each whole bundle, not a sum of compressed source files.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
const directory = resolve(import.meta.dirname, "../../docs-yield");
const require = createRequire(resolve(directory, "package.json"));
const { build } = await import(pathToFileURL(require.resolve("vite")));
const marked = `export {Marked} from "marked";`;
const highlight = `import core from "highlight.js/lib/core";
import ts from "highlight.js/lib/languages/typescript";
import js from "highlight.js/lib/languages/javascript";
import sh from "highlight.js/lib/languages/bash";
export function highlight(text,language) {
 const h=core.newInstance();
 h.registerLanguage("ts",ts);h.registerLanguage("js",js);h.registerLanguage("sh",sh);
 return h.highlight(text,{language,ignoreIllegals:true}).value;
}`;
const results = [];
for (const [name, source] of [
  ["marked", marked],
  ["highlight-three-languages", highlight],
  ["combined", marked + highlight],
  ["highlight-all-languages", `export {default} from "highlight.js";`]
]) {
  const output = await build({
    root: directory,
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "docs-payload",
        resolveId(id) {
          if (id === "payload") return resolve(directory, "payload.js");
        },
        load(id) {
          if (id === resolve(directory, "payload.js")) return source;
        }
      }
    ],
    build: {
      write: false,
      minify: "esbuild",
      rollupOptions: { input: "payload", preserveEntrySignatures: "strict" }
    }
  });
  const chunks = output.output.filter(x => x.type === "chunk");
  results.push({
    name,
    raw: chunks.reduce((n, c) => n + Buffer.byteLength(c.code), 0),
    gzip: chunks.reduce((n, c) => n + gzipSync(c.code).length, 0),
    modules: chunks
      .flatMap(c => Object.keys(c.modules))
      .map(id => id.replace(resolve(directory, "../.."), "<repo>"))
  });
}
// Shipping-only ablations: remove fake embedded article data in both client
// controls, then replace the pipeline by a trivial result in one. These are
// not parity variants. They isolate removable code from the fake API's corpus.
const savedRoots = process.env.C2_ROOTS,
  savedRegions = process.env.C3_REGIONS;
try {
  process.env.C2_ROOTS = "single";
  for (const name of ["single-code-only", "single-code-only-trivial", "regions"]) {
    process.env.C3_REGIONS = name === "regions" ? "1" : "0";
    const output = await build({
      root: resolve(directory, "stream"),
      configFile: resolve(directory, "compiled/vite.config.mjs"),
      logLevel: "silent",
      plugins: [
        {
          name: "docs-payload-ablation",
          enforce: "pre",
          transform(code, id) {
            if (/\/articles\/[^/]+\.md\?raw$/.test(id)) return 'export default "";';
            if (
              name === "single-code-only-trivial" &&
              /\/article-pipeline(?:__compiler_dep)?\.ts$/.test(id)
            )
              return "export function renderArticle(article){return {html:article.markdown,toc:[],date:article.published}}";
          }
        }
      ],
      build: { write: false, emptyOutDir: false, sourcemap: true }
    });
    const chunks = output.output.filter(x => x.type === "chunk");
    results.push({
      name,
      raw: chunks.reduce((n, c) => n + Buffer.byteLength(c.code), 0),
      gzip: chunks.reduce((n, c) => n + gzipSync(c.code).length, 0)
    });
  }
} finally {
  if (savedRoots === undefined) delete process.env.C2_ROOTS;
  else process.env.C2_ROOTS = savedRoots;
  if (savedRegions === undefined) delete process.env.C3_REGIONS;
  else process.env.C3_REGIONS = savedRegions;
}
const record = process.argv.indexOf("--record");
if (record >= 0) writeFileSync(process.argv[record + 1], JSON.stringify(results, null, 2) + "\n");
console.log(
  JSON.stringify(
    results.map(({ modules, ...sizes }) => sizes),
    null,
    2
  )
);
