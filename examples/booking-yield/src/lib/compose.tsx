// A state container, as a convention: one store, a slice per key, one provider per slotted key.
import {
  $event,
  $store,
  type ComponentView,
  type ViewFails,
  type ViewMayWait,
  type ViewOp,
  type ViewPending,
  type ViewRequires
} from "solid-yield";
import { focus, type Slice } from "./lens";

type Schema = { [key: string]: { readonly init: () => unknown; readonly slot?: object } };
type StateOf<C> = { [K in keyof C]: C[K] extends { init: () => infer S } ? S : never };
type SlotsOf<C> = { [K in keyof C]: C[K] extends { readonly slot: infer Q } ? Q : never }[keyof C];
type Provider = { provide(props: { value: unknown; children: () => Generator }): Generator };

/** `const booking = yield* compose({ dates: { init, slot }, … })` in a setup: the page owns the store. */
export function* compose<C extends Schema>(schema: C) {
  const keys = Object.keys(schema) as (keyof C & string)[];
  const state = {} as StateOf<C>;
  for (const key of keys) state[key] = schema[key].init() as StateOf<C>[typeof key];
  const [at, setAt] = yield* $store(state);
  const set = $event(function* (write: (draft: StateOf<C>) => StateOf<C> | void) {
    yield* setAt(draft => write(draft as StateOf<C>));
  });
  const parts = {} as { [K in keyof C]: Slice<StateOf<C>[K]> };
  for (const key of keys) parts[key] = focus({ at, set } as Slice<StateOf<C>>, key);
  const slotted = keys.filter(key => schema[key].slot !== undefined);
  const provider = (i: number) => schema[slotted[i]].slot as Provider;

  /** `{yield* booking.provide({ children: function* () { return <…/>; } })}`: one provider per slotted key. */
  function provide<Y extends ViewOp = never, R = unknown>(props: {
    children: () => Generator<Y, R, unknown>;
  }): ComponentView<
    ViewPending<Y, R>,
    ViewFails<Y, R>,
    ViewMayWait<Y, R>,
    Exclude<ViewRequires<Y, R>, SlotsOf<C>>
  > {
    const nest = (i: number): (() => Generator) =>
      i === slotted.length
        ? props.children
        : function* () {
            return (
              <>{yield* provider(i).provide({ value: parts[slotted[i]], children: nest(i + 1) })}</>
            );
          };
    if (slotted.length === 0) throw new Error("compose: provide needs a key with a slot");
    return provider(0).provide({ value: parts[slotted[0]], children: nest(1) }) as never;
  }
  return { at, set, parts, provide };
}
