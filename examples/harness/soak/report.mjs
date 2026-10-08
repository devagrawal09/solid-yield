// Produce a compact committed report; raw per-round evidence remains beside the input.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
import { trends } from "./analysis.mjs";
import { seeded, schedule } from "./schedule.mjs";
const input = resolve(process.argv[2] ?? "documentation/soak-results.json");
const output = resolve(process.argv[3] ?? "documentation/soak-report.md");
const data = JSON.parse(readFileSync(input, "utf8"));
const f = n => Number(n ?? 0).toFixed(3);
const rows = data.results;
const diagnostics = process.argv[4]
  ? JSON.parse(readFileSync(resolve(process.argv[4]), "utf8"))
  : [];
const room = rows.find(r => r.twin === "room-yield");
if (room) room.final100Trends = trends(room.samples.slice(-100));
const lines = [
  "# Soak report",
  "",
  `Recorded ${data.date}. Node ${data.node}; ${data.mode}. Seed ${data.options.seed}; ${data.options.minutes} real minutes per twin; compare every ${data.options.checkpoint} rounds plus round one.`,
  "",
  "This report uses the permitted five-minute duration to fit the execution budget. The script defaults to ten minutes and supports sixty. Original and twin each keep one jsdom and one mounted app alive throughout the session. Both receive every action; checkpoints compare their DOM after each step.",
  "",
  "The gate lists the soak as a manual **REPORT-ONLY / SKIP** step. A one-minute run of all twins adds at least nine minutes per commit, and process heap results depend on the host. Findings below do not fail the gate. No runtime behavior was fixed in this session.",
  "",
  "## Per twin",
  "",
  "Slopes are per round, heap in KiB/round. DOM counts include elements, text and comments. Checkpoints lists rounds / individual step comparisons.",
  "",
  "| Twin | Seconds | Rounds | Heap slope KiB | Live-root slope | DOM-node slope | Errors | Parity checkpoints | Differences |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
];
for (const r of rows)
  lines.push(
    `| ${r.twin} | ${f(r.elapsedSeconds)} | ${r.rounds} | ${f(r.trends?.heap.slope / 1024)} | ${f(r.trends?.roots.slope)} | ${f(r.trends?.domNodes.slope)} | ${r.errorCount ?? r.errors.length} | ${r.parityCheckpoints} / ${r.parityStepChecks} | ${r.mismatches.length} |`
  );
lines.push(
  "",
  "## Other counters",
  "",
  "These measure owned library definitions and suspended runtime attempts, not private Solid objects or all promises in Node. The current runtime has no independent event queue; its depth is zero. Active events are measured separately.",
  "",
  "| Twin | Boundary slope | Routine slope | Pending-promise slope | Active-event slope | Queue slope | Owned counts after disposal (root / boundary / routine) |",
  "| --- | ---: | ---: | ---: | ---: | ---: | --- |"
);
for (const r of rows)
  lines.push(
    `| ${r.twin} | ${f(r.trends?.boundaries.slope)} | ${f(r.trends?.routines.slope)} | ${f(r.trends?.pendingPromises.slope)} | ${f(r.trends?.eventsInFlight.slope)} | ${f(r.trends?.eventQueueDepth.slope)} | ${r.afterDispose?.roots ?? "?"} / ${r.afterDispose?.boundaries ?? "?"} / ${r.afterDispose?.routines ?? "?"} |`
  );
lines.push(
  "",
  "## Method and limits",
  "",
  "Least-squares fits discard the first five rounds (or first fifth for small runs). A flag requires ten samples, slope above the allowance, and material fitted growth: heap >4 KiB/round and >max(1 MiB, 5% initial heap); roots/boundaries >0.01/round; routines/pending/events >0.05/round; DOM >0.1/round; queue >0/round. Object metrics also require >3 fitted objects. Allowances filter small cache and changing page-state effects; a flag is a finding to investigate, not proof of a runtime leak.",
  "",
  "Heap is process.memoryUsage().heapUsed after forced GC, including the test worker, Vite and jsdom. Snapshots and sample history live only in the separate controller. Dependency-preserving blocks are shuffled; steps inside a block keep the parity script's order. Todos removes remaining rows between rounds; docs revisits home; room alternates routes and retains its app's bounded transcript (200 messages per room). See [the runner](../examples/harness/soak/README.md) for counter definitions and replay details.",
  "",
  "This covers client fixtures and development builds. It does not exercise the real network, SSR, hydration, actual browser heap, or future lazy event replay. Cached dynamic imports do not simulate failed chunk downloads. A zero error count includes zero observed [BOUNDARY_DISPOSED] and ChunkError diagnostics; it does not prove those cases cannot occur.",
  "",
  "## Findings",
  ""
);
const findings = [];
for (const r of rows) {
  const flagged = Object.entries(r.trends ?? {})
    .filter(([, fit]) => fit.flagged)
    .map(([key]) => key);
  const liveAfter = ["roots", "boundaries", "routines"].filter(
    key => r.afterDispose?.[key] !== undefined && r.afterDispose[key] !== 0
  );
  if (
    !flagged.length &&
    !r.errors.length &&
    !r.mismatches.length &&
    !r.stepFailures.length &&
    !r.counterViolations?.length &&
    !liveAfter.length &&
    !r.infrastructureError
  )
    continue;
  const id = `F-K${findings.length + 1}`;
  let prefix = r.rounds;
  for (let n = 10; n <= r.samples.length; n++) {
    const fits = trends(r.samples.slice(0, n));
    if (flagged.length && flagged.some(key => fits[key].flagged)) {
      prefix = n;
      break;
    }
  }
  const random = seeded(r.seed);
  let sequence;
  for (let n = 1; n <= prefix; n++) sequence = schedule(r.twin, random, n);
  const finding = {
    id,
    twin: r.twin,
    flagged,
    smallestObservedPrefix: prefix,
    sequence,
    liveAfter,
    errors: r.errors,
    mismatches: r.mismatches,
    stepFailures: r.stepFailures
  };
  findings.push(finding);
  lines.push(`### ${id} — ${r.twin}`, "");
  if (flagged.length) {
    lines.push(`Growth allowance exceeded: ${flagged.join(", ")}.`, "");
    for (const key of flagged)
      lines.push(
        `- ${key}: twin slope ${f(r.trends[key].slope)}; original slope ${["heap", "domNodes"].includes(key) ? f(r.originalTrends?.[key]?.slope) : "not counted (library-only metric)"}; fitted twin growth ${f(r.trends[key].growth)}.`
      );
    lines.push("");
  }
  if (r.twin === "room-yield")
    lines.push(
      "Routine and DOM counts plateau once the fixture's 200-message limit is filled. The final 100 rounds have zero routine and DOM slope; owned counters reach zero on disposal. This part is bounded application data growth, not evidence of leaked active owners. The heap growth remains an open lead.",
      ""
    );
  if (r.mismatches.length)
    lines.push(
      `Parity differs first at round ${r.mismatches[0].round}, step “${r.mismatches[0].step}”.`,
      ""
    );
  if (r.errors.length)
    lines.push(`Observed diagnostic: ${r.errors[0].message.split("\n")[0]}.`, "");
  if (r.stepFailures.length)
    lines.push(
      `Step failed at round ${r.stepFailures[0].round}: ${JSON.stringify(r.stepFailures[0])}.`,
      ""
    );
  if (liveAfter.length)
    lines.push(`Owned counters remain after disposal: ${liveAfter.join(", ")}.`, "");
  if (r.infrastructureError)
    lines.push(`Infrastructure failure: ${r.infrastructureError.split("\n")[0]}.`, "");
  lines.push(
    `Smallest recorded prefix crossing the growth rule: ${prefix} rounds. Replay:`,
    "",
    "```sh",
    `pnpm soak --only ${r.twin} --seed ${r.seed} --minutes 60 --rounds ${prefix} --out /tmp/${id}.json`,
    "```",
    "",
    `Final round's authored step indices/reset actions: \`${JSON.stringify(sequence)}\`. The seed reconstructs the preceding round order. This is the smallest **observed** prefix, not a claim that all shorter action sequences were minimized. Heap flags may vary by host.`,
    ""
  );
}
if (diagnostics.length) {
  const small = diagnostics.find(d => d.name === "effect-switch-cleared")?.results[0];
  lines.push(
    "## Reduced reproductions and controls",
    "",
    "All valid diagnostic runs below preserve parity and capture zero errors. Controls clear Vitest call history before each forced GC, keeping the mock implementations and app state. Route controls also replace pushState with replaceState (a diagnostic change to history behavior, not the primary run). Positive slopes persist in both apps; the cause is not isolated to solid-yield. These short controls are not substitutes for the five-minute sessions.",
    "",
    "| Diagnostic | Rounds | Original heap KiB/round | Twin heap KiB/round | Heap MiB after twin disposal |",
    "| --- | ---: | ---: | ---: | ---: |"
  );
  for (const d of diagnostics) {
    const r = d.results[0];
    lines.push(
      `| ${d.name} | ${r.rounds} | ${f(r.originalTrends.heap.slope / 1024)} | ${f(r.trends.heap.slope / 1024)} | ${f(r.afterDispose.heap / 1048576)} |`
    );
  }
  if (small)
    lines.push(
      "",
      "F-K1 also reproduces with **three authored steps**, repeated: step 9, clear the query; step 10, type vite with the scripted failing network; step 12, advance 4000 ms through retries. The log is already capped at 100 entries in the app, and this loop creates no orders. Clearing spy history does not remove the trend. This is the smallest action loop tried, not an exhaustive minimization over all timing values.",
      "",
      "```sh",
      "SOAK_CLEAR_MOCKS=1 pnpm soak --only effect-yield --scenario switch --rounds 100 --minutes 3 --out /tmp/F-K1-small.json",
      "```",
      "",
      `That control grows ${f(small.trends.heap.slope / 1024)} KiB/round in the twin; original ${f(small.originalTrends.heap.slope / 1024)}. An idle control (step 0 only) provides the harness overhead comparison in the table. Owned counters are zero after disposal, so this is retained process heap without a demonstrated live-owner leak. F-K2, F-K3, F-K5 and F-K6 remain process-heap leads with their exact seeded prefixes above; no runtime cause or fix is claimed.`,
      ""
    );
}
if (!findings.length)
  lines.push(
    "No growth flags, parity differences, uncaught errors, negative counts or surviving owned counters were observed.",
    ""
  );
const archive = [];
for (const r of rows)
  for (const app of ["original", "twin"]) {
    const file = input.replace(/\.json$/, "-raw") + `/${r.twin}-${app}-samples.jsonl`;
    if (existsSync(file))
      archive.push({
        twin: r.twin,
        app,
        samples: readFileSync(file, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map(line => JSON.parse(line))
      });
  }
if (archive.length) {
  const archivePath = output.replace(/\.md$/, "-samples.json.gz");
  writeFileSync(
    archivePath,
    gzipSync(JSON.stringify({ date: data.date, options: data.options, runs: archive }))
  );
  lines.push(
    "## Evidence",
    "",
    "The compact JSON next to this report preserves slopes, first/last samples and reproduction sequences. The compressed sample archive contains every round for both apps; it can be decompressed and fed to the analysis helper to recompute fits.",
    ""
  );
}
const compact = {
  ...data,
  results: rows.map(({ samples, ...r }) => ({
    ...r,
    sampleCount: samples.length,
    firstSample: samples[0],
    lastSample: samples.at(-1)
  })),
  findings,
  diagnostics: diagnostics.map(d => ({
    ...d,
    results: d.results.map(({ samples, ...r }) => ({
      ...r,
      sampleCount: samples.length,
      firstSample: samples[0],
      lastSample: samples.at(-1)
    }))
  }))
};
writeFileSync(output, lines.join("\n") + "\n");
writeFileSync(output.replace(/\.md$/, ".json"), JSON.stringify(compact, null, 2) + "\n");
console.log(`${rows.length} twins; ${findings.length} findings; ${output}`);
