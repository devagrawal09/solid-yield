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
const main = join(root, "examples/originals/sierpinski/src/main.tsx");
const script = join(root, "examples/sierpinski-yield/tests/script.ts");

async function record(mode, hydrated) {
  const dom = new JSDOM("<html><body></body></html>", {
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
    root: join(root, "examples/sierpinski-yield"),
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { dedupe: ["solid-yield", "solid-js", "@solidjs/web"] },
    ssr: { noExternal: ["solid-yield", "solid-js", "@solidjs/web", "@solidjs/signals"] },
    plugins: [
      {
        name: "sierpinski:entries",
        enforce: "pre",
        resolveId(id) {
          if (id === "/sierpinski-entry.tsx")
            return join(root, "examples/sierpinski-yield/.native-generated/sierpinski-entry.tsx");
        },
        load(id) {
          if (id === main)
            return readFileSync(main, "utf8").replace(
              /render\(TriangleDemo, document.body\);/,
              "export { TriangleDemo };"
            );
          if (id === join(root, "examples/sierpinski-yield/.native-generated/sierpinski-entry.tsx"))
            return `
            import {TriangleDemo} from ${JSON.stringify(main)};
            import {render, hydrate, renderToStream} from ${JSON.stringify(mode === "native" ? "solid-yield" : "@solidjs/web")};
            export {generateHydrationScript} from "@solidjs/web";
            export {installClocks,uninstallClocks,runScript,steps} from ${JSON.stringify(script)};
            export const ssr=()=>renderToStream(TriangleDemo);
            export const mount=()=>${hydrated ? "hydrate" : "render"}(TriangleDemo,document.body);
          `;
          if (id.includes("/vite/dist/client/client.mjs"))
            return "export const createHotContext=()=>({accept(){},acceptExports(){},dispose(){},prune(){},on(){},off(){},invalidate(){},data:{}});";
        }
      },
      ...(mode === "native"
        ? [solidYield({ mode: "native", emit: "lowered", include: file => file === main })]
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
    const entry = await server.ssrLoadModule("/sierpinski-entry.tsx");
    client = await server.environments.hydrate.runner.import("/sierpinski-entry.tsx");
    let html, scripts;
    if (hydrated) {
      entry.installClocks();
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
        await vi.advanceTimersByTimeAsync(10);
        await complete;
        html = htmlOut;
      } finally {
        entry.uninstallClocks();
      }
      const full = scripts + html;
      const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
      document.body.innerHTML = full.replace(scriptRe, "");
      for (const match of full.matchAll(scriptRe)) (0, eval)(match[1]);
    } else document.body.innerHTML = "";
    const serverSnapshot = hydrated ? document.body.innerHTML : undefined;
    if (process.env.NATIVE_SIERPINSKI_SMOKE === "1") {
      assert.deepEqual(
        logs.filter(m => !m.startsWith("[SSR_BOUNDARY_WATERFALL]")),
        []
      );
      return { serverSnapshot };
    }
    const before = [...document.querySelectorAll(".container,.dot")];
    client.installClocks();
    dispose = client.mount();
    const retained = hydrated
      ? before.length === 730 &&
        before.every((node, index) => node === document.querySelectorAll(".container,.dot")[index])
      : undefined;
    const snapshots = await client.runScript();
    // Recursive idle work may trigger these performance advisories. Hydration,
    // driver and rendering diagnostics remain failures.
    assert.deepEqual(
      logs.filter(m => !/^\[(SSR_BOUNDARY_WATERFALL|HUGE_FAN_IN)\]/.test(m)),
      []
    );
    return { serverSnapshot, retained, snapshots, steps: client.steps.map(([name]) => [name]) };
  } finally {
    dispose?.();
    if (dispose) assert.equal(vi.getTimerCount(), 0, "component disposal must cancel its clocks");
    client?.uninstallClocks();
    await server.close();
    warn.mockRestore();
    error.mockRestore();
    document.body.innerHTML = "";
    delete globalThis._$HY;
    dom.window.close();
    for (const key of populated.keys) delete globalThis[key];
    for (const [key, value] of populated.originals) globalThis[key] = value;
  }
}

it("records Sierpinski", async () => {
  const mode = process.env.NATIVE_SIERPINSKI_MODE;
  const hydrated = process.env.NATIVE_SIERPINSKI_HYDRATED === "1";
  assert.ok(mode === "native" || mode === "original");
  const result = await record(mode, hydrated);
  const output = process.env.NATIVE_SIERPINSKI_OUTPUT;
  assert.ok(output);
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(output, JSON.stringify(result));
});
