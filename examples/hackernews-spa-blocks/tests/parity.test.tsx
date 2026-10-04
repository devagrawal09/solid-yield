// Differential parity: the same script against examples/hackernews-spa's App
// and this twin's (client-only, fixture data); the URL and the DOM must be
// identical after every step.
import { firstDifference } from "blocks-example-harness";
import Twin from "../src/app";
import { install, mount, runScript, steps, uninstall } from "./script";

afterEach(uninstall);

it("routes and renders like the original after every step", async () => {
  // A runtime specifier: the original is compiled for the test but is not
  // part of this project's type check (it is typed for @solidjs/web's JSX).
  const originalApp = new URL("../../originals/hackernews-spa/src/app.tsx", import.meta.url)
    .pathname;
  const Original: (props: {}) => unknown = (await import(/* @vite-ignore */ originalApp)).default;
  install("/");
  const a = mount(Original);
  const original = await runScript(a);
  a.dispose();
  uninstall();
  install("/");
  const b = mount(Twin);
  const twin = await runScript(b);
  b.dispose();
  const at = (name: string) => original[steps.findIndex(s => s[0] === name)];
  // the script reaches the states it compares
  expect(at("mount / (loading, then the top feed)")).toContain("top story 1");
  expect(at("a job's story")).toMatch(/^\/stories\/job-3\n/);
  expect(at("a job's story")).toContain("A reply");
  expect(at("collapse the first thread")).toContain("[+] comments collapsed");
  expect(at("a commenter")).toContain("User : alice");
  expect(at("Show page 2 (last page)")).toContain("page 2");
  const names: [string, () => void][] = steps.map(([name]) => [name, () => {}]);
  expect(firstDifference(names, original, twin)).toBe(null);
}, 120_000);
