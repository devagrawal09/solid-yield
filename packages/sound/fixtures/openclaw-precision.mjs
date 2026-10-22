// @ts-check
// D-133: intended requirements, never inferred from current prototype output.
/** @type {import("./schema.d.ts").Fixture[]} */
export const openclawPrecisionFixtures = [
  {
    "id": "op-loading-url",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-loading-url.tsx"
    ],
    "entry": "op-loading-url.tsx",
    "origin": "ui/src/components/plugin-theme-artwork.tsx:4–20 (E02) @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Loading.on is a reset key, not an event binding."
  },
  {
    "id": "op-loading-url-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-loading-url-mutant.tsx"
    ],
    "entry": "op-loading-url-mutant.tsx",
    "origin": "ui/src/components/plugin-theme-artwork.tsx:4–20 (E02) @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "op-loading-url-mutant.tsx",
        "at": [
          {
            "find": "onClick="
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw-precision/op-loading-url",
      "edit": "Add an actual throwing event handler; do not reinterpret the key as a handler."
    },
    "notes": "Loading.on is a reset key, not an event binding."
  },
  {
    "id": "op-loading-reactive-key",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-loading-reactive-key.tsx"
    ],
    "entry": "op-loading-reactive-key.tsx",
    "origin": "ui/src/components/plugin-theme-artwork.tsx:15 (E02) @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "A settled reactive reset input is not an untracked read. Promise values are read in Loading children, not inferred from the key."
  },
  {
    "id": "op-loading-reactive-key-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-loading-reactive-key-mutant.tsx"
    ],
    "entry": "op-loading-reactive-key-mutant.tsx",
    "origin": "ui/src/components/plugin-theme-artwork.tsx:15 (E02) @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "ASYNC_OUTSIDE_LOADING_BOUNDARY",
        "file": "op-loading-reactive-key-mutant.tsx",
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
      "parent": "openclaw-precision/op-loading-reactive-key",
      "edit": "Move the pending child outside Loading."
    },
    "notes": "A settled reactive reset input is not an untracked read. Promise values are read in Loading children, not inferred from the key."
  },
  {
    "id": "op-focus-repair",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-focus-repair.tsx"
    ],
    "entry": "op-focus-repair.tsx",
    "origin": "ui/src/components/config-form.node.shared.tsx:179–198 (E36; E38 companion) @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "The queued task only sees captured destinations. Earlier remove/destinations injection is not part of this callback."
  },
  {
    "id": "op-focus-repair-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-focus-repair-mutant.tsx"
    ],
    "entry": "op-focus-repair-mutant.tsx",
    "origin": "ui/src/components/config-form.node.shared.tsx:179–198 (E36; E38 companion) @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "op-focus-repair-mutant.tsx",
        "at": [
          {
            "find": "queueMicrotask("
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw-precision/op-focus-repair",
      "edit": "Replace the native eligibility predicate with an injected callback."
    },
    "notes": "The queued task only sees captured destinations. Earlier remove/destinations injection is not part of this callback."
  },
  {
    "id": "op-machine-class",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-machine-class.tsx"
    ],
    "entry": "op-machine-class.tsx",
    "origin": "ui/src/components/solid/menu-machine.ts:294–329 (E05, E08) @09e09dcdf71",
    "inSubset": false,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "A synchronous class subscription/start is not a pending Solid accessor. Unsupported class facts may warrant a warning, not a proven pending error."
  },
  {
    "id": "op-machine-class-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-machine-class-mutant.tsx"
    ],
    "entry": "op-machine-class-mutant.tsx",
    "origin": "ui/src/components/solid/menu-machine.ts:294–329 (E05, E08) @09e09dcdf71",
    "inSubset": false,
    "expected": [
      {
        "code": "PENDING_ASYNC_FORBIDDEN_SCOPE",
        "file": "op-machine-class-mutant.tsx",
        "at": [
          {
            "find": "pending()"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw-precision/op-machine-class",
      "edit": "Make class start read a real async memo; do not silence all class method calls."
    },
    "notes": "A synchronous class subscription/start is not a pending Solid accessor. Unsupported class facts may warrant a warning, not a proven pending error."
  },
  {
    "id": "op-machine-members",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-machine-members.tsx"
    ],
    "entry": "op-machine-members.tsx",
    "origin": "deps/@zag-js/menu/dist/menu.connect.mjs:27–42; deps/@zag-js/popper/dist/placement.mjs:10 (E11/E13/E15/E17/E19/E21/E23/E25/E27/E29/E31/E33/E35/E37/E39/E41) @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Authored minimal synchronous get/hasTag/computed model. Names alone do not mark Solid accessors; the mutant really reads a pending memo."
  },
  {
    "id": "op-machine-members-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-machine-members-mutant.tsx"
    ],
    "entry": "op-machine-members-mutant.tsx",
    "origin": "deps/@zag-js/menu/dist/menu.connect.mjs:27–42; deps/@zag-js/popper/dist/placement.mjs:10 (E11/E13/E15/E17/E19/E21/E23/E25/E27/E29/E31/E33/E35/E37/E39/E41) @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "PENDING_ASYNC_FORBIDDEN_SCOPE",
        "file": "op-machine-members-mutant.tsx",
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
      "parent": "openclaw-precision/op-machine-members",
      "edit": "Change the get implementation to read an async memo."
    },
    "notes": "Authored minimal synchronous get/hasTag/computed model. Names alone do not mark Solid accessors; the mutant really reads a pending memo."
  },
  {
    "id": "op-held-callback",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-held-callback.tsx"
    ],
    "entry": "op-held-callback.tsx",
    "origin": "ui/src/components/multi-select.tsx:36,220,250,279 (E24/E28/E30 safe-body control) @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Known safe held callbacks keep their bodies through two forwarding steps; a real throwing callback must not be silenced."
  },
  {
    "id": "op-held-callback-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-held-callback-mutant.tsx"
    ],
    "entry": "op-held-callback-mutant.tsx",
    "origin": "ui/src/components/multi-select.tsx:36,220,250,279 (E24/E28/E30 safe-body control) @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "op-held-callback-mutant.tsx",
        "at": [
          {
            "find": "onClick="
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw-precision/op-held-callback",
      "edit": "Make the known callback throw."
    },
    "notes": "Known safe held callbacks keep their bodies through two forwarding steps; a real throwing callback must not be silenced."
  },
  {
    "id": "op-held-ref",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-held-ref.tsx"
    ],
    "entry": "op-held-ref.tsx",
    "origin": "ui/src/components/config-form.node.shared.tsx:108 (E34 safe-body control); ui/src/components/native-chrome-setup.tsx:93 (S01) @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Forwarded known node capture is safe. Unknown or throwing ref callbacks are not made safe by the ref exemption."
  },
  {
    "id": "op-held-ref-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-held-ref-mutant.tsx"
    ],
    "entry": "op-held-ref-mutant.tsx",
    "origin": "ui/src/components/config-form.node.shared.tsx:108 (E34 safe-body control); ui/src/components/native-chrome-setup.tsx:93 (S01) @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "op-held-ref-mutant.tsx",
        "at": [
          {
            "find": "ref="
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw-precision/op-held-ref",
      "edit": "Make the supplied ref callback throw instead of capturing."
    },
    "notes": "Forwarded known node capture is safe. Unknown or throwing ref callbacks are not made safe by the ref exemption."
  },
  {
    "id": "op-native-listener",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-native-listener.tsx"
    ],
    "entry": "op-native-listener.tsx",
    "origin": "ui/src/lib/reactive/listener.ts:26 (E18, unsure; recommendation 4) @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Valid native EventTarget teardown keeps receiver identity. An injected removeEventListener lookalike has no safe body."
  },
  {
    "id": "op-native-listener-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-native-listener-mutant.tsx"
    ],
    "entry": "op-native-listener-mutant.tsx",
    "origin": "ui/src/lib/reactive/listener.ts:26 (E18, unsure; recommendation 4) @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "op-native-listener-mutant.tsx",
        "at": [
          {
            "find": "onClick="
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw-precision/op-native-listener",
      "edit": "Use an injected lookalike target instead of document."
    },
    "notes": "Valid native EventTarget teardown keeps receiver identity. An injected removeEventListener lookalike has no safe body."
  },
  {
    "id": "op-set-add",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-set-add.tsx"
    ],
    "entry": "op-set-add.tsx",
    "origin": "ui/src/components/overlay-lifecycle.ts:610 (E04, unsure; recommendation 4) @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "A native Set.add with valid arguments is not an unknown injected add method."
  },
  {
    "id": "op-set-add-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-set-add-mutant.tsx"
    ],
    "entry": "op-set-add-mutant.tsx",
    "origin": "ui/src/components/overlay-lifecycle.ts:610 (E04, unsure; recommendation 4) @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "op-set-add-mutant.tsx",
        "at": [
          {
            "find": "onClick="
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw-precision/op-set-add",
      "edit": "Allow an injected add method."
    },
    "notes": "A native Set.add with valid arguments is not an unknown injected add method."
  },
  {
    "id": "op-dependency-machine",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-dependency-machine.tsx",
      "node_modules/@precision/machine/dist/diagnostic-probe.tsx"
    ],
    "entry": "op-dependency-machine.tsx",
    "origin": "deps/@zag-js/menu/dist/menu.connect.mjs:27–42 (E11/E13/E15/E17/E19/E21/E23/E25/E27/E29/E31/E33/E37/E39/E41) @09e09dcdf71",
    "inSubset": false,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Installed dist is not authored source. The declaration supplies no failure guarantee: catch at the app call site; never report inside the package. An extra installed checked-root probe forces the boundary to be tested even when package resolution already selects declarations. The app never imports/renders that component."
  },
  {
    "id": "op-dependency-machine-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-dependency-machine-mutant.tsx",
      "node_modules/@precision/machine/dist/diagnostic-probe.tsx"
    ],
    "entry": "op-dependency-machine-mutant.tsx",
    "origin": "deps/@zag-js/menu/dist/menu.connect.mjs:27–42 (E11/E13/E15/E17/E19/E21/E23/E25/E27/E29/E31/E33/E37/E39/E41) @09e09dcdf71",
    "inSubset": false,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "op-dependency-machine-mutant.tsx",
        "at": [
          {
            "find": "onClick="
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw-precision/op-dependency-machine",
      "edit": "Remove the app-side catch; dependency declarations do not prove calls safe."
    },
    "notes": "Installed dist is not authored source. The declaration supplies no failure guarantee: catch at the app call site; never report inside the package. An extra installed checked-root probe forces the boundary to be tested even when package resolution already selects declarations. The app never imports/renders that component."
  },
  {
    "id": "op-dependency-string",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-dependency-string.tsx"
    ],
    "entry": "op-dependency-string.tsx",
    "origin": "deps/@zag-js/popper/dist/placement.mjs:10 (E35) @09e09dcdf71",
    "inSubset": false,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "Installed string-processing implementation is not app source. Catch unknown failure at the declared API call, not inside dist."
  },
  {
    "id": "op-dependency-string-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-dependency-string-mutant.tsx"
    ],
    "entry": "op-dependency-string-mutant.tsx",
    "origin": "deps/@zag-js/popper/dist/placement.mjs:10 (E35) @09e09dcdf71",
    "inSubset": false,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "op-dependency-string-mutant.tsx",
        "at": [
          {
            "find": "onClick="
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw-precision/op-dependency-string",
      "edit": "Remove the catch around a dependency call."
    },
    "notes": "Installed string-processing implementation is not app source. Catch unknown failure at the declared API call, not inside dist."
  },
  {
    "id": "op-e24-remove",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-e24-remove.tsx"
    ],
    "entry": "op-e24-remove.tsx",
    "origin": "ui/src/components/multi-select.tsx:36,220 (E24) @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information."
  },
  {
    "id": "op-e24-remove-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-e24-remove-mutant.tsx"
    ],
    "entry": "op-e24-remove-mutant.tsx",
    "origin": "ui/src/components/multi-select.tsx:36,220 (E24) @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "op-e24-remove-mutant.tsx",
        "at": [
          {
            "find": "onClick="
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw-precision/op-e24-remove",
      "edit": "Replace the known safe callback body with an injected declaration; keep the no-op fallback."
    },
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information."
  },
  {
    "id": "op-e28-keydown",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-e28-keydown.tsx"
    ],
    "entry": "op-e28-keydown.tsx",
    "origin": "ui/src/components/multi-select.tsx:36,250 (E28) @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information."
  },
  {
    "id": "op-e28-keydown-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-e28-keydown-mutant.tsx"
    ],
    "entry": "op-e28-keydown-mutant.tsx",
    "origin": "ui/src/components/multi-select.tsx:36,250 (E28) @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "op-e28-keydown-mutant.tsx",
        "at": [
          {
            "find": "onKeyDown="
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw-precision/op-e28-keydown",
      "edit": "Replace the known safe callback body with an injected declaration; keep the no-op fallback."
    },
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information."
  },
  {
    "id": "op-e30-select",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-e30-select.tsx"
    ],
    "entry": "op-e30-select.tsx",
    "origin": "ui/src/components/multi-select.tsx:36,279 (E30) @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information."
  },
  {
    "id": "op-e30-select-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-e30-select-mutant.tsx"
    ],
    "entry": "op-e30-select-mutant.tsx",
    "origin": "ui/src/components/multi-select.tsx:36,279 (E30) @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "op-e30-select-mutant.tsx",
        "at": [
          {
            "find": "onClick="
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw-precision/op-e30-select",
      "edit": "Replace the known safe callback body with an injected declaration; keep the no-op fallback."
    },
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information."
  },
  {
    "id": "op-e40-reselect",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-e40-reselect.tsx"
    ],
    "entry": "op-e40-reselect.tsx",
    "origin": "ui/src/components/solid/settings-ui.tsx:459–474 (E40) @09e09dcdf71",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information."
  },
  {
    "id": "op-e40-reselect-mutant",
    "group": "openclaw-precision",
    "dir": "openclaw-precision",
    "files": [
      "op-e40-reselect-mutant.tsx"
    ],
    "entry": "op-e40-reselect-mutant.tsx",
    "origin": "ui/src/components/solid/settings-ui.tsx:459–474 (E40) @09e09dcdf71",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "op-e40-reselect-mutant.tsx",
        "at": [
          {
            "find": "onClick="
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "expectedInfo": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "openclaw-precision/op-e40-reselect",
      "edit": "Replace the known safe callback body with an injected declaration; keep the no-op fallback."
    },
    "notes": "D-133 keeps D-129 strict. A no-op default does not remove the unknown injected override. The safe-body control is closed-world; the mutant supplies a function with no failure information."
  }
];
