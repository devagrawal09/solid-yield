import docsLevelPlugin from "../../../examples/harness/docs-level.mjs";
import { highlightCoreForModuleRunner } from "../../../examples/harness/module-runner-highlight.mjs";
import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import solidYield from "../../vite-plugin-yield/src/index.js";
import eagerIslands from "../src/eager.js";
import serverComponents from "../src/server-components.js";
import { rpcTransport } from "./rpc-transport.mjs";
import {
  serializedDocsError,
  unexpectedRenderLog
} from "../../../examples/harness/ssr-smoke/docs-contract.mjs";
import { beginCoverage } from "../../../examples/harness/executed-bytes/coverage.mjs";
const require = createRequire(new URL("../package.json", import.meta.url));
const mode = process.env.C2_DOCS_MODE;
const test = mode
  ? async (_name, run) => {
      try {
        await run();
      } catch (error) {
        console.error(error);
        process.exitCode = 1;
      }
    }
  : nodeTest;
const compiled = mode?.startsWith("compiled");
const regions = mode === "compiled-r";
const single = mode === "compiled-single" || regions;
const variants = ["original", "library", "compiled", "compiled-single"];
if (!mode) {
  test("tier 1 docs: original, library, seven roots and single root match all 40 hydrated steps", () => {
    const results = [];
    for (const route of variants) {
      const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
        encoding: "utf8",
        timeout: 60000,
        maxBuffer: 8 * 1024 * 1024,
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
    assert.equal(results[0].snapshots.length, 40);
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
    assert.equal(results[3].roots, 1);
    assert.deepEqual(results[3].snapshots, results[1].snapshots, "single root vs library");
  });
  for (const url of ["/docs/start", "/docs/missing"])
    test(`tier 1 direct SSR/hydrate ${url}`, () => {
      const snapshots = [];
      for (const route of variants) {
        const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
          encoding: "utf8",
          timeout: 60000,
          maxBuffer: 8 * 1024 * 1024,
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
      assert.deepEqual(snapshots[3], snapshots[1]);
    });
} else
  await test(`tier 1 docs ${mode}`, async () => {
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
    const unhandled = new Map();
    const rejected = (error, promise) => unhandled.set(promise, error);
    const handled = promise => unhandled.delete(promise);
    process.on("unhandledRejection", rejected);
    process.on("rejectionHandled", handled);
    let plan, rpc;
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
        docsLevelPlugin(),
        ...(compiled
          ? [
              eagerIslands({
                directory,
                roots: single ? "single" : "per-group",
                onPlan: p => (plan = p)
              })
            ]
          : []),
        {
          name: "c2:no-hmr",
          enforce: "pre",
          applyToEnvironment: e => e.name === "hydrate",
          load(id) {
            if (/\/vite\/dist\/client\/client\.mjs$/.test(id.replace(/\?.*$/, "")))
              return "export const createHotContext=()=>({data:{},accept(){},acceptExports(){},dispose(){},prune(){},decline(){},invalidate(){},on(){},off(){},send(){}});export const updateStyle=()=>{};export const removeStyle=()=>{};export const injectQuery=x=>x;export class ErrorOverlay {}";
          },
          transform(code, id) {
            const highlight = highlightCoreForModuleRunner(code, id);
            if (highlight) return highlight;
            if (!compiled && id === resolve(directory, "stream/client.tsx"))
              return code.replace(/\bhydrate\(/, "export const dispose = hydrate(");
          }
        },
        ...(regions ? [serverComponents({ directory })] : []),
        solidYield(),
        solid({
          hot: false,
          ssr: true,
          ...(regions
            ? {
                serverFunctions: {
                  components: true,
                  filter: { include: [directory + "/src/__compiler_regions.tsx"] }
                }
              }
            : {})
        })
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
        const stream = ssr.render(process.env.C2_URL ?? "/");
        const timeout = setTimeout(() => {
          if (regions) error("C3 SSR still pending", logs);
        }, 3000);
        timeout.unref();
        html = String(await stream);
        clearTimeout(timeout);
      }
      if (process.env.C2_URL === "/docs/missing" && !regions)
        assert(serializedDocsError(html), "stream preserves typed failure data");
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
      if (compiled) {
        assert.equal(
          document.querySelectorAll("script[data-cy]").length,
          single ? 1 : 7,
          "one serialized input block per hydration root"
        );
        const keys = claimed.map(node => node.getAttribute("_hk"));
        if (single)
          assert(
            keys.every(key => key.startsWith("cs-") || (regions && key.startsWith("sc"))),
            "one key space"
          );
        assert.equal(new Set(keys).size, keys.length, "hydration keys are unique");
        for (let i = 1; i <= (single ? 1 : 7); i++)
          assert(
            keys.some(key => key.startsWith(single ? "cs-" : `cy${i}-`)),
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
      if (regions) rpc = await rpcTransport();
      if (process.env.C2_COVERAGE)
        endCoverage = beginCoverage({
          file: process.env.C2_COVERAGE,
          app: mode,
          twin: "docs-yield"
        });
      if (regions) {
        const transport = await server.environments.hydrate.runner.import(
          resolve(directory, "src/__compiler_refetch.tsx")
        );
        transport.configureServerFunctionsClient({ fetch: rpc.fetch });
      }
      mounted = await server.environments.hydrate.runner.import("/client.tsx");
      if (process.env.C2_DUMP && plan && !single) {
        const root = plan.roots.find(r => r.foreign);
        const output = await server.environments.hydrate.transformRequest(root.module);
        writeFileSync(resolve(tmpdir(), "c2-router.js"), output.code);
      }
      await new Promise(r => setTimeout(r, process.env.C2_URL === "/docs/missing" ? 200 : 10));
      assert(
        claimed.every(node => node.isConnected),
        "every server node must be retained at hydration"
      );
      if (compiled) {
        assert.equal(plan.roots.length, single ? 1 : 7);
        assert.equal(plan.report.roots.length, 11);
        if (single) assert.equal(mounted.disposers.length, 1, "one hydration owner/disposer");
        assert.equal(document.querySelector("nav").hasAttribute("_hk"), false);
        assert.equal(document.querySelector("footer").hasAttribute("_hk"), false);
        assert.equal(document.querySelectorAll("script[data-cy]").length, 0);
      }
      const script = await server.environments.hydrate.runner.import(
        resolve(import.meta.dirname, "../../../examples/docs-yield/tests/script.ts")
      );
      globalThis.__yieldExecutedBytes?.("load");
      let snapshots, firstNavigation, firstFrame, firstLikeRetained;
      const linkClaims = [];
      let removeClaimProbe, currentStep;
      if (process.env.C4_CAPTURE_CLAIMS) {
        const { registerElementClaim } =
          await server.environments.hydrate.runner.import("@solidjs/web");
        removeClaimProbe = registerElementClaim(node => {
          if (node.matches('a[href^="#"]'))
            linkClaims.push({
              step: currentStep,
              href: node.getAttribute("href"),
              base: document.baseURI,
              active: node.hasAttribute("data-active"),
              current: node.getAttribute("aria-current")
            });
        });
      }
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
      } else if (regions || process.env.C4_CAPTURE_CLAIMS || process.env.C4_EARLY_LIKE) {
        const { normalize } = await server.environments.hydrate.runner.import(
          resolve(import.meta.dirname, "../../../examples/harness/src/index.ts")
        );
        snapshots = [];
        let likeNode, firstLike, routeHost;
        const guideHost = document.querySelector(".reading-guide");
        for (const [name, run] of script.steps) {
          currentStep = name;
          await run();
          if (name === "navigate to /docs/start") {
            firstNavigation = normalize(document.getElementById("root").innerHTML);
            firstLike = document.querySelector("main .like");
            assert(firstLike, "the initial Loading fallback includes LikeButton before the RPC");
            assert.match(document.querySelector("main").textContent, /Loading article…/);
            if (process.env.C4_EARLY_LIKE) {
              await script.steps.find(([step]) => step === "like (optimistic)")[1]();
              assert.match(firstLike.textContent, /Like: 1/);
            }
          }
          const settledSelector = {
            "article loads": "main #start-plan-the-page",
            "not-found typed error": "main .not-found",
            "code-heavy article loads": "main #pipeline-plan-the-page",
            "session: blog settles":
              process.env.DOCS_LEVEL === "S" ? "main #routing-plan-the-page" : "main .katex",
            "session: api settles":
              (process.env.DOCS_LEVEL ?? "L") === "L"
                ? "main .api-reference"
                : "main #testing-plan-the-page",
            "session: changelog settles":
              (process.env.DOCS_LEVEL ?? "L") === "L"
                ? "main .release"
                : "main #overview-plan-the-page",
            "session: docs settles": "main #pipeline-plan-the-page"
          }[name];
          if (settledSelector) {
            const deadline = Date.now() + 5000;
            while (!document.querySelector(settledSelector) && Date.now() < deadline)
              await new Promise(r => setTimeout(r, 1));
            assert(document.querySelector(settledSelector), "region response settles: " + name);
          }
          if (name === "like saved") {
            likeNode = document.querySelector("main .like");
            routeHost = document.querySelector("main");
          }
          if (regions && routeHost)
            assert.equal(
              document.querySelector("main"),
              routeHost,
              "R refetch keeps its authored host"
            );
          if (regions)
            assert.equal(
              document.querySelector(".reading-guide"),
              guideHost,
              "guide keeps its authored host"
            );
          if (name === "article loads") {
            firstLikeRetained = firstLike === document.querySelector("main .like");
            assert(firstLikeRetained, "LikeButton survives the initial fallback-to-frame handoff");
          }
          if (name === "not-found typed error")
            assert.equal(
              document.querySelector("main .like"),
              likeNode,
              "keyed slot retains its node across a slug refetch"
            );
          globalThis.__yieldExecutedBytes?.(name);
          snapshots.push(normalize(document.getElementById("root").innerHTML));
          if (name === "article loads" && process.env.C4_EARLY_LIKE) {
            assert.match(firstLike.textContent, /Like: 1/);
            assert.doesNotMatch(firstLike.textContent, /Saving/);
            // Visible content can land before the transport's final end record.
            // Finish the short probe only once that response has closed.
            if (rpc) {
              const deadline = Date.now() + 5000;
              while (!rpc.payloads.length && Date.now() < deadline)
                await new Promise(r => setTimeout(r, 1));
              assert.equal(rpc.payloads.length, 1);
            }
            break;
          }
          // Optional observation between checkpoints. The actual step-4 snapshot
          // and coverage checkpoint above never wait for the first frame.
          if (regions && name === "navigate to /docs/start" && process.env.C4_OBSERVE_FIRST_FRAME) {
            const deadline = Date.now() + 3000;
            while (
              !document.querySelector("main template[id^=pl-], main #start-plan-the-page") &&
              Date.now() < deadline
            )
              await new Promise(r => setTimeout(r, 1));
            assert(document.querySelector("main .like button"));
            firstFrame = normalize(document.getElementById("root").innerHTML);
          }
        }
      } else snapshots = await script.runScript();
      removeClaimProbe?.();
      assert(
        inertNodes.every(node => node.isConnected),
        "inert nav and footer keep their server identity"
      );
      endCoverage?.();
      endCoverage = undefined;
      assert.deepEqual(
        logs.filter(log => unexpectedRenderLog(log, process.env.C2_URL === "/docs/missing")),
        []
      );
      assert.equal(unhandled.size, 0, "all streamed rejections must be handled after hydration");
      console.log(
        "C2_RESULT " +
          JSON.stringify({
            snapshots,
            ...(firstNavigation ? { firstNavigation, firstLikeRetained } : {}),
            ...(firstFrame ? { firstFrame } : {}),
            ...(process.env.C4_CAPTURE_CLAIMS ? { linkClaims } : {}),
            roots: plan?.roots.length ?? 1,
            ...(rpc ? { payloads: rpc.payloads, jsonComparison: rpc.jsonComparison } : {})
          })
      );
    } catch (failure) {
      if (regions) {
        error(logs);
        if (dom) writeFileSync("/tmp/c3-failed-dom.html", document.documentElement.outerHTML);
      }
      error(failure.stack);
      throw failure;
    } finally {
      endCoverage?.();
      rpc?.close();
      mounted?.dispose?.();
      for (const dispose of mounted?.disposers ?? []) dispose();
      intervals.forEach(clearInterval);
      globalThis.setInterval = interval;
      dom?.window.close();
      console.warn = warn;
      console.error = error;
      await server.close();
      process.off("unhandledRejection", rejected);
      process.off("rejectionHandled", handled);
    }
  });
