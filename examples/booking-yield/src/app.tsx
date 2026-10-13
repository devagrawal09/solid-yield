// The booking page: one container, the date range through its slot (twice,
// on two keys), the guests through props and through a required slot, and a
// total computed across the modules' state.
import { $memo, component, view } from "solid-yield";
import { compose } from "./lib/compose";
import { DateRangePicker, DateRangeSlot, emptyRange, nights } from "./dateRange";
import { GuestCount, GuestsPicker, GuestsSlot, oneAdult } from "./guests";

const RATE = 100;

export const BookingPage = component(function* BookingPage() {
  const booking = yield* compose({
    dates: { init: emptyRange, slot: DateRangeSlot },
    returnDates: { init: emptyRange },
    guests: { init: oneAdult, slot: GuestsSlot }
  });
  const total = yield* $memo(function* () {
    const out = nights(yield* booking.at.dates.checkIn, yield* booking.at.dates.checkOut);
    const back = nights(
      yield* booking.at.returnDates.checkIn,
      yield* booking.at.returnDates.checkOut
    );
    const people = (yield* booking.at.guests.adults) + (yield* booking.at.guests.children);
    return (out + back) * people * RATE;
  });
  return view(function* () {
    return (
      <main>
        {
          yield* booking.provide({
            children: function* () {
              return (
                <>
                  {yield* DateRangePicker({ label: "Outbound" })}
                  {
                    yield* GuestsPicker({
                      guests: booking.parts.guests.at,
                      setGuests: booking.parts.guests.set
                    })
                  }
                  {yield* GuestCount()}
                </>
              );
            }
          })
        }
        {
          yield* DateRangeSlot.provide({
            value: booking.parts.returnDates,
            children: function* () {
              return <>{yield* DateRangePicker({ label: "Return" })}</>;
            }
          })
        }
        <p class="total">{yield* total}</p>
      </main>
    );
  });
});
