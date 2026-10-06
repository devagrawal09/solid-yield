import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import solidYield from "../../vite-plugin-yield/src/index.js";
import eagerIslands from "../src/eager.js";
import { beginCoverage } from "../../../examples/harness/executed-bytes/coverage.mjs";
const require = createRequire(new URL("../package.json", import.meta.url));
const mode = process.env.C2_DOCS_MODE;
if (!mode) {
  test("tier 1 docs: original, library and emitted roots match all 24 hydrated steps", () => {
    const results = [];
    for (const route of ["original", "library", "compiled"]) {
      const child = spawnSync(process.execPath, ["--test", fileURLToPath(import.meta.url)], {
        encoding: "utf8",
        timeout: 60000,
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(([k]) => k !== "NODE_TEST_CONTEXT")
          ),
          C2_DOCS_MODE: route
        }
      });
      assert.equal(child.status, 0, child.stdout + child.stderr);
      const line = child.stdout.split("\n").find(x => x.includes("C2_RESULT "));
      results.push(JSON.parse(line.slice(line.indexOf("C2_RESULT ") + 10)));
      if (process.env.C2_DUMP)
        writeFileSync(resolve(tmpdir(), `c2-${route}.json`), JSON.stringify(results.at(-1)));
    }
    assert.equal(results[0].snapshots.length, 24);
    assert.deepEqual(results[1].snapshots, results[0].snapshots, "library vs original");
    for (let i = 0; i < results[1].snapshots.length; i++) {
      const a = results[2].snapshots[i],
        b = results[1].snapshots[i];
      if (a === b) continue;
      let at = 0;
      while (a[at] === b[at]) at++;
      assert.fail(
        `compiled vs library step ${i}, character ${at}\ncompiled: ${a.slice(at - 90, at + 200)}\nlibrary: ${b.slice(at - 90, at + 200)}`
      );
    }
    assert.equal(results[2].roots, 7);
  });
  for (const url of ["/docs/start"])
    test(`tier 1 direct SSR/hydrate ${url}`, () => {
      const snapshots = [];
      for (const route of ["original", "library", "compiled"]) {
        const child = spawnSync(process.execPath, ["--test", fileURLToPath(import.meta.url)], {
          encoding: "utf8",
          timeout: 60000,
          env: {
            ...Object.fromEntries(
              Object.entries(process.env).filter(([k]) => k !== "NODE_TEST_CONTEXT")
            ),
            C2_DOCS_MODE: route,
            C2_URL: url,
            C2_SMOKE: "1"
          }
        });
        assert.equal(child.status, 0, child.stdout + child.stderr);
        const line = child.stdout.split("\n").find(x => x.includes("C2_RESULT "));
        snapshots.push(JSON.parse(line.slice(line.indexOf("C2_RESULT ") + 10)).snapshots);
      }
      assert.deepEqual(snapshots[1], snapshots[0]);
      assert.deepEqual(snapshots[2], snapshots[1]);
    });
  test("F-C9 finding: direct failed SSR loses the typed error on all three routes (not a passing smoke)", () => {
    for (const route of ["original", "library", "compiled"]) {
      const child = spawnSync(process.execPath, ["--test", fileURLToPath(import.meta.url)], {
        encoding: "utf8",
        timeout: 60000,
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(([k]) => k !== "NODE_TEST_CONTEXT")
          ),
          C2_DOCS_MODE: route,
          C2_URL: "/docs/missing",
          C2_SMOKE: "1"
        }
      });
      assert.equal(
        child.status,
        1,
        `review F-C9 if the failure changes: ${child.stdout} ${child.stderr}`
      );
      assert.match(child.stdout + child.stderr, /Internal Server Error/);
      assert.match(child.stdout + child.stderr, /ssrSanitizeError/);
    }
  });
} else
  test(`tier 1 docs ${mode}`, async () => {
    const { createServer, createRunnableDevEnvironment } = await import(
      pathToFileURL(require.resolve("vite"))
    );
    const solidModule = await import(pathToFileURL(require.resolve("@solidjs/vite-plugin")));
    const solid =
      typeof solidModule.default === "function" ? solidModule.default : solidModule.default.default;
    const { JSDOM } = require("jsdom");
    const { populateGlobal } = await import(pathToFileURL(require.resolve("vitest/runtime")));
    const directory = resolve(
      import.meta.dirname,
      "../../../examples",
      mode === "original" ? "originals/docs" : "docs-yield"
    );
    let plan;
    const logs = [];
    const warn = console.warn,
      error = console.error;
    console.warn = (...xs) => logs.push(xs.join(" "));
    console.error = (...xs) => logs.push(xs.join(" "));
    const server = await createServer({
      root: resolve(directory, "stream"),
      mode: process.env.C2_PRODUCTION ? "production" : "development",
      configFile: false,
      appType: "custom",
      logLevel: "silent",
      plugins: [
        ...(mode === "compiled" ? [eagerIslands({ directory, onPlan: p => (plan = p) })] : []),
        {
          name: "c2:no-hmr",
          enforce: "pre",
          applyToEnvironment: e => e.name === "hydrate",
          load(id) {
            if (/\/vite\/dist\/client\/client\.mjs$/.test(id.replace(/\?.*$/, "")))
              return "export const createHotContext=()=>({data:{},accept(){},acceptExports(){},dispose(){},prune(){},decline(){},invalidate(){},on(){},off(){},send(){}});export const updateStyle=()=>{};export const removeStyle=()=>{};export const injectQuery=x=>x;export class ErrorOverlay {}";
          },
          transform(code, id) {
            if (mode !== "compiled" && id === resolve(directory, "stream/client.tsx"))
              return code.replace(/\bhydrate\(/, "export const dispose = hydrate(");
          }
        },
        solidYield(),
        solid({ hot: false, ssr: true })
      ],
      server: { middlewareMode: true, hmr: false, ws: false },
      environments: {
        hydrate: {
          consumer: "client",
          resolve: {
            conditions: ["browser", process.env.C2_PRODUCTION ? "production" : "development"]
          },
          optimizeDeps: { noDiscovery: true, include: [] },
          dev: {
            moduleRunnerTransform: true,
            createEnvironment: (name, config) =>
              createRunnableDevEnvironment(name, config, { runnerOptions: { hmr: false } })
          }
        }
      }
    });
    let dom, mounted, endCoverage;
    const interval = globalThis.setInterval,
      intervals = [];
    try {
      let html;
      if (process.env.C2_HTML && !process.env.C2_SSR_ONLY)
        html = readFileSync(process.env.C2_HTML, "utf8");
      else {
        const ssr = await server.ssrLoadModule("/entry-server.tsx");
        html = String(await ssr.render(process.env.C2_URL ?? "/"));
      }
      if (process.env.C2_SSR_ONLY) {
        writeFileSync(process.env.C2_HTML, html);
        return;
      }
      if (process.env.C2_DUMP) writeFileSync(resolve(tmpdir(), `c2-${mode}.html`), html);
      dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
        url: "http://localhost" + (process.env.C2_URL ?? "/"),
        pretendToBeVisual: true
      });
      populateGlobal(globalThis, dom.window, { bindFunctions: true });
      globalThis.setInterval = (...args) => {
        const id = interval(...args);
        intervals.push(id);
        return id;
      };
      const scripts = [];
      const clean = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (all, attrs, body) => {
        if (attrs.includes("application/json")) return all;
        if (!/\bsrc=/.test(attrs) && !attrs.includes('type="module"')) scripts.push(body);
        return "";
      });
      document.documentElement.innerHTML = clean
        .replace(/<!doctype[^>]*>/i, "")
        .replace(/<\/?html[^>]*>/g, "");
      const parsed = new DOMParser().parseFromString(clean, "text/html");
      for (const attr of parsed.documentElement.attributes)
        document.documentElement.setAttribute(attr.name, attr.value);
      for (const script of scripts) (0, eval)(script);
      const claimed = [...document.querySelectorAll("[_hk]")];
      const inertNodes = [document.querySelector("nav"), document.querySelector("footer")];
      if (mode === "compiled") {
        const keys = claimed.map(node => node.getAttribute("_hk"));
        assert.equal(new Set(keys).size, keys.length, "hydration keys are unique");
        for (let i = 1; i <= 7; i++)
          assert(
            keys.some(key => key.startsWith(`cy${i}-`)),
            `root ${i} namespace`
          );
      }
      globalThis.vi = {
        useFakeTimers() {},
        useRealTimers() {},
        clearAllTimers() {},
        restoreAllMocks() {},
        advanceTimersByTimeAsync: ms => new Promise(r => setTimeout(r, ms)),
        spyOn: (object, key) => ({
          mockImplementation: fn => {
            object[key] = fn;
          }
        })
      };
      window.scrollTo = () => {};
      if (process.env.C2_COVERAGE)
        endCoverage = beginCoverage({
          file: process.env.C2_COVERAGE,
          app: mode,
          twin: "docs-yield"
        });
      mounted = await server.environments.hydrate.runner.import("/client.tsx");
      if (process.env.C2_DUMP && plan) {
        const root = plan.roots.find(r => r.foreign);
        const output = await server.environments.hydrate.transformRequest(root.module);
        writeFileSync(resolve(tmpdir(), "c2-router.js"), output.code);
      }
      await new Promise(r => setTimeout(r, 10));
      assert(
        claimed.every(node => node.isConnected),
        "every server node must be retained at hydration"
      );
      if (mode === "compiled") {
        assert.equal(plan.roots.length, 7);
        assert.equal(document.querySelector("nav").hasAttribute("_hk"), false);
        assert.equal(document.querySelector("footer").hasAttribute("_hk"), false);
        assert.equal(document.querySelectorAll("script[data-cy]").length, 0);
      }
      const script = await server.environments.hydrate.runner.import(
        resolve(import.meta.dirname, "../../../examples/docs-yield/tests/script.ts")
      );
      globalThis.__yieldExecutedBytes?.("load");
      let snapshots;
      if (process.env.C2_SMOKE) {
        const { normalize } = await server.environments.hydrate.runner.import(
          resolve(import.meta.dirname, "../../../examples/harness/src/index.ts")
        );
        snapshots = [normalize(document.getElementById("root").innerHTML)];
        assert(document.querySelector("main .like button"));
        assert(
          document.querySelector(
            process.env.C2_URL.endsWith("missing") ? "main .not-found" : "main article h1"
          )
        );
      } else snapshots = await script.runScript();
      assert(
        inertNodes.every(node => node.isConnected),
        "inert nav and footer keep their server identity"
      );
      endCoverage?.();
      endCoverage = undefined;
      assert.deepEqual(logs, []);
      console.log("C2_RESULT " + JSON.stringify({ snapshots, roots: plan?.roots.length ?? 1 }));
    } catch (failure) {
      error(failure.stack);
      throw failure;
    } finally {
      endCoverage?.();
      mounted?.dispose?.();
      for (const dispose of mounted?.disposers ?? []) dispose();
      intervals.forEach(clearInterval);
      globalThis.setInterval = interval;
      dom?.window.close();
      console.warn = warn;
      console.error = error;
      await server.close();
    }
  });
