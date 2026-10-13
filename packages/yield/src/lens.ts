/*
 * State slots and composed containers (D-118), on lenses.
 *
 * A lens (`Lens<S>`, types.ts) is a read path and a draft setter on one part
 * of a store: `$store`'s result is one, and `focus(lens, key)` (runtime.ts)
 * narrows one. It is a reference — held, never read — so wherever it arrives
 * it arrives as itself: a lens prop, or a slot.
 *
 * A slot is a named, required context whose value is a lens:
 *
 *   export const DateRangeState = createSlot<DateRangeS, "DateRangeState">({ name: "DateRangeState" });
 *   const [range, setRange] = yield* $slot(DateRangeState);              // required: in R
 *   const [range, setRange] = yield* $slot(DateRangeState, { init });    // or a local store
 *
 * bound with `DateRangeState.provide({ value: focus(booking, "dates"), children })`.
 *
 * `compose(schema)` makes one container store from the modules' initial
 * states, a lens on each part, and one provider for every part given
 * through a slot.
 */
declare const __DEV__: boolean;

import type { Context } from "solid-js";
import {
  CreateOp,
  devError,
  focus,
  NO_SLOT,
  readSlot,
  solidCreateContext,
  storeLens
} from "./runtime.js";
import { provideEach, provideView } from "./flow.js";
import type { CONTEXT, Provide } from "./context.js";
import type { ContextRead, Create, Lens, Yieldable } from "./types.js";

/** Phantom brand of a slot (D-118): its state type, invariant. */
export declare const SLOT: unique symbol;

/**
 * A state slot (D-118): a named context whose value is a `Lens<S>`, always
 * required (a slot has no default: a standalone module gives `$slot` an
 * `init`). It is read with `yield* $slot(Slot)` only — `yield* Slot` is not a
 * read (a context gives a path, and a lens is held, not read) — and bound
 * with `Slot.provide({ value: lens, children })`, which takes a settled lens
 * and discharges the slot from the children's requirements. The requirement
 * is the slot itself, nominal as a context's (D-098 amended): a context of
 * the same value type and name is another requirement, as it is another
 * provider at run time.
 */
export interface Slot<S extends object, N extends string = string> extends Context<Lens<S>> {
  readonly [CONTEXT]: { readonly value: (value: Lens<S>) => Lens<S>; readonly name: N };
  readonly [SLOT]: (state: S) => S;
  /** `{yield* Slot.provide({ value: focus(booking, "dates"), children: function* () { … } })}`. */
  readonly provide: Provide<Lens<S>, Slot<S, N>, Lens<S>>;
}
/** Any slot (for constraints). */
export type AnySlot = {
  readonly [SLOT]: (state: never) => unknown;
  readonly [CONTEXT]: { readonly value: any; readonly name: string };
};

/** `createSlot<S>({ name })` without a name literal: refused, as an unnamed context is (D-098 amended). */
export type UnnamedSlotCall =
  '[UNNAMED_CONTEXT] a slot needs a name: createSlot<State, "StateSlot">({ name: "StateSlot" })';

/**
 * `createSlot<DateRangeS, "DateRangeState">({ name: "DateRangeState" })`: a
 * state slot (D-118). The name is its requirement's identity and what the
 * root's refusal prints; it is passed at run time too (type arguments are
 * erased), as a required context's is.
 */
export function createSlot<S extends object, N extends string = string>(
  this: string extends N ? UnnamedSlotCall : void,
  options: { name: N }
): Slot<S, N>;
export function createSlot(this: unknown, options: { name: string }): unknown {
  if (__DEV__ && !options?.name)
    throw devError(
      "CONTEXT_NAME",
      "a slot needs a runtime name: createSlot<State, 'StateSlot'>({ name: 'StateSlot' }). Type arguments disappear at runtime."
    );
  // the sentinel default tells `$slot` "no provider" apart from any error
  const slot = solidCreateContext<unknown>(NO_SLOT, { name: options.name }) as any;
  slot.provide = (props: unknown) => provideView(slot, props);
  slot[Symbol.iterator] = function* (): Generator<never, never, unknown> {
    throw devError(
      "SLOT_READ",
      `the slot ${options.name} is read with yield* $slot(${options.name}), which gives its lens; yield* ${options.name} is not a read.`
    );
  };
  return slot;
}

/**
 * `const [range, setRange] = yield* $slot(DateRangeState)` in a setup
 * (D-118): the lens the nearest `DateRangeState.provide` above gives, as
 * itself. It adds the slot to the component's requirements (`R`), as
 * `yield* Ctx` does a context without a default: `render` refuses a root
 * that still requires it (`[NO_PROVIDER]`), and with no provider above at
 * run time it is `NO_PROVIDER` at the read.
 *
 * `yield* $slot(DateRangeState, { init })`: the provider's lens when there
 * is one, else a local `$store(init)` that this component owns (a module
 * that also works alone). It requires nothing. `init` is the store's value,
 * as `$store`'s is: write it in the setup, so each instance has its own.
 *
 * A setup operation: outside a setup it is `CONTEXT_OUTSIDE_SETUP`, the
 * `init` form `CREATE_OUTSIDE_SETUP`.
 */
export function $slot<S extends object, N extends string>(
  slot: Slot<S, N>
): Yieldable<ContextRead<Slot<S, N>>, Lens<S>>;
export function $slot<S extends object, N extends string>(
  slot: Slot<S, N>,
  options: { init: NoInfer<S> }
): Yieldable<Create<"slot">, Lens<S>>;
export function $slot(slot: unknown, options?: { init: object }): unknown {
  return new SlotRead(slot, options);
}
class SlotRead {
  constructor(
    readonly slot: unknown,
    readonly options: { init: object } | undefined
  ) {}
  *[Symbol.iterator](): Generator<never, unknown, unknown> {
    return readSlot(this.slot, this.options);
  }
}

// --- compose ------------------------------------------------------------------------------------

/**
 * One entry of a `compose` schema: the module's initial state, made fresh
 * for each container (the schema is shared by every instance), and the
 * slot that gives the module its lens, if any (else a lens prop, from
 * `lenses`).
 */
export interface ComposeEntry {
  readonly init: () => object;
  readonly slot?: AnySlot;
}
/** The container's state: each entry's `init` result. */
export type ComposedState<Sc> = {
  -readonly [K in keyof Sc]: Sc[K] extends { readonly init: () => infer S } ? S : never;
};
/** The slots a composed provider binds: those of its schema's entries. */
export type ComposedSlots<Sc> = {
  [K in keyof Sc]-?: Sc[K] extends { readonly slot?: infer Sl } ? Exclude<Sl, undefined> : never;
}[keyof Sc];
/** An entry whose slot carries another state type than its `init` makes is refused, naming it. */
export type ComposeCheck<Sc> = {
  [K in keyof Sc]: Sc[K] extends {
    readonly init: () => infer S;
    readonly slot: { readonly [SLOT]: (state: infer T) => unknown };
  }
    ? [S] extends [T]
      ? [T] extends [S]
        ? unknown
        : SlotStateMessage<K>
      : SlotStateMessage<K>
    : unknown;
};
type SlotStateMessage<K> = {
  readonly [M in `[SLOT_STATE] entry \`${K & string}\`'s slot carries another state type than its init makes`]: never;
};

/**
 * What `compose(schema)` gives (D-118): a container of the modules' states.
 * `S` is its state's type, for annotations only (`typeof Booking.S`; it is
 * `undefined` at run time).
 */
export interface Composed<S extends object, Q> {
  /** Type only: the container's state (`Lens<typeof Booking.S>`). `undefined` at run time. */
  readonly S: S;
  /** A fresh initial state: every entry's `init()`. A composed container can be an entry of a larger one (`{ init: Booking.init }`). */
  init(): S;
  /** `const booking = yield* Booking.$store()` in a setup: one `$store` of `init()`, owned by the component. */
  $store(): Yieldable<Create<"store">, Lens<S>>;
  /** `Booking.lenses(booking)`: `focus(booking, key)` for every entry (for lens props). It reads nothing. */
  lenses<E = never, P extends boolean = false>(
    lens: Lens<S, E, P>
  ): { readonly [K in keyof S]: Lens<Extract<S[K], object>, E, P> };
  /**
   * `{yield* Booking.provide({ value: booking, children: function* () { … } })}`:
   * one `Slot.provide` around the children for every entry with a slot, each
   * given `focus(value, key)`; their requirements of those slots are
   * discharged.
   */
  readonly provide: Provide<Lens<S>, Q, Lens<S>>;
}

/**
 * `compose({ dates: { init: initDates, slot: DateRangeState }, guests: { init: initGuests } })`
 * (D-118): one container for several modules' states. The page that owns
 * it makes it (`$store()`), hands each module its lens — as a prop
 * (`lenses`) or through its slot (`provide`) — and reads the parts' public
 * state through the container's path for cross-module logic.
 */
export function compose<const Sc extends { readonly [key: string]: ComposeEntry }>(
  schema: Sc & ComposeCheck<Sc>
): Composed<ComposedState<Sc>, ComposedSlots<Sc>>;
export function compose(schema: { readonly [key: string]: ComposeEntry }): unknown {
  const keys = Object.keys(schema);
  const slotted = keys.filter(k => schema[k].slot !== undefined);
  const init = () => {
    const state: Record<string, object> = {};
    for (const k of keys) state[k] = schema[k].init();
    return state;
  };
  return {
    S: undefined,
    init,
    $store: () => new CreateOp("store", () => storeLens(init(), "a compose(…) store's setter")),
    lenses: (lens: any) => {
      const parts: Record<string, unknown> = {};
      for (const k of keys) parts[k] = (focus as any)(lens, k);
      return parts;
    },
    provide: (props: unknown) =>
      provideEach(
        value => slotted.map(k => [schema[k].slot, (focus as any)(value, k)] as const),
        props
      )
  };
}
