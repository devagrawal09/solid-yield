// Builds the runtime variants: client / server × production / development,
// for the runtime itself (`solid-yield/internal`) and the root entry, plus
// the `h` entry. The root and `h` import the runtime through the package's
// `internal` subpath (the root's `./runtime.js` is rewritten to it), so an
// app holds one copy of the runtime state.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const external = ["solid-js", "@solidjs/web", "@solidjs/h", "solid-yield", "solid-yield/internal"];

/** Outside `internal.ts`, the runtime module is the `internal` entry, not a second copy. */
const runtimeIsInternal = {
  name: "runtime-is-internal",
  setup(b) {
    b.onResolve({ filter: /^\.\/runtime\.js$/ }, args =>
      args.importer.endsWith(path.join("src", "internal.ts"))
        ? undefined
        : { path: "solid-yield/internal", external: true }
    );
  }
};

const variants = [
  { entry: "src/internal.ts", out: "dist/internal.js", dev: false, server: false },
  { entry: "src/internal.ts", out: "dist/internal.dev.js", dev: true, server: false },
  { entry: "src/internal.ts", out: "dist/internal.server.js", dev: false, server: true },
  { entry: "src/internal.ts", out: "dist/internal.server.dev.js", dev: true, server: true },
  { entry: "src/index.ts", out: "dist/yield.js", dev: false, server: false },
  { entry: "src/index.ts", out: "dist/yield.dev.js", dev: true, server: false },
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
        plugins: [runtimeIsInternal],
        treeShaking: true,
        minifySyntax: !v.dev,
        define: {
          __DEV__: String(v.dev),
          __SERVER__: String(v.server),
          __YIELD_SOAK__: String(process.env.YIELD_SOAK_DEBUG === "1")
        },
        logLevel: "warning"
      })
    )
);
