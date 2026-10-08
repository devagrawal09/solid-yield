// Analysis parses authored modules without depending on the Vite adapter.
import babel from "@babel/core";
/** @param {string} code @param {string} filename */
export function parseProgram(code, filename) {
  const ext = /\.([mc]?[jt]sx?)$/i.exec(filename)?.[1].toLowerCase().replace(/^[mc]/, "") ?? "js";
  /** @type {import("@babel/core").ParserOptions["plugins"]} */
  const plugins = ["decorators"];
  if (ext !== "ts") plugins.push("jsx");
  if (ext === "ts" || ext === "tsx") plugins.push("typescript");
  const ast = babel.parseSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    sourceType: "module",
    parserOpts: { plugins }
  });
  if (!ast) return null;
  /** @type {import("@babel/core").NodePath<import("@babel/core").types.Program> | null} */
  let program = null;
  babel.traverse(ast, {
    Program(path) {
      program = path;
      path.stop();
    }
  });
  return program;
}
