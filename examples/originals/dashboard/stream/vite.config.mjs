import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
export default defineConfig({
  root: import.meta.dirname,
  plugins: [solid({ ssr: true })],
  build: {
    manifest: true,
    rollupOptions: { input: new URL("./client.tsx", import.meta.url).pathname }
  }
});
