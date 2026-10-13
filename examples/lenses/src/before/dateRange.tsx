// BEFORE (without lenses). The date range rule stays in this file, in a
// helper. But the component cannot own its state: a parent must call the
// helper, hold the result, and pass each field and each handler as a prop.
import {
  $event,
  $memo,
  $store,
  component,
  For,
  view,
  type Handler,
  type Props,
  type Source
} from "solid-yield";
import { DAYS, dayClass, type Day } from "../shared";

export type DateRangeS = { checkIn: Day | null; checkOut: Day | null };

/** The state and the rules of one date range. The parent calls this in its setup. */
export function* createDateRange() {
  const [range, setRange] = yield* $store<DateRangeS>({ checkIn: null, checkOut: null });
  const pick = $event(function* (day: Day) {
    yield* setRange(d => {
      if (d.checkIn === null || d.checkOut !== null || day <= d.checkIn) {
        d.checkIn = day;
        d.checkOut = null;
      } else d.checkOut = day;
    });
  });
  const clear = $event(function* () {
    yield* setRange(d => {
      d.checkIn = null;
      d.checkOut = null;
    });
  });
  return { range, pick, clear };
}

export const DateRange = component(function* DateRange(
  props: Props<{
    checkIn: Source<Day | null>;
    checkOut: Source<Day | null>;
    onPick: Handler<[Day]>;
    onClear: Handler<[]>;
  }>
) {
  // a handler in a prop is read, then called: a double yield
  const clear = $event(function* () {
    yield* (yield* props.onClear)();
  });
  return view(function* () {
    return (
      <fieldset class="dates">
        <legend>Dates</legend>
        <div class="days">
          {yield* For({
            each: DAYS,
            children: function* (day) {
              const pick = $event(function* () {
                yield* (yield* props.onPick)(yield* day);
              });
              const cls = yield* $memo(function* () {
                return dayClass(yield* day, yield* props.checkIn, yield* props.checkOut);
              });
              return view(function* () {
                return (
                  <button class={yield* cls} onClick={yield* pick}>
                    {yield* day}
                  </button>
                );
              });
            }
          })}
        </div>
        <button class="clear" onClick={yield* clear}>
          Clear dates
        </button>
      </fieldset>
    );
  });
});
