// A date range module. It reads its slice through a standalone slot: under a
// provider it edits the page's state, alone it makes its own.
import { $event, component, view, type Props } from "solid-yield";
import { createSlot, slot } from "./lib/slot";

export type DateRange = { checkIn: number | null; checkOut: number | null };
export const emptyRange = (): DateRange => ({ checkIn: null, checkOut: null });
export const nights = (checkIn: number | null, checkOut: number | null) =>
  checkIn === null || checkOut === null ? 0 : checkOut - checkIn;

export const DateRangeSlot = createSlot<DateRange, "DateRangeSlot">({
  name: "DateRangeSlot",
  init: emptyRange
});

/** `label` is a bare prop: held, read as it is. */
export const DateRangePicker = component(function* DateRangePicker(
  props: Props<{ label: string }>
) {
  const range = yield* slot(DateRangeSlot);
  const book = $event(function* () {
    yield* range.set(d => {
      d.checkIn = 1;
      d.checkOut = 4;
    });
  });
  const extend = $event(function* () {
    yield* range.set(d => {
      if (d.checkOut !== null) d.checkOut++;
    });
  });
  const clear = $event(function* () {
    yield* range.set(d => {
      d.checkIn = null;
      d.checkOut = null;
    });
  });
  return view(function* () {
    return (
      <fieldset class="range">
        <legend>{props.label}</legend>
        <output>
          {yield* range.at.checkIn}–{yield* range.at.checkOut}
        </output>
        <button class="book" onClick={yield* book}>
          3 nights
        </button>
        <button class="extend" onClick={yield* extend}>
          +1 night
        </button>
        <button class="clear" onClick={yield* clear}>
          clear
        </button>
      </fieldset>
    );
  });
});
