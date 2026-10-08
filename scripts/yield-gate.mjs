#!/usr/bin/env node
// Per-commit gate for solid-yield (packages/yield, its tooling, and the
// example twins). Runs every check, prints one line per step as it finishes,
// then the captured output of each failure and a summary line. CI runs exactly
// this (.github/workflows/gate.yml): CI = the gate.
//
// It never builds the library: build first (`pnpm build`, which builds
// packages/yield; the twins resolve it through its dist/). Step
// pkg:yield:dist-fresh fails when that dist/ is older than its src/.
// The optional proofs step builds the separate Lean project, not the library.
//
// Every step runs with TZ=UTC in its environment, whatever the machine's
// timezone, so results depend on the commit and not on the clock's locale
// (e.g. examples/effect-yield formats a fixed 12:00 UTC timestamp in local time).
//
// Usage: node scripts/yield-gate.mjs [options]   (or `pnpm gate`)
//   --only <substring>  run only steps whose name contains the substring
//                       (repeatable; a step matching any of them runs)
//   --fast              run only the quick subset: pkg:yield:dist-fresh,
//                       twin:*:typecheck, twin:*:lint,
//                       pkg:yield:test, pkg:vite-plugin-yield:typecheck,
//                       pkg:*:exports and repo:prettier (skips twin tests, the
//                       server-render smoke, the other package suites and oxlint)
//   --json <path>       write machine-readable results to <path>
//   --jobs <n>          steps run concurrently (default 3; vitest steps already
//                       use 2 workers each, so keep this modest)
//   --baseline <path>   compare against an earlier --json file. "Green" means no
//                       step is FAIL that was PASS in the baseline, and no step
//                       the baseline lacks is FAIL; the exit code follows that
//                       instead of "any FAIL".
//   --help              print this text
//
// Exit code: 0 when green, 1 otherwise (2 on bad arguments).

import { spawn, execFileSync } from "node:child_process";
import { LAKE_INSTALL_HINT, resolveLake } from "./proofs.mjs";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TAIL_LINES = 60;
/** Overrides applied to every step's environment. TZ is pinned (see header). */
const CHILD_ENV = { TZ: "UTC", FORCE_COLOR: "0", NO_COLOR: "1", CI: process.env.CI ?? "1" };

// ---------------------------------------------------------------------------
// Arguments

function usage() {
  const src = readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n");
  const start = src.findIndex(l => l.startsWith("// Usage:"));
  const end = src.findIndex((l, i) => i > start && !l.startsWith("//"));
  return src
    .slice(start, end)
    .map(l => l.replace(/^\/\/ ?/, ""))
    .join("\n");
}

function parseArgs(argv) {
  const opts = { only: [], fast: false, json: null, jobs: 3, baseline: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.startsWith("--") && arg.includes("=") ? arg.split(/=(.*)/s) : [arg];
    const value = () => {
      if (inline !== undefined) return inline;
      const v = argv[++i];
      if (v === undefined) fail(`${flag} needs a value`);
      return v;
    };
    switch (flag) {
      case "--only":
        opts.only.push(value());
        break;
      case "--fast":
        opts.fast = true;
        break;
      case "--json":
        opts.json = value();
        break;
      case "--jobs": {
        const n = Number(value());
        if (!Number.isInteger(n) || n < 1) fail("--jobs needs a positive integer");
        opts.jobs = n;
        break;
      }
      case "--baseline":
        opts.baseline = value();
        break;
      case "--help":
      case "-h":
        console.log(usage());
        process.exit(0);
      default:
        fail(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

function fail(message) {
  console.error(`yield-gate: ${message}\n\n${usage()}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Steps

const TWIN_SCRIPTS = ["test", "typecheck", "lint"];
const EXPECTED_TWINS = 10;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function findTwins() {
  const examples = join(root, "examples");
  if (!existsSync(examples)) return [];
  return readdirSync(examples, { withFileTypes: true })
    .filter(d => d.isDirectory() && /-(yield(-h)?|sugar)$/.test(d.name))
    .map(d => d.name)
    .filter(name => {
      const pkg = join(examples, name, "package.json");
      if (!existsSync(pkg)) return false;
      const scripts = readJson(pkg).scripts ?? {};
      // A twin has the full script set; a shared helper package does not.
      return ["test", "typecheck", "lint"].every(s => typeof scripts[s] === "string");
    })
    .sort();
}

/** The repo-local oxlint, if installed. PATH is deliberately not consulted: a
 * binary from some other project's node_modules would make results depend on
 * the machine rather than the commit. */
function resolveOxlint() {
  const bin = join(
    root,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "oxlint.cmd" : "oxlint"
  );
  return existsSync(bin) ? bin : null;
}

const LINT_DIRS = twins => [
  "packages/yield",
  "packages/eslint-plugin-yield",
  "packages/vite-plugin-yield",
  ...twins.map(t => `examples/${t}`)
];

function buildSteps(twins) {
  const steps = [];
  const pnpmRun = (dir, script) => ({ cmd: "pnpm", args: ["-C", dir, "run", script] });

  // The build is not stale (scripts/dist-fresh.mjs): the gate never builds, so a
  // packages/yield/dist older than its src would gate the old library. mtimes only.
  steps.push({
    name: "pkg:yield:dist-fresh",
    cwd: root,
    fast: true,
    cmd: process.execPath,
    args: ["scripts/dist-fresh.mjs"]
  });

  steps.push({
    name: "fresh-install",
    cwd: root,
    cmd: process.execPath,
    args: ["scripts/fresh-install.mjs"]
  });

  for (const twin of twins) {
    const dir = `examples/${twin}`;
    const scripts = readJson(join(root, dir, "package.json")).scripts;
    for (const script of TWIN_SCRIPTS) {
      const step = { name: `twin:${twin}:${script}`, cwd: root, ...pnpmRun(dir, script) };
      step.fast = script === "typecheck" || script === "lint";
      if (!scripts[script]) step.skip = `no "${script}" script in ${dir}/package.json`;
      steps.push(step);
    }
  }

  steps.push({
    name: "twin:todos-sugar:generated-parity",
    cwd: root,
    cmd: process.execPath,
    args: ["scripts/sugar-check.mjs"]
  });

  steps.push({
    name: "native:contracts",
    cwd: root,
    cmd: process.execPath,
    args: ["scripts/native-check.mjs"]
  });
  steps.push({
    name: "native:failure:production-serialization",
    cwd: root,
    cmd: process.execPath,
    args: ["scripts/native-serialization.mjs"],
    env: { NODE_ENV: "production" }
  });
  steps.push({
    name: "native:counter:ssr-hydrate-parity",
    cwd: root,
    cmd: process.execPath,
    args: ["scripts/native-runtime.mjs"]
  });
  for (const stage of ["transform", "typecheck", "lint"]) {
    steps.push({
      name: `native:sierpinski:${stage}`,
      cwd: root,
      cmd: process.execPath,
      args:
        stage === "typecheck"
          ? [
              "packages/ts-plugin-yield/src/cli.cjs",
              "check",
              "examples/originals/sierpinski",
              "--native",
              "src/**"
            ]
          : ["scripts/native-sierpinski-check.mjs", stage]
    });
  }
  for (const stage of ["parity", "ssr"]) {
    steps.push({
      name: `native:sierpinski:${stage}`,
      cwd: root,
      cmd: process.execPath,
      args: ["examples/harness/native-sierpinski/check.mjs", stage]
    });
  }
  for (const stage of ["transform", "typecheck", "lint"]) {
    steps.push({
      name: `native:todos:${stage}`,
      cwd: root,
      cmd: process.execPath,
      args:
        stage === "typecheck"
          ? ["scripts/native-todos-events.mjs", "typecheck"]
          : ["scripts/native-todos-check.mjs", stage]
    });
  }
  steps.push({
    name: "native:todos:events:snapshot",
    cwd: root,
    cmd: process.execPath,
    args: ["scripts/native-todos-events.mjs", "snapshot"]
  });
  for (const stage of ["parity", "ssr"]) {
    steps.push({
      name: `native:todos:${stage}`,
      cwd: root,
      cmd: process.execPath,
      args: ["examples/harness/native-todos/check.mjs", stage]
    });
  }

  for (const stage of ["diagnostics", "transform", "typecheck", "lint"]) {
    steps.push({
      name: `native:hackernews:${stage}`,
      cwd: root,
      cmd: process.execPath,
      args: ["scripts/native-hackernews-check.mjs", stage]
    });
  }

  for (const stage of ["parity", "ssr"]) {
    steps.push({
      name: `native:hackernews:${stage}`,
      cwd: root,
      cmd: process.execPath,
      args: ["examples/harness/native-hackernews/check.mjs", stage]
    });
  }

  // F-S36 pins the context facade stop after the JSX hole fix; not dashboard acceptance.
  steps.push({
    name: "native:dashboard:structural-stop",
    cwd: root,
    cmd: process.execPath,
    args: ["scripts/native-dashboard-blocker.mjs"]
  });

  steps.push({
    name: "original:docs:typecheck",
    cwd: root,
    fast: true,
    ...pnpmRun("examples/originals/docs", "typecheck")
  });

  // D-116: plain-Solid originals are first-class inputs for native sugar.
  // Dashboard has a 30-step original self-check and its own SSR/hydrate cases;
  // it does not need a hand-written yield twin to enter the gate.
  for (const script of ["test", "typecheck", "ssr-smoke", "hydrate-smoke"]) {
    steps.push({
      name: `original:dashboard:${script}`,
      cwd: root,
      fast: script === "typecheck",
      ...pnpmRun("examples/originals/dashboard", script)
    });
  }

  // Server-render smoke (examples/harness/ssr-smoke/smoke.mjs): every twin with a server
  // entry renders each of its routes through Vite's SSR loader, each render in its own
  // process with a 30 s timeout (120 s on GitHub Actions) — rendering-yield's string and
  // stream entries for all 7 routes, room-yield's /live, hackernews-spa-yield's cached
  // story. Nothing is compared: a throw, a development error or a render that never ends
  // fails it. The twins' own tests render on the client only, so this is the only server
  // render of their pages.
  steps.push({
    name: "twins:ssr-smoke",
    cwd: root,
    cmd: process.execPath,
    args: ["examples/harness/ssr-smoke/smoke.mjs"]
  });

  // Twin-hydration smoke (examples/harness/hydrate-smoke/hydrate.mjs): each of those 16
  // server renders is hydrated in jsdom by the twin's own client entry, compiled for the
  // DOM by the same Vite server, each case in its own process with a 30 s timeout (120 s
  // on GitHub Actions). A hydration mismatch (Solid's dev diagnostics), a development
  // error, an unhandled rejection, a replaced server root or a failed interaction
  // (rendering's /settings portal) fails it. The network is held (no listening server).
  // A case listed in KNOWN_FAILURES must keep failing with its recorded message (the list
  // is empty since D-092).
  steps.push({
    name: "twins:hydrate-smoke",
    cwd: root,
    cmd: process.execPath,
    args: ["examples/harness/hydrate-smoke/hydrate.mjs"]
  });

  steps.push(
    { name: "pkg:yield:test", cwd: root, fast: true, ...pnpmRun("packages/yield", "test") },
    {
      name: "pkg:eslint-plugin-yield:test",
      cwd: root,
      ...pnpmRun("packages/eslint-plugin-yield", "test")
    },
    // The JSX transform's rule as a standalone plugin (D-003, D-043): fixture parity with
    // the checked-in outputs, the Vite plugin, the lazy module-URL pass.
    {
      name: "pkg:vite-plugin-yield:test",
      cwd: root,
      ...pnpmRun("packages/vite-plugin-yield", "test")
    },
    {
      name: "pkg:ts-plugin-yield:test",
      cwd: root,
      ...pnpmRun("packages/ts-plugin-yield", "test")
    },
    {
      name: "pkg:vite-plugin-yield:typecheck",
      cwd: root,
      fast: true,
      ...pnpmRun("packages/vite-plugin-yield", "typecheck")
    }
  );

  // D-114: analysis is a tool, not a compiler route. Report all nine twins;
  // no group, reach or provenance thresholds are imposed.
  steps.push(
    {
      name: "analyzer:test",
      cwd: root,
      ...pnpmRun("packages/compiler-yield", "test")
    },
    {
      name: "analyzer:report",
      cwd: root,
      cmd: process.execPath,
      args: ["packages/compiler-yield/src/report.js"]
    }
  );

  // Like analyzer:report, this reports evidence without coverage thresholds.
  // Lean is optional: a missing Lake skips this step without failing the gate.
  steps.push({
    name: "proofs",
    cwd: root,
    cmd: process.execPath,
    args: ["scripts/proofs.mjs"],
    skip: resolveLake() ? null : LAKE_INSTALL_HINT
  });

  // The conformance harness (D-039; packages/yield/test/conformance): each scenario's
  // handwritten Solid oracle against its library-dialect twin, client / server / hydrate,
  // the library route against the compiler route's frozen server output, and the
  // scenarios' library sources linted with the recommended rules.
  steps.push({
    name: "pkg:yield:conformance",
    cwd: root,
    ...pnpmRun("packages/yield", "test:conformance")
  });

  // D-105: source bytes in V8 executed ranges at load and each authored parity step.
  // The committed baseline permits 2% or 1024 bytes per phase (whichever is larger).
  steps.push(
    {
      name: "twins:executed-bytes-test",
      cwd: root,
      cmd: process.execPath,
      args: ["--test", "examples/harness/executed-bytes/coverage.test.mjs"]
    },
    {
      name: "twins:executed-bytes",
      cwd: root,
      cmd: process.execPath,
      args: [
        "examples/harness/executed-bytes/measure.mjs",
        "--baseline",
        "documentation/executed-bytes.json"
      ]
    }
  );

  // The exports-conditions matrix of each published package (scripts/exports-matrix.mjs):
  // every subpath under development / default / browser / node, resolved by esbuild, Node
  // and TypeScript from a consumer's node_modules. Needs the build, like everything here.
  for (const dir of ["yield", "vite-plugin-yield", "eslint-plugin-yield"])
    steps.push({
      name: `pkg:${dir}:exports`,
      cwd: root,
      fast: true,
      ...pnpmRun(`packages/${dir}`, "test:exports")
    });

  // Solid's own JSX compilers (@solidjs/babel-plugin, @solidjs/compiler) are not in this
  // repository: since D-043 they carry nothing of solid-yield, and the twins compile through the
  // published packages, so a Solid release that breaks them reaches the twins' tests (D-016).

  const dirs = LINT_DIRS(twins);
  steps.push({
    name: "repo:prettier",
    cwd: root,
    fast: true,
    cmd: "pnpm",
    // .gitignore is honoured by default (dist/, node_modules/).
    args: [
      "exec",
      "prettier",
      "--check",
      ...dirs.map(d => `${d}/**/*.[tj]s?(x)`),
      "packages/compiler-yield/src/*.js",
      "examples/originals/docs/src/**/*.[tj]s?(x)",
      "examples/originals/docs/stream/**/*.[tj]s?(x)",
      "examples/originals/dashboard/src/**/*.[tj]s?(x)",
      "examples/originals/dashboard/stream/**/*.[tj]s?(x)",
      "examples/originals/dashboard/tests/**/*.[tj]s?(x)",
      "examples/harness/dashboard/*.{ts,mjs}",
      "packages/*/test/*.mjs",
      "examples/harness/ssr-smoke/*.mjs",
      "examples/harness/hydrate-smoke/*.mjs",
      "examples/harness/executed-bytes/*.mjs",
      "examples/harness/native-sierpinski/*.mjs",
      "examples/harness/native-todos/*.mjs",
      "examples/harness/native-hackernews/*.mjs",
      "scripts/*.mjs"
    ]
  });

  const oxlint = resolveOxlint();
  steps.push({
    name: "repo:oxlint",
    cwd: root,
    cmd: oxlint ?? "oxlint",
    args: [...dirs, "--ignore-pattern", "**/dist/**", "--ignore-pattern", "**/node_modules/**"],
    skip: oxlint ? null : "no repo-local oxlint binary (node_modules/.bin/oxlint)"
  });

  return steps;
}

// ---------------------------------------------------------------------------
// Running

function commandString(step) {
  const quote = a => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`);
  const cmd = isAbsolute(step.cmd) ? relative(root, step.cmd) : step.cmd;
  return [cmd, ...step.args].map(quote).join(" ");
}

function runStep(step) {
  return new Promise(resolve => {
    const started = Date.now();
    const chunks = [];
    const child = spawn(step.cmd, step.args, {
      cwd: step.cwd,
      env: { ...process.env, ...CHILD_ENV, ...step.env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.on("data", c => chunks.push(c));
    child.stderr.on("data", c => chunks.push(c));
    const done = (status, extra = "") => {
      resolve({
        status,
        durationMs: Date.now() - started,
        output: Buffer.concat(chunks).toString("utf8") + extra
      });
    };
    child.on("error", err => done("FAIL", `\n[yield-gate] failed to spawn: ${err.message}\n`));
    child.on("close", (code, signal) =>
      code === 0 ? done("PASS") : done("FAIL", signal ? `\n[yield-gate] killed by ${signal}\n` : "")
    );
  });
}

async function runAll(steps, jobs, onDone) {
  const queue = steps.slice();
  const worker = async () => {
    for (let step; (step = queue.shift()); ) {
      const result = step.skip
        ? { status: "SKIP", durationMs: 0, output: "", reason: step.skip }
        : await runStep(step);
      Object.assign(step, result);
      onDone(step);
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, steps.length) }, worker));
}

function fmtSecs(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function tail(text, n) {
  const lines = text.replace(/\s+$/, "").split("\n");
  const cut = lines.length > n ? [`… (${lines.length - n} earlier lines omitted)`] : [];
  return [...cut, ...lines.slice(-n)].join("\n");
}

function capture(cmd, args) {
  try {
    return execFileSync(cmd, args, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main

const opts = parseArgs(process.argv.slice(2));
const twins = findTwins();
console.log(`yield-gate: ${twins.length} twins: ${twins.join(", ")}`);
if (twins.length !== EXPECTED_TWINS) {
  console.error(`yield-gate: expected ${EXPECTED_TWINS} twins, found ${twins.length}`);
  process.exit(1);
}

let steps = buildSteps(twins);
if (opts.fast) steps = steps.filter(s => s.fast);
if (opts.only.length) steps = steps.filter(s => opts.only.some(o => s.name.includes(o)));
if (!steps.length) fail("no steps selected");
for (const s of steps) s.command = commandString(s);

const startedAt = new Date();
console.log(
  `yield-gate: ${steps.length} steps, --jobs ${opts.jobs}${opts.fast ? ", --fast" : ""}` +
    (opts.only.length ? `, --only ${opts.only.join(" --only ")}` : "")
);
const width = Math.max(...steps.map(s => s.name.length));
await runAll(steps, opts.jobs, s => {
  const note = s.status === "SKIP" ? `  (${s.reason})` : "";
  console.log(
    `${s.status.padEnd(4)}  ${s.name.padEnd(width)}  ${fmtSecs(s.durationMs).padStart(7)}${note}`
  );
});
const finishedAt = new Date();
// Report in definition order, not completion order.
const failed = steps.filter(s => s.status === "FAIL");
for (const s of failed) {
  console.log(`\n${"=".repeat(20)} FAIL ${s.name} ${"=".repeat(20)}\n$ ${s.command}\n`);
  console.log(tail(s.output, TAIL_LINES));
}

const count = st => steps.filter(s => s.status === st).length;
const wallMs = finishedAt - startedAt;
const summary = {
  pass: count("PASS"),
  fail: count("FAIL"),
  skip: count("SKIP"),
  total: steps.length,
  wallMs
};
const summaryLine = `${summary.pass} pass / ${summary.fail} fail / ${summary.skip} skip in ${Math.round(wallMs / 1000)}s`;
console.log(`\n${summaryLine}`);

let green = summary.fail === 0;
let comparison = null;
if (opts.baseline) {
  const base = readJson(opts.baseline);
  const before = new Map(base.steps.map(s => [s.name, s.status]));
  const newReds = [];
  const fixed = [];
  const unchanged = [];
  const added = [];
  for (const s of steps) {
    const was = before.get(s.name);
    if (was === undefined) {
      added.push(s.name);
      // a step the baseline does not have yet must pass to be green
      if (s.status === "FAIL") newReds.push(s.name);
    } else if (s.status === "FAIL" && was === "PASS") newReds.push(s.name);
    else if (s.status === "PASS" && was === "FAIL") fixed.push(s.name);
    else unchanged.push(s.name);
  }
  comparison = {
    baseline: opts.baseline,
    baselineHead: base.head ?? null,
    newReds,
    fixed,
    unchanged,
    added
  };
  green = newReds.length === 0;
  console.log(`\nvs baseline ${opts.baseline} (${(base.head ?? "unknown").slice(0, 12)}):`);
  console.log(`  new reds:  ${newReds.length ? newReds.join(", ") : "none"}`);
  console.log(`  fixed:     ${fixed.length ? fixed.join(", ") : "none"}`);
  console.log(`  unchanged: ${unchanged.length}`);
  if (added.length) console.log(`  not in baseline: ${added.join(", ")}`);
  console.log(
    green
      ? "GREEN (no step regressed from PASS)"
      : "RED (a step that passed in the baseline fails now)"
  );
}

if (opts.json) {
  const out = {
    head: capture("git", ["rev-parse", "HEAD"]),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    options: { only: opts.only, fast: opts.fast, jobs: opts.jobs, baseline: opts.baseline },
    environment: {
      node: process.version,
      pnpm: capture("pnpm", ["-v"]),
      platform: process.platform,
      arch: process.arch,
      hostTZ: Intl.DateTimeFormat().resolvedOptions().timeZone,
      childEnv: CHILD_ENV
    },
    twins,
    summary: { ...summary, line: summaryLine, green },
    comparison,
    steps: steps.map(s => ({
      name: s.name,
      status: s.status,
      durationMs: s.durationMs,
      command: s.command,
      ...(s.reason ? { reason: s.reason } : {})
    }))
  };
  const path = resolve(opts.json);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nwrote ${relative(process.cwd(), path)}`);
}

process.exit(green ? 0 : 1);
