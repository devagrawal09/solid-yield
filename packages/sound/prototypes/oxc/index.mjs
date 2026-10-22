// @ts-check
import { performance } from "node:perf_hooks";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { Modules, installedPath } from "./graph.mjs";
import { Analysis } from "./analyze.mjs";
import { semanticHash, relocate, invalidation, resetModule } from "./incremental.mjs";
export const name = "oxc";
function canonical(path) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}
export function createChecker(options) {
  const overrides = new Map();
  const aliases = new Map(
    options.files
      .filter(path => !installedPath(path) && !installedPath(canonical(path)))
      .map(path => [canonical(path), path])
  );
  let disposed = false;
  let jobs = new Map();
  let current = null;
  const graph = new Modules({
    ...options,
    rootDir: canonical(options.rootDir),
    files: [...aliases.keys()],
    readFile: path =>
      overrides.get(canonical(path)) ?? options.readFile?.(aliases.get(canonical(path)) ?? path)
  });
  const live = () => {
    if (disposed) throw new Error("Checker is disposed.");
  };
  function perform(start, dirty) {
    const analysis = new Analysis(graph, jobs, dirty);
    const result = analysis.run();
    jobs = analysis.jobs.results;
    current = { ...result, invalidatedFiles: [...dirty], elapsedMs: performance.now() - start };
    return current;
  }
  function check() {
    live();
    const start = performance.now();
    if (current) return { ...current, invalidatedFiles: [], elapsedMs: performance.now() - start };
    return perform(start, new Set(aliases.keys()));
  }
  return {
    check,
    update(path, text) {
      live();
      const start = performance.now();
      const key = canonical(path);
      const previous = graph.modules.get(key);
      overrides.set(key, text);
      graph.modules.delete(key);
      const fresh = graph.load(key);
      const after = semanticHash(fresh);
      if (current && previous && semanticHash(previous) === after) {
        relocate(graph, previous, fresh);
        current = {
          ...current,
          invalidatedFiles: [key],
          summaryChangedFiles: [],
          summaryHash: after,
          elapsedMs: performance.now() - start,
          scale: { ...current.scale, checkedJobs: 0, reusedJobs: jobs.size }
        };
        return current;
      }
      const dirty = invalidation(graph, key, jobs);
      // Drop old activation environments before building their replacements.
      jobs = new Map(
        [...jobs].filter(([, job]) => ![...job.dependencies].some(file => dirty.has(file)))
      );
      current = null;
      for (const file of dirty) {
        const mod = graph.modules.get(file);
        if (mod) resetModule(mod);
      }
      const result = perform(start, dirty);
      current = { ...result, summaryChangedFiles: [key], summaryHash: after };
      return current;
    },
    dispose() {
      disposed = true;
      current = null;
      overrides.clear();
      jobs.clear();
      graph.modules.clear();
      graph.resolutions.clear();
      graph.packages.clear();
      graph.dependencyCache.clear();
      graph.dependencies.clear();
      graph.dependencyRoots.clear();
      graph.resolver.clearCache();
    }
  };
}
