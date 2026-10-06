import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reportTwin } from "./report.js";
import { analyzeReachability, partName, authoredRanges } from "./reachability.js";
import { transformBodies, countBodies } from "./reachability-bytes.js";
import { edgeData } from "./reachability-data.js";
import { phasePlan, selectPhase, interactionIndices } from "./reachability-phases.js";
const repo = resolve(import.meta.dirname, "../../..");
const read = file => JSON.parse(readFileSync(resolve(repo, "documentation", file), "utf8"));
const median = xs => {
  const a = xs.toSorted((a, b) => a - b);
  return a.length ? (a[Math.floor(a.length / 2)] + a[Math.floor((a.length - 1) / 2)]) / 2 : 0;
};
const sum = xs => xs.reduce((a, b) => a + b, 0);
const pct = x => (100 * x).toFixed(1) + "%";
const fmt = x => x.toLocaleString("en-US");
const safe = s => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");
export async function reachabilityReport({ only } = {}) {
  const baseline = read("executed-bytes.json"),
    hydrated = read("docs-hydrated-bytes.json");
  const core = read("compiler-reachability-core.json"),
    payload = read("compiler-reachability-data.json");
  const output = {
    metric:
      "C1b static projected transformed body spans; conditional tier-3 first-use floor, not measured execution",
    core,
    twins: []
  };
  for (const twin of readdirSync(resolve(repo, "examples"))
    .filter(n => /-yield(-h)?$/.test(n))
    .sort()
    .filter(t => !only || t === only)) {
    let g, placement;
    await reportTwin(twin, {
      analysis: (modules, opts) => {
        ({ graph: g, placement } = analyzeReachability(modules, opts));
        return {};
      }
    });
    const transformed = await transformBodies(g.a.modules.keys());
    const id = new Map(g.parts.map((p, i) => [p, `p${i + 1}`]));
    const ranges = parts => [...parts].flatMap(p => authoredRanges(p, g.a));
    const details = r => ({
      parts: [...r.parts].map(p => id.get(p)),
      writes: [...r.writes].map(p => id.get(p)),
      writeSet: [...new Set([...r.parts].flatMap(p => [...(p.writes ?? [])]))].map(p => id.get(p)),
      reads: [...r.reads].map(p => id.get(p))
    });
    const events = g.events.map(p => {
      const reached = g.reach([p]);
      return {
        id: id.get(p),
        name: partName(p),
        at: p.at,
        bound: g.bound.has(p),
        ...details(reached),
        fraction: reached.parts.size / g.parts.length,
        code: countBodies(ranges(reached.parts), transformed),
        data: edgeData(twin, reached, g, payload)
      };
    });
    const lib =
      twin === "docs-yield"
        ? hydrated.summary
            .find(r => r.app === "library")
            .phases.map(p => ({ phase: p.phase, bytes: p.max }))
        : baseline.results.find(r => r.twin === twin && r.app === "twin").phases;
    const compiled =
      twin === "docs-yield" ? hydrated.summary.find(r => r.app === "compiled").phases : null;
    const plan = phasePlan(twin);
    const script = readFileSync(resolve(repo, "examples", twin, "tests/script.ts"), "utf8");
    const namesInScript = [...script.matchAll(/^\s*\[\s*"([^"\n]+)"/gm)].map(m => m[1]);
    if (JSON.stringify(namesInScript) !== JSON.stringify(lib.slice(1).map(p => p.phase)))
      throw new Error(`Parity script phase names changed: ${twin}`);
    if (plan.length !== lib.length)
      throw new Error(`Phase inventory ${twin}: ${plan.length} != ${lib.length}`);
    const seen = new Map(),
      materialized = new Set(),
      phases = [];
    for (let i = 0; i < plan.length; i++) {
      const reached = selectPhase(g, plan[i], partName);
      const parts = new Set(reached.parts),
        newGroups = [];
      // First use pays the group's initializer/memo/effect/hole bodies. Handler
      // definitions are descriptors; handler bodies are paid when called.
      for (let j = 0; j < g.groups.length; j++)
        if (!materialized.has(j) && g.groups[j].some(p => parts.has(p))) {
          materialized.add(j);
          newGroups.push(j + 1);
          for (const p of g.groups[j])
            if (id.has(p) && !["event", "bind", "timer"].includes(p.kind)) parts.add(p);
        }
      const code = countBodies(ranges(parts), transformed, seen);
      const runtime = i === 0 ? core.phases[0].bytes : 0;
      phases.push({
        phase: lib[i].phase,
        trigger: plan[i],
        library: lib[i].bytes,
        compiled: compiled?.[i].max,
        ...details(reached),
        newGroups,
        codeBytes: code.bytes,
        newCodeBytes: code.fresh,
        runtime,
        lowerBound: code.fresh + runtime,
        resetProxy: code.bytes + (i === 0 ? core.phases[0].bytes : core.phases[1].core),
        ranges: code.ranges
      });
    }
    const boundEvents = events.filter(e => e.bound);
    const interactions = interactionIndices(twin).map(i => phases[i]);
    const summary = {
      graphParts: g.parts.length,
      events: events.length,
      boundEvents: boundEvents.length,
      groups: placement.roots.length,
      libraryLoad: lib[0].bytes,
      lowerLoad: phases[0].lowerBound,
      libraryTotal: sum(lib.map(p => p.bytes)),
      lowerTotal: sum(phases.map(p => p.lowerBound)),
      resetProxyTotal: sum(phases.map(p => p.resetProxy)),
      medianReach: median(events.map(e => e.fraction)),
      medianScriptReach: median(interactions.map(p => p.parts.length / g.parts.length)),
      worstScriptReach: Math.max(...interactions.map(p => p.parts.length / g.parts.length)),
      worstScriptPhase: interactions.toSorted((a, b) => b.parts.length - a.parts.length)[0].phase,
      medianBoundReach: median(boundEvents.map(e => e.fraction)),
      worstReach: Math.max(...events.map(e => e.fraction)),
      worst: events
        .toSorted((a, b) => b.fraction - a.fraction)
        .slice(0, 3)
        .map(e => e.id)
    };
    const row = {
      twin,
      summary,
      parts: g.parts.map(p => ({
        id: id.get(p),
        name: partName(p),
        at: p.at,
        kind: p.kind,
        directReads: [...(g.reads.get(p) ?? [])].map(r => id.get(r)),
        directWrites: [...(p.writes ?? [])].map(r => id.get(r)),
        calls: [...(p.calls ?? [])].map(r => id.get(r))
      })),
      events,
      phases
    };
    output.twins.push(row);
    console.error(
      `${twin}: ${summary.graphParts} parts, ${events.length} events; ${summary.lowerTotal}/${summary.libraryTotal} first-use bytes`
    );
  }
  // Intern repeated projected ranges so the audit artifact does not repeat
  // hundreds of identical spans in every continuation phase.
  for (const row of output.twins) {
    const rangeSets = new Map();
    const intern = files => {
      const key = JSON.stringify(files);
      if (!rangeSets.has(key))
        rangeSets.set(key, {
          id: `r${rangeSets.size + 1}`,
          files: files.map(f => ({ ...f, ranges: f.ranges.map(r => [r.start, r.end]) }))
        });
      return rangeSets.get(key).id;
    };
    for (const e of row.events) {
      e.code.rangeSet = intern(e.code.ranges);
      delete e.code.ranges;
      e.data.entries = e.data.entries.map(({ id: _id, ...value }) => value);
    }
    for (const p of row.phases) {
      p.rangeSet = intern(p.ranges);
      delete p.ranges;
    }
    row.rangeSets = [...rangeSets.values()];
  }
  // Portable review artifact: IDs are stable pN within each twin, paths are relative.
  return JSON.parse(
    JSON.stringify(output)
      .split(repo + "/")
      .join("")
  );
}
export function markdown(report) {
  const lines = [
    "# C1b: interaction reachability and a tier-3 cost floor",
    "",
    "2026-10-07. Report only. C2, application code and the runtime are unchanged. No resumer has been built.",
    "",
    "## Result",
    "",
    "All numbers below are bytes of transformed, unbundled source, not minified downloads, time, or speedups. The main lower-bound column is a **conditional first-use budget**: the union of code ranges across the script. The library columns are measured V8 phase totals, which count a reused range again in each phase. Their ratio answers the requested optimistic floor question; it is **not a prediction of tier-3 execution or a like-for-like saving**. The reset proxy below counts repeated application bodies plus the empty-root idle runtime in every phase. Neither estimate includes the extra runtime work of real interactions.",
    "",
    "| Twin | Library load | Tier-3 load floor | Load ratio | Library script | Tier-3 first-use floor | Ratio | Reset proxy / library |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  ];
  for (const { twin, summary: s } of report.twins)
    lines.push(
      `| ${twin} | ${fmt(s.libraryLoad)} | ${fmt(s.lowerLoad)} | ${pct(s.lowerLoad / s.libraryLoad)} | ${fmt(s.libraryTotal)} | ${fmt(s.lowerTotal)} | ${pct(s.lowerTotal / s.libraryTotal)} | ${pct(s.resetProxyTotal / s.libraryTotal)} |`
    );
  lines.push(
    "",
    "| Twin | Graph parts | Events (bound) | Median reached, all events | Median, bound events | Worst reach |",
    "| --- | ---: | ---: | ---: | ---: | ---: |"
  );
  for (const { twin, summary: s } of report.twins)
    lines.push(
      `| ${twin} | ${s.graphParts} | ${s.events} (${s.boundEvents}) | ${pct(s.medianReach)} | ${pct(s.medianBoundReach)} | ${pct(s.worstReach)} |`
    );
  lines.push(
    "",
    "| Twin | Median scripted interaction reach | Worst scripted interaction | Reach |",
    "| --- | ---: | --- | ---: |",
    ...report.twins.map(
      ({ twin, summary: s }) =>
        `| ${twin} | ${pct(s.medianScriptReach)} | ${s.worstScriptPhase} | ${pct(s.worstScriptReach)} |`
    ),
    "",
    "## What was counted",
    "",
    "The directed pass follows each event's writes (including store updater reads, refreshes and optimistic/error-path writes), called events, dependent memos, effects and holes. Reads needed before a write pull in their upstream sources, including pending sources, without waking unrelated readers. Effects can write further sources. Changed flows include recreated child bodies but do not call those children's handlers. Callback identity includes its function site, so a returned fallback and the helper that creates it are distinct. Dynamic action lookup takes the union of known alternatives (TodoMVC retry). Foreign router/transport changes are explicit phase inputs, not invented application signal writes.",
    "",
    "A graph part is a non-structural hole, bind, cell, memo, effect, event, timer, flow or boundary, including inert parts. Counts are C1-style call-site instances; repeated rows and recursive families have one static representative. Fractions describe this graph, not runtime node counts. Same source code shared by multiple instances counts once in bytes. Event tables include callable and background events as well as DOM-bound events; bound-only medians are separate. Source IDs, direct edges, all reached IDs, projected generated ranges and data estimates are in compiler-reachability.json.",
    "",
    "Code bytes are the union of source-map segments in the yield + Solid + Vite module-runner output whose authored positions fall inside the reached handler, memo, initializer, effect or hole body. Helper bodies invoked by those bodies are included. UTF-16 offsets become UTF-8 byte lengths, as in the executed-bytes harness. These are exactly the selected **mapped spans**, not proof that every branch executes. Unmapped scaffolding, imports, descriptors, DOM templates outside holes and opaque dependency-package calls are omitted. A static may-reach union can include unexecuted branches; combined with omitted runtime work this is an optimistic model, not a mathematically certified lower bound.",
    "",
    "Data bytes are UTF-8 JSON value sizes (undefined uses its 9-byte literal), with no envelope/key/identity cost. Sources appear once per edge; separate memo values count separately. Serializable lexical captures, such as carousel pictures, are included. Docs site/article/comments come from an actual completed library SSR payload; its hash and extracted values are recorded in compiler-reachability-data.json. Other values are initial literals or explicit estimates of representative fake API/parity data. These are initial/representative edge sizes, not maxima over edits or an implemented serializer. Errors, live iterators, functions, contexts and pending ownership require descriptors/transport not priced here; their serializability is not proved. See reachability-data.js for each value and basis.",
    "",
    "## Empty-root measurement and assumptions",
    "",
    `The empty hydrated root retains its server node. Cold core: **${fmt(report.core.phases[0].core)}** bytes; empty shell: **${fmt(report.core.phases[0].shell)}**; total load: **${fmt(report.core.phases[0].bytes)}**. An idle flush executes **${fmt(report.core.phases[1].core)}** core bytes. The core includes solid-yield/internal, the public hydrate entry, Solid web and their transitive signal/owner dependencies. Loading only internal and web while omitting those dependencies would undercount. Tooling and SSR work are excluded.`,
    "",
    "The probe uses the same Vite browser environment as hydrated docs. Despite production mode/conditions, the installed plugin resolves .dev.js files; the raw core record names them. This is the recorded harness path, not a claim about a minified production build. The benchmark selector also admits @solidjs/vite-plugin/dist; the core probe excludes that tooling. Existing baseline numbers are preserved, so that small scope mismatch is explicit.",
    "",
    "- Load assumes one shell hydration, settled SSR data, and no application root bodies. Descriptors cost approximately zero. The current public-library empty root is a proxy for this hypothetical shell, not proof that any possible resumer must execute exactly this core.",
    "- First use pays the touched C1b group's initializer/memo/effect/hole bodies. Later steps pay only code ranges not previously charged in the first-use budget. All shared ranges, including runtime already charged at load, are counted once across steps. The reset proxy instead repeats body ranges and idle runtime per phase.",
    "- C1b corrects callback/error reach only in its subclass; original C1 placement and C2 output do not change. C1b materialization groups may differ from the published C1 count. Docs' published C1 remains eleven groups; physical C2 remains seven roots.",
    "- The exact authored phase order is retained. Settlements, reconnects, timers, animation frames, hash changes, error retries and navigation are charged explicitly. Continuations conservatively reuse the initiating handler's whole static slice. A group recreated on navigation is assumed to reuse code already charged; live instance/data recreation is not free in a real runtime.",
    "- Room identity/presence and Sierpinski clocks require work without a user interaction. The first background phase must materialize them. A strict policy of doing nothing until a user event cannot preserve these parity scripts. CSR twins also need an SSR-data path they do not currently have. Treat their floor as conditional on solving these semantic requirements.",
    "- Router, Effect, transport, serializer, disposal, ownership, error routing, DOM updates and group creation costs above the empty runtime are omitted. Effect's low ratio in particular is dominated by unpriced package work. No benchmark here establishes that those bytes disappear.",
    "",
    "## Per-twin details",
    ""
  );
  for (const row of report.twins) {
    const { twin, events, parts, phases, summary: s } = row,
      names = new Map(parts.map(p => [p.id, p.name]));
    lines.push(
      `### ${twin}`,
      "",
      `C1b materialization groups: ${s.groups}. Median reach ${pct(s.medianReach)}; worst ${pct(s.worstReach)}.`,
      "",
      "| Event (part ID; B = DOM bound) | Writes (signals/stores) | Needed reads | Reached / graph | Code bytes | Data bytes |",
      "| --- | --- | --- | ---: | ---: | ---: |"
    );
    for (const e of events)
      lines.push(
        `| ${safe(e.name)} (${e.id}${e.bound ? "; B" : ""}) | ${e.writeSet.map(x => safe(names.get(x))).join(", ") || "—"} | ${e.reads.map(x => safe(names.get(x))).join(", ") || "—"} | ${e.parts.length}/${s.graphParts} (${pct(e.fraction)}) | ${fmt(e.code.bytes)} | ${fmt(e.data.bytes)} |`
      );
    lines.push(
      "",
      "Worst events: " +
        s.worst
          .map(id => {
            const e = events.find(e => e.id === id);
            return `${e.name} (${e.parts.length} parts; ${e.writes.map(x => names.get(x)).join(", ") || "reads only"})`;
          })
          .join("; ") +
        ".",
      "",
      "| Phase | Trigger / continuation | New groups | Library measured | Compiled measured | Body spans incl. first materialization | New body bytes | Tier-3 first-use floor | Reset proxy |",
      "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |"
    );
    for (const p of phases)
      lines.push(
        `| ${safe(p.phase)} | ${safe(p.trigger.join(", ") || (p.phase === "load" ? "shell + core" : "idle / SSR settled"))} | ${p.newGroups.join(", ") || "—"} | ${fmt(p.library)} | ${p.compiled === undefined ? "—" : fmt(p.compiled)} | ${fmt(p.codeBytes)} | ${fmt(p.newCodeBytes)} | ${fmt(p.lowerBound)} | ${fmt(p.resetProxy)} |`
      );
    lines.push(
      `| **Total** | | | **${fmt(s.libraryTotal)}** | ${twin === "docs-yield" ? fmt(sum(phases.map(p => p.compiled))) : "—"} | ${fmt(sum(phases.map(p => p.codeBytes)))} | ${fmt(sum(phases.map(p => p.newCodeBytes)))} | **${fmt(s.lowerTotal)}** | **${fmt(s.resetProxyTotal)}** |`,
      ""
    );
  }
  lines.push(
    "## Design signals and verdict",
    "",
    "Docs' search query reaches its async results, result-row holes and error boundary; LikeButton.add reaches the local count, optimistic, pending and failure displays. Both remain small. Whole-app reset buttons can rebuild their entire boundary; they appear in the worst-event list even if the parity script does not click them. TodoMVC's todos store feeds the filtered rows, completion state and both footer counts. Retrying an unknown action reaches all five action alternatives. Splitting or narrowing that shared store is the app-level signal. Rendering's navigated/location source controls every route alternative; its large reach is a static union, while Reveal's seed recreates all cards. Effect's tab source recreates both panels; the log entries store is shared across actions. Room's post needs the current identity, room and pending transcript, and updates sending/error/transcript readers; connection callbacks and Live.room fan out independently of user clicks. Sierpinski's seconds reaches recursive labels and elapsed drives scale; this is intentionally continuous shared state. Hackernews' open is local to a comment toggle; its row family is widened, while most scripted work is external router navigation.",
    "",
    "Tier 3 is worth a narrow docs-only experiment, because the static widget slices are small and the cold empty-shell floor leaves room below eager hydration. It is not yet justified as a general replacement on this corpus. TodoMVC materializes a broad shared-store group on its first useful work; room must start identity and live subscriptions without a user event; Sierpinski is a continuous animation. The very low script floor ratios largely come from counting code once and omitting interaction runtime, so they cannot support a speedup claim. A next experiment should preserve the full phase schedule and measure actual resume/materialization and repeated runtime bytes before expanding beyond docs.",
    "",
    "## Reproduce and validation",
    "",
    "Validation: pnpm build passed; the full required gate passed 52/52 steps in 86 seconds, with no failures or skips and the existing baseline unchanged. Twelve directed/range fixtures and three existing coverage-counter tests pass. A second empty-root run gave identical core/shell/idle bytes; a second SSR-data extraction gave identical values. Node v24.18.0; installed pnpm v11.20.0 used the existing dependency tree with pnpm_config_pm_on_fail=ignore and pnpm_config_verify_deps_before_run=false to disable automatic version downloads/reinstalls. No dependency manifest or lockfile changed.",
    "",
    "```sh",
    "node examples/harness/executed-bytes/empty-root.mjs --record documentation/compiler-reachability-core.json",
    "node examples/harness/executed-bytes/reachability-data.mjs --record documentation/compiler-reachability-data.json",
    "node packages/compiler-yield/src/reachability-report.js --write",
    "node --test packages/compiler-yield/test/reachability.test.mjs",
    "pnpm build",
    "node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json",
    "```",
    "",
    "The checked-in payload snapshot can be refreshed by running the library docs SSR-only driver and passing the HTML to docsPayload() in reachability-data.js; the HN snapshot comes from the existing deterministic hn-data.mjs fixture. The gate runs this report without thresholds and checks the directed fixtures in compiler:reachability-test. It does not promote a cost estimate into a runtime correctness or performance gate."
  );
  return lines.join("\n") + "\n";
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const onlyIndex = process.argv.indexOf("--only");
  const result = await reachabilityReport({
    only: onlyIndex < 0 ? undefined : process.argv[onlyIndex + 1]
  });
  if (process.argv.includes("--write")) {
    writeFileSync(
      resolve(repo, "documentation/compiler-reachability.json"),
      JSON.stringify(result, null, 2) + "\n"
    );
    writeFileSync(resolve(repo, "documentation/compiler-reachability.md"), markdown(result));
  } else console.log(markdown(result).split("## What was counted")[0]);
  // Vite's native transform workers can retain filesystem requests after all
  // servers have closed. This CLI has finished and all output writes are sync.
  process.exit(0);
}
