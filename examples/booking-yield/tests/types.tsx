// Type tests, checked by `pnpm typecheck`: a required slot is a requirement
// (`R`) the root refuses; the container's provider discharges it, another
// slot's provider does not, and a standalone slot adds none.
import { component, render, view } from "solid-yield";
import { BookingPage } from "../src/app";
import { DateRangePicker, DateRangeSlot, emptyRange } from "../src/dateRange";
import { GuestCount } from "../src/guests";
import { compose } from "../src/lib/compose";
import { createSlot } from "../src/lib/slot";

declare const root: HTMLElement;

render(BookingPage, root);
render(() => DateRangePicker({ label: "alone" }), root);
// @ts-expect-error [NO_PROVIDER] the root requires GuestsSlot
render(GuestCount, root);

const WrongProvider = component(function* WrongProvider() {
  const booking = yield* compose({ dates: { init: emptyRange, slot: DateRangeSlot } });
  return view(function* () {
    return (
      <>
        {
          yield* booking.provide({
            children: function* () {
              return <>{yield* GuestCount()}</>;
            }
          })
        }
      </>
    );
  });
});
// @ts-expect-error [NO_PROVIDER] a provider of DateRangeSlot discharges only DateRangeSlot
render(WrongProvider, root);

// a standalone slot makes a `$store` of its `init`: an object, never a primitive
// @ts-expect-error Type 'number' does not satisfy the constraint 'object'
createSlot<number, "Count">({ name: "Count", init: () => 0 });
createSlot<{ count: number }, "Count">({ name: "Count", init: () => ({ count: 0 }) });
