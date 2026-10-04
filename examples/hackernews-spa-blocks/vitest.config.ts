import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";
import solid from "@solidjs/vite-plugin";
import blocks from "vite-plugin-solid-blocks";

const examples = fileURLToPath(new URL("..", import.meta.url));

/**
 * `~/…` resolves against the `src/` of the example the importer lives in, so
 * the parity test loads examples/originals/hackernews-spa (the original) and this twin
 * side by side, each with its own modules.
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

// The tests run both apps client-only in jsdom (the development runtime): no
// `start` entries, no server functions. `~/lib/hn` is then an ordinary
// module whose `fetch` the tests answer from fixtures, so the routes, the
// router and every component run in process; SSR and hydration are covered
// by the browser check (scripts/example-blocks/browser.mjs).
export default defineConfig({
  plugins: [exampleAlias(), blocks(), solid()],
  resolve: { conditions: ["development", "browser"] },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.tsx"],
    // one copy of the router, compiled for the runtime the apps use
    server: { deps: { inline: [/@solidjs[+/]router/] } }
  }
});
