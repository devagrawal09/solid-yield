// Runtime cost (D-017; yield-library.md §8): this twin's parity script against one app,
// the original or the twin (YIELD_COST_APP), timed by phase. Run by
// examples/harness/runtime-cost/twins.mjs on production builds, one app per process;
// skipped in an ordinary test run (the gate).
import { costApp, costMode, timed } from "yield-example-harness";
import { installClocks, runScript, uninstallClocks } from "./script";

beforeEach(() => {
  document.body.innerHTML = "";
  installClocks();
});
afterEach(() => {
  uninstallClocks();
  document.body.innerHTML = "";
});

it.runIf(costMode)(
  "runtime cost (twins.mjs)",
  async () => {
    // the app renders as its module is evaluated: the mount is not timed (nor the transform)
    if (costApp() === "original")
      await import(
        /* @vite-ignore */ new URL("../../originals/sierpinski/src/main.tsx", import.meta.url)
          .pathname
      );
    else await import("../src/main");
    await timed("script", () => runScript());
  },
  120_000
);
