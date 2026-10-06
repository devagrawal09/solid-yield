// Differential parity: the same script against examples/rendering's shared
// App and this twin's, rendered client-side (the CSR variant); the DOM must be
// identical after every step (`createUniqueId` values normalized — see
// tests/script.ts).
import { firstDifference } from "yield-example-harness";
import Twin from "../shared/src/components/App";
import { install, mount, runScript, steps, uninstall } from "./script";

afterEach(uninstall);

it("renders every route like the original after every step", async () => {
  // A runtime specifier: the original is compiled for the test but is not
  // part of this project's type check (it is typed for @solidjs/web's JSX).
  const originalApp = new URL(
    "../../originals/rendering/shared/src/components/App.tsx",
    import.meta.url
  ).pathname;
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
  expect(at("Home ticks")).toContain("<span>10</span>");
  expect(at("profile data")).toContain("Jon's Profile");
  expect(at("profile data")).toContain("Or maybe not");
  expect(at("type")).toContain("<p>Hello yield</p>");
  expect(at("logical click inside the portal")).toContain("Portal logical clicks: 1");
  expect(at("all items")).toContain("5: Fifth item");
  expect(at("items settle / fail")).toContain("ItemError: Error: Item bad-item not found");
  expect(at("cards reveal (sequential)")).toContain("C resolved in 1700ms");
  expect(at("refetched")).toMatch(/Shipped release #\d/);
  const names: [string, () => void][] = steps.map(([name]) => [name, () => {}]);
  expect(firstDifference(names, original, twin)).toBe(null);
}, 120_000);
