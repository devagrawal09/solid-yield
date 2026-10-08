import type ts from "typescript";
export interface Position {
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  generated: boolean;
}
export interface Lowered {
  files: Map<string, string>;
  positions: Map<string, Position[]>;
  iterations: number;
  diagnostics?: { code: string; message: string; file: string; line: number; column: number }[];
}
export function lowerNativeProject(
  input: Map<string, string>,
  options?: { compilerOptions?: ts.CompilerOptions }
): Lowered;
export function lowerSugarProject(
  input: Map<string, string>,
  options?: { compilerOptions?: ts.CompilerOptions }
): Lowered;
export function isSugar(code: string): boolean;
export function locate(
  table: Position[] | undefined,
  start: number,
  length?: number
): Position | undefined;
export function nativeInclude(
  root: string,
  include: string[] | ((file: string) => boolean)
): (file: string) => boolean;
