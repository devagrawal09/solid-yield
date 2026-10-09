# Sugar/native review 3 fixes

This is an implementation-based re-score of the three saved newcomer reviews, using the review fixtures and their expected diagnostic codes and authored lines. The unchanged third review is [sugar-review-3.md](sugar-review-3.md). Its app source and all 15 mutations are archived in `packages/ts-plugin-yield/test/fixtures/review3-app`; the mutations were compared with the original `mut.py`, and the review was checked byte-for-byte with `cmp`.

## WIP recovery

The restart left 14 modified/untracked files, with 835 insertions in the tracked diff. The first build passed, but the first gate was RED: native contracts, Todos parity and the TS plugin suite failed; the restricted fresh install stalled and was stopped. The WIP was stashed before repair. A separate backup preserved concurrent pending/snapshot edits that appeared during recovery. The follow-up audit below confirmed the three review 3 backups were superseded before removing them.

The repaired WIP preserves the review fixtures, platform failure rules, provider summaries, promise lowering and diagnostic cleanup. Repairs also preserve pending for an async memo without `await`, retain the types of empty-array returns, keep `Promise.all` tuples, and infer a delayed `setTimeout(reject, ..., value)` payload. Timer cancellation IDs are ordinary arguments. These changes restored the existing native contracts and Todos parity. The native evidence snapshot was refreshed after inspection; all nine original-app statuses and diagnostic counts remain unchanged. The gate baseline was not changed.

## Follow-up recovery audit

Compared `/tmp/sy-ls-resume-handoff.md` and `/tmp/sy-ls-resume-extra.patch` against `6736cf7`. Every requested fix and its regression was already present. No patch hunks needed applying.

| Requested item | Result at 6736cf7 | Existing regression |
| --- | --- | --- |
| Async memo completion after authored return-value reads | Covered; `native-effects.js` saves the return value before `Promise.resolve`, retains empty-array types, and adds a fallthrough return only when needed | `packages/ts-plugin-yield/test/review3.test.cjs`: “an async memo without await still has a pending result” |
| Todos event snapshot names JSON.parse's SyntaxError | Covered | `scripts/native-todos-events.mjs snapshot`: exact SyntaxError messages on app lines 82 and 121 |
| Empty/EOF refusal spans stay within the file | Covered | `review3.test.cjs`: “refusal spans stay inside empty files and the end of a file” |
| Ignored .then chain in memo, event and setup | Covered | `review3.test.cjs`: “an ignored then chain reports on its … host” (three cases) |
| Timer failure belongs to its lexical event | Covered | `review3.test.cjs`: “a timer rejection belongs to its lexical event and requires an inner catch” |
| Named and inline signal handlers | Covered | `review3.test.cjs`: “… signal read and write in a JSX event” (two cases) |

The stash audit used each backup's parent-to-stash patch and compared the full stash content with HEAD. Formatting was normalized for source comparisons; archived untracked files were checked separately. The older backups' remaining source differences are improvements already in HEAD: pending completion, Promise.all result casts, scheduled rejection payloads and EOF clamping. The oldest backup's provider helper differs only in formatting; all other archived untracked files are identical to HEAD.

The earlier recovery removed the superseded `proto/sugar-ls` backups by verified object identity:

- `390ccfe6eb05efbf6a3a65df44d1f5f5a2ff93d2`: concurrent pending and snapshot repairs.
- `c8c3ae800152d54a3c55ef5c91e0bc61c0b938fb`: interrupted WIP, red pending/parity gate.
- `7cac7af7f1b7d609df5bd9a424780c811f6d5f79`: restart backup, async event regression.

The earlier recovery kept `295c84fb1abd4cb337f21d116d1ed2c8ddd865a3` (`proto/sugar`, native F-S35 fix and F-S36 pin). An unrelated `proto/sugar-types` backup (`5f5afafb0cbcd191dad3f7f146a832991dd5616c`) appeared during the audit and was also kept. Stash indices changed during the audit, so removal followed hashes rather than the original indices.

The current restart confirmed all six rows above in HEAD and inspected both remaining stashes with their parent-to-stash patches and differences against HEAD. No stash was dropped in this restart. The `proto/sugar-types` stash is not superseded: its native type lowering, tests and runtime type files are absent from this branch. The `proto/sugar` stash remains untouched as requested. No source patch was applied and no other branch was changed.

## Review 3: 22/30 before, 28/30 after

| # | Case | Before | Current outcome and authored line | After |
| --- | --- | ---: | --- | ---: |
| 1 | Empty catch | 2 | CATCH_SWALLOWS, Checkout:15 | 2 |
| 2 | Log-only catch | 2 | CATCH_SWALLOWS, Checkout:15 | 2 |
| 3 | Catch base ApiError and return a fallback | 1 | Valid handling; ProductList retains the transport failure | 1 |
| 4 | Selective RateLimited catch plus rethrow | 2 | Valid handling; ProductList retains the transport failure | 2 |
| 5 | Selective catch without rethrow | 1 | CATCH_SWALLOWS, ProductList:8; names only the unhandled transport path | 2 |
| 6 | Async event rejection | 2 | EVENT_REJECTS, Clock:7 | 2 |
| 7 | Ignored `.then`, no `.catch` | 1 | EVENT_REJECTS, Checkout:20, at the lexical event binding | 2 |
| 8 | Throw a string | 2 | NATIVE_THROW, api:10 | 2 |
| 9 | Timer callback throws | 0 | NATIVE_CALLBACK_FAILURE, Clock:5; Clock hover includes Error | 2 |
| 10 | Server gains Banned | 1 | Details hover gains Banned alongside NotFound; catch-all Errored handles it | 1 |
| 11 | Promise.all in memo | 1 | Correct tuple types and NotFound failure set; clean diagnostics | 2 |
| 12 | Try/finally without catch | 2 | EVENT_REJECTS, Checkout:20 | 2 |
| 13 | Async memo awaiting getProduct | 1 | Pending result and NotFound failure set; clean diagnostics | 2 |
| 14 | Missing provider | 2 | NO_PROVIDER, ProductList:6 | 2 |
| 15 | Missing Errored | 2 | FOREIGN_HANDOFF, ProductList:10 | 2 |

The two retained one-point cases are handling-policy choices, not missed thrown classes: catching an Error superclass and using a catch-all Errored are valid. The existing hover signal remains, and no new warning is claimed. Supported Promise.all and async memo forms earn two points for correct types and useful failure summaries. On the ten actual diagnostic cases alone, the comparison is **16/20 → 20/20**.

## Reviews 1 and 2, re-run

| Review | Published before | Comparable error/boundary rows, before → after |
| --- | --- | --- |
| 1 | Approximately 9/26; table arithmetic differs | **9/20 → 19/20**, using the lower async-handler score |
| 2 | 12/24 | **11/16 → 15/16** |
| 3 | 22/30 | **16/20 → 20/20**; original all-slot scale **22/30 → 28/30** |

The first two comparisons retain the treatment in [review-2 fixes](sugar-review-2-fixes.md): fallback returns, valid timer reads, base-class/selective handling and ordinary generator iteration are controls, excluded on both sides. Review 1's conditional and nested-component controls stay silent. The first review's upper async score would make its comparable before score 10/20. Portal remains an advisory warning, worth one point, in both earlier reviews.

| Review 1 slot | Current result | Authored line | Score |
| --- | --- | --- | ---: |
| 1 setup read | READ_IN_SETUP | App:8 | 2 |
| 2 provider | NO_PROVIDER | App:15 | 2 |
| 3a string in setup | NATIVE_THROW | App:8 | 2 |
| 3b string in memo | NATIVE_THROW | App:8 | 2 |
| 3c event throw | EVENT_REJECTS | App:9 | 2 |
| 4 async rejection | EVENT_REJECTS | App:10 | 2 |
| 6 memo write | WRITE_IN_REACTIVE | App:8 | 2 |
| 8 Portal | NATIVE_FOREIGN_BOUNDARY warning | App:26 | 1 |
| 9 props destructuring | NATIVE_PROPS | App:11 | 2 |
| 12 effect arity | NATIVE_EFFECT_PHASES | App:8 | 2 |

| Review 2 slot | Current result | Authored line | Score |
| --- | --- | --- | ---: |
| 2 string throw, including async helper | NATIVE_THROW | index:5 | 2 |
| 5 event rejection, including named/sync variants | EVENT_REJECTS | index:6 | 2 |
| 6 provider | NO_PROVIDER, once | index:14 | 2 |
| 7 setup read | READ_IN_SETUP, without declaration-file noise | index:7 | 2 |
| 8 Portal | NATIVE_FOREIGN_BOUNDARY warning | index:6 | 1 |
| 9 module state | MODULE_STATE | index:5 | 2 |
| 11 props destructuring | NATIVE_PROPS | index:6 | 2 |
| 12 effect arity | NATIVE_EFFECT_PHASES | index:7 | 2 |

## Rules and added probes

Platform calls use explicit contracts: ordinary ECMAScript/DOM operations add no failure; known throwing operations add named Error classes. Project function bodies are inferred across imports. Opaque calls retain unknown; a module's `"use pure"` directive asserts that its helpers cannot fail. Async `"use server"` producers add a transport failure (ChunkError); removing the directive retains application errors and removes transport.

Ignored promise-chain rejection belongs to its lexical event, memo or setup. Async memos retain pending and inferred rejections, and Promise.all unions member failures while preserving tuple types and concurrency. A throwing timer contributes to the host's failure summary and requires handling inside its callback. Provider wrappers remove only contexts proved to surround their children on every returned path.

Refusals point to authored reads and the failing file. Invalid positions use a bounded routine fallback with `[generated]`. Lowercase JSX tags have no variable binding. Diagnostics and color summaries use “a transport failure (ChunkError)”; unaffected files keep checked hovers when another file refuses transformation.

Extra regressions cover empty/EOF/invalid refusal spans, read locality, parser file locality, lowercase `p`, pure helpers, directive removal, three provider-wrapper forms, retained child failures and other contexts, named/inline JSX events, `.then` in all three hosts, handled chains, distinct Promise.all failure classes, named timer callbacks and delayed Promise rejection payloads. See [sugar-design.md](../sugar-design.md) for the full rule paragraphs.

## Verification and remaining limits

The code and fixture commit is `4ed867685a03`. Its pre-commit build passed, and the full gate finished **66 pass / 0 fail / 0 skip in 183s**, GREEN, against the unchanged `documentation/yield-gate-baseline.json`. The separate documentation build also passed, and its full gate finished **66 pass / 0 fail / 0 skip in 185s**, GREEN. [The saved final gate](sugar-review-3-gate.json) records all 66 steps. Each run checked the working tree before its local commit; the saved final gate HEAD is the code commit. All commits are local on `proto/sugar-ls`; nothing was pushed.

The reviewer’s original app was checked with this checkout's CLI: **9 files, 0 errors**. The 66 saved cases across the three review suites include their additional variants and valid controls. Each expected diagnostic is checked against its code, file and line; review 3 also checks component summaries and public error names. Saved actual diagnostics and hovers are in [sugar-review-3-results.json](sugar-review-3-results.json).

General foreign callback registration and runtime source maps remain incomplete. Timer throws are surfaced by the host summary and existing callback diagnostic; a surrounding Errored does not provide timer handling. Provider detection needs a provable wrapper shape. Imports through a refused file can still have incomplete summaries and secondary type errors: the string-throw mutation (#8) retains two ProductList type diagnostics alongside the actionable NATIVE_THROW in api.ts. Complete recovery here needs dependency summaries for refused files; the current retry keeps unrelated hovers available. Broad class catches and catch-all fallbacks remain valid; flagging them would require a new policy. Portal remains advisory. The native audit continues to report three refused original inputs and six generated inputs, with the same acceptance limits as before; these review fixes do not establish support for every Solid app.
