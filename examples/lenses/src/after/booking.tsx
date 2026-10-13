// SLOTS (D-117). The page holds one store for the full booking, made by
// `compose` from the modules' own initial states. `provide` binds each
// module's slot to a lens on its part, and the page reads the public state
// of the modules for the total. Compare with ../before/booking.tsx:
// - no module props: each module gets one lens through its slot;
// - the second date range has no binding, so it uses its own local store;
// - "Reset" is one write to the container.
import { $event, $memo, compose, component, view } from "solid-yield";
import { RATE, nights } from "../shared";
import { DateRange, DateRangeState, initDateRange } from "./dateRange";
import { Guests, GuestsState, initGuests } from "./guests";

const Booking = compose({
  dates: { init: initDateRange, slot: DateRangeState },
  guests: { init: initGuests, slot: GuestsState }
});

export const BookingPage = component(function* BookingPage() {
  const booking = yield* Booking.$store();
  const [state, setBooking] = booking;

  const total = yield* $memo(function* () {
    const n = nights(yield* state.dates.checkIn, yield* state.dates.checkOut);
    return n * ((yield* state.guests.adults) + (yield* state.guests.kids)) * RATE;
  });
  const reset = $event(function* () {
    yield* setBooking(() => Booking.init());
  });

  return view(function* () {
    return (
      <section class="booking">
        {yield* Booking.provide({
          value: booking,
          children: function* () {
            return (
              <>
                {yield* DateRange()}
                {yield* Guests()}
              </>
            );
          }
        })}
        <p class="total">Total: {yield* total}</p>
        <button class="reset" onClick={yield* reset}>
          Reset booking
        </button>
        <h3>Flexible? Compare another range</h3>
        <div class="other">{yield* DateRange()}</div>
      </section>
    );
  });
});
