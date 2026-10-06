/*
 * `lazy`: Solid's `lazy()` as a yield component (D-047). The same signature
 * (`fn`, `options`, `moduleUrl`; `preload` / `moduleUrl` kept on the result);
 * the result is colored pending while its chunk loads, unioned with the loaded
 * component's own colors, and usable in call form in a hole (`{yield* Page()}`).
 */
import { lazy as solidLazy } from "solid-js";
import { yieldComponent } from "./runtime.js";
import type { ComponentView, PlainCall, View } from "./types.js";

/** What a loaded component renders: its colors (a plain component is settled). */
type ColorsOf<T> =
  PlainCall<T> extends (...args: any[]) => infer V
    ? V extends View<infer P, infer E, infer W, infer R>
      ? [P, E, W, R]
      : [false, never, false, never]
    : [false, never, false, never];
type PropsArg<T> = PlainCall<T> extends (props: infer P) => any ? P : {};

/**
 * A lazily loaded yield component: pending while its chunk loads, failing as
 * the loaded component does.
 */
export type LazyComponent<T, M = { default: T }> = ({} extends PropsArg<T>
  ? (props?: PropsArg<T>) => ComponentView<true, ColorsOf<T>[1], ColorsOf<T>[2], ColorsOf<T>[3]>
  : (props: PropsArg<T>) => ComponentView<true, ColorsOf<T>[1], ColorsOf<T>[2], ColorsOf<T>[3]>) & {
  preload: () => Promise<M>;
  moduleUrl?: string;
};

/**
 * `const Page = lazy(() => import("./Page"))`: a code-split yield component.
 * Its chunk loads on first render; until then it is pending (`Loading` shows
 * its fallback). `preload()` starts the import early.
 */
export function lazy<M extends Record<string, any>, K extends keyof M & string>(
  fn: () => Promise<M>,
  options: { export: K },
  moduleUrl?: string
): LazyComponent<M[K], M>;
export function lazy<T extends (props: any) => any>(
  fn: () => Promise<{ default: T }>,
  options?: { export?: string },
  moduleUrl?: string
): LazyComponent<T>;
export function lazy(
  fn: () => Promise<any>,
  options?: { export?: string },
  moduleUrl?: string
): any {
  return yieldComponent((solidLazy as any)(fn, options, moduleUrl));
}
