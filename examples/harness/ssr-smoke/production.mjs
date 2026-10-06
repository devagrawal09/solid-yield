import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Real production bundles. Keep temporary output under node_modules so Node
// resolves the external server dependencies from this workspace.
export async function buildProduction(vite, dir, client = false) {
  const cache = join(dir, "node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  const output = mkdtempSync(join(cache, "docs-smoke-"));
  const configFile = join(dir, "stream/vite.config.mjs");
  const entry = join(dir, "stream/entry-server.tsx");
  const previousNodeEnv = process.env.NODE_ENV;
  // createServer may have set development in this same child process.
  process.env.NODE_ENV = "production";
  try {
    const result = await vite.build({
      configFile,
      mode: "production",
      logLevel: "silent",
      build: {
        ssr: entry,
        outDir: join(output, "server"),
        emptyOutDir: true,
        rollupOptions: { input: entry }
      }
    });
    const serverEntry = result.output.find(c => c.type === "chunk" && c.isEntry).fileName;
    const server = await import(pathToFileURL(join(output, "server", serverEntry)).href);
    let clientEntry;
    if (client) {
      const result = await vite.build({
        configFile,
        mode: "production",
        logLevel: "silent",
        build: { outDir: join(output, "client"), emptyOutDir: true }
      });
      clientEntry = pathToFileURL(
        join(output, "client", result.output.find(c => c.type === "chunk" && c.isEntry).fileName)
      ).href;
    }
    return { server, clientEntry, cleanup: () => rmSync(output, { recursive: true, force: true }) };
  } catch (error) {
    rmSync(output, { recursive: true, force: true });
    throw error;
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
}
