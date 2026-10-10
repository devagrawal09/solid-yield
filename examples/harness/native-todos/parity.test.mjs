import { Writable } from "node:stream";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { populateGlobal } from "vitest/runtime";
import solidYield from "../../../packages/vite-plugin-yield/src/vite.js";
import { fixBulkActionReads, fixBulkHandlerArgument } from "./author-fix.mjs";
const root = resolve(import.meta.dirname, "../../..");
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const vite = await import(pathToFileURL(require.resolve("vite")).href);
const solid = require("@solidjs/vite-plugin").default;
const main = join(root, "examples/originals/todos/src/app.tsx");
const source = join(root, "examples/originals/todos/src/");
const script = join(root, "examples/todos-yield/tests/script.ts");

async function record(mode, hydrated) {
  const dom = new JSDOM("<html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true
  });
  const populated = populateGlobal(globalThis, dom.window, { bindFunctions: true });
  delete globalThis.Solid$$;
  const logs = [];
  // The shared todos script restores Vitest mocks between SSR and hydration.
  // Keep diagnostics captured across both phases.
  const originalWarn = console.warn,
    originalError = console.error;
  console.warn = (...args) => logs.push(args.join(" "));
  console.error = (...args) => logs.push(args.join(" "));
  const server = await vite.createServer({
    root: join(root, "examples/todos-yield"),
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { dedupe: ["solid-yield", "solid-js", "@solidjs/web"] },
    ssr: { noExternal: ["solid-yield", "solid-js", "@solidjs/web", "@solidjs/signals"] },
    plugins: [
      {
        name: "todos:entries",
        enforce: "pre",
        resolveId(id) {
          if (id === "/todos-entry.tsx")
            return join(root, "examples/todos-yield/.native-generated/todos-entry.tsx");
        },
        load(id) {
          if (mode === "native" && id === main)
            return fixBulkHandlerArgument(readFileSync(id, "utf8"));
          if (mode === "native" && id === join(source, "todos.ts"))
            return fixBulkActionReads(readFileSync(id, "utf8"));
          if (id === join(root, "examples/todos-yield/.native-generated/todos-entry.tsx"))
            return `
            import {App} from ${JSON.stringify(main)};
            import {render, hydrate, renderToStream} from ${JSON.stringify(mode === "native" ? "solid-yield" : "@solidjs/web")};
            export {generateHydrationScript} from "@solidjs/web";
            export {install,uninstall,runScript,steps} from ${JSON.stringify(script)};
            export const ssr=()=>renderToStream(App);
            export const mount=()=>${hydrated ? "hydrate" : "render"}(App,document.getElementById("root"));
          `;
          if (id.includes("/vite/dist/client/client.mjs"))
            return "export const createHotContext=()=>({accept(){},acceptExports(){},dispose(){},prune(){},on(){},off(){},invalidate(){},data:{}});";
        }
      },
      ...(mode === "native"
        ? [
            solidYield({
              mode: "native",
              emit: "lowered",
              include: file => file.startsWith(source)
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
  let client, dispose;
  try {
    const entry = await server.ssrLoadModule("/todos-entry.tsx");
    client = await server.environments.hydrate.runner.import("/todos-entry.tsx");
    let html, scripts;
    if (hydrated) {
      entry.install();
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
        await vi.advanceTimersByTimeAsync(500);
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
    if (process.env.NATIVE_TODOS_SMOKE === "1") {
      assert.deepEqual(
        logs.filter(m => !m.startsWith("[SSR_BOUNDARY_WATERFALL]")),
        []
      );
      return { serverSnapshot };
    }
    const hydratedHTML = document.body.innerHTML;
    client.install();
    if (hydrated) document.body.innerHTML = hydratedHTML;
    const before = [...document.querySelectorAll(".todoapp,.header,li.todo")];
    dispose = client.mount();
    const retained = hydrated
      ? before.length === 4 &&
        before.every(
          (node, index) => node === document.querySelectorAll(".todoapp,.header,li.todo")[index]
        )
      : undefined;
    let snapshots;
    try {
      snapshots = await client.runScript();
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
    return { serverSnapshot, retained, snapshots, steps: client.steps.map(([name]) => [name]) };
  } finally {
    dispose?.();
    if (dispose)
      assert.equal(vi.getTimerCount(), 0, "component disposal must leave no pending API timers");
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

it("records Todos", async () => {
  const mode = process.env.NATIVE_TODOS_MODE;
  const hydrated = process.env.NATIVE_TODOS_HYDRATED === "1";
  assert.ok(mode === "native" || mode === "original");
  const result = await record(mode, hydrated);
  const output = process.env.NATIVE_TODOS_OUTPUT;
  assert.ok(output);
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(output, JSON.stringify(result));
});
