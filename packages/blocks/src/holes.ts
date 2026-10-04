/*
 * Shared by the no-JSX renderers: what a hole may hold, and how a value is
 * handed to Solid's `h`.
 *
 * A hole is a source (`$signal` / `$memo` accessor, store or prop path, a
 * `readStore` selection), a bare zero-arity `function*` (a hole of its own),
 * an `$event` handler, a child view, or a static value. A
 * plain thunk is not a hole (it would be a hidden read) and is rejected by
 * the types.
 */
import { holeOf, perform, READ, isGeneratorFunction, runRow } from "solid-blocks";
import type { Element } from "./element.js";
import type {
  ChildView,
  EventHandler,
  FailsOf,
  HView,
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
  V extends EventHandler<any, any>
    ? never
    : // a JSX element is settled by construction (and recursive: not walked)
      V extends Element
      ? never
      : V extends Source<any, infer E, infer P>
        ? Read<P, E>
        : V extends HView<infer P, infer E>
          ? ChildView<P, E>
          : V extends View<infer P, infer E>
            ? ChildView<P, E>
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

/** The no-JSX output of holes `V`: its pending / failures are theirs. */
export type HViewOf<V> = HView<PendingOf<OpsOfHole<V>>, FailsOf<OpsOfHole<V>>>;

/**
 * Convert a hole value for Solid's renderer: a zero-arity generator is a
 * hole block; a generator with parameters is a render callback running a row
 * block; a path or a selection becomes an accessor; everything else passes.
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
        get: () => toPropHole(props[key], name),
        enumerable: true
      });
    else out[key] = toPropHole(d.value, name);
  }
  return out;
}
