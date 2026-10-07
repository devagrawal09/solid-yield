import docsLevelPlugin from "../../harness/docs-level.mjs";
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import solidYield from "vite-plugin-solid-yield";
import eagerIslands from "../../../packages/compiler-yield/src/eager.js";
import { resolve } from "node:path";
import serverComponents from "../../../packages/compiler-yield/src/server-components.js";
const r = process.env.C3_REGIONS === "1";
const directory = resolve(import.meta.dirname, "..");
export default defineConfig({
  root: resolve(directory, "stream"),
  plugins: [docsLevelPlugin(),
    eagerIslands({ directory, roots: r ? "single" : (process.env.C2_ROOTS ?? "per-group") }),
    ...(r ? [serverComponents({ directory })] : []),
    solidYield(),
    solid({
      ssr: true,
      ...(r
        ? {
            serverFunctions: {
              components: true,
              filter: { include: [directory + "/src/__compiler_regions.tsx"] }
            }
          }
        : {})
    })
  ],
  build: {
    sourcemap: true,
    emptyOutDir: true,
    manifest: true,
    outDir: resolve(import.meta.dirname, "dist/client"),
    rollupOptions: { input: resolve(directory, "stream/client.tsx") }
  }
});
