#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { catalog } from "./catalog.mjs";
const root = resolve(import.meta.dirname, "../..");
const program = JSON.parse(
  readFileSync(join(root, "documentation/mutation-program-results.json"), "utf8")
);
const safe = s => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");
// Three readings of each mutant. `killed` (the gate's): an expected code at a
// primary or related location in the mutated routine. `exactLine`: at the edited
// line itself, the original rule. `detected`: an expected code the unmutated
// base lacks, wherever it is reported.
const bases = new Map(program.projects.map(p => [p.id, p.base]));
const sameDiagnostic = (a, b) =>
  a.stage === b.stage &&
  a.code === b.code &&
  a.file === b.file &&
  a.line === b.line &&
  a.message === b.message;
const fresh = m =>
  m.result.diagnostics.filter(
    d => !bases.get(m.project).diagnostics.some(b => sameDiagnostic(b, d))
  );
const expects = (m, d) =>
  [d.code, d.tsCode, d.ruleId].some(code => catalog[m.operator].expected.includes(code));
for (const m of program.mutants) {
  m.detected = !m.equivalent && fresh(m).some(d => expects(m, d));
  const base = bases.get(m.project).stages;
  m.category =
    m.status !== "survived"
      ? null
      : m.detected
        ? "detected elsewhere"
        : base.transform === "refused"
          ? "masked: base refused"
          : fresh(m).length === 0 && base.cli === "diagnostics"
            ? "masked: base errors"
            : fresh(m).length
              ? "different code"
              : "silent";
}
const readings = Object.fromEntries(
  Object.keys(program.counts).map(op => {
    const ms = program.mutants.filter(m => m.operator === op && !m.equivalent);
    return [
      op,
      {
        exact: ms.filter(m => m.exactLine).length,
        detected: ms.filter(m => m.detected).length,
        categories: Object.fromEntries(
          [
            "detected elsewhere",
            "masked: base refused",
            "masked: base errors",
            "different code",
            "silent"
          ].map(c => [c, ms.filter(m => m.category === c).length])
        )
      }
    ];
  })
);
const percent = (n, d) => (d ? ((100 * n) / d).toFixed(2) + "%" : "n/a");
const out = [
  "# Mutation report",
  "",
  `Measured ${program.finishedAt}. The corpus, operators and checker have changed since the first measurement (2026-10-08); each change is in its own commit, and the catalogue's corrections are listed below. The tests in scripts/mutation/test.mjs verify the harness, not the checker.`,
  "",
  "## Commands and scope",
  "",
  "```sh",
  "npm install --prefix scripts/mutation/tools --ignore-scripts",
  "node --test scripts/mutation/test.mjs",
  "node scripts/mutation/run.mjs",
  "node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run scripts/mutation/stryker-eslint.config.mjs",
  "node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run scripts/mutation/stryker-ts.config.mjs",
  "```",
  "",
  `Program run: ${(program.durationMs / 1000).toFixed(1)} seconds; ${program.projects.length} projects; ${program.total.mutants} mutants. Digest: \`${program.digest}\`.`,
  "",
  "Every syntactically applicable site is edited separately. Sources stay plain Solid. Each pipeline runs the shared native transform, the exported implementation used by `solid-yield check`, and recommended ESLint on generated code. A transform refusal blocks generated lint and is recorded explicitly. A CLI crash is a finding, never a kill.",
  "",
  "Each mutant is read three ways. **Killed** (the gate's rule, since 2026-10-10): an expected diagnostic code whose primary or related location falls in the mutated routine, the top-level declaration holding the edit. **Exact line** (the first measurement's rule, as originally requested): an expected code at the edited file and authored line (±0). **Detected**: an expected code the unmutated base program lacks, wherever it is reported; a removed Errored, Loading or provider is reported where the failure, pending read or requirement originates and at the root, never at the removed tag, so only this reading sees it. Generated lint uses the transform position table. Existing diagnostics in broken base programs count for the location rules; those matches are flagged in the JSON evidence (`preExistingMatch`). “Equivalent” means diagnostic-equivalent under the documented design, not identical runtime behavior; equivalent edits still run through the pipeline. Warnings are recorded; only a code in the expected set can kill or detect.",
  "",
  "The gate runs `node scripts/mutation/run.mjs --cached --baseline documentation/yield-gate-baseline.json`. The cache hashes corpus content, mutation implementation, checker sources, library declarations/output and dependency lockfile. It is a local speed aid, not a committed result substitute: fresh checkouts run all pipelines. Any hashed change forces a fresh run. The gate checks the score and per-operator site floors. A checker change that raises the score is its own commit with its own tests; a catalogue change is listed as a correction.",
  "",
  "## Program mutants",
  "",
  "| Operator | Mutants | Equivalent | Killed | Survived | Score | Exact line | Detected | Expected codes |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |"
];
for (const [op, c] of Object.entries(program.counts)) {
  const r = readings[op],
    n = c.killed + c.survived;
  out.push(
    `| ${op} | ${c.mutants} | ${c.equivalent} | ${c.killed} | ${c.survived} | ${percent(c.killed, n)} | ${r.exact} (${percent(r.exact, n)}) | ${r.detected} (${percent(r.detected, n)}) | ${catalog[op].expected.join(", ") || "equivalent"} |`
  );
}
const scored = program.total.killed + program.total.survived;
const all = Object.values(readings).reduce(
  (a, r) => ({ exact: a.exact + r.exact, detected: a.detected + r.detected }),
  { exact: 0, detected: 0 }
);
out.push(
  "",
  `**Program mutation score: ${program.total.score.toFixed(2)}% = ${program.total.killed} / (${program.total.killed} + ${program.total.survived}).** ${program.total.equivalent} equivalents excluded. Exact line: ${percent(all.exact, scored)} (${all.exact}). Detected: ${percent(all.detected, scored)} (${all.detected}).`,
  "",
  "### Why mutants survive",
  "",
  "Each survivor of the gate's rule falls in one category: **detected elsewhere** (an expected code the base lacks, outside the routine), **masked: base refused** (the unmutated program is already refused by the transform, which stops at its first refusal), **masked: base errors** (the base already has errors and the mutant adds none: a check suppressed by an earlier error, such as `FOREIGN_HANDOFF`'s \"fix the earlier errors\"), **different code** (new diagnostics, none expected), **silent** (no new diagnostic). A silent survivor on a clean base is either an equivalent edit the catalogue does not recognise or a missed check; the survivors list below has each one's diff.",
  "",
  "| Operator | Detected elsewhere | Masked: base refused | Masked: base errors | Different code | Silent |",
  "| --- | ---: | ---: | ---: | ---: | ---: |"
);
for (const [op, r] of Object.entries(readings))
  if (Object.values(r.categories).some(Boolean))
    out.push(`| ${op} | ${Object.values(r.categories).join(" | ")} |`);
out.push("", "### Catalogue and equivalent rules", "");
for (const [op, c] of Object.entries(catalog))
  out.push(
    `- **${op}:** ${c.edit}${c.equivalent ? " Equivalent reason: " + c.equivalent : ""}${c.corrected ? " Correction: " + c.corrected : ""}`
  );
out.push(
  "",
  "### Corpus provenance",
  "",
  "The reviewer app and all 17 stored variants are verbatim snapshots under `scripts/mutation/corpus/reviewer`. They include all twelve numbered mistakes plus the boundary removals and throw variants. Historical programs come from `scripts/native/fixtures.mjs`: 18 reconstructed programs cover the 27 recoverable slots; T12–T15 and R10–R12 remain unavailable. The original two apps are read directly from their unchanged repository sources. The operator seeds ensure every operator has sites; the sugar-edges seed exercises the native edges added since (context hooks and members, setters in plain types, wrappers with boundaries around context readers, array callbacks, effect cleanups, an anonymous default component).",
  "",
  "| Project | Files | Base transform / CLI / lint | Origin |",
  "| --- | ---: | --- | --- |"
);
for (const p of program.projects)
  out.push(
    `| ${p.id} | ${p.files} | ${Object.values(p.base.stages).join(" / ")} | ${safe(p.origin)} |`
  );
const checker = [];
for (const [name, file] of [
  ["eslint-plugin-yield", "mutation-stryker-eslint.json"],
  ["ts-plugin-yield", "mutation-stryker-ts.json"]
]) {
  const report = JSON.parse(readFileSync(join(root, "documentation", file), "utf8"));
  const mutants = Object.entries(report.files).flatMap(([file, data]) =>
    data.mutants.map(m => ({ ...m, file, source: data.source }))
  );
  const counts = {};
  for (const m of mutants) counts[m.status] = (counts[m.status] ?? 0) + 1;
  const detected = (counts.Killed ?? 0) + (counts.Timeout ?? 0),
    undetected = (counts.Survived ?? 0) + (counts.NoCoverage ?? 0);
  checker.push({
    name,
    counts,
    total: mutants.length,
    score: (100 * detected) / (detected + undetected),
    mutants,
    tests: report.testFiles
  });
}
out.push(
  "",
  "## Checker mutants (Stryker)",
  "",
  "Stryker 10.0.0 uses the JavaScript mutator. This is the requested bounded fallback: full runs over the two smallest checker packages by source line count (TypeScript plugin: 536; ESLint plugin: 2,213). Vite native/sugar/transform/position code (4,206 package lines) and compiler inference (inside a 4,236-line package) were not Stryker-tested here. Their program-pipeline execution does not replace checker mutation testing. No partial or sampled score is presented as a full score.",
  "",
  "ESLint uses its unchanged 238-test Vitest suite. The TypeScript plugin uses its unchanged 19-test node:test suite through a registration adapter. The adapter changes the test host, not assertions. Stryker comment insertion is disabled because it shifts fixture source lines. Stryker reports retain covered/killed test identities. CLI/tsserver subprocess coverage does not return to the parent Vitest runner; NoCoverage is a coverage-collection limit at those edges, not proof the code never executes. Scores follow Stryker: (Killed + Timeout) / (Killed + Timeout + Survived + NoCoverage). Runtime/compile errors are listed separately, not counted as kills.",
  "",
  "| Package | Mutants | Killed | Timeout | Survived | No coverage | Runtime / compile errors | Score |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
);
for (const c of checker)
  out.push(
    `| ${c.name} | ${c.total} | ${c.counts.Killed ?? 0} | ${c.counts.Timeout ?? 0} | ${c.counts.Survived ?? 0} | ${c.counts.NoCoverage ?? 0} | ${(c.counts.RuntimeError ?? 0) + (c.counts.CompileError ?? 0)} | ${c.score.toFixed(2)}% |`
  );
const meta = JSON.parse(
  readFileSync(join(root, "documentation/mutation-stryker-runs.json"), "utf8")
);
for (const r of meta)
  out.push(
    "",
    `- ${r.package}: \`${r.command}\`; ${r.startedAt} → ${r.finishedAt}; ${r.durationSeconds}s; exit ${r.exitCode}.`
  );
out.push(
  "",
  "[Stryker configuration reference](https://stryker-mutator.io/docs/stryker-js/configuration/). Local socket access was needed for its workers. A first install hit a pnpm-store mismatch; isolated tools avoid changing the workspace dependency tree. The pinned local pnpm is available for build/gate commands.",
  "",
  "### Top 20 surviving checker mutants",
  "",
  "These are observed surviving changes; the reason states what the run can prove. It does not claim a detailed root cause without a follow-up test."
);
const structural = [
  "BlockStatement",
  "ConditionalExpression",
  "LogicalOperator",
  "BooleanLiteral",
  "EqualityOperator"
];
const rank = m => (m.status === "Survived" ? 0 : 10) + (structural.includes(m.mutatorName) ? 0 : 1);
const checkerSurvivors = checker
  .flatMap(c =>
    c.mutants
      .filter(m => ["Survived", "NoCoverage"].includes(m.status))
      .map(m => ({ ...m, package: c.name }))
  )
  .sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.file.localeCompare(b.file) ||
      a.location.start.line - b.location.start.line
  )
  .slice(0, 20);
function offset(source, loc) {
  const rows = source.split("\n");
  return rows.slice(0, loc.line - 1).reduce((n, s) => n + s.length + 1, 0) + loc.column - 1;
}
for (const [i, m] of checkerSurvivors.entries()) {
  const old = m.source.slice(offset(m.source, m.location.start), offset(m.source, m.location.end));
  out.push(
    "",
    `#### F-C${i + 1}: ${m.file}:${m.location.start.line} (${m.status}, ${m.mutatorName})`,
    "",
    "```diff",
    "- " + old.replaceAll("\n", "\n- "),
    "+ " + m.replacement.replaceAll("\n", "\n+ "),
    "```",
    "",
    m.status === "NoCoverage"
      ? "Stryker recorded no coverage for this location in the parent test runner; no killing test was selected. CLI/tsserver subprocess coverage is not returned to this runner."
      : `${m.coveredBy?.length ?? "Unknown number of"} covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.`,
    "",
    "Covered test IDs: " + (m.coveredBy?.join(", ") || "none recorded") + "."
  );
}
out.push(
  "",
  "## Program survivors and findings",
  "",
  "Each surviving mutant below is its own F-M finding for the next session. A survivor is a finding under this catalogue and locality rule, not automatically a soundness bug: follow-up must distinguish valid edits, root-location diagnostics, wrong codes, and missing checks. Messages are the full CLI output plus generated-lint/transform diagnostics, with temporary paths normalized. No output means no diagnostic, not a passed behavioral test."
);
const scratch = join(import.meta.dirname, ".native-generated", "diff");
mkdirSync(scratch, { recursive: true });
let n = 0;
for (const m of program.mutants.filter(m => m.status === "survived")) {
  const label = `${m.project}/${m.file}`;
  writeFileSync(join(scratch, "base"), m.original);
  writeFileSync(join(scratch, "mutant"), m.source);
  const diff = spawnSync(
    "diff",
    ["-u", "-L", label, "-L", label + " (mutant)", join(scratch, "base"), join(scratch, "mutant")],
    { encoding: "utf8" }
  );
  if (![0, 1].includes(diff.status)) throw new Error(diff.stderr);
  out.push(
    "",
    `### F-M${++n}: ${m.id} ${m.operator} at ${label}:${m.line} (${m.category})`,
    "",
    `Expected in the mutated routine (lines ${m.routine?.start ?? m.line}–${m.routine?.end ?? m.line}): ` +
      catalog[m.operator].expected.join(", ") +
      ".",
    "",
    "```diff",
    diff.stdout.trimEnd(),
    "```",
    "",
    "Checker said instead:",
    "",
    "```text",
    "Stages: " + JSON.stringify(m.result.stages),
    ...m.result.cliOutput,
    ...m.result.diagnostics
      .filter(d => d.stage !== "cli")
      .map(d => `${d.stage} ${d.file}:${d.line ?? "[unmapped]"} [${d.code}] ${d.message}`),
    ...(m.result.cliCrash ? ["CLI crash: " + m.result.cliCrash] : []),
    "```"
  );
}
const crashes = program.mutants.filter(m => m.result.cliCrash);
out.push(
  "",
  "## Findings list",
  "",
  `- F-M1–F-M${n}: ${n} survivors of the gate's rule, each with its category, full diff and actual diagnostics above.`,
  `- F-C1–F-C${checkerSurvivors.length}: the top checker survivors above; remaining survivors stay in the raw Stryker reports.`,
  `- F-MAP: ${crashes.length} mutant CLI crashes; the current position/error mapping can throw instead of returning diagnostics. IDs: ${crashes.map(m => m.id).join(", ") || "none"}.`,
  "- F-SCOPE: Vite native/sugar/transform/positions and compiler inference still need full checker-mutant runs. The full command-runner configuration is checked in.",
  "- F-COVERAGE: The Vitest adapter does not collect CLI/tsserver subprocess coverage. NoCoverage there may be a runner limit, not an absent test. The full command runner avoids coverage-based selection.",
  "- F-TIMEOUT: Stryker includes timeouts as detected. They need follow-up to distinguish loops from slow runs under contention.",
  "- F-HISTORY: Seven historical review identities remain unavailable; 27/34 reconstructed slots are covered.",
  "- F-BOUNDARY-LOCALITY: Removing a wrapper or provider reports a valid boundary error at the failure's origin and the root, not at the edit. Those survive both location rules and count as detected."
);
const gatePath = join(root, "documentation/mutation-gate-runs.json");
if (existsSync(gatePath)) {
  const gates = JSON.parse(readFileSync(gatePath, "utf8"));
  out.push(
    "",
    "## Build and gate verification",
    "",
    "Each local commit was preceded by pnpm build and a full gate against documentation/yield-gate-baseline.json. Successful full runs:"
  );
  for (const gate of gates.filter(g => g.summary.green && !g.summary.fail))
    out.push(
      "- " +
        gate.summary.line +
        "; --jobs " +
        gate.options.jobs +
        "; head " +
        gate.head.slice(0, 7) +
        "."
    );
  out.push(
    "",
    "The first concurrent gate attempt had one unchanged Sierpinski animation-frame test exceed its 5-second timeout; the complete reruns passed. No test timeout, existing gate entry, or checker source was changed. Only the mutation step and initial score/site floors were added to the baseline. Literal unified diffs retain blank context-line prefixes; those intentional spaces can trigger the default Git whitespace check."
  );
}
writeFileSync(join(root, "documentation/mutation-report.md"), out.join("\n") + "\n");
writeFileSync(
  join(root, "documentation/mutation-summary.json"),
  JSON.stringify(
    {
      program: { ...program.total, exactLine: all.exact, detected: all.detected },
      operators: Object.fromEntries(
        Object.entries(program.counts).map(([op, c]) => [op, { ...c, ...readings[op] }])
      ),
      checker: checker.map(({ name, counts, score, total }) => ({ name, counts, score, total })),
      topProgram: program.mutants
        .filter(m => m.status === "survived")
        .slice(0, 5)
        .map(({ id, operator, project, file, line }) => ({ id, operator, project, file, line })),
      topChecker: checkerSurvivors
        .slice(0, 5)
        .map(({ file, location, status, mutatorName, replacement }) => ({
          file,
          line: location.start.line,
          status,
          mutatorName,
          replacement
        })),
      findings: { program: n, checker: checkerSurvivors.length, cliCrashes: crashes.length }
    },
    null,
    2
  ) + "\n"
);
console.log(`mutation report: ${n} program findings; ${checkerSurvivors.length} checker findings`);
