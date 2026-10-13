// LENS PROP (D-116). The page holds one store
// for the full booking, as in ../after. It gives each module a lens on its
// part as a prop. Compare with ../after/booking.tsx:
// - no providers: each call site shows the lens that the module gets;
// - the second date range has no local fallback, so the page makes a
//   store for it and gives that store as the lens.
import { $event, $memo, $store, component, focus, view } from "solid-yield";
import { RATE, nights } from "../shared";
import { DateRange, initDateRange, type DateRangeS } from "./dateRange";
import { Guests, initGuests, type GuestsS } from "./guests";

type Booking = { dates: DateRangeS; guests: GuestsS };
const initBooking = (): Booking => ({ dates: initDateRange(), guests: initGuests() });

export const BookingPage = component(function* BookingPage() {
  const booking = yield* $store<Booking>(initBooking());
  const [state, setBooking] = booking;
  const otherDates = yield* $store<DateRangeS>(initDateRange());

  const total = yield* $memo(function* () {
    const n = nights(yield* state.dates.checkIn, yield* state.dates.checkOut);
    return n * ((yield* state.guests.adults) + (yield* state.guests.kids)) * RATE;
  });
  const reset = $event(function* () {
    yield* setBooking(() => initBooking());
  });

  return view(function* () {
    return (
      <section class="booking">
        {yield* DateRange({ state: focus(booking, "dates") })}
        {yield* Guests({ state: focus(booking, "guests") })}
        <p class="total">Total: {yield* total}</p>
        <button class="reset" onClick={yield* reset}>
          Reset booking
        </button>
        <h3>Flexible? Compare another range</h3>
        <div class="other">{yield* DateRange({ state: otherDates })}</div>
      </section>
    );
  });
});
