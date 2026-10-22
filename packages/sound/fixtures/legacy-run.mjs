// @ts-check
// Runs TODAY's legacy checker (solid-yield native mode: generator lowering +
// TypeScript, pinned to solid-js 2.0.0-rc.13) over the shared fixtures and
// records what it actually reports, so "today's expected diagnostics" are
// measured, not remembered. This is the one file under packages/sound that
// may touch the legacy packages; it does so read-only, through the CLI's
// exported `check(dir, config)`.
//
//   node fixtures/legacy-run.mjs            # writes fixtures/legacy-actual.json
import { createRequire } from "node:module";
import { mkdirSync, rmSync, symlinkSync, writeFileSync, cpSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const require = createRequire(import.meta.url);
/** @type {{ check: (dir: string, config: Record<string, unknown>) => number }} */
const { check } = require(resolve(repoRoot, "packages/ts-plugin-yield/src/cli.cjs"));
const legacyModules = resolve(repoRoot, "packages/vite-plugin-yield/node_modules");
const scratch = resolve("/tmp/sound-legacy", String(process.pid));

const options = {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  target: "ESNext",
  module: "ESNext",
  moduleResolution: "Bundler",
  jsx: "preserve",
  jsxImportSource: "solid-yield",
  jsxFactory: "jsx",
  jsxFragmentFactory: "Fragment",
  types: [],
  lib: ["ESNext", "DOM"]
};

/** @typedef {{ code: string, file: string, line: number, col: number, severity: string, message: string }} LegacyDiagnostic */

/**
 * @param {string} dir
 * @param {string[]} include
 * @returns {{ diagnostics: LegacyDiagnostic[], log: string[], exit: number }}
 */
function run(dir, include) {
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: options, include, exclude: ["node_modules"] }));
  /** @type {string[]} */
  const log = [];
  const old = console.log;
  console.log = (...args) => { log.push(args.join(" ")); };
  let exit = 0;
  try {
    exit = check(dir, { mode: "native", include });
  } finally {
    console.log = old;
  }
  /** @type {LegacyDiagnostic[]} */
  const diagnostics = [];
  for (const row of log) {
    const m = row.match(/^(.*?):(\d+):(\d+) (error|warning|message) (TS\d+): (.*)$/);
    if (!m) continue;
    const code = m[6].match(/\[([A-Z_]+)\]/)?.[1] ?? m[5];
    diagnostics.push({ code, file: m[1].slice(dir.length + 1), line: Number(m[2]), col: Number(m[3]), severity: m[4], message: m[6] });
  }
  return { diagnostics, log, exit };
}

rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });

/** @type {Record<string, { diagnostics: LegacyDiagnostic[], exit: number }>} */
const cases = {};
const casesDir = resolve(here, "cases");
for (const name of readdirSync(casesDir).filter(f => f.endsWith(".tsx")).sort()) {
  const id = name.slice(0, -4);
  const dir = join(scratch, "cases", id);
  mkdirSync(dir, { recursive: true });
  symlinkSync(legacyModules, join(dir, "node_modules"));
  cpSync(join(casesDir, name), join(dir, name));
  const { diagnostics, exit } = run(dir, ["*.tsx"]);
  cases[id] = { diagnostics, exit };
  process.stderr.write(`${id}: ${diagnostics.map(d => d.code).join(",") || "clean"}\n`);
}

const equipmentDir = join(scratch, "equipment");
mkdirSync(equipmentDir, { recursive: true });
symlinkSync(legacyModules, join(equipmentDir, "node_modules"));
cpSync(resolve(here, "equipment/src"), join(equipmentDir, "src"), { recursive: true });
writeFileSync(join(equipmentDir, "src/assets.d.ts"), 'declare module "*.css" {}\n');
const equipment = run(equipmentDir, ["src/**/*.ts", "src/**/*.tsx"]);
process.stderr.write(`equipment: ${equipment.diagnostics.length} diagnostics, exit ${equipment.exit}\n`);

writeFileSync(
  resolve(here, "legacy-actual.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      checker: "solid-yield native mode (packages/ts-plugin-yield cli.cjs), solid-js 2.0.0-rc.13 via packages/vite-plugin-yield/node_modules",
      cases,
      equipment: { diagnostics: equipment.diagnostics, exit: equipment.exit }
    },
    null,
    2
  ) + "\n"
);
rmSync(scratch, { recursive: true, force: true });
