// LENS PROP (D-125). The guest counts get their
// lens as a required prop. A call without it is a type error at the call
// site; see tests/requirements.check.tsx.
import { $event, component, view, type Lens, type Props } from "solid-yield";
import { MAX_GUESTS } from "../shared";

export type GuestsS = { adults: number; kids: number };
export type GuestKind = keyof GuestsS;
export const initGuests = (): GuestsS => ({ adults: 1, kids: 0 });

export const Guests = component(function* Guests(props: Props<{ state: Lens<GuestsS> }>) {
  const [guests, setGuests] = props.state;
  const step = (kind: GuestKind, by: 1 | -1) =>
    $event(function* () {
      yield* setGuests(d => {
        const next = d[kind] + by;
        const min = kind === "adults" ? 1 : 0;
        if (next >= min && d.adults + d.kids + by <= MAX_GUESTS) d[kind] = next;
      });
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
          <span class="count">{yield* guests.adults}</span>
          <button class="plus" onClick={yield* addAdult}>
            +
          </button>
        </div>
        <div class="row kids">
          <span>Children</span>
          <button class="minus" onClick={yield* removeKid}>
            −
          </button>
          <span class="count">{yield* guests.kids}</span>
          <button class="plus" onClick={yield* addKid}>
            +
          </button>
        </div>
      </fieldset>
    );
  });
});
