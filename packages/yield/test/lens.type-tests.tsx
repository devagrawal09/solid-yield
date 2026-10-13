/**
 * Type tests for lenses, lens props, slots and `compose` (D-116, D-117). A
 * lens is a `$store`'s pair; `focus` narrows it to a key and keeps its
 * colors; a prop declared `Lens<S>` is the lens (not a path) and takes only
 * a lens; a required `$slot` adds the slot to the component's `R`, which
 * `Slot.provide` or a composer's `provide` discharges. The runtime half is
 * lens.spec.tsx. Type-checked by `test-types`.
 */
import {
  component,
  compose,
  createSlot,
  constant,
  $event,
  focus,
  $optimisticStore,
  render,
  $slot,
  $store,
  view,
  type ContextNames,
  type Lens,
  type LensKey,
  type Path,
  type Props,
  type StoreSetter,
  type UnnamedContext,
  type View
} from "solid-yield";
import { Failed } from "./failed.js";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type RequiresOfComponent<C> = C extends (...args: any[]) => View<any, any, any, infer R>
  ? R
  : never;
type ResultOf<Y> = Y extends { [Symbol.iterator](): Generator<any, infer R, any> } ? R : never;
declare const root: HTMLElement;

type Range = { from: number | null; to: number | null };
type Guests = { adults: number; kids: number };
type Booking = { dates: Range; guests: Guests; note: string };
const initRange = (): Range => ({ from: null, to: null });
const initGuests = (): Guests => ({ adults: 1, kids: 0 });

// --- Lens and focus ----------------------------------------------------------------------------

// a $store's result is a lens; it destructures as before
type _store = Expect<Equal<ResultOf<ReturnType<typeof $store<Booking>>>, Lens<Booking>>>;
declare const booking: Lens<Booking>;
const [bookingPath, setBooking] = booking;
type _path = Expect<Equal<typeof bookingPath, Path<Booking>>>;
type _setter = Expect<Equal<typeof setBooking, StoreSetter<Booking>>>;

// focus narrows to an object key; a scalar key is refused
type _keys = Expect<Equal<LensKey<Booking>, "dates" | "guests">>;
type _focus = Expect<Equal<ReturnType<typeof focus<Booking, "dates", never, false>>, Lens<Range>>>;
const dates = focus(booking, "dates");
type _dates = Expect<Equal<typeof dates, Lens<Range>>>;
// @ts-expect-error a scalar key: write it through its parent's lens
focus(booking, "note");
// @ts-expect-error not a key of the state
focus(booking, "nights");
// @ts-expect-error a lens is made by the library, not written as a pair
const _pair: Lens<Range> = [dates[0], dates[1]];

// focus keeps the colors of the container's path
const Colored = component(function* Colored() {
  const list = yield* $optimisticStore(
    function* (_draft: { page: { items: string[] } }) {
      return undefined;
    },
    { page: { items: [] } }
  );
  const page = focus(list, "page");
  type _colored = Expect<Equal<typeof page, Lens<{ items: string[] }, never, false>>>;
  return view(function* () {
    return <p>{(yield* page[0].items).length}</p>;
  });
});
void Colored;

// --- lens props --------------------------------------------------------------------------------

const DateRange = component(function* DateRange(props: Props<{ state: Lens<Range> }>) {
  // the lens as it is (D-116 amends D-042), not a path over it
  type _given = Expect<Equal<typeof props.state, Lens<Range>>>;
  const [range, setRange] = props.state;
  const clear = $event(function* () {
    yield* setRange(d => {
      d.from = null;
      d.to = null;
    });
  });
  return view(function* () {
    return (
      <button onClick={yield* clear}>
        {yield* range.from}–{yield* range.to}
      </button>
    );
  });
});
type _noRequire = Expect<Equal<RequiresOfComponent<typeof DateRange>, never>>;

const Page = component(function* Page() {
  const page = yield* $store<Booking>({ dates: initRange(), guests: initGuests(), note: "" });
  const [state] = page;
  return view(function* () {
    return (
      <div>
        {yield* DateRange({ state: focus(page, "dates") })}
        {
          // @ts-expect-error a lens prop is required: the call site shows the binding
          yield* DateRange()
        }
        {
          // @ts-expect-error a lens prop takes a lens, not a path
          yield* DateRange({ state: state.dates })
        }
        {
          // @ts-expect-error … nor a value
          yield* DateRange({ state: initRange() })
        }
        {
          // @ts-expect-error … nor a source
          yield* DateRange({ state: constant(focus(page, "dates")) })
        }
        {
          // @ts-expect-error … of the declared state only (lenses are invariant)
          yield* DateRange({ state: focus(page, "guests") })
        }
      </div>
    );
  });
});
render(Page, root);

// a settled lens prop refuses a lens that may fail
declare const failing: Lens<Range, Failed>;
const Parent = component(function* Parent() {
  return view(function* () {
    return (
      <div>
        {
          // @ts-expect-error the prop is settled: declare Lens<Range, E> to take a failing lens
          yield* DateRange({ state: failing })
        }
      </div>
    );
  });
});
void Parent;

// --- slots -------------------------------------------------------------------------------------

const RangeState = createSlot<Range, "RangeState">({ name: "RangeState" });
type _slotName = Expect<Equal<ContextNames<typeof RangeState>, "RangeState">>;
// @ts-expect-error a slot is a requirement: it needs a name
const _unnamed: UnnamedContext = createSlot<Range>({ name: "x" as string });

// the required form gives the lens and requires the slot
const Picker = component(function* Picker() {
  const lens = yield* $slot(RangeState);
  type _lens = Expect<Equal<typeof lens, Lens<Range>>>;
  const [range] = lens;
  return view(function* () {
    return <p>{yield* range.from}</p>;
  });
});
type _in = Expect<Equal<RequiresOfComponent<typeof Picker>, typeof RangeState>>;
// @ts-expect-error [NO_PROVIDER] the root requires RangeState
render(Picker, root);

// the init form requires nothing
const OwnPicker = component(function* OwnPicker() {
  const [range] = yield* $slot(RangeState, { init: initRange });
  return view(function* () {
    return <p>{yield* range.from}</p>;
  });
});
type _own = Expect<Equal<RequiresOfComponent<typeof OwnPicker>, never>>;
render(OwnPicker, root);

// a slot is read with $slot only
const ReadsSlot = component(function* ReadsSlot() {
  // @ts-expect-error a slot is not iterable: read it with $slot
  yield* RangeState;
  return view(function* () {
    return <p />;
  });
});
void ReadsSlot;

// the provider takes a settled lens of the slot's state, and discharges it
const Bound = component(function* Bound() {
  const page = yield* $store<Booking>({ dates: initRange(), guests: initGuests(), note: "" });
  return view(function* () {
    return (
      <div>
        {
          yield* RangeState.provide({
            value: focus(page, "dates"),
            children: function* () {
              return <span>{yield* Picker()}</span>;
            }
          })
        }
        {
          yield* RangeState.provide({
            // @ts-expect-error a slot binds a lens, not a value
            value: initRange(),
            children: function* () {
              return <span />;
            }
          })
        }
        {
          yield* RangeState.provide({
            // @ts-expect-error … of the slot's state
            value: focus(page, "guests"),
            children: function* () {
              return <span />;
            }
          })
        }
      </div>
    );
  });
});
type _bound = Expect<Equal<RequiresOfComponent<typeof Bound>, never>>;
render(Bound, root);

// --- compose -----------------------------------------------------------------------------------

const GuestsState = createSlot<Guests, "GuestsState">({ name: "GuestsState" });
const BookingParts = compose({
  dates: { init: initRange, slot: RangeState },
  guests: { init: initGuests }
});
type _state = Expect<Equal<ReturnType<typeof BookingParts.init>, { dates: Range; guests: Guests }>>;
// @ts-expect-error an entry's slot is a slot of that entry's state
compose({ dates: { init: initRange, slot: GuestsState } });

const Composed = component(function* Composed() {
  const container = yield* BookingParts.$store();
  type _container = Expect<Equal<typeof container, Lens<{ dates: Range; guests: Guests }>>>;
  const parts = BookingParts.lenses(container);
  type _parts = Expect<
    Equal<typeof parts, { readonly dates: Lens<Range>; readonly guests: Lens<Guests> }>
  >;
  return view(function* () {
    return (
      <div>
        {
          yield* BookingParts.provide({
            value: container,
            children: function* () {
              return (
                <span>
                  {yield* Picker()}
                  {yield* DateRange({ state: parts.dates })}
                </span>
              );
            }
          })
        }
      </div>
    );
  });
});
// provide discharged RangeState
type _composed = Expect<Equal<RequiresOfComponent<typeof Composed>, never>>;
render(Composed, root);

// a composer discharges only the slots in its schema
const PartialBind = component(function* PartialBind() {
  const container = yield* BookingParts.$store();
  return view(function* () {
    return (
      <div>
        {
          yield* BookingParts.provide({
            value: container,
            children: function* () {
              return <span>{yield* GuestsPicker()}</span>;
            }
          })
        }
      </div>
    );
  });
});
const GuestsPicker = component(function* GuestsPicker() {
  const [guests] = yield* $slot(GuestsState);
  return view(function* () {
    return <p>{yield* guests.adults}</p>;
  });
});
type _partial = Expect<Equal<RequiresOfComponent<typeof PartialBind>, typeof GuestsState>>;
