// @ts-check
// The one TypeScript configuration every prototype checks under (rc.17 types
// resolve from packages/sound/node_modules).
import ts from "typescript";

/** @type {import("typescript").CompilerOptions} */
export const compilerOptions = Object.freeze({
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.Preserve,
  jsxImportSource: "@solidjs/web",
  types: [],
  lib: ["lib.esnext.d.ts", "lib.dom.d.ts"]
});
