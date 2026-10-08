# Sugar and native typing

Implemented on `proto/sugar-ls`, 2026-10-08, following D-116. The standard
[tsserver plugin and CLI](../packages/ts-plugin-yield/README.md) check the virtual
library program from the **same transform implementation as Vite**. Native
Sierpinski and Todos pass the CLI without edits to their original sources.
The library's types remain the authority; no separate color checker was added.

## Error locality: ten recoverable review slots

These are executable native Solid reconstructions in the counter/todo style of
`examples/originals`, drawn from the recoverable entries in
[the 34-slot review ledger](reviews/sugar-dx.md). They are not recovered verbatim
historical source. T02, L02 and R04 historically overlap as setup reads; these
three use different expressions. **Ten review slots do not mean ten independent
error categories, or 34/34 coverage.** Missing historical identities remain
unavailable. Accepted native forms such as async effect phases are not falsely
counted as caught mistakes.

Each source link is a complete native `.tsx` file. Lines below refer to authored
source, not generated code. Every row is asserted by the package tests. R06 is
still a transform refusal, now at its authored expression. R08 reports the
unprovided root handoff, where the requirement must be satisfied; it does not
blame the valid context declaration/read. L05's reactive eager JSX is rejected
for its setup read at the bad expression.

| Review slot | Native source | Line:column | Actual diagnostic |
| --- | --- | --- | --- |
| T02 | [setup-read.tsx](../packages/ts-plugin-yield/test/fixtures/mistakes/setup-read.tsx) | 4:17 | TS2769 `[READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.` |
| L02 | [setup-label.tsx](../packages/ts-plugin-yield/test/fixtures/mistakes/setup-label.tsx) | 5:25 | TS2769 `[READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.` |
| R04 | [setup-branch.tsx](../packages/ts-plugin-yield/test/fixtures/mistakes/setup-branch.tsx) | 4:17 | TS2769 `[READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.` |
| T05 | [effect-arity.tsx](../packages/ts-plugin-yield/test/fixtures/mistakes/effect-arity.tsx) | 4:3 | TS95000 `[NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.` |
| T07 | [pending-root.tsx](../packages/ts-plugin-yield/test/fixtures/mistakes/pending-root.tsx) | 7:8 | TS1360 `[PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.` |
| T08 | [colored-prop.tsx](../packages/ts-plugin-yield/test/fixtures/mistakes/colored-prop.tsx) | 7:21 | TS2322 `[SETTLED_PROP] This prop is settled; pass a settled value or declare a pending source contract.` |
| L05 | [eager-jsx.tsx](../packages/ts-plugin-yield/test/fixtures/mistakes/eager-jsx.tsx) | 4:21 | TS2769 `[READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.` |
| R05 | [memo-write.tsx](../packages/ts-plugin-yield/test/fixtures/mistakes/memo-write.tsx) | 5:5 | TS2345 `[WRITE_IN_REACTIVE] A reactive computation cannot write; move this write to an event or effect phase.` |
| R06 | [hole-create.tsx](../packages/ts-plugin-yield/test/fixtures/mistakes/hole-create.tsx) | 3:14 | TS95000 `[SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole.` |
| R08 | [missing-context.tsx](../packages/ts-plugin-yield/test/fixtures/mistakes/missing-context.tsx) | 8:8 | TS1360 `[NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires Identity; The root requires a context; provide it above the component that reads it.` |

The [machine-readable evidence](sugar-typing-evidence.json) contains the full
sources, every reported diagnostic and all three hovers. Reproduce it with
`node scripts/sugar-typing-evidence.mjs`; use `--write` only after reviewing an
intentional change. The table shows the offending read/write/prop or handoff,
not the generated `component(` / `view(` wrapper that caused the reviews'
error-locality complaint.

## Hover evidence

These components are in [colors.tsx](../packages/ts-plugin-yield/test/fixtures/colors.tsx):

```text
DocPage: pending false; fails NotFound; may-wait false; requires none
PendingCount: pending true; fails none; may-wait false; requires none
SaveButton: pending false; fails none; may-wait true; requires Identity
```

`SaveButton` covers both event may-wait and a required context. These summaries
come from generated `HoleCall`/`ComponentView` types. At component calls the
instantiated call type is used. Named routine/source calls use temporary
in-scope type queries of the library's `PendingOf`, `FailsOf`, `WaitsOf` and
`RequiresOf`; the queries do not affect diagnostics or emitted runtime code.
Native failure class IDs are displayed as class names, including the inferred
`unknown` floor when present. A tested failing foreign handoff reports
`Component DocPage: ... fails NotFound | unknown ...; not handled — wrap in
Errored or handle with attempt/catch`. D-033 is retained: a failure color alone
is not a rejection at a library root.

## Implementation and verification

The shared `vite-plugin-solid-yield/virtual` export returns text and a node
position table. Each printer pairs its AST with its emitted AST and carries
source provenance through every reparse, including unchanged and cloned nodes.
Generated nodes without an authored span map to the enclosing routine's name
with `[generated]`; file-level helpers map to the file start. This fallback is
tested. Explicit source inheritance handles rewritten prop/tag names and root
handoffs. Tests distinguish repeated identifiers, including UTF-16 positions
after an emoji.

The language service uses original filenames with private transformed snapshots,
so generated modules resolve each other. It maps syntactic, semantic, suggestion
and related diagnostic spans without replacing the editor's source buffer.
Recognized library host errors are relocated using the rejected generator's
operation types; only TypeScript's already-reported errors are explained. The
[message catalog](../packages/ts-plugin-yield/src/catalog.cjs) retains overlapping
lint/runtime codes and transform codes, alongside TypeScript numeric codes.
Unknown machinery errors use `GENERATED_TYPE` rather than a branded-never dump.

The protocol test spawns the installed **real tsserver**, loads the plugin through
`tsconfig.plugins`, opens a native file, requests `semanticDiagnosticsSync` and
`quickinfo`, checks line/column/text, then applies an unsaved edit and checks that
the error disappears. Other tests cover imported component calls, ordinary TS
errors, directive sugar, source and declaration edits, routine hovers, failure
messages and CLI failure/success exit codes. This is protocol evidence, not an
editor screenshot or a claim that a particular editor loaded the plugin.

The existing `native:sierpinski:typecheck` and `native:todos:typecheck` gate steps
now invoke the CLI against the actual originals. Their baseline outcome remains
PASS. Runtime parity, SSR, generated lint, the library types and all existing
gate thresholds are unchanged. The only new gate step is
`pkg:ts-plugin-yield:test`.

## Remaining findings

| Finding | Limit |
| --- | --- |
| F-T1 — editor UI | No editor UI was available for verification. The protocol test verifies plugin loading, diagnostics, quickinfo and unsaved edits. Editors must use the workspace TypeScript version and load the plugin; restart after config changes. |
| F-T2 — other editing features | Completion, navigation, rename, refactoring and code actions still use the original source service. They do not expose all generated contracts or provide mapped fixes. |
| F-T3 — fallback messages and locations | The catalog covers observed host/boundary errors, not every TypeScript diagnostic shape. Unrecognized machinery gets `GENERATED_TYPE`; genuinely synthetic spans retain `[generated]` at the routine name. No general proof establishes all lowering positions. |
| F-T4 — recovery and latency | A transform refusal blocks that selected transform group until fixed. There is no partial recovery tree. Lowering is synchronous and cached by project/content versions; large-project latency, project references and cancellation during lowering are not benchmarked. |
| F-T5 — distribution and maps | This is a Node 24 / TypeScript 6 workspace package. Standalone publishing still inherits the native transform's private analyzer dependency (F-S16). The position table is for pre-JSX typing; Vite runtime sourcemap composition is still absent. |
| F-T6 — hover forms and identity display | Component and resolvable named routine/source calls are covered. Anonymous, computed and unresolved higher-order calls can retain the ordinary generated TS signature. Display names can coincide for distinct nominal classes; the underlying library types keep their distinct IDs. |

Typing does not close the native transform's existing behavior/proof findings.
It makes its generated type checks and refusals visible at authored positions.

## Final verification

`pnpm build` passed. The full gate on the implementation at `3af477b` plus the
gate/docs working tree finished **64 pass / 0 fail / 0 skip in 223 seconds**, GREEN.
All **19** plugin tests passed, including the real tsserver protocol test. The
exact `pnpm solid-yield check examples/originals/todos --native 'src/**'` command
also passed with zero errors. The reproducible ten-row/three-hover evidence
check passed without rewriting its expected output.

The [baseline](yield-gate-baseline.json) was regenerated **only because one
passing step was added: `pkg:ts-plugin-yield:test`**. All 63 prior PASS outcomes
remain PASS. The existing two native typecheck steps now use the CLI; no prior
step was removed, no threshold changed, and no failure was accepted into the
baseline. The earlier full run also passed 64/0/0 in 154 seconds before the final
routine-hover, declaration-edit and node-coverage additions. Commits are local
on `proto/sugar-ls`; nothing was pushed.
