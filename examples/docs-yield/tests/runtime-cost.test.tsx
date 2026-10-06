import { costApp, costMode, timed } from "yield-example-harness";
import { install, runScript, uninstall } from "./script";

afterEach(uninstall);
it.runIf(costMode)(
  "runtime cost (twins.mjs)",
  async () => {
    install();
    if (costApp() === "original")
      await import(
        /* @vite-ignore */ new URL("../../originals/docs/src/main.tsx", import.meta.url).pathname
      );
    else await import("../src/main");
    await timed("script", () => runScript());
  },
  120_000
);
