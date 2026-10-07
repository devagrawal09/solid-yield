import docsLevelPlugin from "../../harness/docs-level.mjs";
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import solidYield from "vite-plugin-solid-yield";
export default defineConfig({
  root: import.meta.dirname,
  plugins: [docsLevelPlugin(),solidYield(), solid({ ssr: true })],
  build: {
    manifest: true,
    rollupOptions: { input: new URL("./client.tsx", import.meta.url).pathname }
  }
});
