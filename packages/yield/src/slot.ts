/*
 * State slots (D-118).
 *
 * A slot is a named, required context whose provided value a setup holds
 * raw: `yield* $slot(Slot)` gives the value itself, where `yield* Ctx` gives
 * a path over it (D-042). A slot carries references — what a setup holds and
 * never reads: a path to read a part of a parent's store and the `$event`
 * that writes it (a lens is a convention, not a primitive: `{ at, set }`).
 *
 *   type DateRangeSlot = { at: Path<DateRangeS>; set: Handler<[(d: DateRangeS) => void]> };
 *   export const DateRangeState = createSlot<DateRangeSlot, "DateRangeState">({ name: "DateRangeState" });
 *
 *   const range = yield* $slot(DateRangeState);              // required: in R
 *   const range = yield* $slot(DateRangeState, { init });    // or a local one
 *
 * bound with `DateRangeState.provide({ value: { at, set }, children })`.
 */
declare const __DEV__: boolean;

import type { Context } from "solid-js";
import { $event, $store, devError, NO_SLOT, readSlot, solidCreateContext } from "./runtime.js";
import { provideEach, provideView } from "./flow.js";
import type { CONTEXT, Provide } from "./context.js";
import type {
  ContextRead,
  Create,
  Handler,
  Path,
  SetupOp,
  StoreSetter,
  Yieldable
} from "./types.js";

/** Phantom brand of a slot (D-118): its value type, invariant. */
export declare const SLOT: unique symbol;

/**
 * A state slot (D-118): a named context whose provided value a setup holds
 * raw, always required (a slot has no default: a module that also works
 * alone gives `$slot` an `init`). It is read with `yield* $slot(Slot)` only
 * — `yield* Slot` is not a read — and bound with `Slot.provide({ value,
 * children })`, which takes the value itself (not a source or a hole: the
 * reader holds it) and discharges the slot from the children's
 * requirements. The requirement is the slot itself, nominal as a context's
 * (D-098 amended): a context of the same value type and name is another
 * requirement, as it is another provider at run time.
 */
export interface Slot<T, N extends string = string> extends Context<T> {
  readonly [CONTEXT]: { readonly value: (value: T) => T; readonly name: N };
  readonly [SLOT]: (value: T) => T;
  /** `{yield* Slot.provide({ value, children: function* () { … } })}`. */
  readonly provide: Provide<T, Slot<T, N>, T & ({} | null)>;
}
/** Any slot (for constraints). */
export type AnySlot = {
  readonly [SLOT]: (value: never) => unknown;
  readonly [CONTEXT]: { readonly value: any; readonly name: string };
};

/** `createSlot<T>({ name })` without a name literal: refused, as an unnamed context is (D-098 amended). */
export type UnnamedSlotCall =
  '[UNNAMED_CONTEXT] a slot needs a name: createSlot<Value, "ValueSlot">({ name: "ValueSlot" })';

/**
 * `createSlot<DateRangeSlot, "DateRangeState">({ name: "DateRangeState" })`:
 * a state slot (D-118). The name is its requirement's identity and what the
 * root's refusal prints; it is passed at run time too (type arguments are
 * erased), as a required context's is.
 */
export function createSlot<T, N extends string = string>(
  this: string extends N ? UnnamedSlotCall : void,
  options: { name: N }
): Slot<T, N>;
export function createSlot(this: unknown, options: { name: string }): unknown {
  if (__DEV__ && !options?.name)
    throw devError(
      "CONTEXT_NAME",
      "a slot needs a runtime name: createSlot<Value, 'ValueSlot'>({ name: 'ValueSlot' }). Type arguments disappear at runtime."
    );
  // the sentinel default tells `$slot` "no provider" apart from any error
  const slot = solidCreateContext<unknown>(NO_SLOT, { name: options.name }) as any;
  slot.provide = (props: unknown) => provideView(slot, props);
  slot[Symbol.iterator] = function* (): Generator<never, never, unknown> {
    throw devError(
      "SLOT_READ",
      `the slot ${options.name} is read with yield* $slot(${options.name}), which gives its value as it is; yield* ${options.name} is not a read.`
    );
  };
  return slot;
}

/**
 * `const range = yield* $slot(DateRangeState)` in a setup (D-118): the value
 * the nearest `DateRangeState.provide` above gives, raw. It adds the slot to
 * the component's requirements (`R`), as `yield* Ctx` does a context
 * without a default: `render` refuses a root that still requires it
 * (`[NO_PROVIDER]`), and with no provider above at run time it is
 * `NO_PROVIDER` at the read.
 *
 * `yield* $slot(DateRangeState, { init: function* () { … } })`: the
 * provider's value when there is one, else what the init routine returns.
 * The init routine runs in the setup, as a generator helper does (its
 * creations are the component's): it makes the local state and its writer,
 * `const [at, setAt] = yield* $store({ … }); return { at, set: $event(…) };`.
 * This form requires nothing (beyond what its init routine reads).
 *
 * A setup operation: outside a setup it is `CONTEXT_OUTSIDE_SETUP`, the
 * `init` form `CREATE_OUTSIDE_SETUP`.
 */
export function $slot<T, N extends string>(slot: Slot<T, N>): Yieldable<ContextRead<Slot<T, N>>, T>;
export function $slot<T, N extends string, Y extends SetupOp = never>(
  slot: Slot<T, N>,
  options: { init: () => Generator<Y, NoInfer<T>, any> }
): Yieldable<Y | Create<"slot">, T>;
export function $slot(slot: unknown, options?: { init: () => Generator }): unknown {
  return new SlotRead(slot, options?.init);
}
class SlotRead {
  constructor(
    readonly slot: unknown,
    readonly init: (() => Generator) | undefined
  ) {}
  *[Symbol.iterator](): Generator<unknown, unknown, unknown> {
    const raw = readSlot(this.slot, this.init !== undefined);
    if (raw !== NO_SLOT) return raw;
    return yield* this.init!();
  }
}

// --- compose: the convention, for several parts of one store ------------------------------------

/**
 * One part of a store as a child takes it (D-118: a lens is a convention):
 * a path to read and an `$event` that writes it, `set(d => { d.checkIn =
 * null; })`. Given as two props, or as one slot's value.
 */
export interface Part<S> {
  readonly at: Path<S>;
  readonly set: Handler<[write: (draft: S) => void]>;
}
/**
 * One entry of a `compose` schema: the part's initial state, made fresh for
 * each container (the schema is shared by every instance), and the slot
 * that gives it to its module, if any (else it is given as props).
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
/**
 * What `yield* Schema.$store()` gives a setup: the container's path and
 * setter (as `$store`'s), and each entry's part.
 */
export interface ComposedStore<S extends object> {
  readonly at: Path<S>;
  readonly set: StoreSetter<S>;
  readonly parts: { readonly [K in keyof S]: Part<S[K]> };
}
/** An entry whose slot's value is not its part (`Part<S>` of its `init`'s state) is refused, naming it. */
export type ComposeCheck<Sc> = {
  [K in keyof Sc]: Sc[K] extends {
    readonly init: () => infer S;
    readonly slot: { readonly [SLOT]: (value: infer T) => unknown };
  }
    ? [Part<S>] extends [T]
      ? [T] extends [Part<S>]
        ? unknown
        : SlotPartMessage<K>
      : SlotPartMessage<K>
    : unknown;
};
type SlotPartMessage<K> = {
  readonly [M in `[SLOT_PART] entry \`${K & string}\`'s slot must carry its part: createSlot<Part<State>, "Name">`]: never;
};

/**
 * What `compose(schema)` gives (D-118). `S` is the container's state type,
 * for annotations only (`typeof Booking.S`; `undefined` at run time).
 */
export interface Composed<S extends object, Q> {
  /** Type only: the container's state. `undefined` at run time. */
  readonly S: S;
  /**
   * `const booking = yield* Booking.$store()` in a setup: one `$store` of
   * every entry's `init()`, owned by the component, and one setter `$event`
   * per entry (`booking.parts.dates.set`), which writes that entry's draft.
   */
  $store(): Yieldable<Create<"store">, ComposedStore<S>>;
  /**
   * `{yield* Booking.provide({ value: booking, children: function* () { … } })}`:
   * one `Slot.provide` around the children for every entry with a slot, each
   * given its part; the children's requirements of those slots are
   * discharged.
   */
  readonly provide: Provide<ComposedStore<S>, Q, ComposedStore<S>>;
}

/**
 * `compose({ dates: { init: initDates, slot: DateRangeState }, guests: { init: initGuests } })`
 * (D-118): one container for several modules' states. The page that owns
 * it makes it (`$store()`), hands each module its part — as two props
 * (`at`, `set`) or through its slot (`provide`) — and reads the parts'
 * public state through the container's path for cross-module logic.
 */
export function compose<const Sc extends { readonly [key: string]: ComposeEntry }>(
  schema: Sc & ComposeCheck<Sc>
): Composed<ComposedState<Sc>, ComposedSlots<Sc>>;
export function compose(schema: { readonly [key: string]: ComposeEntry }): unknown {
  const keys = Object.keys(schema);
  const slotted = keys.filter(k => schema[k].slot !== undefined);
  return {
    S: undefined,
    $store: () => ({
      *[Symbol.iterator](): Generator<unknown, unknown, unknown> {
        const state: Record<string, object> = {};
        for (const k of keys) state[k] = schema[k].init();
        const [at, set] = yield* $store(state);
        const parts: Record<string, Part<any>> = {};
        for (const k of keys)
          parts[k] = {
            at: (at as any)[k],
            set: $event(function* (write: (draft: any) => void) {
              yield* set(draft => {
                write(draft[k]);
              });
            })
          };
        return { at, set, parts };
      }
    }),
    provide: (props: unknown) =>
      provideEach(
        (value: any) => slotted.map(k => [schema[k].slot, value.parts[k]] as const),
        props
      )
  };
}
