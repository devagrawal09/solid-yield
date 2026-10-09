import { Writable } from "node:stream";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { authored, materialize, options } from "./project.mjs";
import { JSDOM } from "jsdom";
import { populateGlobal } from "vitest/runtime";
import solidYield from "../../../packages/vite-plugin-yield/src/vite.js";
const root = resolve(import.meta.dirname, "../../..");
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const vite = await import(pathToFileURL(require.resolve("vite")).href);
const solid = require("@solidjs/vite-plugin").default;
const original = join(root, "examples/originals/hackernews-spa/src");
const fixed = join(
  root,
  `examples/hackernews-spa-yield/.native-generated/hackernews-fixed-${process.pid}`
);
const script = join(root, "examples/hackernews-spa-yield/tests/script.ts");
materialize(fixed, authored(true));
writeFileSync(
  join(fixed, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: { ...options(fixed), jsxImportSource: "@solidjs/web" },
    include: ["**/*.ts", "**/*.tsx"]
  })
);

async function record(mode, hydrated) {
  const path = process.env.NATIVE_HACKERNEWS_SMOKE === "1" ? "/stories/30186326" : "/";
  const source = mode === "original" ? original : fixed;
  const main = join(source, "app.tsx");
  const dom = new JSDOM("<html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true
  });
  const populated = populateGlobal(globalThis, dom.window, { bindFunctions: true });
  delete globalThis.Solid$$;
  const logs = [];
  // Keep diagnostics captured across SSR, hydration and fixture cleanup.
  const originalWarn = console.warn,
    originalError = console.error;
  console.warn = (...args) => logs.push(args.join(" "));
  console.error = (...args) => logs.push(args.join(" "));
  const server = await vite.createServer({
    root: join(root, "examples/hackernews-spa-yield"),
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: {
      alias: {
        "~": source,
        "@solidjs/router": join(
          root,
          "examples/hackernews-spa-yield/node_modules/@solidjs/router/dist/index.jsx"
        )
      },
      dedupe: ["solid-yield", "solid-js", "@solidjs/web", "@solidjs/router"]
    },
    ssr: {
      noExternal: ["solid-yield", "solid-js", "@solidjs/web", "@solidjs/signals", "@solidjs/router"]
    },
    plugins: [
      {
        name: "hackernews:entries",
        enforce: "pre",
        resolveId(id) {
          if (id === "/hackernews-entry.tsx")
            return join(
              root,
              "examples/hackernews-spa-yield/.native-generated/hackernews-entry.tsx"
            );
        },
        load(id) {
          if (
            id ===
            join(root, "examples/hackernews-spa-yield/.native-generated/hackernews-entry.tsx")
          )
            return `
            import App from ${JSON.stringify(main)};
            import {render, hydrate, renderToStream} from ${JSON.stringify(mode === "native" ? "solid-yield" : "@solidjs/web")};
            export {generateHydrationScript} from "@solidjs/web";
            export {install,uninstall,runScript,steps,settle} from ${JSON.stringify(script)};
            ${this.environment.config.consumer === "server" ? 'import {provideRequestEvent} from "@solidjs/web/storage";' : "const provideRequestEvent=(_event,cb)=>cb();"}
            export const ssr=()=>provideRequestEvent({request:new Request("http://localhost"+${JSON.stringify(path)}),locals:{}},()=>renderToStream(App));
            export const mount=()=>${hydrated ? "hydrate" : "render"}(App,document.getElementById("root"));
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
  try {
    const entry = await server.ssrLoadModule("/hackernews-entry.tsx");
    client = await server.environments.hydrate.runner.import("/hackernews-entry.tsx");
    let html, scripts;
    if (hydrated) {
      entry.install(path);
      try {
        let htmlOut = "";
        const complete = new Promise((resolve, reject) => {
          const sink = new Writable({
            write(chunk, _encoding, done) {
              htmlOut += chunk.toString();
              done();
            }
          });
          sink.on("finish", resolve);
          sink.on("error", reject);
          entry.ssr().pipe(sink);
        });
        scripts = entry.generateHydrationScript();
        await complete;
        html = htmlOut;
      } finally {
        entry.uninstall();
      }
      const full = scripts + `<div id="root">${html}</div>`;
      const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
      document.body.innerHTML = full.replace(scriptRe, "");
      for (const match of full.matchAll(scriptRe)) (0, eval)(match[1]);
    } else document.body.innerHTML = '<div id="root"></div>';
    const serverSnapshot = hydrated ? document.body.innerHTML : undefined;
    if (process.env.NATIVE_HACKERNEWS_SMOKE === "1") {
      assert.deepEqual(
        logs.filter(m => !m.startsWith("[SSR_BOUNDARY_WATERFALL]")),
        []
      );
      return { serverSnapshot };
    }
    const hydratedHTML = document.body.innerHTML;
    client.install(path);
    if (hydrated) document.body.innerHTML = hydratedHTML;
    const before = [...document.querySelectorAll(".header,.news-view,.news-item")];
    dispose = client.mount();
    const retained = hydrated
      ? before.length > 3 &&
        before.every(
          (node, index) =>
            node === document.querySelectorAll(".header,.news-view,.news-item")[index]
        )
      : undefined;
    let snapshots;
    try {
      snapshots = await client.runScript({ root: document.getElementById("root"), dispose() {} });
    } catch (failure) {
      throw new Error(`${mode} ${hydrated}: ${document.body.innerHTML}; logs=${logs.join("\n")}`, {
        cause: failure
      });
    }
    // Streaming advisories are allowed; hydration and render errors fail.
    assert.deepEqual(
      logs.filter(m => !m.startsWith("[SSR_BOUNDARY_WATERFALL]")),
      []
    );
    let failureSnapshot;
    if (mode !== "original") {
      // A network failure, as fetch reports one: its platform contract is TypeError | DOMException.
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError("fixture fetch failed"));
      const link = document.createElement("a");
      link.href = "/users/failing-fetch";
      document.getElementById("root").appendChild(link);
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      await client.settle();
      failureSnapshot = document.getElementById("root").innerHTML;
      assert.equal(
        document.querySelector(".route-error").textContent,
        "Failed to load: fixture fetch failed"
      );
      assert.deepEqual(
        logs.filter(m => !m.startsWith("[SSR_BOUNDARY_WATERFALL]")),
        []
      );
    }
    return {
      serverSnapshot,
      retained,
      snapshots,
      failureSnapshot,
      steps: client.steps.map(([name]) => [name])
    };
  } finally {
    dispose?.();
    client?.uninstall();
    await server.close();
    rmSync(fixed, { recursive: true, force: true });
    console.warn = originalWarn;
    console.error = originalError;
    document.body.innerHTML = "";
    delete globalThis._$HY;
    dom.window.close();
    for (const key of populated.keys) delete globalThis[key];
    for (const [key, value] of populated.originals) globalThis[key] = value;
  }
}

it("records Hacker News", async () => {
  const mode = process.env.NATIVE_HACKERNEWS_MODE;
  const hydrated = process.env.NATIVE_HACKERNEWS_HYDRATED === "1";
  assert.ok(["native", "original", "fixed"].includes(mode));
  const result = await record(mode, hydrated);
  const output = process.env.NATIVE_HACKERNEWS_OUTPUT;
  assert.ok(output);
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(output, JSON.stringify(result));
});
