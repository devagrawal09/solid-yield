#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import { corpus, root } from "./corpus.mjs";
import { generate } from "./generate.mjs";
import { catalog } from "./catalog.mjs";
/**
 * A kill: an expected code whose primary or related location falls in the
 * mutated routine. A deleted Errored, Loading or provider is reported where
 * the failure, pending read or requirement reaches a root or handoff, with the
 * origin inside the routine as a related location; the exact-line rule missed
 * those (`exactLine` keeps it for comparison).
 */
export function inRoutine(mutant, at) {
  if (!at || at.file !== mutant.file || typeof at.line !== "number") return false;
  const { start, end } = mutant.routine ?? { start: mutant.line, end: mutant.line };
  return at.line >= start && at.line <= end;
}
export function classify(mutant, result, base) {
  if (mutant.equivalent) return "equivalent";
  const expected = catalog[mutant.operator].expected;
  const match = d =>
    [d.code, d.tsCode, d.ruleId].some(code => expected.includes(code)) &&
    (inRoutine(mutant, d) || (d.related ?? []).some(r => inRoutine(mutant, r)));
  return result.diagnostics.some(match) ? "killed" : "survived";
}
export function exactLine(mutant, result) {
  const expected = catalog[mutant.operator].expected;
  return result.diagnostics.some(
    d =>
      d.file === mutant.file &&
      d.line === mutant.line &&
      [d.code, d.tsCode, d.ruleId].some(code => expected.includes(code))
  );
}
export function fingerprint(projects, runnerText) {
  const hash = createHash("sha256");
  for (const dir of [
    "packages/vite-plugin-yield/src",
    "packages/compiler-yield/src",
    "packages/ts-plugin-yield/src",
    "packages/eslint-plugin-yield/src",
    "packages/yield/dist",
    "packages/yield/jsx"
  ]) {
    for (const file of readdirSync(join(root, dir), { recursive: true })
      .filter(
        f =>
          /\.(?:[cm]?js|ts|json)$/.test(f) &&
          !/node_modules|\.native-generated|tools|results/.test(f)
      )
      .sort()) {
      hash.update(dir + "/" + file);
      hash.update(readFileSync(join(root, dir, file)));
    }
  }
  for (const file of ["catalog.mjs", "generate.mjs", "corpus.mjs", "worker.mjs", "run.mjs"]) {
    hash.update(file);
    hash.update(
      file === "run.mjs" && runnerText !== undefined
        ? runnerText
        : readFileSync(join(import.meta.dirname, file))
    );
  }
  hash.update(readFileSync(join(root, "pnpm-lock.yaml")));
  hash.update(JSON.stringify(projects.map(p => ({ ...p, files: [...p.files] }))));
  return hash.digest("hex");
}
async function main() {
  const started = new Date(),
    projects = corpus(),
    digest = fingerprint(projects);
  const scratch = join(import.meta.dirname, ".native-generated");
  mkdirSync(scratch, { recursive: true });
  const cache = join(scratch, "cache-" + digest + ".json");
  const baselineArg = process.argv.indexOf("--baseline");
  const baseline =
    baselineArg < 0
      ? null
      : JSON.parse(readFileSync(resolve(process.argv[baselineArg + 1]), "utf8")).mutation;
  let report;
  if (process.argv.includes("--cached") && existsSync(cache)) {
    report = JSON.parse(readFileSync(cache, "utf8"));
    console.log("mutation: content-verified cache " + digest.slice(0, 12));
  } else {
    const jobs = [],
      mutants = [];
    for (const project of projects) {
      const base = { id: "base-" + project.id, project: project.id, files: [...project.files] };
      jobs.push(base);
      for (const [file, source] of project.files)
        for (const m of generate(source, file)) {
          const mutant = {
            ...m,
            id: "M" + String(mutants.length + 1).padStart(4, "0"),
            project: project.id,
            file,
            original: source
          };
          mutants.push(mutant);
          jobs.push({
            id: mutant.id,
            project: project.id,
            file,
            files: [...project.files].map(([f, c]) => [f, f === file ? m.source : c])
          });
        }
    }
    const results = new Map();
    let next = 0,
      complete = 0;
    console.log(
      `mutation: ${projects.length} projects, ${mutants.length} mutants; transform → CLI → generated lint`
    );
    async function worker() {
      while (next < jobs.length) {
        const job = jobs[next++],
          dir = join(scratch, "jobs", job.id);
        mkdirSync(dir, { recursive: true });
        const path = join(dir, "job.json");
        writeFileSync(path, JSON.stringify(job));
        await new Promise((ok, bad) => {
          const child = spawn(process.execPath, [join(import.meta.dirname, "worker.mjs"), path], {
            cwd: root,
            stdio: ["ignore", "pipe", "pipe"]
          });
          let output = "";
          child.stdout.on("data", s => (output += s));
          child.stderr.on("data", s => (output += s));
          const timeout = setTimeout(() => child.kill("SIGKILL"), 90_000);
          child.on("error", bad);
          child.on("close", code => {
            clearTimeout(timeout);
            code === 0
              ? ok()
              : bad(new Error(`${job.id}: worker failed (${code}): ${output.slice(-2500)}`));
          });
        });
        results.set(job.id, JSON.parse(readFileSync(join(dir, "result.json"), "utf8")));
        rmSync(dir, { recursive: true, force: true });
        if (++complete % 25 === 0)
          console.log(`mutation: ${complete}/${jobs.length} pipelines complete`);
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    const counts = Object.fromEntries(
      Object.keys(catalog).map(op => [op, { mutants: 0, killed: 0, survived: 0, equivalent: 0 }])
    );
    for (const mutant of mutants) {
      mutant.result = results.get(mutant.id);
      const prior = results.get("base-" + mutant.project);
      // A match the unmutated program already has is flagged, not discounted.
      mutant.preExistingMatch = classify(mutant, prior, prior) === "killed";
      mutant.status = classify(mutant, mutant.result, prior);
      mutant.exactLine = !mutant.equivalent && exactLine(mutant, mutant.result);
      counts[mutant.operator].mutants++;
      counts[mutant.operator][mutant.status]++;
    }
    for (const [op, count] of Object.entries(counts))
      if (!count.mutants) throw new Error("Operator has no sites: " + op);
    const total = Object.values(counts).reduce(
      (a, c) => {
        for (const k of ["mutants", "killed", "survived", "equivalent"]) a[k] += c[k];
        return a;
      },
      { mutants: 0, killed: 0, survived: 0, equivalent: 0 }
    );
    total.score = (100 * total.killed) / (total.killed + total.survived);
    report = {
      startedAt: started.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      digest,
      projects: projects.map(p => ({
        id: p.id,
        origin: p.origin,
        files: p.files.size,
        base: results.get("base-" + p.id)
      })),
      counts,
      total,
      mutants
    };
    writeFileSync(cache, JSON.stringify(report));
  }
  writeFileSync(
    join(root, "documentation/mutation-program-results.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(
    `mutation: ${report.total.killed} killed / ${report.total.survived} survived / ${report.total.equivalent} equivalent; score ${report.total.score.toFixed(2)}%`
  );
  if (baseline) {
    // Count floors stop accidental corpus shrinkage from making a score appear better.
    const missing = Object.entries(baseline.counts).filter(
      ([op, c]) => report.counts[op].mutants < c.mutants
    );
    if (report.total.score + 1e-10 < baseline.score || missing.length)
      throw new Error(
        `Mutation regression: baseline ${baseline.score.toFixed(2)}%; operator count drops ${missing.map(([op]) => op).join(",") || "none"}`
      );
    console.log("mutation: PASS (score and per-operator site floors retained)");
  } else console.log("mutation: initial score measured (no threshold yet)");
}
if (process.argv[1] === resolve(import.meta.filename))
  main().catch(e => {
    console.error(e.message);
    process.exitCode = 1;
  });
