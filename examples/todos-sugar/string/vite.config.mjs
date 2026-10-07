import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import solidYield from "vite-plugin-solid-yield";
export default defineConfig({
  root: import.meta.dirname,
  plugins: [solidYield(), solid({ ssr: true })]
});
