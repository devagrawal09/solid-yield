import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { chunkAttribution, compiledDecomposition } from "./chunk-attribution.mjs";
const repo = resolve(import.meta.dirname, "../../..");
const args = process.argv.slice(2);
const value = flag => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const count = Number(value("--runs") ?? 1);
const variants = args.includes("--regions")
  ? ["original", "library", "compiled-single", "compiled-r"]
  : args.includes("--single")
    ? ["original", "library", "compiled-single", "compiled"]
    : ["original", "library", "compiled"];
const chunkDirectory = value("--chunks");
const temp = mkdtempSync(join(tmpdir(), "docs-hydrated-bytes-"));
const runs = [],
  shipped = [];
try {
  for (let n = 0; n < count; n++) {
    const results = [];
    for (const app of variants) {
      let outcome;
      const html = join(temp, `${app}.html`),
        file = join(temp, `${app}-${n}.jsonl`);
      for (const server of [true, false]) {
        const child = spawnSync(
          process.execPath,
          [join(repo, "packages/compiler-yield/test/eager-docs.test.mjs")],
          {
            cwd: repo,
            encoding: "utf8",
            timeout: 120000,
            env: {
              ...process.env,
              TZ: "UTC",
              NODE_ENV: "production",
              C2_PRODUCTION: "1",
              C2_DOCS_MODE: app,
              C2_HTML: html,
              ...(server ? { C2_SSR_ONLY: "1" } : { C2_COVERAGE: file })
            }
          }
        );
        if (child.status !== 0) throw new Error(`${app}: ${child.stdout}\n${child.stderr}`);
        if (!server) outcome = JSON.parse(child.stdout.split("C2_RESULT ")[1]);
      }
      const observations = readFileSync(file, "utf8")
        .trim()
        .split("\n")
        .map(line => JSON.parse(line));
      const phases = observations.map(({ phase, bytes }) => ({ phase, bytes }));
      if (phases.length !== 25 || phases[0].phase !== "load" || !phases[0].bytes)
        throw new Error("Missing coverage");
      results.push({
        app,
        phases,
        ...(outcome.payloads
          ? { payloads: outcome.payloads, jsonComparison: outcome.jsonComparison }
          : {}),
        loadScripts: observations[0].scripts.map(({ url, bytes }) => ({
          url: url.replace(repo, "<repo>"),
          bytes
        }))
      });
      console.error(`run ${n + 1} ${app}: ${phases[0].bytes} load bytes, 24 steps`);
    }
    runs.push(results);
  }
  if (!args.includes("--no-shipped"))
    for (const app of variants) {
      const directory = join(
        repo,
        "examples",
        app === "original" ? "originals/docs" : "docs-yield"
      );
      const require = createRequire(join(directory, "package.json"));
      const { build } = await import(pathToFileURL(require.resolve("vite")));
      let js = 0,
        gzip = 0,
        chunks = 0;
      const chunkDetails = [];
      const previousRoots = process.env.C2_ROOTS;
      const previousRegions = process.env.C3_REGIONS;
      process.env.C3_REGIONS = app === "compiled-r" ? "1" : "0";
      process.env.C2_ROOTS = app === "compiled-single" ? "single" : "per-group";
      try {
        await build({
          root: join(directory, "stream"),
          configFile: join(
            directory,
            app.startsWith("compiled") ? "compiled/vite.config.mjs" : "stream/vite.config.mjs"
          ),
          logLevel: "silent",
          build: { write: false, emptyOutDir: false, sourcemap: true },
          plugins: [
            {
              name: "hydrated-docs:shipped",
              generateBundle(_options, bundle) {
                for (const output of Object.values(bundle))
                  if (output.type === "chunk") {
                    js += Buffer.byteLength(output.code);
                    gzip += gzipSync(output.code).length;
                    chunks++;
                    chunkDetails.push({
                      file: output.fileName,
                      js: Buffer.byteLength(output.code),
                      gzip: gzipSync(output.code).length,
                      attribution: chunkAttribution(output.code, output.map),
                      sha256: createHash("sha256").update(output.code).digest("hex"),
                      modules: Object.entries(output.modules).map(([id, mod]) => ({
                        id: id.replace(repo, "<repo>"),
                        renderedLength: mod.renderedLength
                      }))
                    });
                    if (chunkDirectory) {
                      const target = resolve(chunkDirectory, app, output.fileName);
                      mkdirSync(resolve(target, ".."), { recursive: true });
                      writeFileSync(target, output.code);
                      if (output.map) writeFileSync(target + ".map", output.map.toString());
                    }
                    if (
                      app.startsWith("compiled") &&
                      /Loading navigation|Loading footer|Written for readers/.test(output.code)
                    )
                      throw new Error("Inert authored code shipped");
                    if (
                      app === "compiled-r" &&
                      /on-this-page|Related reading|No article:|Read the page/.test(output.code)
                    )
                      throw new Error("R article code/data shipped");
                  }
              }
            }
          ]
        });
      } finally {
        if (previousRegions === undefined) delete process.env.C3_REGIONS;
        else process.env.C3_REGIONS = previousRegions;
        if (previousRoots === undefined) delete process.env.C2_ROOTS;
        else process.env.C2_ROOTS = previousRoots;
      }
      shipped.push({ app, js, gzip, chunks, chunkDetails });
      console.error(`${app}: shipped ${js} JS bytes (${gzip} gzip), ${chunks} chunks`);
    }
  const summary = runs[0].map(({ app, phases }, a) => ({
    app,
    phases: phases.map(({ phase }, p) => {
      const observations = runs.map(run => run[a].phases[p].bytes),
        min = Math.min(...observations),
        max = Math.max(...observations);
      return {
        phase,
        observations,
        min,
        max,
        drift: max - min,
        maxBytes: max + Math.max(1024, Math.ceil(max * 0.02))
      };
    })
  }));
  const output = {
    node: process.version,
    metric:
      "Hydrated docs; V8 executed UTF-8 ranges reset each phase; production Vite module runner; completed SSR in a separate process; same 24 authored steps; all roots synchronous",
    runs,
    summary,
    shipped,
    decomposition: args.includes("--regions") ? null : compiledDecomposition(runs, shipped)
  };
  if (value("--record"))
    writeFileSync(resolve(value("--record")), JSON.stringify(output, null, 2) + "\n");
  if (value("--baseline")) {
    const baseline = JSON.parse(readFileSync(resolve(value("--baseline")), "utf8"));
    if (baseline.summary.length !== summary.length) throw new Error("Baseline inventory changed");
    for (let a = 0; a < summary.length; a++) {
      const old = baseline.summary[a];
      if (old.app !== summary[a].app || old.phases.length !== 25)
        throw new Error("Baseline inventory changed");
      for (let p = 0; p < 25; p++)
        if (
          old.phases[p].phase !== summary[a].phases[p].phase ||
          summary[a].phases[p].max > old.phases[p].maxBytes
        )
          throw new Error(
            `${old.app}/${old.phases[p].phase}: ${summary[a].phases[p].max} > ${old.phases[p].maxBytes}`
          );
    }
    console.error("hydrated docs executed bytes: GREEN");
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
