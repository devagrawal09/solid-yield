// Runtime cost (D-017; yield-library.md §8): this twin's parity script against one app,
// the original or the twin (YIELD_COST_APP), timed by phase. Run by
// examples/harness/runtime-cost/twins.mjs on production builds, one app per process;
// skipped in an ordinary test run (the gate).
import { costApp, costMode, timed } from "yield-example-harness";
import Twin from "../src/app";
import { install, mount, runScript, uninstall } from "./script";

afterEach(uninstall);

it.runIf(costMode)(
  "runtime cost (twins.mjs)",
  async () => {
    const Original: ((props: {}) => unknown) | undefined =
      costApp() === "original"
        ? (
            await import(
              /* @vite-ignore */ new URL(
                "../../originals/hackernews-spa/src/app.tsx",
                import.meta.url
              ).pathname
            )
          ).default
        : undefined;
    install("/");
    const app = await timed("mount", () => mount(Original ?? Twin));
    await timed("script", () => runScript(app));
    app.dispose();
  },
  120_000
);
