import { deferred } from "./stryker-deferred.config.mjs";
// Bounded fallback: callback/catch lowering, generator hosts and source maps.
// Reuse the interrupted full-scope incremental report, with the same tests.
export default {
  ...deferred("vite"),
  mutate: [
    "packages/vite-plugin-yield/src/native-effects.js",
    "packages/vite-plugin-yield/src/sugar.js",
    "packages/vite-plugin-yield/src/positions.js",
    "packages/vite-plugin-yield/src/transform.js"
  ],
  tempDirName: ".stryker-tmp-vite-heart"
};
