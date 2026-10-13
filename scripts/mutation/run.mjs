#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { fork } from "node:child_process";
import { corpus, root } from "./corpus.mjs";
import { generate } from "./generate.mjs";
import { catalog } from "./catalog.mjs";
import { markSiteEquivalents } from "./equivalents.mjs";
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
/** The failure kinds a diagnostic lists ("can fail with A | B and …",
 * "Remaining: A | B."), or none. */
export function kindsOf(message = "") {
  const list = /(?:fail with|Remaining:)\s+(.+?)(?:\s+and\b|[;.]|$)/.exec(message)?.[1];
  return list ? list.split("|").map(k => k.trim()) : [];
}
export function classify(mutant, result, base) {
  if (mutant.equivalent) return "equivalent";
  const { expected, anywhere } = catalog[mutant.operator];
  // A deleted boundary (Dev, 2026-10-13): an expected code the unmutated
  // program did not report counts wherever it is, at the read it covered;
  // so does one it reported there that now lists more failure kinds.
  const key = d => `${d.file}:${d.line}:${d.code}`;
  const before = new Map((base?.diagnostics ?? []).map(d => [key(d), d]));
  const fresh = d => {
    const prior = before.get(key(d));
    if (!prior) return true;
    const now = kindsOf(d.message),
      then = kindsOf(prior.message);
    return then.every(k => now.includes(k)) && now.some(k => !then.includes(k));
  };
  const match = d =>
    [d.code, d.tsCode, d.ruleId].some(code => expected.includes(code)) &&
    (inRoutine(mutant, d) ||
      (d.related ?? []).some(r => inRoutine(mutant, r)) ||
      (!!anywhere && fresh(d)));
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
  for (const file of [
    "catalog.mjs",
    "generate.mjs",
    "corpus.mjs",
    "equivalents.mjs",
    "worker.mjs",
    "run.mjs"
  ]) {
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
    const results = new Map();
    let jobs = [],
      next = 0,
      complete = 0;
    // A long-lived worker (worker.mjs --serve) per lane: its parsed libraries
    // and declarations stay warm across pipelines. It is replaced every
    // RECYCLE jobs, which bounds what a job leaves behind (a worker serving
    // all of them grew past 4 GB). A failure or a timeout still fails the run.
    const RECYCLE = 40;
    async function worker() {
      let output = "";
      const keep = s => (output = (output + s).slice(-5000));
      const start = () => {
        const forked = fork(join(import.meta.dirname, "worker.mjs"), ["--serve"], {
          cwd: root,
          stdio: ["ignore", "pipe", "pipe", "ipc"]
        });
        forked.stdout?.on("data", keep);
        forked.stderr?.on("data", keep);
        return forked;
      };
      let child = start(),
        served = 0;
      try {
        while (next < jobs.length) {
          if (served++ === RECYCLE) {
            child.kill();
            child = start();
            served = 1;
          }
          const job = jobs[next++],
            dir = join(scratch, "jobs", job.id);
          mkdirSync(dir, { recursive: true });
          const path = join(dir, "job.json");
          writeFileSync(path, JSON.stringify(job));
          await new Promise((ok, bad) => {
            const timeout = setTimeout(() => child.kill("SIGKILL"), 90_000);
            /** @param {any} m */
            const done = m => {
              if (m?.path !== path) return;
              cleanup();
              m.ok
                ? ok()
                : bad(new Error(`${job.id}: worker failed: ${String(m.error).slice(-2500)}`));
            };
            /** @param {number | null} code */
            const exited = code => {
              cleanup();
              bad(new Error(`${job.id}: worker exited (${code}): ${output.slice(-2500)}`));
            };
            const cleanup = () => {
              clearTimeout(timeout);
              child.off("message", done);
              child.off("exit", exited);
            };
            child.on("message", done);
            child.on("exit", exited);
            child.send({ path });
          });
          results.set(job.id, JSON.parse(readFileSync(join(dir, "result.json"), "utf8")));
          rmSync(dir, { recursive: true, force: true });
          if (++complete % 25 === 0)
            console.log(`mutation: ${complete}/${jobs.length} pipelines complete`);
        }
      } finally {
        child.kill();
      }
    }
    const run = async list => {
      jobs = list;
      next = 0;
      await Promise.all([worker(), worker(), worker()]);
    };
    // Every unmutated program first.
    await run(
      projects.map(project => ({
        id: "base-" + project.id,
        project: project.id,
        files: [...project.files]
      }))
    );
    // A program seeded with a deliberate mistake the checker reports stays a
    // check of that mistake: the checker stops at a refusal and holds some
    // checks until earlier errors are fixed, so a second mistake on top could
    // not show. Second mistakes go on clean programs (Dev, 2026-10-13).
    const masks = base => base.stages.transform === "refused" || base.stages.cli === "diagnostics";
    const mutated = projects.filter(p => !(p.seeded && masks(results.get("base-" + p.id))));
    const mutants = [],
      mutantJobs = [];
    // A surface program's own mutants: the sites in its form's lines, and
    // the boundaries around it.
    const own = (project, m) =>
      !project.lines ||
      project.boundaries?.includes(m.operator) ||
      (m.line >= project.lines[0] && m.line <= project.lines[1]);
    for (const project of mutated)
      for (const [file, source] of project.files) {
        // Two sites can make the same program (`await (await f()).text()`
        // rejects after its statement either way): it is one mutant.
        const made = new Set();
        for (const m of generate(source, file).filter(m => own(project, m))) {
          if (made.has(m.source)) continue;
          made.add(m.source);
          const mutant = {
            ...m,
            id: "M" + String(mutants.length + 1).padStart(4, "0"),
            project: project.id,
            file,
            original: source
          };
          mutants.push(mutant);
          mutantJobs.push({
            id: mutant.id,
            project: project.id,
            file,
            files: [...project.files].map(([f, c]) => [f, f === file ? m.source : c])
          });
        }
      }
    markSiteEquivalents(mutants, new Map(projects.map(p => [p.id, p.files])));
    console.log(
      `mutation: ${projects.length} projects (${mutated.length} mutated), ${mutants.length} mutants; transform → CLI → generated lint`
    );
    complete = 0;
    await run(mutantJobs);
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
        mutated: mutated.includes(p),
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
