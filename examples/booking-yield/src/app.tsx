// The booking page: one container, the date range through its slot (twice,
// on two keys), the guests through props and through a required slot, and a
// total computed across the modules' state; a travellers list whose page-owned
// drafts the page prunes (policy "prune", the default) or keeps ("keep").
import { $event, $memo, component, readStore, view, type Props } from "solid-yield";
import { compose } from "./lib/compose";
import { prune } from "./lib/prune";
import { TravellerList, type Drafts, type Traveller } from "./travellers";
import { DateRangePicker, DateRangeSlot, emptyRange, nights } from "./dateRange";
import { GuestCount, GuestsPicker, GuestsSlot, oneAdult } from "./guests";

const RATE = 100;

const firstTraveller = (): Traveller[] => [{ id: "t1", name: "Traveller 1" }];

export const BookingPage = component(function* BookingPage(
  props: Props<{ policy?: "prune" | "keep" }>
) {
  const booking = yield* compose({
    dates: { init: emptyRange, slot: DateRangeSlot },
    returnDates: { init: emptyRange },
    guests: { init: oneAdult, slot: GuestsSlot },
    travellers: { init: firstTraveller },
    drafts: { init: (): Drafts => ({}) }
  });
  // the page owns the drafts, so the page chooses their policy: a held prop, compared in the setup
  if (props.policy !== "keep")
    yield* prune(
      booking.parts.drafts,
      readStore(booking.at.travellers, ts => ts.map(t => t.id))
    );
  const addTraveller = $event(function* () {
    yield* booking.parts.travellers.set(ts => {
      ts.push({ id: `t${ts.length + 1}`, name: `Traveller ${ts.length + 1}` });
    });
  });
  const removeTraveller = $event(function* () {
    yield* booking.parts.travellers.set(ts => {
      ts.pop();
    });
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
        {yield* TravellerList({ travellers: booking.at.travellers, drafts: booking.parts.drafts })}
        <button class="add-traveller" onClick={yield* addTraveller}>
          add traveller
        </button>
        <button class="remove-traveller" onClick={yield* removeTraveller}>
          remove last traveller
        </button>
      </main>
    );
  });
});
