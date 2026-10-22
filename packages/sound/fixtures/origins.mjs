// @ts-check
// Where each shared case comes from. Sources are copied byte-identically by
// extract.mjs; test/fixtures.test.mjs re-derives them and compares.
//
// kind "script": `fixtures` export of scripts/native/fixtures.mjs, by id.
// kind "table": a row [id, source, codes] of a `const programs = [...]` table in
// a legacy test file; template placeholders (${head}, ${signal}, …) are the
// test file's own top-level string constants, substituted as the test does.

/** @typedef {{ id: string, kind: "script", file: string }} ScriptOrigin */
/** @typedef {{ id: string, kind: "table", file: string, table: string, row: string }} TableOrigin */
/** @type {readonly (ScriptOrigin | TableOrigin)[]} */
export const ORIGINS = Object.freeze([
  // scripts/native/fixtures.mjs — review categories, one-liners
  ...[
    "counter", "props", "setup-read", "named-event", "inline-event", "pending-root", "colored-prop",
    "throw-error", "catch", "memo-write", "callback-read", "async-read", "handled-catch", "rethrow-catch",
    "promise-catch", "promise-event", "async-event-reads", "async-memo-reads", "async-setup-reads",
    "foreign-route-failure", "native-latest-pending", "timer-callback-failure", "native-for-indexed",
    "native-optimistic-store-basic", "ref-event-reads", "unknown-rethrow-catch", "event-updater"
  ].map(id => /** @type {ScriptOrigin} */ ({ id, kind: "script", file: "scripts/native/fixtures.mjs" })),
  // packages/vite-plugin-yield/test/native-paths.test.js — `programs`
  ...[
    "return-ternary", "return-and", "callback-prop-throws", "callback-prop-unseen", "named-callback-in-setup",
    "setup-promise-rejects", "async-handler-destructured-uncaught", "effect-reads-failing-memo-at-root",
    "props-interface-live", "props-accessor-callers", "callback-prop-forwarded", "setup-promise-caught",
    "async-memo-nested-function", "recursion-failing-prop", "return-null", "finally-nested-function"
  ].map(row => /** @type {TableOrigin} */ ({ id: row, kind: "table", file: "packages/vite-plugin-yield/test/native-paths.test.js", table: "programs", row })),
  // packages/vite-plugin-yield/test/native-forms.test.js — `programs`
  ...[
    "getter-read-in-setup", "iife-pending-root", "array-callback-in-setup", "plain-callback-throw-in-memo",
    "plain-callback-throw-under-errored", "kept-promise-rejects-at-its-await", "kept-promise-caught-by-its-chain",
    "untrack-in-every-host", "reader-helpers"
  ].map(row => /** @type {TableOrigin} */ ({ id: row, kind: "table", file: "packages/vite-plugin-yield/test/native-forms.test.js", table: "programs", row }))
]);

// Reduced/ported OpenClaw evidence, not byte-identical extraction inputs.
/** @type {readonly { id: string, source: string, notes: string }[]} */
export const OPENCLAW_ORIGINS = Object.freeze([
  {
    "id": "oc-01-factory-reader",
    "source": "ui/src/lib/reactive/i18n.ts:26–43; ui/src/app/app-root.tsx:96–110 @09e09dcdf71",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 01; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-01-factory-reader-mutant",
    "source": "ui/src/lib/reactive/i18n.ts:26–43; ui/src/app/app-root.tsx:96–110 @09e09dcdf71",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 01; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-02-effect-prop-phase",
    "source": "ui/src/components/skill-file-hovercard.tsx:193–196; ui/src/pages/model-setup/model-setup-owner.ts @57d0e8e57ad (#179428)",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 02; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-02-effect-prop-phase-mutant",
    "source": "ui/src/components/skill-file-hovercard.tsx:193–196; ui/src/pages/model-setup/model-setup-owner.ts @57d0e8e57ad (#179428)",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 02; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-03-optional-context",
    "source": "ui/src/components/portaled-hovercard-focus.ts:47–51; notes/repros/zz-scratch-ctx.test.ts:17–26",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 03; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-03-optional-context-mutant",
    "source": "ui/src/components/portaled-hovercard-focus.ts:47–51; notes/repros/zz-scratch-ctx.test.ts:17–26",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 03; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-04-default-accessor",
    "source": "ui/src/lib/solid/presentation.ts:1–4; ui/src/components/session-progress-card-content.tsx:21 @09e09dcdf71",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 04; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-04-default-accessor-mutant",
    "source": "ui/src/lib/solid/presentation.ts:1–4; ui/src/components/session-progress-card-content.tsx:21 @09e09dcdf71",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 04; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-05-project-get-method",
    "source": "ui/src/lib/reactive/context.ts:16–29,105–107; extensions/clawrouter/src/control-ui.tsx:26–49; D-128 platform-symbol rule",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 05; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-05-project-get-method-mutant",
    "source": "ui/src/lib/reactive/context.ts:16–29,105–107; extensions/clawrouter/src/control-ui.tsx:26–49; D-128 platform-symbol rule",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 05; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-06-promise-forks",
    "source": "ui/src/pages/chat/components/chat-question-resource.tsx:185–199 @09e09dcdf71 (#180630)",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 06; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-06-promise-forks-mutant",
    "source": "ui/src/pages/chat/components/chat-question-resource.tsx:185–199 @09e09dcdf71 (#180630)",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 06; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-07-scoped-outcome",
    "source": "ui/src/pages/question/question-page.tsx:51–62,202–211; ui/src/pages/chat/components/chat-question-resource.tsx:55,325–328 @09e09dcdf71",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 07; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-07-scoped-outcome-mutant",
    "source": "ui/src/pages/question/question-page.tsx:51–62,202–211; ui/src/pages/chat/components/chat-question-resource.tsx:55,325–328 @09e09dcdf71",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 07; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-08-lazy-unused-prop",
    "source": "ui/src/plugins/control-ui-dashboard.tsx:168–176; ui/src/features/github-connections/github-identity-view.tsx:53–78; CONTEXT.md lazy-unconsumed rule",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 08; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-08-lazy-unused-prop-mutant",
    "source": "ui/src/plugins/control-ui-dashboard.tsx:168–176; ui/src/features/github-connections/github-identity-view.tsx:53–78; CONTEXT.md lazy-unconsumed rule",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 08; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-09-forwarded-pending-setup",
    "source": "ui/src/features/github-connections/github-identity-view.tsx:54–78; ui/src/pages/model-setup/native-model-setup.tsx:79–81 @09e09dcdf71",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 09; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-09-forwarded-pending-setup-mutant",
    "source": "ui/src/features/github-connections/github-identity-view.tsx:54–78; ui/src/pages/model-setup/native-model-setup.tsx:79–81 @09e09dcdf71",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 09; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-10-untrack-not-a-catch",
    "source": "ui/src/components/select-picker-view.tsx:137; ui/src/lib/reactive/context.ts:25–29 @09e09dcdf71",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 10; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-10-untrack-not-a-catch-mutant",
    "source": "ui/src/components/select-picker-view.tsx:137; ui/src/lib/reactive/context.ts:25–29 @09e09dcdf71",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 10; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-12-keyed-row-snapshot",
    "source": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 12; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-12-keyed-row-snapshot-mutant",
    "source": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 12; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-12-row-pending",
    "source": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 12; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-12-row-pending-mutant",
    "source": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 12; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-12-row-held",
    "source": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 12; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-12-index-row",
    "source": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 12; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-12-index-row-mutant",
    "source": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 12; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-23-ref-read",
    "source": "GAPS.md gap 23 read-scope reduction; ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453)",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 23; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-23-ref-read-mutant",
    "source": "GAPS.md gap 23 read-scope reduction; ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453)",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 23; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-23-ref-pending",
    "source": "GAPS.md gap 23 read-scope reduction; ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453)",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 23; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-23-ref-pending-mutant",
    "source": "GAPS.md gap 23 read-scope reduction; ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453)",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 23; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-04-default-without-provider",
    "source": "ui/src/lib/solid/presentation.ts:1–4; ui/src/components/session-progress-card-content.tsx:21 @09e09dcdf71",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 04; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-01-translation-reader",
    "source": "ui/src/lib/reactive/i18n.ts:26–43; ui/src/app/app-root.tsx:96–110 @09e09dcdf71",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 01; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  },
  {
    "id": "oc-01-translation-reader-mutant",
    "source": "ui/src/lib/reactive/i18n.ts:26–43; ui/src/app/app-root.tsx:96–110 @09e09dcdf71",
    "notes": "/Users/devagr/solid-yield-wt/openclaw-mining/GAPS.md gap 01; drafts/ for the original pair, results/openclaw-runtime.md for fresh rc.17 checks. Additional controls/mutants are authored reductions, not upstream bugs."
  }
]);
