/**
 * Trace comparison. Exact, ordered, line-by-line: no normalization. A
 * difference is reported with the step it happened in, the first diverging
 * line, and the multiset of events missing from / extra in the actual
 * trace, grouped by event kind so a failure reads as "missing cleanup" or
 * "extra write" rather than a wall of text.
 */
import type { ModeExpectation } from "./types.js";

export interface Divergence {
  index: number;
  step: string;
  expected: string | undefined;
  actual: string | undefined;
}

export interface Comparison {
  equal: boolean;
  divergence?: Divergence;
  /** Events the reference has and the candidate lacks (multiset). */
  missing: string[];
  /** Events the candidate has and the reference lacks (multiset). */
  extra: string[];
  /** Event kinds (first word) involved in `missing` / `extra`. */
  kinds: string[];
}

export function kindOf(line: string): string {
  return line.startsWith("## ") ? "step" : line.split(" ", 1)[0];
}

export function compareTraces(expected: readonly string[], actual: readonly string[]): Comparison {
  let index = 0;
  let step = "(start)";
  while (index < expected.length && index < actual.length && expected[index] === actual[index]) {
    if (expected[index].startsWith("## ")) step = expected[index].slice(3);
    index++;
  }
  if (index === expected.length && index === actual.length) {
    return { equal: true, missing: [], extra: [], kinds: [] };
  }
  const counts = new Map<string, number>();
  for (const line of expected) counts.set(line, (counts.get(line) ?? 0) + 1);
  const extra: string[] = [];
  for (const line of actual) {
    const n = counts.get(line) ?? 0;
    if (n > 0) counts.set(line, n - 1);
    else extra.push(line);
  }
  const missing: string[] = [];
  for (const line of expected) {
    const n = counts.get(line) ?? 0;
    if (n > 0) {
      missing.push(line);
      counts.set(line, n - 1);
    }
  }
  const kinds = [...new Set([...missing, ...extra].map(kindOf))].sort();
  return {
    equal: false,
    divergence: { index, step, expected: expected[index], actual: actual[index] },
    missing,
    extra,
    kinds
  };
}

export function describeComparison(comparison: Comparison): string {
  if (comparison.equal) return "traces are equal";
  const d = comparison.divergence!;
  const lines = [
    `first divergence at event ${d.index} (step "${d.step}"):`,
    `  expected: ${d.expected ?? "<end of trace>"}`,
    `  actual:   ${d.actual ?? "<end of trace>"}`
  ];
  if (comparison.missing.length)
    lines.push(
      `  missing (${comparison.missing.length}):`,
      ...comparison.missing.slice(0, 12).map(l => `    - ${l}`)
    );
  if (comparison.extra.length)
    lines.push(
      `  extra (${comparison.extra.length}):`,
      ...comparison.extra.slice(0, 12).map(l => `    + ${l}`)
    );
  lines.push(`  kinds: ${comparison.kinds.join(", ")}`);
  return lines.join("\n");
}

/**
 * The exact trace a `differs` expectation declares: its full `trace`, or the
 * reference with each `remove` line deleted (it must occur exactly once) and
 * each `insert` block placed after its (unique) anchor line.
 */
export function declaredTrace(
  expectation: Extract<ModeExpectation, { status: "differs" }>,
  reference: readonly string[]
): string[] {
  if ("trace" in expectation) return [...expectation.trace];
  const unique = (trace: string[], line: string, what: string) => {
    const at = trace.indexOf(line);
    if (at < 0 || trace.indexOf(line, at + 1) >= 0) {
      throw new Error(
        `declared difference: ${what} line must occur exactly once in the reference trace: ${line}`
      );
    }
    return at;
  };
  const trace = [...reference];
  for (const line of expectation.remove ?? []) trace.splice(unique(trace, line, "removed"), 1);
  for (const { after, lines } of expectation.insert ?? []) {
    trace.splice(unique(trace, after, "anchor") + 1, 0, ...lines);
  }
  return trace;
}

export interface Verdict {
  ok: boolean;
  status: ModeExpectation["status"];
  message: string;
  comparison?: Comparison;
}

/**
 * Judge an observed trace against its reference trace under the mode's
 * declared expectation.
 */
export function judge(
  expectation: ModeExpectation,
  reference: readonly string[],
  actual: readonly string[]
): Verdict {
  switch (expectation.status) {
    case "not-applicable":
      return { ok: true, status: "not-applicable", message: expectation.reason };
    case "equivalent": {
      const comparison = compareTraces(reference, actual);
      return {
        ok: comparison.equal,
        status: "equivalent",
        comparison,
        message: comparison.equal
          ? "equivalent to reference"
          : `semantic divergence from reference\n${describeComparison(comparison)}`
      };
    }
    case "differs": {
      let declared: string[];
      try {
        declared = declaredTrace(expectation, reference);
      } catch (error) {
        return { ok: false, status: "differs", message: (error as Error).message };
      }
      const comparison = compareTraces(declared, actual);
      const same = compareTraces(reference, declared).equal;
      if (same) {
        return {
          ok: false,
          status: "differs",
          message: `declared difference is identical to the reference trace; declare the mode equivalent (${expectation.reason})`
        };
      }
      return {
        ok: comparison.equal,
        status: "differs",
        comparison,
        message: comparison.equal
          ? `intentional difference: ${expectation.reason}`
          : `declared difference not reproduced exactly (${expectation.reason})\n${describeComparison(comparison)}`
      };
    }
    case "known-defect": {
      const comparison = compareTraces(reference, actual);
      if (comparison.equal) {
        return {
          ok: false,
          status: "known-defect",
          comparison,
          message: `known defect no longer reproduces — flip this mode to "equivalent": ${expectation.reason}`
        };
      }
      const at = comparison.divergence!;
      const pinned = expectation.firstDivergence;
      const where = `${at.actual ?? "<end of trace>"}`;
      // The pin names the first diverging event of the mode (or of the
      // reference): exactly, or as a prefix for long lines such as markup.
      const ok =
        !pinned ||
        where.startsWith(pinned) ||
        (at.expected !== undefined && at.expected.startsWith(pinned));
      return {
        ok,
        status: "known-defect",
        comparison,
        message: ok
          ? `known defect reproduces: ${expectation.reason}`
          : `known defect diverges at a different point (pinned "${pinned}")\n${describeComparison(comparison)}`
      };
    }
  }
}
