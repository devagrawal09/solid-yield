const fs = require("node:fs");
const { join } = require("node:path");
// Ten recoverable review slots (three historically overlap as setup reads),
// then creations in an event and in an effect phase (found by a mutation probe:
// both reported only as GENERATED_TYPE before), and writes and creations in a
// flow control's or a component's prop and in a call in a hole (found by the
// create-in-hole operator: silent, or a generated LAZY_VIEW, before).
module.exports = [
  {
    slot: "T02",
    file: "setup-read",
    code: "READ_IN_SETUP",
    line: 4
  },
  {
    slot: "L02",
    file: "setup-label",
    code: "READ_IN_SETUP",
    line: 5
  },
  {
    slot: "R04",
    file: "setup-branch",
    code: "READ_IN_SETUP",
    line: 4
  },
  {
    slot: "T05",
    file: "effect-arity",
    code: "NATIVE_EFFECT_PHASES",
    line: 4
  },
  {
    slot: "T07",
    file: "pending-root",
    code: "PENDING_ROOT",
    line: 5
  },
  {
    slot: "T08",
    file: "colored-prop",
    // D-119: the pending value flows into the child; unhandled, it reports at its read
    code: "PENDING_ROOT",
    line: 8
  },
  {
    slot: "L05",
    file: "eager-jsx",
    // the hole is reactive in Solid; the element is built once, outside the view (D-041)
    code: "JSX_IN_SETUP",
    line: 4
  },
  {
    slot: "R05",
    file: "memo-write",
    code: "WRITE_IN_REACTIVE",
    line: 5
  },
  {
    slot: "R06",
    file: "hole-create",
    // The native state contract now reaches the authored creation in JSX.
    code: "CREATE_OUTSIDE_SETUP",
    line: 3
  },
  {
    slot: "R08",
    file: "missing-context",
    code: "NO_PROVIDER",
    line: 5
  },
  {
    slot: "C01",
    file: "event-create",
    code: "CREATE_OUTSIDE_SETUP",
    line: 5
  },
  {
    slot: "C02",
    file: "phase-create",
    code: "CREATE_OUTSIDE_SETUP",
    line: 7
  },
  {
    slot: "C03",
    file: "when-write",
    code: "WRITE_IN_REACTIVE",
    line: 5
  },
  {
    slot: "C04",
    file: "each-create",
    code: "CREATE_OUTSIDE_SETUP",
    line: 6
  },
  {
    slot: "C05",
    file: "prop-write",
    code: "WRITE_IN_REACTIVE",
    line: 7
  },
  {
    slot: "C06",
    file: "call-create",
    code: "CREATE_OUTSIDE_SETUP",
    line: 7
  },
  // D-124: found by the native surface check
  {
    slot: "C07",
    file: "phase-pending",
    code: "PENDING_IN_EFFECT",
    line: 7
  },
  {
    slot: "C08",
    file: "setup-write",
    code: "WRITE_IN_REACTIVE",
    line: 4
  },
  {
    slot: "C09",
    file: "spread-rejects",
    code: "EVENT_REJECTS",
    line: 4
  }
].map(c => ({
  ...c,
  source: fs.readFileSync(join(__dirname, "fixtures/mistakes", c.file + ".tsx"), "utf8")
}));
