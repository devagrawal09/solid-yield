// @ts-check
/**
 * `babelPluginBlocks`: the rule (and the `lazy()` module-URL pass) as a Babel
 * plugin, for a Babel pipeline (`@solidjs/vite-plugin`'s `babel` option, a
 * Babel-only build). Run it before the JSX transform. Options:
 * `blocksModule` (default `solid-blocks`), `lazy` (default `true`).
 *
 * `file.metadata.blocks` records what changed: `{ holes, lazy }` (booleans).
 */
import { DEFAULT_BLOCKS_MODULE, applyBlocksRule } from "./rule.js";
import { applyLazyModuleUrl } from "./lazy.js";

/**
 * @param {typeof import("@babel/core")} api
 * @param {{ blocksModule?: string; lazy?: boolean }} [options]
 * @returns {import("@babel/core").PluginObj}
 */
export default function babelPluginBlocks(api, options = {}) {
  const t = api.types;
  const blocksModule = options.blocksModule ?? DEFAULT_BLOCKS_MODULE;
  const lazy = options.lazy ?? true;
  return {
    name: "solid-blocks",
    visitor: {
      Program(program, state) {
        const holes = applyBlocksRule(program, t, blocksModule);
        const annotated =
          lazy && state.filename ? applyLazyModuleUrl(program, t, blocksModule) : false;
        Object.assign(state.file.metadata, { blocks: { holes, lazy: annotated } });
      }
    }
  };
}
