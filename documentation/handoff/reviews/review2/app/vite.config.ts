import { defineConfig } from "vite";
import solidYield from "vite-plugin-solid-yield";
import solid from "@solidjs/vite-plugin";
export default defineConfig({ plugins: [solidYield({ mode: "native", include: ["src/**"] }), solid()] });
