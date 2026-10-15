// A guests module. The picker is a direct child and takes its slice as two
// props (a path to read, a handler to write); the count reads a required slot.
import { $event, component, view, type Handler, type Props, type Source } from "solid-yield";
import { createSlot, slot } from "./lib/slot";

export type Guests = { adults: number; children: number };
export const oneAdult = (): Guests => ({ adults: 1, children: 0 });

/** Required: a module that reads it needs a provider above (`R`). */
export const GuestsSlot = createSlot<Guests, "GuestsSlot">({ name: "GuestsSlot" });

export const GuestsPicker = component(function* GuestsPicker(
  props: Props<{ guests: Source<Guests>; setGuests: Handler<[write: (draft: Guests) => void]> }>
) {
  const adult = $event(function* () {
    yield* props.setGuests(d => {
      d.adults++;
    });
  });
  const child = $event(function* () {
    yield* props.setGuests(d => {
      d.children++;
    });
  });
  return view(function* () {
    return (
      <p class="guests">
        <output>
          {yield* props.guests.adults}+{yield* props.guests.children}
        </output>
        <button class="adult" onClick={yield* adult}>
          +adult
        </button>
        <button class="child" onClick={yield* child}>
          +child
        </button>
      </p>
    );
  });
});

export const GuestCount = component(function* GuestCount() {
  const guests = yield* slot(GuestsSlot);
  return view(function* () {
    return <p class="count">{(yield* guests.at.adults) + (yield* guests.at.children)} guests</p>;
  });
});
