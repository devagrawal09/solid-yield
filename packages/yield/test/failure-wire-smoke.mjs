// Real production stream hydration followed by a server-function HTTP rejection.
// One fresh process per class: no reset or patch of Solid's hydration internals.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const self = fileURLToPath(import.meta.url);
const pkg = resolve(dirname(self), "..");
const root = resolve(pkg, "../..");
const which = process.argv[2];
if (!which) {
  for (const name of ["missing", "sibling"]) {
    const run = spawnSync(process.execPath, [self, name], {
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 1_000_000,
      env: { ...process.env, NODE_ENV: "production" }
    });
    if (run.error || run.status !== 0) {
      console.error(
        (run.stderr || run.stdout || String(run.error)).split("\n").slice(-25).join("\n")
      );
      process.exit(1);
    }
    process.stdout.write(run.stdout);
  }
  process.exit(0);
}
assert.ok(["missing", "sibling"].includes(which));
process.env.NODE_ENV = "production";
const require = createRequire(join(pkg, "package.json"));
const pluginRequire = createRequire(require.resolve("@solidjs/vite-plugin"));
const vite = await import(pathToFileURL(pluginRequire.resolve("vite")).href);
const solidModule = await import(pathToFileURL(require.resolve("@solidjs/vite-plugin")).href);
const solid = solidModule.default.default ?? solidModule.default;
const solidYield = (
  await import(pathToFileURL(join(root, "packages/vite-plugin-yield/src/index.js")).href)
).default;
const fixture = join(pkg, "test/wire-smoke");
const cache = join(pkg, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const output = mkdtempSync(join(cache, "failure-wire-"));
const errors = [];
process.on("unhandledRejection", error => errors.push(String(error)));
const oldError = console.error,
  oldWarn = console.warn;
console.error = console.warn = (...args) => errors.push(args.map(String).join(" "));
let dom, dispose;
try {
  async function bundle(server) {
    const entry = join(fixture, server ? "server.tsx" : "client.tsx");
    const result = await vite.build({
      configFile: false,
      root: fixture,
      mode: "production",
      logLevel: "silent",
      plugins: [solidYield(), solid({ ssr: true })],
      resolve: {
        alias: [
          {
            find: /^solid-yield$/,
            replacement: join(pkg, "dist", server ? "server.js" : "yield.js")
          },
          {
            find: /^solid-yield\/internal$/,
            replacement: join(pkg, "dist", server ? "internal.server.js" : "internal.js")
          }
        ]
      },
      ssr: { noExternal: ["solid-yield"] },
      build: {
        ssr: server ? entry : false,
        outDir: join(output, server ? "server" : "client"),
        emptyOutDir: true,
        rollupOptions: { input: entry, preserveEntrySignatures: "strict" }
      }
    });
    return pathToFileURL(
      join(
        output,
        server ? "server" : "client",
        result.output.find(c => c.type === "chunk" && c.isEntry).fileName
      )
    ).href;
  }
  const serverPath = await bundle(true),
    clientPath = await bundle(false);
  const server = await import(serverPath);
  const html = await server.page();
  dom = new JSDOM(html, { url: "http://localhost/" });
  for (const key of [
    "window",
    "document",
    "Node",
    "Element",
    "HTMLElement",
    "navigator",
    "MutationObserver"
  ])
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
  // Execute only the renderer's hydration scripts, like the existing hydrate smoke.
  // Registry restoration itself never evaluates code or runs a constructor.
  for (const [, body] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) (0, eval)(body);
  const original = document.querySelector("button");
  const { start } = await import(clientPath);
  let calls = 0;
  const fetcher = async (address, init) => {
    calls++;
    const headers = new Headers(init.headers);
    headers.set("Origin", "http://localhost");
    const response = await server.handle(
      new Request(new URL(address, "http://localhost/"), { ...init, headers })
    );
    const wire = await response.clone().text();
    assert.ok(
      wire.includes(which === "missing" ? "rpc/NotFound" : "rpc/Sibling"),
      "RPC carries the exact class ID"
    );
    assert.ok(
      wire.includes("not-found") && wire.includes("RPC " + which),
      "production keeps kind and message"
    );
    if (which === "missing") assert.ok(wire.includes("rpc own prop"), "production keeps own data");
    return response;
  };
  dispose = start(fetcher, which);
  assert.equal(document.querySelector("button"), original, "hydration claims the server button");
  assert.equal(calls, 0, "RPC starts only after hydration");
  original.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  for (let i = 0; i < 100 && !document.querySelector("p"); i++)
    await new Promise(r => setTimeout(r, 10));
  assert.equal(calls, 1);
  const fallback = document.querySelector("." + which);
  assert.ok(fallback, document.body.innerHTML);
  assert.equal(fallback.dataset.instance, "true");
  assert.equal(fallback.dataset.kind, "not-found");
  assert.equal(fallback.textContent, "RPC " + which);
  if (which === "missing") assert.equal(fallback.dataset.detail, "rpc own prop");
  if (which === "sibling")
    assert.equal(document.querySelector(".missing"), null, "same-kind sibling bypasses NotFound");
  assert.deepEqual(errors, [], "no hydration errors or unhandled rejections");
  console.log(
    `PASS production RPC after streamed hydration: ${which} (instanceof, selective fallback, public data)`
  );
} finally {
  dispose?.();
  dom?.window.close();
  console.error = oldError;
  console.warn = oldWarn;
  rmSync(output, { recursive: true, force: true });
}
