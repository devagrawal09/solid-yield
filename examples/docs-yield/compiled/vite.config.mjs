import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import solidYield from "vite-plugin-solid-yield";
import eagerIslands from "../../../packages/compiler-yield/src/eager.js";
import { resolve } from "node:path";
const directory = resolve(import.meta.dirname, "..");
export default defineConfig({
  root: resolve(directory, "stream"),
  plugins: [eagerIslands({ directory }), solidYield(), solid({ ssr: true })],
  build: {
    sourcemap: true,
    emptyOutDir: true,
    manifest: true,
    outDir: resolve(import.meta.dirname, "dist/client"),
    rollupOptions: { input: resolve(directory, "stream/client.tsx") }
  }
});
