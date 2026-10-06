import { defineConfig } from "vite";
// Exercises the current @solidjs/vite-plugin pipeline: native JSX compiler by
// default, native lazy/refresh passes, solid-js/refresh HMR runtime.
import solid from "@solidjs/vite-plugin";
import solidYield from "vite-plugin-solid-yield";

export default defineConfig({
  root: import.meta.dirname,
  publicDir: "../shared/static",
  plugins: [solidYield(), solid()],
  server: { port: 3000 },
  preview: { port: 3000 }
});
