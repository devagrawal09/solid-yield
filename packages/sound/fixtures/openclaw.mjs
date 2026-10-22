// @ts-check
// Frozen OpenClaw reductions; origins.mjs, openclaw/README.md and D-131.
/** @type {import("./schema.d.ts").Fixture[]} */
export const openclawFixtures = [
  {
    "id": "oc-01-factory-reader",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-01-factory-reader.tsx"
    ],
    "entry": "oc-01-factory-reader.tsx",
    "origin": "ui/src/lib/reactive/i18n.ts:26–43; ui/src/app/app-root.tsx:96–110 @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "context/services. Coverage expansion: factory + synchronous service method + interpolation; base helper-alias cases already exist. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-01-factory-reader-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-01-factory-reader-mutant.tsx"
    ],
    "entry": "oc-01-factory-reader-mutant.tsx",
    "origin": "ui/src/lib/reactive/i18n.ts:26–43; ui/src/app/app-root.tsx:96–110 @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "STRICT_READ_UNTRACKED",
        "file": "oc-01-factory-reader-mutant.tsx",
        "at": [
          {
            "find": "count()"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-01-factory-reader",
      "edit": "Seeded reduction: Setup-invoked service factory returns a live reader. Compare parent source and notes."
    },
    "notes": "context/services. Coverage expansion: factory + synchronous service method + interpolation; base helper-alias cases already exist. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-02-effect-prop-phase",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-02-effect-prop-phase.tsx"
    ],
    "entry": "oc-02-effect-prop-phase.tsx",
    "origin": "ui/src/components/skill-file-hovercard.tsx:193–196; ui/src/pages/model-setup/model-setup-owner.ts @57d0e8e57ad (#179428)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "D-131: compute reads reactive inputs and forwards values to apply/helpers. Reading a settled reactive prop in apply/helpers is STRICT_READ_UNTRACKED (error); rc.17 emits that runtime warning."
  },
  {
    "id": "oc-02-effect-prop-phase-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-02-effect-prop-phase-mutant.tsx"
    ],
    "entry": "oc-02-effect-prop-phase-mutant.tsx",
    "origin": "ui/src/components/skill-file-hovercard.tsx:193–196; ui/src/pages/model-setup/model-setup-owner.ts @57d0e8e57ad (#179428)",
    "inSubset": true,
    "expected": [
      {
        "code": "STRICT_READ_UNTRACKED",
        "file": "oc-02-effect-prop-phase-mutant.tsx",
        "at": [
          {
            "find": "props.value"
          }
        ],
        "related": [
          {
            "file": "oc-02-effect-prop-phase-mutant.tsx",
            "at": [
              {
                "find": "value={count()}"
              }
            ]
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-02-effect-prop-phase",
      "edit": "Seeded reduction: An effect helper consumes its input in the right phase. Compare parent source and notes."
    },
    "notes": "D-131: compute reads reactive inputs and forwards values to apply/helpers. Reading a settled reactive prop in apply/helpers is STRICT_READ_UNTRACKED (error); rc.17 emits that runtime warning."
  },
  {
    "id": "oc-03-optional-context",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-03-optional-context.tsx"
    ],
    "entry": "oc-03-optional-context.tsx",
    "origin": "ui/src/components/portaled-hovercard-focus.ts:47–51; notes/repros/zz-scratch-ctx.test.ts:17–26",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "context/services. A nullish fallback after lookup cannot catch the missing-provider throw. The notes are a scratch probe, not a verified result log. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-03-optional-context-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-03-optional-context-mutant.tsx"
    ],
    "entry": "oc-03-optional-context-mutant.tsx",
    "origin": "ui/src/components/portaled-hovercard-focus.ts:47–51; notes/repros/zz-scratch-ctx.test.ts:17–26",
    "inSubset": true,
    "expected": [
      {
        "code": "CONTEXT_PROVIDER_MISSING",
        "file": "oc-03-optional-context-mutant.tsx",
        "at": [
          {
            "find": "useContext(Optional)"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-03-optional-context",
      "edit": "Seeded reduction: null is a usable optional-context default; undefined is not. Compare parent source and notes."
    },
    "notes": "context/services. A nullish fallback after lookup cannot catch the missing-provider throw. The notes are a scratch probe, not a verified result log. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-04-default-accessor",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-04-default-accessor.tsx"
    ],
    "entry": "oc-04-default-accessor.tsx",
    "origin": "ui/src/lib/solid/presentation.ts:1–4; ui/src/components/session-progress-card-content.tsx:21 @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "context/services. Existing context-helper-alias and alias-setup mutant cover the base rule. This pair adds a function default shadowed by a provider accessor. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-04-default-accessor-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-04-default-accessor-mutant.tsx"
    ],
    "entry": "oc-04-default-accessor-mutant.tsx",
    "origin": "ui/src/lib/solid/presentation.ts:1–4; ui/src/components/session-progress-card-content.tsx:21 @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "STRICT_READ_UNTRACKED",
        "file": "oc-04-default-accessor-mutant.tsx",
        "at": [
          {
            "find": "read()"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-04-default-accessor",
      "edit": "Seeded reduction: A default context accessor is copied, not evaluated, by lookup. Compare parent source and notes."
    },
    "notes": "context/services. Existing context-helper-alias and alias-setup mutant cover the base rule. This pair adds a function default shadowed by a provider accessor. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-05-project-get-method",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-05-project-get-method.tsx"
    ],
    "entry": "oc-05-project-get-method.tsx",
    "origin": "ui/src/lib/reactive/context.ts:16–29,105–107; extensions/clawrouter/src/control-ui.tsx:26–49; D-128 platform-symbol rule",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "context/services. Synthetic seeded failure in a real service shape, not a reported OpenClaw get-method bug. Known project body avoids relying on unknown-failure info diagnostics. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-05-project-get-method-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-05-project-get-method-mutant.tsx"
    ],
    "entry": "oc-05-project-get-method-mutant.tsx",
    "origin": "ui/src/lib/reactive/context.ts:16–29,105–107; extensions/clawrouter/src/control-ui.tsx:26–49; D-128 platform-symbol rule",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "oc-05-project-get-method-mutant.tsx",
        "at": [
          {
            "find": "onClick={() =>"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-05-project-get-method",
      "edit": "Seeded reduction: A service get method is not intrinsic Map.get. Compare parent source and notes."
    },
    "notes": "context/services. Synthetic seeded failure in a real service shape, not a reported OpenClaw get-method bug. Known project body avoids relying on unknown-failure info diagnostics. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-06-promise-forks",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-06-promise-forks.tsx"
    ],
    "entry": "oc-06-promise-forks.tsx",
    "origin": "ui/src/pages/chat/components/chat-question-resource.tsx:185–199 @09e09dcdf71 (#180630)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "current slice. Existing kept-promise fixtures cover chains; this adds sibling branch isolation. Both transport and presentation need consumers when they may reject. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-06-promise-forks-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-06-promise-forks-mutant.tsx"
    ],
    "entry": "oc-06-promise-forks-mutant.tsx",
    "origin": "ui/src/pages/chat/components/chat-question-resource.tsx:185–199 @09e09dcdf71 (#180630)",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "oc-06-promise-forks-mutant.tsx",
        "at": [
          {
            "find": "onClick={() =>"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-06-promise-forks",
      "edit": "Seeded reduction: Catching the transport promise does not catch a derived rejection branch. Compare parent source and notes."
    },
    "notes": "current slice. Existing kept-promise fixtures cover chains; this adds sibling branch isolation. Both transport and presentation need consumers when they may reject. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-07-scoped-outcome",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-07-scoped-outcome.tsx"
    ],
    "entry": "oc-07-scoped-outcome.tsx",
    "origin": "ui/src/pages/question/question-page.tsx:51–62,202–211; ui/src/pages/chat/components/chat-question-resource.tsx:55,325–328 @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "current slice. A transport can resolve successfully yet carry an error field. Infer the explicit throw instead of treating all fulfilled promises as failure-free. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-07-scoped-outcome-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-07-scoped-outcome-mutant.tsx"
    ],
    "entry": "oc-07-scoped-outcome-mutant.tsx",
    "origin": "ui/src/pages/question/question-page.tsx:51–62,202–211; ui/src/pages/chat/components/chat-question-resource.tsx:55,325–328 @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "ERROR_OUTSIDE_ERRORED_BOUNDARY",
        "file": "oc-07-scoped-outcome-mutant.tsx",
        "at": [
          {
            "find": "props.value"
          }
        ],
        "related": [
          {
            "file": "oc-07-scoped-outcome-mutant.tsx",
            "at": [
              {
                "find": "value={read()}"
              }
            ]
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-07-scoped-outcome",
      "edit": "Seeded reduction: A fulfilled owner result can become a rendered failure. Compare parent source and notes."
    },
    "notes": "Gap 07: a fulfilled outcome does not reject; a separate memo throws on observation. Child Loading covers pending, removing child Errored exposes the failure."
  },
  {
    "id": "oc-08-lazy-unused-prop",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-08-lazy-unused-prop.tsx"
    ],
    "entry": "oc-08-lazy-unused-prop.tsx",
    "origin": "ui/src/plugins/control-ui-dashboard.tsx:168–176; ui/src/features/github-connections/github-identity-view.tsx:53–78; CONTEXT.md lazy-unconsumed rule",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "current slice. The primary location must be the child read; the caller expression is related, not another error. Child-boundary coverage already exists; non-consumption needs its own control. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-08-lazy-unused-prop-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-08-lazy-unused-prop-mutant.tsx"
    ],
    "entry": "oc-08-lazy-unused-prop-mutant.tsx",
    "origin": "ui/src/plugins/control-ui-dashboard.tsx:168–176; ui/src/features/github-connections/github-identity-view.tsx:53–78; CONTEXT.md lazy-unconsumed rule",
    "inSubset": true,
    "expected": [
      {
        "code": "ERROR_OUTSIDE_ERRORED_BOUNDARY",
        "file": "oc-08-lazy-unused-prop-mutant.tsx",
        "at": [
          {
            "find": "props.value"
          }
        ],
        "related": [
          {
            "file": "oc-08-lazy-unused-prop-mutant.tsx",
            "at": [
              {
                "find": "value={read()}"
              }
            ]
          },
          {
            "file": "oc-08-lazy-unused-prop-mutant.tsx",
            "at": [
              {
                "find": "render(App, document.body)"
              }
            ]
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-08-lazy-unused-prop",
      "edit": "Seeded reduction: A lazy prop expression has no read until a child consumes it. Compare parent source and notes."
    },
    "notes": "current slice. The primary location must be the child read; the caller expression is related, not another error. Child-boundary coverage already exists; non-consumption needs its own control. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-09-forwarded-pending-setup",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-09-forwarded-pending-setup.tsx"
    ],
    "entry": "oc-09-forwarded-pending-setup.tsx",
    "origin": "ui/src/features/github-connections/github-identity-view.tsx:54–78; ui/src/pages/model-setup/native-model-setup.tsx:79–81 @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "current slice. Setup is not repaired by an ancestor Loading. Existing pending-through-prop tests cover the base flow; this adds a plain formatting helper at the consuming read. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-09-forwarded-pending-setup-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-09-forwarded-pending-setup-mutant.tsx"
    ],
    "entry": "oc-09-forwarded-pending-setup-mutant.tsx",
    "origin": "ui/src/features/github-connections/github-identity-view.tsx:54–78; ui/src/pages/model-setup/native-model-setup.tsx:79–81 @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "PENDING_ASYNC_UNTRACKED_READ",
        "file": "oc-09-forwarded-pending-setup-mutant.tsx",
        "at": [
          {
            "find": "props.value"
          }
        ],
        "related": [
          {
            "file": "oc-09-forwarded-pending-setup-mutant.tsx",
            "at": [
              {
                "find": "value={read()}"
              }
            ]
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-09-forwarded-pending-setup",
      "edit": "Seeded reduction: A helper cannot turn a pending prop into a setup snapshot. Compare parent source and notes."
    },
    "notes": "current slice. Setup is not repaired by an ancestor Loading. Existing pending-through-prop tests cover the base flow; this adds a plain formatting helper at the consuming read. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-10-untrack-not-a-catch",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-10-untrack-not-a-catch.tsx"
    ],
    "entry": "oc-10-untrack-not-a-catch.tsx",
    "origin": "ui/src/components/select-picker-view.tsx:137; ui/src/lib/reactive/context.ts:25–29 @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "current slice. Seeded failure is synthetic. untrack exempts strict-read tracking requirements, not a project helper’s explicit throw. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-10-untrack-not-a-catch-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-10-untrack-not-a-catch-mutant.tsx"
    ],
    "entry": "oc-10-untrack-not-a-catch-mutant.tsx",
    "origin": "ui/src/components/select-picker-view.tsx:137; ui/src/lib/reactive/context.ts:25–29 @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "SETUP_MAY_THROW",
        "file": "oc-10-untrack-not-a-catch-mutant.tsx",
        "at": [
          {
            "find": "untrack(sample)"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-10-untrack-not-a-catch",
      "edit": "Seeded reduction: Intentional untracking does not promise failure-free setup. Compare parent source and notes."
    },
    "notes": "current slice. Seeded failure is synthetic. untrack exempts strict-read tracking requirements, not a project helper’s explicit throw. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-12-keyed-row-snapshot",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-12-keyed-row-snapshot.tsx"
    ],
    "entry": "oc-12-keyed-row-snapshot.tsx",
    "origin": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "current slice, judgment. JUDGMENT / SPEC GAP: literal SLICE says For row callbacks are tracking, so both variants currently expect no diagnostics. Runtime migration notes say callback setup snapshots are untracked. Proposed amendment: STRICT_READ_UNTRACKED error at row().label in the mutant. Do not score this as a checker miss before resolving the rule. Frozen for rc.17 under D-131; see results/openclaw-runtime.md."
  },
  {
    "id": "oc-12-keyed-row-snapshot-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-12-keyed-row-snapshot-mutant.tsx"
    ],
    "entry": "oc-12-keyed-row-snapshot-mutant.tsx",
    "origin": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "inSubset": true,
    "expected": [
      {
        "code": "STRICT_READ_UNTRACKED",
        "file": "oc-12-keyed-row-snapshot-mutant.tsx",
        "at": [
          {
            "find": "row().label"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-12-keyed-row-snapshot",
      "edit": "Seeded reduction: Key-function For row callback setup versus JSX. Compare parent source and notes."
    },
    "notes": "D-131: row setup is untracked; returned JSX is tracking. Runtime-verified on rc.17."
  },
  {
    "id": "oc-12-row-pending",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-12-row-pending.tsx"
    ],
    "entry": "oc-12-row-pending.tsx",
    "origin": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Gap 12; D-131 additional negative control. Ref ownership/cleanup is not checked here."
  },
  {
    "id": "oc-12-row-pending-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-12-row-pending-mutant.tsx"
    ],
    "entry": "oc-12-row-pending-mutant.tsx",
    "origin": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "inSubset": true,
    "expected": [
      {
        "code": "PENDING_ASYNC_UNTRACKED_READ",
        "file": "oc-12-row-pending-mutant.tsx",
        "at": [
          {
            "find": "read()"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-12-row-pending",
      "edit": "Move the tracked value read into the setup-like callback/body, leaving rendered JSX intact."
    },
    "notes": "Gap 12; D-131 additional mutant. Ref ownership/cleanup is not checked here."
  },
  {
    "id": "oc-12-row-held",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-12-row-held.tsx"
    ],
    "entry": "oc-12-row-held.tsx",
    "origin": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Gap 12; D-131 additional negative control. Ref ownership/cleanup is not checked here."
  },
  {
    "id": "oc-12-index-row",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-12-index-row.tsx"
    ],
    "entry": "oc-12-index-row.tsx",
    "origin": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Gap 12; D-131 additional negative control. Ref ownership/cleanup is not checked here."
  },
  {
    "id": "oc-12-index-row-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-12-index-row-mutant.tsx"
    ],
    "entry": "oc-12-index-row-mutant.tsx",
    "origin": "ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281",
    "inSubset": true,
    "expected": [
      {
        "code": "STRICT_READ_UNTRACKED",
        "file": "oc-12-index-row-mutant.tsx",
        "at": [
          {
            "find": "row()"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-12-index-row",
      "edit": "Move the tracked value read into the setup-like callback/body, leaving rendered JSX intact."
    },
    "notes": "Gap 12; D-131 additional mutant. Ref ownership/cleanup is not checked here."
  },
  {
    "id": "oc-23-ref-read",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-23-ref-read.tsx"
    ],
    "entry": "oc-23-ref-read.tsx",
    "origin": "GAPS.md gap 23 read-scope reduction; ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Gap 23; D-131 additional negative control. Ref ownership/cleanup is not checked here."
  },
  {
    "id": "oc-23-ref-read-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-23-ref-read-mutant.tsx"
    ],
    "entry": "oc-23-ref-read-mutant.tsx",
    "origin": "GAPS.md gap 23 read-scope reduction; ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453)",
    "inSubset": true,
    "expected": [
      {
        "code": "STRICT_READ_UNTRACKED",
        "file": "oc-23-ref-read-mutant.tsx",
        "at": [
          {
            "find": "element.title = value()"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-23-ref-read",
      "edit": "Move the tracked value read into the setup-like callback/body, leaving rendered JSX intact."
    },
    "notes": "Gap 23; D-131 additional mutant. Ref ownership/cleanup is not checked here."
  },
  {
    "id": "oc-23-ref-pending",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-23-ref-pending.tsx"
    ],
    "entry": "oc-23-ref-pending.tsx",
    "origin": "GAPS.md gap 23 read-scope reduction; ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Gap 23; D-131 additional negative control. Ref ownership/cleanup is not checked here."
  },
  {
    "id": "oc-23-ref-pending-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-23-ref-pending-mutant.tsx"
    ],
    "entry": "oc-23-ref-pending-mutant.tsx",
    "origin": "GAPS.md gap 23 read-scope reduction; ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453)",
    "inSubset": true,
    "expected": [
      {
        "code": "PENDING_ASYNC_UNTRACKED_READ",
        "file": "oc-23-ref-pending-mutant.tsx",
        "at": [
          {
            "find": "element.title = read()"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-23-ref-pending",
      "edit": "Move the tracked value read into the setup-like callback/body, leaving rendered JSX intact."
    },
    "notes": "Gap 23; D-131 additional mutant. Ref ownership/cleanup is not checked here."
  },
  {
    "id": "oc-04-default-without-provider",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-04-default-without-provider.tsx"
    ],
    "entry": "oc-04-default-without-provider.tsx",
    "origin": "ui/src/lib/solid/presentation.ts:1–4; ui/src/components/session-progress-card-content.tsx:21 @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Gap 04; D-131 additional negative control. Ref ownership/cleanup is not checked here."
  },
  {
    "id": "oc-01-translation-reader",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-01-translation-reader.tsx"
    ],
    "entry": "oc-01-translation-reader.tsx",
    "origin": "ui/src/lib/reactive/i18n.ts:26–43; ui/src/app/app-root.tsx:96–110 @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Gap 01; D-131 additional negative control. Ref ownership/cleanup is not checked here."
  },
  {
    "id": "oc-01-translation-reader-mutant",
    "group": "openclaw",
    "dir": "openclaw",
    "files": [
      "oc-01-translation-reader-mutant.tsx"
    ],
    "entry": "oc-01-translation-reader-mutant.tsx",
    "origin": "ui/src/lib/reactive/i18n.ts:26–43; ui/src/app/app-root.tsx:96–110 @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "STRICT_READ_UNTRACKED",
        "file": "oc-01-translation-reader-mutant.tsx",
        "at": [
          {
            "find": "language()"
          }
        ]
      },
      {
        "code": "STRICT_READ_UNTRACKED",
        "file": "oc-01-translation-reader-mutant.tsx",
        "at": [
          {
            "find": "count()"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw/oc-01-translation-reader",
      "edit": "Move the tracked value read into the setup-like callback/body, leaving rendered JSX intact."
    },
    "notes": "Gap 01; D-131 additional mutant. Ref ownership/cleanup is not checked here."
  }
];
