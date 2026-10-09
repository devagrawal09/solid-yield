const fs = require("node:fs");
const { join } = require("node:path");
// Ten recoverable review slots; three historically overlap as setup reads.
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
    code: "SETTLED_PROP",
    line: 7
  },
  {
    slot: "L05",
    file: "eager-jsx",
    code: "READ_IN_SETUP",
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
    code: "CREATE_OUTSIDE_SETUP",
    line: 3
  },
  {
    slot: "R08",
    file: "missing-context",
    code: "NO_PROVIDER",
    line: 5
  }
].map(c => ({
  ...c,
  source: fs.readFileSync(join(__dirname, "fixtures/mistakes", c.file + ".tsx"), "utf8")
}));
