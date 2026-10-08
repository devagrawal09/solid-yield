import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";
import solid from "@solidjs/vite-plugin";
import solidYield from "vite-plugin-solid-yield";

const examples = fileURLToPath(new URL("..", import.meta.url));

/**
 * `~/…` resolves against the `src/` of the example the importer lives in, so
 * the parity test loads examples/originals/room (the original) and this twin side by
 * side, each with its own modules (and its own in-memory rooms).
 */
function exampleAlias(): Plugin {
  return {
    name: "example-tilde-alias",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!source.startsWith("~/") || !importer) return null;
      // an original sits one level deeper, under examples/originals/
      const [first, second] = relative(examples, dirname(importer)).split(sep);
      const example = first === "originals" ? join(first, second) : first;
      return this.resolve(join(examples, example, "src", source.slice(2)), importer, {
        skipSelf: true
      });
    }
  };
}

// The tests run both apps client-only in jsdom: no `start` entries and no
// server-function transform. `@solidjs/web/server-functions` is the
// in-process fake in tests/fake-server-functions.ts, so the `"use server"`
// bodies (the live sources) run here against the
// in-memory rooms. The wire itself — SSR, hydration, event streams, morphs —
// is covered by the browser check (scripts/example-blocks/browser.mjs).
export default defineConfig({
  plugins: [exampleAlias(), solidYield(), solid()],
  resolve: {
    alias: [
      {
        find: /^@solidjs\/web\/server-functions$/,
        replacement: fileURLToPath(new URL("./tests/fake-server-functions.ts", import.meta.url))
      }
    ],
    conditions: process.env.YIELD_COST_PROD ? ["browser"] : ["development", "browser"]
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [fileURLToPath(new URL("./tests/request-context.setup.ts", import.meta.url))],
    include: ["tests/**/*.test.tsx"]
  }
});
