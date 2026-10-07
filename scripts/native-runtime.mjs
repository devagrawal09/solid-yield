// A small real SSR/hydration control. This is not todos parity.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import solidYield from "../packages/vite-plugin-yield/src/vite.js";
const root = resolve(import.meta.dirname, "..");
if (!process.argv.includes("--child")) {
  const run = (mode, family = "") =>
    JSON.parse(
      execFileSync(process.execPath, [import.meta.filename, "--child", mode, family], {
        encoding: "utf8",
        timeout: 30000
      })
    );
  const original = run("original"),
    native = run("native");
  assert.deepEqual(native, original);
  assert.deepEqual(native.values, ["2", "4", "6"]);
  assert.equal(native.retained, true);
  const originalAsync = run("original", "Async"),
    nativeAsync = run("native", "Async");
  assert.deepEqual(nativeAsync, originalAsync);
  assert.deepEqual(nativeAsync.values, ["0", "1", "3"]);
  assert.equal(nativeAsync.retained, true);
  console.log("native async helper: SSR and hydrated reads across await match original");
  const originalAction = run("original", "Action"),
    nativeAction = run("native", "Action");
  assert.deepEqual(nativeAction, originalAction);
  assert.deepEqual(nativeAction.values, ["0", "1", "2"]);
  assert.equal(nativeAction.retained, true);
  console.log("native caught generator action: SSR and hydrated rejection/write parity pass");
  console.log("native counter: SSR and hydrated clicks match original; server button retained");
} else {
  const require = createRequire(join(root, "examples/rendering-yield/package.json"));
  const pluginRequire = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
  const vite = await import(pathToFileURL(pluginRequire.resolve("vite")).href);
  const solid = pluginRequire("@solidjs/vite-plugin").default;
  const { JSDOM } = require("jsdom");
  const { populateGlobal } = await import(pathToFileURL(require.resolve("vitest/runtime")).href);
  const fixture = join(root, "packages/vite-plugin-yield/test/fixtures/native-app");
  const logs = [];
  console.warn = (...args) => logs.push(args.join(" "));
  console.error = (...args) => logs.push(args.join(" "));
  const server = await vite.createServer({
    root: fixture,
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      solidYield({
        mode: "native",
        include: file =>
          ["Counter.tsx", "CatchAction.tsx", "AsyncReads.tsx"].some(
            name => file === join(fixture, name)
          )
      }),
      solid({ ssr: true }),
      {
        name: "native-probe:no-hmr",
        enforce: "pre",
        applyToEnvironment: e => e.name === "hydrate",
        load(id) {
          if (id.includes("/vite/dist/client/client.mjs"))
            return "export const createHotContext=()=>({accept(){},acceptExports(){},dispose(){},prune(){},on(){},off(){},invalidate(){},data:{}});";
        }
      }
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
  let dom;
  try {
    const entry = await server.ssrLoadModule("/entry.tsx");
    const mode = process.argv.at(-2),
      family = process.argv.at(-1);
    const html = entry[mode + family]();
    const scripts = entry.generateHydrationScript();
    dom = new JSDOM(`<html><head></head><body><div id="root">${html}</div></body></html>`, {
      url: "http://localhost",
      pretendToBeVisual: true
    });
    populateGlobal(globalThis, dom.window, { bindFunctions: true });
    for (const match of scripts.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) (0, eval)(match[1]);
    const before = document.querySelector("button");
    await server.environments.hydrate.runner.import(
      family === "Async"
        ? mode === "native"
          ? "/async-client.tsx"
          : "/original-async-client.tsx"
        : family
          ? mode === "native"
            ? "/action-client.tsx"
            : "/original-action-client.tsx"
          : mode === "native"
            ? "/client.tsx"
            : "/original-client.tsx"
    );
    const values = [before.textContent];
    for (let i = 0; i < 2; i++) {
      before.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise(r => setTimeout(r, 30));
      values.push(document.querySelector("button").textContent);
    }
    assert.deepEqual(logs, []);
    process.stdout.write(
      JSON.stringify({ values, retained: before === document.querySelector("button") })
    );
  } finally {
    await server.close();
    dom?.window.close();
  }
}
