// Differential parity: the same script against examples/room's App and this
// twin's (client-only, over the in-process fake wire); the DOM — and the
// composer's draft — must be identical after every step.
import { firstDifference } from "yield-example-harness";
import Twin from "../src/app";
import { install, mount, runScript, steps, uninstall } from "./script";

afterEach(uninstall);

it("renders the same DOM as the original after every step", async () => {
  // A runtime specifier: the original is compiled for the test but is not
  // part of this project's type check (it is typed for @solidjs/web's JSX).
  const originalApp = new URL("../../originals/room/src/app.tsx", import.meta.url).pathname;
  const Original: (props: {}) => unknown = (await import(/* @vite-ignore */ originalApp)).default;
  install();
  const a = mount(Original);
  const original = await runScript(a);
  a.dispose();
  uninstall();
  install();
  const b = mount(Twin);
  const twin = await runScript(b);
  b.dispose();
  const at = (name: string) => original[steps.findIndex(s => s[0] === name)];
  // the script reaches the states it compares
  expect(at("shell sources land")).toContain("connection #");
  expect(at("post on /live (optimistic, held for the echo)")).toContain("live post");
  expect(at("the echo lands")).toContain("live post");
  expect(at("live sources reconnect")).toContain("The stream died");
  expect(at("the summary and the archive finish")).toContain("ever in #design");
  expect(at("#infra lands")).toContain("ever in #infra");
  const names: [string, () => void][] = steps.map(([name]) => [name, () => {}]);
  expect(firstDifference(names, original, twin)).toBe(null);
}, 120_000);
