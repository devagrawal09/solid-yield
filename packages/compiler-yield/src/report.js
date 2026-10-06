import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyze } from "./analysis.js";
import { importsOf } from "./index.js";

const repo = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
export async function reportTwin(twin) {
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
    const result = analyze(modules, { resolve: (spec, from) => links.get(`${from}\0${spec}`) });
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
    "# C1 analysis prototype",
    "",
    "Status: diagnostic prototype; not a completed C1 or a codegen input. Counts are static sites, not dynamic islands. The implementation limits below prevent a C0 premise verdict.",
    "",
    "Definitions actually used: S < U < C, join=max; written cells C; unproved calls/imports U; props joined across call sites (cap 1); contexts joined over all resolved providers. Every effect forces eager. Unproved setup work forces an eager fallback. Merge counts count distinct reported pairs, not successful union operations. SPAN_OVERLAP and CAPTURE_FALLBACK are listed separately from M1-M6. Capture failures describe candidate edges, not emitted edges. JSX fractions exclude h element sites; markup bytes are not measured.",
    "",
    "| Twin | Inert holes | Inert JSX elements | Candidate roots (parts; mode) | M1/M2/M3/M4/M5/M6 | Capture candidates | U sources | Effects |",
    "| --- | ---: | ---: | --- | --- | ---: | ---: | ---: |"
  ];
  for (const r of reports)
    out.push(
      `| ${r.twin} | ${r.holes.inert}/${r.holes.total} | ${r.elements.inert}/${r.elements.total} | ${r.roots.map(x => `${x.size} ${x.mode}`).join(", ")} | ${[1, 2, 3, 4, 5, 6].map(i => r.merges.filter(m => m.rule === `M${i}`).length).join("/")} | ${r.captureFailures.length} | ${r.leaks.length} | ${r.roots.reduce((n, x) => n + x.effectReach.length, 0)} |`
    );
  for (const r of reports) {
    out.push(
      "",
      `## ${r.twin}`,
      "",
      "Limits: " + r.definitions.limitations.join("; ") + ".",
      "",
      "### Roots and effect reach",
      ""
    );
    for (const x of r.roots) {
      out.push(
        `- Root ${x.id}: ${x.mode}, ${x.size} parts; span ${x.span ?? "unresolved"}; components ${x.components.join(", ") || "unresolved"}; sites ${x.sites.join(", ")}.${x.fallback ? " Fallback: " + x.fallback + "." : ""}`
      );
      for (const e of x.effectReach)
        out.push(
          `  - Effect ${e.at}; touched: ${e.touched.join(", ") || "none"}; pulled in: ${e.pulledIn.join(", ") || "none"}.`
        );
    }
    out.push("", "### Additional safety merges", "");
    for (const m of r.merges.filter(m => !/^M[1-6]$/.test(m.rule)))
      out.push(`- ${m.rule}: ${m.sites.join(" ↔ ")}.`);
    out.push("", "### Capture candidates", "");
    for (const c of r.captureFailures) out.push(`- ${c.at}: \`${c.variable}\`: ${c.reason}.`);
    out.push("", "### Named U sources", "");
    for (const l of r.leaks)
      out.push(
        `- ${l.at}: \`${l.name.replaceAll("`", "'").replaceAll("\n", " ")}\` — ${l.reason}; ${l.clientParts} client parts.`
      );
    out.push("", "### Setup findings", "");
    for (const f of r.findings) out.push(`- ${f.at}: ${f.message}.`);
  }
  return out.join("\n").trimEnd() + "\n";
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const twins = readdirSync(resolve(repo, "examples"))
    .filter(x => /-yield(-h)?$/.test(x))
    .sort();
  const reports = [];
  for (const twin of twins) {
    reports.push(await reportTwin(twin));
    console.error(`analysed ${twin}`);
  }
  const md = markdown(reports);
  const args = process.argv.slice(2);
  if (args.includes("--markdown"))
    await writeFile(resolve(args[args.indexOf("--markdown") + 1]), md);
  else if (args.includes("--json")) console.log(JSON.stringify(reports, null, 2));
  else console.log(md.split("\n\n## ")[0]);
}
