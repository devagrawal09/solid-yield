// Builds the runtime variants: client / server × production / development,
// plus the `h` entry (which imports the runtime through the
// package's own name, so an app holds one copy of the runtime state).
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const external = ["solid-js", "@solidjs/web", "@solidjs/h", "@solidjs/blocks"];

const variants = [
  { entry: "src/index.ts", out: "dist/blocks.js", dev: false, server: false },
  { entry: "src/index.ts", out: "dist/blocks.dev.js", dev: true, server: false },
  { entry: "src/index.ts", out: "dist/server.js", dev: false, server: true },
  { entry: "src/index.ts", out: "dist/server.dev.js", dev: true, server: true },
  { entry: "src/h.ts", out: "dist/h.js", dev: false, server: false },
  { entry: "src/h.ts", out: "dist/h.dev.js", dev: true, server: false },
  { entry: "src/jsx-runtime.ts", out: "dist/jsx-runtime.js", dev: false, server: false }
];

import { existsSync } from "node:fs";

await Promise.all(
  variants
    .filter(v => existsSync(path.join(root, v.entry)))
    .map(v =>
    build({
      absWorkingDir: root,
      entryPoints: [v.entry],
      outfile: v.out,
      bundle: true,
      format: "esm",
      platform: "neutral",
      target: "es2022",
      external,
      treeShaking: true,
      minifySyntax: !v.dev,
      define: { __DEV__: String(v.dev), __SERVER__: String(v.server) },
      logLevel: "warning"
    })
  )
);
