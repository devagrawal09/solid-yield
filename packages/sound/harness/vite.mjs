// @ts-check
// The Vite surface, shared by both prototypes: wraps any CONTRACT.md checker.
//
// Severity policy (user decision): errors show the dev-server overlay but the
// server keeps serving; `vite build` fails on errors; warnings (including the
// partial-check UNANALYZED_BOUNDARY) never fail anything; info is structured
// channel only (exposed through `onResult`).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { consoleFace } from "../src/codes.mjs";
import { compilerOptions } from "./compiler-options.mjs";

/** @typedef {import("../src/types.d.ts").Prototype} Prototype */
/** @typedef {import("../src/types.d.ts").SoundDiagnostic} SoundDiagnostic */
/** @typedef {import("../src/types.d.ts").CheckResult} CheckResult */

/**
 * @param {Prototype} prototype
 * @param {{
 *   rootDir: string,
 *   files: readonly string[],
 *   errorsFailBuild?: boolean,
 *   onResult?: (phase: "cold" | "hmr", result: CheckResult, timings: { checkMs: number, file?: string }) => void
 * }} options
 * @returns {import("vite").Plugin}
 */
export function soundVitePlugin(prototype, options) {
  /** @type {import("../src/types.d.ts").Checker | null} */
  let checker = null;
  /** @type {import("vite").ViteDevServer | null} */
  let server = null;
  let isBuild = false;
  const errorsFailBuild = options.errorsFailBuild ?? true;
  const files = options.files.map(f => resolve(options.rootDir, f));

  /** @param {SoundDiagnostic} d */
  const format = d => `${d.loc.file.replace(options.rootDir + "/", "")}:${d.loc.line}:${d.loc.col} ${consoleFace(d)}`;

  /** @param {CheckResult} result @param {"cold" | "hmr"} phase */
  const publish = (result, phase) => {
    const errors = result.diagnostics.filter(d => d.severity === "error");
    const warnings = result.diagnostics.filter(d => d.severity === "warn");
    for (const w of warnings) console.warn(`[solid-sound:${prototype.name}] warn ${format(w)}`);
    for (const e of errors) console.error(`[solid-sound:${prototype.name}] error ${format(e)}`);
    if (server && errors.length) {
      // The overlay shows the first error (Vite's payload is one error); the console has them all. The server keeps serving.
      const first = errors[0];
      server.hot.send({ type: "error", err: { message: `[${first.code}] ${first.message}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}`, stack: "", id: first.loc.file, loc: { file: first.loc.file, line: first.loc.line, column: first.loc.col }, plugin: `solid-sound:${prototype.name}` } });
    }
    return { errors, warnings };
  };

  return {
    name: `solid-sound:${prototype.name}`,
    enforce: "pre",
    configResolved(config) { isBuild = config.command === "build"; },
    configureServer(s) { server = s; },
    buildStart() {
      const t0 = performance.now();
      checker = prototype.createChecker({ rootDir: options.rootDir, files, compilerOptions });
      const result = checker.check();
      const checkMs = performance.now() - t0;
      options.onResult?.("cold", result, { checkMs });
      const { errors } = publish(result, "cold");
      if (isBuild && errorsFailBuild && errors.length) {
        // All errors were logged above; the build fails on the first (vite build's exit code is what matters).
        this.error(`[solid-sound:${prototype.name}] ${errors.length} error(s); first: ${format(errors[0])}`);
      }
    },
    handleHotUpdate(ctx) {
      if (!checker || !files.includes(ctx.file)) return;
      const t0 = performance.now();
      const text = existsSync(ctx.file) ? readFileSync(ctx.file, "utf8") : "";
      const result = checker.update(ctx.file, text);
      const checkMs = performance.now() - t0;
      options.onResult?.("hmr", result, { checkMs, file: ctx.file });
      publish(result, "hmr");
    },
    buildEnd() { checker?.dispose(); checker = null; }
  };
}
