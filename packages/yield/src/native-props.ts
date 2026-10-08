/** Compiler-only facade for props supplied by a plain Solid owner (C).
 * Values have no library colors; the component's own failures are retained. */
import type { Path, Source, DECLARED, PROPS } from "./types.js";
declare const NATIVE_PROPS: unique symbol;
type NativeDeclared<D> = { [K in keyof D]: Source<D[K]> } & {
  readonly [NATIVE_PROPS]?: Source<D>;
};
export type NativeProps<D> = {
  readonly [K in keyof D]-?: K extends "children" ? Source<D[K]> : Path<D[K]>;
} & { readonly [PROPS]?: (props: NativeDeclared<D>) => NativeDeclared<D> };
type NativeInput<C> = C extends { readonly [DECLARED]?: (props: infer D) => unknown }
  ? D extends { readonly [NATIVE_PROPS]?: Source<infer P> }
    ? P
    : never
  : never;
export function nativeC<C extends (...props: any[]) => unknown>(
  routine: C
): (props: NativeInput<C>) => ReturnType<C>;
export function nativeC(routine: unknown): unknown {
  return routine;
}
