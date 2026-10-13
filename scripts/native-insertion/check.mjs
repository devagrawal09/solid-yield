#!/usr/bin/env node
// The insertion's differential check (S20, documentation/calculus-proofs/sugar.md).
// S20 proves, on a core of plain Solid expressions, that the lowered routine
// computes what Solid computes: the same value, the same tracked reads, the
// same suspension and failure. Its premise is that the lowering inserts
// `yield*` at exactly the reads TypeScript types as sources. This checks that
// premise on the real lowering: seeded programs (generate.mjs) run as written
// and lowered by native mode, side by side on one Solid runtime, and every
// memo's slot (its value, its Errored fallback, its Loading fallback) must
// match after mounting and after each write.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import solidYield from "../../packages/vite-plugin-yield/src/vite.js";
import { program, writes } from "./generate.mjs";

const root = resolve(import.meta.dirname, "../..");
// The gate runs seeds 1–8; a wider sweep runs further batches
// (NATIVE_INSERTION_FROM=9 NATIVE_INSERTION_SEEDS=10 …). One batch is one
// project, lowered in one module fetch, which Vite bounds at 60 s.
const FROM = Number(process.env.NATIVE_INSERTION_FROM) || 1;
const SEEDS = Number(process.env.NATIVE_INSERTION_SEEDS) || 8;
const seeds = Array.from({ length: SEEDS }, (_, i) => FROM + i);
const require = createRequire(join(root, "examples/rendering-yield/package.json"));
const pluginRequire = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const vite = await import(pathToFileURL(pluginRequire.resolve("vite")).href);
const solid = pluginRequire("@solidjs/vite-plugin").default;
const { JSDOM } = require("jsdom");
const { populateGlobal } = await import(pathToFileURL(require.resolve("vitest/runtime")).href);

const dir = join(
  root,
  `packages/vite-plugin-yield/test/.native-generated/insertion-${process.pid}`
);
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      strict: true,
      target: "ESNext",
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "preserve",
      jsxImportSource: "solid-js",
      skipLibCheck: true
    },
    include: ["*.tsx"]
  })
);
for (const seed of seeds) {
  const { source } = program(seed);
  writeFileSync(join(dir, `Native${seed}.tsx`), source);
  writeFileSync(join(dir, `Original${seed}.tsx`), source);
}
writeFileSync(
  join(dir, "entry.tsx"),
  `import { flush } from "solid-js";
import { render as renderNative } from "solid-yield";
import { render as renderOriginal } from "@solidjs/web";
${seeds.map(s => `import { App as Native${s} } from "./Native${s}";\nimport { App as Original${s} } from "./Original${s}";`).join("\n")}
export { flush };
export const apps: Record<number, [(el: HTMLElement) => () => void, (el: HTMLElement) => () => void]> = {
${seeds.map(s => `  ${s}: [el => renderNative(Native${s}, el), el => renderOriginal(Original${s}, el)]`).join(",\n")}
};
`
);

const dom = new JSDOM("<html><body></body></html>", {
  url: "http://localhost",
  pretendToBeVisual: true
});
const populated = populateGlobal(globalThis, dom.window, { bindFunctions: true });
const logs = [];
console.warn = (...args) => logs.push(args.join(" "));
console.error = (...args) => logs.push(args.join(" "));
const server = await vite.createServer({
  // A cache of its own: the root's node_modules/.vite is shared with
  // concurrent runs, whose dependency optimizers would rewrite it under this one.
  cacheDir: mkdtempSync(join(tmpdir(), "yield-vite-")),
  root: dir,
  configFile: false,
  logLevel: "silent",
  appType: "custom",
  // No watcher: a tsconfig.json added or removed under the root (another
  // run's materialized copy) makes Vite re-evaluate every module mid-run.
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [
    solidYield({
      mode: "native",
      emit: "lowered",
      include: file => /\/Native\d+\.tsx$/.test(file) && file.startsWith(dir)
    }),
    solid({ ssr: true }),
    {
      name: "native-insertion:no-hmr",
      enforce: "pre",
      applyToEnvironment: e => e.name === "hydrate",
      load(id) {
        if (id.includes("/vite/dist/client/client.mjs"))
          return "export const createHotContext=()=>({accept(){},acceptExports(){},dispose(){},prune(){},on(){},off(){},invalidate(){},data:{}});";
      }
    }
  ],
  environments: {
    hydrate: {
      consumer: "client",
      optimizeDeps: { noDiscovery: true, include: [] },
      dev: {
        moduleRunnerTransform: true,
        createEnvironment: (name, config) =>
          vite.createRunnableDevEnvironment(name, config, { runnerOptions: { hmr: false } })
      }
    }
  }
});

const slots = el => [...el.querySelectorAll("li[data-m]")].map(li => li.textContent);
let states = 0,
  failed = 0,
  pending = 0,
  changed = 0;
try {
  const { apps, flush } = await server.environments.hydrate.runner.import("/entry.tsx");
  // the native copies run lowered (an include that matched nothing would
  // compare each program with itself)
  const library = /\/yield\/dist\/yield(\.dev)?\.js"/;
  for (const seed of seeds) {
    const native = await server.environments.hydrate.transformRequest(`/Native${seed}.tsx`);
    const original = await server.environments.hydrate.transformRequest(`/Original${seed}.tsx`);
    assert.match(native.code, library, `Native${seed}.tsx was not lowered`);
    assert.doesNotMatch(original.code, library, `Original${seed}.tsx was lowered`);
  }
  const settle = async () => {
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 0));
      flush();
    }
  };
  for (const seed of seeds) {
    const native = document.createElement("div"),
      original = document.createElement("div");
    document.body.append(native, original);
    const [mountNative, mountOriginal] = apps[seed];
    const disposers = [mountNative(native), mountOriginal(original)];
    flush();
    // the async source is pending at mount: both show their Loading fallbacks
    pending += slots(original).filter(s => s === "…").length;
    assert.deepEqual(slots(native), slots(original), `seed ${seed}, mounting`);
    await settle();
    let previous = slots(original);
    const compare = step => {
      const now = slots(original);
      assert.deepEqual(slots(native), now, `seed ${seed}, ${step}`);
      states++;
      failed += now.filter(s => s.startsWith("RangeError")).length;
      changed += now.filter((s, i) => s !== previous[i]).length;
      previous = now;
    };
    compare("settled");
    for (const [index, button] of writes(seed).entries()) {
      for (const el of [native, original])
        el.querySelector(`[data-w="${button}"]`).dispatchEvent(
          new dom.window.MouseEvent("click", { bubbles: true })
        );
      await settle();
      compare(`write ${index + 1} (${button})`);
    }
    for (const dispose of disposers) dispose();
    native.remove();
    original.remove();
  }
  assert.deepEqual(logs, []);
  // the check is not vacuous: values changed, memos failed and suspended
  assert.ok(changed > 0 && failed > 0 && pending > 0, JSON.stringify({ changed, failed, pending }));
  console.log(
    `native insertion: ${seeds.length} seeded programs, ${states} states match as written ` +
      `(${changed} slot changes, ${failed} failed slots, ${pending} pending at mount)`
  );
} finally {
  await server.close();
  rmSync(server.config.cacheDir, { recursive: true, force: true });
  rmSync(dir, { recursive: true, force: true });
  dom.window.close();
  for (const key of populated.keys) delete globalThis[key];
  for (const [key, value] of populated.originals) globalThis[key] = value;
}
