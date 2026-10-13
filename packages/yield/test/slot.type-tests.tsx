/**
 * Type tests for D-118: an `$event` handler prop is the handler itself (a
 * reference, held, never read), state slots are required contexts whose
 * value a setup holds raw, and `compose` builds the path-and-handler
 * convention. The runtime half is slot.spec.tsx. Type-checked by
 * `test-types`.
 */
import {
  $event,
  $signal,
  $slot,
  $store,
  component,
  compose,
  createSlot,
  Failure,
  render,
  view,
  type ComposedStore,
  type ContextRead,
  type Create,
  type EventHandler,
  type Handler,
  type Part,
  type Path,
  type Props,
  type RequiresOf,
  type Slot,
  type Source,
  type View
} from "solid-yield";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type RequiresOfComponent<C> = C extends (...args: any[]) => View<any, any, any, infer R>
  ? R
  : never;
declare const root: HTMLElement;

// --- an $event handler prop is the handler itself ------------------------------------------

type PickProps = Props<{ theme: string; onPick: Handler<[theme: string]> }>;
// the handler prop reads as the handler; a bare prop still as a path
type _handlerProp = Expect<Equal<PickProps["onPick"], Handler<[theme: string]>>>;
type _bareProp = Expect<Equal<PickProps["theme"], Path<string>>>;

export const Picker = component(function* Picker(props: PickProps) {
  // one yield*: called as a local event (its colors join the caller's)
  const dark = $event(function* () {
    yield* props.onPick("dark");
  });
  const old = $event(function* () {
    // @ts-expect-error the old double yield: `yield* props.onPick` binds, and gives no handler to call
    yield* (yield* props.onPick)("dark");
  });
  void old;
  return view(function* () {
    return (
      <>
        <button onClick={yield* dark}>dark</button>
        {/* bound in the view with one yield*, as a local event */}
        <button onClick={[yield* props.onPick, "light"]}>light</button>
      </>
    );
  });
});

export const PickerHost = component(function* PickerHost() {
  const pick = $event(function* (_theme: string) {});
  const [handler] = yield* $signal(pick);
  return view(function* () {
    return (
      <>
        {yield* Picker({ theme: "dark", onPick: pick })}
        {/* @ts-expect-error [HANDLER_PROP] a source of a handler is refused: an event does not vary per render */}
        {yield* Picker({ theme: "dark", onPick: handler })}
        {
          yield* Picker({
            theme: "dark",
            // @ts-expect-error [HANDLER_PROP] a hole is refused
            onPick: function* () {
              return pick;
            }
          })
        }
        {/* @ts-expect-error [HANDLER_PROP] a plain function is not an $event */}
        {yield* Picker({ theme: "dark", onPick: (_t: string) => {} })}
      </>
    );
  });
});

// @ts-expect-error [OPTIONAL_HANDLER] a handler prop is required: the runtime cannot tell a missing one
type _optional = Props<{ onPick?: Handler<[theme: string]> }>;
// the way to an optional handler: a source of it, read as before
type OptionalProps = Props<{ onPick: Source<Handler<[theme: string]> | undefined> }>;
type _optionalRead = Expect<
  Equal<OptionalProps["onPick"], Path<Handler<[theme: string]> | undefined>>
>;
// a plain function-typed prop is not a handler: still a path
type FnProps = Props<{ log: (s: string) => void }>;
type _fn = Expect<Equal<FnProps["log"], Path<(s: string) => void>>>;
// a handler inside an object prop stays a path (only the prop itself is held)
type BagProps = Props<{ log: { clear: Handler } }>;
type _bag = Expect<Equal<BagProps["log"]["clear"], Path<Handler>>>;
// a generic handler prop keeps its colors: an event that may fail
class Boom extends Failure("boom") {}
type Failing = EventHandler<[], Boom, void, false, false>;
export const Forwards = component(function* Forwards(props: Props<{ onSave: Failing }>) {
  const save = $event(function* () {
    yield* props.onSave();
  });
  return view(function* () {
    return <button onClick={yield* save}>save</button>;
  });
});

// --- state slots ---------------------------------------------------------------------------

type DateRangeS = { checkIn: number | null; checkOut: number | null };
const DateRangeState = createSlot<Part<DateRangeS>, "DateRangeState">({ name: "DateRangeState" });
type _slot = Expect<Equal<typeof DateRangeState, Slot<Part<DateRangeS>, "DateRangeState">>>;

// @ts-expect-error [UNNAMED_CONTEXT] a slot needs a name literal
createSlot<Part<DateRangeS>>({ name: "Nameless" });

// the required form: the value raw, and the slot in the component's requirements
type ReadOf<V> = V extends { [Symbol.iterator](): Generator<infer Y, infer R, any> } ? [Y, R] : never;
const requiredRead = $slot(DateRangeState);
type _required = Expect<
  Equal<ReadOf<typeof requiredRead>, [ContextRead<typeof DateRangeState>, Part<DateRangeS>]>
>;
export const DateRange = component(function* DateRange() {
  const range = yield* $slot(DateRangeState);
  const clear = $event(function* () {
    yield* range.set(d => {
      d.checkIn = null;
    });
  });
  return view(function* () {
    return <button onClick={yield* clear}>{yield* range.at.checkIn}</button>;
  });
});
type _in = Expect<Equal<RequiresOfComponent<typeof DateRange>, typeof DateRangeState>>;
// @ts-expect-error [NO_PROVIDER] the root requires "DateRangeState"
render(DateRange, root);

// `yield* Slot` is not a read: a slot is read with $slot
export const Wrong = component(function* Wrong() {
  // @ts-expect-error a slot has no iterator: read it with yield* $slot(Slot)
  yield* DateRangeState;
  return view(function* () {
    return <i />;
  });
});

// discharged by Slot.provide around the call, which takes the value itself
export const Provided = component(function* Provided() {
  const [at, setAt] = yield* $store<DateRangeS>({ checkIn: null, checkOut: null });
  const set = $event(function* (write: (d: DateRangeS) => void) {
    yield* setAt(d => {
      write(d);
    });
  });
  const [asSource] = yield* $signal<Part<DateRangeS>>({ at, set });
  return view(function* () {
    return (
      <>
        {
          yield* DateRangeState.provide({
            value: { at, set },
            children: function* () {
              return <>{yield* DateRange()}</>;
            }
          })
        }
        {
          yield* DateRangeState.provide({
            // @ts-expect-error a slot's value is held raw: not a source
            value: asSource,
            children: function* () {
              return <>{yield* DateRange()}</>;
            }
          })
        }
      </>
    );
  });
});
type _discharged = Expect<Equal<RequiresOfComponent<typeof Provided>, never>>;
render(Provided, root);

// the init form adds nothing: its init routine's creations are the setup's
export const Standalone = component(function* Standalone() {
  const range = yield* $slot(DateRangeState, {
    init: function* () {
      const [at, setAt] = yield* $store<DateRangeS>({ checkIn: null, checkOut: null });
      return {
        at,
        set: $event(function* (write: (d: DateRangeS) => void) {
          yield* setAt(d => {
            write(d);
          });
        })
      };
    }
  });
  return view(function* () {
    return <i>{yield* range.at.checkIn}</i>;
  });
});
type _standalone = Expect<Equal<RequiresOfComponent<typeof Standalone>, never>>;
render(Standalone, root);
// the init routine returns the slot's value type
export const BadInit = component(function* BadInit() {
  yield* $slot(DateRangeState, {
    // @ts-expect-error the init routine must return the slot's value (a Part<DateRangeS>)
    init: function* () {
      return { at: null };
    }
  });
  return view(function* () {
    return <i />;
  });
});
type _initOps = Expect<
  Equal<
    ReadOf<ReturnType<typeof $slot<Part<DateRangeS>, "DateRangeState", Create<"store">>>>[0],
    Create<"store"> | Create<"slot">
  >
>;

// --- compose -------------------------------------------------------------------------------

type GuestsS = { adults: number };
const Booking = compose({
  dates: { init: (): DateRangeS => ({ checkIn: null, checkOut: null }), slot: DateRangeState },
  guests: { init: (): GuestsS => ({ adults: 1 }) }
});
type _S = Expect<Equal<typeof Booking.S, { dates: DateRangeS; guests: GuestsS }>>;
type BookingStore = ReadOf<ReturnType<typeof Booking.$store>>;
type _store = Expect<
  Equal<BookingStore, [Create<"store">, ComposedStore<{ dates: DateRangeS; guests: GuestsS }>]>
>;
type _part = Expect<
  Equal<BookingStore[1]["parts"]["guests"], Part<GuestsS>>
>;
type _partAt = Expect<Equal<Part<GuestsS>["at"], Path<GuestsS>>>;

const Guests = component(function* Guests(
  props: Props<{ guests: GuestsS; setGuests: Handler<[write: (d: GuestsS) => void]> }>
) {
  return view(function* () {
    return <i>{yield* props.guests.adults}</i>;
  });
});
export const BookingPage = component(function* BookingPage() {
  const booking = yield* Booking.$store();
  return view(function* () {
    return (
      <main>
        {
          yield* Booking.provide({
            value: booking,
            children: function* () {
              return (
                <>
                  {yield* DateRange()}
                  {yield* Guests({
                    guests: booking.parts.guests.at,
                    setGuests: booking.parts.guests.set
                  })}
                </>
              );
            }
          })
        }
      </main>
    );
  });
});
// compose's provide discharges the slots its entries name
type _composed = Expect<Equal<RequiresOfComponent<typeof BookingPage>, never>>;
render(BookingPage, root);

// an entry whose slot carries another value than its part is refused
const OtherSlot = createSlot<{ at: Path<GuestsS> }, "OtherSlot">({ name: "OtherSlot" });
compose({
  // @ts-expect-error [SLOT_PART] the slot must carry its entry's part
  guests: { init: (): GuestsS => ({ adults: 1 }), slot: OtherSlot }
});
