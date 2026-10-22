// @ts-check
import { performance } from "node:perf_hooks";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { Modules, installedPath } from "./graph.mjs";
import { Analysis } from "./analyze.mjs";
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
  const graph = new Modules({
    ...options,
    rootDir: canonical(options.rootDir),
    files: [...aliases.keys()],
    readFile: path =>
      overrides.get(canonical(path)) ?? options.readFile?.(aliases.get(canonical(path)) ?? path)
  });
  function check() {
    if (disposed) throw new Error("Checker is disposed.");
    const start = performance.now();
    for (const mod of graph.modules.values()) {
      mod.state = "new";
      mod.env.cells.clear();
      for (const [key, link] of mod.imported) mod.env.define(key, link);
      for (const entry of mod.exports.values()) delete entry.value;
    }
    const result = new Analysis(graph).run();
    return { ...result, elapsedMs: performance.now() - start };
  }
  return {
    check,
    update(path, text) {
      const key = canonical(path);
      overrides.set(key, text);
      graph.modules.delete(key);
      return check();
    },
    dispose() {
      disposed = true;
      overrides.clear();
      graph.modules.clear();
    }
  };
}
