// solid-sound's diagnostic codes.
//
// Static diagnostics follow Solid 2's runtime diagnostics pattern
// (@solidjs/signals 2.0.0-rc.17, dist/types/core/dev.d.ts: DiagnosticEvent,
// DiagnosticCode, DiagnosticKind, DiagnosticSeverity). Where a static finding
// is the compile-time counterpart of a runtime code, the runtime code is
// reused verbatim so that the same code means the same thing whether it is
// caught at build time or at runtime. New codes (no runtime counterpart) use
// the same naming style. No numeric IDs, no NATIVE_/SUGAR_ prefixes.
//
// Both prototypes import this table; the harness compares against it. The
// legacy column exists only to compare with today's solid-yield fixture
// expectations; it is not a public mapping.
//
// kind: Solid's DiagnosticKind vocabulary, plus one extension, "analysis",
// for findings about the checker's own coverage (no runtime counterpart can
// exist for those).
//
// severity: reused runtime codes keep their runtime severity (D-129). New
// codes keep the severity set here. Only errors fail a Vite build.

/**
 * @typedef {"strict-read" | "async" | "write" | "lifecycle" | "owner" | "error" | "analysis"} SoundKind
 * @typedef {"info" | "warn" | "error"} SoundSeverity
 * @typedef {{
 *   code: string,
 *   kind: SoundKind,
 *   severity: SoundSeverity,
 *   meaning: string,
 *   fix: string,
 *   runtime: { code: string, severity: SoundSeverity, note?: string } | null,
 *   legacy: readonly string[]
 * }} SoundCodeEntry
 */

/** @type {readonly SoundCodeEntry[]} */
export const CODES = Object.freeze([
  {
    code: "STRICT_READ_UNTRACKED",
    kind: "strict-read",
    severity: "warn",
    meaning:
      "A reactive value (a signal or memo getter, a reactive prop, a store or context accessor) is read in a component's setup or another untracked scope: the read runs once and will not update.",
    fix: "Move the read into a tracking scope (JSX, a memo, or an effect's compute function), or into the event handler that needs the value.",
    runtime: { code: "STRICT_READ_UNTRACKED", severity: "warn", note: "Solid's strict mode reports the same read when it happens." },
    legacy: ["READ_IN_SETUP", "NATIVE_ASYNC_SETUP"]
  },
  {
    code: "PENDING_ASYNC_UNTRACKED_READ",
    kind: "async",
    severity: "error",
    meaning:
      "A value that may be pending (an async memo / createAsync, or a value that carries one) is read in setup or another untracked scope. At runtime an uninitialized pending read there throws.",
    fix: "Read it in a tracking scope (JSX, a memo, an effect's compute function) under a Loading boundary.",
    runtime: { code: "PENDING_ASYNC_UNTRACKED_READ", severity: "error" },
    legacy: ["READ_IN_SETUP"]
  },
  {
    code: "ASYNC_OUTSIDE_LOADING_BOUNDARY",
    kind: "async",
    severity: "warn",
    meaning:
      "A possibly pending value is rendered (read in JSX or in a memo the JSX reads) with no Loading boundary above it, within this component or its callers up to the render root. The root mount would be deferred with no fallback shown.",
    fix: "Wrap the rendered read in <Loading fallback={…}>, in this component or in a caller.",
    runtime: { code: "ASYNC_OUTSIDE_LOADING_BOUNDARY", severity: "warn", note: "Runtime: 'pending reached the root; the root mount is deferred'." },
    legacy: ["PENDING_ROOT"]
  },
  {
    code: "PENDING_ASYNC_FORBIDDEN_SCOPE",
    kind: "async",
    severity: "warn",
    meaning:
      "A possibly pending value is read in a scope that serves the committed value and throws while uninitialized: an effect's effect function (createEffect's second argument), createTrackedEffect or onSettled.",
    fix: "Read the source in the effect's compute function and pass the value to the effect function.",
    runtime: { code: "PENDING_ASYNC_FORBIDDEN_SCOPE", severity: "warn" },
    legacy: ["PENDING_IN_EFFECT"]
  },
  {
    code: "PENDING_ASYNC_IN_HANDLER",
    kind: "async",
    severity: "warn",
    meaning: "A possibly pending value is read in an event handler. An uninitialized read can throw or suspend even though a stale value can be served during refresh. Loading does not protect handlers.",
    fix: "Avoid the pending read in the handler, or explicitly handle its uninitialized state and any failure.",
    runtime: null,
    legacy: []
  },
  {
    code: "CONTEXT_PROVIDER_MISSING",
    kind: "owner",
    severity: "error",
    meaning: "A useContext call has neither an enclosing provider for that context nor a supplied default. Solid throws when this consumer runs.",
    fix: "Put the consumer under that context’s provider, or supply a default to createContext.",
    runtime: null,
    legacy: []
  },
  {
    code: "REACTIVE_WRITE_IN_OWNED_SCOPE",
    kind: "write",
    severity: "error",
    meaning:
      "A signal setter is called inside an owned reactive scope: a memo's compute, a JSX expression, or a component's setup body.",
    fix: "Move the write into an event handler or an effect's effect function.",
    runtime: { code: "REACTIVE_WRITE_IN_OWNED_SCOPE", severity: "error" },
    legacy: ["WRITE_IN_REACTIVE"]
  },
  {
    code: "ERROR_OUTSIDE_ERRORED_BOUNDARY",
    kind: "error",
    severity: "error",
    meaning:
      "Rendered work may fail (a throw in a memo or JSX expression, or a rejected async memo) and no Errored boundary is above it within this component or its callers up to the render root. At runtime the failure reaches the root and halts reactivity.",
    fix: "Wrap the rendered work in <Errored fallback={…}>, or handle the failure where it is produced.",
    runtime: { code: "REACTIVITY_HALTED", severity: "error", note: "Not the same code: the runtime reports the consequence after the fact; this code is new (named after ASYNC_OUTSIDE_LOADING_BOUNDARY)." },
    legacy: ["FOREIGN_HANDOFF", "NATIVE_CALLBACK_FAILURE"]
  },
  {
    code: "UNHANDLED_HANDLER_FAILURE",
    kind: "error",
    severity: "error",
    meaning:
      "A handler — an event handler, a callback prop, a promise continuation, a timer or ref callback — may throw or reject and nothing in it catches the failure. A rendered Errored boundary does not catch a handler's rejection. Calls with no failure information (an injected API typed () => Promise<T>, a context method, a platform call) count as possibly failing with unknown.",
    fix: "Catch and handle the failure inside the handler (try/catch around the await, or .catch on the promise).",
    runtime: null,
    legacy: ["EVENT_REJECTS"]
  },
  {
    code: "SETUP_MAY_THROW",
    kind: "error",
    severity: "error",
    meaning: "A component's setup body (outside any memo, JSX or handler) may throw synchronously, or drops a promise that may reject (`risk().then(…)` with no catch); a component body only creates state.",
    fix: "Move the failing work into a memo or rendered work under an Errored boundary, or handle it where it is produced.",
    runtime: null,
    legacy: ["NATIVE_SETUP_FAILURE"]
  },
  {
    code: "UNANALYZED_BOUNDARY",
    kind: "analysis",
    severity: "warn",
    meaning:
      "This code is outside the checked subset. The checker did not refuse the file: values flowing from here are treated as the worst case (possibly pending, possibly failing with unknown), so obligations still surface downstream. Nothing here is trusted and nothing is silently green.",
    fix: "No action required for soundness; to narrow the worst case, move the work into a supported form (the message names the construct).",
    runtime: null,
    legacy: ["NATIVE_*", "SUGAR_*", "DEPENDENT_TYPE", "GENERATED_TYPE", "FOREIGN_HANDOFF (non-root)"]
  },
  {
    code: "COMPONENT_OBLIGATIONS_EXPORTED",
    kind: "analysis",
    severity: "info",
    meaning:
      "An exported component that nothing in this program renders is possibly pending or possibly failing. Its renderers must provide the Loading / Errored boundary; inside this program there is no root to report it at. Structured channel only (a library may legitimately export such a component).",
    fix: "None inside this program; the facts travel with the component.",
    runtime: null,
    legacy: []
  },
  {
    code: "UNRESOLVED_FAILURE_CONTRACT",
    kind: "analysis",
    severity: "info",
    meaning:
      "A call has no failure information (no analyzable body, a callback or injected function, a platform or package API) and is treated as possibly failing with unknown. Structured channel only: it appears as related data on the UNHANDLED_HANDLER_FAILURE or ERROR_OUTSIDE_ERRORED_BOUNDARY it feeds.",
    fix: "None; informational.",
    runtime: null,
    legacy: []
  }
]);

/** @type {Readonly<Record<string, SoundCodeEntry>>} */
export const BY_CODE = Object.freeze(Object.fromEntries(CODES.map(entry => [entry.code, entry])));

/** Legacy solid-yield code -> sound codes it may correspond to (comparison only). */
export const LEGACY_TO_SOUND = Object.freeze({
  READ_IN_SETUP: ["STRICT_READ_UNTRACKED", "PENDING_ASYNC_UNTRACKED_READ"],
  NATIVE_ASYNC_SETUP: ["STRICT_READ_UNTRACKED"],
  PENDING_ROOT: ["ASYNC_OUTSIDE_LOADING_BOUNDARY"],
  PENDING_IN_EFFECT: ["PENDING_ASYNC_FORBIDDEN_SCOPE"],
  WRITE_IN_REACTIVE: ["REACTIVE_WRITE_IN_OWNED_SCOPE"],
  FOREIGN_HANDOFF: ["ERROR_OUTSIDE_ERRORED_BOUNDARY", "UNANALYZED_BOUNDARY"],
  NATIVE_CALLBACK_FAILURE: ["ERROR_OUTSIDE_ERRORED_BOUNDARY", "UNHANDLED_HANDLER_FAILURE"],
  EVENT_REJECTS: ["UNHANDLED_HANDLER_FAILURE"],
  NATIVE_SETUP_FAILURE: ["SETUP_MAY_THROW"],
  DEPENDENT_TYPE: ["UNANALYZED_BOUNDARY"],
  GENERATED_TYPE: ["UNANALYZED_BOUNDARY"],
  SUGAR_CALLBACK: ["UNANALYZED_BOUNDARY"],
  SUGAR_ESCAPE: ["UNANALYZED_BOUNDARY"]
});

/**
 * Render a diagnostic the way Solid's console face does:
 * "[CODE] message in <App> › <Page>".
 * @param {{ code: string, message: string, ownerPath?: readonly string[] }} d
 */
export function consoleFace(d) {
  const where = d.ownerPath && d.ownerPath.length ? ` in ${d.ownerPath.join(" › ")}` : "";
  return `[${d.code}] ${d.message}${where}`;
}
