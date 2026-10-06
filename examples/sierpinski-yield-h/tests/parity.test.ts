// Differential parity: the same script against examples/sierpinski (its
// main.tsx renders into document.body on import) and against this twin's
// main.tsx; the DOM after every step must be identical.
import { firstDifference } from "yield-example-harness";
import { installClocks, runScript, steps, uninstallClocks } from "./script";

beforeEach(() => {
  document.body.innerHTML = "";
  installClocks();
});
afterEach(() => {
  uninstallClocks();
  document.body.innerHTML = "";
});

it("renders the same DOM as the original after every step", async () => {
  // A runtime specifier: the original is compiled for the test but is not
  // part of this project's type check (it is typed for @solidjs/web's JSX).
  const originalMain = new URL("../../originals/sierpinski/src/main.tsx", import.meta.url).pathname;
  await import(/* @vite-ignore */ originalMain);
  const original = await runScript();
  uninstallClocks();
  document.body.innerHTML = "";
  installClocks();
  await import("../src/main");
  const twin = await runScript();
  // the script reaches the states it compares
  expect(original[0]).toBe("Loading...");
  expect(original[1]).toContain(">0</div>");
  expect(original[4]).toContain("**1**");
  expect(original[7]).toContain(">5</div>");
  expect(original[10]).toContain(">3</div>");
  expect(firstDifference(steps, original, twin)).toBe(null);
}, 120_000);
