import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { populateGlobal } from "vitest/runtime";
import solidYield from "../../../packages/vite-plugin-yield/src/vite.js";
// The native edge example, run as plain Solid and as its native lowering: the
// same scripted interactions, a DOM snapshot after each.
const root = resolve(import.meta.dirname, "../../..");
const here = import.meta.dirname;
const app = join(here, "app") + "/";
const entry = join(here, ".native-generated/edges-entry.tsx");
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const vite = await import(pathToFileURL(require.resolve("vite")).href);
const solid = require("@solidjs/vite-plugin").default;

async function record(mode) {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', {
    url: "http://localhost",
    pretendToBeVisual: true
  });
  const populated = populateGlobal(globalThis, dom.window, { bindFunctions: true });
  delete globalThis.Solid$$;
  const logs = [];
  const warn = vi.spyOn(console, "warn").mockImplementation((...args) => logs.push(args.join(" ")));
  const error = vi
    .spyOn(console, "error")
    .mockImplementation((...args) => logs.push(args.join(" ")));
  const server = await vite.createServer({
    root: here,
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { dedupe: ["solid-yield", "solid-js", "@solidjs/web"] },
    plugins: [
      {
        name: "edges:entry",
        enforce: "pre",
        resolveId(id) {
          if (id === "/edges-entry.tsx") return entry;
        },
        load(id) {
          if (id === entry)
            return `
            import {App} from ${JSON.stringify(join(app, "App.tsx"))};
            import {render} from ${JSON.stringify(mode === "native" ? "solid-yield" : "@solidjs/web")};
            export const mount=()=>render(App,document.getElementById("root"));
          `;
          if (id.includes("/vite/dist/client/client.mjs"))
            return "export const createHotContext=()=>({accept(){},acceptExports(){},dispose(){},prune(){},on(){},off(){},invalidate(){},data:{}});";
        }
      },
      ...(mode === "native"
        ? [solidYield({ mode: "native", emit: "lowered", include: file => file.startsWith(app) })]
        : []),
      solidYield(),
      solid({ ssr: true, hot: false, solid: { hydratable: true } })
    ],
    environments: {
      hydrate: {
        consumer: "client",
        optimizeDeps: { noDiscovery: true, include: [] },
        dev: {
          moduleRunnerTransform: true,
          createEnvironment: (name, config) =>
            vite.createRunnableDevEnvironment(name, config, { runnerOptions: { hmr: false } })
        }
      }
    }
  });
  let dispose;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  try {
    const client = await server.environments.hydrate.runner.import("/edges-entry.tsx");
    const snapshots = [],
      steps = [];
    const at = selector => {
      const found = document.querySelector(selector);
      assert.ok(found, `${mode}: ${selector} is rendered`);
      return found;
    };
    const choose = value => {
      const select = at("select");
      select.value = value;
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    };
    const step = async (name, act, ms) => {
      await act();
      await vi.advanceTimersByTimeAsync(ms);
      steps.push([name]);
      snapshots.push(document.getElementById("root").innerHTML);
    };
    await step("mount", () => (dispose = client.mount()), 0);
    await step("rows loaded", () => {}, 10);
    await step("reload from a row's callback prop", () => at("button.reload").click(), 10);
    await step("raise the memo filter's minimum", () => at("button.raise").click(), 0);
    await step("choose the week (setter in a plain type)", () => choose("7d"), 0);
    await step("week loaded", () => {}, 10);
    await step("clock tick", () => {}, 1000);
    await step("clock tick again", () => {}, 1000);
    await step("choose nothing: the panel's Errored shows", () => choose("none"), 10);
    const tab = name =>
      [...document.querySelectorAll("button.tab")].find(b => b.textContent === name).click();
    await step("open the streams tab (a factory's context setter)", () => tab("streams"), 0);
    await step("board loaded (a derived store)", () => {}, 10);
    await step("stream arrivals (an async iterable memo)", () => {}, 350);
    await step(
      "next round (the derived store refetches)",
      () => at("button.next-round").click(),
      0
    );
    await step("round loaded", () => {}, 10);
    await step("back to the rows tab", () => tab("rows"), 0);
    dispose();
    dispose = undefined;
    const timersAfterDispose = vi.getTimerCount();
    assert.deepEqual(logs, []);
    return { snapshots, steps, timersAfterDispose };
  } finally {
    dispose?.();
    vi.useRealTimers();
    await server.close();
    warn.mockRestore();
    error.mockRestore();
    document.body.innerHTML = "";
    dom.window.close();
    for (const key of populated.keys) delete globalThis[key];
    for (const [key, value] of populated.originals) globalThis[key] = value;
  }
}

it("records the native edge example", async () => {
  const mode = process.env.NATIVE_EDGES_MODE;
  assert.ok(mode === "native" || mode === "original");
  const result = await record(mode);
  const output = process.env.NATIVE_EDGES_OUTPUT;
  assert.ok(output);
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(output, JSON.stringify(result));
});
