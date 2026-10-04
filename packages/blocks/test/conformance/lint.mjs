#!/usr/bin/env node
// The conformance scenarios' library sources are block code: they lint clean
// under the lint every twin runs (eslint-plugin-solid-blocks' recommended
// rules, every one an error, plus no explicit `any`, with type information).
// ESLint, the parser and the plugin resolve from examples/harness — the
// twins' shared lint setup — so this package takes no dependency on the
// plugin (which would make a workspace cycle through vite-plugin-solid-blocks).
//
//   node test/conformance/lint.mjs   (from packages/blocks; part of test:conformance)
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "../..");
const harness = join(pkg, "../../examples/harness");
const require = createRequire(join(harness, "package.json"));
const { ESLint } = require("eslint");
const { default: blocksConfig } = await import(
  pathToFileURL(join(harness, "eslint.config.mjs")).href
);

process.chdir(pkg); // the config's projectService reads ./tsconfig.json
const files = ["test/conformance/scenarios/sources/*.library.tsx"];
const eslint = new ESLint({
  cwd: pkg,
  overrideConfigFile: true,
  overrideConfig: blocksConfig([], files)
});
const results = await eslint.lintFiles(files);
const formatter = await eslint.loadFormatter("stylish");
const problems = results.reduce((n, r) => n + r.errorCount + r.warningCount, 0);
if (results.length === 0) {
  console.error("conformance lint: no library sources found");
  process.exit(1);
}
if (problems) {
  console.error(await formatter.format(results));
  process.exit(1);
}
console.log(
  `conformance lint: ${results.length} library sources clean (${results.map(r => relative(pkg, r.filePath).replace(/^.*\//, "")).join(", ")})`
);
