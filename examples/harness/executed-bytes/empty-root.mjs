// Measure an empty hydrated library root, including cold import evaluation.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { beginCoverage } from "./coverage.mjs";
import solidYield from "../../../packages/vite-plugin-yield/src/index.js";
const repo = resolve(import.meta.dirname, "../../..");
const require = createRequire(join(repo, "packages/compiler-yield/package.json"));
if (!process.env.C1B_EMPTY_MODE) {
  const temp = mkdtempSync(join(tmpdir(), "c1b-empty-"));
  try {
    for (const mode of ["server", "client"]) {
      const run = spawnSync(process.execPath, [import.meta.filename], {
        encoding: "utf8",
        timeout: 30000,
        env: { ...process.env, NODE_ENV: "production", C1B_EMPTY_MODE: mode, C1B_EMPTY_DIR: temp }
      });
      if (run.status) throw new Error(run.stdout + run.stderr);
    }
    const phases = readFileSync(join(temp, "coverage.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    const result = {
      node: process.version,
      metric:
        "V8 executed UTF-8 ranges; production empty hydrated root, cold imports; inline maps excluded",
      phases: phases.map(p => ({
        phase: p.phase,
        bytes: p.bytes,
        core: p.scripts
          .filter(r => !r.url.endsWith("/reach-empty.tsx"))
          .reduce((n, r) => n + r.bytes, 0),
        shell: p.scripts
          .filter(r => r.url.endsWith("/reach-empty.tsx"))
          .reduce((n, r) => n + r.bytes, 0),
        scripts: p.scripts
          .filter(r => r.bytes)
          .map(r => ({ url: r.url.replace(repo + "/", ""), bytes: r.bytes }))
      }))
    };
    const i = process.argv.indexOf("--record");
    if (i >= 0) writeFileSync(process.argv[i + 1], JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
} else {
  const { createServer, createRunnableDevEnvironment } = await import(
    pathToFileURL(require.resolve("vite"))
  );
  const mod = await import(pathToFileURL(require.resolve("@solidjs/vite-plugin")));
  const solid = typeof mod.default === "function" ? mod.default : mod.default.default;
  const server = await createServer({
    root: join(repo, "packages/compiler-yield"),
    configFile: false,
    mode: "production",
    appType: "custom",
    logLevel: "silent",
    plugins: [
      {
        name: "c1b:no-hmr",
        enforce: "pre",
        load(id) {
          if (/\/vite\/dist\/client\/client\.mjs$/.test(id.replace(/\?.*$/, "")))
            return "export const createHotContext=()=>({accept(){},on(){}});export const updateStyle=()=>{};export const removeStyle=()=>{};";
        }
      },
      solidYield(),
      solid({ hot: false, ssr: true })
    ],
    server: { middlewareMode: true, hmr: false, ws: false },
    environments: {
      probe: {
        consumer: "client",
        resolve: { conditions: ["browser", "production"] },
        optimizeDeps: { noDiscovery: true, include: [] },
        dev: {
          moduleRunnerTransform: true,
          createEnvironment: (name, config) =>
            createRunnableDevEnvironment(name, config, { runnerOptions: { hmr: false } })
        }
      }
    }
  });
  let dom, end, dispose;
  const path = "/test/fixtures/reach-empty.tsx";
  try {
    if (process.env.C1B_EMPTY_MODE === "server") {
      const fixture = await server.ssrLoadModule(path);
      writeFileSync(join(process.env.C1B_EMPTY_DIR, "root.html"), fixture.serverHTML());
    } else {
      const { JSDOM } = require("jsdom");
      const { populateGlobal } = await import(pathToFileURL(require.resolve("vitest/runtime")));
      dom = new JSDOM('<!doctype html><div id="root"></div>', {
        url: "http://localhost",
        pretendToBeVisual: true
      });
      populateGlobal(globalThis, dom.window, { bindFunctions: true });
      const html = readFileSync(join(process.env.C1B_EMPTY_DIR, "root.html"), "utf8");
      document.getElementById("root").innerHTML = html.replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/g,
        ""
      );
      for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) (0, eval)(m[1]);
      const before = document.querySelector("main");
      end = beginCoverage({
        file: join(process.env.C1B_EMPTY_DIR, "coverage.jsonl"),
        app: "empty",
        twin: "empty",
        select: url =>
          url.endsWith("/reach-empty.tsx") ||
          /\/packages\/yield\/(src|dist)\//.test(url) ||
          /\/(solid-js|@solidjs\/(?:web|signals)|seroval|seroval-plugins)\/(dist|storage|serialization)\//.test(
            url
          )
      });
      const fixture = await server.environments.probe.runner.import(path);
      dispose = fixture.resumeEmpty();
      if (document.querySelector("main") !== before)
        throw new Error("Empty shell replaced its server node");
      globalThis.__yieldExecutedBytes("load");
      fixture.idle();
      globalThis.__yieldExecutedBytes("idle");
    }
  } finally {
    end?.();
    dispose?.();
    dom?.window.close();
    await server.close();
  }
}
