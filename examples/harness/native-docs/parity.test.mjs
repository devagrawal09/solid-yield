import { Writable } from "node:stream";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { populateGlobal } from "vitest/runtime";
import solidYield from "../../../packages/vite-plugin-yield/src/vite.js";
const root = resolve(import.meta.dirname, "../../..");
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const vite = await import(pathToFileURL(require.resolve("vite")).href);
const solid = require("@solidjs/vite-plugin").default;
const original = join(root, "examples/originals/docs");
const source = join(original, "src/");
const main = join(source, "app.tsx");
const script = join(root, "examples/docs-yield/tests/script.ts");
const fix = JSON.parse(readFileSync(join(import.meta.dirname, "author-fix.json"), "utf8"));
const patched = code =>
  fix.edits.reduce((text, { from, to }) => {
    if (!text.includes(from)) throw new Error("author fix anchor missing: " + from);
    return text.replace(from, to);
  }, code);
const host = join(root, "examples/todos-yield");
const entryId = join(host, ".native-generated/docs-entry.tsx");

// mode: "original", "fixed" (the author's minimal fix, plain Solid) or "native"
// (the fixed copy through native mode). task: "client" (the shared script after
// a client render), "ssr" (a streamed render of one URL) or "hydrate".
async function record(mode, task, url) {
  const dom = new JSDOM("<html><body></body></html>", {
    url: "http://localhost" + url,
    pretendToBeVisual: true
  });
  const populated = populateGlobal(globalThis, dom.window, { bindFunctions: true });
  delete globalThis.Solid$$;
  const logs = [];
  const originalWarn = console.warn,
    originalError = console.error;
  console.warn = (...args) => logs.push(args.join(" "));
  console.error = (...args) => logs.push(args.map(a => a?.stack ?? a).join(" ")); // stacks, to place a failure
  const server = await vite.createServer({
    root: host,
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: {
      alias: {
        "@solidjs/router": join(original, "node_modules/@solidjs/router/dist/index.jsx")
      },
      dedupe: ["solid-yield", "solid-js", "@solidjs/web"]
    },
    ssr: {
      noExternal: ["solid-yield", "solid-js", "@solidjs/web", "@solidjs/signals", "@solidjs/router"]
    },
    plugins: [
      {
        name: "docs:entries",
        enforce: "pre",
        resolveId(id) {
          if (id === "/docs-entry.tsx") return entryId;
          // The shared script imports Vitest; both module graphs use the test's own.
          if (id === "vitest") return "\0docs-vitest";
        },
        load(id) {
          // The author's minimal fix, applied at test time (the original stays byte-identical).
          if (mode !== "original" && id === main) return patched(readFileSync(id, "utf8"));
          if (id === "\0docs-vitest")
            return "export const vi = globalThis.vi, expect = globalThis.expect;";
          if (id === entryId)
            return `
            import App from ${JSON.stringify(main)};
            import {render, hydrate, renderToStream} from ${JSON.stringify(mode === "native" ? "solid-yield" : "@solidjs/web")};
            ${mode === "native" ? 'import {jsx} from "solid-yield/jsx-runtime"; const root=props=>()=>jsx(App,props);' : 'import {createComponent} from "solid-js"; const root=props=>()=>createComponent(App,props);'}
            export {generateHydrationScript} from "@solidjs/web";
            export {install,uninstall,runScript,steps} from ${JSON.stringify(script)};
            ${this.environment.config.consumer === "server" ? 'import {provideRequestEvent} from "@solidjs/web/storage";' : "const provideRequestEvent=(_event,cb)=>cb();"}
            export const ssr=()=>provideRequestEvent({request:new Request("http://localhost"+${JSON.stringify(url)}),locals:{}},()=>renderToStream(root({url:${JSON.stringify(url)}})));
            export const mount=()=>${task === "hydrate" ? "hydrate" : "render"}(root({}),document.getElementById("root"));
          `;
          if (id.includes("/vite/dist/client/client.mjs"))
            return "export const updateStyle=()=>{},removeStyle=()=>{}; export const createHotContext=()=>({accept(){},acceptExports(){},dispose(){},prune(){},on(){},off(){},invalidate(){},data:{}});";
        }
      },
      ...(mode === "native"
        ? [solidYield({ mode: "native", include: file => file.startsWith(source) })]
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
  let client, dispose;
  const quiet = () =>
    logs.filter(m => !m.startsWith("[SSR_BOUNDARY_WATERFALL]") && !m.includes("No article"));
  try {
    const entry = await server.ssrLoadModule("/docs-entry.tsx");
    client = await server.environments.hydrate.runner.import("/docs-entry.tsx");
    let serverSnapshot, serverHtml;
    if (task !== "client") {
      entry.install();
      history.replaceState(null, "", url);
      try {
        let html = "";
        const complete = new Promise((resolve, reject) => {
          const sink = new Writable({
            write(chunk, _encoding, done) {
              html += chunk.toString();
              done();
            }
          });
          sink.on("finish", resolve);
          sink.on("error", reject);
          entry.ssr().pipe(sink);
        });
        const scripts = entry.generateHydrationScript();
        await vi.advanceTimersByTimeAsync(500);
        await complete;
        const full = scripts + `<div id="root">${html}</div>`;
        const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
        serverHtml = full;
        document.body.innerHTML = full.replace(scriptRe, "");
        for (const match of full.matchAll(scriptRe)) (0, eval)(match[1]);
        // The resolved server document: streamed chunks swapped into place.
        serverSnapshot = document.body.innerHTML;
      } finally {
        entry.uninstall();
      }
      assert.deepEqual(quiet(), [], `${mode} ${url}: server render logged`);
      if (task === "ssr") return { serverSnapshot, serverHtml };
    }
    client.install();
    if (task === "hydrate") {
      // The shared script's uninstall cleared the body: restore the server document.
      document.body.innerHTML = serverSnapshot;
      history.replaceState(null, "", url);
    }
    // The shell outside the route (and the home page's nav); a not-found route's boundary
    // re-renders on the client in the original too.
    const kept = () => [
      ...document.querySelectorAll(url === "/" ? ".site,header,aside,nav" : ".site,header,aside")
    ];
    const nodes = kept();
    dispose = client.mount();
    let snapshots;
    try {
      if (task === "client") snapshots = await client.runScript();
      else {
        await vi.advanceTimersByTimeAsync(200);
        if (url === "/") {
          document.querySelector(".theme button").click();
          await vi.advanceTimersByTimeAsync(0);
          assert.ok(document.querySelector(".theme.dark"), "the theme toggles after hydration");
        }
        snapshots = [document.getElementById("root").innerHTML];
      }
    } catch (failure) {
      throw new Error(`${mode} ${task}: ${document.body.innerHTML}; logs=${logs.join("\n")}`, {
        cause: failure
      });
    }
    const retained =
      task === "hydrate"
        ? nodes.length >= 3 && nodes.every((node, index) => node === kept()[index])
        : undefined;
    assert.deepEqual(quiet(), [], `${mode} ${task}: render logged`);
    return { serverSnapshot, retained, snapshots, steps: client.steps.map(([name]) => [name]) };
  } finally {
    dispose?.();
    client?.uninstall();
    await server.close();
    console.warn = originalWarn;
    console.error = originalError;
    document.body.innerHTML = "";
    delete globalThis._$HY;
    dom.window.close();
    for (const key of populated.keys) delete globalThis[key];
    for (const [key, value] of populated.originals) globalThis[key] = value;
  }
}

it("records the docs", async () => {
  const mode = process.env.NATIVE_DOCS_MODE;
  const task = process.env.NATIVE_DOCS_TASK;
  const url = process.env.NATIVE_DOCS_URL ?? "/";
  assert.ok(["native", "original", "fixed"].includes(mode));
  assert.ok(["client", "ssr", "hydrate"].includes(task));
  const result = await record(mode, task, url);
  const output = process.env.NATIVE_DOCS_OUTPUT;
  assert.ok(output);
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(output, JSON.stringify(result));
});
