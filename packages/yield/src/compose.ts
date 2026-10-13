/*
 * `compose(schema)` (D-118): one container store for several modules'
 * states, on the convention that a lens is a pair of props — a path to read
 * and a handler to write (`Part<S>`) — given as two props, or as one
 * required context's value (a bag, held as it is).
 */
import { $event, $store } from "./runtime.js";
import { provideEach } from "./flow.js";
import type { CONTEXT, Provide, RequiredContext } from "./context.js";
import type { Create, Handler, Path, StoreSetter, Yieldable } from "./types.js";

/**
 * One part of a store as a child takes it (D-118: a lens is a convention):
 * a path to read and an `$event` that writes it, `set(d => { d.checkIn =
 * null; })`. Given as two props, or as one context's value.
 */
export interface Part<S> {
  readonly at: Path<S>;
  readonly set: Handler<[write: (draft: S) => void]>;
}
/**
 * One entry of a `compose` schema: the part's initial state, made fresh for
 * each container (the schema is shared by every instance), and the required
 * context that gives it to its module, if any (else it is given as props).
 */
export interface ComposeEntry {
  readonly init: () => object;
  readonly context?: AnyRequiredContext;
}
/** Any required context (for constraints). */
type AnyRequiredContext = { readonly [CONTEXT]: { readonly value: any; readonly name: string } } & {
  readonly orElse: unknown;
};
/** The container's state: each entry's `init` result. */
export type ComposedState<Sc> = {
  -readonly [K in keyof Sc]: Sc[K] extends { readonly init: () => infer S } ? S : never;
};
/** The contexts a composed provider gives and discharges: those its entries name. */
export type ComposedContexts<Sc> = {
  [K in keyof Sc]-?: Sc[K] extends { readonly context?: infer C } ? Exclude<C, undefined> : never;
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
/** An entry whose context carries something else than its part (`Part<S>` of its `init`'s state) is refused, naming it. */
export type ComposeCheck<Sc> = {
  [K in keyof Sc]: Sc[K] extends {
    readonly init: () => infer S;
    readonly context: RequiredContext<infer T, any>;
  }
    ? [Part<S>] extends [T]
      ? [T] extends [Part<S>]
        ? unknown
        : ComposePartMessage<K>
      : ComposePartMessage<K>
    : unknown;
};
type ComposePartMessage<K> = {
  readonly [M in `[COMPOSE_PART] entry \`${K & string}\`'s context must carry its part: createContext<Part<State>, "Name">(undefined, { name: "Name" })`]: never;
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
   * one `Ctx.provide` around the children for every entry that names a
   * context, each given its part; the children's requirements of those
   * contexts are discharged.
   */
  readonly provide: Provide<ComposedStore<S>, Q, ComposedStore<S>>;
}

/**
 * `compose({ dates: { init: initDates, context: DateRangeCtx }, guests: { init: initGuests } })`
 * (D-118): one container for several modules' states. The page that owns
 * it makes it (`$store()`), hands each module its part — as two props
 * (`at`, `set`) or through its context (`provide`) — and reads the parts'
 * public state through the container's path for cross-module logic.
 */
export function compose<const Sc extends { readonly [key: string]: ComposeEntry }>(
  schema: Sc & ComposeCheck<Sc>
): Composed<ComposedState<Sc>, ComposedContexts<Sc>>;
export function compose(schema: { readonly [key: string]: ComposeEntry }): unknown {
  const keys = Object.keys(schema);
  const provided = keys.filter(k => schema[k].context !== undefined);
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
        (value: any) => provided.map(k => [schema[k].context, value.parts[k]] as const),
        props
      )
  };
}
