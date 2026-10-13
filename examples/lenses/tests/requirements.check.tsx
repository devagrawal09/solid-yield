// Type checks only (`pnpm typecheck`); vitest does not run this file.
import { $store, component, render, view } from "solid-yield";
import { DateRange } from "../src/after/dateRange";
import { Guests } from "../src/after/guests";
import { BookingPage } from "../src/after/booking";
import { Guests as GuestsProp, initGuests } from "../src/lens-prop/guests";

export function checks(el: HTMLElement) {
  // Slots. DateRange uses `$slot(Slot, { init })`: it can operate alone.
  render(DateRange, el);

  // Guests uses `$slot(Slot)`: the root must have a provider of GuestsState.
  // @ts-expect-error [NO_PROVIDER] the root requires GuestsState
  render(Guests, el);

  // BookingPage binds both slots, so nothing is left at the root.
  render(BookingPage, el);
}

// Lens props. The lens is a required prop: a call without it is a type error
// at the call site, not at the root.
export const WithLens = component(function* WithLens() {
  const guests = yield* $store(initGuests());
  return view(function* () {
    return <div>{yield* GuestsProp({ state: guests })}</div>;
  });
});
export const WithoutLens = component(function* WithoutLens() {
  return view(function* () {
    // @ts-expect-error the `state` prop is required
    return <div>{yield* GuestsProp()}</div>;
  });
});
