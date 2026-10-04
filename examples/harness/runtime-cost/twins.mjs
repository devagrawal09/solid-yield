#!/usr/bin/env node
// The runtime cost of each twin against its original (D-017; blocks-library.md §8).
//
//   node examples/harness/runtime-cost/twins.mjs [--runs N] [--dev] [twin …]
//
// Each twin's `tests/runtime-cost.test.ts(x)` runs its parity script (the
// script the gate's parity test compares the two apps with) against one app
// per process, the original or the twin, in jsdom under the twin's own
// vitest config, on production builds of Solid and solid-blocks
// (`BLOCKS_COST_PROD`; `--dev` keeps the development builds the tests use).
// It times the script's steps (`script`) and, where the script mounts a
// component, the mount (`mount`); an app that renders as its module is
// evaluated is not timed mounting, since that would time the transform too.
// Time is JIT wall time from a clock captured before the script fakes timers,
// so a fake timer advance costs only the work it triggers. Each app runs
// `--runs` times (default 5), alternating which goes first; the table gives
// the median. Not in the gate (D-017): wall times move with the machine.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXAMPLES = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const runs = Number(args[args.indexOf("--runs") + 1]) || 5;
const dev = args.includes("--dev");
const named = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--runs");

const twins = readdirSync(EXAMPLES)
  .filter(d => /-blocks(-h)?$/.test(d))
  .filter(d => !named.length || named.includes(d))
  .sort();

function costFile(twin) {
  for (const f of ["tests/runtime-cost.test.tsx", "tests/runtime-cost.test.ts"])
    if (existsSync(join(EXAMPLES, twin, f))) return f;
  throw new Error(`${twin}: no tests/runtime-cost.test.ts(x)`);
}
/** The twin's own test config, as its `test` script names it. */
function configArgs(twin) {
  const script = JSON.parse(readFileSync(join(EXAMPLES, twin, "package.json"), "utf8")).scripts
    .test;
  const m = /--config\s+(\S+)/.exec(script);
  return m ? ["--config", m[1]] : [];
}

const tmp = mkdtempSync(join(tmpdir(), "blocks-cost-"));
function once(twin, app) {
  const out = join(tmp, `${twin}-${app}-${Math.random().toString(36).slice(2)}.jsonl`);
  const r = spawnSync("pnpm", ["exec", "vitest", "run", ...configArgs(twin), costFile(twin)], {
    cwd: join(EXAMPLES, twin),
    encoding: "utf8",
    env: {
      ...process.env,
      BLOCKS_COST_APP: app,
      BLOCKS_COST_OUT: out,
      ...(dev ? {} : { BLOCKS_COST_PROD: "1" }),
      TZ: "UTC",
      FORCE_COLOR: "0"
    }
  });
  if (r.status !== 0 || !existsSync(out))
    throw new Error(`${twin} (${app}) failed:\n${(r.stdout + r.stderr).slice(-4000)}`);
  const phases = {};
  for (const line of readFileSync(out, "utf8").trim().split("\n")) {
    const { phase, ms } = JSON.parse(line);
    phases[phase] = ms;
  }
  return phases;
}

const median = xs => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const rows = [];
try {
  for (const twin of twins) {
    const samples = { original: [], twin: [] };
    for (let i = 0; i < runs; i++)
      for (const app of i % 2 ? ["twin", "original"] : ["original", "twin"])
        samples[app].push(once(twin, app));
    const row = { twin };
    for (const app of ["original", "twin"])
      for (const phase of ["mount", "script"]) {
        const xs = samples[app].map(s => s[phase]).filter(x => x !== undefined);
        if (xs.length) row[`${app}.${phase}`] = median(xs);
      }
    rows.push(row);
    console.error(JSON.stringify(row));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const ms = x => (x === undefined ? "—" : x.toFixed(1));
const ratio = (a, b) => (a === undefined || b === undefined ? "—" : `${(b / a).toFixed(2)}x`);
console.log(
  `\nTwin vs original: the parity script, JIT wall time in ms (median of ${runs} runs per app, one app per process, ${dev ? "development" : "production"} builds, jsdom):\n`
);
console.log(
  "| twin | original: mount | twin: mount | ratio | original: script | twin: script | ratio |"
);
console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
for (const r of rows)
  console.log(
    `| ${r.twin} | ${ms(r["original.mount"])} | ${ms(r["twin.mount"])} | ${ratio(r["original.mount"], r["twin.mount"])} | ${ms(r["original.script"])} | ${ms(r["twin.script"])} | ${ratio(r["original.script"], r["twin.script"])} |`
  );
