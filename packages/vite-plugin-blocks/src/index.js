// @ts-check
/**
 * `vite-plugin-solid-blocks` (published as `vite-plugin-solid-blocks`,
 * D-011): the JSX transform's one block rule for `solid-blocks`, as a Vite
 * plugin (the default export), a Babel plugin and a plain `transform()`. See
 * `documentation/plans/blocks-library.md` §5.
 */
export { default, default as blocks } from "./vite.js";
export { default as babelPluginBlocks } from "./babel.js";
export { transform, parserPlugins } from "./transform.js";
export { LAZY_PLACEHOLDER_PREFIX, lazyCalls, applyLazyModuleUrl } from "./lazy.js";
export {
  REFUSALS,
  DEFAULT_BLOCKS_MODULE,
  BlocksRuleError,
  blocksRule,
  applyBlocksRule
} from "./rule.js";
