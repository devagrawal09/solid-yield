import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// F-C12: an explicit, bounded purity contract, not inferred package purity.
// Reviewed implementation: fresh Marked/highlighter instances; local heading
// counters; fixed locale/zone; only the Article argument affects the result.
// Changing this file or the pinned packages requires reviewing the contract.
const directory = resolve(import.meta.dirname, "../../../examples/docs-yield");
const digest = "6dd98c220e9c8f842f6a6191cc4ce5386b8e23a5380c93154f3743202ee9aa3d";
export function auditedArticlePipeline(record, fn) {
  if (
    record?.id !== resolve(directory, "src/article-pipeline.ts") ||
    fn.node.id?.name !== "renderArticle" ||
    createHash("sha256").update(record.code).digest("hex") !== digest
  )
    return false;
  for (const [name, version] of [
    ["marked", "18.1.0"],
    ["highlight.js", "11.12.0"]
  ]) {
    const installed = JSON.parse(
      readFileSync(resolve(directory, "node_modules", name, "package.json"), "utf8")
    );
    if (installed.version !== version) return false;
  }
  return true;
}
