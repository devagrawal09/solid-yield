/*
 * Shared by the no-JSX renderers: what a hole may hold, and how a value is
 * handed to Solid's `h`.
 *
 * A hole is a source (`$signal` / `$memo` accessor, store or prop path, a
 * `readStore` selection), a bare zero-arity `function*` (a hole of its own),
 * an `$event` handler (an event attribute's, bound where the output is
 * materialized, D-085), a child view, or a static value. A
 * plain thunk is not a hole (it would be a hidden read) and is rejected by
 * the types.
 */
import {
  bindEvent,
  EVENT_MARK,
  holeOf,
  perform,
  READ,
  isGeneratorFunction,
  runRow
} from "solid-yield/internal";
import type { Element } from "./element.js";
import type {
  Bind,
  ChildView,
  EventHandler,
  FailsOf,
  HView,
  MayWaitOf,
  PendingOf,
  Read,
  Source,
  View
} from "./types.js";

/**
 * A child `h` accepts: a static node or value, a source, a bare
 * `function*` hole, a child view, or an array of them. Not a plain
 * object (that is an attributes object) and not a plain thunk (a hidden read).
 */
export type Hole =
  | Node
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | Source<any, any, boolean>
  | HView<boolean, any>
  | View<boolean, any>
  | readonly Hole[]
  | ((...args: any[]) => Generator<any, any, any>);

export type OpsOfHole<V> =
  // an `$event` handler given to `h` as an attribute is bound there (D-072):
  // its failures and its may-wait marker join the output, as `yield* save` in JSX
  V extends EventHandler<any, infer E, any, infer P>
    ? Bind<P, E>
    : // a JSX element is settled by construction (and recursive: not walked)
      V extends Element
      ? never
      : V extends Source<any, infer E, infer P>
        ? Read<P, E>
        : V extends HView<infer P, infer E, infer W>
          ? ChildView<P, E, W>
          : V extends View<infer P, infer E, infer W>
            ? ChildView<P, E, W>
            : V extends (...args: any[]) => Generator<infer Y, infer R, any>
              ? GeneratorOps<Y, R>
              : V extends readonly (infer U)[]
                ? OpsOfHole<U>
                : never;
/**
 * A generator's colors: a row's (it returns its view generator) or a hole's
 * (its yields, and what it returns). A hole that always raises returns
 * `never`; a conditional distributing over that `never` would be `never`
 * too and drop the hole's own yields — its `Raise` — so `never` is its own
 * case (found by the raise tests, Phase 4 item 2).
 */
type GeneratorOps<Y, R> = [R] extends [never]
  ? Y
  : R extends () => Generator<infer VY, infer VR, any>
    ? VY | OpsOfHole<VR>
    : Y | OpsOfHole<R>;

/** The no-JSX output of holes `V`: its pending / failures (and may-wait marker) are theirs. */
export type HViewOf<V> = HView<
  PendingOf<OpsOfHole<V>>,
  FailsOf<OpsOfHole<V>>,
  MayWaitOf<OpsOfHole<V>>
>;

/**
 * Convert a hole value for Solid's renderer: a zero-arity generator is a
 * hole routine; a generator with parameters is a render callback running a row
 * routine; a path or a selection becomes an accessor; everything else passes.
 */
export function toHole(value: any, name?: string | null): any {
  if (value == null) return value;
  if (typeof value === "function") {
    if (value[READ] !== undefined) return value;
    if (isGeneratorFunction(value)) {
      if (value.length === 0) return holeOf(value, name);
      if (value.length === 1) return (a: unknown) => runRow(value, [a]);
      return (a: unknown, b: unknown) => runRow(value, [a, b]);
    }
    return value;
  }
  if (typeof value === "object") {
    // a path or a selection: read in the hole, as the JSX transform's `perform`
    if (value[READ] !== undefined) return () => perform(value);
    if (Array.isArray(value)) return value.map(v => toHole(v, name));
  }
  return value;
}

/** A prop value: converted like a hole, but arrays are not walked. */
function toPropHole(value: any, name?: string | null): any {
  return Array.isArray(value) ? value : toHole(value, name);
}

/**
 * An event attribute's `$event` handler is bound here, where the output is
 * materialized (D-072, D-085): a failure nobody handles goes to the `Errored`
 * above this bind site. The bound-data form `[save, data]` binds its handler.
 */
function toAttribute(key: string, value: any, name?: string | null): any {
  if (key.startsWith("on")) {
    if (typeof value === "function" && value[EVENT_MARK] === true) return bindEvent(value);
    if (Array.isArray(value) && typeof value[0] === "function" && value[0][EVENT_MARK] === true)
      return [bindEvent(value[0]), ...value.slice(1)];
  }
  return toPropHole(value, name);
}

/**
 * Convert the values of a props object (a copy; getters stay lazy). Only
 * the values themselves: a prop holding an array or an object (a context
 * value, a store) is passed as it is.
 */
export function toHoleProps(props: any, name?: string | null): any {
  if (props == null || typeof props !== "object" || Array.isArray(props)) return props;
  if (props instanceof Node) return props;
  if (props[READ] !== undefined) return props;
  const out: any = {};
  const descriptors = Object.getOwnPropertyDescriptors(props);
  for (const key in descriptors) {
    const d = descriptors[key];
    if (d.get)
      Object.defineProperty(out, key, {
        get: () => toAttribute(key, props[key], name),
        enumerable: true
      });
    else out[key] = toAttribute(key, d.value, name);
  }
  return out;
}
