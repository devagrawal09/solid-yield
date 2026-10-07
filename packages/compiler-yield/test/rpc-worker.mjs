// A separate process keeps server execution out of the browser coverage sample.
// The IPC carrier transports an unmodified HTTP Request/Response body stream.
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import serverComponents from "../src/server-components.js";
import solidYield from "../../vite-plugin-yield/src/index.js";
const require = createRequire(new URL("../package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(require.resolve("vite")));
const { default: plugin } = await import(pathToFileURL(require.resolve("@solidjs/vite-plugin")));
const solid = typeof plugin === "function" ? plugin : plugin.default;
const directory = resolve(import.meta.dirname, "../../../examples/docs-yield");
const server = await createServer({
  root: resolve(directory, "stream"),
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  mode: process.env.C2_PRODUCTION ? "production" : "development",
  server: { middlewareMode: true, hmr: false, ws: false },
  plugins: [
    serverComponents({ directory }),
    solidYield(),
    solid({
      hot: false,
      ssr: true,
      serverFunctions: {
        components: true,
        filter: { include: [directory + "/src/__compiler_regions.tsx"] }
      }
    })
  ]
});
await server.ssrLoadModule(resolve(directory, "src/__compiler_regions.tsx"));
const handler = await server.ssrLoadModule("virtual:solid-server-function-handler");
process.on("message", async ({ id, url, init }) => {
  try {
    const response = await handler.handleServerFunctionRequest(new Request(url, init));
    process.send({ id, status: response.status, headers: Object.fromEntries(response.headers) });
    if (response.body)
      for await (const chunk of response.body)
        process.send({ id, chunk: Buffer.from(chunk).toString("base64") });
    process.send({ id, end: true });
  } catch (error) {
    process.send({ id, error: String(error.stack) });
  }
});
process.on("disconnect", async () => {
  await server.close();
  process.exit();
});
const api = await server.ssrLoadModule(resolve(directory, "src/api.ts"));
const jsonComparison = {};
for (const slug of ["start", "missing", "pipeline"]) {
  let value;
  try {
    value = await api.getArticle(slug);
  } catch (error) {
    value = { kind: "not-found", message: error.message };
  }
  const json = JSON.stringify(value);
  jsonComparison[slug] = {
    equivalentJsonBytes: Buffer.byteLength(json),
    equivalentJsonGzipBytes: gzipSync(json).length,
    libraryNetworkBytes: 0,
    json
  };
}
process.send({ ready: true, jsonComparison });
