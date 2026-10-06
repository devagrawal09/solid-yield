import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import solidYield from "../../vite-plugin-yield/src/index.js";

const require = createRequire(new URL("../../yield/package.json", import.meta.url));
const viteRequire = createRequire(new URL("../../vite-plugin-yield/package.json", import.meta.url));

const mode = process.env.YIELD_NAMESPACE_MODE;
if (!mode) {
  for (const scenario of ["immediate", "delayed"])
    test(`C2 namespace spike: ${scenario}`, () => {
      const result = spawnSync(process.execPath, ["--test", fileURLToPath(import.meta.url)], {
        encoding: "utf8",
        timeout: 30000,
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(([key]) => key !== "NODE_TEST_CONTEXT")
          ),
          YIELD_NAMESPACE_MODE: scenario
        }
      });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert(result.stdout.includes(`C2 namespace ${scenario}:`), result.stdout + result.stderr);
    });
} else
  test(`C2 namespace ${mode}: ${mode === "delayed" ? "F-C5: second root is silently replaced" : "both roots claim their server nodes"}`, async () => {
    const { createServer, createRunnableDevEnvironment } = await import(
      pathToFileURL(viteRequire.resolve("vite"))
    );
    const solidModule = await import(pathToFileURL(require.resolve("@solidjs/vite-plugin")));
    const solid =
      typeof solidModule.default === "function" ? solidModule.default : solidModule.default.default;
    const { JSDOM } = require("jsdom");
    const { populateGlobal } = await import(pathToFileURL(require.resolve("vitest/runtime")));
    const root = resolve(import.meta.dirname, "..");
    const warnings = [];
    const warn = console.warn;
    console.warn = (...args) => warnings.push(args.map(String).join(" "));
    let dom;
    const disposers = [];
    const server = await createServer({
      root,
      configFile: false,
      appType: "custom",
      logLevel: "silent",
      plugins: [
        {
          name: "namespace-test:no-hmr",
          enforce: "pre",
          applyToEnvironment: environment => environment.name === "hydrate",
          load(id) {
            if (!/\/vite\/dist\/client\/client\.mjs$/.test(id.replace(/\?.*$/, ""))) return;
            return "export const createHotContext=()=>({data:{},accept(){},acceptExports(){},dispose(){},prune(){},decline(){},invalidate(){},on(){},off(){},send(){}});export const updateStyle=()=>{};export const removeStyle=()=>{};export const injectQuery=x=>x;export class ErrorOverlay {}";
          }
        },
        solidYield(),
        solid({ hot: false, ssr: true })
      ],
      server: { middlewareMode: true, hmr: false, ws: false },
      environments: {
        hydrate: {
          consumer: "client",
          optimizeDeps: { noDiscovery: true, include: [] },
          dev: {
            moduleRunnerTransform: true,
            createEnvironment: (name, config) =>
              createRunnableDevEnvironment(name, config, { runnerOptions: { hmr: false } })
          }
        }
      }
    });
    try {
      const ssr = await server.ssrLoadModule("/test/fixtures/roots.tsx");
      const html = ssr.serverDocument();
      dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
        url: "http://localhost",
        pretendToBeVisual: true
      });
      populateGlobal(globalThis, dom.window, { bindFunctions: true });
      const script = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
      document.body.innerHTML = html.replace(script, "");
      for (const match of html.matchAll(script)) (0, eval)(match[1]);
      const first = document.querySelector("#first button"),
        second = document.querySelector("#second button");
      assert(first && second);
      const firstKey = first.getAttribute("_hk"),
        secondKey = second.getAttribute("_hk");
      assert(firstKey?.startsWith("first"));
      assert(secondKey?.startsWith("second"));
      assert.equal(document.querySelector("h1").hasAttribute("_hk"), false);
      const client = await server.environments.hydrate.runner.import("/test/fixtures/roots.tsx");
      disposers.push(client.hydrateRoot("first"));
      assert.equal(document.querySelector("#first button"), first);
      assert.equal(document.querySelector("#second button"), second);
      if (mode === "delayed") await new Promise(r => setTimeout(r, 0));
      disposers.push(client.hydrateRoot("second"));
      const actualSecond = document.querySelector("#second button");
      if (mode === "immediate") assert.equal(actualSecond, second);
      else {
        // A pinned finding, not a passing hydration claim. If Solid fixes this,
        // fail until the finding and C2's status are deliberately updated.
        assert.notEqual(actualSecond, second);
        assert.equal(second.isConnected, false);
      }
      assert.equal(document.querySelector("#first button"), first);
      first.click();
      actualSecond.click();
      await new Promise(r => setTimeout(r, 0));
      assert.equal(first.textContent, "1");
      assert.equal(actualSecond.textContent, "1");
      assert.deepEqual(warnings, []);
    } catch (error) {
      throw new Error(
        `namespace spike: ${error?.message ?? String(error)}; warnings: ${warnings.join("; ")}`,
        { cause: error }
      );
    } finally {
      disposers.forEach(dispose => dispose());
      dom?.window.close();
      console.warn = warn;
      await server.close();
    }
  });
