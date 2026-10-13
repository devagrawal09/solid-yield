// The guide's "Share a part of a store: lenses and slots" examples
// (getting-started.md), type-checked and run (lenses.spec.tsx).
import {
  $event,
  $memo,
  $slot,
  $store,
  component,
  compose,
  createSlot,
  focus,
  view,
  type Lens,
  type Props
} from "solid-yield";

export type GuestsS = { adults: number; kids: number };
export const initGuests = (): GuestsS => ({ adults: 1, kids: 0 });

// a module with its state as a lens prop
export const Guests = component(function* Guests(props: Props<{ state: Lens<GuestsS> }>) {
  const [guests, setGuests] = props.state; // the lens itself, not a path
  const addKid = $event(function* () {
    yield* setGuests(draft => {
      draft.kids++;
    });
  });
  return view(function* () {
    return (
      <button class="kids" onClick={yield* addKid}>
        {yield* guests.kids}
      </button>
    );
  });
});

export const Party = component(function* Party() {
  const party = yield* $store({ guests: initGuests(), table: { seats: 4 } });
  const [state] = party;
  const free = yield* $memo(function* () {
    return (yield* state.table.seats) - (yield* state.guests.adults) - (yield* state.guests.kids);
  });
  return view(function* () {
    return (
      <div>
        {yield* Guests({ state: focus(party, "guests") })}
        <p class="free">{yield* free}</p>
      </div>
    );
  });
});

// the same module with its state in a slot
export const GuestsState = createSlot<GuestsS, "GuestsState">({ name: "GuestsState" });

export const SlotGuests = component(function* SlotGuests() {
  const [guests, setGuests] = yield* $slot(GuestsState, { init: initGuests });
  const addKid = $event(function* () {
    yield* setGuests(draft => {
      draft.kids++;
    });
  });
  return view(function* () {
    return (
      <button class="kids" onClick={yield* addKid}>
        {yield* guests.kids}
      </button>
    );
  });
});

const PartyState = compose({
  guests: { init: initGuests, slot: GuestsState },
  table: { init: () => ({ seats: 4 }) }
});

export const SlotParty = component(function* SlotParty() {
  const party = yield* PartyState.$store();
  const [state, setParty] = party;
  const free = yield* $memo(function* () {
    return (yield* state.table.seats) - (yield* state.guests.adults) - (yield* state.guests.kids);
  });
  const reset = $event(function* () {
    yield* setParty(() => PartyState.init());
  });
  return view(function* () {
    return (
      <div>
        {
          yield* PartyState.provide({
            value: party,
            children: function* () {
              return <>{yield* SlotGuests()}</>;
            }
          })
        }
        <p class="free">{yield* free}</p>
        <button class="reset" onClick={yield* reset}>
          Reset
        </button>
      </div>
    );
  });
});
