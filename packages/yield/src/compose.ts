/*
 * `compose` (D-117): one container store from a schema of modules. Each
 * entry is a module's state: its `init`, and the slot it is read through, if
 * it is. The composer makes the container in a setup (`$store()`), gives a
 * lens on each part for lens props (`lenses(lens)`), and binds each slot
 * to its part (`provide`). It is plain library code on `focus` and slots.
 */

import { CreateOp, focus, newStoreLens } from "./runtime.js";
import { childrenView, provideView, type Children, type LazyParam, type Ops } from "./flow.js";
import type { CONTEXT, Slot } from "./context.js";
import type {
  ComponentView,
  Create,
  FailsOf,
  Lens,
  MayWaitOf,
  PendingOf,
  RequiresOf,
  Settle,
  Yieldable
} from "./types.js";

/** One module in a schema: its initial state, and the slot it reads through (if any). */
export interface ComposeEntry<S extends object = object> {
  readonly init: () => S;
  /** A slot of this entry's state (`SchemaCheck` holds it to the entry's state). */
  readonly slot?: { readonly [CONTEXT]: { readonly name: string } };
}
/** A schema: one entry per part of the container. */
export type ComposeSchema = { readonly [key: string]: ComposeEntry<any> };
/** The container's state: each entry's state at its key. */
export type ComposedState<D> = {
  -readonly [K in keyof D]: D[K] extends { init: () => infer S } ? S : never;
};
/** The slots a schema binds (what its `provide` discharges). */
export type ComposedSlots<D> = {
  [K in keyof D]-?: D[K] extends { readonly slot?: infer Q } ? Exclude<Q, undefined> : never;
}[keyof D];
/** Each entry's slot must be a slot of that entry's state (slots are invariant). */
type SchemaCheck<D> = {
  [K in keyof D]: D[K] extends { readonly slot: { readonly [CONTEXT]: { readonly name: infer N } } }
    ? { readonly slot: Slot<ComposedState<D>[K], N & string> }
    : unknown;
};

/** What `compose` gives (D-117). */
export interface Composer<D> {
  /** A new container state: each entry's `init()`. */
  init(): ComposedState<D>;
  /** `const booking = yield* Booking.$store()` in a setup: the container, owned by this component. */
  $store(): Yieldable<Create<"store">, Lens<ComposedState<D>>>;
  /** One lens per entry, focused on its part, for lens props. Reads nothing. */
  lenses<E, P extends boolean>(
    lens: Lens<ComposedState<D>, E, P>
  ): { readonly [K in keyof D]: Lens<ComposedState<D>[K], E, P> };
  /**
   * `{yield* Booking.provide({ value: booking, children: function* () { … } })}`:
   * binds each entry's slot to its part of `value`, for the components called
   * in `children`, and discharges those slots.
   */
  provide<C>(props: {
    value: Lens<ComposedState<D>>;
    children: LazyParam<C, Children<[]>, "children">;
  }): ComponentView<
    PendingOf<Ops<C>>,
    FailsOf<Ops<C>>,
    MayWaitOf<Ops<C>>,
    Exclude<Settle<RequiresOf<Ops<C>>>, ComposedSlots<D>>
  >;
}

/**
 * `compose({ dates: { init: initDateRange, slot: DateRangeState }, guests: {
 * init: initGuests } })` (D-117): a container of modules. An entry with a
 * slot is bound by `provide`; an entry without one is given as a lens prop,
 * from `lenses`. A composer's state can be an entry of a larger schema.
 */
export function compose<const D extends ComposeSchema>(schema: D & SchemaCheck<D>): Composer<D>;
export function compose(schema: ComposeSchema): Composer<any> {
  const keys = Object.keys(schema);
  const slotted = keys.filter(k => schema[k].slot !== undefined);
  const init = () => {
    const state: Record<string, object> = {};
    for (const k of keys) state[k] = schema[k].init();
    return state;
  };
  return {
    init,
    $store: () => new CreateOp("store", () => newStoreLens(init())) as any,
    lenses: (lens: any) => {
      const parts: Record<string, unknown> = {};
      for (const k of keys) parts[k] = focus(lens, k as never);
      return parts as any;
    },
    provide: ((props: any) => {
      if (!slotted.length) return childrenView(props);
      const lens = props.value;
      // outermost first: each provider's children are the next provider
      const bind = (i: number): unknown =>
        provideView(schema[slotted[i]].slot as any, {
          value: focus(lens, slotted[i] as never),
          children: i === slotted.length - 1 ? props.children : () => bind(i + 1)
        });
      return bind(0);
    }) as any
  };
}
