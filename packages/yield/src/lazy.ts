/*
 * `lazy`: Solid's `lazy()` as a yield component (D-047). The same signature
 * (`fn`, `options`, `moduleUrl`; `preload` / `moduleUrl` kept on the result);
 * the result is colored pending while its chunk loads, failing with
 * `ChunkError` when it does not load (D-100), unioned with the loaded
 * component's own colors, and usable in call form in a hole (`{yield* Page()}`).
 */
import { lazy as solidLazy } from "solid-js";
import { boundaryAbove, brandFailure, devError, takes, yieldComponent } from "./runtime.js";
import type { ComponentView, PlainCall, View } from "./types.js";

declare const __DEV__: boolean;
declare const __SERVER__: boolean;

/**
 * A lazy component's chunk did not load (D-100): its `import()` rejected.
 * `cause` is the rejection; `specifier` the module's URL when the build gave
 * `lazy` one (vite-plugin-solid-yield writes it), else `undefined`. A typed
 * failure (branded, D-087): it reaches the nearest `Errored` above the call
 * that takes it, or is re-thrown (D-033).
 */
export class ChunkError extends Error {
  readonly kind = "chunk" as const;
  /** The import's rejection. */
  declare readonly cause: unknown;
  /** The module's URL, when the build gave one. */
  readonly specifier: string | undefined;
  constructor(cause: unknown, specifier?: string) {
    super(
      specifier
        ? `lazy: the chunk of ${specifier} failed to load`
        : "lazy: a component's chunk failed to load",
      { cause }
    );
    this.name = "ChunkError";
    this.specifier = specifier;
  }
}

/** What a loaded component renders: its colors (a plain component is settled). */
type ColorsOf<T> =
  PlainCall<T> extends (...args: any[]) => infer V
    ? V extends View<infer P, infer E, infer W, infer R>
      ? [P, E, W, R]
      : [false, never, false, never]
    : [false, never, false, never];
type PropsArg<T> = PlainCall<T> extends (props: infer P) => any ? P : {};

/**
 * A lazily loaded yield component: pending while its chunk loads, failing
 * with `ChunkError` when it does not load, and as the loaded component does.
 */
export type LazyComponent<T, M = { default: T }> = ({} extends PropsArg<T>
  ? (
      props?: PropsArg<T>
    ) => ComponentView<true, ColorsOf<T>[1] | ChunkError, ColorsOf<T>[2], ColorsOf<T>[3]>
  : (
      props: PropsArg<T>
    ) => ComponentView<true, ColorsOf<T>[1] | ChunkError, ColorsOf<T>[2], ColorsOf<T>[3]>) & {
  preload: () => Promise<M>;
  moduleUrl?: string;
};

/**
 * `const Page = lazy(() => import("./Page"))`: a code-split yield component.
 * Its chunk loads on first render; until then it is pending (`Loading` shows
 * its fallback). `preload()` starts the import early. When the import
 * rejects, the call fails with a `ChunkError` (D-100): the nearest `Errored`
 * above the call that takes it shows it (a reset loads again), and with none
 * the `ChunkError` is re-thrown (D-033) and the call renders nothing.
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
  const chunkError = (cause: unknown) => brandFailure(new ChunkError(cause, moduleUrl));
  // On the server a failure no Errored takes fails the render (D-033), as
  // Solid's lazy already does: the import's rejection, branded (D-087).
  if (__SERVER__)
    return yieldComponent(
      (solidLazy as any)(
        () =>
          fn().then(undefined, cause => {
            throw chunkError(cause);
          }),
        options,
        moduleUrl
      )
    );
  // On the client Solid would route a rejected import from the pending memo
  // that waits for it, by the owner graph: with no Errored above, the
  // Loading's fallback would stay and the reactive system would halt
  // (calculus §6.3 F-2). So a failed import resolves to `Failed`, rendered in
  // each call's place, which asks the Errored chain above that call what to
  // do, as a bind site does (D-085, F-7): one that takes the `ChunkError`
  // gets it thrown, and with none it is re-thrown out of band and the call
  // renders nothing. A failed load is forgotten (as Solid's lazy forgets a
  // rejected import), so the next call, an Errored's reset, loads again.
  const exportName = options?.export ?? "default";
  const attempt = (): any => {
    let error: ChunkError;
    // the calls this failure was reported for, by their props (one object per call)
    const reported = new WeakSet<object>();
    const Failed = (props: object) => {
      // run again (an Errored's reset re-runs the failed call): load again
      if (reported.has(props)) return current(props);
      reported.add(props);
      if (takes(boundaryAbove(), error)) throw error;
      queueMicrotask(() => {
        throw error;
      });
      return "";
    };
    const solid = (solidLazy as any)(
      () =>
        fn().then(undefined, cause => {
          error = chunkError(cause);
          if (current === solid) current = attempt();
          return { [exportName]: Failed };
        }),
      options,
      moduleUrl
    );
    solid.failed = () => error;
    return solid;
  };
  let current = attempt();
  const call: any = (props: object) => {
    try {
      return current(props);
    } catch (error) {
      if (
        __DEV__ &&
        error instanceof Error &&
        /^lazy\(\) module .* was not preloaded before hydration/.test(error.message)
      ) {
        const diagnostic = devError(
          "LAZY_HYDRATION_PRELOAD",
          `a lazy page's chunk was not preloaded for hydration. Pass the client asset manifest to the server render and load its entry before hydrate(). ${error.message}`
        );
        Object.defineProperty(diagnostic, "cause", { value: error });
        throw diagnostic;
      }
      throw error;
    }
  };
  call.preload = () => {
    const solid = current;
    return solid.preload().then((m: unknown) => {
      if (solid.failed()) throw solid.failed();
      return m;
    });
  };
  call.moduleUrl = moduleUrl;
  return yieldComponent(call);
}
