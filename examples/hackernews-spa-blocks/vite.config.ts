import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import blocks from "@solidjs/vite-plugin-blocks";

// examples/hackernews-spa's turnkey SSR: `start: {}` (with `ssr: true`)
// generates the entries and the serving layer around src/app.tsx;
// `serverFunctions` serves the `/_server` endpoint the `"use server"`
// modules dispatch through.
export default defineConfig({
  resolve: {
    alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  server: { port: 3005 },
  plugins: [blocks(), solid({ start: {}, ssr: true, serverFunctions: true })]
});
