import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyzeReachability, partName } from "./reachability.js";
import { analyzeRecomputable } from "./recomputable.js";
import { analyzeInstances } from "./placement.js";
import { importsOf } from "./index.js";

const repo = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

export function analyzeExample(modules, options = {}) {
  const placement = analyzeInstances(modules, options);
  const { graph } = analyzeReachability(modules, options);
  const ids = new Map(graph.parts.map((part, i) => [part, `p${i + 1}`]));
  const refs = parts => [...parts].map(p => ({ id: ids.get(p), name: partName(p), at: p.at }));
  return {
    placement,
    reach: {
      parts: graph.parts.length,
      events: graph.events.map(event => {
        const reached = graph.reach([event]);
        return {
          ...refs([event])[0],
          bound: graph.bound.has(event),
          fraction: graph.parts.length ? reached.parts.size / graph.parts.length : 0,
          reads: refs(reached.reads),
          writes: refs(reached.writes),
          reached: refs(reached.parts)
        };
      })
    },
    provenance: analyzeRecomputable(modules, options)
  };
}

export async function reportTwin(twin, { analysis = analyzeExample } = {}) {
  const dir = resolve(repo, "examples", twin);
  const require = createRequire(resolve(dir, "package.json"));
  const { createServer } = await import(pathToFileURL(require.resolve("vite")));
  const rendering = twin === "rendering-yield";
  const server = await createServer({
    root: rendering ? resolve(dir, "csr") : dir,
    ...(rendering ? { configFile: resolve(dir, "csr/vite.config.mjs") } : {}),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }
  });
  const modules = new Map(),
    links = new Map();
  async function visit(id) {
    id = id?.replace(/\?.*$/, "");
    if (
      !id ||
      !id.startsWith(dir + "/") ||
      modules.has(id) ||
      id.includes("node_modules") ||
      !/\.[cm]?[jt]sx?$/.test(id) ||
      id.endsWith(".d.ts")
    )
      return;
    const code = await readFile(id, "utf8");
    modules.set(id, code);
    for (const spec of importsOf(code, id)) {
      const resolved = await server.pluginContainer.resolveId(spec, id);
      links.set(`${id}\0${spec}`, resolved?.id);
      await visit(resolved?.id);
    }
  }
  try {
    const entry = rendering
      ? "csr/client.tsx"
      : ["room-yield", "hackernews-spa-yield"].includes(twin)
        ? "src/app.tsx"
        : twin.endsWith("-h")
          ? "src/main.ts"
          : "src/main.tsx";
    await visit(resolve(dir, entry));
    const result = analysis(modules, {
      entry: resolve(dir, entry),
      resolve: (spec, from) => links.get(`${from}\0${spec}`)
    });
    // Paths are build-local; the review document is portable.
    return JSON.parse(
      JSON.stringify({ twin, ...result })
        .split(repo + "/")
        .join("")
    );
  } finally {
    await server.close();
  }
}

export function markdown(reports) {
  const out = [
    "# solid-yield analyzer",
    "",
    "Report only: groups are dependencies, not proven hydration roots. Reach is a static may-reach graph, not executed bytes or savings. S is server-derived; R is server-recomputable; U/C remain client. Captures require a runtime codec check before emission. Opaque modules have no purity contract on main.",
    ""
  ];
  const names = parts => parts.map(p => `${p.id} ${p.name}`).join(", ") || "none";
  for (const { twin, placement: p, reach, provenance: r } of reports) {
    out.push(
      `## ${twin}`,
      "",
      `C1 inert holes: ${p.holes.inert}/${p.holes.total}; groups: ${p.roots.length}; unknown origins: ${p.leaks.length}.`,
      ""
    );
    for (const group of p.roots) {
      out.push(
        `Group ${group.id}: ${group.mode}, ${group.size} parts; ${group.components.join(", ")}; span ${group.span ?? "unresolved"}.`
      );
      for (const cause of [...group.effectReach, ...(group.eagerSetupReach ?? [])])
        out.push(
          `- Eager cause ${cause.at}${cause.expression ? `: ${cause.expression}` : ""}; touched: ${cause.touched.join(", ") || "none"}; pulled in: ${cause.pulledIn.join(", ") || "none"}.`
        );
    }
    for (const c of p.captureFailures)
      out.push(`Capture refused: ${c.at} ${c.variable}: ${c.reason}.`);
    for (const leak of p.leaks)
      out.push(`Unknown: ${leak.at} ${leak.expression}: ${leak.classification ?? leak.construct}.`);
    for (const finding of p.findings) out.push(`Finding: ${finding.at}: ${finding.message}.`);
    out.push(
      "",
      `C1b: ${reach.parts} graph parts. Every event includes transitive calls, writes, reads, effects, boundaries and recreated children. DOM-bound events are marked bound.`,
      ""
    );
    for (const event of reach.events)
      out.push(
        `- ${event.name}${event.bound ? " (bound)" : ""}: ${event.reached.length}/${reach.parts} (${(event.fraction * 100).toFixed(1)}%); reads: ${names(event.reads)}; writes: ${names(event.writes)}; reached: ${names(event.reached)}.`
      );
    out.push("", "| Provenance | S | R | Client | Total |", "| --- | ---: | ---: | ---: | ---: |");
    for (const kind of ["holes", "jsx", "h"])
      out.push(`| ${kind} | ${r[kind].S} | ${r[kind].R} | ${r[kind].client} | ${r[kind].total} |`);
    out.push("");
    for (const region of r.regions)
      out.push(
        `Region ${region.component} at ${region.at}: ${region.provenance}; inputs [${region.arguments.map(x => x.expression).join(", ")}]; slots [${region.slots.join(", ")}].`
      );
    if (!r.regions.length) out.push("No S/R loader region.");
    for (const call of r.serverCalls)
      out.push(
        `Server call ${call.target} at ${call.at}: ${call.provenance}; capture ${call.captureEligible ? "eligible; runtime codec check required" : "refused"}.`
      );
    for (const capture of r.captures)
      out.push(`Capture refused: ${capture.at}: ${capture.reason}.`);
    out.push("");
  }
  return out.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const twins = readdirSync(resolve(repo, "examples"))
    .filter(n => /-yield(?:-h)?$/.test(n))
    .sort();
  const selected = args.filter(arg => arg !== "--json");
  if (selected.length > 1 || selected.some(twin => !twins.includes(twin))) {
    console.error(`Usage: pnpm run analyze [${twins.join("|")}] [--json]`);
    process.exitCode = 2;
  } else {
    const reports = [];
    for (const twin of selected.length ? selected : twins) reports.push(await reportTwin(twin));
    console.log(args.includes("--json") ? JSON.stringify(reports, null, 2) : markdown(reports));
  }
}
