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
import { DEFAULT_YIELD_MODULE } from "./rule.js";
import { mayTransform, transform } from "./transform.js";

const SCRIPT = /\.[mc]?[jt]sx?$/i;

/**
 * @typedef {object} YieldPluginOptions
 * @property {string} [yieldModule] the module `perform` and `lazy` come from (default `solid-yield`)
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
  const yieldModule = options.yieldModule ?? DEFAULT_YIELD_MODULE;
  const lazy = options.lazy ?? true;
  const filter = options.filter ?? defaultFilter;
  return {
    name: "vite-plugin-solid-yield",
    enforce: "pre",
    transform(code, id) {
      if (id.startsWith("\0")) return null;
      const file = id.replace(/[?#].*$/, "");
      if (!filter(file)) return null;
      if (!mayTransform(code, yieldModule, lazy)) return null;
      return transform(code, { filename: file, yieldModule, lazy });
    }
  };
}
