// @ts-check
/**
 * `solidYield(options)`: the Vite plugin. Put it before `solid()`:
 *
 *   plugins: [solidYield(), solid()]
 *
 * It runs `enforce: "pre"`, so by the time the JSX compiler sees a module
 * every `yield*` in JSX is already `perform(…)`, and every `lazy(() =>
 * import("…"))` from the yield module carries the module-URL placeholder that
 * `solid()` resolves (D-047). A module whose source has no `yield` at all
 * and no `lazy` from the yield module is skipped without being parsed (the
 * same cheap check as `transform()`'s own: the generator's spelling —
 * `function*`, `function *`, a `*method()` — does not matter, and a `yield`
 * in a string or a comment only costs a parse); anything else goes through `transform()`,
 * which returns `null` (no change) unless the module has a hole or an
 * eligible `lazy` call. The source map is returned to Vite, which chains it
 * with the JSX compiler's.
 */
import { nativeInclude } from "./selection.js";
import { lowerNativeFile } from "./native.js";
import { isSugar, lowerSugarFile } from "./sugar.js";
import { DEFAULT_YIELD_MODULE } from "./rule.js";
import { mayTransform, transform } from "./transform.js";

const SCRIPT = /\.[mc]?[jt]sx?$/i;

/**
 * @typedef {object} YieldPluginOptions
 * @property {string} [yieldModule] the module `perform` and `lazy` come from (default `solid-yield`)
 * @property {"native" | "explicit"} [mode] native Solid front end (opt-in)
 * @property {string[] | ((file: string) => boolean)} [include] required native file selection
 * @property {"source" | "lowered"} [emit] what a native file ships as: the authored Solid source
 *   (default; the lowering is the checker's model, D-120) or the lowered library code
 * @property {boolean} [lazy] annotate `lazy(() => import("…"))` from the yield module with its module URL (default `true`)
 * @property {(file: string) => boolean} [filter] which files to look at (default: `.js`/`.jsx`/`.ts`/`.tsx` and their `m`/`c` forms, outside `node_modules`)
 */

/** @param {string} file */
function defaultFilter(file) {
  return SCRIPT.test(file) && !file.includes("/node_modules/");
}

/**
 * @param {YieldPluginOptions} [options]
 * @returns {import("vite").Plugin}
 */
export default function solidYield(options = {}) {
  if (options.mode === "native" && !options.include)
    throw new Error("[NATIVE_INCLUDE] Native mode requires an explicit include(file) predicate.");
  const yieldModule = options.yieldModule ?? DEFAULT_YIELD_MODULE;
  const lazy = options.lazy ?? true;
  const filter = options.filter ?? defaultFilter;
  const sugarCache = new Map();
  let include = typeof options.include === "function" ? options.include : undefined;
  return {
    configResolved(config) {
      if (options.mode === "native" && options.include)
        include = nativeInclude(config.root, options.include);
    },
    buildStart() {
      sugarCache.clear();
    },
    watchChange() {
      sugarCache.clear();
    },
    handleHotUpdate() {
      sugarCache.clear();
    },
    name: "vite-plugin-solid-yield",
    enforce: "pre",
    transform(code, id) {
      if (id.startsWith("\0")) return null;
      const file = id.replace(/[?#].*$/, "");
      if (!filter(file)) return null;
      if (options.mode === "native" && include?.(file)) {
        // D-120: native mode checks plain Solid (`solid-yield check`, the
        // editor plugin) and ships it as written. The lowered code would add
        // the library's runtime for nothing until it lowers all the way to an
        // optimized output; it ships only on request, as the parity harnesses
        // run it against the original.
        if (options.emit !== "lowered") return null;
        code = lowerNativeFile(code, file, include, sugarCache, diagnostic =>
          this.warn({
            message: `[${diagnostic.code}] ${diagnostic.message}`,
            id: diagnostic.file,
            loc: { file: diagnostic.file, line: diagnostic.line, column: diagnostic.column - 1 }
          })
        );
        const result = transform(code, { filename: file, yieldModule, lazy });
        return { code: result?.code ?? code, map: null };
      }
      if (isSugar(code)) {
        code = lowerSugarFile(code, file, sugarCache);
        const result = transform(code, { filename: file, yieldModule, lazy });
        return { code: result?.code ?? code, map: null };
      }
      if (!mayTransform(code, yieldModule, lazy)) return null;
      return transform(code, { filename: file, yieldModule, lazy });
    }
  };
}
