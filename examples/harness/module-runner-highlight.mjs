import { buildSync } from "esbuild";
// highlight.js's ESM core delegates to a standalone CommonJS file. Vite's
// browser module runner has no CommonJS loader. Adapt only that export here;
// production builds keep Vite's normal CommonJS transform and tree shaking.
export function highlightCoreForModuleRunner(code, id) {
  // diff2html imports a CommonJS template engine. Bundle just this dependency
  // for Vite's browser module runner; production builds use Vite normally.
  if (/\/diff2html\/lib(?:-esm)?\/diff2html\.js$/.test(id))
    return buildSync({
      entryPoints: [id],
      bundle: true,
      platform: "browser",
      format: "esm",
      write: false,
      minify: false
    }).outputFiles[0].text;
  if (!id.endsWith("/highlight.js/lib/core.js")) return;
  if (!code.includes("module.exports = highlight;") || code.includes("require("))
    throw new Error("Review the highlight.js module-runner export adapter");
  return code.replace("module.exports = highlight;", "export default highlight;");
}
