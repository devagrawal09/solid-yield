import { hydrate, component, view } from "solid-yield";
import { h } from "solid-yield/h";

import { execFileSync } from "node:child_process";

declare const __DEV__: boolean;

it("the chat review's one-element fixture needs the server hydration script", () => {
  const App = component(function* App() {
    return view(function* () {
      return h("p", {}, "hello");
    });
  });
  const root = document.createElement("div");
  root.innerHTML = '<p _hk="0">hello</p>';
  delete (globalThis as any)._$HY;
  expect(() => hydrate(App, root)).toThrow(
    __DEV__
      ? /\[NO_HYDRATION_SCRIPT\].*generateHydrationScript\(\).*server render/
      : /Cannot read properties of undefined \(reading 'done'\)/
  );
});

it("the server build supplies the script; the client build supplies none", async () => {
  const { generateHydrationScript } = await import("@solidjs/web");
  expect(generateHydrationScript()).toBe("");
  const html = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'import { generateHydrationScript } from "@solidjs/web"; process.stdout.write(generateHydrationScript());'
    ],
    { encoding: "utf8" }
  );
  const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
  new Function("window", "document", script)(globalThis, document);
  const root = document.createElement("div");
  const dispose = hydrate(() => h("p", {}, "hello"), root);
  expect(root.textContent).toBe("hello");
  dispose();
  await Promise.resolve();
  delete (globalThis as any)._$HY;
});
