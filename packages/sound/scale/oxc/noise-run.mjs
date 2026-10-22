// Trusted driver: imported application files are parsed, never executed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { parseSync } from "oxc-parser";
function semanticEdit(file, text) {
  const literals = [];
  const visit = node => {
    if (!node || typeof node !== "object") return;
    if (node.type?.startsWith("TS") || node.type === "ImportDeclaration") return;
    if (node.type === "Literal" && ["boolean", "string", "number"].includes(typeof node.value))
      literals.push(node);
    for (const [key, child] of Object.entries(node)) {
      if (key === "source") continue;
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  };
  visit(parseSync(file, text).program);
  const literal = literals.find(node => typeof node.value === "boolean") ?? literals[0];
  if (!literal) throw new Error("No runtime literal available for a semantic edit: " + file);
  const before = literal.value;
  const after =
    typeof before === "boolean"
      ? !before
      : typeof before === "number"
        ? before + 1
        : before + "-scale";
  return {
    text: text.slice(0, literal.start) + JSON.stringify(after) + text.slice(literal.end),
    edit: { before, after, start: literal.start }
  };
}
const app = process.env.SOUND_SCALE_APP ?? "/Users/devagr/solid-yield-wt/openclaw-trial/app";
const args = process.argv.slice(2);
const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const output = arg(
  "--output",
  "/private/var/folders/k4/g2_9q0g52437sbcp5m856r6m0000gn/T/ocpp/oxc-scale.json"
);
const walk = dir =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(e =>
      e.isDirectory() && !["node_modules", ".git", "dist"].includes(e.name)
        ? walk(path.join(dir, e.name))
        : e.isFile()
          ? [path.join(dir, e.name)]
          : []
    );
const all = walk(app + "/src").filter(f => /\.(ts|tsx)$/.test(f));
const excluded = all.filter(f =>
  /\.d\.ts$|\.(?:test|spec|stories|story|test-support)\.|\/(?:tests?|e2e|solid-smoke|test-helpers|stories)\//.test(
    f
  )
);
const roots = all.filter(f => !excluded.includes(f));
const single = arg("--single", null);
const files = single ? [path.resolve(app, single)] : roots;
if (args.includes("--worker")) {
  const { createChecker } = await import("../../prototypes/oxc/index.mjs");
  const result = {
    roots: files.length,
    excluded: excluded.length,
    loc: files.reduce((n, f) => n + fs.readFileSync(f, "utf8").split("\n").length - 1, 0),
    stage: "create",
    updates: []
  };
  const save = () => fs.writeFileSync(output, JSON.stringify(result, null, 2));
  const compact = r => ({
    counts: r.diagnostics.reduce((v, d) => {
      const k = d.code + ":" + d.severity;
      v[k] = (v[k] ?? 0) + 1;
      return v;
    }, {}),
    partial: r.diagnostics
      .filter(d => d.code === "UNANALYZED_BOUNDARY")
      .reduce((v, d) => {
        const k = d.data?.construct ?? "unknown";
        v[k] = (v[k] ?? 0) + 1;
        return v;
      }, {}),
    inferenceNeeded: r.inferenceNeeded?.length,
    inferenceLocations: new Set(
      (r.inferenceNeeded ?? []).map(site =>
        JSON.stringify([site.loc.file, site.loc.line, site.loc.col])
      )
    ).size,
    worstCaseSites: r.worstCaseSites?.length,
    invalidatedFiles: r.invalidatedFiles,
    scale: r.scale
  });
  let checker;
  save();
  try {
    let start = performance.now();
    checker = createChecker({ rootDir: app, files });
    result.createMs = performance.now() - start;
    result.stage = "cold";
    save();
    start = performance.now();
    const cold = checker.check();
    result.coldMs = performance.now() - start;
    result.coldMemory = process.memoryUsage();
    result.coldPeakRSSKiB = process.resourceUsage().maxRSS;
    result.cold = compact(cold);
    if (args.includes("--diagnostics")) result.diagnostics = cold.diagnostics;
    result.inferenceSites = cold.inferenceNeeded;
    result.worstSites = cold.worstCaseSites;
    result.stage = "cold-complete";
    save();
    if (args.includes("--updates")) {
      const preferred = [
        "components/theme-brand-icon.tsx",
        "lib/reactive/i18n.ts",
        "app/app-root.tsx"
      ];
      for (const rel of preferred) {
        const f = app + "/src/" + rel;
        if (!files.includes(f)) continue;
        const original = fs.readFileSync(f, "utf8");
        for (const kind of ["trivial", "semantic"]) {
          const changed =
            kind === "trivial"
              ? { text: original + "\n", edit: "append newline" }
              : semanticEdit(f, original);
          const text = changed.text;
          result.stage = "update:" + rel + ":" + kind;
          save();
          start = performance.now();
          const updated = checker.update(f, text);
          result.updates.push({
            file: rel,
            kind,
            edit: changed.edit,
            ms: performance.now() - start,
            result: compact(updated)
          });
          save();
          start = performance.now();
          checker.update(f, original);
          result.updates.at(-1).restoreMs = performance.now() - start;
          save();
        }
      }
    }
    result.stage = "complete";
  } catch (error) {
    result.error = String(error.stack ?? error);
    result.stage = "crashed";
  } finally {
    checker?.dispose();
    result.memory = process.memoryUsage();
    result.resourceUsage = process.resourceUsage();
    save();
  }
} else {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const flags = ["--max-old-space-size=2048"];
  if (args.includes("--profile"))
    flags.push("--cpu-prof", "--cpu-prof-dir=" + path.dirname(output));
  const child = spawn(
    process.execPath,
    [...flags, fileURLToPath(import.meta.url), ...args, "--worker"],
    { stdio: ["ignore", "pipe", "pipe"], detached: true }
  );
  let stderr = "",
    stdout = "",
    peakRSSKiB = 0,
    peakCombinedRSSKiB = 0;
  child.stdout.on("data", b => {
    stdout += b;
  });
  child.stderr.on("data", b => {
    stderr += b;
  });
  const sample = setInterval(() => {
    try {
      const rss = Number(
        execFileSync("ps", ["-o", "rss=", "-p", String(child.pid)], { encoding: "utf8" }).trim()
      );
      peakRSSKiB = Math.max(peakRSSKiB, rss);
      peakCombinedRSSKiB = Math.max(peakCombinedRSSKiB, rss + process.memoryUsage().rss / 1024);
    } catch {}
  }, 100);
  const start = performance.now();
  const killGroup = signal => {
    try {
      process.kill(-child.pid, signal);
    } catch {}
  };
  const timer = setTimeout(() => killGroup("SIGINT"), Number(arg("--timeout", 90)) * 1000);
  const hard = setTimeout(() => killGroup("SIGKILL"), (Number(arg("--timeout", 90)) + 3) * 1000);
  child.on("close", (exit, signal) => {
    killGroup("SIGKILL");
    clearInterval(sample);
    clearTimeout(timer);
    clearTimeout(hard);
    const run = {
      exit,
      signal,
      wallMs: performance.now() - start,
      peakRSSKiB,
      peakCombinedRSSKiB,
      driverMaxRSSKiB: process.resourceUsage().maxRSS,
      stdout,
      stderr
    };
    fs.writeFileSync(output + ".process.json", JSON.stringify(run, null, 2));
    console.log(JSON.stringify(run));
  });
}
