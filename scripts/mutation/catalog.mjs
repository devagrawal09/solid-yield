// Sets are fixed before running. Generic TypeScript errors only count for await removal.
// A later correction names the code the checker documents for the case and says why
// (`corrected`); the report lists every correction.
export const catalog = {
  "delete-catch": {
    expected: ["FOREIGN_HANDOFF", "NATIVE_CALLBACK_FAILURE", "EVENT_REJECTS"],
    corrected:
      "EVENT_REJECTS added (2026-10-10): an event handler's unhandled failure is EVENT_REJECTS (sugar-design, unhandled rejections); NATIVE_CALLBACK_FAILURE is the foreign-callback code.",
    edit: "Remove one catch; retain try body and finally."
  },
  "swallow-catch": {
    expected: [],
    equivalent:
      "A catch may deliberately handle a failure. Removing a rethrow is permitted handling, not a checker error.",
    edit: "Remove each direct rethrow in a catch."
  },
  "delete-errored": {
    expected: ["FOREIGN_HANDOFF"],
    edit: "Remove Errored tags, retain children."
  },
  "delete-loading": { expected: ["PENDING_ROOT"], edit: "Remove Loading tags, retain children." },
  "setup-read": {
    expected: ["READ_IN_SETUP", "solid-yield/no-read-in-setup"],
    edit: "Hoist each signal/memo read from JSX or a memo to its enclosing component setup."
  },
  "delete-provider": {
    expected: ["NO_PROVIDER"],
    edit: "Remove a locally declared context provider, retain children."
  },
  "never-provided-context": {
    expected: ["NO_PROVIDER"],
    edit: "Replace each context argument with a fresh context."
  },
  "throw-string": {
    expected: [],
    equivalent:
      "Unknown thrown values are allowed by the unknown floor; changing the value is not itself an error. Handoff diagnostics are still recorded.",
    edit: "Replace each constructed class throw with a string."
  },
  "throw-object": {
    expected: [],
    equivalent:
      "Unknown thrown values are allowed by the unknown floor; changing the value is not itself an error. Handoff diagnostics are still recorded.",
    edit: "Replace each constructed class throw with an object."
  },
  "async-reject": {
    expected: ["FOREIGN_HANDOFF", "NATIVE_CALLBACK_FAILURE", "EVENT_REJECTS"],
    corrected:
      "EVENT_REJECTS added (2026-10-10): every site is an event handler, whose unhandled failure is EVENT_REJECTS; NATIVE_CALLBACK_FAILURE is the foreign-callback code.",
    edit: "Insert throw new Error after each await statement in an async JSX event callback."
  },
  "remove-await": {
    expected: ["TS2322", "TS2345", "TS2739", "TS2740", "TS2741", "GENERATED_TYPE", "SETTLED_PROP"],
    corrected:
      "TS2739, TS2740 and TS2741 added (2026-10-10): TypeScript's assignability error for missing properties (a Promise where its value was expected) is one of these, not TS2322.",
    edit: "Replace each await expression with its operand."
  },
  "memo-write": {
    expected: ["WRITE_IN_REACTIVE", "solid-yield/no-unyielded-write"],
    edit: "Insert a write to each visible signal setter in each memo callback."
  },
  "timer-read": {
    expected: [],
    equivalent:
      "A settled signal read in an ignored timer/listener callback is an allowed event read. Failure diagnostics remain recorded.",
    edit: "Insert a settled signal read in each setup-time timer/listener callback."
  },
  "non-core-cache": {
    expected: ["SUGAR_CALLBACK", "NATIVE_FOREIGN_BOUNDARY", "FOREIGN_HANDOFF", "READ_IN_SETUP"],
    edit: "Replace createMemo with an inline hand-rolled last-value cache."
  },
  "destructure-props": {
    expected: ["NATIVE_PROPS"],
    edit: "Destructure each directly read property in a component parameter; rewrite its references. Parameter snapshots are currently refused (setup snapshots are valid)."
  },
  "inline-component": {
    expected: ["NATIVE_COMPONENT", "SUGAR_CALLBACK", "SUGAR_RETURN", "FOREIGN_HANDOFF"],
    edit: "Define an inline copy at every JSX use of a local component, and use that copy at the edited site. Other callers and exports remain valid."
  },
  "effect-arity": {
    expected: ["NATIVE_EFFECT_PHASES", "TS2554"],
    edit: "Remove all but the compute argument (or the only argument)."
  },
  "remove-use-server": {
    expected: [],
    equivalent:
      "Removing a server directive changes transport behavior but remains a valid local function; no checker error is required.",
    edit: "Remove each use server directive."
  },
  "callback-throw": {
    expected: ["FOREIGN_HANDOFF"],
    edit: "Insert a conditional throw of a RangeError at the start of each array-method callback in a component's JSX hole or memo (F-S46: the callback's failure is its host's)."
  },
  "server-new-class": {
    expected: ["FOREIGN_HANDOFF"],
    edit: "Replace each server-function throw with an instance of a fresh local class."
  }
};
