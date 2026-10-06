// @ts-check
/**
 * `vite-plugin-solid-yield` (published as `vite-plugin-solid-yield`,
 * D-011): the JSX transform's one yield rule for `solid-yield`, as a Vite
 * plugin (the default export), a Babel plugin and a plain `transform()`. See
 * `documentation/yield-library.md` §5.
 */
export { default, default as solidYield } from "./vite.js";
export { default as babelPluginYield } from "./babel.js";
export { transform, parserPlugins } from "./transform.js";
export { LAZY_PLACEHOLDER_PREFIX, lazyCalls, applyLazyModuleUrl } from "./lazy.js";
export {
  REFUSALS,
  DEFAULT_YIELD_MODULE,
  YieldRuleError,
  yieldRule,
  applyYieldRule
} from "./rule.js";
