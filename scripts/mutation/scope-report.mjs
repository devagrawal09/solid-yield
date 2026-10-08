// Incremental Stryker reports retain cached files outside a narrower mutate
// scope. Preserve that raw report and select explicit file entries only.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const [input, configFile, output, expected] = process.argv.slice(2);
if (!input || !configFile || !output) throw new Error("Expected input, config, output and optional mutant count");
const config = (await import(pathToFileURL(resolve(configFile)).href)).default;
if (config.mutate.some(file => /[*!?:]/.test(file))) throw new Error("Use explicit whole-file scopes");
const report = JSON.parse(readFileSync(input, "utf8"));
const files = Object.fromEntries(config.mutate.map(file => {
  if (!report.files[file]) throw new Error(`Missing report file: ${file}`);
  return [file, report.files[file]];
}));
const counts = {};
for (const file of Object.values(files)) for (const m of file.mutants) {
  if (["Pending", "NotRun"].includes(m.status)) throw new Error("Incomplete scoped report");
  counts[m.status] = (counts[m.status] ?? 0) + 1;
}
const mutants = Object.values(counts).reduce((a, b) => a + b, 0);
if (expected && mutants !== Number(expected)) throw new Error(`Expected ${expected} mutants, found ${mutants}`);
const detected = (counts.Killed ?? 0) + (counts.Timeout ?? 0);
const denominator = detected + (counts.Survived ?? 0) + (counts.NoCoverage ?? 0);
writeFileSync(output, JSON.stringify({ ...report, files }) + "\n");
console.log(JSON.stringify({ files: Object.keys(files), mutants, counts, score: denominator ? 100 * detected / denominator : null }));
