import { render } from "@solidjs/web";
import { afterEach, expect, it, vi } from "vitest";
import { flush } from "solid-js";
import App from "../src/app";
import { install, uninstall, root, runScript, steps } from "../../../harness/dashboard/script";

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  uninstall();
});
it("self-checks the original at all 30 parity steps", async () => {
  install();
  const intervals = vi.spyOn(globalThis, "setInterval");
  const clears = vi.spyOn(globalThis, "clearInterval");
  dispose = render(() => <App />, root());
  const snapshots = await runScript();
  expect(snapshots).toHaveLength(30);
  expect(steps).toHaveLength(30);
  dispose();
  dispose = undefined;
  flush();
  for (const result of intervals.mock.results) expect(clears).toHaveBeenCalledWith(result.value);
});
