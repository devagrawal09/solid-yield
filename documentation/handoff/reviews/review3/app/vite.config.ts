import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import solidYield from "vite-plugin-solid-yield";
export default defineConfig({ plugins: [solidYield({ mode: "native", include: ["src/**"] }), solid()] });
