import { writeFileSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { reportTwin } from "./report.js";
import { analyzeRecomputable } from "./recomputable.js";
const repo = resolve(import.meta.dirname, "../../..");
const twins = readdirSync(resolve(repo, "examples"))
  .filter(n => /-yield(?:-h)?$/.test(n))
  .sort();
const results = [];
for (const twin of twins) results.push(await reportTwin(twin, { analysis: analyzeRecomputable }));
const fraction = (n, total) => `${n}/${total} (${total ? ((100 * n) / total).toFixed(1) : "0.0"}%)`;
let text = `## C3: server-recomputable provenance (2026-10-07)\n\nAll nine entry graphs rerun. Before is the unchanged option-A S-only analysis; after uses the R cut. S and R columns are disjoint. Counts include structural holes and call-site instances, not runtime nodes or bytes. A server-owned parent with client slots is still counted client by the subtree metric; its server children are counted separately. These are placement candidates, not proof of frame transport or serialization.\n\n| Twin | Before S holes | After S holes | R holes | Client holes | Before S JSX | After S JSX | R JSX | Client JSX |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
for (const r of results)
  text += `| ${r.twin} | ${fraction(r.before.holes.inert, r.holes.total)} | ${fraction(r.holes.S, r.holes.total)} | ${fraction(r.holes.R, r.holes.total)} | ${fraction(r.holes.client, r.holes.total)} | ${fraction(r.before.jsx.inert, r.jsx.total)} | ${fraction(r.jsx.S, r.jsx.total)} | ${fraction(r.jsx.R, r.jsx.total)} | ${fraction(r.jsx.client, r.jsx.total)} |\n`;
text += `\nThe h twins have no JSX sites. Their S/R/client h-element counts are ${results
  .filter(r => r.h.total)
  .map(r => `${r.twin}: ${r.h.S}/${r.h.R}/${r.h.client} of ${r.h.total}`)
  .join("; ")}.\n\n### Regions, inputs and slots\n\n`;
for (const r of results) {
  text += `**${r.twin}.**`;
  if (!r.regions.length)
    text += ` No S/R loader region. ${r.serverCalls.length ? "The server-call results remain beneath client or unproved dependencies." : "No directly targeted declared server-function memo was found; async adapters/query/live wrappers stay U and event-written cells stay C."}\n\n`;
  else {
    text += `\n\n`;
    for (const region of r.regions)
      text += `- ${region.component} at ${region.at}: **${region.provenance}**, arguments [${region.arguments.map(x => x.expression).join(", ")}], slots [${region.slots.join(", ")}].\n`;
    text += "\n";
  }
  if (r.captures.length)
    text += r.captures.map(c => `- Capture refused at ${c.at}: ${c.reason}.\n`).join("") + "\n";
}
text += `Home's ArticleContent(\"overview\") and ReadingGuide's ArticleContent(\"widgets\") become entirely S, including their internal error fallback holes. DocPage's ArticleContent becomes R with the external argument vector [props.params.slug]; its default-to-overview expression stays on the server. Loaders, ArticleBody, chapter fields, table of contents and related links follow that placement. There is no article-list component in this version of Home. SiteNav and SiteFooter were already S.\n\nThe maximal Home/DocPage server-wrapper proposal would place their sibling LikeButton in a slot keyed by route component call-site plus LikeButton call-site, with serialized {slug}. No LikeButton is nested inside ArticleContent in this source. This report lists the narrower slot-free ArticleContent regions: wrapper/slot transport is not established by the analysis. ThemeToggle, SearchBox, NewsletterForm, CommentList (including avatars), ImageCarousel, both LikeButton instances and the router shell remain client. C1's eleven dependency groups are preserved as the before grouping, not relabelled as eleven independently emitted R groups.\n\nThe old leak rows saying a client input remains U are still correct about the router/props producer. Their former implication that every downstream server-function result also stays client is superseded by C0 §1.2.\n`;
if (process.argv.includes("--write")) {
  writeFileSync(
    resolve(repo, "documentation/compiler-c3-analysis.json"),
    JSON.stringify(results, null, 2) + "\n"
  );
  const path = resolve(repo, "documentation/compiler-c1-report.md");
  const previous = readFileSync(path, "utf8").split("\n## C3: server-recomputable provenance")[0];
  writeFileSync(path, previous.trimEnd() + "\n\n" + text);
}
console.log(text);
