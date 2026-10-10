import { deferred } from "./stryker-deferred.config.mjs";
export default {
  ...deferred("compiler"),
  mutate: ["packages/compiler-yield/src/failure-inference.js"]
};
