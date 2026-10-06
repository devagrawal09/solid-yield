/**
 * Mutants shared by the server and hydrate environments' self-tests, so the
 * hydrate self-test hydrates a mutant's own pinned server output.
 */
import { mutate } from "../harness/mutate.js";
import { loadingFallbackHydration } from "./index.js";

/**
 * D-092: loading-fallback-hydration with its fallback written as JSX, an
 * argument built in the holding view's hole on both sides, shown or not.
 */
export const jsxFallback = mutate(loadingFallbackHydration, [
  [
    'fallback: function* () {\n              return <p class="loading">loading</p>;\n            },',
    'fallback: <p class="loading">loading</p>,'
  ]
]);
