export interface FailureFunction {
  id: string;
  file: string;
  name: string;
  line: number;
  server: boolean;
  component: boolean;
  fails: string[];
  calls: string[];
  rejection?: string[];
}
export interface FailureReport {
  iterations: number;
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
  ): { fails: string[]; native: boolean; target?: string; promise: boolean; async: boolean } | null;
  foreignState(file: string, start: number, end: number): boolean;
  at(
    file: string,
    start: number
  ): { fails: Set<string>; server: boolean; component: boolean } | undefined;
  throws(file: string, start: number, end: number): string[];
}
export function inferFailures(
  modules: Map<string, string>,
  options: {
    program: import("typescript").Program;
    ts: typeof import("typescript");
    root?: string;
    opaqueGenerators?: boolean | "marked";
  }
): FailureReport;
