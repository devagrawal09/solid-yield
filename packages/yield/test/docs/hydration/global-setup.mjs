import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
// The guide's install adds Vite directly. Here it is the Solid plugin's peer.
const pluginRequire = createRequire(createRequire(import.meta.url).resolve("@solidjs/vite-plugin"));
const { createServer } = await import(pathToFileURL(pluginRequire.resolve("vite")).href);
export default async function setup(project) {
  const vite = await createServer({
    // A cache of its own: the package's node_modules/.vite is the test run's.
    cacheDir: mkdtempSync(join(tmpdir(), "yield-vite-")),
    configFile: resolve("vite.config.docs-ssr.mjs"),
    mode: "hydrate",
    // No watcher: a tsconfig.json added or removed under the root (another
    // run's materialized copy) makes Vite re-evaluate every module mid-run.
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
    logLevel: "error"
  });
  try {
    const { App } = await vite.ssrLoadModule("/test/docs/hydration/app.tsx");
    const { renderToString, renderToStream } = await vite.ssrLoadModule("solid-yield");
    const { generateHydrationScript } = await vite.ssrLoadModule("@solidjs/web");
    let body = "";
    const decoder = new TextDecoder();
    await renderToStream(App).pipeTo(
      new WritableStream({
        write(chunk) {
          body += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
        },
        close() {
          body += decoder.decode();
        }
      })
    );
    const page = body => `${generateHydrationScript()}<div id="app">${body}</div>`;
    project.provide("docsHydration", { string: page(renderToString(App)), stream: page(body) });
  } finally {
    await vite.close();
    rmSync(vite.config.cacheDir, { recursive: true, force: true });
  }
}
