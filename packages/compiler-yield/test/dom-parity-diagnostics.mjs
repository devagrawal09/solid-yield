// Diagnostic ablations only. Never use these to normalize the parity snapshots.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
export const withoutWrappers = html => html.replace(/<\/?solid-frame\b[^>]*>/g, "");
export const withoutMarkers = html => html.replace(/<template id="pl-[^"]*"><\/template>/g, "");
export const withoutFrameScaffolding = html => withoutMarkers(withoutWrappers(html));
const withoutClaimsIn = (html, selector) =>
  html.replace(
    selector,
    (_, start, body, end) =>
      start +
      body.replace(/<a\b[^>]*>/g, tag =>
        tag.replace(/ (?:data-active|data-pending)=""| aria-current="page"/g, "")
      ) +
      end
  );
export const withoutMarkdownClaims = html =>
  withoutClaimsIn(html, /(<div class="markdown">)([\s\S]*?)(<\/div>)/g);
export const withoutTocClaims = html =>
  withoutClaimsIn(html, /(<aside class="on-this-page">)([\s\S]*?)(<\/aside>)/g);
export const authoredContent = html =>
  withoutTocClaims(withoutMarkdownClaims(withoutFrameScaffolding(html)));
const hash = html => createHash("sha256").update(html).digest("hex");
const route = html => html?.match(/<main>[\s\S]*?<\/main>/)?.[0] ?? null;
const markers = html => html?.match(/<template id="pl-[^"]*"><\/template>/g) ?? [];
function linkAttributes(html) {
  const dom = new JSDOM(html);
  try {
    return Object.fromEntries(
      ["markdown", "on-this-page"].map(name => [
        name,
        [...dom.window.document.querySelectorAll(`.${name} a`)].map(a => [
          a.getAttribute("href"),
          a.getAttribute("data-active"),
          a.getAttribute("data-pending"),
          a.getAttribute("aria-current")
        ])
      ])
    );
  } finally {
    dom.window.close();
  }
}
export function diagnose({ library, compiled, original }) {
  const stages = [
    ["exact", x => x],
    ["withoutWrappers", withoutWrappers],
    ["withoutWrappersAndMarkers", withoutFrameScaffolding],
    ["alsoWithoutMarkdownClaims", x => withoutMarkdownClaims(withoutFrameScaffolding(x))],
    ["alsoWithoutTocClaims", authoredContent]
  ];
  const steps = library.snapshots.map((a, step) => {
    const b = compiled.snapshots[step];
    const aLinks = linkAttributes(a),
      bLinks = linkAttributes(b);
    return {
      step,
      librarySha256: hash(a),
      compiledSha256: hash(b),
      comparisons: Object.fromEntries(stages.map(([name, clean]) => [name, clean(a) === clean(b)])),
      wrappers: (b.match(/<solid-frame\b/g) ?? []).length,
      pendingMarkers: markers(b),
      libraryPendingMarkers: markers(a),
      claimDifferences: Object.fromEntries(
        Object.keys(aLinks).map(name => [
          name,
          JSON.stringify(aLinks[name]) !== JSON.stringify(bLinks[name])
        ])
      )
    };
  });
  return {
    steps: steps.length,
    counts: Object.fromEntries(
      stages.map(([name]) => [name, steps.filter(s => s.comparisons[name]).length])
    ),
    plainSolidExactMatches: original
      ? original.snapshots.filter((s, i) => s === library.snapshots[i]).length
      : null,
    claimDifferenceSteps: Object.fromEntries(
      ["markdown", "on-this-page"].map(name => [
        name,
        steps.filter(s => s.claimDifferences[name]).map(s => s.step)
      ])
    ),
    firstNavigation: {
      libraryRoute: route(library.snapshots[4]),
      compiledRoute: route(compiled.firstNavigation),
      exactRouteMatch: route(library.snapshots[4]) === route(compiled.firstNavigation),
      likeNodeRetained: compiled.firstLikeRetained ?? null,
      intermediateFrameMarkers: markers(compiled.firstFrame),
      settledMarkers: markers(compiled.snapshots[5])
    },
    checkpoints: steps,
    ...(compiled.linkClaims
      ? {
          linkClaims: Object.fromEntries(
            Object.entries({ library, compiled, original }).map(([name, result]) => [
              name,
              result?.linkClaims
            ])
          )
        }
      : {})
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [before, after, output] = process.argv.slice(2);
  if (!before || !after || !output)
    throw new Error("Usage: dom-parity-diagnostics.mjs before.json after.json output.json");
  writeFileSync(
    output,
    JSON.stringify(
      {
        level: "L",
        baselineCommit: "a4ca329",
        note: "Exact uses the unchanged harness normalizer. Other columns are diagnostic ablations, not passing DOM parity. Baseline step 4 waited for the first frame; after step 4 is immediate.",
        before: diagnose(JSON.parse(readFileSync(before))),
        after: diagnose(JSON.parse(readFileSync(after)))
      },
      null,
      2
    ) + "\n"
  );
}
