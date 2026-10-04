#!/usr/bin/env node
// The runtime cost of @solidjs/blocks run uncompiled (the library's
// interpreter; the JSX transform's one rule) against handwritten Solid on
// the same runtime.
//
//   node examples/blocks-harness/runtime-cost/measure.mjs [--reps N] [--wall]
//
// Each workload is bundled for production (vite + the blocks plugin + the
// solid plugin with the native compiler), mounted in jsdom, and run under Valgrind (cachegrind,
// no cache simulation) with `node --jitless`: the instruction count of R
// operations minus the count of the same process doing none, divided by R.
// Jitless keeps counts reproducible (a JIT's compile timing is not); `--wall`
// also reports JIT-enabled wall time per operation (median of 5 runs).
// Workloads: todos (add a todo, then toggle it, on a growing list),
// create (1,000 rows, then clear), update (every 10th of 1,000 rows).
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../../..");
const HARNESS = resolve(here, "..");
const OUT = process.env.OUT || join(ROOT, "node_modules/.cache/blocks-runtime-cost");
const reps = Number(process.argv[process.argv.indexOf("--reps") + 1]) || 20;
const wall = process.argv.includes("--wall");

// Bundle with an example's toolchain (vite, the blocks plugin before
// @solidjs/vite-plugin, as the twins do). The blocks plugin carries the JSX
// transform's rule since D-043; it is imported by path, as packages/blocks'
// test configs do.
const require = createRequire(join(HARNESS, "package.json"));
const { build } = await import(require.resolve("vite"));
const pluginModule = await import(require.resolve("@solidjs/vite-plugin"));
const solid = pluginModule.default?.default ?? pluginModule.default;
const { default: blocks } = await import(join(ROOT, "packages/vite-plugin-blocks/src/index.js"));
mkdirSync(OUT, { recursive: true });
const entries = ["solid-todos", "blocks-todos", "solid-rows", "blocks-rows"];
for (const name of entries) {
  await build({
    configFile: false,
    logLevel: "silent",
    root: here,
    plugins: [blocks(), solid()],
    resolve: { conditions: ["browser", "production"] },
    define: { "process.env.NODE_ENV": '"production"' },
    build: {
      outDir: join(OUT, name),
      emptyOutDir: true,
      minify: false,
      lib: { entry: join(here, `${name}.tsx`), formats: ["es"], fileName: () => "bench.js" }
    }
  });
}

// The process under measurement: jsdom, the bundle, then `reps` operations.
const runner = join(OUT, "run.mjs");
writeFileSync(
  runner,
  `import { createRequire } from "node:module";
const require = createRequire(${JSON.stringify(join(HARNESS, "package.json"))});
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><body></body>");
for (const k of ["window", "document", "Node", "Element", "HTMLElement", "Text", "Comment", "DocumentFragment", "Event", "MouseEvent", "InputEvent", "SVGElement", "navigator"])
  globalThis[k] ??= dom.window[k];
globalThis.window = dom.window;
const [bundle, workload, reps] = process.argv.slice(2);
const { mount } = await import(bundle);
const root = document.createElement("div");
document.body.appendChild(root);
const app = mount(root);
if (workload === "update") app.create();
const n = Number(reps);
const t0 = performance.now();
for (let i = 0; i < n; i++) {
  if (workload === "todos") app.op();
  else if (workload === "create") { app.create(); app.clear(); }
  else app.update();
}
const t1 = performance.now();
if (process.env.WALL) console.log("WALL", (t1 - t0) / n);
`
);

function run(bundle, workload, n) {
  const r = spawnSync(
    "valgrind",
    [
      "--tool=cachegrind",
      "--cache-sim=no",
      "--cachegrind-out-file=/dev/null",
      process.execPath,
      "--jitless",
      runner,
      bundle,
      workload,
      String(n)
    ],
    { encoding: "utf8", maxBuffer: 1 << 26 }
  );
  const m = /I\s+refs:\s+([\d,]+)/.exec(r.stderr);
  if (!m) throw new Error(`no instruction count:\n${r.stderr.slice(-3000)}`);
  return Number(m[1].replace(/,/g, ""));
}

function wallOf(bundle, workload) {
  const times = [];
  for (let i = 0; i < 5; i++) {
    const out = execFileSync(process.execPath, [runner, bundle, workload, "200"], {
      encoding: "utf8",
      env: { ...process.env, WALL: "1" }
    });
    times.push(Number(/WALL ([\d.]+)/.exec(out)[1]));
  }
  return times.sort((a, b) => a - b)[2];
}

const rows = [];
for (const [workload, kind] of [
  ["todos", "todos"],
  ["create", "rows"],
  ["update", "rows"]
]) {
  const result = { workload };
  for (const flavor of ["solid", "blocks"]) {
    const bundle = join(OUT, `${flavor}-${kind}`, "bench.js");
    const base = run(bundle, workload, 0);
    const total = run(bundle, workload, reps);
    result[flavor] = Math.round((total - base) / reps);
    if (wall) result[`${flavor}Wall`] = wallOf(bundle, workload);
  }
  result.ratio = result.blocks / result.solid;
  rows.push(result);
  console.error(JSON.stringify(result));
}

console.log(`\nInstructions per operation (valgrind cachegrind, node --jitless, ${reps} reps, minus a 0-rep baseline):\n`);
console.log("| workload | handwritten Solid | @solidjs/blocks (uncompiled) | ratio |" + (wall ? " wall Solid / blocks (JIT, ms) |" : ""));
console.log("| --- | ---: | ---: | ---: |" + (wall ? " ---: |" : ""));
const label = { todos: "todos: add + toggle", create: "1,000 rows: create + clear", update: "1,000 rows: update every 10th" };
for (const r of rows)
  console.log(
    `| ${label[r.workload]} | ${r.solid.toLocaleString("en-US")} | ${r.blocks.toLocaleString("en-US")} | ${r.ratio.toFixed(2)}x |` +
      (wall ? ` ${r.solidWall.toFixed(3)} / ${r.blocksWall.toFixed(3)} |` : "")
  );
