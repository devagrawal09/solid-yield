// @ts-check
import { performance } from "node:perf_hooks";
import { Summaries } from "./summaries.mjs";
const fields = [
  "diagnostics",
  "keys",
  "inference",
  "worstSites",
  "nodes",
  "facts",
  "eventKeys",
  "readKeys",
  "summaries",
  "bounded",
  "work"
];
const empty = () => ({
  diagnostics: [],
  keys: new Set(),
  inference: new Map(),
  worstSites: new Map(),
  nodes: [],
  facts: new Map(),
  eventKeys: new WeakMap(),
  readKeys: new WeakMap(),
  summaries: new Summaries(),
  bounded: new Set(),
  work: new Map()
});
export class Jobs {
  constructor(previous = new Map(), dirty = new Set()) {
    this.previous = previous;
    this.dirty = dirty;
    this.results = new Map();
    this.reused = 0;
    this.checked = 0;
  }
  reusable(key) {
    const job = this.previous.get(key);
    return job && ![...job.dependencies].some(file => this.dirty.has(file)) ? job : null;
  }
  reuse(analysis, key) {
    const job = this.reusable(key);
    if (!job) return false;
    this.results.set(key, job);
    for (const fn of job.called) analysis.called.add(fn);
    this.reused++;
    return true;
  }
  run(analysis, key, file, fn) {
    if (this.results.has(key) || this.reuse(analysis, key)) return;
    const saved = Object.fromEntries(fields.map(field => [field, analysis[field]]));
    const parent = analysis.currentJob;
    const fresh = empty();
    Object.assign(analysis, fresh);
    const job = { dependencies: new Set([file]), called: new Set(), writes: new Set(), file };
    analysis.currentJob = job;
    const start = performance.now();
    try {
      fn();
    } finally {
      const output = Object.fromEntries(
        fields
          .filter(field => !["eventKeys", "readKeys", "summaries"].includes(field))
          .map(field => [field, analysis[field]])
      );
      this.results.set(key, {
        ...job,
        ...output,
        ms: performance.now() - start,
        summaryHits: analysis.summaries.hits,
        summaryMisses: analysis.summaries.misses
      });
      Object.assign(analysis, saved);
      analysis.currentJob = parent;
      this.checked++;
    }
  }
  collect(analysis) {
    for (const job of this.results.values()) {
      for (const diagnostic of job.diagnostics) {
        const loc = diagnostic.loc;
        const key = [diagnostic.code, loc.file, loc.line, loc.col].join(":");
        if (!analysis.keys.has(key)) {
          analysis.keys.add(key);
          analysis.diagnostics.push(diagnostic);
        }
      }
      for (const value of job.inference.values())
        analysis.inference.set(
          JSON.stringify([value.loc.file, value.loc.line, value.loc.col, value.reason]),
          value
        );
      for (const value of job.worstSites.values()) {
        const key = JSON.stringify(value.loc);
        const previous = analysis.worstSites.get(key);
        analysis.worstSites.set(key, {
          ...value,
          reasons: [...new Set([...(previous?.reasons ?? []), ...value.reasons])]
        });
      }
      for (const [key, fact] of job.facts) {
        const previous = analysis.facts.get(key);
        if (!previous)
          analysis.facts.set(key, {
            ...fact,
            reads: [...fact.reads],
            failures: [...fact.failures]
          });
        else {
          previous.pending ||= fact.pending;
          previous.failures = [...new Set([...previous.failures, ...fact.failures])];
          const seen = new Set(previous.reads.map(read => JSON.stringify(read)));
          for (const read of fact.reads)
            if (!seen.has(JSON.stringify(read))) previous.reads.push(read);
        }
      }
      analysis.nodes.push(...job.nodes);
      for (const node of job.bounded) analysis.bounded.add(node);
      for (const [file, count] of job.work)
        analysis.work.set(file, (analysis.work.get(file) ?? 0) + count);
    }
  }
  stats() {
    const jobs = [...this.results.values()];
    return {
      checkedJobs: this.checked,
      reusedJobs: this.reused,
      summaryHits: jobs.reduce((n, job) => n + job.summaryHits, 0),
      summaryMisses: jobs.reduce((n, job) => n + job.summaryMisses, 0),
      slowestJobs: [...this.results]
        .map(([key, job]) => ({ key, ms: job.ms }))
        .sort((a, b) => b.ms - a.ms)
        .slice(0, 10)
    };
  }
}
