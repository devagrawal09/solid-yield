// Differential parity: the same script against examples/effect (its
// `main.tsx` renders into `#root` on import) and against this twin's
// `main.tsx`; the DOM must be identical after every step. Each app has its
// own copies of `log.ts` / `api.ts`, imported under the same fake clock.
import { firstDifference } from "yield-example-harness";
import { install, runScript, steps, uninstall } from "./script";

afterEach(uninstall);

describe("effect parity", () => {
  it("renders the same DOM as the original after every step", async () => {
    install();
    const originalMain = new URL("../../originals/effect/src/main.tsx", import.meta.url).pathname;
    await import(/* @vite-ignore */ originalMain);
    const original = await runScript();
    uninstall();
    install();
    await import("../src/main");
    const twin = await runScript();
    // The script reaches the states it is meant to compare.
    const at = (name: string) => original[steps.findIndex(s => s[0] === name)];
    expect(at("type s")).toContain("Searching…");
    expect(at("so lands")).toContain("pkg-name");
    expect(at("so lands")).toContain('search "s" interrupted');
    expect(at("halfway")).toContain("results stale");
    expect(at("zzz lands (no matches)")).toContain("No packages match");
    expect(at("retries give up")).toContain("Search gave up after retries");
    expect(at("orders load")).toContain("No orders yet.");
    expect(at("reserving done, charging")).toContain("Cancel checkout");
    expect(at("orders refresh")).toContain("ord_");
    expect(at("compensations run")).toContain("Card declined");
    expect(at("compensations after cancel")).toContain("Checkout cancelled");
    expect(firstDifference(steps, original, twin)).toBe(null);
  }, 60_000);
});
