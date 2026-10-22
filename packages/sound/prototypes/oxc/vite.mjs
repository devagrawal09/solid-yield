// @ts-check
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { consoleFace } from "../../src/codes.mjs";
import { createChecker } from "./index.mjs";
// No dependency on the shared compiler-options module (which loads another checker).
export function oxcVitePlugin(options) {
  const files = options.files.map(path => resolve(options.rootDir, path));
  let checker;
  let server;
  let building = false;
  function publish(result, phase, start) {
    options.onResult?.(phase, result, { checkMs: performance.now() - start });
    const errors = result.diagnostics.filter(d => d.severity === "error");
    for (const d of result.diagnostics)
      if (d.severity !== "info") {
        const message =
          "[solid-sound:oxc] " +
          d.loc.file +
          ":" +
          d.loc.line +
          ":" +
          d.loc.col +
          " " +
          consoleFace(d);
        if (d.severity === "error") console.error(message);
        else console.warn(message);
      }
    if (server && errors.length) {
      const d = errors[0];
      server.hot.send({
        type: "error",
        err: {
          message: "[" + d.code + "] " + d.message,
          stack: "",
          id: d.loc.file,
          loc: { file: d.loc.file, line: d.loc.line, column: d.loc.col },
          plugin: "solid-sound:oxc"
        }
      });
    }
    return errors;
  }
  return {
    name: "solid-sound:oxc",
    enforce: "pre",
    configResolved(config) {
      building = config.command === "build";
    },
    configureServer(value) {
      server = value;
    },
    buildStart() {
      checker?.dispose();
      const start = performance.now();
      checker = createChecker({ rootDir: options.rootDir, files });
      const errors = publish(checker.check(), "cold", start);
      if (building && options.errorsFailBuild !== false && errors.length)
        this.error("[solid-sound:oxc] " + errors.length + " error(s).");
    },
    handleHotUpdate(ctx) {
      if (checker && files.includes(ctx.file)) {
        const start = performance.now();
        publish(checker.update(ctx.file, readFileSync(ctx.file, "utf8")), "hmr", start);
      }
    },
    buildEnd() {
      if (building) {
        checker?.dispose();
        checker = undefined;
      }
    },
    closeBundle() {
      checker?.dispose();
      checker = undefined;
    }
  };
}
export default oxcVitePlugin;
