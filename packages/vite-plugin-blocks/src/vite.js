// @ts-check
/**
 * `blocks(options)`: the Vite plugin. Put it before `solid()`:
 *
 *   plugins: [blocks(), solid()]
 *
 * It runs `enforce: "pre"`, so by the time the JSX compiler sees a module
 * every `yield*` in JSX is already `perform(…)`, and every `lazy(() =>
 * import("…"))` from the blocks module carries the module-URL placeholder that
 * `solid()` resolves (D-047). A module whose source has no `function*` (a
 * `yield` exists only in a generator) and no `lazy` from the blocks module is
 * skipped without being parsed; anything else goes through `transform()`,
 * which returns `null` (no change) unless the module has a hole or an
 * eligible `lazy` call. The source map is returned to Vite, which chains it
 * with the JSX compiler's.
 */
import { DEFAULT_BLOCKS_MODULE } from "./rule.js";
import { transform } from "./transform.js";

const SCRIPT = /\.[mc]?[jt]sx?$/i;

/**
 * @typedef {object} BlocksPluginOptions
 * @property {string} [blocksModule] the module `perform` and `lazy` come from (default `@solidjs/blocks`)
 * @property {boolean} [lazy] annotate `lazy(() => import("…"))` from the blocks module with its module URL (default `true`)
 * @property {(file: string) => boolean} [filter] which files to look at (default: `.js`/`.jsx`/`.ts`/`.tsx` and their `m`/`c` forms, outside `node_modules`)
 */

/** @param {string} file */
function defaultFilter(file) {
  return SCRIPT.test(file) && !file.includes("/node_modules/");
}

/**
 * @param {BlocksPluginOptions} [options]
 * @returns {import("vite").Plugin}
 */
export default function blocks(options = {}) {
  const blocksModule = options.blocksModule ?? DEFAULT_BLOCKS_MODULE;
  const lazy = options.lazy ?? true;
  const filter = options.filter ?? defaultFilter;
  return {
    name: "vite-plugin-solid-blocks",
    enforce: "pre",
    transform(code, id) {
      if (id.startsWith("\0")) return null;
      const file = id.replace(/[?#].*$/, "");
      if (!filter(file)) return null;
      const lazyCandidate = lazy && code.includes("lazy") && code.includes(blocksModule);
      if (!code.includes("function*") && !lazyCandidate) return null;
      return transform(code, { filename: file, blocksModule, lazy });
    }
  };
}
