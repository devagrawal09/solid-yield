export interface FailureFunction {
  id: string;
  file: string;
  name: string;
  line: number;
  server: boolean;
  component: boolean;
  fails: string[];
  calls: string[];
  provides: string[];
  timerFails: string[];
  rejection?: string[];
}
export interface FailureReport {
  iterations: number;
  diagnostics: {
    file: string;
    code: string;
    message: string;
    line: number;
    column: number;
    timer?: boolean;
  }[];
  unknownOrigins: {
    file: string;
    start: number;
    end: number;
    line: number;
    name: string;
    owner?: string;
  }[];
  classes: {
    id: string;
    name: string;
    file: string | null;
    nameStart?: number;
    classStart?: number;
  }[];
  functions: FailureFunction[];
  call(
    file: string,
    start: number,
    end: number
  ): {
    callable: boolean;
    fails: string[];
    ownFails: string[];
    native: boolean;
    /** The platform's own function: a promise it returns rejects rather than it throwing. */
    platform: boolean;
    /** An array's own method that runs its callbacks at once (`every`, `reduce`). */
    arrayMethod: boolean;
    target?: string;
    promise: boolean;
    async: boolean;
    /** An async iterable result: a stream. */
    stream: boolean;
    /** The argument a type guard narrows, if the callee is one. */
    predicate: number | null;
    resultType: string;
  } | null;
  foreignState(file: string, start: number, end: number): boolean;
  /** F-S37: the guarded value's name when this throw is a native context guard. */
  guard(file: string, start: number, end: number): string | null;
  at(
    file: string,
    start: number
  ): { fails: Set<string>; server: boolean; component: boolean } | undefined;
  throws(file: string, start: number, end: number): string[];
}
export function providerMemberObservation(
  ts: typeof import("typescript"),
  checker: import("typescript").TypeChecker,
  declaration: import("typescript").VariableDeclaration,
  use: import("typescript").Node,
  allowGenerators?: boolean
): boolean;
export function inferFailures(
  modules: Map<string, string>,
  options: {
    program: import("typescript").Program;
    ts: typeof import("typescript");
    root?: string;
    opaqueGenerators?: boolean | "marked";
  }
): FailureReport;
