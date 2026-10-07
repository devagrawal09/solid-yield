// Standalone, production-minified renderer payloads. No corpus or Solid runtime.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
const directory = resolve(import.meta.dirname, "../../docs-yield");
const require = createRequire(resolve(directory, "package.json"));
const { build } = await import(pathToFileURL(require.resolve("vite")));
const records = [];
for (const level of ["S", "M", "L"]) {
  const source =
    `export {renderArticle} from "./src/article-pipeline";\n` +
    (level !== "S" ? 'export {renderPost} from "./src/post-pipeline";\n' : "") +
    (level === "L"
      ? 'export {renderApi} from "./src/api-pipeline"; export {renderChangelog} from "./src/changelog-pipeline";'
      : "");
  const languages =
    level === "S"
      ? ["typescript", "javascript", "bash"]
      : ["typescript", "javascript", "bash", "json", "css", "xml", "python", "rust", "go"];
  const libraries =
    'export {Marked} from "marked"; import core from "highlight.js/lib/core";\n' +
    languages
      .map((name, i) => `import l${i} from "highlight.js/lib/languages/${name}";`)
      .join("\n") +
    `export function highlight(text,language){const h=core.newInstance();${languages.map((name, i) => `h.registerLanguage("${name}",l${i});`).join("")}return h.highlight(text,{language,ignoreIllegals:true}).value;}` +
    (level !== "S" ? 'export {renderToString} from "katex";' : "") +
    (level === "L"
      ? 'export {jsonSchemaToZod} from "json-schema-to-zod";export {html} from "diff2html";'
      : "");
  for (const [kind, entry] of [
    ["libraries", libraries],
    ["pipelines", source]
  ])
    for (let run = 1; run <= 3; run++) {
      const result = await build({
        root: directory,
        configFile: false,
        logLevel: "silent",
        plugins: [
          {
            name: "scaling-payload",
            resolveId(id) {
              if (id === "payload") return resolve(directory, "payload.ts");
            },
            load(id) {
              if (id === resolve(directory, "payload.ts")) return entry;
            }
          }
        ],
        build: {
          write: false,
          minify: "esbuild",
          rollupOptions: { input: "payload", preserveEntrySignatures: "strict" }
        }
      });
      const chunks = result.output.filter(c => c.type === "chunk");
      const modules = chunks.flatMap(c =>
        Object.entries(c.modules).map(([id, m]) => ({
          id: id.replace(resolve(directory, "../.."), "<repo>"),
          renderedLength: m.renderedLength
        }))
      );
      records.push({
        level,
        kind,
        run,
        raw: chunks.reduce((n, c) => n + Buffer.byteLength(c.code), 0),
        gzip: chunks.reduce((n, c) => n + gzipSync(c.code).length, 0),
        modules
      });
    }
}
writeFileSync(
  resolve("documentation/compiler-c3c-payloads.json"),
  JSON.stringify(records, null, 2) + "\n"
);
console.log(records.map(({ modules, ...r }) => r));
