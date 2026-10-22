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

// Precision reductions from the two OpenClaw reviews; synthetic mutants are not upstream bugs.
/** @type {readonly { id: string, source: string, notes: string }[]} */
export const OPENCLAW_PRECISION_ORIGINS = Object.freeze([
  {
    "id": "op-loading-url",
    "source": "ui/src/components/plugin-theme-artwork.tsx:4–20 (E02) @09e09dcdf71",
    "notes": "Loading.on is a reset key, not an event binding. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-loading-url-mutant",
    "source": "ui/src/components/plugin-theme-artwork.tsx:4–20 (E02) @09e09dcdf71",
    "notes": "Loading.on is a reset key, not an event binding. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-loading-reactive-key",
    "source": "ui/src/components/plugin-theme-artwork.tsx:15 (E02) @09e09dcdf71",
    "notes": "A settled reactive reset input is not an untracked read. Promise values are read in Loading children, not inferred from the key. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-loading-reactive-key-mutant",
    "source": "ui/src/components/plugin-theme-artwork.tsx:15 (E02) @09e09dcdf71",
    "notes": "A settled reactive reset input is not an untracked read. Promise values are read in Loading children, not inferred from the key. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-focus-repair",
    "source": "ui/src/components/config-form.node.shared.tsx:179–198 (E36; E38 companion) @09e09dcdf71",
    "notes": "The queued task only sees captured destinations. Earlier remove/destinations injection is not part of this callback. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-focus-repair-mutant",
    "source": "ui/src/components/config-form.node.shared.tsx:179–198 (E36; E38 companion) @09e09dcdf71",
    "notes": "The queued task only sees captured destinations. Earlier remove/destinations injection is not part of this callback. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-machine-class",
    "source": "ui/src/components/solid/menu-machine.ts:294–329 (E05, E08) @09e09dcdf71",
    "notes": "A synchronous class subscription/start is not a pending Solid accessor. Unsupported class facts may warrant a warning, not a proven pending error. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-machine-class-mutant",
    "source": "ui/src/components/solid/menu-machine.ts:294–329 (E05, E08) @09e09dcdf71",
    "notes": "A synchronous class subscription/start is not a pending Solid accessor. Unsupported class facts may warrant a warning, not a proven pending error. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-machine-members",
    "source": "deps/node_modules/.pnpm/@zag-js+menu@2.0.0-next.3/node_modules/@zag-js/menu/dist/menu.connect.mjs:27–42; deps/node_modules/.pnpm/@zag-js+popper@2.0.0-next.3/node_modules/@zag-js/popper/dist/placement.mjs:10 (E11/E13/E15/E17/E19/E21/E23/E25/E27/E29/E31/E33/E35/E37/E39/E41) @09e09dcdf71",
    "notes": "Authored minimal synchronous get/hasTag/computed model. Names alone do not mark Solid accessors; the mutant really reads a pending memo. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-machine-members-mutant",
    "source": "deps/node_modules/.pnpm/@zag-js+menu@2.0.0-next.3/node_modules/@zag-js/menu/dist/menu.connect.mjs:27–42; deps/node_modules/.pnpm/@zag-js+popper@2.0.0-next.3/node_modules/@zag-js/popper/dist/placement.mjs:10 (E11/E13/E15/E17/E19/E21/E23/E25/E27/E29/E31/E33/E35/E37/E39/E41) @09e09dcdf71",
    "notes": "Authored minimal synchronous get/hasTag/computed model. Names alone do not mark Solid accessors; the mutant really reads a pending memo. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-held-callback",
    "source": "ui/src/components/multi-select.tsx:36,220,250,279 (E24/E28/E30 safe-body control) @09e09dcdf71",
    "notes": "Known safe held callbacks keep their bodies through two forwarding steps; a real throwing callback must not be silenced. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-held-callback-mutant",
    "source": "ui/src/components/multi-select.tsx:36,220,250,279 (E24/E28/E30 safe-body control) @09e09dcdf71",
    "notes": "Known safe held callbacks keep their bodies through two forwarding steps; a real throwing callback must not be silenced. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-held-ref",
    "source": "ui/src/components/config-form.node.shared.tsx:108 (E34 safe-body control); ui/src/components/native-chrome-setup.tsx:93 (S01) @09e09dcdf71",
    "notes": "Forwarded known node capture is safe. Unknown or throwing ref callbacks are not made safe by the ref exemption. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-held-ref-mutant",
    "source": "ui/src/components/config-form.node.shared.tsx:108 (E34 safe-body control); ui/src/components/native-chrome-setup.tsx:93 (S01) @09e09dcdf71",
    "notes": "Forwarded known node capture is safe. Unknown or throwing ref callbacks are not made safe by the ref exemption. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-native-listener",
    "source": "ui/src/lib/reactive/listener.ts:26 (E18, unsure; recommendation 4) @09e09dcdf71",
    "notes": "Valid native EventTarget teardown keeps receiver identity. An injected removeEventListener lookalike has no safe body. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-native-listener-mutant",
    "source": "ui/src/lib/reactive/listener.ts:26 (E18, unsure; recommendation 4) @09e09dcdf71",
    "notes": "Valid native EventTarget teardown keeps receiver identity. An injected removeEventListener lookalike has no safe body. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-set-add",
    "source": "ui/src/components/overlay-lifecycle.ts:610 (E04, unsure; recommendation 4) @09e09dcdf71",
    "notes": "A native Set.add with valid arguments is not an unknown injected add method. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-set-add-mutant",
    "source": "ui/src/components/overlay-lifecycle.ts:610 (E04, unsure; recommendation 4) @09e09dcdf71",
    "notes": "A native Set.add with valid arguments is not an unknown injected add method. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-dependency-machine",
    "source": "deps/node_modules/.pnpm/@zag-js+menu@2.0.0-next.3/node_modules/@zag-js/menu/dist/menu.connect.mjs:27–42 (E11/E13/E15/E17/E19/E21/E23/E25/E27/E29/E31/E33/E37/E39/E41) @09e09dcdf71",
    "notes": "Installed dist is not authored source. The declaration supplies no failure guarantee: catch at the app call site; never report inside the package. An extra installed checked-root probe forces the boundary to be tested even when package resolution already selects declarations. The app never imports/renders that component. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-dependency-machine-mutant",
    "source": "deps/node_modules/.pnpm/@zag-js+menu@2.0.0-next.3/node_modules/@zag-js/menu/dist/menu.connect.mjs:27–42 (E11/E13/E15/E17/E19/E21/E23/E25/E27/E29/E31/E33/E37/E39/E41) @09e09dcdf71",
    "notes": "Installed dist is not authored source. The declaration supplies no failure guarantee: catch at the app call site; never report inside the package. An extra installed checked-root probe forces the boundary to be tested even when package resolution already selects declarations. The app never imports/renders that component. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-dependency-string",
    "source": "deps/node_modules/.pnpm/@zag-js+popper@2.0.0-next.3/node_modules/@zag-js/popper/dist/placement.mjs:10 (E35) @09e09dcdf71",
    "notes": "Installed string-processing implementation is not app source. Catch unknown failure at the declared API call, not inside dist. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-dependency-string-mutant",
    "source": "deps/node_modules/.pnpm/@zag-js+popper@2.0.0-next.3/node_modules/@zag-js/popper/dist/placement.mjs:10 (E35) @09e09dcdf71",
    "notes": "Installed string-processing implementation is not app source. Catch unknown failure at the declared API call, not inside dist. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-e24-remove",
    "source": "ui/src/components/multi-select.tsx:36,220 (E24) @09e09dcdf71",
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-e24-remove-mutant",
    "source": "ui/src/components/multi-select.tsx:36,220 (E24) @09e09dcdf71",
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-e28-keydown",
    "source": "ui/src/components/multi-select.tsx:36,250 (E28) @09e09dcdf71",
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-e28-keydown-mutant",
    "source": "ui/src/components/multi-select.tsx:36,250 (E28) @09e09dcdf71",
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-e30-select",
    "source": "ui/src/components/multi-select.tsx:36,279 (E30) @09e09dcdf71",
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-e30-select-mutant",
    "source": "ui/src/components/multi-select.tsx:36,279 (E30) @09e09dcdf71",
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-e40-reselect",
    "source": "ui/src/components/solid/settings-ui.tsx:459–474 (E40) @09e09dcdf71",
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  },
  {
    "id": "op-e40-reselect-mutant",
    "source": "ui/src/components/solid/settings-ui.tsx:459–474 (E40) @09e09dcdf71",
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information. Source review: openclaw-trial/REPORT.md and PRECISION.md. rc.17 reduction; not a byte-identical copy."
  }
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
