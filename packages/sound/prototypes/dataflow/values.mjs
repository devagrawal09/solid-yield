// @ts-check
// The dataflow lattice: what the analysis knows about an expression's value.
//
//   reactive  the value depends on a reactive read (a prop given it is reactive)
//   pending   reading / rendering the value may suspend (an async source, or
//             something derived from one)
//   failures  failure type names (or "unknown") that producing or reading the
//             value may raise synchronously in the reader
//   promise   when the value is a promise: its rejection set (null otherwise)
//   callables functions the value may be (analyzed where they are called)
//   worst     the value comes from an unanalyzed construct (partial check)

/** @typedef {import("typescript").Node} Node */

/**
 * @typedef {{
 *   kind: "function" | "source" | "setter" | "component" | "safe",
 *   node: Node | null,
 *   source?: Source,
 *   component?: import("./analyze.mjs").Component,
 *   reasonText?: string
 * }} Callable
 */

/**
 * A reactive source: a signal getter, a memo, an accessor prop, a Show/For/Errored accessor, or a worst-case value.
 * @typedef {{ name: string, reactive: boolean, pending: boolean, failures: Set<string>, worst: boolean, node: Node | null }} Source
 */

/**
 * @typedef {{
 *   reactive: boolean,
 *   pending: boolean,
 *   failures: Set<string>,
 *   promise: Set<string> | null,
 *   callables: Callable[],
 *   worst: boolean,
 *   caught: Set<string> | null
 * }} Value
 */

/** @returns {Value} */
export function constant() {
  return { reactive: false, pending: false, failures: new Set(), promise: null, callables: [], worst: false, caught: null };
}

/** @returns {Value} */
export function worst() {
  return { reactive: true, pending: true, failures: new Set(["unknown"]), promise: null, callables: [], worst: true, caught: null };
}

/** @param {Callable} c @returns {Value} */
export function callable(c) {
  return { ...constant(), callables: [c] };
}

/** @param {Set<string>} rejects @returns {Value} */
export function promiseOf(rejects) {
  return { ...constant(), promise: new Set(rejects) };
}

/**
 * @param {Value} a
 * @param {Value} b
 * @returns {Value}
 */
export function join(a, b) {
  return {
    reactive: a.reactive || b.reactive,
    pending: a.pending || b.pending,
    failures: new Set([...a.failures, ...b.failures]),
    promise: a.promise || b.promise ? new Set([...(a.promise ?? []), ...(b.promise ?? [])]) : null,
    callables: [...a.callables, ...b.callables],
    worst: a.worst || b.worst,
    caught: a.caught || b.caught ? new Set([...(a.caught ?? []), ...(b.caught ?? [])]) : null
  };
}

/** @param {Value[]} values */
export function joinAll(values) {
  return values.reduce(join, constant());
}

/** A value derived from another (a property of it, an arithmetic result): keeps the facts, drops the shape. @param {Value} v @returns {Value} */
export function derived(v) {
  return { reactive: v.reactive, pending: v.pending, failures: new Set(v.failures), promise: null, callables: [], worst: v.worst, caught: null };
}

/** @param {Set<string>} s */
export function describeFailures(s) {
  return s.size ? [...s].sort().join(" | ") : "nothing";
}
