# Sugar/native newcomer review: fixes and rerun

2026-10-08. Starting revision: `d88e31c`, branch `proto/sugar-ls`.
The [original review](sugar-review-1.md) is an unchanged copy of
`/private/tmp/sy-review-out/REVIEW.md`. The reviewer's source app, setup files and
all supplied variants are copied into
`packages/ts-plugin-yield/test/fixtures/review-app`. Sources retain their original
line numbers. `for-call.tsx` reproduces the review's separately described
`item().name` error. `expectations.json` asserts codes, files and lines; the
[rerun record](sugar-review-1-results.json) contains every diagnostic and related
location from the supplied variants.

The requested seven areas now have fixes and tests:

- Root errors follow the surviving generated operation types to their source.
  Pending points to `items()` at App:17; missing ThemeCtx points to its read at
  App:13; missing UserCtx points to App:15, skipping the provided ThemeCtx.
  An unhandled failure points to the throw feeding its type, api:4. Render or
  hydrate remains a related location. The CLI prints both. Real tsserver checks
  the error on the origin file, because its primary spans belong to the file
  being checked. Its related span points back to index:3.
- Published runtime dependency and peer ranges have no `workspace:` references.
  Native mode imports the compiler by package name. Analysis has its own parser,
  so the native runtime dependency does not require a circular package install.
  `fresh-install` packs the compiler, TS/Vite/ESLint plugins and runtime, then
  separately installs tarballs and `file:` copies in isolated temporary apps.
  Both apps run Vite build, the CLI and recommended native ESLint. Local
  overrides select the unreleased `0.0.0` packages; no npm release is implied.
- The For error was erased by lowering: a row value became a source, so the
  mistaken `item()` was accepted as a source read. Lowering now reads the value
  before applying the authored call. Both the generated checker and CLI report
  TS2349 at App:17. All generated errors survive mapping, including a synthetic
  helper error with a `[generated]` fallback. Distinct TypeScript error codes
  are retained even when their mapped messages coincide.
- Failure advice distinguishes rendered work from events/effects. Events and
  effects ask for a catch inside the handler or a declared failure contract;
  rendered work asks for Errored or attempt. The async handler also gets a
  related App:9 handler location. Tests verify that catching in the reviewer's
  sync and async handlers removes their failures. The timer's read is allowed;
  ordinary built-in console logging does not invent a callback failure. A
  timer that really calls unknown failing work reports that operation's line.
- Native ESLint source blocks use `settings: { "solid-yield": { mode: "native" } }`
  with a `files` selection matching Vite/TS. They allow plain Solid imports and
  skip the explicit dialect's JSX factory requirement. Explicit/directive
  blocks retain those rules. The unchanged native reviewer app lints cleanly.
- Messages put the action first and component hovers use plain summaries.
  Literal string throws point to the throw, asking for an Error object. An
  Error throw in a component body no longer gets a misleading JSX-return
  message; it explains that this work must move into a memo/rendered work or
  be handled. The library's rule against raising during component creation
  is preserved. The ten-slot typing table and recorded evidence are updated.
- The root README now introduces sugar/native mode near the top, includes the
  15-line plain Solid example and its diagnostic, and links the complete
  tarball/file install, tsconfig, Vite and ESLint setup. The example was checked:
  the pending read is on line 11 and render is related on line 15. Claims about
  complete source mapping/lint coverage are qualified. Old design statements
  about a planned editor plugin are explicitly historical.

## Scores, using the review's 0–2 rubric

0 means missed or misleading; 1 means caught but still limited; 2 means caught
at the right line with an action. Legal supported code is N/A, as the review
already does for #10/#11. Warnings are not automatically awarded full credit.

| Case | Before | After | Rerun and reason |
| --- | ---: | ---: | --- |
| 1: setup read | 1 | 2 | READ_IN_SETUP, App:8; move the read to reactive work. The retained root cascade says to fix the earlier error first. |
| 2: second missing context | 1 | 2 | NO_PROVIDER, App:15, names UserCtx; index:3 is related. The provided ThemeCtx is skipped. |
| 3a: string throw in body | 0 | 2 | NATIVE_THROW, App:8; use an Error. A separate Error-body regression explains the creation-phase restriction at the throw. |
| 3b: string throw in memo | 1 | 2 | NATIVE_THROW, App:8; use an Error object that can be identified and handled. |
| 3c: event throw | 0 | 2 | FOREIGN_HANDOFF, App:9; catch in the handler or declare its failure. No Errored advice. |
| 4: async event rejection | 0–1 | 2 | FOREIGN_HANDOFF, api:4 origin, App:9 handler and index:3 handoff related; catch in the handler. |
| 5: swallowed catch | 0 | 0 | Still silent. Intentional absorption is supported; there is no native warning for an accidental swallow. |
| 6: memo write | 2 | 2 | WRITE_IN_REACTIVE, App:8; move the write to an event/effect. The root cascade directs attention to earlier errors. |
| 7: timer read | 0 | N/A | Correctly silent. This is legal supported code, as the reviewer noted; the false positive is removed. |
| 8: Portal | 1 | 1 | NATIVE_FOREIGN_BOUNDARY warning, App:26, plain wording. It still cannot check Portal's internals and does not fail the CLI. |
| 9: destructured props | 1 | 2 | NATIVE_PROPS, App:11; use a props parameter and read props.name. |
| 10: conditional read | N/A | N/A | Correctly silent. |
| 11: nested component | N/A | N/A | Silent, as before; no new top-level-only warning is claimed. |
| 12: effect arity | 2 | 2 | NATIVE_EFFECT_PHASES, App:8; pass tracked compute and untracked effect functions. |

The review states approximately **9/26**. Its table actually contains twelve
scored rows after expanding #3a/#3b/#3c and excluding #10/#11: **24 possible
points**, not 26. Taking the review's lower async-handler score reproduces
**9/24 before**. Excluding the legal timer read on both sides gives the honest
common comparison: **9/22 before → 19/22 after**. The upper async score would
make the comparable before score 10/22. No extra two-point row is invented to
repair the review's denominator, and correct silence on the timer is not
counted as a newly caught error.

The For false negative and the three boundary removals are separate probes;
they are tested but do not inflate this score. Restoring the original app's
Loading/provider/Errored boundaries produces zero errors.

## Verification and remaining limits

The first gate rerun exposed an export-table mismatch and frozen warning text.
The parser was then moved into the compiler package, removing the need for a
new Vite export. Native evidence was refreshed for **message text only**: no
fixture status, error count, location, or acceptance threshold changed.
The gate baseline is extended **only for the new passing `fresh-install` step**;
all 64 prior step outcomes remain PASS.

Final `pnpm build` passed. The full gate immediately before the documentation
commit finished **65 pass / 0 fail / 0 skip in 163 seconds**, GREEN, with no
regressions. Both earlier code commits also had a passing build and full GREEN
gate before committing (65/0/0 in 153 and 148 seconds). The TS plugin's 44 tests
also passed in a separate run after the build. The unchanged review was checked
byte for byte, and the copied reviewer source files match their originals.

Local commits on `proto/sugar-ls`:

- `0c171be` — native package installs and ESLint source selection.
- `c7f85de` — origin diagnostics, ordinary errors, advice and reviewer regressions.
- This documentation commit — setup guide, unchanged review, rerun evidence and
  honest before/after scores.

Nothing was pushed.

There is still no native warning that separates accidental catch swallowing
from intentional absorption. Portal remains a warning for an imported boundary,
not a check of that package's implementation. Root cascades from invalid
component types are retained rather than hiding TypeScript errors, with advice
to fix earlier errors. A transform refusal still blocks that selected group
until fixed; the tool does not promise every source error in that blocked group.
Genuinely synthetic diagnostics retain `[generated]`. Runtime source map
composition, broad editor features and editor UI verification remain outside
these fixes. These limits are not counted as completed work.
