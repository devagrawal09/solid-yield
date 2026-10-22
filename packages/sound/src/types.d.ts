// Shared types for prototypes and the harness (see CONTRACT.md).
import type { CompilerOptions } from "typescript";

export type SoundKind = "strict-read" | "async" | "write" | "lifecycle" | "owner" | "error" | "analysis";
export type SoundSeverity = "info" | "warn" | "error";

export interface Loc {
  file: string;
  line: number;
  col: number;
  endLine?: number;
  endCol?: number;
}

/** Mirrors @solidjs/signals DiagnosticEvent (dev.d.ts), minus runtime-only fields. */
export interface SoundDiagnostic {
  code: string;
  kind: SoundKind;
  severity: SoundSeverity;
  message: string;
  ownerName?: string;
  ownerPath?: string[];
  loc: Loc;
  related?: { message: string; loc: Loc }[];
  data?: Record<string, unknown>;
}

export interface ReadFact { loc: Loc; scope: "setup" | "tracking" | "handler" | "effect"; source: string }
export interface ComponentFacts {
  component: string;
  file: string;
  pending: boolean | "unknown";
  failures: string[];
  reads: ReadFact[];
  boundaries: { kind: "Loading" | "Errored"; loc: Loc }[];
  unanalyzed: { loc: Loc; construct: string }[];
}

export interface CheckResult {
  diagnostics: SoundDiagnostic[];
  elapsedMs: number;
  facts?: ComponentFacts[];
}

export interface Checker {
  check(): CheckResult;
  update(path: string, text: string): CheckResult;
  dispose(): void;
}

export interface CheckerOptions {
  rootDir: string;
  files: readonly string[];
  compilerOptions?: CompilerOptions;
  readFile?: (path: string) => string | undefined;
}

export interface Prototype {
  name: string;
  createChecker(options: CheckerOptions): Checker;
}
