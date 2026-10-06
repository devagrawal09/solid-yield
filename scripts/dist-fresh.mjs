#!/usr/bin/env node
// Refuses a stale build (yield-gate step pkg:yield:dist-fresh). The gate never builds
// (D-008), and the twins, the exports matrix and the smokes resolve packages/yield
// through its dist/; a gate run against a dist/ older than src/ checks the old library.
// Fails when dist/ is missing or empty, or when any file under it is older than the
// newest build input (src/, the build scripts, tsconfig.build.json). The Vite and ESLint
// plugins ship their src/ unbuilt, so they have no output to check.
//
// Usage: node scripts/dist-fresh.mjs

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PACKAGES = [
  {
    dir: "packages/yield",
    dist: "dist",
    inputs: ["src", "scripts", "tsconfig.build.json"]
  }
];

/** Every file under `path` (or `path` itself), as { path, mtimeMs }. */
function files(path) {
  if (!existsSync(path)) return [];
  const st = statSync(path);
  if (!st.isDirectory()) return [{ path, mtimeMs: st.mtimeMs }];
  return readdirSync(path).flatMap(name => files(join(path, name)));
}

const rel = p => relative(root, p);
const when = ms => new Date(ms).toISOString();
let stale = false;

for (const pkg of PACKAGES) {
  const base = join(root, pkg.dir);
  const dist = files(join(base, pkg.dist));
  const inputs = pkg.inputs.flatMap(i => files(join(base, i)));
  if (!dist.length) {
    console.error(`${pkg.dir}/${pkg.dist}/ is missing or empty`);
    stale = true;
    continue;
  }
  const oldest = dist.reduce((a, b) => (b.mtimeMs < a.mtimeMs ? b : a));
  const newest = inputs.reduce((a, b) => (b.mtimeMs > a.mtimeMs ? b : a));
  if (oldest.mtimeMs < newest.mtimeMs) {
    console.error(
      `${pkg.dir}/${pkg.dist}/ is stale: ${rel(oldest.path)} (${when(oldest.mtimeMs)}) ` +
        `is older than ${rel(newest.path)} (${when(newest.mtimeMs)})`
    );
    stale = true;
  } else {
    console.log(
      `${pkg.dir}/${pkg.dist}/ is fresh (${dist.length} files, newer than ${inputs.length} inputs)`
    );
  }
}

if (stale) {
  console.error("\nRun `pnpm build` before the gate (the gate never builds, D-008).");
  process.exit(1);
}
