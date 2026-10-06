// @ts-check
/**
 * `babelPluginYield`: the rule (and the `lazy()` module-URL pass) as a Babel
 * plugin, for a Babel pipeline (`@solidjs/vite-plugin`'s `babel` option, a
 * Babel-only build). Run it before the JSX transform. Options:
 * `yieldModule` (default `solid-yield`), `lazy` (default `true`).
 *
 * `file.metadata.solidYield` records what changed: `{ holes, lazy }` (booleans).
 */
import { DEFAULT_YIELD_MODULE, applyYieldRule } from "./rule.js";
import { applyLazyModuleUrl } from "./lazy.js";

/**
 * @param {typeof import("@babel/core")} api
 * @param {{ yieldModule?: string; lazy?: boolean }} [options]
 * @returns {import("@babel/core").PluginObj}
 */
export default function babelPluginYield(api, options = {}) {
  const t = api.types;
  const yieldModule = options.yieldModule ?? DEFAULT_YIELD_MODULE;
  const lazy = options.lazy ?? true;
  return {
    name: "solid-yield",
    visitor: {
      Program(program, state) {
        const holes = applyYieldRule(program, t, yieldModule);
        const annotated =
          lazy && state.filename ? applyLazyModuleUrl(program, t, yieldModule) : false;
        Object.assign(state.file.metadata, { solidYield: { holes, lazy: annotated } });
      }
    }
  };
}
