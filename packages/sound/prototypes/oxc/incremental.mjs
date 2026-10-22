// @ts-check
import { createHash } from "node:crypto";
export function semanticHash(mod) {
  mod.semanticHash ??= createHash("sha256")
    .update(
      JSON.stringify(mod.ast, (key, value) =>
        key === "start" || key === "end"
          ? undefined
          : typeof value === "bigint"
            ? { bigint: String(value) }
            : value
      )
    )
    .digest("hex");
  return mod.semanticHash;
}
// The syntax is unchanged: retain value/closure identities and move every cached
// source location, including locations already held by a diagnostic or fact.
export function relocate(graph, previous, fresh) {
  previous.text = fresh.text;
  previous.lineStarts = fresh.lineStarts;
  previous.errors = fresh.errors;
  const move = (a, b) => {
    if (!a || typeof a !== "object") return;
    if (a.type) {
      const loc = graph.locationCache.get(a);
      a.start = b.start;
      a.end = b.end;
      if (loc) {
        graph.locationCache.delete(a);
        Object.assign(loc, graph.loc(a));
        graph.locationCache.set(a, loc);
      }
    }
    for (const key of Object.keys(a)) {
      if (key === "start" || key === "end") continue;
      if (Array.isArray(a[key])) a[key].forEach((child, index) => move(child, b[key][index]));
      else if (a[key] && typeof a[key] === "object") move(a[key], b[key]);
    }
  };
  move(previous.ast, fresh.ast);
  graph.modules.set(previous.path, previous);
}
export function invalidation(graph, edited, jobs) {
  const reverse = new Map();
  for (const mod of graph.modules.values()) {
    for (const link of [...mod.imported.values(), ...mod.exports.values()]) {
      if (!link.path) continue;
      if (!reverse.has(link.path)) reverse.set(link.path, new Set());
      reverse.get(link.path).add(mod.path);
    }
  }
  const reclassified = [...graph.modules.values()]
    .filter(mod => !mod.dependency && graph.isDependency(mod.path))
    .map(mod => mod.path);
  const dirty = new Set([edited, ...reclassified]);
  const queue = [...dirty];
  const add = file => {
    if (!dirty.has(file)) {
      dirty.add(file);
      queue.push(file);
    }
  };
  // Import cycles and shared-state writes use one finite worklist. A changed
  // caller also invalidates the render jobs that consumed its callee's props.
  for (let index = 0; index < queue.length; index++) {
    const file = queue[index];
    for (const importer of reverse.get(file) ?? []) add(importer);
    for (const job of jobs.values())
      if (job.dependencies.has(file)) for (const written of job.writes) add(written);
  }
  return dirty;
}
export function resetModule(mod) {
  mod.state = "new";
  mod.roots = [];
  mod.escapes = [];
  mod.env.cells.clear();
  for (const [key, link] of mod.imported) mod.env.define(key, link);
  for (const entry of mod.exports.values()) delete entry.value;
}
