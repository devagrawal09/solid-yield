// BEFORE (without lenses). The total must read the dates and the guests,
// so this page owns their state. Each module's state is a separate store
// that the page must make, hold and wire:
// - 7 props at the two call sites (each field and each handler);
// - a second date range costs a second helper call and 4 more props;
// - "Reset" must call a reset event of each module, in the correct order.
import { $event, $memo, component, view } from "solid-yield";
import { RATE, nights } from "../shared";
import { createDateRange, DateRange } from "./dateRange";
import { createGuests, Guests } from "./guests";

export const BookingPage = component(function* BookingPage() {
  const dates = yield* createDateRange();
  const guests = yield* createGuests();
  const otherDates = yield* createDateRange();

  const total = yield* $memo(function* () {
    const n = nights(yield* dates.range.checkIn, yield* dates.range.checkOut);
    return n * ((yield* guests.guests.adults) + (yield* guests.guests.kids)) * RATE;
  });
  const reset = $event(function* () {
    yield* dates.clear();
    yield* guests.reset();
  });

  return view(function* () {
    return (
      <section class="booking">
        {yield* DateRange({
          checkIn: dates.range.checkIn,
          checkOut: dates.range.checkOut,
          onPick: dates.pick,
          onClear: dates.clear
        })}
        {yield* Guests({
          adults: guests.guests.adults,
          kids: guests.guests.kids,
          onStep: guests.step
        })}
        <p class="total">Total: {yield* total}</p>
        <button class="reset" onClick={yield* reset}>
          Reset booking
        </button>
        <h3>Flexible? Compare another range</h3>
        <div class="other">
          {yield* DateRange({
            checkIn: otherDates.range.checkIn,
            checkOut: otherDates.range.checkOut,
            onPick: otherDates.pick,
            onClear: otherDates.clear
          })}
        </div>
      </section>
    );
  });
});
