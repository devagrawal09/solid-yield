// @ts-check
// The shared fixture registry. See schema.d.ts for the shape and SLICE.md for
// the rules the expectations follow. Cases are copied byte-identically from
// their origins (origins.mjs, extract.mjs); the Equipment Checkout sources are
// byte-identical copies of the reference app; mutants are derived negatives.
//
// "expected" is the SLICE expectation in solid-sound codes; "legacyActual" is
// what today's checker reports (legacy-actual.json, measured by legacy-run.mjs).
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ORIGINS } from "./origins.mjs";
import { contextCases, contextMutants } from "./context.mjs";
import { BY_CODE } from "../src/codes.mjs";

/** @typedef {import("./schema.d.ts").Fixture} Fixture */
/** @typedef {import("./schema.d.ts").Expectation} Expectation */
/** @typedef {import("./schema.d.ts").Anchor} Anchor */
/** @typedef {import("./schema.d.ts").LegacyDiagnostic} LegacyDiagnostic */

export const fixturesDir = dirname(fileURLToPath(import.meta.url));

/** @type {{ cases: Record<string, { diagnostics: LegacyDiagnostic[] }>, equipment: { diagnostics: LegacyDiagnostic[] } }} */
const legacy = JSON.parse(readFileSync(resolve(fixturesDir, "legacy-actual.json"), "utf8"));

/** @param {string} find @param {number} [occurrence] @returns {Anchor} */
const f = (find, occurrence) => (occurrence === undefined ? { find } : { find, occurrence });
/** @param {number} line @returns {Anchor} */
const l = line => ({ line });
/** A root in another file where a type-based checker can only report: counted as an imprecise hit. @param {string} file @param {string} find @returns {Anchor} */
const root = (file, find) => ({ find, file, imprecise: true });
/** The same, in the fixture's own file. @param {string} find @returns {Anchor} */
const atRoot = find => ({ find, imprecise: true });
/** @param {string} code @param {string} file @param {Anchor[]} at @param {{ minCount?: number, note?: string }} [more] @returns {Expectation} */
const x = (code, file, at, more) => ({ code, file, at, ...more });

const STRICT = "STRICT_READ_UNTRACKED";
const PENDING_UNTRACKED = "PENDING_ASYNC_UNTRACKED_READ";
const LOADING = "ASYNC_OUTSIDE_LOADING_BOUNDARY";
const WRITE = "REACTIVE_WRITE_IN_OWNED_SCOPE";
const ERRORED = "ERROR_OUTSIDE_ERRORED_BOUNDARY";
const HANDLER = "UNHANDLED_HANDLER_FAILURE";
const SETUP_THROW = "SETUP_MAY_THROW";
const WARN = "UNANALYZED_BOUNDARY";
const EXPORTED = "COMPONENT_OBLIGATIONS_EXPORTED";

/** Preserve every obligation at its static table severity (D-130).
 * @param {Expectation[]} [expected]
 * @param {Expectation[]} [warnings]
 */
function levels(expected = [], warnings = []) {
  return {
    expected: expected.filter(e => BY_CODE[e.code].severity === "error"),
    expectedWarnings: [...warnings, ...expected.filter(e => BY_CODE[e.code].severity === "warn")]
  };
}

/**
 * @param {string} id
 * @param {{ legacyExpected?: string[], expected?: Expectation[], warnings?: Expectation[], info?: Expectation[], inSubset?: boolean, entry?: boolean, notes?: string }} spec
 * @returns {Fixture}
 */
function kase(id, spec) {
  const origin = ORIGINS.find(o => o.id === id);
  if (!origin) throw new Error(`no origin for case ${id}`);
  const file = `${id}.tsx`;
  return {
    id,
    group: "cases",
    dir: "cases",
    files: [file],
    entry: spec.entry ? file : undefined,
    origin: origin.kind === "script" ? `${origin.file} #${origin.id}` : `${origin.file} ${origin.table}[${origin.row}]`,
    inSubset: spec.inSubset ?? true,
    ...levels(spec.expected, spec.warnings),
    expectedInfo: spec.info,
    legacyExpected: spec.legacyExpected ?? [],
    legacyActual: legacy.cases[id]?.diagnostics ?? [],
    notes: spec.notes
  };
}

const C = "cases";
void C;

/** @type {Fixture[]} */
export const cases = [
  ...contextCases,
  // ---- signals / memos / props --------------------------------------------
  kase("counter", { legacyExpected: [] }),
  kase("props", { legacyExpected: [] }),
  kase("inline-event", { legacyExpected: [] }),
  kase("named-event", { legacyExpected: [] }),
  kase("catch", { legacyExpected: [] }),
  kase("callback-read", { legacyExpected: [], notes: "a sync array callback inside a memo reads in the memo's tracking scope" }),
  kase("setup-read", { legacyExpected: ["READ_IN_SETUP"], expected: [x(STRICT, "setup-read.tsx", [f("count()", 1)])] }),
  kase("return-ternary", { legacyExpected: ["READ_IN_SETUP"], expected: [x(STRICT, "return-ternary.tsx", [f("n()", 1)])] }),
  kase("return-and", { legacyExpected: ["READ_IN_SETUP"], expected: [x(STRICT, "return-and.tsx", [f("n()", 1)])] }),
  kase("return-null", { legacyExpected: [] }),
  kase("named-callback-in-setup", {
    legacyExpected: ["READ_IN_SETUP"],
    expected: [x(STRICT, "named-callback-in-setup.tsx", [f("n()", 1), f("map(scale)"), f("[1, 2].map(scale)")], { note: "the read inside scale, called from setup through map; either the read or the call" })]
  }),
  kase("array-callback-in-setup", {
    legacyExpected: ["READ_IN_SETUP"],
    expected: [x(STRICT, "array-callback-in-setup.tsx", [f("items().filter"), f("n())")], { note: "items() and n() are both setup reads on line 6; one expectation covers both" })]
  }),
  kase("getter-read-in-setup", {
    legacyExpected: ["READ_IN_SETUP"],
    expected: [x(STRICT, "getter-read-in-setup.tsx", [f("o.double"), f("n() * 2")], { note: "an object getter is a sync helper; reading it in setup is a setup read" })]
  }),
  kase("memo-write", { legacyExpected: ["WRITE_IN_REACTIVE"], expected: [x(WRITE, "memo-write.tsx", [f("set(1)")])] }),
  kase("untrack-in-every-host", { legacyExpected: [] }),
  kase("reader-helpers", { legacyExpected: [], notes: "a higher-order helper returns a closure; calling scaled(3)(n) in setup reads nothing" }),
  kase("props-interface-live", { legacyExpected: [], notes: "reactive values passed into plain-typed props, read in the child's JSX" }),
  kase("props-accessor-callers", { legacyExpected: [], notes: "function-typed props given getters; called in the child's JSX" }),
  kase("callback-prop-forwarded", { legacyExpected: [], notes: "callback props forwarded through a middle component; every caller's handler never fails" }),
  kase("recursion-failing-prop", { legacyExpected: [], entry: true, notes: "a recursive component under Errored with a failing memo in its children" }),
  // ---- async + pending -----------------------------------------------------
  kase("async-memo-reads", { legacyExpected: [] }),
  kase("async-memo-nested-function", { legacyExpected: [], entry: true }),
  kase("async-event-reads", { legacyExpected: [], notes: "an async helper called from a handler reads signals; handler scope" }),
  kase("async-read", {
    legacyExpected: [],
    info: [x(EXPORTED, "async-read.tsx", [f("Counter")])],
    notes: "an async memo read in JSX of an exported, never-rendered component: pending travels with the component (info only)"
  }),
  kase("colored-prop", {
    legacyExpected: [],
    info: [x(EXPORTED, "colored-prop.tsx", [f("App()")])],
    notes: "a pending value flows through a plain-typed prop into Child (D-119); App is exported and never rendered"
  }),
  kase("promise-catch", { legacyExpected: [], info: [x(EXPORTED, "promise-catch.tsx", [f("App()")])], notes: "a memo returning a caught promise is an async source" }),
  kase("pending-root", {
    legacyExpected: ["PENDING_ROOT"],
    entry: true,
    expected: [x(LOADING, "pending-root.tsx", [f("{n()}"), atRoot("render(App")], { note: "at the read, with the root as a related location; the root is accepted as an imprecise location" })]
  }),
  kase("iife-pending-root", {
    legacyExpected: ["PENDING_ROOT"],
    entry: true,
    expected: [x(LOADING, "iife-pending-root.tsx", [f("p() * 2"), f("(() => p() * 2)()"), atRoot("render(App")])]
  }),
  kase("async-setup-reads", {
    legacyExpected: ["NATIVE_ASYNC_SETUP"],
    expected: [x(STRICT, "async-setup-reads.tsx", [f("return n()"), f("load()", 2)], { note: "the read inside the async helper called from setup, or the call" })]
  }),
  kase("native-latest-pending", {
    legacyExpected: [],
    inSubset: false,
    warnings: [x(WARN, "native-latest-pending.tsx", [f("latest(n)"), f("isPending(n)")])],
    notes: "latest / isPending are not modeled; worst case flows into an exported component (info only)"
  }),
  kase("native-for-indexed", { legacyExpected: [], notes: "For with keyed={false}: the row callback's item is an accessor read in a tracking scope" }),
  // ---- failures ------------------------------------------------------------
  kase("throw-error", { legacyExpected: [], expected: [x(HANDLER, "throw-error.tsx", [f("onClick")])] }),
  kase("promise-event", { legacyExpected: [], expected: [x(HANDLER, "promise-event.tsx", [f("onClick")])], notes: "a handler returning a rejecting promise" }),
  kase("handled-catch", { legacyExpected: [] }),
  kase("rethrow-catch", { legacyExpected: [], info: [x(EXPORTED, "rethrow-catch.tsx", [f("App()")])], notes: "a rethrowing catch keeps the memo failing; exported, never rendered" }),
  kase("unknown-rethrow-catch", { legacyExpected: [], info: [x(EXPORTED, "unknown-rethrow-catch.tsx", [f("App()")])] }),
  kase("finally-nested-function", { legacyExpected: [], notes: "JSON.parse inside try/catch; a nested function in finally" }),
  kase("plain-callback-throw-under-errored", { legacyExpected: [], entry: true }),
  kase("plain-callback-throw-in-memo", {
    legacyExpected: ["FOREIGN_HANDOFF"],
    entry: true,
    expected: [x(ERRORED, "plain-callback-throw-in-memo.tsx", [f("{total()}"), f("throw new RangeError"), atRoot("render(App")])]
  }),
  kase("effect-reads-failing-memo-at-root", {
    legacyExpected: ["FOREIGN_HANDOFF"],
    entry: true,
    expected: [x(ERRORED, "effect-reads-failing-memo-at-root.tsx", [f("() => checked()"), f("throw new RangeError"), atRoot("render(")], { note: "an effect's compute reads a failing memo; the failure reaches the root" })]
  }),
  kase("foreign-route-failure", {
    legacyExpected: ["FOREIGN_HANDOFF"],
    expected: [x(ERRORED, "foreign-route-failure.tsx", [f("{n()}"), f("throw new Error"), atRoot("component:Page")], { note: "the component is handed off as a value: a root" })]
  }),
  kase("setup-promise-caught", { legacyExpected: [], notes: "a promise continuation in setup is a handler-like scope; its chain catches" }),
  kase("setup-promise-rejects", {
    legacyExpected: ["NATIVE_SETUP_FAILURE"],
    expected: [x(SETUP_THROW, "setup-promise-rejects.tsx", [f("risk().then"), f("throw new Bad()")], { note: "a dropped rejecting promise in setup" })]
  }),
  kase("callback-prop-throws", {
    legacyExpected: ["EVENT_REJECTS"],
    expected: [x(HANDLER, "callback-prop-throws.tsx", [f("onClick"), f("onBump={")], { note: "the caller's handler throws RangeError through the callback prop" })]
  }),
  kase("callback-prop-unseen", {
    legacyExpected: ["EVENT_REJECTS", "EVENT_REJECTS"],
    inSubset: false,
    expected: [x(HANDLER, "callback-prop-unseen.tsx", [f("onClick", 1)], { note: "Spread's onBump comes from a spread: unknown" }), x(HANDLER, "callback-prop-unseen.tsx", [f("onClick", 2)], { note: "Handed is exported in a registry: unknown" })],
    warnings: [x(WARN, "callback-prop-unseen.tsx", [f("{...rest}")])]
  }),
  kase("async-handler-destructured-uncaught", {
    legacyExpected: ["EVENT_REJECTS"],
    expected: [x(HANDLER, "async-handler-destructured-uncaught.tsx", [f("onClick")], { note: "Errored does not catch a handler's rejection" })]
  }),
  kase("kept-promise-rejects-at-its-await", {
    legacyExpected: ["EVENT_REJECTS"],
    expected: [x(HANDLER, "kept-promise-rejects-at-its-await.tsx", [f("onClick")], { note: "fetch's rejection, awaited with no catch" })]
  }),
  kase("kept-promise-caught-by-its-chain", { legacyExpected: [], notes: "fetch's rejection caught by .catch on the chain" }),
  kase("timer-callback-failure", {
    legacyExpected: ["NATIVE_CALLBACK_FAILURE"],
    expected: [x(HANDLER, "timer-callback-failure.tsx", [f("setTimeout("), f("risk()", 2)], { note: "a timer callback is handler-like; risk() has no body: unknown" })]
  }),
  // ---- out of subset: warn + worst case -------------------------------------
  kase("native-optimistic-store-basic", {
    legacyExpected: [],
    inSubset: false,
    warnings: [x(WARN, "native-optimistic-store-basic.tsx", [f("createOptimisticStore({n:1})")])],
    expected: [x(HANDLER, "native-optimistic-store-basic.tsx", [f("onClick")], { note: "the store setter comes from an unanalyzed construct: worst case, possibly failing" })],
    notes: "stores are outside the slice; the component is exported, so its worst-case pending view is info only"
  }),
  kase("event-updater", {
    legacyExpected: [],
    inSubset: false,
    warnings: [x(WARN, "event-updater.tsx", [f("createStore({n:0})")])],
    expected: [x(HANDLER, "event-updater.tsx", [f("onClick")], { note: "write() is a store setter from an unanalyzed construct: worst case" })]
  }),
  kase("ref-event-reads", {
    legacyExpected: [],
    inSubset: false,
    warnings: [x(WARN, "ref-event-reads.tsx", [f("ref={")])],
    notes: "ref callbacks are not modeled as a construct; the callback body is handler-like (its reads are fine, its setter calls never fail)"
  })
];

const EQ = "src/components/";
/** @type {Fixture} */
export const equipment = {
  id: "equipment-checkout",
  group: "equipment",
  dir: "equipment",
  files: [
    "src/api.ts", "src/App.tsx", "src/main.tsx", "src/model.ts", "src/service.ts",
    `${EQ}CreateForm.tsx`, `${EQ}Detail.tsx`, `${EQ}EquipmentRow.tsx`, `${EQ}FailureControls.tsx`, `${EQ}Inventory.tsx`,
    "env.d.ts"
  ],
  entry: "src/main.tsx",
  origin: "Equipment Checkout app src/ (read-only reference), byte-identical; env.d.ts is the harness's CSS module shim",
  inSubset: true,
  expected: [
    x(HANDLER, `${EQ}EquipmentRow.tsx`, [f("onClick={edit}")], { note: "edit reads item(), derived from the possibly failing async list memo; Loading/Errored do not catch handlers" }),
    x(HANDLER, `${EQ}EquipmentRow.tsx`, [f("onChange={changeStatus}")], { note: "the item()?.status read precedes try/finally and can throw; service.status itself catches through commit" }),
    x(HANDLER, `${EQ}FailureControls.tsx`, [l(9)], { minCount: 8, note: "the optional injected EquipmentApi supplies plain functions without failure information" })
  ],
  expectedWarnings: [
    x("PENDING_ASYNC_IN_HANDLER", `${EQ}EquipmentRow.tsx`, [f("item()", 1)], { note: "edit reads a possibly uninitialized async-derived memo" }),
    x("PENDING_ASYNC_IN_HANDLER", `${EQ}EquipmentRow.tsx`, [f("item()?.status")], { note: "changeStatus reads the same pending memo before awaiting the handled mutation" })
  ],
  legacyExpected: ["EVENT_REJECTS × 10 (2 in EquipmentRow, 8 in FailureControls)"],
  legacyActual: legacy.equipment.diagnostics,
  notes: "See equipment/EXPECTATION.md for the line-by-line derivation and the differences from today's checker."
};

/**
 * @param {string} id
 * @param {{ parent: string, edit: string, file?: string, expected: Expectation[], entry?: boolean, inSubset?: boolean, warnings?: Expectation[], notes?: string }} spec
 * @returns {Fixture}
 */
function mutant(id, spec) {
  const file = spec.file ?? `${id}.tsx`;
  return {
    id,
    group: "mutants",
    dir: "mutants",
    files: [file],
    entry: spec.entry ? file : undefined,
    origin: `derived from ${spec.parent}: ${spec.edit}`,
    inSubset: spec.inSubset ?? true,
    ...levels(spec.expected, spec.warnings),
    legacyExpected: [],
    legacyActual: [],
    mutation: { parent: spec.parent, edit: spec.edit },
    notes: spec.notes
  };
}

/** @type {Fixture[]} */
export const mutants = [
  ...contextMutants,
  mutant("m-loading-removed", {
    parent: "cases/async-memo-nested-function", edit: "removed the <Loading> around {m()}", entry: true,
    expected: [x(LOADING, "m-loading-removed.tsx", [f("{m()}"), atRoot("render(App")])]
  }),
  mutant("m-errored-removed", {
    parent: "cases/plain-callback-throw-under-errored", edit: "removed the <Errored> around the Loading", entry: true,
    expected: [
      x(ERRORED, "m-errored-removed.tsx", [f("{total()}"), f("throw new RangeError"), atRoot("render(App")]),
      x(ERRORED, "m-errored-removed.tsx", [f("JSON.parse(String(x))"), atRoot("render(App")], { note: "the second failing read the removed Errored covered" })
    ]
  }),
  mutant("m-catch-removed", {
    parent: "cases/kept-promise-caught-by-its-chain", edit: "removed .catch(() => 0) from the awaited chain",
    expected: [x(HANDLER, "m-catch-removed.tsx", [f("onClick")])]
  }),
  mutant("m-read-moved-to-setup", {
    parent: "cases/counter", edit: "moved count() out of the memo into the setup body (const c = count(); createMemo(() => c * 2))",
    expected: [x(STRICT, "m-read-moved-to-setup.tsx", [f("count()", 1)])]
  }),
  mutant("m-write-in-memo", {
    parent: "cases/counter", edit: "added set(0) inside the memo compute",
    expected: [x(WRITE, "m-write-in-memo.tsx", [f("set(0)")])]
  }),
  mutant("m-reactive-prop-read-in-setup", {
    parent: "cases/props-interface-live", edit: "Card reads props.title in setup (const title = props.title)",
    expected: [x(STRICT, "m-reactive-prop-read-in-setup.tsx", [f("const title = props.title")], { note: "title is reactive: App passes t()" })]
  }),
  mutant("m-handled-catch-rethrows", {
    parent: "cases/handled-catch", edit: "the catch rethrows and the component is rendered at a root with no Errored", entry: true,
    expected: [x(ERRORED, "m-handled-catch-rethrows.tsx", [f("{n()}"), f("throw new Error"), atRoot("render(")])]
  }),
  mutant("m-async-helper-rejects", {
    parent: "cases/async-event-reads", edit: "load() throws after its await; the handler awaits it with no catch",
    expected: [x(HANDLER, "m-async-helper-rejects.tsx", [f("onClick")])]
  }),
  mutant("m-pending-through-prop", {
    parent: "cases/colored-prop", edit: "App is rendered at a root; Child's read of the pending prop has no Loading above it", entry: true,
    expected: [{ ...x(LOADING, "m-pending-through-prop.tsx", [f("{p.n}")]), related: [{ file: "m-pending-through-prop.tsx", at: [f("n={n()}")] }] }]
  }),
  mutant("m-pending-read-in-setup", {
    parent: "cases/async-memo-reads", edit: "value() is read in setup (const v = value())",
    expected: [x(PENDING_UNTRACKED, "m-pending-read-in-setup.tsx", [f("value()", 1)])]
  }),
  mutant("m-callback-prop-throws-forwarded", {
    parent: "cases/callback-prop-forwarded", edit: "App passes a throwing onPick to Middle, which forwards it to Leaf",
    expected: [x(HANDLER, "m-callback-prop-throws-forwarded.tsx", [f("onClick", 1), f("onClick", 2)], { minCount: 2, note: "both Leaf's and Middle's bindings call the throwing callback" })]
  }),
  mutant("m-effect-phase-pending", {
    parent: "cases/async-memo-nested-function", edit: "the effect's effect function reads the async memo m()", entry: true,
    expected: [x("PENDING_ASYNC_FORBIDDEN_SCOPE", "m-effect-phase-pending.tsx", [f("m() + 1"), f("() => console.log(m() + 1)")])]
  }),
  mutant("m-injected-api-ambient", {
    parent: "cases/inline-event (shape) — review finding on b2dfebf", edit: "an ambient injected API whose methods are named like platform methods (get/set/add/delete/has/from) is called in six handlers with no catch",
    expected: [x(HANDLER, "m-injected-api-ambient.tsx", [l(7), l(8), l(9), l(10), l(11), l(12)], { minCount: 6, note: "a name-only safe list would call these failure-free; they have no failure information" })]
  }),
  mutant("m-injected-api-prop", {
    parent: "cases/props-interface-live (shape) — review finding on b2dfebf", edit: "an injected API passed through a prop; its get/set/map methods are called in three handlers with no catch", entry: true,
    expected: [x(HANDLER, "m-injected-api-prop.tsx", [l(8), l(9), l(10)], { minCount: 3 })]
  }),
  mutant("m-equipment-row-loading-removed", {
    parent: "equipment (App.tsx + Inventory + EquipmentRow)", edit: "a self-contained copy of the service / inventory shape where the Loading around <Inventory> is removed from App", entry: true,
    expected: [x(LOADING, "m-equipment-row-loading-removed.tsx", [f("props.list()"), f("<Inventory list={list} />"), atRoot("render(")])],
    notes: "the list is an async memo created in the component (in subset); Inventory renders it and App renders Inventory without Loading"
  })
];

/** @type {Fixture[]} */
export const fixtures = [...cases, equipment, ...mutants];

/** @param {string} group */
export function byGroup(group) {
  return group === "all" ? fixtures : fixtures.filter(fx => fx.group === group);
}
