import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repo = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const args = process.argv.slice(2);
const twins = readdirSync(join(repo, "examples"))
  .filter(x => /-yield(-h)?$/.test(x))
  .filter(x => !args.includes("--only") || x === args[args.indexOf("--only") + 1])
  .sort();
if (!twins.length) throw new Error("No matching twin");
const tmp = mkdtempSync(join(tmpdir(), "yield-coverage-"));
const results = [];
try {
  for (const twin of twins)
    for (const app of ["original", "twin"]) {
      const dir = join(repo, "examples", twin);
      const out = join(tmp, `${twin}-${app}.jsonl`);
      const costFile = readdirSync(join(dir, "tests")).find(x =>
        /^runtime-cost.test.tsx?$/.test(x)
      );
      const cost = readFileSync(join(dir, "tests", costFile), "utf8");
      // The authored parity driver remains the source of the mount and interactions.
      // Move a static Twin import into the selected branch, so originals never evaluate it.
      let source = cost.replace(
        /import Twin from "([^"]+)";/,
        (_, id) => `let Twin: any;\nconst loadTwin = () => import(${JSON.stringify(id)});`
      );

      if (source.includes("const loadTwin"))
        source = source.replace(
          "    const Original:",
          '    if (costApp() === "twin") Twin = (await loadTwin()).default;\n    const Original:'
        );
      source = source.replace(
        '    await timed("script",',
        '    executedBytesCheckpoint("load");\n    await timed("script",'
      );
      const bootstrap = join(tmp, `${twin}-${app}-bootstrap.mjs`);
      writeFileSync(
        bootstrap,
        `import { beginCoverage } from ${JSON.stringify(join(repo, "examples/harness/executed-bytes/coverage.mjs"))};\nexport const endCoverage=beginCoverage({file:${JSON.stringify(out)}, app:${JSON.stringify(app)}, twin:${JSON.stringify(twin)}});\n`
      );
      source =
        `import { endCoverage } from ${JSON.stringify(bootstrap)};\nimport { executedBytesCheckpoint } from "yield-example-harness";\nafterAll(endCoverage);\n` +
        source;
      const generated = mkdtempSync(join(dir, ".executed-bytes-"));
      const testFile = join(
        generated,
        costFile.endsWith("tsx") ? "probe.test.tsx" : "probe.test.ts"
      );
      source = source.replace('from "./script"', 'from "../tests/script"');
      writeFileSync(testFile, source);
      try {
        const script = JSON.parse(readFileSync(join(dir, "package.json"))).scripts.test;
        const named = /--config\s+(\S+)/.exec(script);
        const originalConfig = join(
          dir,
          named?.[1] ?? readdirSync(dir).find(x => /^vite\.config\.[cm]?[jt]s$/.test(x))
        );
        const require = createRequire(join(dir, "package.json"));
        const config = join(generated, "config.mjs");
        writeFileSync(
          config,
          `import { mergeConfig } from ${JSON.stringify(require.resolve("vite"))};\nimport config from ${JSON.stringify(originalConfig)};\nexport default mergeConfig(config, { root:${JSON.stringify(dir)}, test:{ include:[${JSON.stringify(testFile)}] } });\n`
        );
        const run = spawnSync(
          "pnpm",
          ["exec", "vitest", "run", "--config", config, testFile, "--maxWorkers=1"],
          {
            cwd: dir,
            encoding: "utf8",
            timeout: 120000,
            env: {
              ...process.env,
              TZ: "UTC",
              YIELD_COST_APP: app,
              YIELD_COST_PROD: "1",
              FORCE_COLOR: "0"
            }
          }
        );
        if (run.status !== 0) throw new Error(`${twin}/${app}: ${run.stdout}\n${run.stderr}`);
        const phases = readFileSync(out, "utf8")
          .trim()
          .split("\n")
          .map(x => JSON.parse(x));
        if (
          !phases.length ||
          phases[0].phase !== "load" ||
          phases[0].bytes === 0 ||
          phases.length < 2
        )
          throw new Error(`${twin}/${app}: missing load/step coverage`);
        results.push({ twin, app, phases: phases.map(({ phase, bytes }) => ({ phase, bytes })) });
        console.error(
          `${twin}/${app}: ${phases[0].bytes} load bytes, ${phases.length - 1} parity steps`
        );
      } finally {
        rmSync(generated, { recursive: true, force: true });
      }
    }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
if (args.includes("--record"))
  writeFileSync(
    resolve(args[args.indexOf("--record") + 1]),
    JSON.stringify(
      {
        node: process.version,
        metric:
          "UTF-8 source bytes in executed precise-coverage ranges per phase, inline maps excluded; ranges reset each checkpoint; jsdom production conditions, Vite transformed modules",
        allowance: "2 percent or 1024 bytes per phase, whichever is larger",
        results: results.map(r => ({
          ...r,
          phases: r.phases.map(p => ({
            ...p,
            maxBytes: p.bytes + Math.max(1024, Math.ceil(p.bytes * 0.02))
          }))
        }))
      },
      null,
      2
    ) + "\n"
  );
if (args.includes("--baseline")) {
  const baseline = JSON.parse(readFileSync(resolve(args[args.indexOf("--baseline") + 1]), "utf8"));
  const selected = baseline.results.filter(row => twins.includes(row.twin));
  if (
    selected.length !== results.length ||
    (!args.includes("--only") && selected.length !== baseline.results.length)
  )
    throw new Error("Twin/route inventory differs from baseline");
  for (const row of results) {
    const before = baseline.results.find(x => x.twin === row.twin && x.app === row.app);
    if (!before || before.phases.length !== row.phases.length)
      throw new Error(`${row.twin}/${row.app}: parity phases differ from baseline`);
    for (let i = 0; i < row.phases.length; i++) {
      const phase = row.phases[i],
        expected = before.phases[i];
      if (phase.phase !== expected.phase || phase.bytes > expected.maxBytes)
        throw new Error(
          `${row.twin}/${row.app}/${phase.phase}: ${phase.bytes} exceeds ${expected.maxBytes} or phase name changed`
        );
    }
  }
}
console.log(
  "| Twin | Original load | Library load | Original per step | Library per step | Compiled |\n| --- | ---: | ---: | --- | --- | --- |"
);
for (const twin of twins) {
  const a = results.find(r => r.twin === twin && r.app === "original"),
    b = results.find(r => r.twin === twin && r.app === "twin");
  console.log(
    `| ${twin} | ${a.phases[0].bytes} | ${b.phases[0].bytes} | ${a.phases
      .slice(1)
      .map(x => x.bytes)
      .join(", ")} | ${b.phases
      .slice(1)
      .map(x => x.bytes)
      .join(", ")} | not built |`
  );
}
