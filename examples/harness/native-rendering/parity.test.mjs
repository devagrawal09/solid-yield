import { Writable } from "node:stream";
import assert from "node:assert/strict";
import { appendFileSync, writeFileSync, mkdirSync } from "node:fs";
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
const original = join(root, "examples/originals/rendering");
// check.mjs writes the author's fix (author-fix.json) here as a project of its
// own, so native mode lowers the whole fixed app once per server.
const fixed = join(original, ".native-generated/fixed");
const script = join(root, "examples/rendering-yield/tests/script.ts");
const host = join(root, "examples/rendering-yield");
const entryId = join(host, ".native-generated/rendering-entry.tsx");
/** Simulated fetches and the stream run on faked timers: enough for every route to settle. */
const SETTLE_MS = 7000;
const trace = message =>
  process.env.NATIVE_RENDERING_TRACE &&
  appendFileSync(
    process.env.NATIVE_RENDERING_TRACE,
    `[${new Date().toISOString().slice(11, 23)}] ${message}\n`
  );
/** Solid's own development notices: recorded per mode, compared by check.mjs. */
const NOTICES =
  /^\[(ASYNC_OUTSIDE_LOADING_BOUNDARY|SSR_RENDER_ERROR_CONTAINED|SSR_BOUNDARY_WATERFALL)\]/;

// Captured before the script fakes the timers: real waits for module loads.
const realSetTimeout = globalThis.setTimeout;
/**
 * Faked time in 100 ms steps, each after a real turn of `realMs` (a lazy
 * route's module loads in real time), until `done()` or `fakeMs` of faked time.
 * @param {() => boolean} done @param {number} [fakeMs] @param {number} [realMs]
 */
async function advance(done, fakeMs = 300_000, realMs = 2) {
  for (let t = 0; t < fakeMs && !done(); t += 100) {
    await new Promise(r => realSetTimeout(r, realMs));
    await vi.advanceTimersByTimeAsync(100);
  }
}

// mode: "original", "fixed" (the author's minimal fix, plain Solid) or "native"
// (the fixed copy through native mode). task: "client" (the twin's script after
// a client render), "ssr" (a streamed render of each URL) or "hydrate" (one URL).
async function record(mode, task, urls) {
  const app = join(mode === "original" ? original : fixed, "shared/src/components/App.tsx");
  const dom = new JSDOM("<html><body></body></html>", {
    url: "http://localhost" + urls[0],
    pretendToBeVisual: true
  });
  const populated = populateGlobal(globalThis, dom.window, { bindFunctions: true });
  delete globalThis.Solid$$;
  const logs = [];
  const originalWarn = console.warn,
    originalError = console.error;
  console.warn = (...args) => logs.push(args.join(" "));
  console.error = (...args) => logs.push(args.map(a => a?.stack ?? a).join(" "));
  const server = await vite.createServer({
    root: host,
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { dedupe: ["solid-yield", "solid-js", "@solidjs/web"] },
    ssr: { noExternal: ["solid-yield", "solid-js", "@solidjs/web", "@solidjs/signals"] },
    plugins: [
      {
        name: "rendering:entries",
        enforce: "pre",
        resolveId(id) {
          if (id === "/rendering-entry.tsx") return entryId;
        },
        load(id) {
          if (id === entryId) {
            const native = mode === "native";
            return `
            import App from ${JSON.stringify(app)};
            import {flush} from "solid-js";
            import {render, hydrate, renderToStream} from ${JSON.stringify(native ? "solid-yield" : "@solidjs/web")};
            ${native ? 'import {jsx} from "solid-yield/jsx-runtime"; const root=props=>()=>jsx(App,props);' : 'import {createComponent} from "solid-js"; const root=props=>()=>createComponent(App,props);'}
            import manifest from "virtual:solid-manifest";
            export {generateHydrationScript} from "@solidjs/web";
            export {install,uninstall,runScript,steps} from ${JSON.stringify(script)};
            export const ssr=url=>renderToStream(root({url}),{manifest});
            export const mount=()=>{const dispose=${task === "hydrate" ? "hydrate" : "render"}(root({}),document.getElementById("app")); flush(); return dispose;};
          `;
          }
          if (id.includes("/vite/dist/client/client.mjs"))
            return "export const updateStyle=()=>{},removeStyle=()=>{},injectQuery=url=>url; export class ErrorOverlay {} export const createHotContext=()=>({accept(){},acceptExports(){},dispose(){},prune(){},decline(){},send(){},on(){},off(){},invalidate(){},data:{}});";
        }
      },
      ...(mode === "native"
        ? [
            solidYield({
              mode: "native",
              emit: "lowered",
              include: file => file.startsWith(join(fixed, "shared/src/"))
            })
          ]
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
  // Solid preloads a hydrating page's lazy modules with `import(new URL(path,
  // document.baseURI))`; the page's origin is this server (as in the hydrate smoke).
  const hydrateEnv = server.environments.hydrate;
  const fetchModule = hydrateEnv.fetchModule.bind(hydrateEnv);
  hydrateEnv.fetchModule = (id, ...rest) =>
    fetchModule(
      id.startsWith("http://localhost/") ? id.slice("http://localhost".length) : id,
      ...rest
    );
  /** Solid's notices since `from`, and anything else logged (a failure). @param {number} from */
  const drain = from => {
    const lines = logs.slice(from);
    const notices = lines.map(m => NOTICES.exec(m)?.[1]).filter(Boolean);
    const other = lines.filter(m => !NOTICES.test(m));
    return { notices: notices.sort(), other };
  };
  let client, dispose;
  try {
    const entry = await server.ssrLoadModule("/rendering-entry.tsx");
    client = await server.environments.hydrate.runner.import("/rendering-entry.tsx");
    /** @type {Record<string, any>} */ const results = {};
    for (const url of urls) {
      let serverSnapshot;
      const from = logs.length;
      trace(`${mode} ${task} ${url}: start`);
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
            entry.ssr(url).pipe(sink);
          });
          const scripts = entry.generateHydrationScript();
          // Faked time until the stream ends (Stream's items arrive a second
          // apart), with real turns for the lazy route's module to load.
          let ended = false;
          complete.then(
            () => (ended = true),
            () => (ended = true)
          );
          await advance(() => ended);
          trace(`${url}: advanced; ended=${ended}; ${html.length} bytes`);
          await complete;
          trace(`${url}: complete`);
          const full = scripts + `<div id="app">${html}</div>`;
          const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
          document.body.innerHTML = full.replace(scriptRe, "");
          for (const match of full.matchAll(scriptRe)) (0, eval)(match[1]);
          // The resolved server document: streamed chunks swapped into place.
          serverSnapshot = document.body.innerHTML;
        } finally {
          entry.uninstall();
        }
        const { notices, other } = drain(from);
        assert.deepEqual(other, [], `${mode} ${url}: server render logged`);
        if (task === "ssr") {
          results[url] = { serverSnapshot, notices };
          continue;
        }
      }
      client.install();
      if (task === "hydrate") {
        // install() reset the body: restore the server document.
        document.body.innerHTML = serverSnapshot;
        history.replaceState(null, "", url);
      }
      // The router's tabs and the tab's frame: the server's nodes, if hydration claimed them.
      const kept = () => [
        ...document.querySelectorAll("#app ul.inline, #app ul.inline li, #app .tab")
      ];
      const nodes = kept();
      const after = logs.length;
      dispose = client.mount();
      let snapshots;
      try {
        if (task === "client") snapshots = await client.runScript({});
        else {
          await advance(() => false, SETTLE_MS, 20);
          snapshots = [document.getElementById("app").innerHTML];
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
      const { notices, other } = drain(after);
      assert.deepEqual(other, [], `${mode} ${task} ${url}: render logged`);
      results[url] = {
        serverSnapshot,
        retained,
        snapshots,
        notices,
        steps: client.steps.map(([name]) => [name])
      };
      dispose?.();
      dispose = undefined;
      client.uninstall();
    }
    return results;
  } finally {
    dispose?.();
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

it("records the rendering app", async () => {
  const mode = process.env.NATIVE_RENDERING_MODE;
  const task = process.env.NATIVE_RENDERING_TASK;
  const urls = (process.env.NATIVE_RENDERING_URLS ?? "/").split(",");
  assert.ok(["native", "original", "fixed"].includes(mode));
  assert.ok(["client", "ssr", "hydrate"].includes(task));
  const result = await record(mode, task, urls);
  const output = process.env.NATIVE_RENDERING_OUTPUT;
  assert.ok(output);
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(output, JSON.stringify(result));
});
