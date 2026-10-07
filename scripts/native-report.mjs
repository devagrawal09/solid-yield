// Summarize the recorded audit; never turn generated checks into app parity.
import { readFileSync, writeFileSync } from "node:fs";
const report = JSON.parse(
  readFileSync(new URL("../documentation/native-verification.json", import.meta.url), "utf8")
);
const gate = JSON.parse(
  readFileSync(new URL("../documentation/native-gate-verification.json", import.meta.url), "utf8")
);
const short = failure =>
  failure.includes("#") ? failure.split("#").at(-1).replace(/@\d+$/, "") : failure;
const escape = text => text.replaceAll("|", "\\|").replaceAll("\n", " ");
const inference = original => {
  const groups = new Map();
  for (const component of original.inference.components) {
    const fails = component.fails.map(short).join(", ") || "none";
    groups.set(fails, [...(groups.get(fails) ?? []), component.name]);
  }
  return [...groups]
    .map(([fails, names]) => `${[...new Set(names)].join(", ")} → {${fails}}`)
    .join("; ");
};
let text = `# Bounded native audit — 2026-10-08

**Partial implementation. No complete original passes native acceptance.**
The required line is recorded in [sugar-design.md](sugar-design.md#native-mode-the-core-surface).
Build passed. The [full regression gate](native-gate-verification.json) is GREEN:
**${gate.summary.line}**. It tested the working tree subsequently committed as
1080e0c; the run records the preceding HEAD, ${gate.head.slice(0, 7)}.
${report.fixtures.filter(f => f.stage === "accepted").length}/${report.fixtures.length} focused fixtures pass generated TypeScript and recommended lint.
The counter, caught generator action, and async helper have SSR plus hydrated
interaction parity against plain Solid. The async helper reads both before and
after await; its server button survives hydration. These are fixtures, not app acceptance.

Seven unchanged original source trees supply nine JSX/h twin targets. The docs
source matches main. The audit runs Sierpinski, todos, hackernews, effect,
rendering, room, then docs. The baseline is unchanged; no native app step was
added because none passed. D-115's production message difference remains the
recorded, allowed difference in native-serialization.mjs.

The failure sets below are **source call-graph estimates**, not checked route
contracts. Counts are detected JSX boundaries, not a claim that all package
value boundaries have been extracted. Entry handoffs are separate. A transform
failure can leave a detected boundary unemitted. All native app parity and SSR
runs are blocked by their generated checks; the gate still runs the existing
handwritten twins and directive-sugar todos.

| Target | Status | Native parity / SSR | Detected JSX boundaries | Inferred failures per component | Diagnostics |
| --- | --- | --- | ---: | --- | --- |
`;
for (const original of report.originals)
  text += `| ${original.twin} | fails (${original.status === "refused" ? "transform" : "generated checks"}) | blocked / blocked | ${original.foreignBoundaries.length} | ${escape(inference(original))} | ${escape([...new Set(original.diagnostics.map(d => d.code))].join(", "))} |\n`;
text += `
## Boundary inventory

`;
for (const original of report.originals) {
  text += `### ${original.twin}\n\n`;
  if (!original.foreignBoundaries.length) text += "No foreign JSX boundary detected.\n\n";
  for (const d of original.foreignBoundaries)
    text += `- ${d.file}:${d.line}:${d.column}: ${d.message}\n`;
  text += "\n";
}
text += `## Core evidence and gaps

| Core form | Current evidence / limit |
| --- | --- |
| Signals, memos, events and holes | counter, conditional, loop, inline-event; counter SSR/hydration |
| Effect compute and effect phases | feedback fixture checks both phases; no termination claim |
| Context creation/provision/read | context and missing-context fixtures; complex context value facades remain open |
| Props | props, tag, colored-prop; snapshot destructuring and recursion remain F-S20 |
| For / Show / Switch / Match | row, lazy-child, native-for-indexed, native-switch-match; only tested forms |
| Index | No Index export in installed Solid 2 rc.13; For keyed=false is checked. A separate Index lowering is not implemented |
| Loading / Errored / fallbacks | lazy-child, handled-catch, generator-action; complex fallback hosts remain open |
| Action and generator action | generator-action and hydrated rejecting action |
| Store / optimistic signal / basic optimistic store | native-store, native-optimistic, native-optimistic-store-basic |
| Server functions and throw/catch | server-rejection, class/unknown/catch fixtures; native-serialization production control |
| Refs | ref-event-reads; no async/failing-ref registration proof (F-S23) |
| Timer/listener callbacks | timer-callback and timer-callback-failure; unresolved callbacks still F-S1/F-S23 |
| Async reads | async-event-reads, async-memo-reads; async-setup-reads refuses setup; hydrated async helper |
| JSX spreads | Still refused; F-S24 |
| splitProps / mergeProps | Not imported by the originals; no implemented lowering claimed |

## Two originals: verbatim diagnostics

Boundary messages below are the Vite warning text plus authored position. Type
messages are the generated TypeScript diagnostics, including their generated
position; there is still no source mapping for those messages.

`;
for (const name of ["hackernews-spa", "docs"]) {
  const original = report.originals.find(o => o.original === name);
  text += `### ${name}\n\n`;
  for (const d of original.foreignBoundaries)
    text += `\`\`\`text\n[${d.code}] ${d.message}\n${d.file}:${d.line}:${d.column}\n\`\`\`\n\n`;
  const failure = original.diagnostics.find(d => d.message.includes("FOREIGN_HANDOFF"));
  text += failure
    ? `\`\`\`text\n${failure.file}:${failure.line}: [${failure.code}] ${failure.message}\n\`\`\`\n\n`
    : "No unhandled-failure handoff diagnostic was reached; see the earlier blocker in the audit.\n\n";
}
text += `## Remaining findings

- **F-S19, partial:** direct calls and method arguments can read in the caller's host. Method lookup stays before argument evaluation; nativeInvoke preserves the receiver and ignores an overridden .call. Spread arguments and more complex receiver expressions still need coverage.
- **F-S20:** Sierpinski's one-time prop snapshots and recursive component colors remain unchecked. No cast or source rewrite was used to declare it passing.
- **F-S23:** failing timer/ref callbacks still report NATIVE_CALLBACK_FAILURE; registration at the owning boundary remains incomplete.
- **F-S24:** reactive JSX spreads still report NATIVE_SPREAD. Preserving DOM identity, getter order, and event/ref bindings needs a checked spread adapter.
- **F-S25:** ordinary native prop types do not yet infer pending/failure colors from every caller. Router RouteSectionProps includes unknown values rejected by PropsCheck; docs also exposes SETTLED_PROP. These are lowering gaps, not native-source type errors.
- **F-S26:** foreign JSX tags, render callbacks and route component handoffs are implemented, but automatic extraction of arbitrary rendered package values, projections, lazy/until, directives and class components is incomplete. Some legacy API mappings still run. Boundary counts are consequently incomplete for the full option-C surface.
- **F-S27:** higher-order components, remaining context/fallback callbacks, and foreign listener assignments can still stop at SUGAR_COMPONENT/SUGAR_CALLBACK/SUGAR_HOST. The model's unknown-host refusal must not hide unfinished host inference.
- **F-S28:** the warnings use C for foreign client ownership. The existing analyzer still gives unknown foreign data U and pins the owner to the client; a separate native provenance/capture acceptance check has not been added. Do not read the warning label as a new proof of capture safety.
- Earlier F-S14/F-S15/F-S18 limitations (transport/custom-class identity, external root exceptions, structural class witnesses), source maps and packaging remain. No new proof or editor integration is claimed.
`;
writeFileSync(new URL("../documentation/native-bounded-report.md", import.meta.url), text);
console.log("Wrote documentation/native-bounded-report.md from the recorded audit.");
