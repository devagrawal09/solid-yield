// @ts-check
// Measures a prototype in the Vite path on the Equipment Checkout fixture:
//   1. `vite build` cold, with and without the sound plugin (the plugin's share is the difference;
//      the plugin's own check time is also reported); errors make the build fail — shown — then a
//      report-only build (errorsFailBuild: false) completes.
//   2. a dev server (no network listen): the entry is transformed, then EquipmentRow.tsx gets a
//      single-file edit and the plugin's handleHotUpdate re-check is timed (median of N).
//
//   node harness/vite-measure.mjs <dataflow|typed|null> [--runs 5] [--json out.json]
import { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { build, createServer } from "vite";
import solid from "@solidjs/vite-plugin";
import { fixturesDir, equipment } from "../fixtures/index.mjs";
import { loadPrototypes, packageDir } from "./load.mjs";
import { soundVitePlugin } from "./vite.mjs";

const which = process.argv[2] ?? "dataflow";
const runsArg = process.argv.indexOf("--runs");
const runs = runsArg >= 0 ? Number(process.argv[runsArg + 1]) : 5;
const jsonArg = process.argv.indexOf("--json");
const { prototypes } = await loadPrototypes(which);
const prototype = prototypes[0];
if (!prototype) throw new Error(`no prototype ${which}`);

/** @param {number[]} xs */
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

// A scratch copy of the Equipment app (index.html + src), so HMR edits never touch the fixture.
const scratch = mkdtempSync(resolve(tmpdir(), "sound-vite-"));
cpSync(resolve(fixturesDir, "equipment"), scratch, { recursive: true });
writeFileSync(resolve(scratch, "vite.config.mjs"), "export default {};\n");
symlinkSync(resolve(packageDir, "node_modules"), resolve(scratch, "node_modules")); // rc.17 resolves from the package, for Vite and for the checkers
writeFileSync(resolve(scratch, "index.html"), '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n');
writeFileSync(resolve(scratch, "src/style.css"), "/* the app's stylesheet is not part of the byte-identical source set; an empty one lets Vite build */\n");
const files = equipment.files.map(f => resolve(scratch, f));
const rowFile = resolve(scratch, "src/components/EquipmentRow.tsx");
const rowText = readFileSync(rowFile, "utf8");

/** @param {boolean} withPlugin @param {boolean} errorsFailBuild */
async function coldBuild(withPlugin, errorsFailBuild) {
  /** @type {{ checkMs: number, errors: number, warnings: number } | null} */
  let check = null;
  const plugins = [
    ...(withPlugin ? [soundVitePlugin(prototype, { rootDir: scratch, files, errorsFailBuild, onResult: (phase, r, t) => { if (phase === "cold") check = { checkMs: t.checkMs, errors: r.diagnostics.filter(d => d.severity === "error").length, warnings: r.diagnostics.filter(d => d.severity === "warn").length }; } })] : []),
    solid()
  ];
  const t0 = performance.now();
  let failed = false;
  try {
    await build({ root: scratch, configFile: false, logLevel: "silent", plugins, build: { outDir: resolve(scratch, "dist-" + (withPlugin ? (errorsFailBuild ? "strict" : "report") : "plain")), write: true } });
  } catch (error) {
    failed = true;
    if (!withPlugin || !errorsFailBuild) console.error(`[${prototype.name}] vite build failed: ${error instanceof Error ? error.message.split("\n").slice(0, 6).join(" | ") : String(error)}`);
  }
  return { wallMs: performance.now() - t0, failed, check };
}

const plainTimes = [], pluginTimes = [];
/** @type {{ wallMs: number, failed: boolean, check: { checkMs: number, errors: number, warnings: number } | null } | null} */
let strict = null, report = null;
for (let i = 0; i < runs; i++) {
  plainTimes.push((await coldBuild(false, true)).wallMs);
  strict = await coldBuild(true, true);
  pluginTimes.push(strict.wallMs);
}
report = await coldBuild(true, false);
console.log(`[${prototype.name}] cold vite build (median of ${runs}): plain ${median(plainTimes).toFixed(0)} ms; with sound plugin ${median(pluginTimes).toFixed(0)} ms (check itself ${strict?.check?.checkMs.toFixed(0)} ms; ${strict?.check?.errors} errors, ${strict?.check?.warnings} warnings)`);
console.log(`[${prototype.name}] strict build ${strict?.failed ? "FAILED on errors (as the policy says)" : "passed"}; report-only build ${report.failed ? "failed" : "completed"} in ${report.wallMs.toFixed(0)} ms`);

// Dev server: transform the entry, then HMR re-checks of EquipmentRow.tsx.
/** @type {number[]} */
const hmr = [];
let hmrErrors = -1;
const server = await createServer({
  root: scratch, configFile: false, logLevel: "silent", server: { middlewareMode: true, hmr: false, watch: null },
  plugins: [soundVitePlugin(prototype, { rootDir: scratch, files, onResult: (phase, r, t) => { if (phase === "hmr") { hmr.push(t.checkMs); hmrErrors = r.diagnostics.filter(d => d.severity === "error").length; } } }), solid()]
});
await server.pluginContainer.buildStart({});
const tEntry = performance.now();
await server.transformRequest("/src/main.tsx");
const entryMs = performance.now() - tEntry;
const plugin = server.config.plugins.find(p => p.name === `solid-sound:${prototype.name}`);
for (let i = 0; i < runs; i++) {
  writeFileSync(rowFile, rowText + `\n// hmr edit ${i}\n`);
  const mod = server.moduleGraph.getModulesByFile(rowFile);
  const hook = plugin?.handleHotUpdate;
  const fn = typeof hook === "function" ? hook : hook?.handler;
  if (fn) await fn.call(/** @type {never} */ ({}), { file: rowFile, timestamp: Date.now(), modules: [...(mod ?? [])], read: () => readFileSync(rowFile, "utf8"), server });
}
writeFileSync(rowFile, rowText);
await server.close();
console.log(`[${prototype.name}] dev server: entry transform ${entryMs.toFixed(0)} ms; HMR re-check of EquipmentRow.tsx median ${median(hmr).toFixed(1)} ms over ${hmr.length} edits (${hmrErrors} errors after the edit)`);
const result = { prototype: prototype.name, runs, coldBuild: { plainMs: median(plainTimes), withPluginMs: median(pluginTimes), checkMs: strict?.check?.checkMs ?? null, errors: strict?.check?.errors ?? null, warnings: strict?.check?.warnings ?? null, strictFailed: strict?.failed ?? null, reportOnlyMs: report.wallMs }, devServer: { entryTransformMs: entryMs, hmrRecheckMs: median(hmr), hmrErrors } };
if (jsonArg >= 0) writeFileSync(process.argv[jsonArg + 1], JSON.stringify(result, null, 2) + "\n");
rmSync(scratch, { recursive: true, force: true });
