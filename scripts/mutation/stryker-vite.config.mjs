import { deferred } from "./stryker-deferred.config.mjs";
export default {
  ...deferred("vite"),
  mutate: [
    "packages/vite-plugin-yield/src/native*.js",
    "packages/vite-plugin-yield/src/routines.js",
    "packages/vite-plugin-yield/src/transform.js",
    "packages/vite-plugin-yield/src/positions.js"
  ]
};
