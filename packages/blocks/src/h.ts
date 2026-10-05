/*
 * `h` for blocks: Solid's hyperscript with typed holes.
 *
 *   h("p", { class: function* () { return (yield* n) > 3 ? "big" : "" } },
 *     "Hello ", function* () { return (yield* user).name })
 *
 * Tag and attribute names are checked against the DOM JSX types; an
 * attribute value is a static value, a source of it, or a bare `function*`
 * hole returning it; a child is a static element, a source, a bare
 * `function*` hole, a child view or an array of them.
 * The result's type carries the pending / failures of every hole, so a view
 * returning it is pending when any hole is.
 */
import solidH from "@solidjs/h";
import type { JSX } from "solid-blocks/jsx-runtime";
import { toHole, toHoleProps, type Hole, type HViewOf, type OpsOfHole } from "./holes.js";
import { blockName, READ } from "solid-blocks";
import type {
  ChildView,
  Component,
  EventHandler,
  FailsOf,
  MayWaitOf,
  HView,
  PendingOf,
  Source,
  View
} from "./types.js";
import type { Errored, Loading, Reset } from "./flow.js";
import type { Accessor } from "solid-js";

type Intrinsic = JSX.IntrinsicElements;
/** An attribute: event handlers stay handlers; other values may be sources. */
type HAttr<K, V> = K extends `on${string}`
  ? V | EventHandler<any, any>
  : K extends "ref" | "children"
    ? V
    :
        | V
        | Source<Exclude<V, undefined>, any, boolean>
        | (() => Generator<any, Exclude<V, undefined>, any>);
export type HAttributes<Tag extends keyof Intrinsic> = {
  [K in keyof Intrinsic[Tag]]?: HAttr<K, Intrinsic[Tag][K]>;
};

type NotCallable = { readonly call?: never; readonly apply?: never };
/**
 * A component's props in `h`: its children may come as the rest arguments
 * (their colors join the output), or in the props object, checked against
 * the declared `children` like any prop (D-024).
 */
type PropsOfComponent<C> = C extends (props: infer P) => any
  ? Omit<NonNullable<P>, "children"> & { children?: ChildrenOf<NonNullable<P>> }
  : never;
type ChildrenOf<P> = "children" extends keyof P ? P["children"] : unknown;
/** What a component's output (a view or `h` output) contributes. */
type OpsOfOutput<R> = R extends View<infer P, infer E, infer W> | HView<infer P, infer E, infer W>
  ? ChildView<P, E, W>
  : never;

export interface BlocksH {
  /** A fragment: `h([a, b, c])`. It carries its holes' pending / failures. */
  <const C extends readonly Hole[]>(children: C): HViewOf<C[number]>;
  <
    Tag extends keyof Intrinsic,
    const A extends HAttributes<Tag> & NotCallable,
    const C extends readonly Hole[]
  >(
    tag: Tag,
    attributes: A & { readonly [K in Exclude<keyof A, keyof HAttributes<Tag>>]: never },
    ...children: C
  ): HViewOf<A[keyof A] | C[number]>;
  <Tag extends keyof Intrinsic, const C extends readonly Hole[]>(
    tag: Tag,
    ...children: C
  ): HViewOf<C[number]>;
  /**
   * `Loading` handles the pending of its children; their failures pass on,
   * and so do the fallback's colors and `on`'s failures (D-071), as in the
   * call form: `on`'s pending is the boundary's own.
   */
  <const C extends readonly Hole[], F extends Hole = never, O extends Hole = never>(
    component: typeof Loading,
    props: { fallback?: F; on?: O },
    ...children: C
  ): HView<
    PendingOf<OpsOfHole<F>>,
    FailsOf<OpsOfHole<C[number]> | OpsOfHole<F> | OpsOfHole<O>>,
    MayWaitOf<OpsOfHole<C[number]> | OpsOfHole<F> | OpsOfHole<O>>
  >;
  /**
   * `Errored` handles the failures of its children; their pending passes on,
   * and so do the fallback's own colors (D-071). `reset` is already bound
   * (`Reset`, D-072): `h("button", { onClick: reset })`.
   */
  <const C extends readonly Hole[], R extends Hole>(
    component: typeof Errored,
    props: { fallback: (error: Accessor<unknown>, reset: Reset) => R },
    ...children: C
  ): HView<
    PendingOf<OpsOfHole<C[number]> | OpsOfHole<R>>,
    FailsOf<OpsOfHole<R>>,
    MayWaitOf<OpsOfHole<C[number]> | OpsOfHole<R>>
  >;
  <const C extends readonly Hole[], F extends Exclude<Hole, (...args: any[]) => any>>(
    component: typeof Errored,
    props: { fallback: F },
    ...children: C
  ): HView<
    PendingOf<OpsOfHole<C[number]> | OpsOfHole<F>>,
    FailsOf<OpsOfHole<F>>,
    MayWaitOf<OpsOfHole<C[number]> | OpsOfHole<F>>
  >;
  /**
   * A component: its props, then its children. The result carries the
   * component's pending / failures and its children's (a component renders
   * the children it is given). Created when the output is materialized, like
   * a JSX tag.
   */
  <Comp extends (props: any) => unknown, const C extends readonly Hole[]>(
    component: Comp,
    props: PropsOfComponent<Comp>,
    ...children: C
  ): HView<
    PendingOf<OpsOfOutput<ReturnType<Comp>> | OpsOfHole<C[number]>>,
    FailsOf<OpsOfOutput<ReturnType<Comp>> | OpsOfHole<C[number]>>,
    MayWaitOf<OpsOfOutput<ReturnType<Comp>> | OpsOfHole<C[number]>>
  >;
  Fragment: (props: { children: Hole }) => HView<false, never, false>;
}

/**
 * The brand Solid's `h` puts on its element thunks (so a thunk passed as a
 * child is materialized in place rather than wrapped in an effect).
 */
const ELEMENT: symbol | undefined = Object.getOwnPropertySymbols((solidH as any)("div"))[0];

function convert(args: any[], name: string | null): any[] {
  const out = new Array(args.length);
  out[0] = args[0];
  for (let i = 1; i < args.length; i++) {
    const v = args[i];
    out[i] =
      // the second argument is the props object — unless it is a hole (a
      // path or a selection is an object too)
      i === 1 &&
      v != null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      !(v instanceof Node) &&
      (v as any)[READ] === undefined
        ? toHoleProps(v, name)
        : toHole(v, name);
  }
  return out;
}

/**
 * `h(tag | Component, props?, ...children)`: holes are converted for Solid's
 * `h` (a bare `function*` hole becomes a block, a generator render callback
 * runs a row block, paths become accessors). Each materialization converts
 * the arguments afresh: Solid's `h` turns function props into getters on the
 * props object it is given, so materializing one thunk twice (a `Loading`
 * re-rendering its content) failed on the second pass ("Cannot set property
 * children … which has only a getter"), with or without blocks.
 */
export const h: BlocksH = ((...args: any[]) => {
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  // the holes are the block's that built this output (dev errors name it)
  const name = blockName();
  const thunk: any = () => (solidH as any)(...convert(args, name))();
  if (ELEMENT) thunk[ELEMENT] = true;
  return thunk;
}) as any;
(h as any).Fragment = (solidH as any).Fragment;

export type { Hole, HViewOf };
export type { Component };
