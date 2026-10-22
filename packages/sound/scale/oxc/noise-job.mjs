// Trusted commands only. Spawn one process group, cap V8 heaps and clean descendants.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
const [seconds, output, command, ...args] = process.argv.slice(2);
if (!output || !command) throw new Error("Usage: noise-job.mjs seconds output command args...");
const start = performance.now();
const child = spawn(command, args, {
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048" }
});
let stdout = "",
  stderr = "",
  timedOut = false;
child.stdout.on("data", chunk => {
  stdout += chunk;
});
child.stderr.on("data", chunk => {
  stderr += chunk;
});
const kill = signal => {
  try {
    process.kill(-child.pid, signal);
  } catch {}
};
const soft = setTimeout(
  () => {
    timedOut = true;
    kill("SIGINT");
  },
  Number(seconds) * 1000
);
const hard = setTimeout(() => kill("SIGKILL"), (Number(seconds) + 3) * 1000);
child.on("close", (exit, signal) => {
  clearTimeout(soft);
  clearTimeout(hard);
  kill("SIGKILL");
  writeFileSync(output + ".log", stdout + stderr);
  const result = { command, args, exit, signal, timedOut, wallMs: performance.now() - start };
  writeFileSync(output + ".json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
  console.log((stdout + stderr).slice(-5000));
  process.exitCode = exit ?? 1;
});
