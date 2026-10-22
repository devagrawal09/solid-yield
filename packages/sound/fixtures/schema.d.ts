// The shared fixture registry's shape (fixtures/index.mjs).

/** Where a diagnostic is expected. `find` is a substring of the file; the
 * anchor is that substring's line and column span (occurrence 1-based, default
 * 1). A diagnostic matches a find-anchor when its line equals the anchor's and
 * its column lies within the span; it matches a line-anchor on line alone. */
export type Anchor =
  | { find: string; occurrence?: number; file?: string; imprecise?: boolean }
  | { line: number; file?: string; imprecise?: boolean };
/** `file` overrides the expectation's file (a root in another module); `imprecise`
 * marks a location that satisfies the expectation but is counted separately as an
 * imprecise hit (the obligation reported at the root instead of at the read). */

export interface Expectation {
  code: string;
  /** Path relative to the fixture's directory, e.g. "setup-read.tsx" or "src/App.tsx". */
  file: string;
  /** Any of these anchors satisfies the expectation; every diagnostic with the
   * code at any anchor is consumed by it (so one expectation may cover several
   * reports of the same obligation). */
  at: readonly Anchor[];
  /** At least this many diagnostics must match (default 1). */
  minCount?: number;
  /** Each required related location must occur on the matching diagnostic. */
  related?: readonly { file: string; at: readonly Anchor[] }[];
  note?: string;
}

export interface LegacyDiagnostic {
  code: string;
  file: string;
  line: number;
  col: number;
  severity: string;
  message: string;
}

export interface Fixture {
  id: string;
  group: "cases" | "equipment" | "mutants" | "openclaw";
  /** Directory holding the files, relative to fixtures/. */
  dir: string;
  /** Files of the program, relative to `dir`. */
  files: readonly string[];
  /** The file holding the render root, if any. */
  entry?: string;
  /** Where the source came from (cases) or how it was derived (mutants). */
  origin: string;
  /** False when the fixture deliberately contains out-of-subset constructs. */
  inSubset: boolean;
  /** Errors (and only errors) the slice expects. Empty = must be clean of errors. */
  expected: readonly Expectation[];
  /** Warnings required by the slice, including reused runtime codes and pending handler reads. */
  expectedWarnings?: readonly Expectation[];
  /** Info-level findings the slice expects (reported, not scored). */
  expectedInfo?: readonly Expectation[];
  /** What the legacy test/fixture metadata expected (codes only). */
  legacyExpected: readonly string[];
  /** What the legacy checker actually reported (fixtures/legacy-actual.json). */
  legacyActual: readonly LegacyDiagnostic[];
  /** Mutants: the parent fixture and the edit. */
  mutation?: { parent: string; edit: string };
  notes?: string;
}
