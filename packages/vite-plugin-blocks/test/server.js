// A Vite dev server for the tests: middleware mode (no port, no websocket),
// no dependency discovery, and a cache directory of its own. The default cache
// sits in the nearest node_modules/.vite, which another test file's server —
// or, under the gate, a twin's own test run — would be writing at the same
// time.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import solid from "@solidjs/vite-plugin";
import { createServer } from "vite";
import blocks from "../src/index.js";

export async function devServer(root) {
  const cacheDir = mkdtempSync(join(tmpdir(), "vite-plugin-blocks-"));
  const server = await createServer({
    root,
    cacheDir,
    configFile: false,
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [blocks(), solid({ ssr: true })]
  });
  const close = server.close.bind(server);
  server.close = async () => {
    await close();
    rmSync(cacheDir, { recursive: true, force: true });
  };
  return server;
}
