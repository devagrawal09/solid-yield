// A fixture for the lazy() module-URL pass (test/lazy.test.js): the library's
// `lazy`, code-split, with and without the options bag.
import { lazy } from "@solidjs/blocks";

export const LazyCard = lazy(() => import("./Card"), { export: "Card" });
export const LazyPage = lazy(() => import("./Page"));
