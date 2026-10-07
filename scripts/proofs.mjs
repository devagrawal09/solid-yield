#!/usr/bin/env node
// Optional proof evidence, like the analyzer report: no coverage thresholds.
import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const LAKE_INSTALL_HINT =
  "no Lake binary; install elan (https://github.com/leanprover/elan). " +
  "documentation/calculus-proofs/lean/lean-toolchain pins leanprover/lean4:v4.24.0";

function executable(path) {
  try {
    accessSync(path, constants.X_OK);
    return path;
  } catch {
    return null;
  }
}

function locate(binary, env) {
  if (isAbsolute(binary) || binary.includes("/") || binary.includes("\\"))
    return executable(resolve(root, binary));
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    const found = executable(resolve(dir || root, binary));
    if (found) return found;
  }
  return null;
}

export function resolveLake(env = process.env) {
  const configured = env.LAKE && locate(env.LAKE, env);
  if (configured) return { cmd: configured, env: {} };
  const onPath = locate(process.platform === "win32" ? "lake.exe" : "lake", env);
  if (onPath) return { cmd: onPath, env: {} };
  const fallback = executable("/private/tmp/elan/bin/lake");
  return fallback ? { cmd: fallback, env: { ELAN_HOME: "/private/tmp/elan" } } : null;
}

function run(cmd, args, cwd, env = {}) {
  const result = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  return result.status === 0;
}

export function runProofs() {
  const lake = resolveLake();
  if (!lake) {
    console.log(`SKIP proofs: ${LAKE_INSTALL_HINT}`);
    return 0;
  }
  const built = run(
    lake.cmd,
    ["build"],
    join(root, "documentation/calculus-proofs/lean"),
    lake.env
  );
  const probes = run(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "--config",
      "documentation/calculus-proofs/probes/vite.config.mjs"
    ],
    root
  );
  return built && probes ? 0 : 1;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url))
  process.exitCode = runProofs();
