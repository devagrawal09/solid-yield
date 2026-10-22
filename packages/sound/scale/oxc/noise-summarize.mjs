// Summarize completed trusted parse-only runs. This never imports application code.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
const [beforePath, afterPath, output] = process.argv.slice(2);
if (!output) throw new Error("Usage: noise-summarize.mjs before.json after.json output-directory");
const prefix = "/Users/devagr/solid-yield-wt/openclaw-trial/";
const rel = file => (file.startsWith(prefix) ? file.slice(prefix.length) : file);
const loc = value => ({ ...value, file: rel(value.file) });
const origins = d => (d.data?.origins ?? []).map(o => (typeof o === "string" ? JSON.parse(o) : o));
const key = d => [d.code, rel(d.loc.file), d.loc.line, d.loc.col].join(":");
const hash = text => createHash("sha256").update(text).digest("hex");
const normalized = d => ({
  ...d.data,
  origins: origins(d)
    .map(o => ({ ...o, loc: loc(o.loc) }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
});
function cause(d) {
  const reasons =
    d.code === "UNANALYZED_BOUNDARY"
      ? [d.data.construct]
      : origins(d).flatMap(o => o.reason.split("; "));
  if (reasons.some(r => /budget|bounded/.test(r))) return "work or alternatives budget fallback";
  if (
    reasons.some(r =>
      /outside|class construction|module reactive|derived signal|loop|recursive|dynamic|installed dependency/.test(
        r
      )
    )
  )
    return "unsupported construct or missing dependency declaration";
  if (reasons.includes("unknown declared failures")) return "annotation-only failure obligation";
  if (reasons.includes("unknown callable")) return "unresolved callable or receiver facts";
  if (reasons.includes("unmodeled platform contract")) return "unmodeled platform contract";
  if (reasons.includes("unknown failure facts")) return "unknown failure origin not further traced";
  if (reasons.some(r => /project throw|modeled failure/.test(r)))
    return "project throw or modeled failure";
  if (reasons.some(r => /pending memo/.test(r)))
    return "pending memo result without traced fallback";
  if (reasons.some(r => /pending source/.test(r)))
    return "pending source origin not further traced";
  if (reasons.some(r => /reactive source/.test(r))) return "settled reactive source read";
  if (d.code === "CONTEXT_PROVIDER_MISSING") return "missing provider in analyzed render path";
  if (d.code === "REACTIVE_WRITE_IN_OWNED_SCOPE") return "setter invoked in owned scope";
  if (d.code === "COMPONENT_OBLIGATIONS_EXPORTED") return "unmounted export obligation summary";
  return d.code === "UNANALYZED_BOUNDARY"
    ? "unsupported construct"
    : "obligation without recorded origin";
}
fs.mkdirSync(output, { recursive: true });
const runs = [beforePath, afterPath].map(file => {
  const bytes = fs.readFileSync(file);
  const run = JSON.parse(bytes);
  if (run.stage !== "complete" || run.roots !== 2669 || run.loc !== 524547)
    throw new Error("Incomplete or different input: " + file);
  const causes = {},
    direct = {},
    uses = new Map(),
    originIds = new Map(),
    originTable = [];
  const intern = origin => {
    const value = { ...origin, loc: loc(origin.loc) },
      k = JSON.stringify(value);
    if (!originIds.has(k)) {
      originIds.set(k, originTable.length);
      originTable.push(value);
    }
    return originIds.get(k);
  };
  const diagnostics = run.diagnostics.map(d => {
    const rootCause = cause(d),
      c = rootCause + ":" + d.severity;
    causes[c] = (causes[c] ?? 0) + 1;
    const os = origins(d),
      ids = os.map(intern);
    const downstream = os.length && !os.every(o => JSON.stringify(o.loc) === JSON.stringify(d.loc));
    const kind =
      d.code === "UNANALYZED_BOUNDARY"
        ? "direct boundary"
        : d.severity === "info"
          ? "summary"
          : downstream
            ? "downstream obligation"
            : "direct or untraced obligation";
    direct[kind] = (direct[kind] ?? 0) + 1;
    if (ids.length) {
      const k = [...ids].sort((a, b) => a - b).join(",");
      uses.set(k, (uses.get(k) ?? 0) + 1);
    }
    const data = { ...d.data };
    delete data.origins;
    return {
      code: d.code,
      severity: d.severity,
      loc: loc(d.loc),
      ownerName: d.ownerName,
      ownerPath: d.ownerPath,
      related: d.related?.map(r => ({ ...r, loc: loc(r.loc) })),
      data,
      origins: ids,
      rootCause,
      kind
    };
  });
  const raw = {
    schema: 1,
    originTable,
    diagnostics,
    inferenceSites: run.inferenceSites.map(s => ({ ...s, loc: loc(s.loc) })),
    worstSites: run.worstSites.map(s => ({ ...s, loc: loc(s.loc) }))
  };
  const name = file === beforePath ? "before" : "after";
  const packed = gzipSync(JSON.stringify(raw));
  fs.writeFileSync(path.join(output, "noise-" + name + ".json.gz"), packed);
  const count = severity => run.diagnostics.filter(d => d.severity === severity).length;
  const metrics = {
    rawPath: file,
    rawSHA256: hash(bytes),
    compactSHA256: hash(packed),
    rootSetSHA256: hash(run.cold.invalidatedFiles.map(rel).sort().join("\n")),
    roots: run.roots,
    excluded: run.excluded,
    loc: run.loc,
    coldMs: run.coldMs,
    process: JSON.parse(fs.readFileSync(file + ".process.json", "utf8")),
    coldPeakRSSKiB: run.coldPeakRSSKiB,
    maxRSSKiB: run.resourceUsage.maxRSS,
    errors: count("error"),
    warnings: count("warn"),
    info: count("info"),
    byCode: run.cold.counts,
    byRootCause: causes,
    directVsDownstream: direct,
    partial: run.cold.partial,
    inferenceNeeded: run.cold.inferenceNeeded,
    inferenceLocations: run.cold.inferenceLocations,
    worstCaseSites: run.cold.worstCaseSites,
    boundedSites: run.cold.scale.boundedSites,
    modules: run.cold.scale.modules,
    checkedJobs: run.cold.scale.checkedJobs,
    installedDiagnostics: run.diagnostics.filter(d => d.loc.file.includes("/node_modules/")).length,
    exactDuplicateCodeLocations: run.diagnostics.length - new Set(run.diagnostics.map(key)).size,
    repeatedOriginSets: [...uses.values()].filter(n => n > 1).length,
    diagnosticsWithRepeatedOriginSets: [...uses.values()]
      .filter(n => n > 1)
      .reduce((a, b) => a + b, 0)
  };
  return { run, metrics, diagnostics };
});
const [before, after] = runs,
  old = new Map(before.run.diagnostics.map(d => [key(d), d])),
  current = new Set(after.run.diagnostics.map(key));
const sample = [];
for (const code of [
  ...new Set(after.run.diagnostics.filter(d => d.severity === "error").map(d => d.code))
].sort()) {
  const ds = after.run.diagnostics
    .filter(d => d.code === code)
    .sort((a, b) => hash(key(a)).localeCompare(hash(key(b))));
  const changed = d =>
    !old.has(key(d)) ||
    JSON.stringify(normalized(d)) !== JSON.stringify(normalized(old.get(key(d))));
  const chosen = [
    ...ds.filter(changed).slice(0, 2),
    ...ds.filter(d => !changed(d)),
    ...ds.filter(changed).slice(2)
  ].slice(0, Math.min(5, ds.length));
  for (const d of chosen)
    sample.push({
      id: "E" + String(sample.length + 1).padStart(2, "0"),
      key: key(d),
      ...after.diagnostics.find(row => key(row) === key(d)),
      changed: changed(d)
    });
}
fs.writeFileSync(
  path.join(output, "noise-sample-selection.json"),
  JSON.stringify(sample, null, 2) + "\n"
);
const removed = before.run.diagnostics
  .filter(d => d.severity === "error" && !current.has(key(d)))
  .map(d => ({
    key: key(d),
    code: d.code,
    loc: loc(d.loc),
    origins: origins(d).map(o => ({ ...o, loc: loc(o.loc) }))
  }));
fs.writeFileSync(
  path.join(output, "noise-removed-errors.json.gz"),
  gzipSync(JSON.stringify(removed))
);
const added = after.run.diagnostics
  .filter(d => d.severity === "error" && !old.has(key(d)))
  .map(d => ({ code: d.code, loc: loc(d.loc), rootCause: cause(d) }));
fs.writeFileSync(
  path.join(output, "noise-measurements.json"),
  JSON.stringify(
    {
      before: before.metrics,
      after: after.metrics,
      removedErrors: removed.length,
      addedErrors: added.length,
      addedErrorCauses: added.reduce(
        (v, d) => ((v[d.rootCause] = (v[d.rootCause] ?? 0) + 1), v),
        {}
      ),
      selection:
        "Per error code: SHA256(code:trial-relative-file:line:col), first two changed findings plus first unchanged findings, up to five. Changed means new site or changed normalized origin set/data. No verdict influenced selection."
    },
    null,
    2
  ) + "\n"
);
console.log(
  JSON.stringify({
    before: before.metrics.errors,
    after: after.metrics.errors,
    removed: removed.length,
    added: added.length,
    sample: sample.length
  })
);
