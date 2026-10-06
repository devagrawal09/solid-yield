import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyze } from "./analysis.js";
import { analyzeInstances } from "./placement.js";
import { importsOf } from "./index.js";

const repo = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
export async function reportTwin(twin, { analysis = analyzeInstances } = {}) {
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

const before = JSON.parse(
  readFileSync(resolve(repo, "documentation/compiler-c1-before.json"), "utf8")
).twins;
const optionABefore = JSON.parse(
  readFileSync(resolve(repo, "documentation/compiler-c1-option-a-before.json"), "utf8")
).twins;
const fraction = n => `${n.inert}/${n.total}`;
const escape = s =>
  String(s).replaceAll("|", "\\|").replaceAll("`", "'").replace(/\s+/g, " ").trim();
const expression = s => {
  s = escape(s);
  if (s.startsWith("<")) return s.slice(0, s.indexOf(">") + 1);
  return s.length > 170 ? s.slice(0, 167) + "…" : s;
};
const modeCounts = roots =>
  ["eager", "visible", "lazy"].map(m => roots.filter(r => r.mode === m).length).join("/");
const oldModes = groups =>
  ["eager", "visible", "lazy"]
    .map(m => groups.split(", ").filter(g => g.endsWith(m)).length)
    .join("/");
const eagerNotes = {
  "docs-yield":
    "ThemeToggle has the only $effect. It reads dark, writes no state and touches only its own cell. Its event, class hole, bind and label are pulled into that six-part eager group; no other widget is in eager reach.",
  "effect-yield":
    "No $effect. createRuntime calls ManagedRuntime.make during setup; its unknown lifetime and the RuntimeContext owner pull Typeahead, Results, Checkout, Orders and LogPanel into the eager group.",
  "rendering-yield":
    "Home's run-once effect registers a 100 ms interval, invokes tick and writes s. The route flow can recreate pages; its boundary, shared router context and foreign Portal/Reveal owners pull all analysed route alternatives into this eager group. This is a static union of possible pages, not simultaneous mounted pages.",
  "room-yield":
    "IdentityProvider's run-once effect calls mint and writes me. Identity context readers, presence/transcript/live data, the foreign router and its boundaries pull the room controls, chat, directory, summaries and archive into the group.",
  "sierpinski-yield":
    "No $effect. Setup registers setInterval(tick, 1000) and requestAnimationFrame(update). They write seconds and elapsed; scale, recursive Triangle/Dot reads and their pending/error boundaries join the group.",
  "sierpinski-yield-h":
    "No $effect. Setup registers the same interval and animation-frame loop as the JSX twin. seconds, elapsed, scale and the recursive Triangle/Dot family join through reads and boundaries.",
  "todos-yield":
    "hashFilter's run-once effect installs the hashchange listener. onChange writes filter; the filtered list, shared store/actions, context, row recreation and boundaries pull Header, MainSection, TodoItem and Footer into the group.",
  "todos-yield-h":
    "The same hashchange effect reaches onChange and filter. Shared store/actions, context, row recreation and boundaries pull Header, MainSection, TodoItem and Footer into the group."
};
export function markdown(reports) {
  const out = [
    "# C1 instance audit",
    "",
    "C1 diagnostic checkpoint, 2026-10-07. This is an audit of source analysis, not emitted islands or measured savings. The CLI and Vite pre-pass now use the instance pass. The old static-site table is preserved in compiler-c1-before.json.",
    "",
    "Reproduce: `node packages/compiler-yield/src/report.js --markdown documentation/compiler-c1-report.md`; `--json` exposes full expressions, instance IDs, all merge edges and reach lists. `--joined` runs the earlier engine; `--instances` remains an accepted alias for the default. No application module is executed by the analysis.",
    "",
    "## Before / after",
    "",
    "Each arrow is the report's previous value → audited value. E/V/L are eager/visible/lazy candidate group counts, not the v0.2 loading policy (v0.2 ships eager islands only). Group sizes are non-inert parts. Captures are rejected candidate edges, not serializer results. U counts are named syntactic origins, counted even when C dominates their consumers. The previous 275 entries and the new origin count have different precision and coverage; their difference is not a savings figure.",
    "",
    "| Twin | Inert holes | Inert JSX | Groups E/V/L | Captures | U origins | After parts |",
    "| --- | ---: | ---: | --- | ---: | ---: | --- |"
  ];
  for (const r of reports) {
    const b = before.find(b => b.twin === r.twin);
    out.push(
      b
        ? `| ${r.twin} | ${b.holes} → ${fraction(r.holes)} | ${b.jsx} → ${fraction(r.jsxElements ?? r.elements)} | ${oldModes(b.groups)} → ${modeCounts(r.roots)} | ${b.captures} → ${r.captureFailures.length} | ${b.leaks} → ${r.leaks.length} | ${r.roots.map(x => `${x.size}${x.mode[0].toUpperCase()}`).join(", ")} |`
        : `| ${r.twin} | ${fraction(r.holes)} | ${fraction(r.jsxElements ?? r.elements)} | ${modeCounts(r.roots)} | ${r.captureFailures.length} | ${r.leaks.length} | ${r.roots.map(x => `${x.size}${x.mode[0].toUpperCase()}`).join(", ")} |`
    );
  }
  out.push(
    "",
    "The denominators changed: after counts are reached call-site instances, with one widened representative per recursive family/row; before counts were joined static sites. Repeated component calls count repeatedly, while uncalled module syntax no longer counts. These are neither runtime node counts nor markup bytes. JSX counts exclude foreign tags; locally S descendants beneath a foreign owner can still be unavailable as slots. Zero captures mainly reflects the broad merged groups: setup-local values stay inside them.",
    "",
    "| h twin | Before h elements | After inert h elements |",
    "| --- | --- | ---: |"
  );
  for (const r of reports.filter(r => r.twin.endsWith("-h")))
    out.push(`| ${r.twin} | unmeasured | ${fraction(r.hElements ?? { inert: 0, total: 0 })} |`);
  out.push(
    "",
    "## Option A: changes since 3b51165",
    "",
    "All nine twins were rerun with the same entry graphs. These arrows compare the same instance-based units, unlike the older table above. E/V/L describes dependencies; every emitted tier-1 root must hydrate synchronously.",
    "",
    "| Twin | Inert holes before → after | Inert JSX before → after | Groups E/V/L before → after | Captures before → after |",
    "| --- | ---: | ---: | --- | ---: |"
  );
  for (const r of reports) {
    const b = optionABefore.find(x => x.twin === r.twin);
    out.push(
      `| ${r.twin} | ${fraction(b.holes)} → ${fraction(r.holes)} | ${fraction(b.jsxElements)} → ${fraction(r.jsxElements)} | ${modeCounts(b.roots)} → ${modeCounts(r.roots)} | ${b.captures} → ${r.captureFailures.length} |`
    );
  }
  out.push(
    "",
    "## U classification totals",
    "",
    "GENUINE means client execution/lifetime is required under C0's rules, including foreign output kept U by policy; it does not mean every result actually changes. ANALYSIS BLIND SPOT means source inspection identifies S or C but the current transfer rule cannot retain it.",
    "",
    "| Construct | Blind spot | Genuine | Total |",
    "| --- | ---: | ---: | ---: |"
  );
  const constructs = [
    "plain function call",
    "helper routine",
    "foreign primitive",
    "router query",
    "route props",
    "serialization edge",
    "other"
  ];
  const leaks = reports.flatMap(r => r.leaks);
  for (const c of constructs) {
    const ls = leaks.filter(l => l.construct === c),
      blind = ls.filter(l => l.classification === "blind spot").length;
    out.push(`| ${c} | ${blind} | ${ls.length - blind} | ${ls.length} |`);
  }
  const blind = leaks.filter(l => l.classification === "blind spot").length;
  out.push(
    `| **Total** | **${blind}** | **${leaks.length - blind}** | **${leaks.length}** |`,
    "",
    "| Twin | Blind spot | Genuine |",
    "| --- | ---: | ---: |"
  );
  for (const r of reports) {
    const b = r.leaks.filter(l => l.classification === "blind spot").length;
    out.push(`| ${r.twin} | ${b} | ${r.leaks.length - b} |`);
  }
  out.push(
    "",
    "## Audit rules and limits",
    "",
    "The inherited import, recursive-prop and foreign-slot fixtures were retained. Additional failing fixtures exposed imported data hidden by expressions/helpers, an initially S generator prop hiding a recursive C input, and recursion mutating a shared caller constant. These now pass: imported data flows to a named U origin; each instance owns its prop equations; recursive generator/opaque inputs widen those equations without changing caller values. Foreign owners and client-controlled flows never offer their descendants as independent slots. Equal spans merge as SPAN_OVERLAP; strictly nested groups can be candidate slots only without a recreation path. A timer registered in an effect is included in that effect's reach.",
    "",
    "Sierpinski's setup timers are explicit eager causes despite having no $effect. The h rule counts nonliteral native props/children as holes, onX props as binds, and literal tags as element sites; component/flow children are analysed under the caller's owner. JSX expression uses are also counted, including structural component-call holes. Literal strings/numbers are inert values. These working clarifications to F-C1–F-C3 are documented in compiler-findings.md; C0 itself is not silently rewritten.",
    "",
    "Remaining precision limits: no serializer execution, no proof of physical hydration spans, foreign lifetime/claim support is unproved, recursive families join all depths, and syntax-based boundary colors can over-merge. The Effect.runFork reference below is knowably module code (S at the edge), but a conditional return loses callable identity; resolving that requires preserving callable alternatives through helper returns. It stays U, with its rule and location visible. Fixing it cannot remove the adapter's genuine async lifetime or the foreign runtime owner. This table reports C1 only; see compiler-c2-finding.md and compiler-benchmarks.md for emission and measurements."
  );
  for (const r of reports) {
    out.push(
      "",
      `## ${r.twin}`,
      "",
      "### Every remaining U origin",
      "",
      "Expressions are abbreviated only for display; file:line:column identifies the full source expression. A repeated origin has one row even if several instances use it.",
      "",
      "| Expression and location | Construct | Classification and resolving rule / client dependency |",
      "| --- | --- | --- |"
    );
    for (const l of r.leaks)
      out.push(
        `| \`${expression(l.name)}\` — ${l.at} | ${l.construct} | **${l.classification === "blind spot" ? "ANALYSIS BLIND SPOT" : "GENUINE"}**: ${escape(l.reason)}. ${escape(l.rule)} |`
      );
    if (r.twin === "docs-yield") {
      out.push(
        "",
        "### Content-site premise after option A",
        "",
        "The six widget definitions share no application signals or context. M6 now distinguishes the separate fresh promises returned by delay(): SearchBox and CommentList remain U/visible but form separate groups. The carousel src computed key and alt template interpolation both carry index's C provenance; its img is no longer an inert slot.",
        "",
        `The actual result is **${r.roots.length} candidate groups (${modeCounts(r.roots)} E/V/L)**, ${fraction(r.holes)} inert holes and ${fraction(r.jsxElements)} inert JSX sites. ThemeToggle is the only eager cause; tier 1 nevertheless hydrates every emitted root at load.`,
        "",
        "Removing FOREIGN_OWNER edges separates the router owner, the Home foreign wrapper, Home's article error holes and Home's LikeButton. DocPage's article and like button still share the U route props: M6 and the rejected props capture join them. That is an actual input dependency, not foreign ancestry. Foreign descendants are reported separately and are still not offered as stable slots; navigation can recreate them.",
        "",
        "The guide's two error holes stay joined by SPAN_OVERLAP: err().kind and err().message have the same paragraph span. The Home article has another instance of that pair. They are C/lazy in the analysis because the fallback error accessor is C, even with an S normal source. Neither is a seventh widget. Their span is absent during success and the accessor belongs to the Errored callback; codegen must preserve that boundary and edge, not hydrate a free-standing paragraph.",
        "",
        "Relative to 3b51165, docs changes from six groups (1/2/3) to eleven (1/5/5); inert JSX changes from 149/249 to 148/249. The majority-inert premise survives. This count is not eleven independent physical hydration claims. Hackernews and room also split when foreign ancestry is removed; the table above records all changes, including newly visible expression reads."
      );
    }
    out.push("", "### Groups and eager reach", "");
    if (eagerNotes[r.twin]) out.push(eagerNotes[r.twin], "");
    else
      out.push(
        "No eager group or $effect. Foreign lifetime constraints are reported separately from dependency grouping.",
        ""
      );
    for (const x of r.roots) {
      out.push(
        `Group ${x.id}: **${x.mode}, ${x.size} parts**, ${x.spanKind ?? "unknown"} span ${x.span ?? "unresolved"}. Components: ${x.components.join(", ")}. Candidate slots: ${x.slots?.length ?? 0}.`,
        ""
      );
      const causes = [
        ...x.effectReach.map(e => ({ ...e, kind: "$effect" })),
        ...(x.eagerSetupReach ?? []).map(e => ({ ...e, kind: "setup work" }))
      ];
      for (const e of causes) {
        out.push(
          `- ${e.kind} at ${e.at}${e.expression ? `: \`${expression(e.expression)}\`` : ""}.`,
          `  - Touched (${e.touched.length} parts, transitive reads/writes/calls): ${e.touched.join(", ") || "none"}.`,
          `  - Pulled in (${e.pulledIn.length} other parts through merges): ${e.pulledIn.join(", ") || "none"}.`
        );
      }
      out.push("");
    }
    out.push(
      `Merge pairs M1/M2/M3/M4/M5/M6: ${[1, 2, 3, 4, 5, 6].map(i => r.merges.filter(m => m.rule === `M${i}`).length).join("/")}. Additional pairs: ${["SPAN_OVERLAP", "FOREIGN_OWNER", "CAPTURE_FALLBACK"].map(k => `${k} ${r.merges.filter(m => m.rule === k).length}`).join(", ")}. Counts include redundant union pairs; they are not counts of independent reasons or saved roots.`,
      ""
    );
    for (const c of r.captureFailures)
      out.push(`Capture: ${c.at} \`${escape(c.variable)}\`: ${c.reason}.`);
    for (const f of r.findings) out.push(`Finding: ${f.at}: ${f.message}`);
  }
  out.push(
    "",
    "## Premise verdict",
    "",
    "Dev's option A accepts the content-heavy premise. The corrected docs twin retains a majority of locally inert JSX and separate SearchBox, CommentList, ThemeToggle, NewsletterForm and ImageCarousel groups. It has eleven dependency groups in total, including route owners and error fallbacks. The other twins remain mostly interactive. Physical claims, capture serialization and byte savings require C2 evidence; these static counts alone establish none of them."
  );
  return out.join("\n").trimEnd() + "\n";
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const twins = readdirSync(resolve(repo, "examples"))
    .filter(x => /-yield(-h)?$/.test(x))
    .sort();
  const reports = [];
  for (const twin of twins) {
    reports.push(
      await reportTwin(twin, process.argv.includes("--joined") ? { analysis: analyze } : {})
    );
    console.error(`analysed ${twin}`);
  }
  const md = markdown(reports);
  const args = process.argv.slice(2);
  if (args.includes("--markdown"))
    await writeFile(resolve(args[args.indexOf("--markdown") + 1]), md);
  else if (args.includes("--json")) console.log(JSON.stringify(reports, null, 2));
  else console.log(md.split("\n\n## ")[0]);
}
