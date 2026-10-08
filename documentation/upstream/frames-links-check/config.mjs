import { createServer, createRunnableDevEnvironment } from "vite";
import { readFileSync } from "node:fs";
import plugin from "@solidjs/vite-plugin";
const solid = typeof plugin === "function" ? plugin : plugin.default;
export function makeServer(mode, client = false) {
  return createServer({
    root: import.meta.dirname,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    mode: "production",
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [
      {
        name: "mode",
        enforce: "pre",
        load(id) {
          if (mode === "hosted-fixed" && id.endsWith("/hosted.ts"))
            return readFileSync(new URL("./hosted-fixed.ts", import.meta.url), "utf8");
        },
        transform(code, id) {
          if (id.startsWith(import.meta.dirname + "/") && /\.[jt]sx?$/.test(id))
            return code.replaceAll("__MODE__", mode === "hosted-fixed" ? "hosted" : mode);
        }
      },
      {
        name: "no-hmr",
        enforce: "pre",
        applyToEnvironment: e => e.name === "hydrate",
        load(id) {
          if (/\/vite\/dist\/client\/client\.mjs$/.test(id))
            return "export const createHotContext=()=>({data:{},accept(){},dispose(){}});";
        }
      },
      solid({
        hot: false,
        ssr: true,
        serverFunctions: {
          components: true,
          filter: { include: [import.meta.dirname + "/region.tsx"] }
        }
      })
    ],
    environments: client
      ? {
          hydrate: {
            consumer: "client",
            resolve: { conditions: ["browser", "production"] },
            optimizeDeps: { noDiscovery: true, include: [] },
            dev: {
              moduleRunnerTransform: true,
              createEnvironment: (name, config) =>
                createRunnableDevEnvironment(name, config, { runnerOptions: { hmr: false } })
            }
          }
        }
      : undefined
  });
}
