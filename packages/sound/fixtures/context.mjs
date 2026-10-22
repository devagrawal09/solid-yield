// @ts-check
// Shared context/services expectations. No prototype-specific allowances.
/** @type {import("./schema.d.ts").Fixture[]} */
export const contextCases = [
  {
    "id": "context-plain-object",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-plain-object.tsx"
    ],
    "entry": "context-plain-object.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-default",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-default.tsx"
    ],
    "entry": "context-default.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-missing-provider",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-missing-provider.tsx"
    ],
    "entry": "context-missing-provider.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [
      {
        "code": "CONTEXT_PROVIDER_MISSING",
        "file": "context-missing-provider.tsx",
        "at": [
          {
            "find": "useContext(C)"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-provider-over-default",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-provider-over-default.tsx"
    ],
    "entry": "context-provider-over-default.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [
      {
        "code": "ERROR_OUTSIDE_ERRORED_BOUNDARY",
        "file": "context-provider-over-default.tsx",
        "at": [
          {
            "find": "s.read()"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-signal-view",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-signal-view.tsx"
    ],
    "entry": "context-signal-view.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-signal-setup",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-signal-setup.tsx"
    ],
    "entry": "context-signal-setup.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [
      {
        "code": "STRICT_READ_UNTRACKED",
        "file": "context-signal-setup.tsx",
        "at": [
          {
            "find": "s.count()"
          }
        ]
      }
    ],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-factory-memo",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-factory-memo.tsx"
    ],
    "entry": "context-factory-memo.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-helper-alias",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-helper-alias.tsx"
    ],
    "entry": "context-helper-alias.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-method-view",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-method-view.tsx"
    ],
    "entry": "context-method-view.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-method-setup",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-method-setup.tsx"
    ],
    "entry": "context-method-setup.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [
      {
        "code": "STRICT_READ_UNTRACKED",
        "file": "context-method-setup.tsx",
        "at": [
          {
            "find": "count()"
          }
        ]
      }
    ],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-async-covered",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-async-covered.tsx"
    ],
    "entry": "context-async-covered.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-async-uncovered",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-async-uncovered.tsx"
    ],
    "entry": "context-async-uncovered.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [
      {
        "code": "ASYNC_OUTSIDE_LOADING_BOUNDARY",
        "file": "context-async-uncovered.tsx",
        "at": [
          {
            "find": "s.value()"
          }
        ]
      }
    ],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-async-setup",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-async-setup.tsx"
    ],
    "entry": "context-async-setup.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [
      {
        "code": "PENDING_ASYNC_UNTRACKED_READ",
        "file": "context-async-setup.tsx",
        "at": [
          {
            "find": "s.value()"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-pending-handler",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-pending-handler.tsx"
    ],
    "entry": "context-pending-handler.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [
      {
        "code": "PENDING_ASYNC_IN_HANDLER",
        "file": "context-pending-handler.tsx",
        "at": [
          {
            "find": "s.value()"
          }
        ]
      }
    ],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-failing-memo-covered",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-failing-memo-covered.tsx"
    ],
    "entry": "context-failing-memo-covered.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-failing-handler",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-failing-handler.tsx"
    ],
    "entry": "context-failing-handler.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "context-failing-handler.tsx",
        "at": [
          {
            "find": "onClick"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-promise-caught",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-promise-caught.tsx"
    ],
    "entry": "context-promise-caught.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-promise-uncaught",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-promise-uncaught.tsx"
    ],
    "entry": "context-promise-uncaught.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "context-promise-uncaught.tsx",
        "at": [
          {
            "find": "onClick"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-optional-api-caught",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-optional-api-caught.tsx"
    ],
    "entry": "context-optional-api-caught.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-optional-api-uncaught",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-optional-api-uncaught.tsx"
    ],
    "entry": "context-optional-api-uncaught.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "context-optional-api-uncaught.tsx",
        "at": [
          {
            "find": "onClick"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-injected-sync",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-injected-sync.tsx"
    ],
    "entry": "context-injected-sync.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "context-injected-sync.tsx",
        "at": [
          {
            "find": "onClick"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-nested-shadow",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-nested-shadow.tsx"
    ],
    "entry": "context-nested-shadow.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-provider-identity",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-provider-identity.tsx"
    ],
    "entry": "context-provider-identity.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-module-escape",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-module-escape.tsx"
    ],
    "entry": "context-module-escape.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [
      {
        "code": "ERROR_OUTSIDE_ERRORED_BOUNDARY",
        "file": "context-module-escape.tsx",
        "at": [
          {
            "find": "escaped.read()"
          }
        ]
      }
    ],
    "expectedWarnings": [
      {
        "code": "UNANALYZED_BOUNDARY",
        "file": "context-module-escape.tsx",
        "at": [
          {
            "find": "escaped = s"
          }
        ]
      },
      {
        "code": "ASYNC_OUTSIDE_LOADING_BOUNDARY",
        "file": "context-module-escape.tsx",
        "at": [
          {
            "find": "escaped.read()"
          }
        ]
      }
    ],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-unknown-escape",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-unknown-escape.tsx"
    ],
    "entry": "context-unknown-escape.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [
      {
        "code": "ERROR_OUTSIDE_ERRORED_BOUNDARY",
        "file": "context-unknown-escape.tsx",
        "at": [
          {
            "find": "s.read()"
          }
        ]
      }
    ],
    "expectedWarnings": [
      {
        "code": "UNANALYZED_BOUNDARY",
        "file": "context-unknown-escape.tsx",
        "at": [
          {
            "find": "store(s)"
          }
        ]
      },
      {
        "code": "ASYNC_OUTSIDE_LOADING_BOUNDARY",
        "file": "context-unknown-escape.tsx",
        "at": [
          {
            "find": "s.read()"
          }
        ]
      }
    ],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-prop-child-boundaries",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-prop-child-boundaries.tsx"
    ],
    "entry": "context-prop-child-boundaries.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-prop-caller-boundaries",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-prop-caller-boundaries.tsx"
    ],
    "entry": "context-prop-caller-boundaries.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-prop-uncovered",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-prop-uncovered.tsx"
    ],
    "entry": "context-prop-uncovered.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [
      {
        "code": "ERROR_OUTSIDE_ERRORED_BOUNDARY",
        "file": "context-prop-uncovered.tsx",
        "at": [
          {
            "find": "p.value"
          }
        ],
        "related": [
          {
            "file": "context-prop-uncovered.tsx",
            "at": [
              {
                "find": "value={s.value()}"
              }
            ]
          }
        ]
      }
    ],
    "expectedWarnings": [
      {
        "code": "ASYNC_OUTSIDE_LOADING_BOUNDARY",
        "file": "context-prop-uncovered.tsx",
        "at": [
          {
            "find": "p.value"
          }
        ],
        "related": [
          {
            "file": "context-prop-uncovered.tsx",
            "at": [
              {
                "find": "value={s.value()}"
              }
            ]
          }
        ]
      }
    ],
    "legacyExpected": [],
    "legacyActual": []
  },
  {
    "id": "context-method-write-handler",
    "group": "cases",
    "dir": "cases",
    "files": [
      "context-method-write-handler.tsx"
    ],
    "entry": "context-method-write-handler.tsx",
    "origin": "solid-sound context/services specification (context-sources.mjs)",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": []
  }
];

/** @type {import("./schema.d.ts").Fixture[]} */
export const contextMutants = [
  {
    "id": "m-context-loading-removed",
    "group": "mutants",
    "dir": "mutants",
    "files": [
      "m-context-loading-removed.tsx"
    ],
    "entry": "m-context-loading-removed.tsx",
    "origin": "derived from cases/context-async-covered: <Loading fallback=\"wait\"><Child /></Loading> → <Child />",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [
      {
        "code": "ASYNC_OUTSIDE_LOADING_BOUNDARY",
        "file": "m-context-loading-removed.tsx",
        "at": [
          {
            "find": "s.value()"
          }
        ]
      }
    ],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "cases/context-async-covered",
      "edit": "<Loading fallback=\"wait\"><Child /></Loading> → <Child />"
    }
  },
  {
    "id": "m-context-errored-removed",
    "group": "mutants",
    "dir": "mutants",
    "files": [
      "m-context-errored-removed.tsx"
    ],
    "entry": "m-context-errored-removed.tsx",
    "origin": "derived from cases/context-failing-memo-covered: <Errored fallback={() => \"failed\"}><Child /></Errored> → <Child />",
    "inSubset": true,
    "expected": [
      {
        "code": "ERROR_OUTSIDE_ERRORED_BOUNDARY",
        "file": "m-context-errored-removed.tsx",
        "at": [
          {
            "find": "s.value()"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "cases/context-failing-memo-covered",
      "edit": "<Errored fallback={() => \"failed\"}><Child /></Errored> → <Child />"
    }
  },
  {
    "id": "m-context-catch-removed",
    "group": "mutants",
    "dir": "mutants",
    "files": [
      "m-context-catch-removed.tsx"
    ],
    "entry": "m-context-catch-removed.tsx",
    "origin": "derived from cases/context-promise-caught: try { await run(); } catch { console.log(\"handled\"); } → await run();",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "m-context-catch-removed.tsx",
        "at": [
          {
            "find": "onClick"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "cases/context-promise-caught",
      "edit": "try { await run(); } catch { console.log(\"handled\"); } → await run();"
    }
  },
  {
    "id": "m-context-optional-catch-removed",
    "group": "mutants",
    "dir": "mutants",
    "files": [
      "m-context-optional-catch-removed.tsx"
    ],
    "entry": "m-context-optional-catch-removed.tsx",
    "origin": "derived from cases/context-optional-api-caught: try { await s.save(); } catch { console.log(\"handled\"); } → await s.save();",
    "inSubset": true,
    "expected": [
      {
        "code": "UNHANDLED_HANDLER_FAILURE",
        "file": "m-context-optional-catch-removed.tsx",
        "at": [
          {
            "find": "onClick"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "cases/context-optional-api-caught",
      "edit": "try { await s.save(); } catch { console.log(\"handled\"); } → await s.save();"
    }
  },
  {
    "id": "m-context-provider-removed",
    "group": "mutants",
    "dir": "mutants",
    "files": [
      "m-context-provider-removed.tsx"
    ],
    "entry": "m-context-provider-removed.tsx",
    "origin": "derived from cases/context-plain-object: <C value={{ label: \"ready\" }}><Child /></C> → <Child />",
    "inSubset": true,
    "expected": [
      {
        "code": "CONTEXT_PROVIDER_MISSING",
        "file": "m-context-provider-removed.tsx",
        "at": [
          {
            "find": "useContext(C)"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "cases/context-plain-object",
      "edit": "<C value={{ label: \"ready\" }}><Child /></C> → <Child />"
    }
  },
  {
    "id": "m-context-default-removed",
    "group": "mutants",
    "dir": "mutants",
    "files": [
      "m-context-default-removed.tsx"
    ],
    "entry": "m-context-default-removed.tsx",
    "origin": "derived from cases/context-default: createContext({ label: \"default\" }) → createContext<{ label: string }>()",
    "inSubset": true,
    "expected": [
      {
        "code": "CONTEXT_PROVIDER_MISSING",
        "file": "m-context-default-removed.tsx",
        "at": [
          {
            "find": "useContext(C)"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "cases/context-default",
      "edit": "createContext({ label: \"default\" }) → createContext<{ label: string }>()"
    }
  },
  {
    "id": "m-context-shadow-removed",
    "group": "mutants",
    "dir": "mutants",
    "files": [
      "m-context-shadow-removed.tsx"
    ],
    "entry": "m-context-shadow-removed.tsx",
    "origin": "derived from cases/context-nested-shadow: <C value={{ value: inner }}><Child /></C> → <Child />",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [
      {
        "code": "ASYNC_OUTSIDE_LOADING_BOUNDARY",
        "file": "m-context-shadow-removed.tsx",
        "at": [
          {
            "find": "s.value()"
          }
        ]
      }
    ],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "cases/context-nested-shadow",
      "edit": "<C value={{ value: inner }}><Child /></C> → <Child />"
    }
  },
  {
    "id": "m-context-alias-setup",
    "group": "mutants",
    "dir": "mutants",
    "files": [
      "m-context-alias-setup.tsx"
    ],
    "entry": "m-context-alias-setup.tsx",
    "origin": "derived from cases/context-helper-alias: return <p>{again()}</p>; → const n = again(); return <p>{n}</p>;",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [
      {
        "code": "STRICT_READ_UNTRACKED",
        "file": "m-context-alias-setup.tsx",
        "at": [
          {
            "find": "again()"
          }
        ]
      }
    ],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "cases/context-helper-alias",
      "edit": "return <p>{again()}</p>; → const n = again(); return <p>{n}</p>;"
    }
  },
  {
    "id": "m-context-method-write-memo",
    "group": "mutants",
    "dir": "mutants",
    "files": [
      "m-context-method-write-memo.tsx"
    ],
    "entry": "m-context-method-write-memo.tsx",
    "origin": "derived from cases/context-method-write-handler: return <button onClick={s.set}>{s.count()}</button>; → const result = createMemo(() => s.set()); return <p>{result()}</p>;",
    "inSubset": true,
    "expected": [
      {
        "code": "REACTIVE_WRITE_IN_OWNED_SCOPE",
        "file": "m-context-method-write-memo.tsx",
        "at": [
          {
            "find": "setCount(1)"
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "cases/context-method-write-handler",
      "edit": "return <button onClick={s.set}>{s.count()}</button>; → const result = createMemo(() => s.set()); return <p>{result()}</p>;"
    }
  },
  {
    "id": "m-context-prop-child-loading-removed",
    "group": "mutants",
    "dir": "mutants",
    "files": [
      "m-context-prop-child-loading-removed.tsx"
    ],
    "entry": "m-context-prop-child-loading-removed.tsx",
    "origin": "derived from cases/context-prop-child-boundaries: <Loading fallback=\"wait\"><p>{p.value}</p></Loading> → <p>{p.value}</p>",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [
      {
        "code": "ASYNC_OUTSIDE_LOADING_BOUNDARY",
        "file": "m-context-prop-child-loading-removed.tsx",
        "at": [
          {
            "find": "p.value"
          }
        ],
        "related": [
          {
            "file": "m-context-prop-child-loading-removed.tsx",
            "at": [
              {
                "find": "value={s.value()}"
              }
            ]
          }
        ]
      }
    ],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "cases/context-prop-child-boundaries",
      "edit": "<Loading fallback=\"wait\"><p>{p.value}</p></Loading> → <p>{p.value}</p>"
    }
  },
  {
    "id": "m-context-prop-child-errored-removed",
    "group": "mutants",
    "dir": "mutants",
    "files": [
      "m-context-prop-child-errored-removed.tsx"
    ],
    "entry": "m-context-prop-child-errored-removed.tsx",
    "origin": "derived from cases/context-prop-child-boundaries: <Errored fallback={() => \"failed\"}><Loading fallback=\"wait\"><p>{p.value}</p></Loading></Errored> → <Loading fallback=\"wait\"><p>{p.value}</p></Loading>",
    "inSubset": true,
    "expected": [
      {
        "code": "ERROR_OUTSIDE_ERRORED_BOUNDARY",
        "file": "m-context-prop-child-errored-removed.tsx",
        "at": [
          {
            "find": "p.value"
          }
        ],
        "related": [
          {
            "file": "m-context-prop-child-errored-removed.tsx",
            "at": [
              {
                "find": "value={s.value()}"
              }
            ]
          }
        ]
      }
    ],
    "expectedWarnings": [],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "cases/context-prop-child-boundaries",
      "edit": "<Errored fallback={() => \"failed\"}><Loading fallback=\"wait\"><p>{p.value}</p></Loading></Errored> → <Loading fallback=\"wait\"><p>{p.value}</p></Loading>"
    }
  },
  {
    "id": "m-context-read-to-handler",
    "group": "mutants",
    "dir": "mutants",
    "files": [
      "m-context-read-to-handler.tsx"
    ],
    "entry": "m-context-read-to-handler.tsx",
    "origin": "derived from cases/context-async-covered: return <p>{s.value()}</p>; → return <button onClick={() => { s.value(); }}>read</button>;",
    "inSubset": true,
    "expected": [],
    "expectedWarnings": [
      {
        "code": "PENDING_ASYNC_IN_HANDLER",
        "file": "m-context-read-to-handler.tsx",
        "at": [
          {
            "find": "s.value()"
          }
        ]
      }
    ],
    "legacyExpected": [],
    "legacyActual": [],
    "mutation": {
      "parent": "cases/context-async-covered",
      "edit": "return <p>{s.value()}</p>; → return <button onClick={() => { s.value(); }}>read</button>;"
    }
  }
];
