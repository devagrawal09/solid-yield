import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { populateGlobal } from "vitest/runtime";
import solidYield from "../../../packages/vite-plugin-yield/src/vite.js";
// The Effect original, run as plain Solid, as the author's fix, and as that
// fix's native model (emit "lowered"): the twin's script (fake time, scripted
// Math.random), a DOM snapshot after every step.
const root = resolve(import.meta.dirname, "../../..");
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const vite = await import(pathToFileURL(require.resolve("vite")).href);
const solid = require("@solidjs/vite-plugin").default;
const original = join(root, "examples/originals/effect");
// check.mjs writes the author's fix (author-fix.json) here as a project of its own.
const fixed = join(original, ".native-generated/fixed");
const script = join(root, "examples/effect-yield/tests/script.ts");
const host = join(root, "examples/effect-yield");
const entryId = join(host, ".native-generated/effect-entry.tsx");

async function record(mode) {
  const src = join(mode === "original" ? original : fixed, "src");
  const dom = new JSDOM("<html><body></body></html>", {
    url: "http://localhost",
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
    // A cache of its own: the root's node_modules/.vite is shared with
    // concurrent runs, whose dependency optimizers would rewrite it under this one.
    cacheDir: mkdtempSync(join(tmpdir(), "yield-vite-")),
    root: host,
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    // No watcher: a tsconfig.json added or removed under the root (another
    // run's materialized copy) makes Vite re-evaluate every module mid-run.
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: {
      dedupe: ["solid-yield", "solid-js", "@solidjs/web"],
      conditions: ["development", "browser"]
    },
    plugins: [
      {
        name: "effect:entry",
        enforce: "pre",
        resolveId(id) {
          if (id === "/effect-entry.tsx") return entryId;
        },
        load(id) {
          if (id === entryId)
            return `
            export {install, uninstall, runScript, steps} from ${JSON.stringify(script)};
            export const mount = () => import(${JSON.stringify(join(src, "main.tsx"))});
          `;
          if (id.includes("/vite/dist/client/client.mjs"))
            return "export const updateStyle=()=>{},removeStyle=()=>{},injectQuery=url=>url; export class ErrorOverlay {} export const createHotContext=()=>({accept(){},acceptExports(){},dispose(){},prune(){},decline(){},send(){},on(){},off(){},invalidate(){},data:{}});";
        }
      },
      ...(mode === "native"
        ? [
            solidYield({
              mode: "native",
              emit: "lowered",
              include: file => file.startsWith(src + "/")
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
  try {
    const client = await server.environments.hydrate.runner.import("/effect-entry.tsx");
    client.install();
    await client.mount();
    const snapshots = await client.runScript().catch(error => {
      error.message += `\n${mode} console:\n${logs.join("\n")}\nDOM: ${document.body.innerHTML.slice(0, 400)}`;
      throw error;
    });
    const steps = client.steps.map(([name]) => [name]);
    client.uninstall();
    return { snapshots, steps, logs };
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
    await server.close();
    rmSync(server.config.cacheDir, { recursive: true, force: true });
    document.body.innerHTML = "";
    dom.window.close();
    for (const key of populated.keys) delete globalThis[key];
    for (const [key, value] of populated.originals) globalThis[key] = value;
  }
}

it("records the Effect original", async () => {
  const mode = process.env.NATIVE_EFFECT_MODE;
  assert.ok(mode === "original" || mode === "fixed" || mode === "native");
  const result = await record(mode);
  const output = process.env.NATIVE_EFFECT_OUTPUT;
  assert.ok(output);
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(output, JSON.stringify(result));
});
