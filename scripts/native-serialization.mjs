// The production package conditions: no development flag, no test source aliases.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(new URL("../packages/yield/package.json", import.meta.url));
const { component, $memo, attempt, view, Loading, renderToStream } = await import(
  pathToFileURL(require.resolve("solid-yield")).href
);
const { nativeFailure, registerNativeFailure } = await import(
  pathToFileURL(require.resolve("solid-yield/internal")).href
);
const { isSafeError } = await import(pathToFileURL(require.resolve("@solidjs/web")).href);
class Rejected extends Error {}
registerNativeFailure("production#Rejected", Rejected);
assert.equal(
  isSafeError(nativeFailure(["production#Rejected"], new Rejected("public native failure"))),
  true
);
const App = component(function* () {
  const value = yield* $memo(function* () {
    return yield* attempt(
      () => Promise.reject(new Rejected("public native failure")),
      e => nativeFailure(["production#Rejected"], e)
    );
  });
  return view(function* () {
    return String(yield* value);
  });
});
const previous = { error: console.error, warn: console.warn };
console.error = console.warn = () => {};
let html;
try {
  html = await new Promise(resolve => {
    const chunks = [];
    renderToStream(() => Loading({ fallback: "loading", children: App }), { manifest: {} }).pipe({
      write(c) {
        chunks.push(c);
      },
      end() {
        resolve(chunks.join(""));
      }
    });
  });
} finally {
  Object.assign(console, previous);
}
assert.match(html, /name:"NativeFailure"/);
assert.match(html, /kind:"production#Rejected"/);
assert.match(html, /public native failure/);
console.log("native failure: production stream retains class identity and safe message");

// F-S17: D-115 intentionally differs from unmarked Solid Error sanitization.
// Use a fresh production Vite server outside Vitest's development module graph.
const { devServer } = await import("../packages/vite-plugin-yield/test/server.js");
const { resolve } = await import("node:path");
const fixture = resolve(
  import.meta.dirname,
  "../packages/vite-plugin-yield/test/fixtures/native-app"
);
const server = await devServer(fixture, {
  mode: "native",
  include: file => file === resolve(fixture, "FailureView.tsx")
});
try {
  const entry = await server.ssrLoadModule("/failure-entry.tsx");
  assert.match(entry.original(), /<p[^>]*>wrong identity<\/p>/);
  assert.match(entry.native(), /<p[^>]*>author failure<\/p>/);
  console.log(
    "F-S17: original SSR sanitizes the unmarked Error; native D-115 retains its safe message"
  );
} finally {
  await server.close();
}
