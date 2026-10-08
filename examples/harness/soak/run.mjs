#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  renameSync,
  mkdirSync
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";
import { seeded, schedule } from "./schedule.mjs";
import { trends } from "./analysis.mjs";
const repo = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const here = fileURLToPath(new URL(".", import.meta.url));
const args = process.argv.slice(2);
const opts = {
  minutes: 10,
  seed: 109,
  checkpoint: 5,
  only: null,
  rounds: null,
  scenario: "all",
  build: "yes",
  control: "no",
  out: "documentation/soak-results.json"
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--help") {
    console.log(
      "pnpm soak [--minutes 10|60] [--seed 109] [--checkpoint 5] [--only twin] [--rounds N] [--out path]\nManual REPORT-ONLY run: findings never fail the gate. Infrastructure errors exit 1."
    );
    process.exit(0);
  }
  const key = args[i].replace(/^--/, "");
  if (!Object.hasOwn(opts, key) || args[i + 1] === undefined)
    throw new Error(`Unknown/missing option ${args[i]}`);
  opts[key] = ["minutes", "seed", "checkpoint", "rounds"].includes(key)
    ? Number(args[++i])
    : args[++i];
}
if (
  !(opts.minutes > 0 && opts.minutes <= 60) ||
  !["yes", "no"].includes(opts.control) ||
  !Number.isInteger(opts.seed) ||
  !Number.isInteger(opts.checkpoint) ||
  opts.checkpoint < 1 ||
  (opts.rounds !== null && (!Number.isInteger(opts.rounds) || opts.rounds < 1))
)
  throw new Error("Invalid duration, seed or checkpoint");
if (
  !["all", "search", "retry", "retry-fail", "switch", "idle", "supersede", "checkout"].includes(
    opts.scenario
  ) ||
  (opts.scenario !== "all" && opts.only !== "effect-yield")
)
  throw new Error(
    "Reduced --scenario search|retry|supersede|checkout requires --only effect-yield"
  );
const twins = readdirSync(join(repo, "examples"))
  .filter(x => /-yield(-h)?$/.test(x))
  .filter(x => !opts.only || x === opts.only)
  .sort();
if (!twins.length || (!opts.only && twins.length !== 9))
  throw new Error("Expected nine twins or a valid --only");
const output = resolve(repo, opts.out);
const raw = output.replace(/\.json$/, "") + "-raw";
mkdirSync(raw, { recursive: true });
const result = {
  date: new Date().toISOString(),
  node: process.version,
  options: opts,
  mode: "development/jsdom; exposed GC; report only",
  clearMockHistory: process.env.SOAK_CLEAR_MOCKS !== "0",
  trimNavigationHistory: process.env.SOAK_KEEP_HISTORY !== "1",
  replaceHistory: process.env.SOAK_REPLACE_HISTORY === "1",
  results: []
};
const save = () => writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
function build(debug) {
  const p = spawnSync(process.execPath, ["packages/yield/scripts/build.mjs"], {
    cwd: repo,
    env: { ...process.env, YIELD_SOAK_DEBUG: debug ? "1" : "0" },
    encoding: "utf8"
  });
  if (p.status !== 0) throw new Error(`Build failed: ${(p.stdout + p.stderr).slice(-1500)}`);
}
function atomic(path, data) {
  writeFileSync(path + ".tmp", JSON.stringify(data));
  renameSync(path + ".tmp", path);
}
function load(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
async function response(worker, predicate, timeout = 120000) {
  const start = performance.now();
  for (;;) {
    const data = load(worker.reply);
    if (data?.fatal) throw new Error(`${worker.app}: ${data.fatal}`);
    if (data && predicate(data)) return data;
    if (worker.child.exitCode !== null)
      throw new Error(
        `${worker.app} worker exited ${worker.child.exitCode}: ${worker.log.slice(-1800)}`
      );
    if (performance.now() - start > timeout)
      throw new Error(`${worker.app}: worker response timeout`);
    await sleep(20);
  }
}
function startWorker(twin, app, generated) {
  const dir = join(repo, "examples", twin),
    prefix = join(raw, `${twin}-${app}`);
  const worker = {
    app,
    reply: prefix + "-reply.json",
    command: prefix + "-command.json",
    samples: prefix + "-samples.jsonl",
    log: ""
  };
  for (const suffix of ["-samples.jsonl", "-errors.jsonl"]) writeFileSync(prefix + suffix, "");
  for (const path of [worker.reply, worker.command]) rmSync(path, { force: true });
  const original = twin.replace(/-yield(-h)?$/, "");
  const scriptFile = readdirSync(join(dir, "tests")).find(x => /^script\.tsx?$/.test(x));
  const ext = twin.endsWith("-h") ? "ts" : "tsx";
  let component =
    app === "original"
      ? join(repo, "examples/originals", original, "src/app.tsx")
      : join(dir, `src/app.${ext}`);
  if (original === "rendering")
    component =
      app === "original"
        ? join(repo, "examples/originals/rendering/shared/src/components/App.tsx")
        : join(dir, "shared/src/components/App.tsx");
  const probe = join(generated, `${app}.test.tsx`);
  let mount;
  if (original === "sierpinski" && app === "original") {
    const main = readFileSync(
      join(repo, "examples/originals/sierpinski/src/main.tsx"),
      "utf8"
    ).replace(
      "render(TriangleDemo, document.body);",
      "export const dispose = render(TriangleDemo, document.body);"
    );
    const mainPath = join(generated, "original-main.tsx");
    writeFileSync(mainPath, main);
    mount = `const module = await import(${JSON.stringify(mainPath)}); return { dispose: module.dispose };`;
  } else {
    const named =
      original === "sierpinski"
        ? "TriangleDemo"
        : ["todos", "effect"].includes(original)
          ? "App"
          : "default";
    if (original === "sierpinski") component = join(dir, `src/app.${ext}`);
    const selector =
      original === "sierpinski"
        ? "document.body"
        : ["room", "hackernews-spa"].includes(original)
          ? 'document.body.appendChild(document.createElement("div"))'
          : original === "rendering"
            ? 'document.getElementById("app")'
            : 'document.getElementById("root")';
    const libraryRoot =
      app === "twin" && !["room", "hackernews-spa", "rendering"].includes(original);
    mount = `const module = await import(/* @vite-ignore */ ${JSON.stringify(component)}); const App = module[${JSON.stringify(named)}]; const root = ${selector}; const dispose = ${libraryRoot ? "yieldRender" : "render"}(() => { ${app === "twin" && !libraryRoot ? 'soakOwned("roots");' : ""} return createComponent(App, {}); }, root); flush(); return { root, dispose: () => { dispose(); root.innerHTML = ""; } };`;
  }
  writeFileSync(
    probe,
    `import { session } from ${JSON.stringify(join(here, "worker.mjs"))};
import * as script from ${JSON.stringify(join(dir, "tests", scriptFile))};
import { render, createComponent } from "@solidjs/web";
import { render as yieldRender } from "solid-yield";
import { soakOwned } from "solid-yield/internal";
import { flush } from "solid-js";
it("persistent seeded soak", async () => {
  await session(script, async () => {
    ${original === "sierpinski" ? 'document.body.innerHTML = ""; script.installClocks();' : original === "hackernews-spa" ? 'script.install("/");' : "script.install();"}
    ${app === "control" ? 'const root = document.body.appendChild(document.createElement("div")); const dispose = render(() => document.createTextNode("control"), root); return { root, dispose };' : mount}
  }, () => ${original === "sierpinski" ? "script.uninstallClocks()" : "script.uninstall()"});
}, ${Math.ceil(opts.minutes * 60000 + 240000)});
`
  );
  const test = JSON.parse(readFileSync(join(dir, "package.json"))).scripts.test;
  const configName =
    /--config\s+(\S+)/.exec(test)?.[1] ??
    readdirSync(dir).find(x => /^vite\.config\.[cm]?[jt]s$/.test(x));
  const require = createRequire(join(dir, "package.json"));
  const config = join(generated, `${app}-config.mjs`);
  writeFileSync(
    config,
    `import { mergeConfig } from ${JSON.stringify(require.resolve("vite"))}; import config from ${JSON.stringify(join(dir, configName))}; export default mergeConfig(config, { root: ${JSON.stringify(dir)}, test: { include: [${JSON.stringify(probe)}], pool: "forks", execArgv: ["--expose-gc"], maxWorkers: 1 } });`
  );
  worker.child = spawn("pnpm", ["exec", "vitest", "run", "--config", config, probe], {
    cwd: dir,
    env: {
      ...process.env,
      TZ: "UTC",
      FORCE_COLOR: "0",
      SOAK_TWIN: twin,
      SOAK_APP: app,
      SOAK_REPLY: worker.reply,
      SOAK_COMMAND: worker.command,
      SOAK_SAMPLES: worker.samples,
      SOAK_ERRORS: prefix + "-errors.jsonl"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  for (const stream of [worker.child.stdout, worker.child.stderr])
    stream.on("data", chunk => {
      worker.log = (worker.log + chunk).slice(-5000);
    });
  worker.child.on("error", error => {
    worker.log += error.message;
  });
  return worker;
}
if (opts.build !== "no") build(true);
try {
  for (const twin of twins) {
    const generated = mkdtempSync(join(repo, "examples", twin, ".soak-"));
    const workers = [],
      row = {
        twin,
        rounds: 0,
        elapsedSeconds: 0,
        parityCheckpoints: 0,
        parityStepChecks: 0,
        mismatches: [],
        errors: [],
        stepFailures: [],
        samples: [],
        seed: opts.seed
      };
    try {
      for (const app of ["original", "twin", ...(opts.control === "yes" ? ["control"] : [])])
        workers.push(startWorker(twin, app, generated));
      const ready = await Promise.all(workers.map(w => response(w, x => x.ready)));
      if (!ready[1].debug) throw new Error("Debug counters missing in twin worker");
      const random = seeded(opts.seed),
        started = performance.now();
      while (
        performance.now() - started < opts.minutes * 60000 &&
        (opts.rounds === null || row.rounds < opts.rounds)
      ) {
        const id = row.rounds + 1,
          steps = schedule(twin, random, id, opts.scenario),
          checkpoint = id === 1 || id % opts.checkpoint === 0;
        for (const w of workers) atomic(w.command, { id, steps, checkpoint, keepHtml: id === 1 });
        const [a, b] = await Promise.all(workers.map(w => response(w, x => x.round === id)));
        row.rounds = id;
        row.samples.push(b.sample);
        row.errors = b.errors;
        row.errorCount = b.errorCount;
        row.originalErrorCount = a.errorCount;
        row.originalErrors = a.errors;
        row.counterViolations ??= [];
        if (
          Object.entries(b.sample).some(
            ([key, value]) => !["round", "timeMs"].includes(key) && value < 0
          ) &&
          row.counterViolations.length < 10
        )
          row.counterViolations.push({ round: id, sequence: steps, sample: b.sample });
        if (checkpoint) {
          row.parityCheckpoints++;
          row.parityStepChecks += b.hashes.length;
          const mismatch = b.hashes.find((h, i) => h.hash !== a.hashes[i]?.hash);
          if (mismatch && row.mismatches.length < 10)
            row.mismatches.push({
              round: id,
              sequence: steps,
              step: mismatch.step,
              original: a.hashes.find(h => h.step === mismatch.step),
              twin: mismatch
            });
        }
        if (a.stepFailures.length || b.stepFailures.length) {
          row.stepFailures.push({
            round: id,
            sequence: steps,
            original: a.stepFailures,
            twin: b.stepFailures
          });
          break; // Invalid input path must be reviewed; do not fabricate further rounds.
        }
        if (id % 50 === 0)
          console.log(
            `${twin}: ${id} rounds, ${Math.round((performance.now() - started) / 1000)}s`
          );
      }
      row.elapsedSeconds = (performance.now() - started) / 1000;
      row.trends = trends(row.samples);
      const originalSamples = readFileSync(workers[0].samples, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(line => JSON.parse(line));
      row.originalTrends = trends(originalSamples);
      if (workers[2]) {
        row.controlTrends = trends(
          readFileSync(workers[2].samples, "utf8")
            .trim()
            .split("\n")
            .filter(Boolean)
            .map(line => JSON.parse(line))
        );
      }
      for (const w of workers) atomic(w.command, { id: row.rounds + 1, stop: true });
      const stopped = await Promise.all(workers.map(w => response(w, x => x.stopped)));
      row.afterDispose = stopped[1].countsAfterDispose;
      row.originalAfterDispose = stopped[0].countsAfterDispose;
      if (stopped[2]) row.controlAfterDispose = stopped[2].countsAfterDispose;
      console.log(
        `${twin}: ${row.rounds} rounds; ${row.parityCheckpoints} checkpoints; ${row.mismatches.length} mismatches; ${row.errors.length} errors`
      );
    } catch (error) {
      row.infrastructureError = String(error?.stack ?? error);
      console.error(`${twin}: ${error.message.slice(0, 250)}`);
    } finally {
      for (const w of workers) {
        if (w.child.exitCode === null) {
          atomic(w.command, { id: row.rounds + 2, stop: true });
          const ended = await Promise.race([
            new Promise(r => w.child.once("exit", () => r(true))),
            sleep(5000).then(() => false)
          ]);
          if (!ended) w.child.kill("SIGTERM");
        }
      }
      // Preserve diagnostics emitted between samples, including a worker crash.
      for (const w of workers) {
        const errorFile = w.samples.replace("-samples.jsonl", "-errors.jsonl");
        if (!existsSync(errorFile)) continue;
        const observed = readFileSync(errorFile, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map(line => JSON.parse(line));
        if (w.app === "twin") {
          row.errors = observed.slice(0, 20);
          row.errorCount = observed.length;
        } else if (w.app === "original") {
          row.originalErrors = observed.slice(0, 20);
          row.originalErrorCount = observed.length;
        }
      }
      rmSync(generated, { recursive: true, force: true });
      result.results.push(row);
      save();
    }
  }
} finally {
  if (opts.build !== "no") build(false);
}
if (result.results.some(r => r.infrastructureError)) process.exitCode = 1;
console.log(`Report-only data: ${output}`);
