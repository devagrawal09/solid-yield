#!/usr/bin/env node
// The native surface check: every form × host × variant (programs.mjs) goes
// through the mutation program's pipeline (transform, `solid-yield check`,
// generated lint) and must get exactly what plain Solid says. A host's cells
// run as one project; a project the transform refuses is rerun file by file,
// since a refusal stops the whole check. `--write` records the outcome in
// documentation/native-surface.json.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fork } from "node:child_process";
import { cells } from "./programs.mjs";

const root = resolve(import.meta.dirname, "../..");
const generated = join(import.meta.dirname, ".native-generated");
const scratch = join(generated, String(process.pid));

/** The files under `dir`, relative to it; not into generated or installed
 * directories, whose `node_modules` links lead back into the repository. */
function sources(dir, prefix = "") {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? [".native-generated", "node_modules"].includes(entry.name)
        ? []
        : sources(dir, join(prefix, entry.name))
      : entry.isFile()
        ? [join(prefix, entry.name)]
        : []
  );
}
// `--cached`: a result for the same checker, library, pipeline and corpus
// (by content) is reused, as the mutation program's is.
const hash = createHash("sha256");
for (const dir of [
  "packages/vite-plugin-yield/src",
  "packages/compiler-yield/src",
  "packages/ts-plugin-yield/src",
  "packages/eslint-plugin-yield/src",
  "packages/yield/dist",
  "packages/yield/jsx",
  "scripts/native-surface"
])
  for (const file of sources(join(root, dir))
    .filter(f => /\.(?:[cm]?js|ts|json)$/.test(f))
    .sort()) {
    hash.update(dir + "/" + file);
    hash.update(readFileSync(join(root, dir, String(file))));
  }
hash.update(readFileSync(join(root, "scripts/mutation/worker.mjs")));
hash.update(readFileSync(join(root, "pnpm-lock.yaml")));
const digest = hash.digest("hex");
const cache = join(generated, `surface-${digest}.json`);
if (process.argv.includes("--cached") && existsSync(cache)) {
  console.log(readFileSync(cache, "utf8").trim());
  console.log(`native surface: content-verified cache ${digest.slice(0, 12)}`);
  process.exit(0);
}
// Only errors count: a warning informs (D-116's boundaries, retained types,
// the lint's suggestions such as `no-unshown-wait`).
const informational = new Set(["NATIVE_FOREIGN_BOUNDARY", "NATIVE_TYPE_UNMAPPED"]);

// `--only <regex>`: the cells whose form matches, for a quick look; nothing is
// recorded.
const only = process.argv.includes("--only")
  ? new RegExp(process.argv[process.argv.indexOf("--only") + 1])
  : null;
const all = cells().filter(c => !only || only.test(c.form));
const groups = new Map();
for (const cell of all) {
  const key = `${cell.host}/${cell.variant}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(cell);
}

/** A pool of long-lived pipeline workers (scripts/mutation/worker.mjs --serve). */
function pool(size) {
  const workers = Array.from({ length: size }, () =>
    fork(join(root, "scripts/mutation/worker.mjs"), ["--serve"], {
      cwd: root,
      stdio: ["ignore", "ignore", "pipe", "ipc"]
    })
  );
  const idle = [...workers];
  const waiting = [];
  /** @param {{ id: string, files: [string, string][] }} job */
  const run = async job => {
    const worker = idle.pop() ?? (await new Promise(r => waiting.push(r)));
    const dir = join(scratch, job.id);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "job.json");
    writeFileSync(path, JSON.stringify({ ...job, project: job.id }));
    try {
      await new Promise((ok, bad) => {
        const done = m => {
          if (m?.path !== path) return;
          worker.off("message", done);
          m.ok ? ok() : bad(new Error(`${job.id}: ${String(m.error).slice(-2000)}`));
        };
        worker.on("message", done);
        worker.send({ path });
      });
      return JSON.parse(readFileSync(join(dir, "result.json"), "utf8"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
      const next = waiting.shift();
      next ? next(worker) : idle.push(worker);
    }
  };
  return { run, close: () => workers.forEach(w => w.kill()) };
}

const { run, close } = pool(3);
/** @type {Map<string, any[]>} */
const reported = new Map(all.map(c => [c.file, []]));
try {
  const record = result => {
    for (const d of result.diagnostics)
      if (!informational.has(d.code) && (d.severity ?? "error") === "error")
        reported.get(d.file)?.push(d);
  };
  // A refusal stops the whole project: a refused batch is halved until each
  // refusal stands alone.
  let jobs = 0;
  // A crash (the pipeline threw) is bisected the same way, and reported as
  // the program's outcome.
  const batch = async group => {
    let result;
    try {
      result = await run({ id: `job${++jobs}`, files: group.map(c => [c.file, c.source]) });
    } catch (error) {
      if (group.length === 1)
        return reported
          .get(group[0].file)
          .push({ stage: "crash", line: 0, code: "CRASH", message: String(error.message) });
    }
    if (result && (result.stages.transform !== "refused" || group.length === 1))
      return record(result);
    const half = Math.ceil(group.length / 2);
    await Promise.all([batch(group.slice(0, half)), batch(group.slice(half))]);
  };
  await Promise.all([...groups.values()].map(batch));
} finally {
  close();
  rmSync(scratch, { recursive: true, force: true });
}

const outcome = all.map(c => {
  const codes = [...new Set(reported.get(c.file).map(d => d.code))].sort();
  const pass =
    c.expected.every(code => codes.includes(code)) &&
    codes.every(code => c.expected.includes(code));
  return {
    form: c.form,
    host: c.host,
    variant: c.variant,
    expected: c.expected,
    reported: codes,
    pass,
    ...(pass
      ? {}
      : {
          messages: reported
            .get(c.file)
            .map(d => `${d.stage} ${d.line}: ${d.code} ${d.message}`.slice(0, 400))
        })
  };
});
const failed = outcome.filter(o => !o.pass);
const code = all.filter(c => c.variant !== "jsx"),
  jsx = all.length - code.length;
console.log(
  `native surface: ${all.length} programs (${new Set(code.map(c => c.form)).size} code forms × ${new Set(code.map(c => c.host)).size} hosts × read/write/pending, ${jsx} JSX constructs), ${all.length - failed.length} as plain Solid says`
);
if (process.argv.includes("--write") && !only)
  writeFileSync(
    join(root, "documentation/native-surface.json"),
    JSON.stringify({ programs: all.length, failed: failed.length, outcome }, null, 2) + "\n"
  );
if (!failed.length && !only) {
  mkdirSync(generated, { recursive: true });
  writeFileSync(
    cache,
    `native surface: ${all.length} programs, ${all.length} as plain Solid says\n`
  );
}
if (failed.length) {
  for (const f of failed)
    console.error(
      `  ${f.host}/${f.variant}/${f.form}: expected [${f.expected}] reported [${f.reported}]\n    ${(f.messages ?? []).join("\n    ")}`
    );
  process.exitCode = 1;
}
