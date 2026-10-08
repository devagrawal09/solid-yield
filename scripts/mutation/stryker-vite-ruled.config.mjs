import { deferred } from "./stryker-deferred.config.mjs";
// Further bounded fallback: callback/catch lowering and position mapping.
// Sugar remains partial; no full sugar score is claimed.
export default {
  ...deferred("vite"),
  mutate: [
    "packages/vite-plugin-yield/src/native-effects.js",
    "packages/vite-plugin-yield/src/positions.js",
    "packages/vite-plugin-yield/src/transform.js"
  ],
  tempDirName: ".stryker-tmp-vite-ruled"
};
