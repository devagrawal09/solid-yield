// Differential parity: the same script against examples/todos (its main.tsx
// renders into #root on import) and against this twin's main.tsx; the DOM
// must be identical after every step. Each app has its own copy of todos.ts
// (module state: the error side-channel), imported under the same fake clock.
import { firstDifference } from "blocks-example-harness";
import { install, runScript, steps, uninstall } from "./script";

afterEach(uninstall);

it("renders the same DOM as the original after every step", async () => {
  install();
  const originalMain = new URL("../../originals/todos/src/main.tsx", import.meta.url).pathname;
  await import(/* @vite-ignore */ originalMain);
  const original = await runScript();
  uninstall();
  install();
  await import("../src/main");
  const twin = await runScript();
  // the script reaches the states it compares
  const at = (name: string) => original[steps.findIndex(s => s[0] === name)];
  expect(at("mount (loading)")).toContain("Loading…");
  expect(at("todos load")).toContain("write blocks");
  expect(at("add a todo (optimistic)")).toContain("pending");
  expect(at("the failure shows a retry")).toContain('class="retry"');
  expect(at("failed add stays with an error")).toContain("doomed");
  expect(firstDifference(steps, original, twin)).toBe(null);
}, 60_000);
