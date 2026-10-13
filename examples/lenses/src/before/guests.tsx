// BEFORE (without lenses). The guest rule stays in this file, in a
// helper. A parent must call the helper and pass each count and the
// handler as props.
import { $event, $store, component, view, type Handler, type Props, type Source } from "solid-yield";
import { MAX_GUESTS } from "../shared";

export type GuestsS = { adults: number; kids: number };
export type GuestKind = keyof GuestsS;

/** The state and the rules of the guest counts. The parent calls this in its setup. */
export function* createGuests() {
  const [guests, setGuests] = yield* $store<GuestsS>({ adults: 1, kids: 0 });
  const step = $event(function* (kind: GuestKind, by: 1 | -1) {
    yield* setGuests(d => {
      const next = d[kind] + by;
      const min = kind === "adults" ? 1 : 0;
      if (next >= min && d.adults + d.kids + by <= MAX_GUESTS) d[kind] = next;
    });
  });
  const reset = $event(function* () {
    yield* setGuests(() => ({ adults: 1, kids: 0 }));
  });
  return { guests, step, reset };
}

export const Guests = component(function* Guests(
  props: Props<{
    adults: Source<number>;
    kids: Source<number>;
    onStep: Handler<[GuestKind, 1 | -1]>;
  }>
) {
  // a handler in a prop is read, then called: a double yield
  const step = (kind: GuestKind, by: 1 | -1) =>
    $event(function* () {
      yield* (yield* props.onStep)(kind, by);
    });
  const addAdult = step("adults", 1);
  const removeAdult = step("adults", -1);
  const addKid = step("kids", 1);
  const removeKid = step("kids", -1);
  return view(function* () {
    return (
      <fieldset class="guests">
        <legend>Guests</legend>
        <div class="row adults">
          <span>Adults</span>
          <button class="minus" onClick={yield* removeAdult}>
            −
          </button>
          <span class="count">{yield* props.adults}</span>
          <button class="plus" onClick={yield* addAdult}>
            +
          </button>
        </div>
        <div class="row kids">
          <span>Children</span>
          <button class="minus" onClick={yield* removeKid}>
            −
          </button>
          <span class="count">{yield* props.kids}</span>
          <button class="plus" onClick={yield* addKid}>
            +
          </button>
        </div>
      </fieldset>
    );
  });
});
